const BenefitCapSetting = require('../models/BenefitCapSetting');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { DEFAULT_MAX_BENEFIT_AMOUNT } = require('../config/claimBenefit');
const { supersedeAndInsert } = require('../../../shared/utils/versionedSetting');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

/* Kinukuha yung currently active benefit cap. Auto-seeds ng default row
(tumutugma sa value na ginamit ng hardcoded constant bago pa magkaroon ng
settings screen na ito) sa first call para hindi na kailangan ng manual
migration/seed script. */
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
      error: safeErrorMessage(error),
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
      error: safeErrorMessage(error),
    });
  }
};

/* Update Benefit Cap - hindi ito nag-overwrite, sino-supersede yung current
active row at nagdadagdag ng bago (board-approval-style versioning, parehong
pattern ng DeductionSetting). */
const updateCap = async (req, res) => {
  try {
    const { amount, effectiveDate, description } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const value = typeof amount === 'string' || typeof amount === 'number' ? String(amount).trim() : '';
    const validFormat = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value);
    const parsedAmount = Number(value.replaceAll(',', ''));
    if (!validFormat || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Enter a benefit cap greater than 0, such as 10,000 or 10,000.50. Use digits, optional thousands commas, and up to 2 decimal places; letters are not allowed.',
      });
    }

    const newSetting = await supersedeAndInsert(BenefitCapSetting, () => new BenefitCapSetting({
      settingId: uuidv4(),
      amount: parsedAmount,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      status: 'active',
      description,
      createdBy: updatedBy,
    }));

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
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  getCurrentCap,
  getCapHistory,
  updateCap,
};
