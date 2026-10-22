import React, { useState, useEffect, useCallback } from 'react';
import { FileEdit, Loader2 } from 'lucide-react';
import { noticeThresholdSettingAPI } from '../../../services/api';
import { getNoticeMessageTemplate, getNoticeManagerName } from '../../../utils/cooperativeNotice';
import { DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import NoticeLetterEditorModal from './modals/NoticeLetterEditorModal';

export default function NoticeContentSettings() {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLevel, setEditingLevel] = useState(null);
  const [managerName, setManagerName] = useState('');
  const [savingManager, setSavingManager] = useState(false);
  const [managerError, setManagerError] = useState('');
  const [managerSaved, setManagerSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await noticeThresholdSettingAPI.getCurrentThresholds(); setCurrent(response.data); setManagerName(getNoticeManagerName(response.data)); }
    catch (err) { setError(err.response?.data?.message || 'Unable to load notice content.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const saveManager = async event => {
    event.preventDefault(); setManagerError(''); setManagerSaved(false);
    if (!managerName.trim()) { setManagerError('Enter the manager name.'); return; }
    setSavingManager(true);
    try {
      await noticeThresholdSettingAPI.updateThresholds({
        targetBalance: current.targetBalance, notice1Min: current.notice1Min, notice1Max: current.notice1Max,
        notice2Min: current.notice2Min, notice2Max: current.notice2Max,
        noticeBodyTemplate: current.noticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.noticeBodyTemplate,
        finalNoticeBodyTemplate: current.finalNoticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.finalNoticeBodyTemplate,
        noticeManagerName: managerName.trim(), description: 'Updated notice manager name',
      });
      await load(); setManagerSaved(true);
    } catch (err) { setManagerError(err.response?.data?.message || 'Unable to save the manager name. Please try again.'); }
    finally { setSavingManager(false); }
  };
  return (
    <div className="fs-section">
      <p className="fs-section-description">Edit the messages used in printed and downloaded notices. The official cooperative layout and automatic member details are preserved. First and second notices share the same message.</p>
      {!loading && !error && current && <form onSubmit={saveManager} className="fs-panel mb-5 space-y-3">
        <div><p className="text-sm font-bold text-slate-900">Notice manager</p><p className="text-xs text-slate-500 mt-1">Used in the manager block and the {'{managerName}'} field on all three notices. Update this when the manager changes.</p></div>
        <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium flex-1 min-w-48">Manager name<input value={managerName} onChange={event => { setManagerName(event.target.value); setManagerSaved(false); setManagerError(''); }} required maxLength={100} disabled={savingManager} className="block mt-2 w-full border border-slate-300 rounded px-3 py-2" /></label><button type="submit" disabled={savingManager || managerName.trim() === getNoticeManagerName(current)} className="td-button td-primary">{savingManager ? 'Saving...' : 'Save Manager Name'}</button></div>
        {managerError && <p role="alert" className="text-sm text-red-600">{managerError}</p>}
        {managerSaved && <p role="status" className="text-sm text-emerald-700">Manager name saved for all notices.</p>}
      </form>}
      {loading ? <div className="fs-loading" role="status" aria-label="Loading notice content"><Loader2 className="w-6 h-6 animate-spin" /></div> : error ? <div role="alert" className="text-sm text-red-600">{error}<button className="td-button ml-3" onClick={load}>Retry</button></div> : <div className="fs-notice-grid">
        {[[1, 'First & Second Notice Content'], [3, 'Final Notice Content']].map(([level, title]) => <div key={level} className="fs-panel fs-notice-card"><div className="fs-notice-heading"><p className="text-sm font-bold text-slate-900">{title}</p><button className="td-button" onClick={() => setEditingLevel(level)}><FileEdit className="w-3.5 h-3.5" />Edit Content</button></div><p className="fs-notice-preview line-clamp-6 whitespace-pre-line">{getNoticeMessageTemplate(current, level)}</p></div>)}
      </div>}
      {editingLevel !== null && current && <NoticeLetterEditorModal key={editingLevel} level={editingLevel} current={current} onClose={() => setEditingLevel(null)} onSaved={load} />}
    </div>
  );
}
