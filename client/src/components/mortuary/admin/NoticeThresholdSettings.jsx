import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Pencil, History, Loader2 } from 'lucide-react';
import { noticeThresholdSettingAPI } from '../../../services/api';
import UpdateNoticeThresholdModal from './modals/UpdateNoticeThresholdModal';

export default function NoticeThresholdSettings({ user }) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [currentRes, historyRes] = await Promise.all([
        noticeThresholdSettingAPI.getCurrentThresholds(),
        noticeThresholdSettingAPI.getThresholdHistory({ limit: 20 }),
      ]);
      setCurrent(currentRes?.data || null);
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load notice threshold settings.');
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
        The balance ranges that trigger Notice 1, Notice 2, and the Final Notice printed from the Treasurer's
        Member Ledger.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current thresholds */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6 text-coop-green" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Target Balance</p>
                  <p className="text-3xl font-bold text-slate-900 mt-0.5">₱{current?.targetBalance?.toLocaleString() ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Effective {current?.effectiveDate ? new Date(current.effectiveDate).toLocaleDateString() : '—'}
                    {current?.description ? ` • ${current.description}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg transition-colors shrink-0"
              >
                <Pencil className="w-4 h-4" /> Update Thresholds
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Notice 1</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  ₱{current?.notice1Min?.toLocaleString() ?? '—'} – ₱{current?.notice1Max?.toLocaleString() ?? '—'}
                </p>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Notice 2</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  ₱{current?.notice2Min?.toLocaleString() ?? '—'} – ₱{current?.notice2Max?.toLocaleString() ?? '—'}
                </p>
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Final Notice</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  Below ₱{current?.notice2Min?.toLocaleString() ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="border-b border-slate-100 p-5 flex items-center gap-2">
              <History className="w-4 h-4 text-coop-green" />
              <p className="text-sm font-bold text-slate-900">Threshold History</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Target</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Notice 1</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Notice 2</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Effective Date</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Set By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length > 0 ? (
                    history.map((setting) => (
                      <tr key={setting.settingId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-900">₱{setting.targetBalance?.toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">₱{setting.notice1Min?.toLocaleString()}–{setting.notice1Max?.toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">₱{setting.notice2Min?.toLocaleString()}–{setting.notice2Max?.toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {new Date(setting.effectiveDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              setting.status === 'active'
                                ? 'bg-green-50 text-coop-green border-green-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${setting.status === 'active' ? 'bg-coop-green' : 'bg-slate-400'}`} />
                            {setting.status === 'active' ? 'Active' : 'Superseded'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-500 hidden sm:table-cell">{setting.createdBy || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                        {error || 'No threshold history yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UpdateNoticeThresholdModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        current={current}
        user={user}
        onSaved={load}
      />
    </div>
  );
}
