const Beneficiary = require('../models/Beneficiary');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// PH mobile numbers: 11 digits, starting with 09 (e.g. 09171234567). Mirrors
// the client-side check in client/src/utils/validation.js — this is the
// backstop for requests that don't go through that form (direct API calls).
const PH_PHONE_REGEX = /^09\d{9}$/;

// View Beneficiaries — current (active) ones by default
const getAllBeneficiaries = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const search = (req.query.search || '').trim();

    const query = { isActive: true };
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { memberName: searchRegex },
        { memberId: searchRegex },
        { beneficiaryName: searchRegex },
      ];
    }

    const total = await Beneficiary.countDocuments(query);
    const beneficiaries = await Beneficiary.find(query)
      .sort({ memberName: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(beneficiaries, total, page, limit));
  } catch (error) {
    console.error('Error fetching beneficiaries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiaries',
      error: error.message,
    });
  }
};

// View Beneficiary History — every version ever recorded for a member
const getBeneficiaryHistory = async (req, res) => {
  try {
    const { memberId } = req.params;

    const history = await Beneficiary.find({ memberId }).sort({ effectiveFrom: -1 });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching beneficiary history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiary history',
      error: error.message,
    });
  }
};

// Update Beneficiary Information — supersedes the current active record (if
// any) and inserts a new one. Also used to register a member's first
// beneficiary, since Member.beneficiaries (free text) is no longer written to.
const updateBeneficiary = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { beneficiaryName, relationship, contactNumber, address, notes } = req.body;
    const updatedBy = req.body.updatedBy || req.user?.username || 'admin';

    if (!beneficiaryName || !relationship || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary name, relationship, and contact number are required',
      });
    }

    if (!PH_PHONE_REGEX.test(contactNumber.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Contact number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567)',
      });
    }

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const currentActive = await Beneficiary.findOne({ memberId, isActive: true });
    if (currentActive) {
      currentActive.isActive = false;
      currentActive.effectiveTo = new Date();
      await currentActive.save();
    }

    const newBeneficiary = new Beneficiary({
      beneficiaryId: uuidv4(),
      memberId,
      memberName: member.memberName,
      beneficiaryName,
      relationship,
      contactNumber,
      address,
      notes,
      isActive: true,
      effectiveFrom: new Date(),
      updatedBy,
    });

    await newBeneficiary.save();

    res.status(201).json({
      success: true,
      message: 'Beneficiary information updated successfully',
      data: newBeneficiary,
    });
  } catch (error) {
    console.error('Error updating beneficiary:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating beneficiary',
      error: error.message,
    });
  }
};

module.exports = {
  getAllBeneficiaries,
  getBeneficiaryHistory,
  updateBeneficiary,
};
