const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, globalErrorHandler, catchAsync, safeErrorMessage } = require('../middleware/errorHandler');

// Regression coverage for the fix behind ~23 controllers' error responses:
// many controllers catch their own errors and respond directly instead of
// calling next(error), so globalErrorHandler's NODE_ENV gating never ran
// for them — confirmed live, a crafted login payload once leaked a raw
// bcrypt internal error string. safeErrorMessage closes that at each call
// site; these tests pin down both halves (development shows detail,
// anything else hides it) so a future change can't silently widen or
// narrow that gate.
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

// process.env.NODE_ENV is read at call time by both functions under test,
// but it's still global process state — always restore it, even on
// failure, so a failing assertion here can't leak a changed NODE_ENV into
// every other test file this suite runs afterward.
function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try { return fn(); } finally { process.env.NODE_ENV = previous; }
}

test('safeErrorMessage shows the real message only in development', () => {
  const error = new Error('bcrypt internal failure detail');
  withNodeEnv('development', () => assert.equal(safeErrorMessage(error), 'bcrypt internal failure detail'));
  withNodeEnv('production', () => assert.equal(safeErrorMessage(error), undefined));
  withNodeEnv('test', () => assert.equal(safeErrorMessage(error), undefined));
  withNodeEnv(undefined, () => assert.equal(safeErrorMessage(error), undefined));
});

test('safeErrorMessage accepts a raw string (a service\'s own {success:false, error} return value), not just an Error object', () => {
  withNodeEnv('development', () => assert.equal(safeErrorMessage('plain string error'), 'plain string error'));
  withNodeEnv('production', () => assert.equal(safeErrorMessage('plain string error'), undefined));
});

test('globalErrorHandler shows full detail for a programming error only in development', () => {
  const err = new Error('unexpected null pointer somewhere deep');
  err.statusCode = 500;

  withNodeEnv('development', () => {
    const res = response();
    globalErrorHandler({ ...err, message: err.message, stack: err.stack, statusCode: 500, isOperational: false }, {}, res, () => {});
    assert.equal(res.code, 500);
    assert.equal(res.data.message, 'unexpected null pointer somewhere deep');
    assert.ok('stack' in res.data, 'dev response includes the stack for a real bug');
  });

  withNodeEnv('production', () => {
    const res = response();
    globalErrorHandler({ message: err.message, stack: err.stack, statusCode: 500, isOperational: false }, {}, res, () => {});
    assert.equal(res.code, 500);
    assert.equal(res.data.message, 'Something went wrong!', 'production must never leak the real internal message');
    assert.equal(res.data.stack, undefined);
  });
});

test('globalErrorHandler always shows an operational error\'s own clean message, dev or production', () => {
  // Error/AppError's `message` is not an enumerable own property, so a
  // plain spread drops it — reconstruct the plain shape globalErrorHandler
  // actually receives (statusCode/status/isOperational/message) explicitly,
  // same as the dev-vs-production test above.
  const asPlainError = () => {
    const operational = new AppError('Member not found', 404);
    return { statusCode: operational.statusCode, status: operational.status, isOperational: operational.isOperational, message: operational.message };
  };

  withNodeEnv('development', () => {
    const res = response();
    globalErrorHandler(asPlainError(), {}, res, () => {});
    assert.equal(res.code, 404);
    assert.equal(res.data.message, 'Member not found');
  });

  withNodeEnv('production', () => {
    const res = response();
    globalErrorHandler(asPlainError(), {}, res, () => {});
    assert.equal(res.code, 404);
    assert.equal(res.data.message, 'Member not found');
  });
});

test('globalErrorHandler translates known Mongoose/JWT error shapes in production without leaking their raw detail', () => {
  const cases = [
    { err: { name: 'CastError', path: 'memberId', value: '{$ne:null}', message: 'Cast failed' }, status: 400, match: /Invalid memberId/ },
    { err: { code: 11000, errmsg: 'E11000 duplicate key error collection: db.members index: email_1 dup key: { email: "x@test.com" }' }, status: 400, match: /Duplicate field value/ },
    { err: { name: 'ValidationError', errors: { email: { message: 'Email is required' } } }, status: 400, match: /Invalid input data/ },
    { err: { name: 'JsonWebTokenError' }, status: 401, match: /Invalid token/ },
    { err: { name: 'TokenExpiredError' }, status: 401, match: /expired/ },
  ];
  for (const { err, status, match } of cases) {
    withNodeEnv('production', () => {
      const res = response();
      globalErrorHandler({ statusCode: 500, status: 'error', ...err }, {}, res, () => {});
      assert.equal(res.code, status, JSON.stringify(err));
      assert.match(res.data.message, match, JSON.stringify(err));
    });
  }
});

test('globalErrorHandler converts a Multer upload error before the dev/production branch, in either mode', () => {
  for (const nodeEnv of ['development', 'production']) {
    withNodeEnv(nodeEnv, () => {
      const res = response();
      globalErrorHandler({ name: 'MulterError', code: 'LIMIT_FILE_SIZE', statusCode: 500, isOperational: false }, {}, res, () => {});
      assert.equal(res.code, 413);
      assert.equal(res.data.message, 'File is too large.');
    });
  }
});

test('catchAsync forwards a rejected promise to next(error) instead of leaving it unhandled', async () => {
  const boom = new Error('async failure');
  const wrapped = catchAsync(async () => { throw boom; });
  let caught;
  await wrapped({}, {}, (error) => { caught = error; });
  assert.equal(caught, boom);
});
