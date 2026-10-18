// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle MongoDB cast errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle MongoDB duplicate field errors
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// Handle MongoDB validation errors
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Handle Multer upload errors (file too large, too many files, unexpected
// field, ...) — the uploader did something invalid, not a server bug, so
// this always gets a clean, friendly response, not a raw stack trace.
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: 'File is too large.',
  LIMIT_FILE_COUNT: 'Too many files.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
  LIMIT_FIELD_COUNT: 'Too many fields.',
  LIMIT_FIELD_KEY: 'Field name is too long.',
  LIMIT_FIELD_VALUE: 'Field value is too long.',
  LIMIT_PART_COUNT: 'Too many parts.',
};
const handleMulterError = (err) =>
  new AppError(
    MULTER_ERROR_MESSAGES[err.code] || 'File upload failed.',
    err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  );

// Send error response for development — for a genuine bug, dump everything
// for debugging; an operational error (expected: bad upload, bad request
// body, etc.) is just as noisy served raw, so show it the same clean way
// production does instead.
const sendErrorDev = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Send error response for production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong!'
    });
  }
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (err.name === 'MulterError') err = handleMulterError(err);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Many controllers catch their own errors locally and respond directly
// (res.status(500).json({..., error: error.message})) instead of calling
// next(error) — so globalErrorHandler's NODE_ENV gating above never runs for
// them, in any environment. Confirmed live: a crafted login payload
// surfaced a raw bcrypt internal error string this way. Rewiring every one
// of those call sites through next(error) would be the "proper" fix, but is
// a much larger, riskier change; gating just the leaked value at each site
// closes the actual hole without touching status codes, messages, or
// control flow otherwise. Mirrors globalErrorHandler's own convention
// above: anything other than the literal 'development' is treated as
// unsafe-to-show, the same fail-safe default used there.
// Accepts either an Error-like object (reads .message) or an already-plain
// string (e.g. a service function's own `{ success: false, error: '...' }`
// return value, passed straight into a response) — either way, nothing but
// development ever sees it.
const safeErrorMessage = (error) =>
  process.env.NODE_ENV === 'development' ? (error?.message ?? error) : undefined;

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  safeErrorMessage
};