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
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
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
// email is optional (members can be created with none, stored as '') — a
// plain unique index would reject the second member ever created with a
// blank email, so uniqueness is only enforced among members that actually
// have a non-blank one. This is what actually prevents two concurrent
// create-member requests for the same email from both succeeding — the
// findOne precheck in adminController.js is just a faster, friendlier first
// pass that can lose that race (same class of bug already closed for staff
// usernames via User.username's own unique index).
memberSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);
memberSchema.index({ status: 1 });
memberSchema.index({ memberName: 1 }); // For search and sorting
memberSchema.index({ barangay: 1 }); // For barangay filtering
memberSchema.index({ phoneNumber: 1 }); // For search
memberSchema.index({ status: 1, memberName: 1 }); // Compound for filtered sorting

// Backs the member-search box across getAllMembers (shared + mortuary admin)
// and the Treasurer's balance search. These all used an unanchored,
// case-insensitive $regex $or — measured via explain() at 10,000 members:
// COLLSCAN, 10,000 docs examined to return 20, and it can't use any of the
// single-field indexes above regardless, since only a prefix-anchored regex
// can use a B-tree index. A $text index scales with result size instead of
// collection size, at the cost of a real semantics change: it matches whole
// tokens (word- and punctuation-split, e.g. "MEM-123456" tokenizes to
// "mem"/"123456"), not arbitrary substrings — "mar" no longer matches
// "Maria", and a partial memberId/phone fragment no longer matches either.
// language: 'none' disables stemming and the English stop-word list (which
// would otherwise silently drop short common words like "a"/"the" from a
// search) — plain whole-token matching is more predictable for names,
// addresses, and identifiers than linguistic stemming would be.
memberSchema.index(
  { memberName: 'text', memberId: 'text', email: 'text', phoneNumber: 'text', address: 'text', beneficiaries: 'text' },
  { name: 'member_search_text', default_language: 'none' }
);

module.exports = mongoose.model('Member', memberSchema);
