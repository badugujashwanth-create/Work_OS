import mongoose from 'mongoose';

const timeSheetDaySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    clockInAt: Date,
    clockOutAt: Date,
    breakMinutes: { type: Number, default: 0 },
    payableMinutes: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    idleMinutes: { type: Number, default: 0 },
    breakStartedAt: Date,
    note: String,
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvalNote: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  },
  { timestamps: true }
);

timeSheetDaySchema.index({ user: 1, date: 1 }, { unique: true });

const TimeSheetDay = mongoose.model('TimeSheetDay', timeSheetDaySchema);
export default TimeSheetDay;
