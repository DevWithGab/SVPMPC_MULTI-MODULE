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
    /* Kung tinatanggap pa ba ang isang generated QR para sa scanning. Hiwalay
    ito sa shared `status` field sa baba (active/inactive/deceased/staff) -
    yung field na iyon nag-drive din ng Mortuary module, kaya kapag
    na-deactivate dito yung QR, hindi dapat maapektuhan ang status niyan. */
    qrCodeActive: {
      type: Boolean,
      default: true,
    },
    // Mortuary-specific fields
    beneficiaries: {
      type: String,
      default: '',
    },
    /* Free-text relationship ng beneficiary sa member na ito (e.g. "Spouse",
    "Child") - kinukuha na agad sa registration para hindi na ito ang unang
    tanong pag dumating yung death claim sa future. Hindi ito yung structured
    Beneficiary record na ginagamit kapag na-file na talaga ang claim. */
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
    // Shared cooperative membership. Staff module permissions live on User.
    modules: {
      type: [String],
      default: ['attendance', 'mortuary'],
      enum: ['attendance', 'mortuary'],
    },
  },
  { timestamps: true }
);

/* Lahat ng bagong rehistradong member participate sa both services, kahit
anong portal/import gumawa sa kanila o anumang client-supplied module
selection. */
memberSchema.pre('validate', function () {
  if (this.isNew) this.modules = ['attendance', 'mortuary'];
});

// Index for faster queries
// Note: memberId already has unique index from schema definition
/* Optional yung email (puwede gawin yung member na walang email, naka-store
bilang '') - kung plain unique index lang, mare-reject yung second member na
gagawin na blank din ang email, kaya yung uniqueness enforced lang sa mga
member na may non-blank na email talaga. Ito mismo yung talagang nag-prevent
ng dalawang concurrent create-member requests para sa parehong email na
pareho mag-succeed - yung findOne precheck sa adminController.js ay first
pass lang na mas mabilis at friendly pero puwede matalo sa race (same class
ng bug na na-close na dati para sa staff usernames via User.username's own
unique index). */
memberSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
);
memberSchema.index({ status: 1 });
memberSchema.index({ memberName: 1 }); // For search and sorting
memberSchema.index({ barangay: 1 }); // For barangay filtering
memberSchema.index({ phoneNumber: 1 }); // For search
memberSchema.index({ status: 1, memberName: 1 }); // Compound for filtered sorting

/* Ito ang backing ng member-search box sa getAllMembers (shared + mortuary
admin) at sa Treasurer's balance search. Dati gumagamit ito ng unanchored,
case-insensitive $regex $or - measured via explain() sa 10,000 members:
COLLSCAN, 10,000 docs examined para lang makabalik ng 20, at hindi niya
magamit yung mga single-field indexes sa taas kasi prefix-anchored regex
lang talaga ang puwedeng gumamit ng B-tree index. Yung $text index naman
scales base sa result size imbes na collection size, pero may real semantics
change: nagmamatch ito ng whole tokens (word- and punctuation-split, e.g.
"MEM-123456" nagiging "mem"/"123456"), hindi na arbitrary substrings - kaya
"mar" hindi na magmamatch sa "Maria", at hindi na magmamatch din ang partial
memberId/phone fragment. Yung language: 'none' nag-disable ng stemming at ng
English stop-word list (na kung hindi, puwedeng tahimik na i-drop yung mga
short common words tulad ng "a"/"the" sa search) - mas predictable yung plain
whole-token matching para sa names, addresses, at identifiers kaysa sa
linguistic stemming. */
memberSchema.index(
  { memberName: 'text', memberId: 'text', email: 'text', phoneNumber: 'text', address: 'text', beneficiaries: 'text' },
  { name: 'member_search_text', default_language: 'none' }
);

module.exports = mongoose.model('Member', memberSchema);
