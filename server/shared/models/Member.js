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
    // Whether a generated QR is currently accepted for scanning. Kept
    // separate from the shared `status` field below (active/inactive/
    // deceased/staff) — that field also drives the Mortuary module, so a
    // QR being deactivated here must never affect it.
    qrCodeActive: {
      type: Boolean,
      default: true,
    },
    // Mortuary-specific fields
    beneficiaries: {
      type: String,
      default: '',
    },
    // Free-text relationship of the above beneficiary to this member (e.g.
    // "Spouse", "Child") — captured at registration so a future death claim
    // isn't the first time it's ever asked for. Not the structured
    // Beneficiary record used once a claim is actually filed.
    beneficiaryRelationship: {
      type: String,
      default: '',
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deceased', 'staff'],
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
memberSchema.index({ memberName: 1 }); // For search and sorting
memberSchema.index({ barangay: 1 }); // For barangay filtering
memberSchema.index({ phoneNumber: 1 }); // For search
memberSchema.index({ status: 1, memberName: 1 }); // Compound for filtered sorting

module.exports = mongoose.model('Member', memberSchema);
