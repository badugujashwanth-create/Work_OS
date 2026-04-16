import { Router } from 'express';
import {
  getOnlineEmployees,
  getProductivity,
  weeklyReport,
  monthlyReport,
  getAdminTasks,
  getAllLogs,
  getDashboardSnapshot,
  getActivityFeed
} from '../controllers/adminController.js';
import {
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  updateAdminUser
} from '../controllers/adminUserController.js';
import { createInvite, listInvites } from '../controllers/inviteController.js';
import {
  createTeam,
  createTeamChannel,
  listTeams,
  updateChannel,
  updateTeam,
  upsertTeamMember
} from '../controllers/adminTeamController.js';
import {
  listAdminChatMessages,
  listAdminChatTeams,
  postAdminAnnouncement
} from '../controllers/adminChatController.js';
import {
  getControlCenter,
  getControlCenterEmployee
} from '../controllers/controlCenterController.js';
import {
  exportLeave,
  exportTimesheets,
  exportUsage
} from '../controllers/exportController.js';
import {
  adjustLeaveBalance,
  createLeaveType,
  deactivateLeaveType,
  listLeaveTypesAdmin,
  updateLeaveType
} from '../controllers/adminLeaveController.js';
import {
  listRiskAlerts,
  noteAlert,
  resolveAlert,
  snoozeAlert
} from '../controllers/riskAlertController.js';
import { exportData, importData } from '../controllers/dataController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole, requirePermission } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(protect);
router.get('/dashboard', requireRole('admin'), getDashboardSnapshot);
router.get('/online', requireRole('admin', 'manager'), getOnlineEmployees);
router.get('/productivity', requireRole('admin', 'manager'), getProductivity);
router.get('/activity', requireRole('admin', 'auditor'), requirePermission('audit:view'), getActivityFeed);
router.get('/reports/weekly', requireRole('admin', 'hr'), requirePermission('reports:view'), weeklyReport);
router.get('/reports/monthly', requireRole('admin', 'hr'), requirePermission('reports:view'), monthlyReport);
router.get('/tasks', requireRole('admin', 'manager'), getAdminTasks);
router.get('/logs', requireRole('admin', 'hr', 'auditor'), getAllLogs);
router.get('/data/export', requireRole('admin'), exportData);
router.post('/data/import', requireRole('admin'), importData);
router.get('/users', requireRole('admin'), listAdminUsers);
router.post('/users', requireRole('admin'), createAdminUser);
router.put('/users/:id', requireRole('admin'), updateAdminUser);
router.delete('/users/:id', requireRole('admin'), deactivateAdminUser);
router.get('/invites', requireRole('admin'), listInvites);
router.post('/invites', requireRole('admin'), createInvite);
router.get('/teams', requireRole('admin'), listTeams);
router.post('/teams', requireRole('admin'), createTeam);
router.put('/teams/:id', requireRole('admin'), updateTeam);
router.post('/teams/:id/members', requireRole('admin'), upsertTeamMember);
router.post('/teams/:id/channels', requireRole('admin', 'manager'), createTeamChannel);
router.put('/channels/:id', requireRole('admin'), updateChannel);
router.get('/chat/teams', requireRole('admin'), listAdminChatTeams);
router.get('/chat/messages', requireRole('admin'), listAdminChatMessages);
router.post('/chat/messages', requireRole('admin'), postAdminAnnouncement);
router.get('/control-center', requireRole('admin'), getControlCenter);
router.get('/control-center/:id', requireRole('admin'), getControlCenterEmployee);
router.get('/risk-alerts', requireRole('admin'), listRiskAlerts);
router.post('/risk-alerts/:id/resolve', requireRole('admin'), resolveAlert);
router.post('/risk-alerts/:id/snooze', requireRole('admin'), snoozeAlert);
router.post('/risk-alerts/:id/note', requireRole('admin'), noteAlert);
router.get('/exports/timesheets', requireRole('admin'), exportTimesheets);
router.get('/exports/leave', requireRole('admin'), exportLeave);
router.get('/exports/usage', requireRole('admin'), exportUsage);
router.get('/leave-types', requireRole('admin'), listLeaveTypesAdmin);
router.post('/leave-types', requireRole('admin'), createLeaveType);
router.put('/leave-types/:id', requireRole('admin'), updateLeaveType);
router.delete('/leave-types/:id', requireRole('admin'), deactivateLeaveType);
router.post('/leave/balances/adjust', requireRole('admin'), adjustLeaveBalance);

export default router;
