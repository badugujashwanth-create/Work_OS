import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    year: { type: Number, required: true },
    totalDays: { type: Number, default: 0 },
    usedDays: { type: Number, default: 0 },
    remainingDays: { type: Number, default: 0 }
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

leaveBalanceSchema.pre('save', function updateRemaining(next) {
  if (typeof this.totalDays === 'number' && typeof this.usedDays === 'number') {
    this.remainingDays = Math.max(0, this.totalDays - this.usedDays);
  }
  next();
});

const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
export default LeaveBalance;
