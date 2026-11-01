const CLAIM_STATUSES = [
  'filing', 'pending_requirements', 'approved', 'pending_deduction',
  'deduction_processing', 'deduction_processed', 'releasing', 'released', 'rejected',
];
const CLAIM_MEMBER_INDEX = { memberId: 1 };
const CLAIM_MEMBER_INDEX_OPTIONS = {
  name: 'one_non_rejected_claim_per_member', unique: true,
  partialFilterExpression: { status: { $in: CLAIM_STATUSES.filter(status => status !== 'rejected') } },
};
module.exports = { CLAIM_STATUSES, CLAIM_MEMBER_INDEX, CLAIM_MEMBER_INDEX_OPTIONS };
