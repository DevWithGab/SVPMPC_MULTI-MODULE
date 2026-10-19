const User = require('../models/User');
const CredentialLog = require('../models/CredentialLog');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { safeErrorMessage } = require('../../middleware/errorHandler');

// Login
const login = async (req, res) => {
  try {
    const { username, password, expectedRole, module } = req.body;

    // typeof check closes a real NoSQL operator-injection hole: without it,
    // a crafted body like {"username":{"$ne":null},...} passes the !username
    // truthiness check (a non-empty object is truthy) and turns the $or
    // below into a real query operator, matching whichever user Mongo's
    // query planner returns first instead of the one actually named.
    // bcrypt.compare already throws on a non-string password, so this was
    // never a full auth bypass today, but the filter itself was broken —
    // confirmed live, {"$ne":null}/{"$gt":""} both matched a real user at
    // the query level. Neither value is ever legitimately anything but a
    // string, so rejecting the wrong type here is exactly as correct as
    // rejecting a missing one.
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check status
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Member self-service login has been retired — members are handled via
    // physically-issued QR codes instead of portal access.
    if (user.role === 'member') {
      return res.status(403).json({
        message: 'Member self-service login is no longer available. Please contact the cooperative office.',
      });
    }

    // Optional role gate to prevent cross-role logins from specific login forms
    if (expectedRole) {
      const allowedRolesByExpectedRole = {
        secretary: ['secretary'],
        scanner_operator: ['scanner_operator'],
        treasurer: ['treasurer'],
        admin: ['admin', 'super_admin'],
        super_admin: ['super_admin'],
      };

      const allowedRoles = allowedRolesByExpectedRole[expectedRole] || [expectedRole];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          message: `This account cannot sign in as ${expectedRole.replace('_', ' ')}.`,
        });
      }
    }

    // Module gate: the login screen's module choice (Attendance vs Mortuary)
    // was previously never checked against the account, so e.g. an
    // Attendance-only admin could sign in through the Mortuary admin login
    // too. super_admin manages both modules by design and skips this check.
    if (module && user.role !== 'super_admin' && !user.modules?.includes(module)) {
      return res.status(403).json({
        message: `This account isn't registered for the ${module} system.`,
      });
    }

    // Update last login
    user.lastLoginDate = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        sessionVersion: user.sessionVersion || 0,
        userId: user.userId,
        memberId: user.memberId,
        staffId: user.staffId,
        username: user.username,
        modules: user.modules,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        memberId: user.memberId,
        staffId: user.staffId,
        username: user.username,
        email: user.email,
        isTemporaryPassword: user.isTemporaryPassword,
        modules: user.modules,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: safeErrorMessage(error) });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }


    // Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    if (user.role === 'member') {
      return res.status(403).json({ message: 'Member self-service access is no longer available.' });
    }

    if (typeof newPassword !== 'string' || Buffer.byteLength(newPassword, 'utf8') > 72 || newPassword.length < 12 || newPassword === currentPassword) return res.status(400).json({ message: 'Use a different password with at least 12 characters (maximum 72 bytes)' });

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.passwordHash = newPassword;
    user.isTemporaryPassword = false;
    user.lastPasswordChangeDate = new Date();
    // All previously issued tokens carry the old version, including this session.
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    // Log password change
    const credentialLog = new CredentialLog({
      logId: uuidv4(),
      userId: user.userId,
      memberId: user.memberId || null,
      staffId: user.staffId || null,
      action: 'password_changed',
      status: 'success',
    });

    await credentialLog.save();

    res.status(200).json({
      message: 'Password changed successfully. Please sign in again.',
      requiresReauthentication: true,
      user: {
        userId: user.userId,
        isTemporaryPassword: user.isTemporaryPassword,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: safeErrorMessage(error) });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      userId: user.userId,
      memberId: user.memberId,
      staffId: user.staffId,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isTemporaryPassword: user.isTemporaryPassword,
      lastLoginDate: user.lastLoginDate,
      lastPasswordChangeDate: user.lastPasswordChangeDate,
      status: user.status,
      modules: user.modules,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: safeErrorMessage(error) });
  }
};

// Get credential history
const getCredentialHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await CredentialLog.find({ userId })
      .sort({ sentDate: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      userId,
      totalLogs: logs.length,
      logs: logs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: safeErrorMessage(error) });
  }
};

// Verify token
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId });
    if (!user || user.status !== 'active' || (decoded.sessionVersion || 0) !== (user.sessionVersion || 0)) return res.status(401).json({ message: 'Please sign in again' });

    if (decoded.role === 'member') {
      return res.status(403).json({ message: 'Member self-service access is no longer available.' });
    }

    res.status(200).json({
      message: 'Token is valid',
      decoded,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: safeErrorMessage(error) });
  }
};

module.exports = {
  login,
  changePassword,
  getUserProfile,
  getCredentialHistory,
  verifyToken,
};
