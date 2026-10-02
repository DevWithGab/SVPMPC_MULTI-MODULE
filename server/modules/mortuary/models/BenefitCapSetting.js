const mongoose = require('mongoose');

// Admin-configurable death-benefit cap (see config/claimBenefit.js for how
// it's applied). Same versioned shape as DeductionSetting — "Update Cap"
// never overwrites, it supersedes the current active row and inserts a new
// one, so past claims' resolved payout/cap always matches what was in force
// when they were released.
const benefitCapSettingSchema = new mongoose.Schema(
  {
    settingId: {
      type: String,
      unique: true,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'superseded'],
      default: 'active',
    },
    description: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    supersededBy: {
      type: String,
    },
    supersededAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

benefitCapSettingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
benefitCapSettingSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('BenefitCapSetting', benefitCapSettingSchema);
