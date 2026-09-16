import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, History } from 'lucide-react';
import { beneficiaryAPI } from '../../../services/api';

export default function BeneficiaryHistory({ memberId, memberName, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await beneficiaryAPI.getHistory(memberId);
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load beneficiary history.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-coop-green mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Beneficiaries
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beneficiary History</h1>
        <p className="text-slate-500 text-sm mt-1">{memberName}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : history.length > 0 ? (
          <ol className="space-y-5">
            {history.map((record) => (
              <li key={record.beneficiaryId} className="relative pl-5 pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${record.isActive ? 'bg-coop-green' : 'bg-slate-300'}`} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{record.beneficiaryName}</p>
                  {record.isActive && (
                    <span className="text-[11px] font-semibold text-coop-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{record.relationship} • {record.contactNumber}</p>
                {record.address && <p className="text-xs text-slate-400 mt-0.5">{record.address}</p>}
                <p className="text-xs text-slate-400 mt-1.5">
                  Effective {new Date(record.effectiveFrom).toLocaleDateString()}
                  {record.effectiveTo ? ` – ${new Date(record.effectiveTo).toLocaleDateString()}` : ' – present'}
                  {record.updatedBy ? ` • by ${record.updatedBy}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
            <History className="w-7 h-7 text-slate-300" />
            <p className="text-sm font-medium">{error || 'No beneficiary records for this member.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
