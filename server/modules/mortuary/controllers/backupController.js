const { Member } = require('../../../shared/models');
const Contribution = require('../models/Contribution');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

// Restoring from a backup upserts by each collection's natural key — an
// existing record with the same id gets its fields overwritten, a new one
// gets created. It never deletes anything not present in the backup, so a
// partial or older backup can't wipe out newer data that isn't in the file.
// (Same pattern as the Attendance module's backup/restore.)
const upsertMany = async (Model, key, records) => {
  const result = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(records)) return result;

  for (const record of records) {
    const keyValue = record?.[key];
    if (!keyValue) {
      result.errors.push({ error: `Record missing ${key}`, record });
      continue;
    }

    try {
      // Strip Mongo-internal fields — these must never be copied from the
      // backup file, they belong to whatever document ends up storing this.
      const { _id, __v, createdAt, updatedAt, ...fields } = record;
      const existing = await Model.findOne({ [key]: keyValue });

      if (existing) {
        await Model.updateOne({ [key]: keyValue }, { $set: fields });
        result.updated += 1;
      } else {
        await Model.create(fields);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ [key]: keyValue, error: error.message });
    }
  }

  return result;
};

// Restores from the same JSON shape the "Complete System Backup" button
// downloads: { members, contributions }. Any subset of those two arrays is
// accepted, so a members-only or contributions-only export also works.
const restoreBackup = async (req, res) => {
  try {
    const { members, contributions } = req.body || {};

    const hasMembers = Array.isArray(members);
    const hasContributions = Array.isArray(contributions);

    if (!hasMembers && !hasContributions) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup file — expected a "members" and/or "contributions" array.',
      });
    }

    const summary = {};
    if (hasMembers) summary.members = await upsertMany(Member, 'memberId', members);
    if (hasContributions) summary.contributions = await upsertMany(Contribution, 'contributionId', contributions);

    const totalCreated = Object.values(summary).reduce((sum, s) => sum + s.created, 0);
    const totalUpdated = Object.values(summary).reduce((sum, s) => sum + s.updated, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors.length, 0);

    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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
      },
    });

    res.status(200).json({ success: true, message: 'Backup restored successfully', summary });
  } catch (error) {
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
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

    res.status(500).json({ success: false, message: 'Error restoring backup', error: error.message });
  }
};

module.exports = {
  restoreBackup,
};
