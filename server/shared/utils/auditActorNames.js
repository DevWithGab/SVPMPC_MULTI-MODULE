const hasRecordedName = log => log.userName && log.userName.trim().toLowerCase() !== 'unknown';

/* "Performed by" shows the actor's full name. Logs record either a name, a
username (most staff actions), or "Unknown" (legacy). Usernames and Unknown
entries resolve to the account's full name, found by its saved ID or, failing
that, by the recorded username. A name that was genuinely recorded is kept,
and nothing is guessed from the role alone. Stored logs are never rewritten. */
async function resolveAuditActorNames(logs, User) {
  const ids = [...new Set(logs.filter(log => log.userId).map(log => String(log.userId)))];
  const usernames = [...new Set(logs.filter(hasRecordedName).map(log => log.userName.trim()))];
  const usersById = new Map();
  const usersByUsername = new Map();
  if (ids.length || usernames.length) {
    const objectIds = ids.filter(id => /^[a-f\d]{24}$/i.test(id));
    const users = await User.find({ $or: [
      { userId: { $in: ids } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(usernames.length ? [{ username: { $in: usernames } }] : []),
    ] }).select('userId fullName username').lean();
    for (const user of users) {
      usersById.set(String(user.userId), user);
      usersById.set(String(user._id), user);
      if (user.username) usersByUsername.set(user.username, user);
    }
  }
  const roles = { admin: 'Admin', super_admin: 'Super Admin', secretary: 'Secretary', scanner: 'Scanner', scanner_operator: 'Scanner Operator', treasurer: 'Treasurer' };
  return logs.map(log => {
    const plain = () => (log.toObject ? log.toObject() : log);
    if (hasRecordedName(log)) {
      const recorded = log.userName.trim();
      const user = (log.userId && usersById.get(String(log.userId))) || usersByUsername.get(recorded);
      // Only replace a recorded username, never a recorded name.
      return user?.fullName?.trim() && user.username === recorded ? { ...plain(), userName: user.fullName.trim() } : log;
    }
    const user = usersById.get(String(log.userId));
    const userName = user?.fullName || user?.username || `${roles[log.userRole] || 'User'} (name not recorded)`;
    return { ...plain(), userName };
  });
}

module.exports = { resolveAuditActorNames };
