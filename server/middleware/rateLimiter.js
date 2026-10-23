const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { createHash } = require('node:crypto');
const { MongoRateLimitStore } = require('./mongoRateLimitStore');

/* Lahat ng processes gumagamit ng application's MongoDB database. Yung
separate namespaces ang nagpipigil para hindi maubos ng isang kind of
action yung allowance ng ibang action. */
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

/* Isang counter per login identifier, across IPs, modules, at roles. Yung
hashing ang nagpapanatili ng keys bounded at umiiwas mag-store ng
usernames/emails sa limiter store. */
const loginKeyGenerator = (req) => {
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : '';
  return createHash('sha256').update(username).digest('hex');
};

/* May independent IP limit din para mahuli yung password spraying across
usernames. Mas mataas yung threshold para kasya yung staff na shared ang
office connection. */
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
  /* Yung failed logins ang kumokonsumo ng limit; kung successful, hindi na
  ito bibilangin against the user para sa rest of the window. */
  skipSuccessfulRequests: true,
});

/* Parehong brute-force exposure ito sa change-password: puwedeng gamitin ng
attacker na may stolen session/userId para guess ng unlimited times yung
current password kung wala nito. */
const changePasswordLimiter = sharedLimiter('change-password', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

/* Tumatakbo ito after authenticateToken, kaya laging set ang req.user -
yung pag-key sa account mismo (hindi lang IP) ang pumipigil sa isang
stolen/compromised token na mag-hammer ng mga endpoints na ito mula sa
shared office IP without throttling sa ibang admin na kapareho ng address.
Fallback lang yung IP para sa theoretical case na tumakbo ito before auth. */
const accountKeyGenerator = (req) => req.user?.userId || ipKeyGenerator(req.ip);

/* Unbounded dati yung staff creation at password reset - puwedeng mag-spam
ng account creation o paulit-ulit na force-reset ng credentials ng ibang
staffer ang isang compromised super_admin token (o buggy client retry
loop) dahil walang limit talaga. */
const staffActionLimiter = sharedLimiter('staff-action', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many staff account changes. Please try again in 15 minutes.' },
  keyGenerator: accountKeyGenerator,
});

/* Heavy, rare, at deliberate admin actions yung bulk CSV imports (members,
contributions, ledger) - di kagaya ng staff changes, may real processing
time pa sila per request, kaya mas tight ang cap. */
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
