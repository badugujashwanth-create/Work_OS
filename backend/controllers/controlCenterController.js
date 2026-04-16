import dayjs from 'dayjs';
import AppUsageTick from '../models/AppUsageTick.js';
import LeaveRequest from '../models/LeaveRequest.js';
import TeamMember from '../models/TeamMember.js';
import Team from '../models/Team.js';
import TimeSheetDay from '../models/TimeSheetDay.js';
import User from '../models/User.js';
import WorkSession from '../models/WorkSession.js';
import { getPresenceStatus } from '../services/presenceService.js';
import { evaluateRiskAlerts } from '../services/riskAlertService.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const IDLE_THRESHOLD_SECONDS = 120;
const TICK_MINUTES = 0.25;

const startOfDay = (value) => dayjs(value).startOf('day').toDate();

const computeWorkedMinutes = (record, now) => {
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

const mapModuleName = (url = '', title = '') => {
  const value = `${url} ${title}`.toLowerCase();
  if (value.includes('/tasks') || value.includes('task')) return 'Tasks';
  if (value.includes('/chat') || value.includes('chat')) return 'Chat';
  if (value.includes('/calls') || value.includes('call')) return 'Calls';
  if (value.includes('/mail') || value.includes('inbox')) return 'Mail';
  if (value.includes('/documents') || value.includes('/docs')) return 'Documents';
  if (value.includes('/browser')) return 'Work Browser';
  if (value.includes('/timesheet')) return 'Timesheet';
  if (value.includes('/leave')) return 'Leave';
  if (value.includes('/announcements')) return 'Announcements';
  if (value.includes('/logs')) return 'Logs';
  if (value.includes('/dashboard')) return 'Dashboard';
  return 'Other';
};

const buildPlatformMap = (rows) => {
  const appMap = new Map();
  rows.forEach((row) => {
    const userId = row._id.user.toString();
    const list = appMap.get(userId) || [];
    const totalMinutes = row.ticks * TICK_MINUTES;
    const idleMinutes = row.idleTicks * TICK_MINUTES;
    list.push({
      app: row._id.app,
      minutes: totalMinutes,
      idleMinutes,
      activeMinutes: Math.max(0, totalMinutes - idleMinutes)
    });
    appMap.set(userId, list);
  });
  return appMap;
};

const buildModuleMap = (sessions) => {
  const moduleMap = new Map();
  sessions.forEach((session) => {
    const userId = session.user.toString();
    const list = moduleMap.get(userId) || [];
    const counter = new Map(list.map((entry) => [entry.module, entry.minutes]));
    session.activePages.forEach((page) => {
      const moduleName = mapModuleName(page.url, page.title);
      const minutes = Number(page.duration || 0);
      counter.set(moduleName, (counter.get(moduleName) || 0) + minutes);
    });
    const nextList = Array.from(counter.entries()).map(([module, minutes]) => ({ module, minutes }));
    moduleMap.set(userId, nextList);
  });
  return moduleMap;
};

const getManagerScope = async (managerId) => {
  const scope = new Set();
  const directReports = await User.find({ manager: managerId }).select('_id');
  directReports.forEach((user) => scope.add(user._id.toString()));

  const managedTeams = await TeamMember.find({
    userId: managerId,
    role: { $in: ['owner', 'manager'] }
  }).select('teamId');
  if (!managedTeams.length) return scope;

  const teamIds = managedTeams.map((team) => team.teamId);
  const members = await TeamMember.find({ teamId: { $in: teamIds } }).select('userId');
  members.forEach((member) => scope.add(member.userId.toString()));
  return scope;
};

export const getControlCenter = async (req, res) => {
  const employees = await User.find({ role: 'employee', isActive: { $ne: false } }).lean();
  const userIds = employees.map((user) => user._id);
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = dayjs(todayStart).add(1, 'day').toDate();

  const timesheets = await TimeSheetDay.find({
    user: { $in: userIds },
    date: todayStart
  }).lean();
  const timesheetMap = new Map(timesheets.map((record) => [record.user.toString(), record]));

  const leaveRequests = await LeaveRequest.find({
    userId: { $in: userIds },
    status: 'approved',
    startAt: { $lte: todayStart },
    endAt: { $gte: todayStart }
  })
    .populate('leaveTypeId', 'name')
    .lean();
  const leaveMap = new Map();
  leaveRequests.forEach((request) => {
    leaveMap.set(request.userId.toString(), request);
  });

  const usageRows = await AppUsageTick.aggregate([
    { $match: { user: { $in: userIds }, ts: { $gte: todayStart, $lt: tomorrowStart } } },
    {
      $project: {
        user: 1,
        app: { $ifNull: ['$activeApp', 'Unknown'] },
        idleSeconds: 1
      }
    },
    {
      $group: {
        _id: { user: '$user', app: '$app' },
        ticks: { $sum: 1 },
        idleTicks: {
          $sum: { $cond: [{ $gte: ['$idleSeconds', IDLE_THRESHOLD_SECONDS] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.user': 1, ticks: -1 } }
  ]);
  const platformMap = buildPlatformMap(usageRows);

  const sessions = await WorkSession.find({
    user: { $in: userIds },
    startTime: { $gte: todayStart, $lt: tomorrowStart }
  })
    .select('user activePages')
    .lean();
  const moduleMap = buildModuleMap(sessions);

  const teamMembers = await TeamMember.find({ userId: { $in: userIds } })
    .populate('teamId', 'name')
    .lean();
  const teamMap = new Map();
  teamMembers.forEach((member) => {
    const list = teamMap.get(member.userId.toString()) || [];
    if (member.teamId) {
      list.push({ _id: member.teamId._id, name: member.teamId.name });
    }
    teamMap.set(member.userId.toString(), list);
  });

  const { riskByUser, alertsByUser } = await evaluateRiskAlerts(userIds, now);

  const employeesPayload = employees.map((user) => {
    const record = timesheetMap.get(user._id.toString());
    const { workedMinutes, breakMinutes } = computeWorkedMinutes(record, now);
    const platforms = (platformMap.get(user._id.toString()) || []).sort((a, b) => b.minutes - a.minutes).slice(0, 3);
    const modules = (moduleMap.get(user._id.toString()) || []).sort((a, b) => b.minutes - a.minutes).slice(0, 3);
    const leave = leaveMap.get(user._id.toString());
    const risk = riskByUser.get(user._id.toString()) || 'green';
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        lastActiveAt: user.lastActiveAt
      },
      status: getPresenceStatus(user),
      workedMinutes,
      breakMinutes,
      leaveStatus: leave ? 'on_leave' : 'not_on_leave',
      leaveType: leave?.leaveTypeId?.name,
      platformTop: platforms,
      moduleTop: modules,
      risk,
      riskAlerts: alertsByUser.get(user._id.toString()) || [],
      lastActivityAt: user.lastActiveAt,
      teams: teamMap.get(user._id.toString()) || []
    };
  });

  const teams = await Team.find({ isArchived: { $ne: true } }).select('name').lean();
  res.json({
    date: todayStart.toISOString(),
    teams: teams.map((team) => ({ _id: team._id, name: team.name })),
    employees: employeesPayload
  });
};

export const getControlCenterEmployee = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (req.user.role === 'manager') {
    const scope = await getManagerScope(req.user._id);
    if (!scope.has(user._id.toString())) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const now = new Date();
  const rangeStart = dayjs(now).subtract(6, 'day').startOf('day').toDate();
  const rangeEnd = dayjs(now).add(1, 'day').startOf('day').toDate();

  const timesheets = await TimeSheetDay.find({
    user: user._id,
    date: { $gte: rangeStart, $lt: rangeEnd }
  })
    .sort({ date: 1 })
    .lean();

  const timesheetTrend = timesheets.map((record) => {
    const { workedMinutes, breakMinutes } = computeWorkedMinutes(record, now);
    return {
      date: record.date,
      workedMinutes,
      breakMinutes,
      payableMinutes: record.payableMinutes ?? workedMinutes,
      approvalStatus: record.approvalStatus || 'pending',
      approvalNote: record.approvalNote
    };
  });

  const usageRows = await AppUsageTick.aggregate([
    { $match: { user: user._id, ts: { $gte: rangeStart, $lt: rangeEnd } } },
    {
      $project: {
        app: { $ifNull: ['$activeApp', 'Unknown'] },
        idleSeconds: 1
      }
    },
    {
      $group: {
        _id: '$app',
        ticks: { $sum: 1 },
        idleTicks: {
          $sum: { $cond: [{ $gte: ['$idleSeconds', IDLE_THRESHOLD_SECONDS] }, 1, 0] }
        }
      }
    },
    { $sort: { ticks: -1 } }
  ]);
  const platformBreakdown = usageRows.map((row) => {
    const totalMinutes = row.ticks * TICK_MINUTES;
    const idleMinutes = row.idleTicks * TICK_MINUTES;
    return {
      app: row._id,
      minutes: totalMinutes,
      idleMinutes,
      activeMinutes: Math.max(0, totalMinutes - idleMinutes)
    };
  });

  const sessions = await WorkSession.find({
    user: user._id,
    startTime: { $gte: rangeStart, $lt: rangeEnd }
  })
    .select('activePages')
    .lean();
  const moduleMap = buildModuleMap(
    sessions.map((session) => ({ ...session, user: user._id }))
  );
  const moduleBreakdown = (moduleMap.get(user._id.toString()) || []).sort((a, b) => b.minutes - a.minutes);

  const leaveHistory = await LeaveRequest.find({ userId: user._id })
    .populate('leaveTypeId', 'name')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      lastActiveAt: user.lastActiveAt
    },
    timesheetTrend,
    platformBreakdown,
    moduleBreakdown,
    leaveHistory,
    timesheetApprovals: timesheetTrend
  });
};
