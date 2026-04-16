import mongoose from 'mongoose';

const appUsageTickSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ts: { type: Date, required: true },
    idleSeconds: { type: Number, default: 0 },
    activeApp: String,
    activeAppTitle: String,
    isWorkOSFocused: { type: Boolean, default: false },
    workosModule: String,
    source: { type: String, default: 'unknown' }
  },
  { timestamps: true }
);

appUsageTickSchema.index({ user: 1, ts: 1 });
appUsageTickSchema.index({ user: 1, activeApp: 1, ts: 1 });

const AppUsageTick = mongoose.model('AppUsageTick', appUsageTickSchema);
export default AppUsageTick;
