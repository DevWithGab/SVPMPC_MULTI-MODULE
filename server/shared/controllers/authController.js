const { moduleRoles } = require('../utils/staffRoles');
const { isRetiredAttendanceAdmin } = require('../utils/retiredAccounts');
const User = require('../models/User');
const CredentialLog = require('../models/CredentialLog');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { safeErrorMessage } = require('../../middleware/errorHandler');

// Login
const login = async (req, res) => {
  try {
    const { username, password, expectedRole, module } = req.body;

    /* Yung typeof check sinasara niya yung totoong NoSQL operator-injection hole:
    kung wala nito, yung body na {"username":{"$ne":null},...} makaka-pasa sa
    !username truthiness check (truthy yung non-empty object) at magiging
    totoong query operator yung $or sa baba, so kung sino man yung user na
    ibabalik ng Mongo's query planner first ang matatama, hindi yung talagang
    tinukoy. Si bcrypt.compare naman throws na agad kung non-string yung
    password, kaya hindi naman ito full auth bypass dati, pero sira talaga
    yung filter mismo — confirmed live, yung {"$ne":null}/{"$gt":""} parehas
    tumama sa totoong user sa query level. Wala namang legit na case kung saan
    hindi string yung dalawang values na ito, kaya tama lang na i-reject din
    yung mali ang type dito, kasing-tama ng pag-reject sa missing value. */
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

    /* Retired na yung member self-service login - sa physically-issued
    QR codes na lang nakikita yung mga member, hindi na sa portal access. */
    if (user.role === 'member') {
      return res.status(403).json({
        message: 'Member self-service login is no longer available. Please contact the cooperative office.',
      });
    }

    if (isRetiredAttendanceAdmin(user)) {
      return res.status(403).json({ message: 'This Attendance admin account has been retired. Please contact the Super Admin for a staff account.' });
    }

    // Optional role gate to prevent cross-role logins from specific login forms
    if (expectedRole) {
      const allowedRolesByExpectedRole = {
        secretary: ['secretary'],
        scanner_operator: ['scanner_operator'],
        treasurer: ['treasurer', 'finance_officer'],
        finance_officer: ['finance_officer', 'treasurer'],
        claims_officer: ['claims_officer', 'admin'],
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

    /* Module gate: yung module choice sa login screen (Attendance vs Mortuary)
    dati hindi talaga nachecheck against sa account, kaya halimbawa yung
    Attendance-only admin puwede pa rin makapasok sa Mortuary admin login.
    Si super_admin by design naman nagmamanage ng both modules kaya sine-skip
    niya yung check na ito. */
    if (module && user.role !== 'super_admin' && (!user.modules?.includes(module) || !moduleRoles[module]?.includes(user.role))) {
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
        fullName: user.fullName,
        // Display name for the UI: full name, or the username if none is set.
        name: user.fullName?.trim() || user.username,
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
    if (isRetiredAttendanceAdmin(user)) return res.status(403).json({ message: 'This Attendance admin account has been retired.' });

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
