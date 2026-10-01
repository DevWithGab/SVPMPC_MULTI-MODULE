const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');

// Defaults matching the hardcoded values the balance-notice letter used
// before this settings collection existed (client/src/utils/balanceNotice.js).
// noticeBodyTemplate/finalNoticeBodyTemplate hold the ENTIRE letter — title,
// fields, salutation, body, and signatures — as admin-editable plain text.
// Paragraphs are separated by a blank line; placeholders substituted per
// member at print time: {noticeLabel} {name} {address} {passbook} {balance}
// {amountNeeded} {targetBalance} {managerName}. Only the logo/org-name
// letterhead above this text is not part of the template.
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

// Get the currently active thresholds. Auto-seeds a default row on first
// call so no manual migration/seed script is needed to retire the old
// hardcoded constants.
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
      error: error.message,
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
      error: error.message,
    });
  }
};

// Update Thresholds — never overwrites, supersedes the current active row
// and inserts a new one (board-approval-style versioning, same pattern as
// DeductionSetting).
const updateThresholds = async (req, res) => {
  try {
    const {
      targetBalance, notice1Min, notice1Max, notice2Min, notice2Max,
      noticeBodyTemplate, finalNoticeBodyTemplate,
      effectiveDate, description,
    } = req.body;
    const updatedBy = req.body.createdBy || req.user?.username || 'admin';

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

    const newSetting = new NoticeThresholdSetting({
      settingId: uuidv4(),
      ...parsed,
      noticeBodyTemplate: noticeBodyTemplate.trim(),
      finalNoticeBodyTemplate: finalNoticeBodyTemplate.trim(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    });

    const currentActive = await NoticeThresholdSetting.findOne({ status: 'active' });
    if (currentActive) {
      currentActive.status = 'superseded';
      currentActive.supersededBy = newSetting.settingId;
      currentActive.supersededAt = new Date();
      // Only re-validate the fields actually being changed — a row saved
      // before a schema change (e.g. before noticeBodyTemplate/
      // finalNoticeBodyTemplate existed) must still be supersede-able even
      // though it wouldn't pass full-document validation today.
      await currentActive.save({ validateModifiedOnly: true });
    }

    await newSetting.save();

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
      error: error.message,
    });
  }
};

module.exports = {
  getCurrentThresholds,
  getThresholdHistory,
  updateThresholds,
};
