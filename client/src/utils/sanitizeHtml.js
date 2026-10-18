import DOMPurify from 'dompurify';

// The notice-letter documents (Mortuary Admin → Notice Thresholds → Edit
// Document) are admin-authored rich text, but still get rendered via
// innerHTML/dangerouslySetInnerHTML/document.write in three places
// (NoticeLetterEditorModal.jsx, balanceNotice.js's print flow) — a hand-rolled
// regex sanitizer used to guard the save path, but regex can't reliably
// parse HTML attribute syntax (confirmed bypasses: unquoted attribute values
// like `onerror=alert(1)` and slash-separated ones like `<img/onerror=...>`
// both slipped through). DOMPurify parses a real DOM and allowlists safe
// tags/attributes instead of blocklisting dangerous syntax, so it isn't
// fooled by how an attribute is written. Used at both the save path and
// every render sink, since content stored before this fix (or written
// directly via the API) must not be trusted just because it's already in
// the database.
//
// DOMPurify's browser build self-initializes against the global `window`,
// which the app always has. Running this file under plain Node (its own
// test suite) needs that same global provided before this module loads —
// see tests/setup-dom.mjs, preloaded via package.json's test script —
// rather than branching on environment here.
export const sanitizeNoticeHtml = (html) => DOMPurify.sanitize(String(html || ''));
