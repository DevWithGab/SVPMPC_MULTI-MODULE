const hasRecordedName = log => log.userName && log.userName.trim().toLowerCase() !== 'unknown';

/* Nire-resolve nito yung legacy Unknown entries gamit ang saved account ID
nila. Huwag palitan yung recorded name o manghula kung aling account ang
gumawa ng action base lang sa role nito. */
async function resolveAuditActorNames(logs, User) {
  const ids = [...new Set(logs.filter(log => !hasRecordedName(log) && log.userId).map(log => String(log.userId)))];
  const usersById = new Map();
  if (ids.length) {
    const objectIds = ids.filter(id => /^[a-f\d]{24}$/i.test(id));
    const users = await User.find({ $or: [
      { userId: { $in: ids } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ] }).select('userId fullName username').lean();
    for (const user of users) {
      usersById.set(String(user.userId), user);
      usersById.set(String(user._id), user);
    }
  }
  const roles = { admin: 'Admin', super_admin: 'Super Admin', secretary: 'Secretary', scanner: 'Scanner', scanner_operator: 'Scanner Operator', treasurer: 'Treasurer' };
  return logs.map(log => {
    if (hasRecordedName(log)) return log;
    const user = usersById.get(String(log.userId));
    const userName = user?.fullName || user?.username || `${roles[log.userRole] || 'User'} (name not recorded)`;
    return { ...(log.toObject ? log.toObject() : log), userName };
  });
}

module.exports = { resolveAuditActorNames };
