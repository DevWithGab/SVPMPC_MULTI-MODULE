// Shared display metadata for the Claim lifecycle — kept in one place so the
// list, details, and modals all agree on labels/colors/order.

export const CLAIM_STATUS_META = {
  pending_requirements: {
    label: 'Pending Requirements',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    statColor: 'amber',
  },
  approved: {
    label: 'Approved',
    dot: 'bg-coop-green',
    text: 'text-coop-green',
    bg: 'bg-green-50',
    border: 'border-green-200',
    statColor: 'emerald',
  },
  pending_deduction: {
    label: 'Pending Deduction',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    statColor: 'blue',
  },
  deduction_processed: {
    label: 'Deduction Processed',
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    statColor: 'slate',
  },
  released: {
    label: 'Released',
    dot: 'bg-coop-green',
    text: 'text-coop-green',
    bg: 'bg-green-50',
    border: 'border-green-200',
    statColor: 'emerald',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-rose-500',
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    statColor: 'rose',
  },
};

// Drives the status filter dropdown. 'approved' is deliberately absent: the
// enum still allows it, but approveClaim moves a claim straight to
// 'pending_deduction', so offering it as a filter would always return nothing.
export const CLAIM_STATUS_ORDER = [
  'pending_requirements',
  'pending_deduction',
  'deduction_processed',
  'released',
  'rejected',
];

// Who a claim is waiting on at each status, and what the next step is called.
// A status badge says what a claim IS; this says what someone should DO about
// it, which is what the list view needs to label its action button and to mark
// the rows that need the Admin rather than the Treasurer.
//
//   actor 'admin'     - the Admin acts next; render as the primary call to action
//   actor 'treasurer' - handed off, the Admin can only look
//   actor null        - settled, nothing left to do
export const CLAIM_STATUS_ACTION = {
  pending_requirements: { actor: 'admin', label: 'Review Requirements', hint: 'Needs your review' },
  approved: { actor: 'admin', label: 'Review Claim', hint: 'Needs your review' },
  pending_deduction: { actor: 'treasurer', label: 'View', hint: 'With Treasurer' },
  deduction_processed: { actor: 'treasurer', label: 'View', hint: 'With Treasurer' },
  released: { actor: null, label: 'View Details', hint: '' },
  rejected: { actor: null, label: 'View Details', hint: '' },
};

export const getClaimAction = (status) =>
  CLAIM_STATUS_ACTION[status] || { actor: null, label: 'View Details', hint: '' };

export const getClaimStatusMeta = (status) =>
  CLAIM_STATUS_META[status] || CLAIM_STATUS_META.pending_requirements;

export const REQUIREMENT_LABELS = {
  claimApplicationForm: 'Claim Application Form',
  deathCertificate: 'Death Certificate',
  memberCooperativeId: "Member's Cooperative ID",
  beneficiaryValidId: "Beneficiary's Valid ID",
};

export const REQUIREMENT_KEYS = Object.keys(REQUIREMENT_LABELS);

export const isClaimFullySubmitted = (requirements) =>
  REQUIREMENT_KEYS.every((key) => requirements?.[key]?.submitted);
