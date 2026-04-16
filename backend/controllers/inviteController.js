import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Invite from '../models/Invite.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const ALLOWED_ROLES = ['admin', 'manager', 'employee', 'hr', 'auditor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MIN_PASSWORD_LENGTH = 8;
const INVITE_TTL_DAYS = 7;
const DEFAULT_INVITE_BASE_URL = 'http://localhost:3000';

const normalizeEmail = (value) => value.trim().toLowerCase();
const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const getInviteBaseUrl = (req) => {
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const clientUrl = (process.env.CLIENT_URL || '').split(',')[0]?.trim();
  if (clientUrl) return clientUrl.replace(/\/$/, '');
  return DEFAULT_INVITE_BASE_URL;
};

const formatUser = (user) => {
  if (!user) return undefined;
  if (typeof user === 'string') return user;
  if (user._id) return { _id: user._id, name: user.name, email: user.email };
  return user;
};

const formatInvite = (invite) => {
  const now = Date.now();
  const expiresAt = invite.expiresAt?.getTime?.() ?? new Date(invite.expiresAt).getTime();
  const status = invite.usedAt
    ? 'used'
    : Number.isFinite(expiresAt) && expiresAt <= now
      ? 'expired'
      : 'active';
  return {
    _id: invite._id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    usedAt: invite.usedAt,
    createdBy: formatUser(invite.createdBy),
    usedBy: formatUser(invite.usedBy),
    status
  };
};

const generateToken = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const existing = await Invite.findOne({ tokenHash }).select('_id');
    if (!existing) return { token, tokenHash };
  }
  return null;
};

export const createInvite = async (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  const requestedRole = normalizeRole(role || 'employee');
  if (!ALLOWED_ROLES.includes(requestedRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const activeInvite = await Invite.findOne({
    email: normalizedEmail,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).select('_id');
  if (activeInvite) {
    return res.status(400).json({ message: 'An active invite already exists for this email' });
  }

  const tokenResult = await generateToken();
  if (!tokenResult) {
    return res.status(500).json({ message: 'Failed to generate invite token' });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invite = await Invite.create({
    email: normalizedEmail,
    role: requestedRole,
    tokenHash: tokenResult.tokenHash,
    expiresAt,
    createdBy: req.user._id
  });

  await recordAuditLog({
    user: req.user._id,
    role: req.user.role,
    action: 'invite:create',
    entityType: 'invite',
    entityId: invite._id,
    description: `Created invite for ${invite.email}`,
    metadata: { email: invite.email, role: invite.role, expiresAt },
    ipAddress: req.ip
  });

  const inviteLink = `${getInviteBaseUrl(req)}/invite?token=${tokenResult.token}`;
  res.status(201).json({ invite: formatInvite(invite), inviteLink });
};

export const listInvites = async (_req, res) => {
  const invites = await Invite.find()
    .populate('createdBy', 'name email')
    .populate('usedBy', 'name email')
    .sort({ createdAt: -1 });

  res.json(invites.map((invite) => formatInvite(invite)));
};

export const acceptInvite = async (req, res) => {
  const { token, name, password } = req.body || {};
  if (!token || !name || !password) {
    return res.status(400).json({ message: 'Token, name, and password are required' });
  }

  const cleanedName = String(name || '').trim();
  if (!cleanedName) {
    return res.status(400).json({ message: 'Name is required' });
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const tokenHash = hashToken(String(token));
  const invite = await Invite.findOne({ tokenHash });
  if (!invite) {
    return res.status(400).json({ message: 'Invalid or expired invite' });
  }
  if (invite.usedAt) {
    return res.status(400).json({ message: 'Invite already used' });
  }
  if (invite.expiresAt && invite.expiresAt <= new Date()) {
    return res.status(400).json({ message: 'Invite expired' });
  }

  const existingUser = await User.findOne({ email: invite.email }).select('_id');
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const roleDoc = await Role.findOne({ name: invite.role });
  if (!roleDoc) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const hashed = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    name: cleanedName,
    email: invite.email,
    password: hashed,
    role: roleDoc.name,
    roleRef: roleDoc._id,
    permissions: roleDoc.permissions || [],
    isActive: true,
    isDeactivated: false,
    status: 'active',
    mustResetPassword: false,
    deactivatedAt: null
  });

  invite.usedAt = new Date();
  invite.usedBy = user._id;
  await invite.save();

  await recordAuditLog({
    user: user._id,
    role: user.role,
    action: 'user:create',
    entityType: 'user',
    entityId: user._id,
    description: `${user.name} accepted an invite`,
    metadata: { email: user.email, source: 'invite' },
    ipAddress: req.ip
  });

  await recordAuditLog({
    user: user._id,
    role: user.role,
    action: 'invite:accept',
    entityType: 'invite',
    entityId: invite._id,
    description: `${user.name} accepted invite`,
    metadata: { email: invite.email },
    ipAddress: req.ip
  });

  res.status(201).json({ success: true, userId: user._id, email: user.email });
};
