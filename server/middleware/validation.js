const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
const validateObjectId = (field) => [
  param(field).isMongoId().withMessage(`Invalid ${field} format`)
];

const validateEmail = [
  body('email').isEmail().withMessage('Please provide a valid email address')
];

const validatePassword = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Authentication validation
const validateLogin = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateRegister = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['member', 'admin', 'secretary', 'treasurer', 'scanner_operator']).withMessage('Invalid role'),
  handleValidationErrors
];

// Mortuary validation rules
const validateContribution = [
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['cash', 'check', 'bank_transfer', 'gcash']).withMessage('Invalid payment method'),
  handleValidationErrors
];

const validateClaim = [
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason').notEmpty().withMessage('Claim reason is required'),
  handleValidationErrors
];

// Attendance validation rules
const validateEvent = [
  body('title').notEmpty().withMessage('Event title is required'),
  body('description').notEmpty().withMessage('Event description is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('location').notEmpty().withMessage('Event location is required'),
  handleValidationErrors
];

const validateAttendance = [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('memberId').notEmpty().withMessage('Member ID is required'),
  handleValidationErrors
];

// SMS notification validation
const validateSMSNotification = [
  body('message').notEmpty().withMessage('Message is required'),
  body('message').isLength({ max: 160 }).withMessage('Message must be 160 characters or less'),
  body('recipients').isIn(['all', 'active', 'delinquent', 'specific']).withMessage('Invalid recipient type'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateObjectId,
  validateEmail,
  validatePassword,
  validateLogin,
  validateRegister,
  validateContribution,
  validateClaim,
  validateEvent,
  validateAttendance,
  validateSMSNotification,
  validatePagination
};