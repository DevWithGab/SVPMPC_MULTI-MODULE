const mongoose = require('mongoose');

const noticeThresholdSettingSchema = new mongoose.Schema(
  {
    settingId: {
      type: String,
      unique: true,
      required: true,
    },
    // The sustaining balance goal referenced in the printed notice letter
    // (e.g. "deposit enough to reach ₱1,000"). Independent of the notice
    // ranges below — raising or lowering it does not automatically shift
    // where Notice 1/2/Final kick in.
    targetBalance: {
      type: Number,
      required: true,
    },
    // Notice 1 fires for balances in [notice1Min, notice1Max].
    notice1Min: {
      type: Number,
      required: true,
    },
    notice1Max: {
      type: Number,
      required: true,
    },
    // Notice 2 fires for balances in [notice2Min, notice2Max]. Anything
    // below notice2Min gets the Final Notice; anything above notice1Max
    // (and not already caught by Notice 1) needs no notice.
    notice2Min: {
      type: Number,
      required: true,
    },
    notice2Max: {
      type: Number,
      required: true,
    },
    // The ENTIRE letter — title, fields, salutation, body, and signatures —
    // shared by Notice 1 and Notice 2, as admin-editable plain text.
    // Paragraphs are separated by a blank line; placeholders substituted
    // per-member at print time: {noticeLabel} {name} {address} {passbook}
    // {balance} {amountNeeded} {targetBalance} {managerName}. Only the
    // logo/org-name letterhead above this text is not part of the template.
    noticeBodyTemplate: {
      type: String,
      required: true,
    },
    // Same shape as noticeBodyTemplate, for the Final Notice (level 3) —
    // kept separate since its wording (warning of being dropped from the
    // program) is materially different from Notice 1/2.
    finalNoticeBodyTemplate: {
      type: String,
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

// "Update Thresholds" supersedes the currently-active row and inserts a new
// one — this partial unique index enforces "at most one active row" at the
// DB level, same technique used for DeductionSetting.
noticeThresholdSettingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
noticeThresholdSettingSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('NoticeThresholdSetting', noticeThresholdSettingSchema);
