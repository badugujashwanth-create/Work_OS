import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ensureUserPermissions } from '../services/rbacService.js';

const ACTIVITY_UPDATE_WINDOW_MS = 5 * 60 * 1000;

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ message: 'Unauthorized' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.isDeactivated || user.isActive === false)
      return res.status(403).json({ message: 'Account disabled' });

    if (
      !user.lastActiveAt ||
      Date.now() - new Date(user.lastActiveAt).getTime() > ACTIVITY_UPDATE_WINDOW_MS
    ) {
      user.lastActiveAt = new Date();
      user.isOnline = true;
      user.activityStatus = 'active';
      user.idleSince = null;
      await user.save();
    }

    await ensureUserPermissions(user);
    req.user = user;
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - insufficient permissions' });
    }
    next();
  };
};
