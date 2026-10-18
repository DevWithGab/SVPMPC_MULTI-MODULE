const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeNoticeHtml } = require('../modules/mortuary/controllers/noticeThresholdSettingController');

// Regression coverage for noticeThresholdSettingController's regex-based
// HTML sanitizer — the server-side defense-in-depth backstop behind the
// client's DOMPurify pass (see client/tests/sanitizeHtml.test.mjs for that
// primary defense). It previously required a literal space before `on\w+=`
// and a quoted attribute value, which let an unquoted (`onerror=alert(1)`)
// or slash-separated (`<img/onerror=...>`) attribute straight through —
// both confirmed live before the fix. This isn't a full HTML parser, so it
// only needs to not have known holes, not match DOMPurify's coverage.

test('strips an unquoted event-handler attribute', () => {
  assert.doesNotMatch(sanitizeNoticeHtml('<img src=x onerror=alert(1)>'), /onerror/i);
});

test('strips a slash-separated event-handler attribute', () => {
  assert.doesNotMatch(sanitizeNoticeHtml('<img/onerror=alert(1)/src=x>'), /onerror/i);
});

test('neutralizes a javascript: href in either quote style', () => {
  assert.equal(sanitizeNoticeHtml('<a href="javascript:alert(1)">click</a>'), '<a href="#">click</a>');
  assert.equal(sanitizeNoticeHtml("<a href='javascript:alert(1)'>click</a>"), "<a href='#'>click</a>");
});

test('removes script and style blocks entirely, including their content', () => {
  assert.equal(sanitizeNoticeHtml('<script>alert(1)</script>Hi'), 'Hi');
  assert.equal(sanitizeNoticeHtml('<style>body{color:red}</style>Hi'), 'Hi');
});

test('strips the opening tag of iframe/object/embed/form/base/meta', () => {
  assert.doesNotMatch(sanitizeNoticeHtml('<iframe src=evil.com></iframe>Hi'), /<iframe/i);
  assert.doesNotMatch(sanitizeNoticeHtml('<object data=evil.swf></object>Hi'), /<object/i);
});

test('preserves ordinary rich-text formatting', () => {
  assert.equal(sanitizeNoticeHtml('<p>Hello <strong>World</strong></p>'), '<p>Hello <strong>World</strong></p>');
});

test('handles null, undefined, and non-string input without throwing', () => {
  assert.equal(sanitizeNoticeHtml(null), '');
  assert.equal(sanitizeNoticeHtml(undefined), '');
  assert.equal(sanitizeNoticeHtml(42), '42');
});
