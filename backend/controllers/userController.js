import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Attendance from '../models/Attendance.js';
import Task from '../models/Task.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';
import { recordAuditLog } from '../utils/auditLogger.js';

export const listEmployees = async (req, res) => {
  const filter = req.query.role
    ? { role: req.query.role }
    : { role: { $ne: 'admin' } };
  const users = await User.find(filter)
    .select('name email role department status lastActiveAt employmentType')
    .sort({ name: 1 });
  res.json(users);
};

export const listRoster = async (req, res) => {
  const filter = req.query.role
    ? { role: req.query.role, isDeactivated: false }
    : { role: { $ne: 'admin' }, isDeactivated: false };
  const users = await User.find(filter)
    .select('name email role department status isOnline activityStatus')
    .sort({ name: 1 });
  res.json(users);
};

export const createEmployee = async (req, res) => {
  const { name, email, password, role = 'employee', department, manager } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Missing required fields' });

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const roleDoc = await Role.findOne({ name: role }) || (await Role.findOne({ name: 'employee' }));
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: roleDoc?.name || role,
    roleRef: roleDoc?._id,
    permissions: roleDoc?.permissions,
    department,
    manager
  });

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'user:create',
    entityType: 'user',
    entityId: user._id,
    description: `${user.name} added as ${user.role}`,
    metadata: { department },
    ipAddress: req.ip
  });

  res.status(201).json(user.toSafeObject());
};

export const updateEmployee = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const { role, department, manager, employmentType, workHoursPerWeek, title } = req.body;
  if (role) {
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) return res.status(400).json({ message: 'Invalid role' });
    user.role = roleDoc.name;
    user.roleRef = roleDoc._id;
    user.permissions = roleDoc.permissions;
  }
  if (department !== undefined) user.department = department;
  if (manager !== undefined) user.manager = manager;
  if (employmentType) user.employmentType = employmentType;
  if (workHoursPerWeek) user.workHoursPerWeek = workHoursPerWeek;
  if (title) user.title = title;

  await user.save();
  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'user:update',
    entityType: 'user',
    entityId: user._id,
    description: `User ${user.name} updated`,
    metadata: req.body,
    ipAddress: req.ip
  });
  res.json(user.toSafeObject());
};

export const setEmployeeStatus = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const deactivated = Boolean(req.body.isDeactivated);
  user.isDeactivated = deactivated;
  user.isActive = !deactivated;
  user.deactivatedAt = deactivated ? new Date() : null;
  if (deactivated) {
    user.status = 'inactive';
  } else if (req.body.status) {
    user.status = req.body.status;
  } else {
    user.status = 'active';
  }
  await user.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'user:status',
    entityType: 'user',
    entityId: user._id,
    description: `User ${user.name} status updated`,
    metadata: { status: user.status, isDeactivated: user.isDeactivated },
    ipAddress: req.ip
  });

  res.json(user.toSafeObject());
};

export const getEmployeeProfile = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  const user = await User.findById(req.params.id)
    .populate('manager', 'name email')
    .select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  const [attendance, tasks] = await Promise.all([
    Attendance.find({ user: user._id }).sort({ date: -1 }).limit(10),
    Task.find({ assignedTo: user._id }).sort({ updatedAt: -1 }).limit(10)
  ]);

  res.json({
    user: user.toSafeObject(),
    attendance,
    tasks
  });
};
