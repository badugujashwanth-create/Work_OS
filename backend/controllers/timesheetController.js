import dayjs from 'dayjs';
import TimeSheetDay from '../models/TimeSheetDay.js';
import LeaveRequest from '../models/LeaveRequest.js';

const startOfDay = (value) => dayjs(value).startOf('day').toDate();

const parseDateParam = (value) => {
  const parsed = value ? dayjs(value) : dayjs();
  if (!parsed.isValid()) return null;
  return parsed.startOf('day').toDate();
};

const findOrCreateRecord = async (userId, dateValue = new Date()) => {
  const day = startOfDay(dateValue);
  let record = await TimeSheetDay.findOne({ user: userId, date: day });
  if (!record) {
    record = await TimeSheetDay.create({ user: userId, date: day });
  }
  return record;
};

const applyActiveBreak = (record, endTime) => {
  if (!record.breakStartedAt) return;
  const diffMs = endTime.getTime() - record.breakStartedAt.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  record.breakMinutes = Math.max(0, (record.breakMinutes || 0) + diffMinutes);
  record.breakStartedAt = null;
};

const computePayableMinutes = (record, endTime) => {
  if (!record.clockInAt) return record.payableMinutes || 0;
  const totalMinutes = Math.max(
    0,
    Math.round((endTime.getTime() - record.clockInAt.getTime()) / 60000)
  );
  return Math.max(0, totalMinutes - (record.breakMinutes || 0));
};

export const clockIn = async (req, res) => {
  const today = startOfDay(new Date());
  const onLeave = await LeaveRequest.findOne({
    userId: req.user._id,
    status: 'approved',
    durationType: 'full_day',
    startAt: { $lte: today },
    endAt: { $gte: today }
  }).select('_id');
  if (onLeave) {
    return res.status(400).json({ message: 'You are on approved leave today. Clock-in is disabled.' });
  }
  const record = await findOrCreateRecord(req.user._id);
  if (record.clockInAt) return res.status(400).json({ message: 'Already clocked in' });
  if (record.clockOutAt) return res.status(400).json({ message: 'Already clocked out' });

  record.clockInAt = new Date();
  await record.save();
  res.json(record);
};

export const clockOut = async (req, res) => {
  const record = await findOrCreateRecord(req.user._id);
  if (!record.clockInAt) return res.status(400).json({ message: 'No active session' });
  if (record.clockOutAt) return res.status(400).json({ message: 'Already clocked out' });

  const now = new Date();
  record.clockOutAt = now;
  applyActiveBreak(record, now);
  record.payableMinutes = computePayableMinutes(record, now);
  await record.save();
  res.json(record);
};

export const breakStart = async (req, res) => {
  const record = await findOrCreateRecord(req.user._id);
  if (!record.clockInAt) return res.status(400).json({ message: 'Clock in first' });
  if (record.clockOutAt) return res.status(400).json({ message: 'Already clocked out' });
  if (record.breakStartedAt) return res.status(400).json({ message: 'Break already started' });

  record.breakStartedAt = new Date();
  await record.save();
  res.json(record);
};

export const breakEnd = async (req, res) => {
  const record = await findOrCreateRecord(req.user._id);
  if (!record.clockInAt) return res.status(400).json({ message: 'Clock in first' });
  if (!record.breakStartedAt) return res.status(400).json({ message: 'No active break' });

  const now = new Date();
  applyActiveBreak(record, now);
  if (record.clockOutAt) {
    record.payableMinutes = computePayableMinutes(record, record.clockOutAt);
  }
  await record.save();
  res.json(record);
};

export const getMyTimesheet = async (req, res) => {
  const day = parseDateParam(req.query.date);
  if (!day) return res.status(400).json({ message: 'Invalid date' });
  const record = await TimeSheetDay.findOne({ user: req.user._id, date: day });
  res.json(record || null);
};

export const getAdminTimesheets = async (req, res) => {
  const day = parseDateParam(req.query.date);
  if (!day) return res.status(400).json({ message: 'Invalid date' });
  const nextDay = dayjs(day).add(1, 'day').toDate();
  const records = await TimeSheetDay.find({ date: { $gte: day, $lt: nextDay } })
    .populate('user', 'name email role department')
    .sort({ date: -1 });
  res.json(records);
};

export const saveNote = async (req, res) => {
  const day = parseDateParam(req.body?.date || req.query?.date);
  if (!day) return res.status(400).json({ message: 'Invalid date' });
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const record = await findOrCreateRecord(req.user._id, day);
  record.note = note;
  await record.save();
  res.json(record);
};

const escapeCSV = (value) => {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatMinutes = (minutes) => {
  if (!minutes) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

export const exportTimesheetCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? dayjs(startDate).startOf('day').toDate() : dayjs().subtract(30, 'days').startOf('day').toDate();
    const end = endDate ? dayjs(endDate).endOf('day').toDate() : dayjs().endOf('day').toDate();

    const records = await TimeSheetDay.find({
      user: req.user._id,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    let csv = 'Date,Clock In,Clock Out,Break Time,Payable Hours,Notes\n';
    records.forEach((record) => {
      const date = dayjs(record.date).format('YYYY-MM-DD');
      const clockIn = record.clockInAt ? dayjs(record.clockInAt).format('HH:mm') : '-';
      const clockOut = record.clockOutAt ? dayjs(record.clockOutAt).format('HH:mm') : '-';
      const breakTime = formatMinutes(record.breakMinutes);
      const payableHours = formatMinutes(record.payableMinutes);
      const note = record.note || '';

      csv += `${escapeCSV(date)},${escapeCSV(clockIn)},${escapeCSV(clockOut)},${escapeCSV(breakTime)},${escapeCSV(payableHours)},${escapeCSV(note)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-${dayjs().format('YYYY-MM-DD')}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Failed to export timesheet' });
  }
};

export const adminExportTimesheetCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? dayjs(startDate).startOf('day').toDate() : dayjs().subtract(30, 'days').startOf('day').toDate();
    const end = endDate ? dayjs(endDate).endOf('day').toDate() : dayjs().endOf('day').toDate();

    const records = await TimeSheetDay.find({
      date: { $gte: start, $lte: end }
    })
      .populate('user', 'name email department role')
      .sort({ date: -1, 'user.name': 1 });

    let csv = 'Date,Employee Name,Email,Department,Clock In,Clock Out,Break Time,Payable Hours,Notes\n';
    records.forEach((record) => {
      const date = dayjs(record.date).format('YYYY-MM-DD');
      const userName = record.user?.name || 'Unknown';
      const email = record.user?.email || '';
      const department = record.user?.department || '';
      const clockIn = record.clockInAt ? dayjs(record.clockInAt).format('HH:mm') : '-';
      const clockOut = record.clockOutAt ? dayjs(record.clockOutAt).format('HH:mm') : '-';
      const breakTime = formatMinutes(record.breakMinutes);
      const payableHours = formatMinutes(record.payableMinutes);
      const note = record.note || '';

      csv += `${escapeCSV(date)},${escapeCSV(userName)},${escapeCSV(email)},${escapeCSV(department)},${escapeCSV(clockIn)},${escapeCSV(clockOut)},${escapeCSV(breakTime)},${escapeCSV(payableHours)},${escapeCSV(note)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="timesheets-all-${dayjs().format('YYYY-MM-DD')}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Failed to export timesheets' });
  }
};
