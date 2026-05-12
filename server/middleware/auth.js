const jwt = require('jsonwebtoken');
const User = require('../shared/models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId }).select('-passwordHash');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Middleware to check user roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }

    next();
  };
};

// Middleware to check module access
const authorizeModule = (module) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Check if user has access to the specific module
    const moduleAccess = {
      'mortuary': ['member', 'admin', 'treasurer'],
      'attendance': ['member', 'admin', 'secretary', 'scanner_operator']
    };

    if (!moduleAccess[module] || !moduleAccess[module].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied to ${module} module` 
      });
    }

    next();
  };
};

// Middleware for specific role combinations
const authorizeMortuaryRoles = authorizeRoles('member', 'admin', 'treasurer');
const authorizeAttendanceRoles = authorizeRoles('member', 'admin', 'secretary', 'scanner_operator');
const authorizeTreasurerOnly = authorizeRoles('treasurer', 'admin');
const authorizeSecretaryOnly = authorizeRoles('secretary', 'admin');
const authorizeAdminOnly = authorizeRoles('admin');

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeModule,
  authorizeMortuaryRoles,
  authorizeAttendanceRoles,
  authorizeTreasurerOnly,
  authorizeSecretaryOnly,
  authorizeAdminOnly
};