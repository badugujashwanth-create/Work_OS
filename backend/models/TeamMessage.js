import mongoose from 'mongoose';

const teamMessageSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

teamMessageSchema.index({ channelId: 1, createdAt: 1 });
teamMessageSchema.index({ teamId: 1, channelId: 1 });

const TeamMessage = mongoose.model('TeamMessage', teamMessageSchema);
export default TeamMessage;
