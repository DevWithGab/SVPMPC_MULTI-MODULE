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

    if (user.role === 'member') {
      return res.status(403).json({ success: false, message: 'Member self-service access is no longer available.' });
    }

    if (user.status !== 'active') return res.status(401).json({ message: 'Account is not active' });
    if ((decoded.sessionVersion || 0) !== (user.sessionVersion || 0)) return res.status(401).json({ message: 'Please sign in again' });
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

    if (req.user.role === 'super_admin') return next();
    if (!req.user.modules?.includes(module)) return res.status(403).json({ message: 'Module access denied' });
    // Check if user has access to the specific module
    const moduleAccess = {
      'mortuary': ['admin', 'treasurer'],
      /* Wala na self-service access ang Members sa attendance system - yung
      QR codes nila ay physically issued and used na lang. */
      'attendance': ['admin', 'secretary', 'scanner_operator']
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
const authorizeMortuaryRoles = authorizeRoles('admin', 'treasurer', 'super_admin');
/* Wala na self-service access ang Members sa attendance system - yung
QR codes nila ay physically issued and used na lang. */
const authorizeAttendanceRoles = authorizeRoles('admin', 'secretary', 'scanner_operator', 'super_admin');
const authorizeTreasurerOnly = authorizeRoles('treasurer', 'admin', 'super_admin');
const authorizeSecretaryOnly = authorizeRoles('secretary', 'admin', 'super_admin');
/* Parang admin-or-above ang treatment ng super_admin saanman ginagamit ang
authorizeAdminOnly - yung login gate (authController's expectedRole check)
pumapayag na naman na mag-sign in ang super_admin account sa "admin" login
para sa kahit anong module (allowedRolesByExpectedRole.admin = ['admin',
'super_admin']), at 'super_admin' ay first-class staff role na sa User
schema. Kung wala yung 'super_admin' dito, puwede ma-load ng super_admin na
nakarating sa Admin Portal by design ang read-only screens (karamihan sa
reads dumadaan sa mas permissive o legacy routes), pero every admin-only
write - approve/reject ng event, yung bagong Member QR actions - tahimik
na 403 na lang with "Access denied. Required roles: admin", kahit sila
mismo yung sinabi ng login screen na puwedeng dumito. */
const authorizeAdminOnly = authorizeRoles('admin', 'super_admin');

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

module.exports.requirePasswordChange = (req, res, next) => req.user.isTemporaryPassword ? res.status(403).json({ message: 'Change your temporary password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' }) : next();
