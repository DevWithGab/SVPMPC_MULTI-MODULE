import { Panel } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, TrendingUp, Layers, CalendarDays, Download, ArrowRight } from 'lucide-react';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';
import { reportCsvHeader, csvRows } from '../../../utils/reportCsvHeader';
import { peso } from './claimWorkflowUtils';
import useUrlState from '../../../hooks/useUrlState';
import DeductionMonthDetail from './DeductionMonthDetail';
import { monthLabel, isoDate } from './deductionMonth';

/* Month-end records ng naprosesong deductions - magkano ang nakolekta bawat
buwan. Ang "View claims" ang nagbubukas ng mga claim ng buwan sa sariling page. */

const th = 'px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider';
/* Ang month page ay sariling URL (?month=YYYY-MM) para gumana ang Back button
ng browser at puwedeng i-bookmark. */
export default function DeductionSummary() {
  const [month, setMonth] = useUrlState('month', null);
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return <DeductionMonthDetail key={month} month={month} onBack={() => setMonth(null)} />;
  return <DeductionMonths onOpenMonth={setMonth} />;
}

function DeductionMonths({ onOpenMonth }) {
  const [months, setMonths] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const res = await treasurerAPI.getDeductionSummary({ search: searchTerm || undefined });
      const data = Array.isArray(res?.data) ? res.data : [];
      setMonths(data);
      setTotals(res?.totals || null);
      setError('');
    } catch {
      setMonths([]);
      setTotals(null);
      setError('Unable to load the deduction summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const exportCSV = () => {
    const body = [['Month', 'Claim ID', 'Deceased Member', 'Date of Death', 'Beneficiary', 'Reference Number', 'Processed', 'Processed By', 'Rate per Claim', 'Members Charged', 'Collected'],
      ...months.flatMap((m) => m.claims.map((c) => [monthLabel(m.month), c.claimId, c.memberName, isoDate(c.dateOfDeath), c.beneficiaryName, c.jvNumber, isoDate(c.processedAt), c.processedBy, c.ratePerClaim, c.membersCharged, c.totalCollected])),
      [],
      ['Month', 'Batches', 'Claims', 'Total Collected'],
      ...months.map((m) => [monthLabel(m.month), m.batchCount, m.claimCount, m.totalCollected]),
      ['Total', totals?.batchCount ?? 0, totals?.claimCount ?? 0, totals?.totalCollected ?? 0]];
    const header = reportCsvHeader({
      title: 'Monthly Deduction Records',
      program: 'Mortuary Aid Fund Program',
      scope: search ? `Deductions matching "${search}".` : 'All processed deductions.',
      metadata: ['Currency', 'Philippine pesos (PHP)'],
    });
    const url = URL.createObjectURL(new Blob(['﻿' + header + csvRows(body)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthly-deductions-${isoDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mc-view mc-report space-y-6">
      <div className="mc-view-heading">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Deduction Summary</h2>
          <p className="text-sm text-slate-500 mt-1">Month-end records of processed deductions and the deceased members they covered.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              aria-label="Search by reference number, claim ID or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference no., claim ID or name..."
              className="pl-9"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={loading || !months.length}
            className="inline-flex items-center gap-1.5 px-3 h-10 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Sakop ng totals lahat ng tumutugma sa search. */}
      <AttendanceMetricGrid label="Deduction summary totals" busy={loading} items={[
        ['Total collected', loading ? '—' : peso(totals?.totalCollected ?? 0), 'Member assessments collected', TrendingUp],
        ['Batches processed', loading ? '—' : (totals?.batchCount ?? 0).toLocaleString(), 'One reference number each', Layers],
        ['Claims covered', loading ? '—' : (totals?.claimCount ?? 0).toLocaleString(), 'Death claims deducted', FileText],
      ]} />

      <Panel as="div" className="mc-register">
        {error ? <p role="alert" className="px-6 py-12 text-center text-sm text-red-700">{error}</p> : (
          <div className="mc-table-scroll" role="region" aria-label="Monthly deduction records" tabIndex={0}>
            <DataTable className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className={`${th} text-left`}>Month</th>
                  <th className={`${th} text-right`}>Batches</th>
                  <th className={`${th} text-right`}>Claims</th>
                  <th className={`${th} text-right`}>Total collected</th>
                  <th className={`${th} text-right`}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">Loading...</td></tr>
                ) : months.length ? months.map((m) => (
                    <tr key={m.month} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <CalendarDays className="w-4 h-4 text-slate-400" />{monthLabel(m.month)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums text-slate-600">{m.batchCount}</td>
                      <td className="px-5 py-3.5 text-sm text-right tabular-nums text-slate-600">{m.claimCount}</td>
                      <td className="px-5 py-3.5 text-sm text-right font-semibold tabular-nums text-slate-900">{peso(m.totalCollected)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button type="button" onClick={() => onOpenMonth(m.month)} aria-label={`View claims for ${monthLabel(m.month)}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-coop-green hover:bg-green-50">
                          View claims <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-8 h-8 text-slate-300" />
                        {search ? 'No deductions match your search.' : 'No deduction has been processed yet — process a batch and it will appear here.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {!loading && months.length > 0 && <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">Total</td>
                  <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums">{totals?.batchCount ?? 0}</td>
                  <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums">{totals?.claimCount ?? 0}</td>
                  <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums">{peso(totals?.totalCollected ?? 0)}</td>
                  <td />
                </tr>
              </tfoot>}
            </DataTable>
          </div>
        )}
      </Panel>
    </div>
  );
}
