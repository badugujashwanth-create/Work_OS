import mongoose from 'mongoose';

const riskAlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['no_clockin_2days', 'low_hours', 'too_much_idle', 'no_usage_ticks'],
      required: true
    },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    status: { type: String, enum: ['open', 'snoozed', 'resolved'], default: 'open' },
    message: { type: String, required: true },
    note: String,
    metadata: mongoose.Schema.Types.Mixed,
    snoozedUntil: Date,
    resolvedAt: Date,
    lastTriggeredAt: Date
  },
  { timestamps: true }
);

riskAlertSchema.index({ userId: 1, status: 1 });
riskAlertSchema.index({ userId: 1, type: 1 });

const RiskAlert = mongoose.model('RiskAlert', riskAlertSchema);
export default RiskAlert;
