// Serialize payments for a member within this server, including the manual form.
const pending = new Map();
async function withMemberPaymentLock(memberId, work) {
  const previous = pending.get(memberId) || Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  pending.set(memberId, current);
  try { return await current; }
  finally { if (pending.get(memberId) === current) pending.delete(memberId); }
}
module.exports = { withMemberPaymentLock };
