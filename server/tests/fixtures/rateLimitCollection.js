// Atomic in-memory stand-in for MongoDB operations; never opens a connection.
const createRateLimitCollection = () => {
  const rows = new Map();
  return {
    rows,
    async findOneAndUpdate({ _id }, update, options = {}) {
      let row = rows.get(_id);
      if (!row && !options.upsert) return null;
      if (!row) { row = { _id, totalHits: 0, ...update.$setOnInsert }; rows.set(_id, row); }
      row.totalHits += update.$inc.totalHits;
      return { ...row };
    },
    async updateOne({ _id, totalHits }, update) {
      const row = rows.get(_id);
      if (row && row.totalHits > totalHits.$gt) row.totalHits += update.$inc.totalHits;
    },
    async deleteOne({ _id }) { rows.delete(_id); },
    async findOne({ _id }) { return rows.get(_id) || null; },
  };
};
module.exports = { createRateLimitCollection };
