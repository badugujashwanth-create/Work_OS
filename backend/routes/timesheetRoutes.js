import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  getAdminTimesheets,
  getMyTimesheet,
  saveNote,
  exportTimesheetCSV,
  adminExportTimesheetCSV
} from '../controllers/timesheetController.js';

const router = Router();

router.use(protect);
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.post('/break-start', breakStart);
router.post('/break-end', breakEnd);
router.get('/me', getMyTimesheet);
router.get('/export', exportTimesheetCSV);
router.get('/admin', requireRole('admin', 'manager'), getAdminTimesheets);
router.get('/admin/export', requireRole('admin', 'manager'), adminExportTimesheetCSV);
router.patch('/note', saveNote);

export default router;
