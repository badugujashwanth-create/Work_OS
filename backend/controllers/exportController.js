import dayjs from 'dayjs';
import mongoose from 'mongoose';
import AppUsageTick from '../models/AppUsageTick.js';
import LeaveRequest from '../models/LeaveRequest.js';
import TeamMember from '../models/TeamMember.js';
import TimeSheetDay from '../models/TimeSheetDay.js';
import User from '../models/User.js';
import { getSettings } from '../services/settingsService.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const IDLE_THRESHOLD_SECONDS = 120;
const TICK_MINUTES = 0.25;

const parseRange = (query) => {
  const startInput = query.startDate || query.start || query.from;
  const endInput = query.endDate || query.end || query.to;
  if (!startInput || !endInput) return null;
  const start = dayjs(startInput);
  const end = dayjs(endInput);
  if (!start.isValid() || !end.isValid()) return null;
  if (end.isBefore(start)) return null;
  const startDate = start.startOf('day').toDate();
  const endDate = end.add(1, 'day').startOf('day').toDate();
  return { startDate, endDate };
};

const resolveUserScope = async (req) => {
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  if (teamId) {
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return { error: 'Invalid teamId' };
    }
    const members = await TeamMember.find({ teamId }).select('userId');
    return { userIds: members.map((member) => member.userId) };
  }

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: 'Invalid userId' };
    }
    return { userIds: [new mongoose.Types.ObjectId(userId)] };
  }

  return { userIds: null };
};

const computeWorkedMinutes = (record) => {
  if (!record?.clockInAt || !record?.clockOutAt) return 0;
  const start = new Date(record.clockInAt).getTime();
  const end = new Date(record.clockOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
};

export const exportTimesheets = async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const scope = await resolveUserScope(req);
  if (scope.error) return res.status(400).json({ message: scope.error });

  const filter = { date: { $gte: range.startDate, $lt: range.endDate } };
  if (scope.userIds) filter.user = { $in: scope.userIds };

  const records = await TimeSheetDay.find(filter)
    .populate('user', 'name email department role')
    .sort({ date: -1 });

  const rows = records.map((record) => ({
    date: record.date,
    user: record.user,
    clockInAt: record.clockInAt,
    clockOutAt: record.clockOutAt,
    workedMinutes: computeWorkedMinutes(record),
    breakMinutes: Number(record.breakMinutes || 0),
    payableMinutes: Number(record.payableMinutes || 0),
    activeMinutes: Number(record.activeMinutes || 0),
    idleMinutes: Number(record.idleMinutes || 0),
    approvalStatus: record.approvalStatus || 'pending'
  }));

  res.json({ range, rows });
};

export const exportLeave = async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const scope = await resolveUserScope(req);
  if (scope.error) return res.status(400).json({ message: scope.error });

  const filter = {
    startAt: { $lte: range.endDate },
    endAt: { $gte: range.startDate }
  };
  if (scope.userIds) filter.userId = { $in: scope.userIds };

  const requests = await LeaveRequest.find(filter)
    .populate('userId', 'name email department role')
    .populate('leaveTypeId', 'name paid')
    .sort({ startAt: -1 });

  res.json({ range, rows: requests });
};

export const exportUsage = async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ message: 'Invalid date range' });

  const scope = await resolveUserScope(req);
  if (scope.error) return res.status(400).json({ message: scope.error });

  const settings = await getSettings();
  const whitelist = Array.isArray(settings.appWhitelist) ? settings.appWhitelist : [];
  const whitelistSet = new Set(whitelist.map((entry) => String(entry || '').trim().toLowerCase()));

  const match = { ts: { $gte: range.startDate, $lt: range.endDate } };
  if (scope.userIds) match.user = { $in: scope.userIds };

  const rows = await AppUsageTick.aggregate([
    { $match: match },
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
          $sum: {
            $cond: [{ $gte: ['$idleSeconds', IDLE_THRESHOLD_SECONDS] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id.user': 1, ticks: -1 } }
  ]);

  const userIds = rows.map((row) => row._id.user);
  const users = await User.find({ _id: { $in: userIds } }).select('name email department role');
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const mapped = rows.map((row) => {
    const appName = row._id.app || 'Unknown';
    const isWhitelisted = whitelistSet.has(String(appName).toLowerCase());
    const totalMinutes = (row.ticks || 0) * TICK_MINUTES;
    const idleMinutes = (row.idleTicks || 0) * TICK_MINUTES;
    const activeMinutes = isWhitelisted ? Math.max(0, totalMinutes - idleMinutes) : 0;
    const nonWorkMinutes = Math.max(0, totalMinutes - idleMinutes - activeMinutes);
    return {
      user: userMap.get(row._id.user.toString()) || row._id.user,
      app: appName,
      minutes: totalMinutes,
      idleMinutes,
      activeMinutes,
      nonWorkMinutes,
      isWhitelisted
    };
  });

  res.json({ range, rows: mapped });
};
