const BenefitCapSetting = require('../models/BenefitCapSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { DEFAULT_MAX_BENEFIT_AMOUNT } = require('../config/claimBenefit');

// Get the currently active benefit cap. Auto-seeds a default row (matching
// the value the hardcoded constant used before this settings screen
// existed) on first call so no manual migration/seed script is needed.
const getCurrentCap = async (req, res) => {
  try {
    let current = await BenefitCapSetting.findOne({ status: 'active' });

    if (!current) {
      current = new BenefitCapSetting({
        settingId: uuidv4(),
        amount: DEFAULT_MAX_BENEFIT_AMOUNT,
        effectiveDate: new Date(),
        status: 'active',
        description: 'Default cap (auto-seeded)',
      });
      await current.save();
    }

    res.status(200).json({ success: true, data: current });
  } catch (error) {
    console.error('Error fetching current benefit cap:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching current benefit cap',
      error: error.message,
    });
  }
};

const getCapHistory = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);

    const total = await BenefitCapSetting.countDocuments();
    const history = await BenefitCapSetting.find()
      .sort({ effectiveDate: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(history, total, page, limit));
  } catch (error) {
    console.error('Error fetching benefit cap history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching benefit cap history',
      error: error.message,
    });
  }
};

// Update Benefit Cap — never overwrites, supersedes the current active row
// and inserts a new one (board-approval-style versioning, same pattern as
// DeductionSetting).
const updateCap = async (req, res) => {
  try {
    const { amount, effectiveDate, description } = req.body;
    const updatedBy = req.body.createdBy || req.user?.username || 'admin';

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid benefit cap greater than 0 is required',
      });
    }

    const newSetting = new BenefitCapSetting({
      settingId: uuidv4(),
      amount: parsedAmount,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    });

    const currentActive = await BenefitCapSetting.findOne({ status: 'active' });
    if (currentActive) {
      currentActive.status = 'superseded';
      currentActive.supersededBy = newSetting.settingId;
      currentActive.supersededAt = new Date();
      await currentActive.save();
    }

    await newSetting.save();

    res.status(201).json({
      success: true,
      message: 'Benefit cap updated successfully',
      data: newSetting,
    });
  } catch (error) {
    console.error('Error updating benefit cap:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating benefit cap',
      error: error.message,
    });
  }
};

module.exports = {
  getCurrentCap,
  getCapHistory,
  updateCap,
};
