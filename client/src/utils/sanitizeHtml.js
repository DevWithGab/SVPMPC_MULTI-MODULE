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
export const sanitizeNoticeHtml = (html) => DOMPurify.sanitize(String(html || ''));
