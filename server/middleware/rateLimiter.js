const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Keep each login form's failed-attempt bucket independent. A failed
// Attendance/admin login must not lock out a Mortuary/admin login or another
// role using the same network.
const loginKeyGenerator = (req) => {
  const { username = 'unknown', expectedRole = 'unknown', module = 'unknown' } = req.body || {};
  const ip = ipKeyGenerator(req.ip);
  return `${ip}:${String(username).trim().toLowerCase()}:${String(module).trim().toLowerCase()}:${String(expectedRole).trim().toLowerCase()}`;
};

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 5 minutes.' },
  keyGenerator: loginKeyGenerator,
  // Failed logins consume the limit; a successful one doesn't count against
  // the user for the rest of the window.
  skipSuccessfulRequests: true,
});

// Same brute-force exposure on change-password: an attacker with a stolen
// session/userId could otherwise guess the current password unlimited times.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

module.exports = { loginLimiter, changePasswordLimiter, loginKeyGenerator };
