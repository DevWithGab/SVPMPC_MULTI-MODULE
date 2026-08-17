const DeductionSetting = require('../models/DeductionSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');

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
      error: error.message,
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
      error: error.message,
    });
  }
};

// Update Deduction Rate — never overwrites, supersedes the current active
// row and inserts a new one (board-approval-style versioning).
const updateRate = async (req, res) => {
  try {
    const { amount, effectiveDate, description } = req.body;
    const updatedBy = req.body.createdBy || req.user?.username || 'admin';

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid deduction amount greater than 0 is required',
      });
    }

    const newSetting = new DeductionSetting({
      settingId: uuidv4(),
      amount: parsedAmount,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    });

    const currentActive = await DeductionSetting.findOne({ status: 'active' });
    if (currentActive) {
      currentActive.status = 'superseded';
      currentActive.supersededBy = newSetting.settingId;
      currentActive.supersededAt = new Date();
      await currentActive.save();
    }

    await newSetting.save();

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
      error: error.message,
    });
  }
};

module.exports = {
  getCurrentRate,
  getRateHistory,
  updateRate,
};
