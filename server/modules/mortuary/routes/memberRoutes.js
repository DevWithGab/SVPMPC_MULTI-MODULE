const express = require('express');
const { 
  fileNewClaim,
  getClaimHistory,
  getClaimById,
  approveClaim,
  rejectClaim,
  payClaim
} = require('../controllers/claimController');

const { 
  recordContribution,
  getContributionHistory,
  getAllContributions
} = require('../controllers/contributionController');

const { 
  getDashboard
} = require('../controllers/dashboardController');

const router = express.Router();

// Dashboard routes (Member can view their dashboard)
router.get('/dashboard/:memberId', getDashboard);

// Contribution routes (Member can view their contributions)
router.get('/contributions/:memberId', getContributionHistory);

// Claim routes (Member can manage their claims)
router.post('/claims/file', fileNewClaim);
router.get('/claims/:memberId', getClaimHistory);
router.get('/claims/detail/:claimId', getClaimById);

module.exports = router;