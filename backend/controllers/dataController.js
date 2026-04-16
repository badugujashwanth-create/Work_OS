import User from '../models/User.js';
import Role from '../models/Role.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import WorkSession from '../models/WorkSession.js';
import DailyLog from '../models/DailyLog.js';
import Attendance from '../models/Attendance.js';
import CallSession from '../models/CallSession.js';
import CallMessage from '../models/CallMessage.js';
import CallLog from '../models/CallLog.js';
import ChatThread from '../models/ChatThread.js';
import ChatMessage from '../models/ChatMessage.js';
import Notification from '../models/Notification.js';
import NotificationRule from '../models/NotificationRule.js';
import SystemSetting from '../models/SystemSetting.js';
import ActivityAlert from '../models/ActivityAlert.js';
import AuditLog from '../models/AuditLog.js';
import RefreshToken from '../models/RefreshToken.js';
import Document from '../models/Document.js';
import Announcement from '../models/Announcement.js';
import CollabMessage from '../models/CollabMessage.js';
import CollabFile from '../models/CollabFile.js';
import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import Channel from '../models/Channel.js';
import TeamMessage from '../models/TeamMessage.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import RiskAlert from '../models/RiskAlert.js';

const MODELS = [
  User,
  Role,
  Task,
  Project,
  WorkSession,
  DailyLog,
  Attendance,
  CallSession,
  CallMessage,
  CallLog,
  ChatThread,
  ChatMessage,
  Notification,
  NotificationRule,
  SystemSetting,
  ActivityAlert,
  AuditLog,
  RefreshToken,
  Document,
  Announcement,
  CollabMessage,
  CollabFile,
  Team,
  TeamMember,
  Channel,
  TeamMessage,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  RiskAlert
];

const modelMap = new Map(
  MODELS.map((model) => [model.collection.collectionName, model])
);

export const exportData = async (_req, res) => {
  const data = {};
  await Promise.all(
    MODELS.map(async (model) => {
      data[model.collection.collectionName] = await model.find().lean();
    })
  );
  res.json({
    exportedAt: new Date().toISOString(),
    data
  });
};

export const importData = async (req, res) => {
  const payload = req.body?.data || req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ message: 'Invalid import payload' });
  }

  const mode = req.body?.mode || req.query?.mode || 'replace';
  const results = [];

  for (const [collection, rows] of Object.entries(payload)) {
    if (!Array.isArray(rows)) continue;
    const model = modelMap.get(collection);
    if (!model) {
      results.push({ collection, status: 'skipped', reason: 'Unknown collection' });
      continue;
    }

    try {
      if (mode === 'replace') {
        await model.deleteMany({});
      }
      if (rows.length) {
        await model.insertMany(rows, { ordered: false });
      }
      results.push({ collection, status: 'ok', count: rows.length });
    } catch (error) {
      results.push({ collection, status: 'error', message: error.message });
    }
  }

  res.json({ mode, results });
};
