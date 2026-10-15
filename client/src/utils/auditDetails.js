import { formatDate, formatDateTime, formatTimeString } from './date.js';
const attendanceFields = {
  eventName: "Event Name",
  eventDate: "Date",
  startTime: "Start Time",
  endTime: "End Time",
  location: "Location",
  description: "Description",
  type: "Type",
  status: "Status",
  rejectionReason: "Rejection Reason",
  createdBy: "Created By",
  memberName: "Member Name",
  memberId: "Passbook Number",
  phoneNumber: "Phone Number",
  barangay: "Barangay",
  scanTime: "Scan Time",
  entrySource: "Entry Source",
  justification: "Justification",
  eventLocation: "Event Location",
};
const mortuaryFields = {
  memberName: "Deceased Member",
  memberId: "Passbook Number",
  beneficiaryName: "Beneficiary",
  beneficiaryRelationship: "Relationship",
  beneficiaryContact: "Beneficiary Contact",
  dateOfDeath: "Date of Death",
  dateFiled: "Date Filed",
  causeOfDeath: "Cause of Death",
  remarks: "Remarks",
  status: "Status",
  requirements: "Requirements",
  verification: "Verification",
  approval: "Approval",
  rejection: "Rejection",
  deduction: "Deduction",
  payout: "Payout",
  createdBy: "Created By",
  deductionSettingId: "Deduction Rate Used",
  amountPerMember: "Amount Per Member",
  membersCharged: "Members Charged",
  totalCollected: "Total Collected",
  processedBy: "Processed By",
  processedAt: "Processed On",
  verifiedBy: "Verified By",
  verificationDate: "Verification Date",
  approvedBy: "Approved By",
  approvedAt: "Approved On",
  rejectedBy: "Rejected By",
  rejectedAt: "Rejected On",
  reason: "Reason",
  amount: "Amount",
  paymentMethod: "Payment Method",
  dvNumber: "DV Number",
  releasedBy: "Released By",
  releasedAt: "Released On",
  ledgerId: "Ledger Reference",
};
const internal = new Set(['_id', '__v', 'id', 'createdAt', 'updatedAt', 'statusHistory', 'eventTime']);
export const readableLabel = (value) => String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const outcomeLabel = (status) => ({ success: 'Completed', failed: 'Failed', partial: 'Partly completed' }[status] || readableLabel(status) || 'Not recorded');
const fieldLabel = (key, module) => (module === 'mortuary' ? mortuaryFields : attendanceFields)[key] || readableLabel(key);
export function auditValue(key, value) {
  if (value == null || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (['startTime', 'endTime'].includes(key)) return formatTimeString(value);
  if (typeof value === 'string' && /(?:At|Date|Time)$|^date[A-Z]/.test(key) && !Number.isNaN(Date.parse(value))) {
    return ['eventDate', 'dateOfDeath', 'dateFiled'].includes(key) ? formatDate(value) : formatDateTime(value);
  }
  if (['amount', 'amountPerMember', 'totalCollected', 'balance', 'credit', 'debit'].includes(key) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
  }
  if (['status', 'entrySource', 'paymentMethod', 'userRole', 'type'].includes(key)) return readableLabel(value);
  return String(value);
}
// Flatten nested values so each changed field has its own before/after pair.
export function auditRows(snapshot, module, path = []) {
  if (snapshot == null) return [];
  if (typeof snapshot !== 'object') return [{ key: path.join('.'), label: path.map(k => fieldLabel(k, module)).join(' / ') || 'Value', value: auditValue(path.at(-1), snapshot) }];
  return Object.entries(snapshot).flatMap(([key, value]) => {
    if (internal.has(key)) return [];
    const next = [...path, Array.isArray(snapshot) ? 'Item ' + (Number(key) + 1) : key];
    if (value && typeof value === 'object' && Object.keys(value).length) return auditRows(value, module, next);
    return [{ key: next.join('.'), label: next.map(k => fieldLabel(k, module)).join(' / '), value: value && typeof value === 'object' ? 'None' : auditValue(key, value) }];
  });
}
export function auditChanges(changes, module) {
  const before = auditRows(changes?.before, module);
  const after = auditRows(changes?.after, module);
  if (changes?.before != null && changes?.after != null) {
    const oldValues = new Map(before.map(row => [row.key, row]));
    const newValues = new Map(after.map(row => [row.key, row]));
    const rows = [...new Set([...oldValues.keys(), ...newValues.keys()])].flatMap(key => {
      const oldRow = oldValues.get(key), newRow = newValues.get(key);
      if (oldRow?.value === newRow?.value) return [];
      return [{ key, label: (newRow || oldRow).label, before: oldRow?.value ?? 'Not recorded', after: newRow?.value ?? 'Not recorded' }];
    });
    return { kind: 'diff', rows };
  }
  return { kind: changes?.after != null ? 'added' : 'removed', rows: changes?.after != null ? after : before };
}
