/* Shared by the Attendance and Mortuary backup screens. A complete backup is
produced by the server (every collection the module owns, raw), so the file
always contains all data, not just what a screen happened to load. */

export const BACKUP_COLLECTIONS = {
  attendance: [
    ['members', 'Members'],
    ['events', 'Events'],
    ['attendanceLogs', 'Attendance records'],
    ['attendanceReports', 'Attendance reports'],
    ['auditLogs', 'Audit logs'],
  ],
  mortuary: [
    ['members', 'Members'],
    ['beneficiaries', 'Beneficiaries'],
    ['claims', 'Claims'],
    ['contributions', 'Contributions'],
    ['ledgers', 'Ledger entries (balances)'],
    ['paymentImports', 'Bulk payment imports'],
    ['benefitCapSettings', 'Benefit cap settings'],
    ['deductionSettings', 'Deduction rate settings'],
    ['noticeThresholdSettings', 'Notice settings & letters'],
    ['noticeBatchJobs', 'Notice batches'],
    ['auditLogs', 'Audit logs'],
  ],
};

// Older backups used other names for the same collections.
const LEGACY_KEYS = { attendance: ['attendance'], mortuary: [] };
// Restore summaries report attendance logs under "attendance".
const SUMMARY_LABELS = { attendance: 'Attendance records' };

export const isModuleBackup = (data, module) => [...BACKUP_COLLECTIONS[module].map(([key]) => key), ...LEGACY_KEYS[module]]
  .some(key => Array.isArray(data?.[key]));

export const backupCounts = (data, module) => BACKUP_COLLECTIONS[module]
  .filter(([key]) => Array.isArray(data?.[key]))
  .map(([key, label]) => [label, data[key].length]);

// Preserve every field, including fields only present in later records.
// Nested settings, report data and histories remain JSON inside a CSV cell.
export const collectionCsv = (records) => {
  const fields = [...new Set(records.flatMap(record => Object.keys(record)))];
  if (!fields.length) fields.push('_id');
  const quote = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [fields, ...records.map(record => fields.map(field => record[field]))]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
};

export const downloadCollectionCsv = (records, filename) => {
  const url = URL.createObjectURL(new Blob([collectionCsv(records)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const restoreSummaryLines = (summary, module) => {
  const labels = Object.fromEntries(BACKUP_COLLECTIONS[module]);
  return Object.entries(summary || {}).map(([key, s]) => {
    const parts = [`${s.created} created`, `${s.updated} updated`];
    if (s.skipped) parts.push(`${s.skipped} already present`);
    if (s.errors?.length) parts.push(`${s.errors.length} failed`);
    return [labels[key] || SUMMARY_LABELS[key] || key, parts.join(', ')];
  });
};

export const downloadJson = (data, filename) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
