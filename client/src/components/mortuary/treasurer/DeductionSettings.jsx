import { Button as ActionButton } from '../../ui/button';
import { Table as DataTable } from '../../ui/table';
import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { deductionSettingAPI } from '../../../services/api';
import UpdateDeductionRateModal from './modals/UpdateDeductionRateModal';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { displaySettingAmount } from '../../../utils/settingAmount';

const formatRate = value => {
  const amount = Number(String(value ?? '').replaceAll(',', ''));
  return value == null || value === '' || !Number.isFinite(amount)
    ? displaySettingAmount(value)
    : amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function DeductionSettings({ user }) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { page, limit, setPage } = usePagination(1, 100);

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    setError('');
    try {
      const [currentRes, historyRes] = await Promise.all([
        deductionSettingAPI.getCurrentRate(),
        deductionSettingAPI.getRateHistory({ page: pageNum, limit }),
      ]);
      setCurrent(currentRes?.data || null);
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      setHistoryTotal(historyRes?.pagination?.total ?? 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load deduction settings.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const totalPages = Math.ceil(historyTotal / limit) || 1;

  return (
    <div className="fs-section">
      <div className="fs-section-heading">
      <h2>Deduction rate</h2>
      <p className="fs-section-description">
        The standard deduction amount charged to active members when a death claim is processed.
      </p>
      </div>

      {loading ? (
        <div className="fs-loading" role="status" aria-label="Loading settings">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current rate */}
          <div className="fs-panel fs-current fs-deduction-current">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div>
                  <p className="fs-value-label">Current Rate</p>
                  <p className="fs-value">₱{formatRate(current?.amount)}</p>
                  <p className="fs-value-context">per active member, per claim</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Effective {current?.effectiveDate ? new Date(current.effectiveDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                    {current?.description ? ` • ${current.description}` : ''}
                  </p>
                </div>
              </div>
              <ActionButton variant="default"
                onClick={() => setShowUpdateModal(true)}
                className="td-button td-primary"
              >
                <Pencil className="w-4 h-4" /> Update Rate
              </ActionButton>
            </div>
          </div>

          {current?.amount != null && Number.isFinite(Number(current.amount)) && (
            <p className="fs-example">Example: 2 claims at &#8369;{formatRate(current.amount)} deduct &#8369;{formatRate(Number(current.amount) * 2)} from each active member.</p>
          )}

          {/* History */}
          <div className="fs-panel fs-history">
            <div className="fs-panel-heading">
              <h3>Rate history</h3>
              <p>Review previous rates and who set them.</p>
            </div>
            <div className="fs-table-scroll" role="region" aria-label="Settings history" tabIndex={0}>
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Effective Date</th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Set By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length > 0 ? (
                    history.map((setting) => (
                      <tr key={setting.settingId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-900">₱{formatRate(setting.amount)}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {new Date(setting.effectiveDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
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
              </DataTable>
            </div>
            {historyTotal > 0 && (
              <div className="fs-pagination">
                <PaginationInfo currentPage={page} limit={limit} total={historyTotal} />
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  hasNextPage={page < totalPages}
                  hasPrevPage={page > 1}
                />
              </div>
            )}
          </div>
        </>
      )}

      <UpdateDeductionRateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        currentAmount={current?.amount ?? 25}
        user={user}
        onSaved={() => { setPage(1); load(1); }}
      />
    </div>
  );
}
