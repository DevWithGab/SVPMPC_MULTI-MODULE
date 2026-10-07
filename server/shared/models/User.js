const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    sessionVersion: { type: Number, default: 0 },
    userId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      // Retained for reading legacy accounts; members no longer get logins.
      type: String,
      ref: 'Member',
    },
    staffId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
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
      enum: ['admin', 'secretary', 'treasurer', 'scanner_operator', 'super_admin'],
      required: true,
    },
  },
  { timestamps: true }
);

// Login accounts are staff-only. Require the same validation when updating
// accounts through query helpers as when creating/saving documents.
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace']) {
  userSchema.pre(operation, function () {
    this.setOptions({ runValidators: true });
  });
}

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

// Indexes: ensure uniqueness only when the id fields are actual strings
userSchema.index(
  { memberId: 1 },
  { unique: true, partialFilterExpression: { memberId: { $type: 'string' } } }
);
userSchema.index(
  { staffId: 1 },
  { unique: true, partialFilterExpression: { staffId: { $type: 'string' } } }
);

module.exports = mongoose.model('User', userSchema);
