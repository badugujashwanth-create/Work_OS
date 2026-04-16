import dayjs from 'dayjs';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { isValidObjectId, respondIfInvalidObjectId } from '../utils/objectId.js';

const HOURS_PER_DAY = 8;
const DURATION_TYPES = new Set(['full_day', 'half_day', 'hours']);
const DECISION_STATUSES = new Set(['approved', 'rejected']);

const parseDate = (value) => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.startOf('day').toDate();
};

const computeRequestedDays = ({ startAt, endAt, durationType, hoursRequested }) => {
  const start = dayjs(startAt).startOf('day');
  const end = dayjs(endAt).startOf('day');
  const daySpan = end.diff(start, 'day') + 1;
  if (daySpan <= 0) return null;

  if (durationType === 'hours') {
    const hours = Number(hoursRequested);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return hours / HOURS_PER_DAY;
  }

  const multiplier = durationType === 'half_day' ? 0.5 : 1;
  return daySpan * multiplier;
};

const ensureLeaveBalance = async (userId, leaveType, year) => {
  const existing = await LeaveBalance.findOne({ userId, leaveTypeId: leaveType._id, year });
  if (existing) return existing;
  const totalDays = Number(leaveType.defaultAnnualDays || 0);
  return LeaveBalance.create({
    userId,
    leaveTypeId: leaveType._id,
    year,
    totalDays,
    usedDays: 0,
    remainingDays: totalDays
  });
};

const getManagerScopeUserIds = async (managerId, teamId) => {
  const scope = new Set();
  const directReports = await User.find({ manager: managerId }).select('_id').lean();
  directReports.forEach((user) => scope.add(user._id.toString()));

  const managerTeams = await TeamMember.find({
    userId: managerId,
    role: { $in: ['owner', 'manager'] }
  })
    .select('teamId')
    .lean();
  const teamIds = managerTeams.map((team) => team.teamId.toString());

  if (teamId) {
    if (!teamIds.includes(teamId)) return null;
    const members = await TeamMember.find({ teamId }).select('userId').lean();
    members.forEach((member) => scope.add(member.userId.toString()));
    return Array.from(scope);
  }

  if (teamIds.length) {
    const members = await TeamMember.find({ teamId: { $in: teamIds } })
      .select('userId')
      .lean();
    members.forEach((member) => scope.add(member.userId.toString()));
  }

  return Array.from(scope);
};

const finalizeStatus = ({ status, managerDecision, adminDecision, managerRequired }) => {
  if (status === 'cancelled') return status;
  if (managerDecision === 'rejected' || adminDecision === 'rejected') return 'rejected';
  if (adminDecision === 'approved' && (!managerRequired || managerDecision === 'approved'))
    return 'approved';
  return 'pending';
};

export const listLeaveTypes = async (_req, res) => {
  const types = await LeaveType.find({ isActive: true }).sort({ name: 1 });
  res.json(types);
};

export const listMyLeaveBalances = async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000) {
    return res.status(400).json({ message: 'Invalid year' });
  }

  const types = await LeaveType.find({ isActive: true }).sort({ name: 1 });
  await Promise.all(types.map((type) => ensureLeaveBalance(req.user._id, type, year)));

  const balances = await LeaveBalance.find({
    userId: req.user._id,
    year,
    leaveTypeId: { $in: types.map((type) => type._id) }
  }).populate('leaveTypeId', 'name paid isActive defaultAnnualDays');

  res.json(balances);
};

export const listMyLeaveRequests = async (req, res) => {
  const requests = await LeaveRequest.find({ userId: req.user._id })
    .populate('leaveTypeId', 'name paid')
    .populate('managerId', 'name email role')
    .populate('adminId', 'name email role')
    .sort({ createdAt: -1 });
  res.json(requests);
};

export const createLeaveRequest = async (req, res) => {
  const {
    leaveTypeId,
    startAt,
    endAt,
    durationType = 'full_day',
    hoursRequested,
    reason,
    attachmentUrl
  } = req.body || {};

  if (!leaveTypeId) return res.status(400).json({ message: 'Leave type is required' });
  if (respondIfInvalidObjectId(res, leaveTypeId, 'leave type')) return;

  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType || !leaveType.isActive) {
    return res.status(400).json({ message: 'Leave type unavailable' });
  }

  if (!DURATION_TYPES.has(durationType)) {
    return res.status(400).json({ message: 'Invalid duration type' });
  }

  const startDate = parseDate(startAt);
  const endDate = parseDate(endAt || startAt);
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Invalid start or end date' });
  }
  if (dayjs(endDate).isBefore(dayjs(startDate))) {
    return res.status(400).json({ message: 'End date must be on or after start date' });
  }
  if (dayjs(startDate).year() !== dayjs(endDate).year()) {
    return res.status(400).json({ message: 'Leave request must stay within one calendar year' });
  }
  if (
    durationType === 'hours'
    && dayjs(startDate).format('YYYY-MM-DD') !== dayjs(endDate).format('YYYY-MM-DD')
  ) {
    return res.status(400).json({ message: 'Hourly leave must be within a single day' });
  }

  const requestedDays = computeRequestedDays({
    startAt: startDate,
    endAt: endDate,
    durationType,
    hoursRequested
  });
  if (!requestedDays) {
    return res.status(400).json({ message: 'Invalid leave duration' });
  }

  const year = dayjs(startDate).year();
  if (leaveType.paid) {
    const balance = await ensureLeaveBalance(req.user._id, leaveType, year);
    if (balance.remainingDays < requestedDays) {
      return res.status(400).json({ message: 'Insufficient leave balance' });
    }
  }

  const hasManager = Boolean(req.user.manager);
  const request = await LeaveRequest.create({
    userId: req.user._id,
    leaveTypeId: leaveType._id,
    startAt: startDate,
    endAt: endDate,
    durationType,
    hoursRequested: durationType === 'hours' ? Number(hoursRequested) : undefined,
    reason: typeof reason === 'string' ? reason.trim() : undefined,
    attachmentUrl: typeof attachmentUrl === 'string' ? attachmentUrl.trim() : undefined,
    status: 'pending',
    managerDecision: hasManager ? 'pending' : 'approved',
    adminDecision: 'pending',
    managerId: hasManager ? req.user.manager : null
  });

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave:request',
    entityType: 'leave_request',
    entityId: request._id,
    description: `Leave request created for ${req.user.email}`,
    metadata: { leaveTypeId: leaveType._id, durationType },
    ipAddress: req.ip
  });

  res.status(201).json(request);
};

export const cancelLeaveRequest = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'leave request')) return;
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Leave request not found' });
  if (request.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (['cancelled', 'rejected'].includes(request.status)) {
    return res.status(400).json({ message: 'Leave request is already finalized' });
  }

  const wasApproved = request.status === 'approved';
  request.status = 'cancelled';
  await request.save();

  if (wasApproved) {
    const leaveType = await LeaveType.findById(request.leaveTypeId);
    if (leaveType?.paid) {
      const year = dayjs(request.startAt).year();
      const balance = await ensureLeaveBalance(req.user._id, leaveType, year);
      const requestedDays = computeRequestedDays({
        startAt: request.startAt,
        endAt: request.endAt,
        durationType: request.durationType,
        hoursRequested: request.hoursRequested
      });
      if (requestedDays) {
        balance.usedDays = Math.max(0, (balance.usedDays || 0) - requestedDays);
        balance.remainingDays = Math.max(0, balance.totalDays - balance.usedDays);
        await balance.save();
      }
    }
  }

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave:cancel',
    entityType: 'leave_request',
    entityId: request._id,
    description: `Leave request cancelled by ${req.user.email}`,
    ipAddress: req.ip
  });

  res.json(request);
};

export const listLeaveRequests = async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;

  const filter = {};
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    filter.status = status;
  }

  if (teamId && !isValidObjectId(teamId)) {
    return res.status(400).json({ message: 'Invalid team id' });
  }

  if (req.user.role === 'manager') {
    const scopeUserIds = await getManagerScopeUserIds(req.user._id, teamId || undefined);
    if (scopeUserIds === null) return res.status(403).json({ message: 'Forbidden' });
    filter.userId = { $in: scopeUserIds };
  } else if (req.user.role === 'admin') {
    if (teamId) {
      const members = await TeamMember.find({ teamId }).select('userId').lean();
      filter.userId = { $in: members.map((member) => member.userId) };
    }
  }

  const requests = await LeaveRequest.find(filter)
    .populate('leaveTypeId', 'name paid')
    .populate('userId', 'name email role manager')
    .populate('managerId', 'name email role')
    .populate('adminId', 'name email role')
    .sort({ startAt: -1 });

  res.json(requests);
};

const updateLeaveDecision = async (req, res, decision, actor) => {
  if (!DECISION_STATUSES.has(decision)) {
    return res.status(400).json({ message: 'Invalid decision' });
  }
  if (respondIfInvalidObjectId(res, req.params.id, 'leave request')) return;
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Leave request not found' });
  if (['approved', 'rejected', 'cancelled'].includes(request.status)) {
    return res.status(400).json({ message: 'Leave request already finalized' });
  }

  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

  if (actor === 'manager') {
    if (!request.managerId || request.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (request.managerDecision !== 'pending') {
      return res.status(400).json({ message: 'Manager decision already recorded' });
    }
    request.managerDecision = decision;
    request.managerComment = comment || request.managerComment;
    request.managerId = req.user._id;
  }

  if (actor === 'admin') {
    if (request.adminDecision !== 'pending') {
      return res.status(400).json({ message: 'Admin decision already recorded' });
    }
    request.adminDecision = decision;
    request.adminComment = comment || request.adminComment;
    request.adminId = req.user._id;
  }

  const managerRequired = Boolean(request.managerId);
  const nextStatus = finalizeStatus({
    status: request.status,
    managerDecision: request.managerDecision,
    adminDecision: request.adminDecision,
    managerRequired
  });

  if (nextStatus === 'approved' && request.status !== 'approved') {
    const leaveType = await LeaveType.findById(request.leaveTypeId);
    if (!leaveType) {
      return res.status(400).json({ message: 'Leave type unavailable' });
    }
    if (leaveType.paid) {
      const year = dayjs(request.startAt).year();
      const balance = await ensureLeaveBalance(request.userId, leaveType, year);
      const requestedDays = computeRequestedDays({
        startAt: request.startAt,
        endAt: request.endAt,
        durationType: request.durationType,
        hoursRequested: request.hoursRequested
      });
      if (!requestedDays) {
        return res.status(400).json({ message: 'Invalid leave duration' });
      }
      if (balance.remainingDays < requestedDays) {
        return res.status(400).json({ message: 'Insufficient leave balance' });
      }
      balance.usedDays = (balance.usedDays || 0) + requestedDays;
      balance.remainingDays = Math.max(0, balance.totalDays - balance.usedDays);
      await balance.save();
    }
  }

  request.status = nextStatus;
  await request.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: `leave:${actor}_${decision}`,
    entityType: 'leave_request',
    entityId: request._id,
    description: `Leave request ${decision} by ${req.user.email}`,
    metadata: { status: request.status },
    ipAddress: req.ip
  });

  res.json(request);
};

export const managerApprove = async (req, res) =>
  updateLeaveDecision(req, res, 'approved', 'manager');

export const managerReject = async (req, res) =>
  updateLeaveDecision(req, res, 'rejected', 'manager');

export const adminApprove = async (req, res) =>
  updateLeaveDecision(req, res, 'approved', 'admin');

export const adminReject = async (req, res) =>
  updateLeaveDecision(req, res, 'rejected', 'admin');
