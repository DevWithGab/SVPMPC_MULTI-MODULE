// Serialize payments for a member within this server, including the manual form.
const pending = new Map();
async function withMemberPaymentLock(memberId, work) {
  const previous = pending.get(memberId) || Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  pending.set(memberId, current);
  try { return await current; }
  finally { if (pending.get(memberId) === current) pending.delete(memberId); }
}
// Acquire overlapping batch locks in a consistent order to avoid deadlocks.
async function withMemberPaymentLocks(memberIds, work) {
  const ids = [...new Set(memberIds)].sort();
  const acquire = index => index === ids.length ? work() : withMemberPaymentLock(ids[index], () => acquire(index + 1));
  return acquire(0);
}
module.exports = { withMemberPaymentLock, withMemberPaymentLocks };
