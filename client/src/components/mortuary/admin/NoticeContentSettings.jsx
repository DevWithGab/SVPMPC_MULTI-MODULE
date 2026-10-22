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
    <div className="fs-section">
      <p className="fs-section-description">
        First and second notices use the official cooperative form with automatic member details, date,
        and manager name. The final notice document can be edited below.
      </p>

      {loading ? (
        <div className="fs-loading" role="status" aria-label="Loading settings">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error && !current ? (
        <div className="py-16 text-center text-sm text-slate-400">{error}</div>
      ) : (
        <div className="fs-notice-grid">
          <div className="fs-panel fs-notice-card">
            <div className="fs-notice-heading">
              <p className="text-sm font-bold text-slate-900">Notice 1 &amp; 2 Document</p>
              <span className="text-xs text-slate-500">Official cooperative template</span>
            </div>
            <p className="fs-notice-preview line-clamp-6">MORTUARY AID FUND PROGRAM - FIRST NOTICE / SECOND NOTICE. Member name, address, passbook number, current balance, additional deposit, and date are filled automatically. Signed by MONINA C. GUZMAN, Manager.</p>
          </div>
          <div className="fs-panel fs-notice-card">
            <div className="fs-notice-heading">
              <p className="text-sm font-bold text-slate-900">Final Notice Document</p>
              <button
                onClick={() => setEditingLevel(3)}
                className="td-button"
              >
                <FileEdit className="w-3.5 h-3.5" /> Edit Document
              </button>
            </div>
            <p className="fs-notice-preview line-clamp-6">{previewText(current?.finalNoticeBodyTemplate)}</p>
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
