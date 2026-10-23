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

/* Handle Multer upload errors (file too large, too many files, unexpected
field, ...) - mali yung ginawa ng uploader, hindi server bug, kaya laging
clean at friendly response ang ibabalik dito, hindi raw stack trace. */
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

/* Send error response for development - kung genuine bug, dump everything
para sa debugging; pero kung operational error (expected: bad upload, bad
request body, etc.) ay parang noise lang din kung raw ang serve, so ibigay
na lang yung same clean way na ginagawa sa production. */
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

/* Marami sa controllers ang catch nila ang own errors locally at direktang
nag-respond (res.status(500).json({..., error: error.message})) imbes na
tumawag ng next(error) - kaya hindi tumatakbo yung NODE_ENV gating sa
globalErrorHandler sa itaas para sa kanila, sa kahit anong environment.
Confirmed live: isang crafted login payload ay nag-expose ng raw bcrypt
internal error string sa ganitong paraan. Ang i-rewire lahat ng call sites
papunta sa next(error) ay magiging "proper" fix, pero mas malaki at mas
risky yung change; mas mabuti na lang gating yung leaked value sa bawat
site - naayos na ang actual hole without touching status codes, messages,
or control flow. Sumusunod lang ito sa convention na ginagamit na ng
globalErrorHandler sa itaas: kung hindi literal na 'development', treated
as unsafe-to-show, parehong fail-safe default na ginagamit dun.

Tumatanggap ito ng Error-like object (binabasa yung .message) o plain
string na (e.g. return value ng isang service function na mismong
`{ success: false, error: '...' }`, na direktang pumapasok sa response) -
pareho lang, wala namang makakakita nito kundi development. */
const safeErrorMessage = (error) =>
  process.env.NODE_ENV === 'development' ? (error?.message ?? error) : undefined;

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  safeErrorMessage
};