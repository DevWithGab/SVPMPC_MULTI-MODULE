const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { supersedeAndInsert } = require('../../../shared/utils/versionedSetting');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

/* Ang noticeBodyTemplate/finalNoticeBodyTemplate ay may HTML na direkta galing sa
in-app document editor ng admin - dumadaan na ito sa DOMPurify (totoong HTML parser,
allowlist-based) sa client side bago pa ito maipadala, pero hindi dapat umasa lang
dun ang server. Ito yung regex pass bilang defense-in-depth backstop, hindi primary
defense - dati required nito ang literal space bago `on\w+=` at quoted value, kaya
nakakalusot ang unquoted (`onerror=alert(1)`) o slash-separated (`<img/onerror=...>`)
attributes. Hindi kaya ng regex na gayahin fully ang HTML parser, kaya hindi pa rin
ito substitute sa DOMPurify; basta kailangan lang walang known holes. */
const sanitizeNoticeHtml = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|form|base|meta)\b[^>]*>/gi, '')
    /* Event-handler attributes - puwedeng whitespace O slash ang separator bago
    `on\w+=` (valid HTML yung `<img/onerror=...>`), at puwedeng double-quoted,
    single-quoted, o unquoted ang value. */
    .replace(/[\s/]+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/[\s/]+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/[\s/]+on\w+\s*=\s*[^\s"'`>/]+/gi, '')
    .replace(/(href|src|data|action)\s*=\s*(["'])\s*(javascript|data):[^"']*\2/gi, '$1=$2#$2');

/* Defaults na tumutugma sa hardcoded values na ginamit ng balance-notice letter bago
pa magexist ang settings collection na ito (client/src/utils/balanceNotice.js). Ang
noticeBodyTemplate/finalNoticeBodyTemplate ay may buong letter - title, fields,
salutation, body, at signatures - bilang admin-editable plain text. Pinaghihiwalay
ng blank line ang mga paragraph; sinasalpakan ng placeholders per member sa print
time: {noticeLabel} {name} {address} {passbook} {balance} {amountNeeded}
{targetBalance} {managerName}. Yung logo/org-name letterhead sa itaas lang ng text
na ito ang hindi parte ng template. */
const DEFAULT_THRESHOLDS = {
  targetBalance: 1000,
  notice1Min: 700,
  notice1Max: 900,
  notice2Min: 300,
  notice2Max: 699,
  noticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No.: {passbook}\n\nSir/Madam:\n\nThis is to inform you that your deposit under the Mortuary Aid Fund Program has only a balance of {balance}. Please make an additional deposit of {amountNeeded} immediately to make your current balance of {targetBalance} from receipt of this notice to enjoy the benefit of this program.\n\nThank you and God Bless!\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
  finalNoticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No: {passbook}\n\nSir/Madam:\n\nThis is to inform you that you have {balance} deposits in the Mortuary Aid Fund Program. Kindly replenish or deposit {amountNeeded} in your mortuary fund within (30) days to maintain your membership in the said program.\n\nFailure to do so will automatically drop you from the program.\n\nPlease be guided and updated accordingly.\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
};

/* Kinukuha dito yung currently active thresholds. Auto-seeds ng default row sa first
call para hindi na kailangan ng manual migration/seed script para alisin yung lumang
hardcoded constants. */
const getCurrentThresholds = async (req, res) => {
  try {
    let current = await NoticeThresholdSetting.findOne({ status: 'active' });

    if (!current) {
      current = new NoticeThresholdSetting({
        settingId: uuidv4(),
        ...DEFAULT_THRESHOLDS,
        effectiveDate: new Date(),
        status: 'active',
        description: 'Default thresholds (auto-seeded)',
      });
      await current.save();
    }

    res.status(200).json({ success: true, data: current });
  } catch (error) {
    console.error('Error fetching current notice thresholds:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current notice thresholds',
      error: safeErrorMessage(error),
    });
  }
};

// View Threshold History
const getThresholdHistory = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    const total = await NoticeThresholdSetting.countDocuments();
    const history = await NoticeThresholdSetting.find()
      .sort({ effectiveDate: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(history, total, page, limit));
  } catch (error) {
    console.error('Error fetching notice threshold history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notice threshold history',
      error: safeErrorMessage(error),
    });
  }
};

/* Update Thresholds - hindi ito nag-overwrite, nagsupersede sa current active row at
nag-insert ng bago (board-approval-style versioning, parehong pattern ng
DeductionSetting). */
const updateThresholds = async (req, res) => {
  try {
    const {
      targetBalance, notice1Min, notice1Max, notice2Min, notice2Max,
      noticeBodyTemplate, finalNoticeBodyTemplate,
      noticeMessageTemplate, finalNoticeMessageTemplate,
      noticeManagerName,
      effectiveDate, description,
    } = req.body;
    const updatedBy = req.user?.username || 'admin';
    if (noticeManagerName !== undefined && (typeof noticeManagerName !== 'string' || !noticeManagerName.trim() || noticeManagerName.trim().length > 100 || /[\r\n]/.test(noticeManagerName))) {
      return res.status(400).json({ success: false, message: 'Enter a manager name of up to 100 characters on one line.' });
    }
    for (const value of [noticeMessageTemplate, finalNoticeMessageTemplate]) {
      if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 10000)) {
        return res.status(400).json({ success: false, message: 'Notice messages must contain text and be no longer than 10,000 characters.' });
      }
    }

    if (!noticeBodyTemplate || !noticeBodyTemplate.trim()) {
      return res.status(400).json({ success: false, message: 'Notice 1 & 2 letter content is required' });
    }
    if (!finalNoticeBodyTemplate || !finalNoticeBodyTemplate.trim()) {
      return res.status(400).json({ success: false, message: 'Final Notice letter content is required' });
    }

    const parsed = {
      targetBalance: parseFloat(targetBalance),
      notice1Min: parseFloat(notice1Min),
      notice1Max: parseFloat(notice1Max),
      notice2Min: parseFloat(notice2Min),
      notice2Max: parseFloat(notice2Max),
    };

    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined || value === null || isNaN(value)) {
        return res.status(400).json({ success: false, message: `A valid number is required for "${key}"` });
      }
    }

    if (parsed.targetBalance <= 0) {
      return res.status(400).json({ success: false, message: 'Target balance must be greater than 0' });
    }
    if (parsed.notice2Min < 0) {
      return res.status(400).json({ success: false, message: 'Notice 2 minimum cannot be negative' });
    }
    if (parsed.notice2Max < parsed.notice2Min) {
      return res.status(400).json({ success: false, message: 'Notice 2 maximum must be greater than or equal to its minimum' });
    }
    if (parsed.notice1Min <= parsed.notice2Max) {
      return res.status(400).json({ success: false, message: 'Notice 1 minimum must be greater than Notice 2 maximum' });
    }
    if (parsed.notice1Max < parsed.notice1Min) {
      return res.status(400).json({ success: false, message: 'Notice 1 maximum must be greater than or equal to its minimum' });
    }

    /* I-revalidate lang yung fields na talagang nagbabago kapag nagsupersede - yung row na
    na-save bago pa magkaroon ng schema change (hal. bago pa magexist ang
    noticeBodyTemplate/finalNoticeBodyTemplate) dapat pa ring supersede-able kahit hindi
    na ito papasa sa full-document validation ngayon. */
    const newSetting = await supersedeAndInsert(NoticeThresholdSetting, () => new NoticeThresholdSetting({
      settingId: uuidv4(),
      ...parsed,
      noticeBodyTemplate: sanitizeNoticeHtml(noticeBodyTemplate.trim()),
      finalNoticeBodyTemplate: sanitizeNoticeHtml(finalNoticeBodyTemplate.trim()),
      noticeMessageTemplate: noticeMessageTemplate?.trim(),
      finalNoticeMessageTemplate: finalNoticeMessageTemplate?.trim(),
      noticeManagerName: noticeManagerName?.trim(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    }), { validateModifiedOnly: true, preserveFields: ['noticeMessageTemplate', 'finalNoticeMessageTemplate', 'noticeManagerName'] });

    res.status(201).json({
      success: true,
      message: 'Notice thresholds updated successfully',
      data: newSetting,
    });
  } catch (error) {
    console.error('Error updating notice thresholds:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notice thresholds',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  getCurrentThresholds,
  getThresholdHistory,
  updateThresholds,
  sanitizeNoticeHtml,
};
