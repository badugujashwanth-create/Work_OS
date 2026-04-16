import mongoose from 'mongoose';

const employeeCapabilitySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    skills: [
      {
        name: String,
        level: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          default: 'intermediate'
        },
        endorsements: { type: Number, default: 0 }
      }
    ],
    workTypes: [
      {
        type: {
          type: String,
          enum: ['development', 'design', 'testing', 'documentation', 'support', 'other']
        },
        proficiency: {
          type: String,
          enum: ['low', 'medium', 'high'],
          default: 'medium'
        },
        yearsOfExperience: Number
      }
    ],
    availability: {
      status: {
        type: String,
        enum: ['available', 'busy', 'on_leave', 'unavailable'],
        default: 'available'
      },
      maxHoursPerWeek: { type: Number, default: 40 },
      preferredWorkTypes: [String],
      preferredHours: {
        start: String, // e.g., "09:00"
        end: String    // e.g., "17:00"
      }
    },
    workStyle: {
      remoteFriendly: { type: Boolean, default: true },
      collaborationPreference: {
        type: String,
        enum: ['independent', 'collaborative', 'hybrid'],
        default: 'hybrid'
      },
      communicationPreference: [String] // e.g., ['email', 'chat', 'video-call']
    },
    performance: {
      totalTasksAssigned: { type: Number, default: 0 },
      tasksCompleted: { type: Number, default: 0 },
      averageCompletionRate: { type: Number, default: 100 },
      workPermissionAcceptanceRate: { type: Number, default: 100 },
      averageResponseTime: Number, // in minutes
      lastUpdated: Date
    },
    constraints: {
      canWorkWeekends: { type: Boolean, default: false },
      canWorkOvertime: { type: Boolean, default: true },
      maxConcurrentTasks: { type: Number, default: 5 },
      blackoutDates: [{ start: Date, end: Date, reason: String }]
    },
    specializations: [String], // e.g., ['Full-Stack Development', 'AWS Architecture']
    certifications: [
      {
        name: String,
        issuedBy: String,
        issuedDate: Date,
        expiresAt: Date,
        certificateUrl: String
      }
    ],
    workHistory: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        role: String,
        startDate: Date,
        endDate: Date,
        tasksCompleted: Number,
        averageRating: Number
      }
    ],
    preferences: {
      autoAcceptWork: { type: Boolean, default: false },
      permissionRequestExpiryDays: { type: Number, default: 7 },
      notifyOnNewTask: { type: Boolean, default: true },
      notifyOnPermissionExpiry: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

employeeCapabilitySchema.index({ employee: 1 });
employeeCapabilitySchema.index({ 'workTypes.type': 1 });
employeeCapabilitySchema.index({ 'availability.status': 1 });

// Get current workload for employee
employeeCapabilitySchema.methods.getCurrentWorkload = async function() {
  const Task = mongoose.model('Task');
  const WorkPermission = mongoose.model('WorkPermission');

  const [activeTasks, permissionRequests] = await Promise.all([
    Task.countDocuments({
      assignedTo: this.employee,
      status: { $in: ['todo', 'in_progress', 'review'] }
    }),
    WorkPermission.countDocuments({
      employee: this.employee,
      status: 'pending'
    })
  ]);

  return {
    activeTasks,
    pendingPermissions: permissionRequests,
    isOverloaded: activeTasks >= this.constraints.maxConcurrentTasks
  };
};

// Check if employee can accept new work
employeeCapabilitySchema.methods.canAcceptWork = function() {
  if (this.availability.status !== 'available') {
    return { canAccept: false, reason: `Employee is currently ${this.availability.status}` };
  }

  if (this.performance.averageCompletionRate < 70) {
    return { canAccept: false, reason: 'Employee has low completion rate' };
  }

  return { canAccept: true, reason: 'Ready to accept new work' };
};

// Update performance metrics
employeeCapabilitySchema.methods.updatePerformanceMetrics = async function() {
  const Task = mongoose.model('Task');
  const WorkPermission = mongoose.model('WorkPermission');

  const tasks = await Task.find({ assignedTo: this.employee });
  const permissions = await WorkPermission.find({ employee: this.employee, respondedAt: { $exists: true } });

  const completed = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;

  this.performance.totalTasksAssigned = totalTasks;
  this.performance.tasksCompleted = completed;
  this.performance.averageCompletionRate = totalTasks > 0 ? (completed / totalTasks) * 100 : 100;
  this.performance.workPermissionAcceptanceRate =
    permissions.length > 0
      ? ((permissions.filter((p) => p.status === 'accepted').length / permissions.length) * 100).toFixed(2)
      : 100;
  this.performance.lastUpdated = new Date();

  return this.save();
};

// Get recommended work types based on skills
employeeCapabilitySchema.methods.getRecommendedWorkTypes = function() {
  return this.workTypes
    .filter((wt) => wt.proficiency === 'high' || wt.proficiency === 'medium')
    .map((wt) => wt.type);
};

const EmployeeCapability = mongoose.model('EmployeeCapability', employeeCapabilitySchema);
export default EmployeeCapability;
