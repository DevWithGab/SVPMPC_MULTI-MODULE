const Claim = require('../models/Claim');
const Beneficiary = require('../models/Beneficiary');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Register New Claim
const createClaim = async (req, res) => {
  try {
    const { memberId, beneficiaryId, dateOfDeath, causeOfDeath, remarks } = req.body;
    const createdBy = actorName(req.user, 'admin');

    /* Isinasara ng typeof check yung NoSQL operator-injection hole: kung
    crafted body gaya ng {"memberId":{"$ne":null},"beneficiaryId":{"$ne":null},...}
    ay makakapasa sa !memberId truthiness check (truthy yung non-empty object)
    at ginagawang real query operators yung findOne calls sa baba, matching
    kung sino mang member/claim/beneficiary ibalik ng Mongo's query planner
    first sa halip na yung talagang pinangalanan. Hindi naman talaga
    legitimate na hindi string yung alinman sa dalawang fields, kaya tama
    lang na i-reject din ang wrong type dito gaya ng pag-reject sa missing
    one. */
    if (
      !memberId || !beneficiaryId || !dateOfDeath ||
      typeof memberId !== 'string' || typeof beneficiaryId !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Member, beneficiary, and date of death are required',
      });
    }

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    /* Puwedeng i-refile ulit yung rejected claim (yun naman talaga yung
    point ng pag-reject - e.g. wrong requirements, filed sa wrong member),
    pero kailangan i-block yung ibang still-live claim sa member na ito
    kung magfile ulit: kung mag-approve/deduct/release ng dalawang claims
    para sa isang kamatayan, magcharge ng doble sa every other member at
    puwedeng magbayad ng doble. */
    const existingClaim = await Claim.findOne({ memberId, status: { $ne: 'rejected' } });
    if (existingClaim) {
      return res.status(409).json({
        success: false,
        message: `This member already has an active claim (${existingClaim.claimId}, status: ${existingClaim.status}). Reject it before filing a new one.`,
      });
    }

    const beneficiary = await Beneficiary.findOne({ beneficiaryId, memberId });
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found for this member',
      });
    }

    const claim = new Claim({
      claimId: uuidv4(),
      memberId,
      memberName: member.memberName,
      beneficiaryId,
      beneficiaryName: beneficiary.beneficiaryName,
      beneficiaryRelationship: beneficiary.relationship,
      beneficiaryContact: beneficiary.contactNumber,
      dateOfDeath: new Date(dateOfDeath),
      dateFiled: new Date(),
      causeOfDeath,
      remarks,
      status: 'pending_requirements',
      // Requirements are entered for this individual claim during review.
      requirements: new Map(),
      statusHistory: [
        {
          status: 'pending_requirements',
          changedBy: createdBy,
          changedAt: new Date(),
          notes: 'Claim filed',
        },
      ],
      createdBy,
    });

    await claim.save();

    /* Ang pag-file ng claim ay senyales na namatay na yung member - kaya
    flip yung status nila para naturally excluded sila sa death-assessment
    deduction na magtrigger mismo ng claim nila (ang Treasurer ay nagcharge
    lang sa {status:'active'} members). */
    member.status = 'deceased';
    await member.save();

    await createAuditLog({
      userId: req.user?.userId,
      userName: createdBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_created',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim filed for ${claim.memberName}, beneficiary ${claim.beneficiaryName}`,
      changes: { before: null, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Claim registered successfully',
      data: claim,
    });
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating claim',
      error: safeErrorMessage(error),
    });
  }
};

// View Claims — search + filter + pagination
const getAllClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { claimId: searchRegex },
        { memberName: searchRegex },
        { beneficiaryName: searchRegex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ dateFiled: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims',
      error: safeErrorMessage(error),
    });
  }
};

/* Claim Details - member info, beneficiary info, claim details, checklist,
verification info, status history */
const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    const [member, beneficiary] = await Promise.all([
      Member.findOne({ memberId: claim.memberId }),
      Beneficiary.findOne({ beneficiaryId: claim.beneficiaryId }),
    ]);

    res.status(200).json({
      success: true,
      data: { claim, member, beneficiary },
    });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim',
      error: safeErrorMessage(error),
    });
  }
};

/* Physical Requirements Checklist - ang mismong documents ay isinusumite
in person sa cooperative office; dito lang naitatala kung natanggap na at
na-verify na ang bawat isa. */
const updateRequirements = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { requirements } = req.body;

    if (!requirements || typeof requirements !== 'object') {
      return res.status(400).json({ success: false, message: 'Requirements payload is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({ success: false, message: 'Requirements can only be changed while the claim is pending requirements' });
    }

    Object.keys(requirements).forEach((key) => {
      if (claim.requirements.has(key) && requirements[key] && typeof requirements[key] === 'object') {
        claim.requirements.set(key, {
          ...claim.requirements.get(key).toObject(),
          ...requirements[key],
        });
      }
    });

    await claim.save();

    res.status(200).json({
      success: true,
      message: 'Requirements checklist updated',
      data: claim,
    });
  } catch (error) {
    console.error('Error updating requirements checklist:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating requirements checklist',
      error: safeErrorMessage(error),
    });
  }
};

// Add a physical requirement that applies only to this claim.
const addRequirement = async (req, res) => {
  try {
    const { claimId } = req.params;
    const label = String(req.body.label || '').trim();
    if (!label) {
      return res.status(400).json({ success: false, message: 'A requirement label is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({ success: false, message: 'Requirements can only be added while the claim is pending requirements' });
    }

    const baseKey = label
      .replace(/[^a-zA-Z0-9]+(.)?/g, (_, next) => next ? next.toUpperCase() : '')
      .replace(/[^a-zA-Z0-9]/g, '');
    if (!baseKey) {
      return res.status(400).json({ success: false, message: 'Label must contain at least one letter or number' });
    }

    let key = baseKey.charAt(0).toLowerCase() + baseKey.slice(1);
    let suffix = 2;
    while (claim.requirements.has(key)) {
      key = `${baseKey}${suffix}`;
      suffix += 1;
    }

    claim.requirements.set(key, { label });
    claim.markModified('requirements');
    await claim.save();

    res.status(201).json({
      success: true,
      message: 'Requirement added to this claim',
      data: claim,
    });
  } catch (error) {
    console.error('Error adding claim requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding claim requirement',
      error: safeErrorMessage(error),
    });
  }
};

/* Undo a requirement added to this claim by mistake. Only while the claim is
still pending requirements, i.e. before approval or rejection relied on it. */
const removeRequirement = async (req, res) => {
  try {
    const { claimId, requirementKey } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({ success: false, message: 'Requirements can only be removed while the claim is pending requirements' });
    }
    if (!claim.requirements.has(requirementKey)) {
      return res.status(404).json({ success: false, message: 'Requirement not found on this claim' });
    }

    claim.requirements.delete(requirementKey);
    claim.markModified('requirements');
    await claim.save();

    res.status(200).json({
      success: true,
      message: 'Requirement removed from this claim',
      data: claim,
    });
  } catch (error) {
    console.error('Error removing claim requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing claim requirement',
      error: safeErrorMessage(error),
    });
  }
};

// Verification Information
const updateVerification = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { verificationDate, remarks } = req.body;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (req.body.referenceNumber !== undefined) {
      if (!['pending_requirements', 'pending_deduction'].includes(claim.status)) {
        return res.status(400).json({ success: false, message: 'References cannot be changed after deduction begins' });
      }
      if (typeof req.body.referenceNumber !== 'string' || !req.body.referenceNumber.trim() || req.body.referenceNumber.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'A reference number is required (maximum 100 characters)' });
      }
      claim.referenceNumber = req.body.referenceNumber.trim();
    }
    // Record the signed-in staff member's name; username only if no name is set.
    claim.verification = {
      verifiedBy: actorName(req.user, 'admin'),
      verificationDate: verificationDate ? new Date(verificationDate) : new Date(),
      remarks,
    };

    await claim.save();

    res.status(200).json({
      success: true,
      message: 'Verification information saved',
      data: claim,
    });
  } catch (error) {
    console.error('Error updating verification information:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating verification information',
      error: safeErrorMessage(error),
    });
  }
};

/* Approve Claim - legal lang ito kapag naisumite na ang lahat ng requirement
item. Lumilipat agad galing approved papuntang pending_deduction para
makuha agad ng Treasurer's "notification" (live query para sa
pending_deduction claims) ito. */
const approveClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const approvedBy = actorName(req.user, 'admin');

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be approved from status "${claim.status}"`,
      });
    }

    const missing = Array.from(claim.requirements.keys()).filter(
      (key) => !claim.requirements.get(key)?.submitted
    );
    if (claim.requirements.size === 0 || missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: claim.requirements.size === 0
          ? 'Add at least one requirement before approving this claim'
          : 'All requirement items must be submitted before a claim can be approved',
        missingRequirements: missing,
      });
    }

    const before = claim.toObject();
    const now = new Date();
    const referenceNumber = req.body.referenceNumber ?? claim.referenceNumber;
    if (typeof referenceNumber !== 'string' || !referenceNumber.trim() || referenceNumber.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'A reference number for this death is required (maximum 100 characters)' });
    }
    claim.referenceNumber = referenceNumber.trim();
    claim.status = 'pending_deduction';
    claim.approval = { approvedBy, approvedAt: now };
    claim.statusHistory.push(
      { status: 'approved', changedBy: approvedBy, changedAt: now, notes: 'Requirements verified and approved' },
      { status: 'pending_deduction', changedBy: approvedBy, changedAt: now, notes: 'Ready for Finance Officer processing' },
    );

    await claim.save();

    await createAuditLog({
      userId: req.user?.userId,
      userName: approvedBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_approved',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim for ${claim.memberName} approved — moved to Pending Deduction`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim approved and moved to Pending Monthly Deduction',
      data: claim,
    });
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving claim',
      error: safeErrorMessage(error),
    });
  }
};

// Reject Claim
const rejectClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { reason } = req.body;
    const rejectedBy = actorName(req.user, 'admin');

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be rejected from status "${claim.status}"`,
      });
    }

    const before = claim.toObject();
    const now = new Date();
    claim.status = 'rejected';
    claim.rejection = { rejectedBy, rejectedAt: now, reason: reason.trim() };
    claim.statusHistory.push({ status: 'rejected', changedBy: rejectedBy, changedAt: now, notes: reason.trim() });

    await claim.save();

    await createAuditLog({
      userId: req.user?.userId,
      userName: rejectedBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_rejected',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim for ${claim.memberName} rejected: ${reason.trim()}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim rejected',
      data: claim,
    });
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting claim',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  createClaim,
  getAllClaims,
  getClaimById,
  updateRequirements,
  addRequirement,
  removeRequirement,
  updateVerification,
  approveClaim,
  rejectClaim,
};
