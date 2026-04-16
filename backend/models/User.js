import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    otpCodeHash: String,
    otpExpiresAt: Date,
    otpLastSentAt: Date,
    otpAttempts: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ['admin', 'manager', 'employee', 'hr', 'auditor'],
      default: 'employee'
    },
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    title: String,
    department: String,
    avatar: String,
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract'],
      default: 'full_time'
    },
    workHoursPerWeek: { type: Number, default: 40 },
    lastLogin: Date,
    lastActiveAt: Date,
    isOnline: { type: Boolean, default: false },
    activityStatus: {
      type: String,
      enum: ['active', 'idle', 'offline'],
      default: 'offline'
    },
    idleSince: Date,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDeactivated: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deactivatedAt: Date,
    mustResetPassword: { type: Boolean, default: false },
    tempPasswordIssuedAt: Date,
    permissions: [String],
    attendancePreferences: {
      shiftStart: { type: String, default: '09:00' },
      shiftEnd: { type: String, default: '18:00' },
      timezone: { type: String, default: 'UTC' }
    }
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
