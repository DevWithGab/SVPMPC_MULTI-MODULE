const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { createHash } = require('node:crypto');
const { MongoRateLimitStore } = require('./mongoRateLimitStore');

// All processes use the application's MongoDB database. Separate namespaces
// prevent one kind of action from consuming another action's allowance.
const sharedLimiter = (prefix, options) => {
  const store = new MongoRateLimitStore({ prefix });
  const identify = options.keyGenerator || (req => ipKeyGenerator(req.ip));
  return rateLimit({
    ...options,
    store,
    keyGenerator: req => store.key(identify(req)),
    passOnStoreError: false,
  });
};

// One counter per login identifier, across IPs, modules, and roles. Hashing
// keeps keys bounded and avoids storing usernames/emails in the limiter store.
const loginKeyGenerator = (req) => {
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : '';
  return createHash('sha256').update(username).digest('hex');
};

// An independent IP limit also catches password spraying across usernames.
// The higher threshold accommodates staff sharing the same office connection.
const loginIpLimiter = sharedLimiter('login-ip', {
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 5 minutes.' },
  keyGenerator: req => ipKeyGenerator(req.ip),
  skipSuccessfulRequests: true,
});

const loginLimiter = sharedLimiter('login-account', {
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
const changePasswordLimiter = sharedLimiter('change-password', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// These run after authenticateToken, so req.user is always set — keying on
// the account itself (not just IP) stops a stolen/compromised token from
// hammering these endpoints from a shared office IP without throttling every
// other admin behind the same address. IP is only a fallback for the
// theoretical case this runs before auth.
const accountKeyGenerator = (req) => req.user?.userId || ipKeyGenerator(req.ip);

// Staff creation and password reset were previously unbounded — a
// compromised super_admin token (or a buggy client retry loop) could spam
// account creation or repeatedly force-reset another staffer's credentials
// with no limit at all.
const staffActionLimiter = sharedLimiter('staff-action', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many staff account changes. Please try again in 15 minutes.' },
  keyGenerator: accountKeyGenerator,
});

// Bulk CSV imports (members, contributions, ledger) are heavy, rare,
// deliberate admin actions — unlike staff changes they also cost real
// processing time per request, so the cap is tighter.
const bulkUploadLimiter = sharedLimiter('bulk-upload', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many bulk upload attempts. Please try again in 15 minutes.' },
  keyGenerator: accountKeyGenerator,
});

module.exports = {
  loginIpLimiter,
  loginLimiter,
  changePasswordLimiter,
  loginKeyGenerator,
  staffActionLimiter,
  bulkUploadLimiter,
};
