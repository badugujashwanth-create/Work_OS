import mongoose from 'mongoose';

const workPermissionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending'
    },
    workType: {
      type: String,
      enum: ['development', 'design', 'testing', 'documentation', 'support', 'other'],
      default: 'other'
    },
    estimatedHours: { type: Number, min: 0.5 },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    dueDate: Date,
    requestMessage: String,
    employeeNotes: String,
    respondedAt: Date,
    expiresAt: Date,
    taskSnapshot: {
      title: String,
      description: String,
      priority: String
    }
  },
  { timestamps: true }
);

workPermissionSchema.index({ employee: 1, status: 1 });
workPermissionSchema.index({ task: 1 });
workPermissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if permission has expired
workPermissionSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Accept permission
workPermissionSchema.methods.accept = function(notes = '') {
  if (this.status !== 'pending') {
    throw new Error('Can only accept pending permissions');
  }
  this.status = 'accepted';
  this.respondedAt = new Date();
  this.employeeNotes = notes;
  return this.save();
};

// Reject permission
workPermissionSchema.methods.reject = function(reason = '') {
  if (this.status !== 'pending') {
    throw new Error('Can only reject pending permissions');
  }
  this.status = 'rejected';
  this.respondedAt = new Date();
  this.employeeNotes = reason;
  return this.save();
};

// Get pending permissions for employee
workPermissionSchema.statics.getPendingForEmployee = function(employeeId) {
  return this.find({
    employee: employeeId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
    .populate('task', 'title description priority')
    .populate('requestedBy', 'name email role')
    .sort({ createdAt: -1 });
};

// Get acceptance rate for employee
workPermissionSchema.statics.getAcceptanceRateForEmployee = async function(employeeId) {
  const result = await this.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        respondedAt: { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        }
      }
    }
  ]);

  if (result.length === 0) {
    return { total: 0, accepted: 0, rejected: 0, acceptanceRate: 0 };
  }

  const { total, accepted, rejected } = result[0];
  return {
    total,
    accepted,
    rejected,
    acceptanceRate: total > 0 ? ((accepted / total) * 100).toFixed(2) : 0
  };
};

const WorkPermission = mongoose.model('WorkPermission', workPermissionSchema);
export default WorkPermission;
