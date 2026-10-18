import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeNoticeHtml } from '../src/utils/sanitizeHtml.js';

// Regression coverage for the XSS fix in the Notice Letter editor: a
// hand-rolled regex/DOM-attribute-stripping sanitizer missed unquoted and
// slash-separated event-handler attributes, which DOMPurify (a real HTML
// parser) does not. Each case below is a payload that specifically
// bypassed the old sanitizer, confirmed live before this fix shipped.

test('strips an unquoted event-handler attribute (the first confirmed bypass)', () => {
  const output = sanitizeNoticeHtml('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(output, /onerror/i);
  assert.doesNotMatch(output, /alert/i);
});

test('strips a slash-separated event-handler attribute (the second confirmed bypass)', () => {
  const output = sanitizeNoticeHtml('<img/onerror=alert(1)/src=x>');
  assert.doesNotMatch(output, /onerror/i);
  assert.doesNotMatch(output, /alert/i);
});

test('strips a javascript: href while keeping the link\'s visible text', () => {
  const output = sanitizeNoticeHtml('<a href="javascript:alert(1)">click</a>');
  assert.doesNotMatch(output, /javascript:/i);
  assert.match(output, /click/);
});

test('removes script tags entirely, including their content', () => {
  const output = sanitizeNoticeHtml('<script>alert(1)</script>Account balance notice');
  assert.doesNotMatch(output, /<script/i);
  assert.doesNotMatch(output, /alert\(1\)/);
  assert.match(output, /Account balance notice/);
});

test('removes an inline onclick handler on an ordinary element', () => {
  const output = sanitizeNoticeHtml('<p onclick="alert(1)">Hello</p>');
  assert.doesNotMatch(output, /onclick/i);
  assert.match(output, /Hello/);
});

test('preserves ordinary rich-text formatting used by the balance notice template', () => {
  const output = sanitizeNoticeHtml('<p>Dear <strong>Member</strong>, your balance is <em>-₱2,000.00</em>.</p><ul><li>Item</li></ul>');
  assert.match(output, /<strong>Member<\/strong>/);
  assert.match(output, /<em>-₱2,000\.00<\/em>/);
  assert.match(output, /<li>Item<\/li>/);
});

test('handles null, undefined, and non-string input without throwing', () => {
  assert.equal(sanitizeNoticeHtml(null), '');
  assert.equal(sanitizeNoticeHtml(undefined), '');
  assert.equal(sanitizeNoticeHtml(42), '42');
});
