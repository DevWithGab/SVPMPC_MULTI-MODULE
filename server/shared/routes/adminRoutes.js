const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const staff = require('../controllers/staffController');
const { authorizeRoles } = require('../../middleware/auth');
router.use('/staff', authorizeRoles('super_admin'));
router.get('/staff', staff.list);
router.post('/staff', staff.create);
router.put('/staff/:userId', staff.update);
router.delete('/staff/:userId', staff.remove);
router.post('/staff/:userId/reset-password', staff.resetPassword);

// Create a member record
router.post('/members/create', adminController.createMember);

// Bulk create members from CSV
router.post('/members/bulk-create', adminController.bulkCreateMembers);

// Get all members
router.get('/members', adminController.getAllMembers);

// Update member
router.put('/members/:memberId', adminController.updateMember);

// Delete member (soft delete)
router.delete('/members/:memberId', adminController.deleteMember);

// Toggle a member between active and inactive
router.post('/members/:memberId/toggle-status', adminController.toggleMemberStatus);


module.exports = router;
