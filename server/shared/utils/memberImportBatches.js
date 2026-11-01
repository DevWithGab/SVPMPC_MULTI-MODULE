// Bound database pressure and serialize conflicting rows within the same file.
// Results retain CSV order even when individual saves finish out of order.
const processMemberBatches = async (members, processRow, keysForRow = member => {
  const data = member?.entry || member;
  const email = String(data?.email ?? '').trim();
  const memberId = String(data?.passbookNo ?? data?.memberId ?? '').trim();
  return [email && `email:${email}`, memberId && `id:${memberId}`].filter(Boolean);
}) => {
  const results = [];
  let batch = [];
  let keys = new Set();
  const flush = async () => {
    results.push(...await Promise.all(batch.map(([member, index]) => processRow(member, index))));
    batch = [];
    keys = new Set();
  };
  for (const [index, member] of members.entries()) {
    const rowKeys = keysForRow(member);
    if (batch.length === 10 || rowKeys.some(key => keys.has(key))) await flush();
    batch.push([member, index]);
    rowKeys.forEach(key => keys.add(key));
  }
  if (batch.length) await flush();
  return results;
};

module.exports = { processMemberBatches };
