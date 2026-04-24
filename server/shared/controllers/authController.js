const User = require('../models/User');
const CredentialLog = require('../models/CredentialLog');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user
    const user = await User.findOne({ username });
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

    // Update last login
    user.lastLoginDate = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.userId,
        memberId: user.memberId,
        username: user.username,
        modules: user.modules,
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        memberId: user.memberId,
        username: user.username,
        email: user.email,
        isTemporaryPassword: user.isTemporaryPassword,
        modules: user.modules,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }

    // Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.passwordHash = newPassword;
    user.isTemporaryPassword = false;
    user.lastPasswordChangeDate = new Date();
    await user.save();

    // Log password change
    const credentialLog = new CredentialLog({
      logId: uuidv4(),
      userId: user.userId,
      memberId: user.memberId,
      action: 'password_changed',
      status: 'success',
    });

    await credentialLog.save();

    res.status(200).json({
      message: 'Password changed successfully',
      user: {
        userId: user.userId,
        isTemporaryPassword: user.isTemporaryPassword,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
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
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
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
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
};

// Verify token
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    res.status(200).json({
      message: 'Token is valid',
      decoded,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

module.exports = {
  login,
  changePassword,
  getUserProfile,
  getCredentialHistory,
  verifyToken,
};
