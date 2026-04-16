import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

teamSchema.index({ name: 1 });

const Team = mongoose.model('Team', teamSchema);
export default Team;
