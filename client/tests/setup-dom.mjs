// Preloaded via package.json's test script (`node --import ./tests/setup-dom.mjs`)
// before any test file loads. DOMPurify's browser build self-initializes
// against whatever global `window` exists at import time — real in the app,
// absent under plain `node --test`. This gives it a real DOM (via jsdom) so
// sanitizeHtml.js's import of 'dompurify' resolves to a genuine working
// sanitizer instead of the bare, un-initialized factory function Node sees
// with no window — the same real sanitization logic the browser runs, just
// hosted in a Node-simulated DOM instead of an actual one.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
