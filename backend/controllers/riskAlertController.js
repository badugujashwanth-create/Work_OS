import dayjs from 'dayjs';
import User from '../models/User.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';
import {
  addRiskAlertNote,
  evaluateRiskAlerts,
  listRiskAlertsForUsers,
  resolveRiskAlert,
  snoozeRiskAlert
} from '../services/riskAlertService.js';

const parseStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['open', 'snoozed', 'resolved', 'all'].includes(normalized)) return normalized;
  return 'open';
};

const parseSnoozeUntil = (payload) => {
  if (payload?.until) {
    const parsed = dayjs(payload.until);
    if (parsed.isValid()) return parsed.toDate();
  }
  if (payload?.hours) {
    const hours = Number(payload.hours);
    if (Number.isFinite(hours) && hours > 0) {
      return dayjs().add(hours, 'hour').toDate();
    }
  }
  if (payload?.days) {
    const days = Number(payload.days);
    if (Number.isFinite(days) && days > 0) {
      return dayjs().add(days, 'day').toDate();
    }
  }
  return dayjs().add(1, 'day').toDate();
};

export const listRiskAlerts = async (req, res) => {
  const employees = await User.find({ role: 'employee', isActive: { $ne: false } }).select('_id');
  const userIds = employees.map((user) => user._id);
  await evaluateRiskAlerts(userIds);

  const status = parseStatus(req.query.status);
  const alerts = await listRiskAlertsForUsers(userIds, status);
  res.json(alerts);
};

export const resolveAlert = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'alert id')) return;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const alert = await resolveRiskAlert(req.params.id, note);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  await alert.populate('userId', 'name email role department lastActiveAt');
  res.json(alert);
};

export const snoozeAlert = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'alert id')) return;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const snoozedUntil = parseSnoozeUntil(req.body);
  const alert = await snoozeRiskAlert(req.params.id, snoozedUntil, note);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  await alert.populate('userId', 'name email role department lastActiveAt');
  res.json(alert);
};

export const noteAlert = async (req, res) => {
  if (respondIfInvalidObjectId(res, req.params.id, 'alert id')) return;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!note) return res.status(400).json({ message: 'Note is required' });
  const alert = await addRiskAlertNote(req.params.id, note);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  await alert.populate('userId', 'name email role department lastActiveAt');
  res.json(alert);
};
