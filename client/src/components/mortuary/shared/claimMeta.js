/* Shared display metadata para sa Claim lifecycle - nilagay sa isang lugar
para ang list, details, at modals ay pareho ang labels/colors/order. */

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

/* Ito ang nag-drive sa status filter dropdown. Sinadyang absent yung
'approved': pinapayagan pa rin ito ng enum, pero ang approveClaim ay
diretso nang nagmo-move ng claim sa 'pending_deduction', kaya kung
ioffer ito as a filter, laging walang resulta. */
export const CLAIM_STATUS_ORDER = [
  'pending_requirements',
  'pending_deduction',
  'deduction_processed',
  'released',
  'rejected',
];

/* Sino ang hinihintay sa each status ng claim, at ano ang tawag sa next
step. Yung status badge ay sinasabi kung ano ang claim; ito naman ang
sinasabi kung ano ang dapat GAWIN ng isang tao tungkol dito, na kailangan
ng list view para i-label ang action button nito at markahan ang mga rows
na kailangan ng Admin imbes na ng Treasurer.

   actor 'admin'     - the Admin acts next; render as the primary call to action
   actor 'treasurer' - handed off, the Admin can only look
   actor null        - settled, nothing left to do */
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

/* Pinapasok ang requirements sa each claim dahil magkaiba ang physical
requirements ng bawat individual. Sinadyang incomplete ang empty checklist
at kinakailangan din ng server ng at least one item bago mag-approve. */
export const isClaimFullySubmitted = (requirements) =>
  Object.keys(requirements || {}).length > 0 &&
  Object.values(requirements || {}).every((r) => r?.submitted);
