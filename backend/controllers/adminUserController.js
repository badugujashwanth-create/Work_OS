import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { revokeAllUserTokens } from '../utils/tokenService.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

const ALLOWED_ROLES = ['admin', 'manager', 'employee', 'hr', 'auditor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => value.trim().toLowerCase();

const generateTempPassword = () => {
  const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, 12) || crypto.randomBytes(8).toString('hex');
};

const sanitizeRole = (value) => String(value || '').trim().toLowerCase();

const attachRole = async (user, roleName) => {
  const roleDoc = await Role.findOne({ name: roleName });
  if (!roleDoc) return null;
  user.role = roleDoc.name;
  user.roleRef = roleDoc._id;
  user.permissions = roleDoc.permissions || [];
  return user;
};

const formatStatus = (user) => (user.isActive === false || user.isDeactivated ? 'inactive' : 'active');

export const listAdminUsers = async (req, res) => {
  const users = await User.find({})
    .select('name email role status isActive isDeactivated lastActiveAt createdAt deactivatedAt')
    .sort({ createdAt: -1 });
  res.json(
    users.map((user) => ({
      ...user.toObject(),
      status: formatStatus(user)
    }))
  );
};

export const createAdminUser = async (req, res) => {
  const { name, email, role, tempPassword } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Invalid email address' });
  }

  const requestedRole = sanitizeRole(role || 'employee');
  if (!ALLOWED_ROLES.includes(requestedRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const existing = await User.findOne({ email: normalizeEmail(email) });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const providedPassword = typeof tempPassword === 'string' ? tempPassword.trim() : '';
  if (providedPassword && providedPassword.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ message: `Temp password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const finalTempPassword = providedPassword || generateTempPassword();
  const hashed = await bcrypt.hash(finalTempPassword, 10);

  const user = new User({
    name: String(name).trim(),
    email: normalizeEmail(email),
    password: hashed,
    isActive: true,
    isDeactivated: false,
    deactivatedAt: null,
    status: 'active',
    mustResetPassword: true,
    tempPasswordIssuedAt: new Date()
  });

  const roleDoc = await attachRole(user, requestedRole);
  if (!roleDoc) return res.status(400).json({ message: 'Invalid role' });
  await user.save();

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'user:create',
    entityType: 'user',
    entityId: user._id,
    description: `Created user ${user.email}`,
    metadata: { role: user.role },
    ipAddress: req.ip
  });

  res.status(201).json({
    user: user.toSafeObject(),
    tempPassword: finalTempPassword
  });
};

export const updateAdminUser = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const { name, email, role, resetPassword, isActive } = req.body || {};
  const wasInactive = user.isActive === false || user.isDeactivated;
  const updates = {};
  if (typeof name === 'string' && name.trim()) user.name = name.trim();

  if (typeof email === 'string' && email.trim()) {
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    const normalized = normalizeEmail(email);
    const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    user.email = normalized;
  }

  if (typeof role === 'string') {
    const requestedRole = sanitizeRole(role);
    if (!ALLOWED_ROLES.includes(requestedRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const roleDoc = await attachRole(user, requestedRole);
    if (!roleDoc) return res.status(400).json({ message: 'Invalid role' });
  }

  if (typeof isActive === 'boolean' && isActive) {
    user.isActive = true;
    user.isDeactivated = false;
    user.deactivatedAt = null;
    user.status = 'active';
  }

  let tempPassword;
  if (resetPassword === true) {
    tempPassword = generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    user.mustResetPassword = true;
    user.tempPasswordIssuedAt = new Date();
    await revokeAllUserTokens(user._id);
  }

  await user.save();

  if (typeof name === 'string') updates.name = name.trim();
  if (typeof email === 'string') updates.email = normalizeEmail(email);
  if (typeof role === 'string') updates.role = sanitizeRole(role);

  if (Object.keys(updates).length > 0) {
    await recordAuditLog({
      user: req.user._id,
      role: req.user.role,
      action: 'user:update',
      entityType: 'user',
      entityId: user._id,
      description: `Updated user ${user.email}`,
      metadata: updates,
      ipAddress: req.ip
    });
  }

  if (resetPassword === true) {
    await recordAuditLog({
      user: req.user._id,
      role: req.user.role,
      action: 'user:reset_password',
      entityType: 'user',
      entityId: user._id,
      description: `Reset password for ${user.email}`,
      ipAddress: req.ip
    });
  }

  if (typeof isActive === 'boolean' && isActive && wasInactive) {
    await recordAuditLog({
      user: req.user._id,
      role: req.user.role,
      action: 'user:activate',
      entityType: 'user',
      entityId: user._id,
      description: `Activated user ${user.email}`,
      ipAddress: req.ip
    });
  }

  res.json({
    user: user.toSafeObject(),
    tempPassword
  });
};

export const deactivateAdminUser = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'user id')) return;
  if (req.user._id.toString() === req.params.id) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.isActive = false;
  user.isDeactivated = true;
  user.deactivatedAt = new Date();
  user.status = 'inactive';
  await user.save();
  await revokeAllUserTokens(user._id);

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'user:deactivate',
    entityType: 'user',
    entityId: user._id,
    description: `Deactivated user ${user.email}`,
    ipAddress: req.ip
  });

  res.json({ success: true });
};
