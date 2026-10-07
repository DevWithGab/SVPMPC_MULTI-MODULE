const { randomUUID, randomBytes } = require('node:crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const roles = { admin: ['attendance', 'mortuary'], secretary: ['attendance'], scanner_operator: ['attendance'], treasurer: ['mortuary'] };
const publicUser = user => Object.fromEntries(['userId', 'staffId', 'fullName', 'username', 'email', 'phoneNumber', 'role', 'modules', 'status', 'isTemporaryPassword', 'lastLoginDate'].map(key => [key, user[key]]));
const temporaryPassword = () => randomBytes(18).toString('base64url');
const normalizeUsername = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validUsername = value => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
const usernameTaken = (username, userId) => User.exists({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, ...(userId ? { userId: { $ne: userId } } : {}) });
function validateAccess(role, modules) {
  return Boolean(Object.hasOwn(roles, role) && Array.isArray(modules) && modules.length && new Set(modules).size === modules.length && modules.every(module => roles[role].includes(module)));
}
async function audit(req, user, action, before = null) {
  await AuditLog.create({ logId: randomUUID(), userId: req.user.userId, userName: req.user.username, userRole: req.user.role,
    action, module: 'admin', entityType: 'staff', entityId: user.userId, entityName: user.username,
    description: `${action.replaceAll('_', ' ')}: ${user.username}`, changes: { before, after: action === 'staff_deleted' ? null : publicUser(user) } });
}
const failure = (res, error) => res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'That account already exists.' : 'Unable to save staff account.' });

exports.list = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const users = await User.find({ role: { $in: Object.keys(roles) } }).select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users: users.map(publicUser) });
};
exports.create = async (req, res) => {
  const { fullName, role, modules } = req.body;
  const username = normalizeUsername(req.body.username);
  if (!validUsername(username)) return res.status(400).json({ message: 'Choose a username with 3–32 letters, numbers, dots, underscores, or hyphens. Start with a letter or number.' });
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || !validateAccess(role, modules)) {
    return res.status(400).json({ message: 'Provide a full name and valid role/module assignment.' });
  }
  try {
    if (await usernameTaken(username)) return res.status(409).json({ message: 'Username is already taken. Choose another username.' });
    const password = temporaryPassword();
    const user = new User({ userId: randomUUID(), staffId: `STAFF-${randomUUID()}`, fullName: fullName.trim(),
      username, passwordHash: password, role, modules, status: 'active', isTemporaryPassword: true });
    await user.save();
    await audit(req, user, 'staff_created');
    res.status(201).json({ user: publicUser(user), credentials: { username: user.username, password } });
  } catch (error) { failure(res, error); }
};
exports.update = async (req, res) => {
  const { role, modules, status } = req.body;
  if (!validateAccess(role, modules) || !['active', 'inactive', 'suspended'].includes(status)) return res.status(400).json({ message: 'Invalid role, modules, or account status.' });
  try {
    const user = await User.findOne({ userId: req.params.userId, role: { $in: Object.keys(roles) } });
    if (!user) return res.status(404).json({ message: 'Staff account not found.' });
    const before = publicUser(user);
    if (req.body.fullName !== undefined) {
      if (typeof req.body.fullName !== 'string' || req.body.fullName.trim().length < 2) return res.status(400).json({ message: 'Enter the staff member’s full name.' });
      user.fullName = req.body.fullName.trim();
    }
    if (req.body.username !== undefined) {
      const username = normalizeUsername(req.body.username);
      if (!validUsername(username)) return res.status(400).json({ message: 'Use a username with 3–32 letters, numbers, dots, underscores, or hyphens.' });
      if (await usernameTaken(username, user.userId)) return res.status(409).json({ message: 'Username is already taken. Choose another username.' });
      user.username = username;
    }
    Object.assign(user, { role, modules, status, sessionVersion: (user.sessionVersion || 0) + 1 });
    await user.save();
    await audit(req, user, 'staff_updated', before);
    res.json({ user: publicUser(user) });
  } catch (error) { failure(res, error); }
};
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId, role: { $in: Object.keys(roles) } });
    if (!user) return res.status(404).json({ message: 'Staff account not found.' });
    const password = temporaryPassword();
    Object.assign(user, { passwordHash: password, isTemporaryPassword: true, sessionVersion: (user.sessionVersion || 0) + 1 });
    await user.save();
    await audit(req, user, 'staff_password_reset');
    res.json({ credentials: { username: user.username, password } });
  } catch (error) { failure(res, error); }
};
exports.validateAccess = validateAccess;

exports.remove = async (req, res) => {
  if (req.params.userId === req.user.userId) return res.status(403).json({ message: 'You cannot delete your own account.' });
  try {
    const user = await User.findOneAndDelete({ userId: req.params.userId, role: { $in: Object.keys(roles) } });
    if (!user) return res.status(404).json({ message: 'Staff account not found.' });
    await audit(req, user, 'staff_deleted', publicUser(user));
    res.json({ userId: user.userId, message: 'Staff account deleted.' });
  } catch (error) { failure(res, error); }
};
