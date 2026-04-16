import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usedAt: Date,
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

inviteSchema.index({ email: 1, expiresAt: 1 });
inviteSchema.index({ createdBy: 1, createdAt: -1 });

const Invite = mongoose.model('Invite', inviteSchema);
export default Invite;
