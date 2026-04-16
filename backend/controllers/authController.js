import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import {
  issueSessionTokens,
  verifyRefreshToken,
  rotateRefreshToken,
  createAccessToken,
  revokeRefreshToken
} from '../utils/tokenService.js';
import { recordAuditLog } from '../utils/auditLogger.js';
import { startSession } from '../services/workSessionService.js';

const buildContext = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent')
});

const ALLOW_BOOTSTRAP_ADMIN = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true';
const ALLOW_PUBLIC_REGISTRATION = process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
const normalizeRole = (role) => (role || '').toString().trim().toLowerCase();

const respondWithSession = (res, user, tokens, status = 200) =>
  res.status(status).json({
    token: tokens.token,
    refreshToken: tokens.refreshToken,
    user: user.toSafeObject()
  });

const attachRoleMetadata = async (user) => {
  if (user.roleRef) return user;
  const roleDoc = await Role.findOne({ name: user.role });
  if (roleDoc) {
    user.roleRef = roleDoc._id;
    user.permissions = roleDoc.permissions;
    await user.save();
  }
  return user;
};

const completeLogin = async (req, res, user, auditMetadata = {}) => {
  user.lastLogin = new Date();
  user.status = 'active';
  user.lastActiveAt = new Date();
  await attachRoleMetadata(user);
  await user.save();
  await startSession(user._id, user._id);

  const tokens = await issueSessionTokens(user, buildContext(req));
  await recordAuditLog({
    user: user._id,
    role: user.role,
    action: 'auth:login',
    entityType: 'user',
    entityId: user._id,
    description: `${user.name} logged in`,
    metadata: auditMetadata,
    ipAddress: req.ip
  });

  respondWithSession(res, user, tokens);
};

export const register = async (req, res) => {
  if (!ALLOW_PUBLIC_REGISTRATION) {
    return res.status(403).json({ message: 'Registration disabled' });
  }
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Missing fields' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const requestedRole = normalizeRole(role);
  const isBootstrap = ALLOW_BOOTSTRAP_ADMIN && (await User.estimatedDocumentCount()) === 0;
  const allowedRoles = isBootstrap ? ['admin', 'manager', 'hr', 'employee'] : ['employee'];
  const finalRole = allowedRoles.includes(requestedRole) ? requestedRole : 'employee';
  const roleDoc = await Role.findOne({ name: finalRole });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: finalRole,
    roleRef: roleDoc?._id,
    permissions: roleDoc?.permissions || undefined
  });

  const tokens = await issueSessionTokens(user, buildContext(req));
  await recordAuditLog({
    user: user._id,
    role: user.role,
    action: 'auth:register',
    entityType: 'user',
    entityId: user._id,
    description: `${user.name} created an account`,
    metadata: { role: finalRole },
    ipAddress: req.ip
  });
  respondWithSession(res, user, tokens, 201);
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  if (user.isDeactivated || user.isActive === false)
    return res.status(403).json({ message: 'Account disabled' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: 'Invalid credentials' });

  await attachRoleMetadata(user);
  return completeLogin(req, res, user, { email });
};

export const refreshSession = async (req, res) => {
  const tokenValue = req.body.refreshToken || req.cookies?.refreshToken;
  const session = await verifyRefreshToken(tokenValue);
  if (!session) return res.status(401).json({ message: 'Invalid refresh token' });

  const user = await User.findById(session.user);
  if (!user) {
    await revokeRefreshToken(tokenValue);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
  if (user.isDeactivated || user.isActive === false) {
    await revokeRefreshToken(tokenValue);
    return res.status(403).json({ message: 'Account disabled' });
  }
  await attachRoleMetadata(user);

  const refreshToken = await rotateRefreshToken(session, buildContext(req));
  const token = createAccessToken(user);
  respondWithSession(res, user, { token, refreshToken });
};

export const logout = async (req, res) => {
  const tokenValue = req.body.refreshToken || req.cookies?.refreshToken;
  if (tokenValue) await revokeRefreshToken(tokenValue);
  res.json({ success: true });
};

export const profile = async (req, res) => {
  const user = await attachRoleMetadata(req.user);
  res.json({ user: user.toSafeObject() });
};
