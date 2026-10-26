const { Member } = require('../../../shared/models');
const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const Beneficiary = require('../models/Beneficiary');
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const NoticeBatchJob = require('../models/NoticeBatchJob');
const PaymentImport = require('../models/PaymentImport');
const AuditLog = require('../../../shared/models/AuditLog');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');
const { exportModule, restoreModule, summaryTotals } = require('../../../shared/utils/moduleBackup');

/* Everything the Mortuary module owns. Members are always included (shared
with Attendance); on restore an existing member only receives its mortuary
fields, never the shared profile or QR data. Ledgers carry every balance
(Member has no balance field), and keep their original posting order. */
const MORTUARY_MEMBER_FIELDS = ['beneficiaries', 'beneficiaryRelationship'];
// Shared profile used to recreate a member missing from the database.
const NEW_MEMBER_FIELDS = ['memberId', 'memberName', 'email', 'phoneNumber', 'barangay', 'address', 'dateOfBirth', 'gender', 'joinDate', 'status'];
const COLLECTIONS = [
  { name: 'beneficiaries', Model: Beneficiary, key: 'beneficiaryId', memberScoped: true },
  { name: 'claims', Model: Claim, key: 'claimId', memberScoped: true },
  { name: 'contributions', Model: Contribution, key: 'contributionId', memberScoped: true },
  { name: 'ledgers', Model: Ledger, key: 'ledgerId', memberScoped: true },
  { name: 'paymentImports', Model: PaymentImport, key: '_id', memberScoped: true },
  { name: 'deductionSettings', Model: DeductionSetting, key: 'settingId', singleActive: true },
  { name: 'noticeThresholdSettings', Model: NoticeThresholdSetting, key: 'settingId', singleActive: true },
  { name: 'noticeBatchJobs', Model: NoticeBatchJob, key: 'jobId' },
  { name: 'auditLogs', Model: AuditLog, key: 'logId', insertOnly: true, filter: { module: 'mortuary' } },
];

const audit = (req, fields) => createAuditLog({
  userId: req.user?.userId,
  userName: actorName(req.user, 'Unknown'),
  userRole: req.user?.role || 'admin',
  module: 'mortuary',
  entityType: 'backup',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  ...fields,
});

// Complete Mortuary backup: members and every mortuary collection.
const getFullBackup = async (req, res) => {
  try {
    const backup = await exportModule(Member, 'mortuary', COLLECTIONS, actorName(req.user, 'Unknown'));
    await audit(req, {
      action: 'data_exported',
      description: `Downloaded a complete mortuary backup (${Object.entries(backup.counts).map(([name, count]) => `${count} ${name}`).join(', ')})`,
      status: 'success',
      metadata: { counts: backup.counts },
    });
    res.status(200).json({ success: true, data: backup });
  } catch (error) {
    console.error('Error exporting mortuary backup:', error);
    res.status(500).json({ success: false, message: 'Error preparing the backup', error: safeErrorMessage(error) });
  }
};

/* Raw, unpaginated ledger export, kept for the ledger CSV download (and older
clients). The complete backup above already includes ledgers. */
const getLedgerExport = async (req, res) => {
  try {
    const ledgers = await Ledger.find({}).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    console.error('Error exporting ledger for backup:', error);
    res.status(500).json({ success: false, message: 'Error exporting ledger', error: safeErrorMessage(error) });
  }
};

/* Restores a complete backup, or any subset of its arrays, including older
backups that only had members, contributions and ledgers. */
const restoreBackup = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!['members', ...COLLECTIONS.map(c => c.name)].some(name => Array.isArray(payload[name]))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup file — expected a Mortuary backup (members, beneficiaries, claims, contributions, ledgers, settings and/or audit logs).',
      });
    }

    const summary = await restoreModule(Member, payload, { collections: COLLECTIONS, ownedFields: MORTUARY_MEMBER_FIELDS, newMemberFields: NEW_MEMBER_FIELDS });
    const totals = summaryTotals(summary);
    await audit(req, {
      action: 'data_restored',
      description: `Restored backup: ${totals.created} created, ${totals.updated} updated${totals.skipped ? `, ${totals.skipped} already present` : ''}${totals.errors ? `, ${totals.errors} failed` : ''}`,
      status: totals.errors > 0 ? 'partial' : 'success',
      metadata: Object.fromEntries(Object.entries(summary).map(([name, s]) => [name, { created: s.created, updated: s.updated, skipped: s.skipped, errors: s.errors.length }])),
    });

    res.status(200).json({ success: true, message: 'Backup restored successfully', summary });
  } catch (error) {
    await audit(req, { action: 'data_restored', description: 'Failed to restore backup', status: 'failed', errorMessage: error.message });
    res.status(500).json({ success: false, message: 'Error restoring backup', error: safeErrorMessage(error) });
  }
};

module.exports = { getFullBackup, getLedgerExport, restoreBackup };
