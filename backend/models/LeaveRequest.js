import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationType: {
      type: String,
      enum: ['full_day', 'half_day', 'hours'],
      default: 'full_day'
    },
    hoursRequested: Number,
    reason: { type: String, trim: true },
    attachmentUrl: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending'
    },
    managerDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    adminDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managerComment: String,
    adminComment: String
  },
  { timestamps: true }
);

leaveRequestSchema.index({ userId: 1, startAt: -1 });
leaveRequestSchema.index({ status: 1, startAt: -1 });

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
export default LeaveRequest;
