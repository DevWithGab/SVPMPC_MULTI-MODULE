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

/* Nasa ilalim ng /api/admin yung buong tree na ito, at gi-gate lang ito ng
server.js gamit ang authorizeAdminOnly (role 'admin' OR 'super_admin') - kung
walang module check, puwedeng makabasa at maka-write ng members ang isang
attendance-only o mortuary-only admin sa labas ng own module nila gamit itong
shared, unscoped path (confirmed live: isang attendance.admin token nakabasa
ng beneficiary data ng isang mortuary-only member at na-rewrite pa yung
`modules` array niya para bigyan ang sarili ng access). Lagi lang galing sa
SuperAdmin.jsx ang client papunta dito - bawat module-scoped admin may sarili
na properly-restricted member endpoints sa ilalim ng /api/attendance/admin at
/api/mortuary/admin - kaya ang pag-restrict dito sa super_admin, kagaya ng
/staff sa taas, nag-close ng gap na ito na walang nawawalang legitimate
functionality. */
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
