import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  adminApprove,
  adminReject,
  cancelLeaveRequest,
  createLeaveRequest,
  listLeaveRequests,
  listLeaveTypes,
  listMyLeaveBalances,
  listMyLeaveRequests,
  managerApprove,
  managerReject
} from '../controllers/leaveController.js';

const router = Router();

router.use(protect);

router.get('/types', listLeaveTypes);
router.get('/balances/me', listMyLeaveBalances);
router.get('/requests/me', listMyLeaveRequests);
router.post('/requests', createLeaveRequest);
router.post('/requests/:id/cancel', cancelLeaveRequest);

router.get('/requests', requireRole('admin', 'manager'), listLeaveRequests);
router.post('/requests/:id/manager-approve', requireRole('manager'), managerApprove);
router.post('/requests/:id/manager-reject', requireRole('manager'), managerReject);
router.post('/requests/:id/admin-approve', requireRole('admin'), adminApprove);
router.post('/requests/:id/admin-reject', requireRole('admin'), adminReject);

export default router;
