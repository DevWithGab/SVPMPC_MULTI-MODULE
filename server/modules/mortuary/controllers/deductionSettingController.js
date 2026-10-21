const DeductionSetting = require('../models/DeductionSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { supersedeAndInsert } = require('../../../shared/utils/versionedSetting');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Default rate used to auto-seed the first DeductionSetting row, matching the
// value the hardcoded DEDUCTION_AMOUNT constant in deductionController.js used
// before this settings collection existed.
const DEFAULT_DEDUCTION_AMOUNT = 25;

// Get the currently active deduction rate. Auto-seeds a default row on first
// call so no manual migration/seed script is needed to retire the old constant.
const getCurrentRate = async (req, res) => {
  try {
    let current = await DeductionSetting.findOne({ status: 'active' });

    if (!current) {
      current = new DeductionSetting({
        settingId: uuidv4(),
        amount: DEFAULT_DEDUCTION_AMOUNT,
        effectiveDate: new Date(),
        status: 'active',
        description: 'Default rate (auto-seeded)',
      });
      await current.save();
    }

    res.status(200).json({ success: true, data: current });
  } catch (error) {
    console.error('Error fetching current deduction rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current deduction rate',
      error: safeErrorMessage(error),
    });
  }
};

// View Deduction Rate History
const getRateHistory = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    const total = await DeductionSetting.countDocuments();
    const history = await DeductionSetting.find()
      .sort({ effectiveDate: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(history, total, page, limit));
  } catch (error) {
    console.error('Error fetching deduction rate history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deduction rate history',
      error: safeErrorMessage(error),
    });
  }
};

// Update Deduction Rate — never overwrites, supersedes the current active
// row and inserts a new one (board-approval-style versioning).
const updateRate = async (req, res) => {
  try {
    const { amount, effectiveDate, description } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const value = typeof amount === 'string' || typeof amount === 'number' ? String(amount).trim() : '';
    const validFormat = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value);
    const parsedAmount = Number(value.replaceAll(',', ''));
    if (!validFormat || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Enter a deduction amount greater than 0, such as 10,000 or 10,000.50. Use digits, optional thousands commas, and up to 2 decimal places; letters are not allowed.',
      });
    }

    const newSetting = await supersedeAndInsert(DeductionSetting, () => new DeductionSetting({
      settingId: uuidv4(),
      amount: parsedAmount,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    }));

    res.status(201).json({
      success: true,
      message: 'Deduction rate updated successfully',
      data: newSetting,
    });
  } catch (error) {
    console.error('Error updating deduction rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating deduction rate',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  getCurrentRate,
  getRateHistory,
  updateRate,
};
