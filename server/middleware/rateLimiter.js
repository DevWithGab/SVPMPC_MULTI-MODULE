const rateLimit = require('express-rate-limit');

// Login had no brute-force protection at all — anyone could hammer
// /api/auth/login with unlimited password guesses against any username.
// 10 attempts per 15 minutes per IP is generous for a genuine user
// (who mistypes a password a handful of times) while making credential
// stuffing / brute-forcing impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
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

module.exports = { loginLimiter, changePasswordLimiter };
