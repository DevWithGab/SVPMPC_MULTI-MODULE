import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Pencil, History, Loader2 } from 'lucide-react';
import { deductionSettingAPI } from '../../../services/api';
import UpdateDeductionRateModal from './modals/UpdateDeductionRateModal';

export default function DeductionSettings({ user }) {
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
        deductionSettingAPI.getCurrentRate(),
        deductionSettingAPI.getRateHistory({ limit: 20 }),
      ]);
      setCurrent(currentRes?.data || null);
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load deduction settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Deduction Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          The standard deduction amount charged to active members during month-end claim processing.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current rate */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <Banknote className="w-6 h-6 text-coop-green" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Current Rate</p>
                  <p className="text-3xl font-bold text-slate-900 mt-0.5">₱{current?.amount ?? '—'}</p>
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
                <Pencil className="w-4 h-4" /> Update Rate
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="border-b border-slate-100 p-5 flex items-center gap-2">
              <History className="w-4 h-4 text-coop-green" />
              <p className="text-sm font-bold text-slate-900">Rate History</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Effective Date</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Set By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length > 0 ? (
                    history.map((setting) => (
                      <tr key={setting.settingId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-900">₱{setting.amount}</td>
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
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-400">
                        {error || 'No rate history yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UpdateDeductionRateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        currentAmount={current?.amount ?? 25}
        user={user}
        onSaved={load}
      />
    </div>
  );
}
