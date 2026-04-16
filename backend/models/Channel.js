import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['general', 'announcements', 'project'],
      default: 'general'
    },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

channelSchema.index({ teamId: 1, name: 1 }, { unique: true });
channelSchema.index({ teamId: 1, type: 1 });

const Channel = mongoose.model('Channel', channelSchema);
export default Channel;
