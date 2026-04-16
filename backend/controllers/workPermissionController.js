import WorkPermission from '../models/WorkPermission.js';
import EmployeeCapability from '../models/EmployeeCapability.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { respondIfInvalidObjectId } from '../utils/objectId.js';

// REQUEST WORK PERMISSION FOR EMPLOYEE
export const requestWorkPermission = async (req, res) => {
  try {
    const { taskId, employeeId, workType, estimatedHours, priority, dueDate, message } = req.body;

    if (!taskId || !employeeId) {
      return res.status(400).json({ message: 'taskId and employeeId required' });
    }

    if (respondIfInvalidObjectId(res, taskId, 'taskId')) return;
    if (respondIfInvalidObjectId(res, employeeId, 'employeeId')) return;

    // Verify user can request permissions (admin, manager)
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admin/manager can request work permissions' });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if permission already exists and is pending
    const existingPermission = await WorkPermission.findOne({
      task: taskId,
      employee: employeeId,
      status: 'pending'
    });

    if (existingPermission) {
      return res.status(400).json({ message: 'Permission request already pending for this task' });
    }

    // Create permission request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const permission = await WorkPermission.create({
      employee: employeeId,
      task: taskId,
      requestedBy: req.user._id,
      workType: workType || 'other',
      estimatedHours: estimatedHours || task.estimatedDuration || 8,
      priority: priority || task.priority || 'medium',
      dueDate: dueDate || task.dueDate,
      requestMessage: message,
      expiresAt,
      taskSnapshot: {
        title: task.title,
        description: task.description,
        priority: task.priority
      }
    });

    // Create notification for employee
    await Notification.create({
      user: employeeId,
      message: `Work permission request: ${task.title}`,
      context: {
        type: 'work_permission_request',
        permissionId: permission._id,
        taskId,
        priority
      },
      severity: priority === 'critical' ? 'critical' : 'info'
    });

    // Send permission request response
    const populated = await WorkPermission.findById(permission._id)
      .populate('task', 'title description priority')
      .populate('requestedBy', 'name email role')
      .populate('employee', 'name email role');

    res.status(201).json({
      message: 'Work permission requested',
      permission: populated
    });
  } catch (error) {
    console.error('Error requesting work permission:', error);
    res.status(500).json({ message: 'Error requesting work permission', error: error.message });
  }
};

// ACCEPT WORK PERMISSION
export const acceptWorkPermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { notes } = req.body;

    if (respondIfInvalidObjectId(res, permissionId, 'permissionId')) return;

    const permission = await WorkPermission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ message: 'Permission request not found' });
    }

    // Verify user is the employee
    if (String(permission.employee) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Can only respond to your own permission requests' });
    }

    if (permission.status !== 'pending') {
      return res.status(400).json({ message: `Cannot accept ${permission.status} permission` });
    }

    if (permission.isExpired()) {
      permission.status = 'expired';
      await permission.save();
      return res.status(400).json({ message: 'Permission request has expired' });
    }

    // Accept permission
    permission.status = 'accepted';
    permission.respondedAt = new Date();
    permission.employeeNotes = notes || '';
    await permission.save();

    // Update task to assigned
    const task = await Task.findById(permission.task);
    if (task) {
      task.assignedTo = req.user._id;
      task.status = 'todo';
      await task.save();
    }

    // Create notification for requester
    await Notification.create({
      user: permission.requestedBy,
      message: `${req.user.name} accepted work permission for: ${permission.taskSnapshot.title}`,
      context: {
        type: 'work_permission_accepted',
        permissionId: permission._id,
        employeeId: req.user._id
      },
      severity: 'info'
    });

    res.json({
      message: 'Work permission accepted',
      permission
    });
  } catch (error) {
    console.error('Error accepting work permission:', error);
    res.status(500).json({ message: 'Error accepting permission', error: error.message });
  }
};

// REJECT WORK PERMISSION
export const rejectWorkPermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { reason } = req.body;

    if (respondIfInvalidObjectId(res, permissionId, 'permissionId')) return;

    const permission = await WorkPermission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({ message: 'Permission request not found' });
    }

    // Verify user is the employee
    if (String(permission.employee) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Can only respond to your own permission requests' });
    }

    if (permission.status !== 'pending') {
      return res.status(400).json({ message: `Cannot reject ${permission.status} permission` });
    }

    // Reject permission
    permission.status = 'rejected';
    permission.respondedAt = new Date();
    permission.employeeNotes = reason || '';
    await permission.save();

    // Create notification for requester
    await Notification.create({
      user: permission.requestedBy,
      message: `${req.user.name} rejected work permission for: ${permission.taskSnapshot.title}`,
      context: {
        type: 'work_permission_rejected',
        permissionId: permission._id,
        employeeId: req.user._id,
        reason
      },
      severity: 'warning'
    });

    res.json({
      message: 'Work permission rejected',
      permission
    });
  } catch (error) {
    console.error('Error rejecting work permission:', error);
    res.status(500).json({ message: 'Error rejecting permission', error: error.message });
  }
};

// GET PENDING PERMISSIONS FOR CURRENT USER
export const getPendingPermissions = async (req, res) => {
  try {
    const permissions = await WorkPermission.getPendingForEmployee(req.user._id);
    res.json(permissions);
  } catch (error) {
    console.error('Error getting pending permissions:', error);
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
};

// GET ALL PERMISSIONS FOR TASK
export const getTaskPermissions = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (respondIfInvalidObjectId(res, taskId, 'taskId')) return;

    const permissions = await WorkPermission.find({ task: taskId })
      .populate('employee', 'name email role')
      .populate('requestedBy', 'name email role');

    res.json(permissions);
  } catch (error) {
    console.error('Error getting task permissions:', error);
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
};

// GET EMPLOYEE CAPABILITY
export const getEmployeeCapability = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (respondIfInvalidObjectId(res, employeeId, 'employeeId')) return;

    let capability = await EmployeeCapability.findOne({ employee: employeeId });

    if (!capability) {
      // Create default capability profile
      capability = await EmployeeCapability.create({
        employee: employeeId,
        availability: { status: 'available', maxHoursPerWeek: 40 }
      });
    }

    // Update performance metrics
    await capability.updatePerformanceMetrics();

    res.json(capability);
  } catch (error) {
    console.error('Error getting employee capability:', error);
    res.status(500).json({ message: 'Error fetching capability', error: error.message });
  }
};

// UPDATE EMPLOYEE CAPABILITY
export const updateEmployeeCapability = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updates = req.body;

    if (respondIfInvalidObjectId(res, employeeId, 'employeeId')) return;

    // Only employee or admin/manager can update
    const isOwner = String(req.user._id) === String(employeeId);
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'Cannot update other employee capabilities' });
    }

    let capability = await EmployeeCapability.findOne({ employee: employeeId });

    if (!capability) {
      capability = new EmployeeCapability({ employee: employeeId });
    }

    // Merge updates
    Object.assign(capability, updates);
    await capability.save();

    res.json({
      message: 'Employee capability updated',
      capability
    });
  } catch (error) {
    console.error('Error updating employee capability:', error);
    res.status(500).json({ message: 'Error updating capability', error: error.message });
  }
};

// GET EMPLOYEE WORKLOAD
export const getEmployeeWorkload = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (respondIfInvalidObjectId(res, employeeId, 'employeeId')) return;

    let capability = await EmployeeCapability.findOne({ employee: employeeId });

    if (!capability) {
      capability = await EmployeeCapability.create({
        employee: employeeId
      });
    }

    const workload = await capability.getCurrentWorkload();
    const acceptanceStats = await WorkPermission.getAcceptanceRateForEmployee(employeeId);
    const canAccept = capability.canAcceptWork();

    res.json({
      workload,
      acceptanceStats,
      canAccept,
      maxConcurrentTasks: capability.constraints.maxConcurrentTasks,
      isOverloaded: workload.isOverloaded
    });
  } catch (error) {
    console.error('Error getting employee workload:', error);
    res.status(500).json({ message: 'Error fetching workload', error: error.message });
  }
};

// GET EMPLOYEE RECOMMENDATION (which tasks they should accept)
export const getWorkRecommendations = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const capability = await EmployeeCapability.findOne({ employee: employeeId });
    if (!capability) {
      return res.json({ recommendations: [], reason: 'No capability profile' });
    }

    const pendingPermissions = await WorkPermission.getPendingForEmployee(employeeId);
    const recommendedWorkTypes = capability.getRecommendedWorkTypes();

    const recommendations = pendingPermissions.map((perm) => {
      let matchScore = 0;
      let reasons = [];

      // Check work type match
      if (recommendedWorkTypes.includes(perm.workType)) {
        matchScore += 30;
        reasons.push('Matches your expertise');
      }

      // Check priority alignment
      if (perm.priority === 'high' || perm.priority === 'critical') {
        matchScore += 20;
        reasons.push('High priority work');
      }

      // Check time availability
      if (perm.estimatedHours <= capability.availability.maxHoursPerWeek / 5) {
        matchScore += 25;
        reasons.push('Fits your availability');
      }

      // Check workload
      if (!capability.constraints.maxConcurrentTasks || matchScore >= 50) {
        matchScore += 25;
        reasons.push('You have capacity');
      }

      return {
        permissionId: perm._id,
        task: perm.task,
        matchScore,
        reasons,
        shouldAccept: matchScore >= 60
      };
    });

    res.json({
      recommendations: recommendations.sort((a, b) => b.matchScore - a.matchScore),
      yourCapabilities: {
        workTypes: recommendedWorkTypes,
        maxHours: capability.availability.maxHoursPerWeek,
        status: capability.availability.status
      }
    });
  } catch (error) {
    console.error('Error getting work recommendations:', error);
    res.status(500).json({ message: 'Error fetching recommendations', error: error.message });
  }
};
