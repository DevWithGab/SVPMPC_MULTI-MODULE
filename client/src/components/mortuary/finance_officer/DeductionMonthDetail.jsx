import { Panel } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Layers, TrendingUp } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';
import { peso, shortDate } from './claimWorkflowUtils';
import { monthLabel } from './deductionMonth';

const th = 'px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide';

/* Sariling page ng isang buwan: lahat ng claim (deceased member) na na-deduct sa
buwan na iyon, kasama ang beneficiary, reference number, at assessment. */
export default function DeductionMonthDetail({ month, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // The parent keys this page by month, so a new month starts with fresh state.
    let active = true;
    treasurerAPI.getDeductionSummary({ month })
      // Pick the requested month explicitly; never fall back to whichever month came first.
      .then((res) => { if (active) setData((res?.data || []).find((m) => m.month === month) || { month, claims: [], batchCount: 0, claimCount: 0, totalCollected: 0 }); })
      .catch(() => { if (active) setError('Unable to load this month’s claims. Please try again.'); });
    return () => { active = false; };
  }, [month]);

  return <div className="mc-view mc-report space-y-6">
    <div className="mc-view-heading">
      <div>
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-coop-green hover:text-coop-darkGreen">
          <ArrowLeft className="w-4 h-4" /> Deduction Summary
        </button>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{monthLabel(month)}</h2>
        <p className="text-sm text-slate-500 mt-1">Claims deducted this month and their details.</p>
      </div>
    </div>

    {error ? <Panel as="div" className="mc-register"><p role="alert" className="px-6 py-12 text-center text-sm text-red-700">{error}</p></Panel>
      : !data ? <p role="status" className="py-16 text-center text-sm text-slate-400">Loading...</p>
        : <>
          <AttendanceMetricGrid label={`${monthLabel(month)} totals`} items={[
            ['Total collected', peso(data.totalCollected), 'Member assessments collected', TrendingUp],
            ['Batches processed', data.batchCount.toLocaleString(), 'Claims processed together', Layers],
            ['Claims covered', data.claimCount.toLocaleString(), 'Death claims deducted', FileText],
          ]} />
          <Panel as="div" className="mc-register">
            <div className="mc-table-scroll" role="region" aria-label={`Claims deducted in ${monthLabel(month)}`} tabIndex={0}>
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className={th}>Deceased member</th>
                    <th className={th}>Beneficiary</th>
                    <th className={th}>Reference no.</th>
                    <th className={`${th} hidden md:table-cell`}>Processed</th>
                    <th className={`${th} hidden lg:table-cell`}>Assessment</th>
                    <th className={`${th} text-right`}>Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.claims.length ? data.claims.map((c) => <tr key={c.claimId} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5"><p className="font-medium text-slate-900">{c.memberName}</p><p className="text-xs text-slate-500">{c.claimId} · Died {shortDate(c.dateOfDeath)}</p></td>
                    <td className="px-5 py-3.5 text-slate-600">{c.beneficiaryName || '—'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{c.jvNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{shortDate(c.processedAt)}{c.processedBy ? <span className="block text-xs text-slate-400">{c.processedBy}</span> : null}</td>
                    <td className="px-5 py-3.5 text-slate-600 tabular-nums hidden lg:table-cell">{Number(c.membersCharged || 0).toLocaleString()} × {peso(c.ratePerClaim)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{peso(c.totalCollected)}</td>
                  </tr>) : <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">No claims were deducted in this month.</td></tr>}
                </tbody>
                {data.claims.length > 0 && <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-slate-900">Total collected</td>
                    <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums">{peso(data.totalCollected)}</td>
                  </tr>
                </tfoot>}
              </DataTable>
            </div>
          </Panel>
        </>}
  </div>;
}
