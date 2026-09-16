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

export const CLAIM_STATUS_ORDER = [
  'pending_requirements',
  'pending_deduction',
  'deduction_processed',
  'released',
  'rejected',
];

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
