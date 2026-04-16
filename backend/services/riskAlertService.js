import dayjs from 'dayjs';
import AppUsageTick from '../models/AppUsageTick.js';
import LeaveRequest from '../models/LeaveRequest.js';
import RiskAlert from '../models/RiskAlert.js';
import TimeSheetDay from '../models/TimeSheetDay.js';
import { getSettings } from './settingsService.js';

const ALERT_TYPES = ['no_clockin_2days', 'low_hours', 'too_much_idle', 'no_usage_ticks'];
const LOW_HOURS_RATIO = 0.5;
const MIN_SHIFT_MINUTES_FOR_LOW_HOURS = 120;
const MIN_SHIFT_MINUTES_FOR_USAGE = 60;
const IDLE_MINUTES_THRESHOLD = 90;
const IDLE_THRESHOLD_SECONDS = 120;

const startOfDay = (value) => dayjs(value).startOf('day').toDate();

const computeTodayMinutes = (record, now) => {
  if (!record?.clockInAt) return { workedMinutes: 0, breakMinutes: 0 };
  const clockInMs = new Date(record.clockInAt).getTime();
  const clockOutMs = record.clockOutAt ? new Date(record.clockOutAt).getTime() : now.getTime();
  if (!Number.isFinite(clockInMs) || !Number.isFinite(clockOutMs)) {
    return { workedMinutes: 0, breakMinutes: 0 };
  }
  const totalMinutes = Math.max(0, Math.round((clockOutMs - clockInMs) / 60000));
  const breakExtra =
    record.breakStartedAt && !record.clockOutAt
      ? Math.max(0, Math.round((now.getTime() - new Date(record.breakStartedAt).getTime()) / 60000))
      : 0;
  const breakMinutes = Math.max(0, Number(record.breakMinutes || 0) + breakExtra);
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
  return { workedMinutes, breakMinutes };
};

const computeShiftWindow = (now, settings) => {
  const todayStart = startOfDay(now);
  const shiftStart = dayjs(todayStart).add(settings.workStartHour ?? 9, 'hour').toDate();
  const shiftEnd = dayjs(todayStart).add(settings.workEndHour ?? 18, 'hour').toDate();
  const shiftDuration = Math.max(0, Math.round((shiftEnd.getTime() - shiftStart.getTime()) / 60000));
  let elapsedMinutes = 0;
  if (now >= shiftStart && now <= shiftEnd) {
    elapsedMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
  } else if (now > shiftEnd) {
    elapsedMinutes = shiftDuration;
  }
  return { shiftStart, shiftEnd, shiftDuration, elapsedMinutes };
};

const buildAlertMessage = (type) => {
  switch (type) {
    case 'no_clockin_2days':
      return 'No clock-in activity for 2 days and no leave recorded.';
    case 'low_hours':
      return 'Worked hours are far below expected shift time.';
    case 'too_much_idle':
      return 'Idle time is unusually high during the shift.';
    case 'no_usage_ticks':
      return 'No platform usage ticks detected during work hours.';
    default:
      return 'Risk alert triggered.';
  }
};

const computeSeverity = (type) => {
  if (type === 'no_clockin_2days') return 'critical';
  return 'warning';
};

export const evaluateRiskAlerts = async (userIds, now = new Date()) => {
  if (!userIds.length) return { riskByUser: new Map(), alertsByUser: new Map() };

  const settings = await getSettings();
  const todayStart = startOfDay(now);
  const yesterdayStart = dayjs(todayStart).subtract(1, 'day').toDate();
  const { shiftStart, shiftEnd, shiftDuration, elapsedMinutes } = computeShiftWindow(now, settings);

  const timesheetRecords = await TimeSheetDay.find({
    user: { $in: userIds },
    date: { $in: [todayStart, yesterdayStart] }
  }).lean();

  const todayMap = new Map();
  const yesterdayMap = new Map();
  timesheetRecords.forEach((record) => {
    const key = record.user.toString();
    if (dayjs(record.date).isSame(todayStart, 'day')) todayMap.set(key, record);
    if (dayjs(record.date).isSame(yesterdayStart, 'day')) yesterdayMap.set(key, record);
  });

  const leaveRequests = await LeaveRequest.find({
    userId: { $in: userIds },
    status: 'approved',
    startAt: { $lte: todayStart },
    endAt: { $gte: yesterdayStart }
  }).lean();

  const onLeaveToday = new Set();
  const onLeaveYesterday = new Set();
  leaveRequests.forEach((request) => {
    const userId = request.userId.toString();
    if (request.startAt <= todayStart && request.endAt >= todayStart) {
      onLeaveToday.add(userId);
    }
    if (request.startAt <= yesterdayStart && request.endAt >= yesterdayStart) {
      onLeaveYesterday.add(userId);
    }
  });

  let usageCounts = new Map();
  const withinShift = now >= shiftStart && now <= shiftEnd;
  if (withinShift && elapsedMinutes >= MIN_SHIFT_MINUTES_FOR_USAGE) {
    const rows = await AppUsageTick.aggregate([
      {
        $match: {
          user: { $in: userIds },
          ts: { $gte: shiftStart, $lt: now }
        }
      },
      { $group: { _id: '$user', ticks: { $sum: 1 } } }
    ]);
    usageCounts = new Map(rows.map((row) => [row._id.toString(), row.ticks]));
  }

  const existingAlerts = await RiskAlert.find({
    userId: { $in: userIds },
    type: { $in: ALERT_TYPES },
    status: { $ne: 'resolved' }
  });
  const existingMap = new Map();
  existingAlerts.forEach((alert) => {
    existingMap.set(`${alert.userId.toString()}:${alert.type}`, alert);
  });

  const riskByUser = new Map();
  const alertsByUser = new Map();
  const autoResolve = [];
  const updates = [];

  userIds.forEach((userId) => {
    const id = userId.toString();
    const todayRecord = todayMap.get(id);
    const yesterdayRecord = yesterdayMap.get(id);
    const hasClockedLast2Days =
      Boolean(todayRecord?.clockInAt) || Boolean(yesterdayRecord?.clockInAt);

    const { workedMinutes } = computeTodayMinutes(todayRecord, now);
    const activeMinutes = Number(todayRecord?.activeMinutes || 0);
    const idleMinutes = Number(todayRecord?.idleMinutes || 0);

    const triggered = [];
    if (!hasClockedLast2Days && !onLeaveToday.has(id) && !onLeaveYesterday.has(id)) {
      triggered.push('no_clockin_2days');
    }

    if (
      shiftDuration > 0
      && elapsedMinutes >= MIN_SHIFT_MINUTES_FOR_LOW_HOURS
      && workedMinutes < Math.round(elapsedMinutes * LOW_HOURS_RATIO)
      && !onLeaveToday.has(id)
    ) {
      triggered.push('low_hours');
    }

    if (idleMinutes >= IDLE_MINUTES_THRESHOLD && idleMinutes >= activeMinutes && !onLeaveToday.has(id)) {
      triggered.push('too_much_idle');
    }

    if (withinShift && elapsedMinutes >= MIN_SHIFT_MINUTES_FOR_USAGE && !onLeaveToday.has(id)) {
      const ticks = usageCounts.get(id) || 0;
      if (ticks === 0) triggered.push('no_usage_ticks');
    }

    const activeAlerts = [];
    const triggeredSet = new Set(triggered);

    ALERT_TYPES.forEach((type) => {
      const key = `${id}:${type}`;
      const existing = existingMap.get(key);
      const isTriggered = triggeredSet.has(type);
      if (!isTriggered && existing) {
        if (existing.status === 'snoozed' && existing.snoozedUntil && existing.snoozedUntil > now) {
          return;
        }
        existing.status = 'resolved';
        existing.resolvedAt = now;
        updates.push(existing.save());
        return;
      }
      if (!isTriggered) return;

      const severity = computeSeverity(type);
      const message = buildAlertMessage(type);
      const metadata = { workedMinutes, idleMinutes, shiftMinutes: shiftDuration };

      if (existing) {
        if (existing.status === 'snoozed' && existing.snoozedUntil && existing.snoozedUntil > now) {
          return;
        }
        existing.status = 'open';
        existing.severity = severity;
        existing.message = message;
        existing.metadata = metadata;
        existing.snoozedUntil = null;
        existing.lastTriggeredAt = now;
        updates.push(existing.save());
        activeAlerts.push(existing);
      } else {
        autoResolve.push(
          RiskAlert.create({
            userId,
            type,
            severity,
            status: 'open',
            message,
            metadata,
            lastTriggeredAt: now
          })
        );
        activeAlerts.push({ userId, type, severity, status: 'open', message });
      }
    });

    let riskLevel = 'green';
    if (activeAlerts.some((alert) => alert.severity === 'critical')) riskLevel = 'red';
    else if (activeAlerts.length) riskLevel = 'yellow';

    riskByUser.set(id, riskLevel);
    alertsByUser.set(id, activeAlerts);
  });

  if (autoResolve.length || updates.length) {
    await Promise.all([...autoResolve, ...updates]);
  }

  return { riskByUser, alertsByUser };
};

export const listRiskAlertsForUsers = async (userIds, status) => {
  const filter = { userId: { $in: userIds } };
  if (status && status !== 'all') filter.status = status;
  return RiskAlert.find(filter)
    .populate('userId', 'name email role department lastActiveAt')
    .sort({ createdAt: -1 });
};

export const resolveRiskAlert = async (alertId, note) => {
  const alert = await RiskAlert.findById(alertId);
  if (!alert) return null;
  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  if (note) alert.note = note;
  await alert.save();
  return alert;
};

export const snoozeRiskAlert = async (alertId, snoozedUntil, note) => {
  const alert = await RiskAlert.findById(alertId);
  if (!alert) return null;
  alert.status = 'snoozed';
  alert.snoozedUntil = snoozedUntil;
  if (note) alert.note = note;
  await alert.save();
  return alert;
};

export const addRiskAlertNote = async (alertId, note) => {
  const alert = await RiskAlert.findById(alertId);
  if (!alert) return null;
  alert.note = note;
  await alert.save();
  return alert;
};
