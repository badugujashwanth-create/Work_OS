import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import User from '../models/User.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeName = (value) => String(value || '').trim();

const parseDays = (value) => {
  const days = Number(value);
  if (!Number.isFinite(days) || days < 0) return null;
  return days;
};

export const listLeaveTypesAdmin = async (_req, res) => {
  const types = await LeaveType.find({}).sort({ name: 1 });
  res.json(types);
};

export const createLeaveType = async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const paid = typeof req.body?.paid === 'boolean' ? req.body.paid : true;
  const defaultAnnualDays = parseDays(req.body?.defaultAnnualDays ?? 0);
  if (defaultAnnualDays === null) {
    return res.status(400).json({ message: 'defaultAnnualDays must be a positive number' });
  }

  const existing = await LeaveType.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
  });
  if (existing) return res.status(400).json({ message: 'Leave type already exists' });

  const leaveType = await LeaveType.create({
    name,
    paid,
    defaultAnnualDays,
    isActive: true
  });

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave_type:create',
    entityType: 'leave_type',
    entityId: leaveType._id,
    description: `Created leave type ${leaveType.name}`,
    metadata: { paid: leaveType.paid, defaultAnnualDays: leaveType.defaultAnnualDays },
    ipAddress: req.ip
  });

  res.status(201).json(leaveType);
};

export const updateLeaveType = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'leave type')) return;
  const leaveType = await LeaveType.findById(req.params.id);
  if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });

  if (typeof req.body?.name === 'string') {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: 'Name cannot be empty' });
    const existing = await LeaveType.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
      _id: { $ne: leaveType._id }
    });
    if (existing) return res.status(400).json({ message: 'Leave type already exists' });
    leaveType.name = name;
  }

  if (typeof req.body?.paid === 'boolean') leaveType.paid = req.body.paid;
  if (typeof req.body?.isActive === 'boolean') leaveType.isActive = req.body.isActive;

  if (req.body?.defaultAnnualDays !== undefined) {
    const defaultAnnualDays = parseDays(req.body.defaultAnnualDays);
    if (defaultAnnualDays === null) {
      return res.status(400).json({ message: 'defaultAnnualDays must be a positive number' });
    }
    leaveType.defaultAnnualDays = defaultAnnualDays;
  }

  await leaveType.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave_type:update',
    entityType: 'leave_type',
    entityId: leaveType._id,
    description: `Updated leave type ${leaveType.name}`,
    ipAddress: req.ip
  });

  res.json(leaveType);
};

export const deactivateLeaveType = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'leave type')) return;
  const leaveType = await LeaveType.findById(req.params.id);
  if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });
  leaveType.isActive = false;
  await leaveType.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave_type:deactivate',
    entityType: 'leave_type',
    entityId: leaveType._id,
    description: `Deactivated leave type ${leaveType.name}`,
    ipAddress: req.ip
  });

  res.json({ success: true });
};

export const adjustLeaveBalance = async (req, res) => {
  const { userId, leaveTypeId } = req.body || {};
  if (!userId || !leaveTypeId) {
    return res.status(400).json({ message: 'userId and leaveTypeId are required' });
  }
  if (respondIfInvalidObjectId(res, userId, 'user id')) return;
  if (respondIfInvalidObjectId(res, leaveTypeId, 'leave type')) return;

  const user = await User.findById(userId).select('_id');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });

  const year = Number(req.body?.year) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000) {
    return res.status(400).json({ message: 'Invalid year' });
  }

  const updates = {};
  if (req.body?.totalDays !== undefined) {
    const totalDays = parseDays(req.body.totalDays);
    if (totalDays === null) return res.status(400).json({ message: 'Invalid totalDays' });
    updates.totalDays = totalDays;
  }
  if (req.body?.usedDays !== undefined) {
    const usedDays = parseDays(req.body.usedDays);
    if (usedDays === null) return res.status(400).json({ message: 'Invalid usedDays' });
    updates.usedDays = usedDays;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'Provide totalDays or usedDays to adjust' });
  }

  const balance =
    (await LeaveBalance.findOne({ userId, leaveTypeId, year })) ||
    new LeaveBalance({
      userId,
      leaveTypeId,
      year,
      totalDays: Number(leaveType.defaultAnnualDays || 0),
      usedDays: 0,
      remainingDays: Number(leaveType.defaultAnnualDays || 0)
    });

  if (updates.totalDays !== undefined) balance.totalDays = updates.totalDays;
  if (updates.usedDays !== undefined) balance.usedDays = updates.usedDays;

  if (balance.usedDays > balance.totalDays) {
    return res.status(400).json({ message: 'usedDays cannot exceed totalDays' });
  }

  balance.remainingDays = Math.max(0, balance.totalDays - balance.usedDays);
  await balance.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'leave_balance:adjust',
    entityType: 'leave_balance',
    entityId: balance._id,
    description: `Adjusted leave balance for ${leaveType.name}`,
    metadata: { userId, leaveTypeId, year, ...updates },
    ipAddress: req.ip
  });

  res.json(balance);
};
