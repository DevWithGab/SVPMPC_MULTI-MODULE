const mongoose = require('mongoose');

// Admin-configurable list of physical documents a claim must collect before
// it can be approved (e.g. Death Certificate, Member's Cooperative ID).
// `key` is derived once from the label at creation time and never changes —
// it's what each Claim.requirements Map entry is keyed by, so renaming a
// requirement later (editing `label`) doesn't orphan any claim that already
// snapshotted it. Deleting a row here is a plain hard delete: it only stops
// new claims from including it going forward, it never touches a claim's
// already-stored requirements data (see Claim.js).
const claimRequirementSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClaimRequirement', claimRequirementSchema);
