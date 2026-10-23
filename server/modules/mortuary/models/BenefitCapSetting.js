const mongoose = require('mongoose');

/* Admin-configurable death-benefit cap ito (tingnan ang config/claimBenefit.js kung
paano ito ina-apply). Parehong versioned shape ng DeductionSetting - hindi
nag-overwrite ang "Update Cap", nagsupersede ito sa current active row at
nag-insert ng bago, kaya tugma pa rin ang resolved payout/cap ng past claims sa
kung ano talaga ang nasa force nung mga narelease sila. */
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
