import React, { useState, useEffect, useCallback } from 'react';
import { FileEdit, Loader2 } from 'lucide-react';
import { noticeThresholdSettingAPI } from '../../../services/api';
import { getNoticeMessageTemplate } from '../../../utils/cooperativeNotice';
import NoticeLetterEditorModal from './modals/NoticeLetterEditorModal';

export default function NoticeContentSettings() {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLevel, setEditingLevel] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await noticeThresholdSettingAPI.getCurrentThresholds(); setCurrent(response.data); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load notice content.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="fs-section">
      <p className="fs-section-description">Edit the messages used in printed and downloaded notices. The official cooperative layout and automatic member details are preserved. First and second notices share the same message.</p>
      {loading ? <div className="fs-loading" role="status" aria-label="Loading notice content"><Loader2 className="w-6 h-6 animate-spin" /></div> : error ? <div role="alert" className="text-sm text-red-600">{error}<button className="td-button ml-3" onClick={load}>Retry</button></div> : <div className="fs-notice-grid">
        {[[1, 'First & Second Notice Content'], [3, 'Final Notice Content']].map(([level, title]) => <div key={level} className="fs-panel fs-notice-card"><div className="fs-notice-heading"><p className="text-sm font-bold text-slate-900">{title}</p><button className="td-button" onClick={() => setEditingLevel(level)}><FileEdit className="w-3.5 h-3.5" />Edit Content</button></div><p className="fs-notice-preview line-clamp-6 whitespace-pre-line">{getNoticeMessageTemplate(current, level)}</p></div>)}
      </div>}
      {editingLevel !== null && current && <NoticeLetterEditorModal key={editingLevel} level={editingLevel} current={current} onClose={() => setEditingLevel(null)} onSaved={load} />}
    </div>
  );
}
