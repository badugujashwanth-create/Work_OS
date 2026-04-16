import express from 'express';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import {
  requestWorkPermission,
  acceptWorkPermission,
  rejectWorkPermission,
  getPendingPermissions,
  getTaskPermissions,
  getEmployeeCapability,
  updateEmployeeCapability,
  getEmployeeWorkload,
  getWorkRecommendations
} from '../controllers/workPermissionController.js';

const router = express.Router();

// PERMISSION REQUEST ROUTES
// Request work permission for an employee
router.post('/request', protect, requireRole('admin', 'manager'), requestWorkPermission);

// Accept a permission request
router.patch('/:permissionId/accept', protect, acceptWorkPermission);

// Reject a permission request
router.patch('/:permissionId/reject', protect, rejectWorkPermission);

// Get pending permissions for current user
router.get('/pending', protect, getPendingPermissions);

// Get all permissions for a specific task
router.get('/task/:taskId', protect, requireRole('admin', 'manager'), getTaskPermissions);

// EMPLOYEE CAPABILITY ROUTES
// Get employee's capability profile
router.get('/capability/:employeeId', protect, getEmployeeCapability);

// Update employee's capability profile
router.patch('/capability/:employeeId', protect, updateEmployeeCapability);

// Get employee's current workload and capacity
router.get('/workload/:employeeId', protect, getEmployeeWorkload);

// Get recommendations for which tasks the current user should accept
router.get('/recommendations/my', protect, getWorkRecommendations);

export default router;
