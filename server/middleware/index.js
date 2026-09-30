const auth = require('./auth');
const validation = require('./validation');
const errorHandler = require('./errorHandler');
const rateLimiter = require('./rateLimiter');

module.exports = {
  ...auth,
  ...validation,
  ...errorHandler,
  ...rateLimiter
};