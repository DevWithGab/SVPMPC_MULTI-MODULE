import React, { useState, useEffect, useCallback } from 'react';
import { FileEdit, Loader2 } from 'lucide-react';
import { noticeThresholdSettingAPI } from '../../../services/api';
import NoticeLetterEditorModal from './modals/NoticeLetterEditorModal';
import { legacyPlainTextToHtml } from '../../../utils/balanceNotice';

// Plain-text excerpt for the preview cards — content is HTML (or legacy
// plain text, normalized the same way the editor/printer does), so this
// strips tags down to readable text rather than dumping raw markup.
const previewText = (raw) => {
  if (!raw) return '—';
  const container = document.createElement('div');
  container.innerHTML = legacyPlainTextToHtml(raw);
  return container.textContent.trim() || '—';
};

export default function NoticeContentSettings({ user }) {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLevel, setEditingLevel] = useState(null); // 1 | 3 | null

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await noticeThresholdSettingAPI.getCurrentThresholds();
      setCurrent(res?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load notice documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-12">
      <p className="text-slate-500 text-sm">
        The actual letter text printed for each notice level — title, fields, body, and signatures. Edit it like a
        document; only the logo/org-name letterhead is fixed.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error && !current ? (
        <div className="py-16 text-center text-sm text-slate-400">{error}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-bold text-slate-900">Notice 1 &amp; 2 Document</p>
              <button
                onClick={() => setEditingLevel(1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-coop-green hover:underline shrink-0"
              >
                <FileEdit className="w-3.5 h-3.5" /> Edit Document
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-6">{previewText(current?.noticeBodyTemplate)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-bold text-slate-900">Final Notice Document</p>
              <button
                onClick={() => setEditingLevel(3)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-coop-green hover:underline shrink-0"
              >
                <FileEdit className="w-3.5 h-3.5" /> Edit Document
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-6">{previewText(current?.finalNoticeBodyTemplate)}</p>
          </div>
        </div>
      )}

      <NoticeLetterEditorModal
        isOpen={editingLevel !== null}
        onClose={() => setEditingLevel(null)}
        level={editingLevel}
        current={current}
        user={user}
        onSaved={load}
      />
    </div>
  );
}
