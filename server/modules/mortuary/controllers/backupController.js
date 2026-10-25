const { Member } = require('../../../shared/models');
const Contribution = require('../models/Contribution');
const Ledger = require('../models/Ledger');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

const MORTUARY_MEMBER_FIELDS = ['beneficiaries', 'beneficiaryRelationship'];
const NEW_MEMBER_FIELDS = ['memberId', 'memberName', 'email', 'phoneNumber', 'barangay',
  'address', 'dateOfBirth', 'gender', 'joinDate', 'status', ...MORTUARY_MEMBER_FIELDS];
const validId = value => typeof value === 'string' && value.trim().length > 0;
const pickFields = (record, allowed) => Object.fromEntries(
  allowed.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]])
);

const restoreMembers = async (records) => {
  const result = { created: 0, updated: 0, errors: [] };
  for (const record of records) {
    const memberId = record?.memberId;
    if (!validId(memberId)) {
      result.errors.push({ error: 'Record requires a string memberId' });
      continue;
    }
    try {
      const existing = await Member.findOne({ memberId });
      if (existing) {
        // Members are shared, but restores still protect shared/QR fields.
        const fields = pickFields(record, MORTUARY_MEMBER_FIELDS);
        if (Object.keys(fields).length) {
          const update = await Member.updateOne({ memberId },
            { $set: fields }, { runValidators: true });
          if (!update.matchedCount) {
            result.errors.push({ memberId, error: 'Member is no longer available' });
            continue;
          }
        }
        result.updated += 1;
      } else {
        // Ignore module labels from old backups: new members are shared.
        await Member.create({ ...pickFields(record, NEW_MEMBER_FIELDS), modules: ['attendance', 'mortuary'] });
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ memberId, error: safeErrorMessage(error) });
    }
  }
  return result;
};

/* Hindi talaga field sa Member document yung balance ng isang member - derived
ito galing sa latest Ledger entry nila (tingnan yung shared/utils understanding
sa buong module na ito). Yung backup na nag-capture lang ng Members +
Contributions ay hindi talaga makaka-restore ng balance ng kahit sino: yung
running history ng deductions, claim payouts, at adjustments na nagproduce
nito ay separate collection na sino-supply ng endpoint na ito raw
(unpaginated, unreshaped) para round-trip siya nang faithful sa restoreBackup
sa baba. */
const getLedgerExport = async (req, res) => {
  try {
    const ledgers = await Ledger.find({}).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    console.error('Error exporting ledger for backup:', error);
    res.status(500).json({ success: false, message: 'Error exporting ledger', error: safeErrorMessage(error) });
  }
};

/* Pag nagrestore galing sa backup, nag-upsert ito base sa natural key ng bawat
collection - yung existing record na may same id ay nao-overwrite yung fields,
yung bago ay nagagawa. Hindi ito nagde-delete ng kahit ano na wala sa backup,
kaya hindi mawiwipe ng partial o lumang backup yung newer data na wala sa
file. (Parehong pattern ng Attendance module's backup/restore.) */
const upsertMany = async (Model, key, records) => {
  const result = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(records)) return result;

  for (const record of records) {
    const keyValue = record?.[key];
    if (!validId(keyValue)) {
      result.errors.push({ error: `Record requires a string ${key}` });
      continue;
    }

    try {
      /* Tinatanggal yung Mongo-internal fields - hindi dapat kopyahin ito
      galing sa backup file, dapat sa kung anong document man ang
      mag-store nito. */
      const { _id, __v, createdAt, updatedAt, ...fields } = record;
      const existing = await Model.findOne({ [key]: keyValue });
      const memberId = fields.memberId ?? existing?.memberId;
      if (!validId(memberId) || (existing && existing.memberId !== memberId)) {
        result.errors.push({ [key]: keyValue, error: 'A valid memberId is required; existing records cannot be reassigned' });
        continue;
      }
      if (!await Member.findOne({ memberId })) {
        result.errors.push({ [key]: keyValue, error: 'Member not found' });
        continue;
      }
      fields.memberId = memberId;

      if (existing) {
        const update = await Model.updateOne({ [key]: keyValue, memberId }, { $set: fields }, { runValidators: true });
        if (!update.matchedCount) {
          result.errors.push({ [key]: keyValue, error: 'Record changed during restore; try again' });
          continue;
        }
        result.updated += 1;
      } else {
        await Model.create(fields);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ [key]: keyValue, error: safeErrorMessage(error) });
    }
  }

  return result;
};

/* Nagre-restore galing sa same JSON shape ng "Complete System Backup" button
downloads: { members, contributions, ledgers }. Tatanggapin ang kahit anong
subset ng tatlong arrays na ito, kaya gumagana rin yung members-only o
contributions-only export. Yung ledgers ang talagang nagre-reconstruct ng
balance ng bawat member - walang balance field talaga yung Member mismo,
kaya kung walang ledgers yung backup, nare-restore lang yung profiles at
payment records pero naiiwan sa zero yung bawat balance. */
const restoreBackup = async (req, res) => {
  try {
    const { members, contributions, ledgers } = req.body || {};

    const hasMembers = Array.isArray(members);
    const hasContributions = Array.isArray(contributions);
    const hasLedgers = Array.isArray(ledgers);

    if (!hasMembers && !hasContributions && !hasLedgers) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup file — expected a "members", "contributions", and/or "ledgers" array.',
      });
    }

    const summary = {};
    if (hasMembers) summary.members = await restoreMembers(members);
    if (hasContributions) summary.contributions = await upsertMany(Contribution, 'contributionId', contributions);
    if (hasLedgers) summary.ledgers = await upsertMany(Ledger, 'ledgerId', ledgers);

    const totalCreated = Object.values(summary).reduce((sum, s) => sum + s.created, 0);
    const totalUpdated = Object.values(summary).reduce((sum, s) => sum + s.updated, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors.length, 0);

    await createAuditLog({
      userId: req.user?.userId,
      userName: actorName(req.user, 'Unknown'),
      userRole: req.user?.role || 'admin',
      action: 'data_restored',
      module: 'mortuary',
      entityType: 'backup',
      description: `Restored backup: ${totalCreated} created, ${totalUpdated} updated${totalErrors ? `, ${totalErrors} failed` : ''}`,
      status: totalErrors > 0 ? 'partial' : 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        members: summary.members
          ? { created: summary.members.created, updated: summary.members.updated, errors: summary.members.errors.length }
          : undefined,
        contributions: summary.contributions
          ? { created: summary.contributions.created, updated: summary.contributions.updated, errors: summary.contributions.errors.length }
          : undefined,
        ledgers: summary.ledgers
          ? { created: summary.ledgers.created, updated: summary.ledgers.updated, errors: summary.ledgers.errors.length }
          : undefined,
      },
    });

    res.status(200).json({ success: true, message: 'Backup restored successfully', summary });
  } catch (error) {
    await createAuditLog({
      userId: req.user?.userId,
      userName: actorName(req.user, 'Unknown'),
      userRole: req.user?.role || 'admin',
      action: 'data_restored',
      module: 'mortuary',
      entityType: 'backup',
      description: 'Failed to restore backup',
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ success: false, message: 'Error restoring backup', error: safeErrorMessage(error) });
  }
};

module.exports = {
  getLedgerExport,
  restoreBackup,
};
