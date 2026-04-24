const Claim = require('../models/Claim');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');

// File new claim
const fileNewClaim = async (req, res) => {
  try {
    const { memberId, deceasedName, dateOfDeath, causeOfDeath, claimantName, claimantRelationship, claimAmount } =
      req.body;

    if (!memberId || !deceasedName || !dateOfDeath || !causeOfDeath || !claimantName || !claimantRelationship) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const newClaim = new Claim({
      claimId: `CLAIM-${Date.now()}`,
      memberId,
      deceasedName,
      dateOfDeath,
      causeOfDeath,
      claimantName,
      claimantRelationship,
      claimAmount: claimAmount || 10000,
      status: 'pending',
    });

    const saved = await newClaim.save();

    res.status(201).json({
      message: 'Claim filed successfully',
      claim: saved,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error filing claim', error: error.message });
  }
};

// Get claim history for member
const getClaimHistory = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const claims = await Claim.find({ memberId }).sort({ createdAt: -1 });

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      totalClaims: claims.length,
      claims: claims,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching claims', error: error.message });
  }
};

// Get single claim
const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    res.status(200).json(claim);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching claim', error: error.message });
  }
};

// Approve claim (admin)
const approveClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { approvedBy } = req.body;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    claim.status = 'approved';
    claim.approvedBy = approvedBy || 'admin';
    claim.approvalDate = new Date();
    await claim.save();

    res.status(200).json({
      message: 'Claim approved',
      claim: claim,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving claim', error: error.message });
  }
};

// Reject claim (admin)
const rejectClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { rejectionReason } = req.body;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    claim.status = 'rejected';
    claim.rejectionReason = rejectionReason || 'No reason provided';
    await claim.save();

    res.status(200).json({
      message: 'Claim rejected',
      claim: claim,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting claim', error: error.message });
  }
};

// Pay claim (admin) - deducts from member balance
const payClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { recordedBy } = req.body;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'approved') {
      return res.status(400).json({ message: 'Claim must be approved before payment' });
    }

    // Get current balance
    const latestLedger = await Ledger.findOne({ memberId: claim.memberId }).sort({ transactionDate: -1 });
    const currentBalance = latestLedger ? latestLedger.balance : 0;
    const newBalance = currentBalance - claim.claimAmount;

    // Create ledger entry
    const ledgerEntry = new Ledger({
      ledgerId: uuidv4(),
      memberId: claim.memberId,
      transactionType: 'claim_payout',
      description: `Claim payout for ${claim.deceasedName}`,
      debit: claim.claimAmount,
      balance: newBalance,
      referenceId: claimId,
      recordedBy: recordedBy || 'admin',
    });

    await ledgerEntry.save();

    // Update claim status
    claim.status = 'paid';
    claim.paidDate = new Date();
    await claim.save();

    res.status(200).json({
      message: 'Claim paid successfully',
      claim: claim,
      ledgerEntry: ledgerEntry,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error paying claim', error: error.message });
  }
};

// Get all claims (for admin/treasurer view)
const getAllClaims = async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 });
    
    // Populate member names
    const claimsWithMemberNames = await Promise.all(
      claims.map(async (claim) => {
        const member = await Member.findOne({ memberId: claim.memberId });
        return {
          ...claim.toObject(),
          member_name: member ? member.memberName : 'Unknown Member',
          member_id: claim.memberId,
          claimant_name: claim.claimantName,
          claimant_relationship: claim.claimantRelationship,
          id: claim.claimId
        };
      })
    );

    res.status(200).json({
      success: true,
      data: claimsWithMemberNames,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching claims', 
      error: error.message 
    });
  }
};

module.exports = {
  fileNewClaim,
  getClaimHistory,
  getClaimById,
  approveClaim,
  rejectClaim,
  payClaim,
  getAllClaims,
};
