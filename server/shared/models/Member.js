const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      unique: true,
      required: true,
    },
    memberName: {
      type: String,
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
    barangay: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    // Attendance-specific fields
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    qrCodeUrl: {
      type: String,
    },
    qrCodeGenerated: {
      type: Boolean,
      default: false,
    },
    // Mortuary-specific fields
    beneficiaries: {
      type: String,
      default: '',
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deceased'],
      default: 'active',
    },
    // Shared fields
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phoneNumber: String,
    },
    // Module access
    modules: {
      type: [String],
      default: ['attendance', 'mortuary'],
      enum: ['attendance', 'mortuary'],
    },
  },
  { timestamps: true }
);

// Index for faster queries
// Note: memberId already has unique index from schema definition
memberSchema.index({ email: 1 });
memberSchema.index({ status: 1 });

module.exports = mongoose.model('Member', memberSchema);
