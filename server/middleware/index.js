const auth = require('./auth');
const validation = require('./validation');
const errorHandler = require('./errorHandler');

module.exports = {
  ...auth,
  ...validation,
  ...errorHandler
};