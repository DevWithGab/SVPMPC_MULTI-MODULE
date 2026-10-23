const mongoose = require('mongoose');

const deductionSettingSchema = new mongoose.Schema(
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

/* Nagsusupersede ang "Update Rate" sa currently-active row at nagiinsert ng bago -
ang partial unique index na ito ang nagpapatupad ng "at most one active row" sa
DB level, parehong technique na ginamit para sa staffId uniqueness sa
shared/models/User.js. */
deductionSettingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
deductionSettingSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('DeductionSetting', deductionSettingSchema);
