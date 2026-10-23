import DOMPurify from 'dompurify';

/* Yung notice-letter documents (Mortuary Admin → Notice Thresholds → Edit
Document) ay admin-authored rich text, pero ni-render pa rin sila via
innerHTML/dangerouslySetInnerHTML/document.write sa tatlong lugar
(NoticeLetterEditorModal.jsx, balanceNotice.js's print flow) - dati gamit
ng hand-rolled regex sanitizer sa save path, pero hindi reliable yung regex
sa pag-parse ng HTML attribute syntax (confirmed bypasses: unquoted
attribute values tulad ng `onerror=alert(1)` at slash-separated gaya ng
`<img/onerror=...>`, dumadaan pa rin). DOMPurify kasi talagang nag-parse ng
real DOM at allowlist lang yung safe tags/attributes imbes blocklist yung
dangerous syntax, kaya hindi na siya nalolokohan kung paano nasulat yung
attribute. Ginagamit ito sa save path at sa lahat ng render sink, kasi yung
content na na-store bago pa ma-fix ito (o diretsong isinulat via API) ay
hindi dapat basta trust-in kahit nasa database na siya. */

/* Yung browser build ng DOMPurify ay self-initialize gamit yung global
`window`, na laging meron naman yung app. Pero pag tumatakbo ito sa plain
Node (yung sariling test suite), kailangan muna i-provide yung same global
bago mag-load yung module - tignan sa tests/setup-dom.mjs, na preloaded via
package.json's test script - imbes na mag-branch base sa environment dito. */
export const sanitizeNoticeHtml = (html) => DOMPurify.sanitize(String(html || ''));
