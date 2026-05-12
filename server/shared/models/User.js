const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      unique: true,
      required: true,
      ref: 'Member',
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isTemporaryPassword: {
      type: Boolean,
      default: true,
    },
    lastPasswordChangeDate: {
      type: Date,
      default: null,
    },
    lastLoginDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    modules: {
      type: [String],
      default: ['attendance', 'mortuary'],
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'secretary', 'treasurer', 'scanner_operator', 'super_admin'],
      default: 'member',
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
