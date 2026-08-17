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

// "Update Rate" supersedes the currently-active row and inserts a new one —
// this partial unique index enforces "at most one active row" at the DB
// level, the same technique used for staffId uniqueness in shared/models/User.js.
deductionSettingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
deductionSettingSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('DeductionSetting', deductionSettingSchema);
