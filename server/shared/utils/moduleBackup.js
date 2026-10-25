const { safeErrorMessage } = require('../../middleware/errorHandler');

/* Full-module backup and restore.

A backup is every collection the module owns, exported raw (unpaginated and
unreshaped) so it round-trips faithfully. Restore upserts each collection by
its natural key and never deletes anything missing from the file, so a partial
or older backup can't wipe newer data.

Per-collection options:
- key:          natural key matched on restore ('_id' for string-keyed models)
- memberScoped: record must belong to an existing member and keep its owner
- insertOnly:   only add missing records, never overwrite (audit history)
- singleActive: versioned settings with one 'active' row; an older active row
                from a backup is restored as 'superseded', and restoring never
                flips an existing row's status.
- summaryKey:   name reported in the restore summary (defaults to name)

The Member model is passed in by each module's controller. */

const BACKUP_FORMAT = 'svpmpc-module-backup';
const BACKUP_VERSION = 2;
const validId = value => typeof value === 'string' && value.trim().length > 0;
const omit = (record, keys) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));

const exportModule = async (Member, moduleName, collections, exportedBy) => {
  const members = await Member.find({}).sort({ createdAt: 1 }).lean();
  const backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, module: moduleName, exportedAt: new Date().toISOString(), exportedBy, members };
  for (const { name, Model, filter = {} } of collections) {
    backup[name] = await Model.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
  }
  backup.counts = Object.fromEntries(['members', ...collections.map(c => c.name)].map(name => [name, backup[name].length]));
  return backup;
};

/* Members are shared by both modules, and each module restores only its own
member data: an existing member receives just the fields this module owns,
and a missing member is recreated from the shared profile plus those fields.
One module's backup can never overwrite the other module's member data. */
const pick = (record, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]]));
const restoreMembers = async (Member, records, { ownedFields, newMemberFields }) => {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const record of records) {
    const memberId = record?.memberId;
    if (!validId(memberId)) { result.errors.push({ error: 'Record requires a string memberId' }); continue; }
    try {
      if (await Member.findOne({ memberId })) {
        const fields = pick(record, ownedFields);
        if (Object.keys(fields).length) {
          const update = await Member.updateOne({ memberId }, { $set: fields }, { runValidators: true });
          if (!update.matchedCount) { result.errors.push({ memberId, error: 'Member is no longer available' }); continue; }
        }
        result.updated += 1;
      } else {
        // Module labels from old backups are ignored: members are shared.
        await Member.create({ ...pick(record, [...newMemberFields, ...ownedFields, 'createdAt']), modules: ['attendance', 'mortuary'] });
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ memberId, error: safeErrorMessage(error) });
    }
  }
  return result;
};

const restoreCollection = async (Member, Model, records, { key, memberScoped, insertOnly, singleActive }) => {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const record of records) {
    const keyValue = record?.[key];
    if (!validId(keyValue)) { result.errors.push({ error: `Record requires a string ${key}` }); continue; }
    try {
      // Original timestamps are kept (create() keeps a given createdAt):
      // ledger balances depend on posting order.
      const fields = omit(record, key === '_id' ? ['__v'] : ['_id', '__v']);
      const existing = await Model.findOne({ [key]: keyValue });

      if (memberScoped) {
        const memberId = fields.memberId ?? existing?.memberId;
        if (!validId(memberId) || (existing && existing.memberId !== memberId)) {
          result.errors.push({ [key]: keyValue, error: 'A valid memberId is required; existing records cannot be reassigned' });
          continue;
        }
        if (!await Member.findOne({ memberId })) { result.errors.push({ [key]: keyValue, error: 'Member not found' }); continue; }
        fields.memberId = memberId;
      }

      if (existing) {
        if (insertOnly) { result.skipped += 1; continue; }
        const update = omit(fields, singleActive ? [key, 'status'] : [key]);
        await Model.updateOne({ [key]: keyValue }, { $set: update }, { runValidators: true, timestamps: false });
        result.updated += 1;
      } else {
        if (singleActive && fields.status === 'active' && await Model.findOne({ status: 'active' })) fields.status = 'superseded';
        try {
          await Model.create(fields);
        } catch (error) {
          /* Superseded settings history may predate fields that are required
          today (e.g. old notice letters). It is history only, never used as
          the current setting, so keep it as recorded (types still cast)
          rather than drop it. Active rows must always pass validation. */
          if (!(singleActive && fields.status === 'superseded' && error.name === 'ValidationError')) throw error;
          await Model.collection.insertOne(new Model(fields).toObject({ depopulate: true }));
        }
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ [key]: keyValue, error: safeErrorMessage(error) });
    }
  }
  return result;
};

/* Restores whichever collections the file contains, in the given order
(members first, so member-scoped records can find their owner). `aliases`
maps older backup field names (e.g. attendance) to current ones. */
const restoreModule = async (Member, payload, { collections, ownedFields, newMemberFields, aliases = {} }) => {
  const data = { ...payload };
  for (const [oldName, name] of Object.entries(aliases)) {
    if (!Array.isArray(data[name]) && Array.isArray(data[oldName])) data[name] = data[oldName];
  }
  const summary = {};
  if (Array.isArray(data.members)) summary.members = await restoreMembers(Member, data.members, { ownedFields, newMemberFields });
  for (const collection of collections) {
    if (Array.isArray(data[collection.name])) {
      summary[collection.summaryKey || collection.name] = await restoreCollection(Member, collection.Model, data[collection.name], collection);
    }
  }
  return summary;
};

const summaryTotals = summary => Object.values(summary).reduce((totals, s) => ({
  created: totals.created + s.created,
  updated: totals.updated + s.updated,
  skipped: totals.skipped + (s.skipped || 0),
  errors: totals.errors + s.errors.length,
}), { created: 0, updated: 0, skipped: 0, errors: 0 });

module.exports = { BACKUP_FORMAT, BACKUP_VERSION, exportModule, restoreModule, restoreCollection, restoreMembers, summaryTotals };
