const Claim = require('../models/Claim');
const Beneficiary = require('../models/Beneficiary');
const { Member } = require('../../../shared/models');
const AuditLog = require('../../../shared/models/AuditLog');
const { createClaimRegistrationService } = require('../services/claimRegistrationService');
const registration = createClaimRegistrationService({ Claim, Member, Beneficiary, AuditLog });
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Reserve and finish registration through the durable filing journal.
const createClaim = async (req, res) => {
  try {
    const result = await registration.register(req.body, {
      userId: req.user?.userId, userName: actorName(req.user, 'admin'), userRole: req.user?.role || 'admin',
      ipAddress: req.ip, userAgent: req.get?.('user-agent'),
    });
    return res.status(result.created ? 201 : 200).json({
      success: true, message: 'Claim registered successfully', data: result.claim,
    });
  } catch (error) {
    if (!error.status) console.error('Error creating claim:', error);
    return res.status(error.status || 503).json({
      success: false,
      message: error.status ? error.message : 'Could not finish registration. Retry with the same details; any saved registration will be resumed.',
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
  recoverClaimRegistrations: registration.recover,
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
