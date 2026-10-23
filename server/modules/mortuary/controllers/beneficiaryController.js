const Beneficiary = require('../models/Beneficiary');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { parseBeneficiaryCsv } = require('../utils/beneficiaryCsv');
const { createBeneficiaryImportService } = require('../services/beneficiaryImportService');

const beneficiaryImportService = createBeneficiaryImportService({ Member, Beneficiary });

const summarizeBeneficiaryImport = rows => ({
  total: rows.length,
  ready: rows.filter(row => row.status === 'ready').length,
  invalid: rows.filter(row => row.status === 'error').length,
  imported: rows.filter(row => row.status === 'imported').length,
  failed: rows.filter(row => row.status === 'failed').length,
});

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* PH mobile numbers: 11 digits, nagsisimula sa 09 (e.g. 09171234567). Mirror
ito ng client-side check sa client/src/utils/validation.js - ito yung backstop
para sa requests na hindi dumadaan sa form na yun (direct API calls). */
const PH_PHONE_REGEX = /^09\d{9}$/;

/* View Beneficiaries - isang row per active member, ipinapakita kung sino
man yung current beneficiary nila on file.

Member-centric ito sa halip na Beneficiary-record-centric: may mga active
members na free text lang nakuha yung beneficiary nila noong registration
(Member.beneficiaries/beneficiaryRelationship) at hindi dumaan sa structured
"Update Beneficiary" flow, kaya walang row sila sa Beneficiary collection.
Sa pagsimula sa Member at left-join sa current structured record nila
(babalik sa legacy free-text fields kung walang record), lahat ng active
member ay lumalabas dito, tugma sa pinapangako ng screen's own subtitle -
"current beneficiary on file for each member" - at makikita ng admin kaagad
kung sino pa yung dapat i-formally register. */
const getAllBeneficiaries = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const search = (req.query.search || '').trim();

    const pipeline = [
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: Beneficiary.collection.name,
          let: { mid: '$memberId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$memberId', '$$mid'] }, { $eq: ['$isActive', true] }] } } },
            { $limit: 1 },
          ],
          as: 'beneficiaryRecord',
        },
      },
      { $addFields: { beneficiaryRecord: { $arrayElemAt: ['$beneficiaryRecord', 0] } } },
      {
        $project: {
          _id: 0,
          memberId: 1,
          memberName: 1,
          beneficiaryId: '$beneficiaryRecord.beneficiaryId',
          beneficiaryName: { $ifNull: ['$beneficiaryRecord.beneficiaryName', '$beneficiaries'] },
          relationship: { $ifNull: ['$beneficiaryRecord.relationship', '$beneficiaryRelationship'] },
          contactNumber: '$beneficiaryRecord.contactNumber',
          address: '$beneficiaryRecord.address',
          isRegistered: { $toBool: { $ifNull: ['$beneficiaryRecord.beneficiaryId', false] } },
        },
      },
    ];

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      pipeline.push({
        $match: {
          $or: [
            { memberName: searchRegex },
            { memberId: searchRegex },
            { beneficiaryName: searchRegex },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { memberName: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      }
    );

    const [result] = await Member.aggregate(pipeline);
    const beneficiaries = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    res.status(200).json(buildPaginatedResponse(beneficiaries, total, page, limit));
  } catch (error) {
    console.error('Error fetching beneficiaries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beneficiaries',
      error: safeErrorMessage(error),
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
      error: safeErrorMessage(error),
    });
  }
};

/* Update Beneficiary Information - pinapalitan yung current active record
(kung meron) at nagdadagdag ng bago. Ginagamit din para i-register yung
first beneficiary ng member, dahil hindi na ginagamit yung
Member.beneficiaries (free text). */
const updateBeneficiary = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { beneficiaryName, relationship, contactNumber, address, notes } = req.body;
    const updatedBy = req.user?.username || 'admin';

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
      error: safeErrorMessage(error),
    });
  }
};

/* Bulk Register Beneficiaries - parehong preview-then-import CSV contract
gaya ng treasurer's bulk payment/ledger uploads (action: 'preview' | 'import'). */
const bulkUploadBeneficiaries = async (req, res) => {
  let rows;
  try {
    if (!['preview', 'import'].includes(req.body.action)) throw new Error('Choose preview or import.');
    rows = parseBeneficiaryCsv(req.body.csv);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  try {
    const updatedBy = req.user?.username || 'admin';
    if (req.body.action === 'preview') {
      const checked = await beneficiaryImportService.preview(rows);
      return res.json({ success: true, rows: checked, summary: summarizeBeneficiaryImport(checked) });
    }
    const result = await beneficiaryImportService.importRows(rows, updatedBy);
    return res.status(result.blocked ? 400 : 200).json({
      success: !result.blocked,
      rows: result.rows,
      summary: summarizeBeneficiaryImport(result.rows),
      message: result.blocked ? 'Fix the listed errors before importing. No beneficiaries were registered.' : 'Beneficiary import processed.',
    });
  } catch (error) {
    console.error('Bulk beneficiary request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to process the CSV. Retry with the same file; completed rows will register again as an update.' });
  }
};

module.exports = {
  getAllBeneficiaries,
  getBeneficiaryHistory,
  updateBeneficiary,
  bulkUploadBeneficiaries,
};
