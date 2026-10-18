const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const staff = require('../controllers/staffController');
const { authorizeRoles } = require('../../middleware/auth');
const { staffActionLimiter, bulkUploadLimiter } = require('../../middleware');
router.use('/staff', authorizeRoles('super_admin'));
router.get('/staff', staff.list);
router.post('/staff', staffActionLimiter, staff.create);
router.put('/staff/:userId', staff.update);
router.delete('/staff/:userId', staff.remove);
router.post('/staff/:userId/reset-password', staffActionLimiter, staff.resetPassword);

// This whole tree sits under /api/admin, which server.js only gates with
// authorizeAdminOnly (role 'admin' OR 'super_admin') — with no module check,
// that let an attendance-only or mortuary-only admin read and write members
// outside their own module via this shared, unscoped path (confirmed live:
// an attendance.admin token read a mortuary-only member's beneficiary data
// and rewrote its `modules` array to grant itself access). The client only
// ever reaches this path from SuperAdmin.jsx — every module-scoped admin
// already has their own properly-restricted member endpoints under
// /api/attendance/admin and /api/mortuary/admin — so restricting it to
// super_admin, same as /staff above, closes the gap with no loss of any
// legitimate functionality.
router.use('/members', authorizeRoles('super_admin'));

// Create a member record
router.post('/members/create', adminController.createMember);

// Bulk create members from CSV
router.post('/members/bulk-create', bulkUploadLimiter, adminController.bulkCreateMembers);

// Get all members
router.get('/members', adminController.getAllMembers);

// Update member
router.put('/members/:memberId', adminController.updateMember);

// Delete member (soft delete)
router.delete('/members/:memberId', adminController.deleteMember);

// Toggle a member between active and inactive
router.post('/members/:memberId/toggle-status', adminController.toggleMemberStatus);


module.exports = router;
