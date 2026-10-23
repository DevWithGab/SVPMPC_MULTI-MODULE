const mongoose = require('mongoose');

const noticeThresholdSettingSchema = new mongoose.Schema(
  {
    settingId: {
      type: String,
      unique: true,
      required: true,
    },
    /* Ito ang sustaining balance goal na nirereference sa printed notice letter (hal.
    "deposit enough to reach ₱1,000"). Independent ito sa notice ranges sa baba -
    hindi otomatikong nagbabago ang kinikick-in ng Notice 1/2/Final kung
    itataas o ibababa ito. */
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
    /* Fire ang Notice 2 para sa balances sa [notice2Min, notice2Max]. Kung mas mababa
    pa sa notice2Min, makukuha ang Final Notice; kung mas mataas sa notice1Max (at
    hindi pa nahuli ng Notice 1), wala nang kailangang notice. */
    notice2Min: {
      type: Number,
      required: true,
    },
    notice2Max: {
      type: Number,
      required: true,
    },
    /* Ito ang BUONG letter - title, fields, salutation, body, at signatures - na
    shared ng Notice 1 at Notice 2, bilang admin-editable plain text. Pinaghihiwalay
    ng blank line ang mga paragraph; sinasalpakan ng placeholders per-member sa print
    time: {noticeLabel} {name} {address} {passbook} {balance} {amountNeeded}
    {targetBalance} {managerName}. Yung logo/org-name letterhead sa itaas lang ng
    text na ito ang hindi parte ng template. */
    noticeBodyTemplate: {
      type: String,
      required: true,
    },
    /* Parehong shape ng noticeBodyTemplate, para sa Final Notice (level 3) -
    hiniwalay dahil materially different ang wording nito (warning ng pagkakadrop
    sa program) kumpara sa Notice 1/2. */
    finalNoticeBodyTemplate: {
      type: String,
      required: true,
    },
    /* Editable message sa loob ng official cooperative form. Gagamitin ang official
    wording kung walang value; naiiwan pa rin ang legacy whole-document templates. */
    noticeMessageTemplate: { type: String },
    finalNoticeMessageTemplate: { type: String },
    noticeManagerName: { type: String, trim: true, maxlength: 100 },
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

/* Nagsusupersede ang "Update Thresholds" sa currently-active row at nagiinsert
ng bago - ang partial unique index na ito ang nagpapatupad ng "at most one
active row" sa DB level, parehong technique na ginamit para sa DeductionSetting. */
noticeThresholdSettingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
noticeThresholdSettingSchema.index({ effectiveDate: -1 });

module.exports = mongoose.model('NoticeThresholdSetting', noticeThresholdSettingSchema);
