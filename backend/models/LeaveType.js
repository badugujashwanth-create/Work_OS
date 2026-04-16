import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    paid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    defaultAnnualDays: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
export default LeaveType;
