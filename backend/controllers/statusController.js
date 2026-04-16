import ActivityAlert from '../models/ActivityAlert.js';
import User from '../models/User.js';
import WorkSession from '../models/WorkSession.js';
import LeaveRequest from '../models/LeaveRequest.js';
import TimeSheetDay from '../models/TimeSheetDay.js';
import {
  listLiveSessions,
  getActiveSession
} from '../services/workSessionService.js';
import { getIdleMinutesFromLastActive, getPresenceStatus } from '../services/presenceService.js';

const calculateWorkingMs = (sessions) =>
  sessions.reduce((sum, session) => {
    const startMs = session.startTime ? new Date(session.startTime).getTime() : Date.now();
    const endMs = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    const activeMs = Math.max(0, endMs - startMs - (session.idleTime || 0));
    return sum + activeMs;
  }, 0);

const buildStatusRecord = (user, workingMs = 0, activeSession = null, reason = null) => {
  const status = getPresenceStatus(user);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status,
    idleMinutes: getIdleMinutesFromLastActive(user, status),
    workingMinutes: Math.round(workingMs / 60000),
    sessionStatus: activeSession?.status ?? 'stopped',
    sessionStart: activeSession?.startTime
    || undefined,
    reason: reason ?? undefined
  };
};

export const listEmployeeStatuses = async (req, res) => {
  const employees = await User.find({ role: 'employee' }).lean();
  const userIds = employees.map((user) => user._id);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sessions = await WorkSession.find({
    user: { $in: userIds },
    startTime: { $gte: todayStart }
  });
  const leaveRequests = await LeaveRequest.find({
    userId: { $in: userIds },
    status: 'approved',
    durationType: 'full_day',
    startAt: { $lte: todayStart },
    endAt: { $gte: todayStart }
  }).select('userId');
  const onLeaveSet = new Set(leaveRequests.map((request) => request.userId.toString()));
  const timesheets = await TimeSheetDay.find({
    user: { $in: userIds },
    date: todayStart,
    clockInAt: { $ne: null }
  }).select('user');
  const workedSet = new Set(timesheets.map((record) => record.user.toString()));

  const liveSessions = await listLiveSessions();
  const liveSessionMap = new Map(liveSessions.map((session) => [session.user.toString(), session]));
  const workingMap = new Map();
  sessions.forEach((session) => {
    const userId = session.user.toString();
    const startMs = session.startTime ? new Date(session.startTime).getTime() : Date.now();
    const endMs = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    const activeMs = Math.max(0, endMs - startMs - (session.idleTime || 0));
    workingMap.set(userId, (workingMap.get(userId) || 0) + activeMs);
    workedSet.add(userId);
  });

  const statuses = employees.map((user) => {
    const workingMs = workingMap.get(user._id.toString()) || 0;
    return buildStatusRecord(user, workingMs, liveSessionMap.get(user._id.toString()) || null);
  });

  const summary = statuses.reduce(
    (acc, status) => {
      acc[status.status] = (acc[status.status] || 0) + 1;
      return acc;
    },
    { active: 0, idle: 0, offline: 0 }
  );
  const absentCount = employees.filter((user) => {
    const id = user._id.toString();
    return !onLeaveSet.has(id) && !workedSet.has(id);
  }).length;

  res.json({
    updatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      onLeave: onLeaveSet.size,
      absent: absentCount
    },
    users: statuses
  });
};

export const getMyStatus = async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sessions = await WorkSession.find({
    user: user._id,
    startTime: { $gte: todayStart }
  });
  const workingMs = calculateWorkingMs(sessions);
  const activeSession = await getActiveSession(user._id);
  const latestAlert = await ActivityAlert.findOne({ user: user._id })
    .sort({ createdAt: -1 })
    .select('message')
    .lean();
  const record = buildStatusRecord(user, workingMs, activeSession, latestAlert?.message);
  res.json(record);
};
