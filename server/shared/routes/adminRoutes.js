const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Create single member with account
router.post('/members/create', adminController.createMemberWithAccount);

// Bulk create members from CSV
router.post('/members/bulk-create', adminController.bulkCreateMembers);

// Get all members
router.get('/members', adminController.getAllMembers);

// Update member
router.put('/members/:memberId', adminController.updateMember);

// Delete member (soft delete)
router.delete('/members/:memberId', adminController.deleteMember);

// Reset member password
router.post('/members/:memberId/reset-password', adminController.resetMemberPassword);

module.exports = router;
