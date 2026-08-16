// Role-based controllers
const memberControllers = require('./member');
const secretaryControllers = require('./secretary');

// Legacy controllers (for backward compatibility)
const memberController = require('./memberController');
const eventController = require('./eventController');
const attendanceController = require('./attendanceController');

module.exports = {
  // Role-based exports
  member: memberControllers,
  secretary: secretaryControllers,

  // Legacy exports (for backward compatibility)
  memberController,
  eventController,
  attendanceController,
};
