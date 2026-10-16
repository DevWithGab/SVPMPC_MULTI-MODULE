const auth = require('./auth');
const errorHandler = require('./errorHandler');
const rateLimiter = require('./rateLimiter');

module.exports = {
  ...auth,
  ...errorHandler,
  ...rateLimiter
};