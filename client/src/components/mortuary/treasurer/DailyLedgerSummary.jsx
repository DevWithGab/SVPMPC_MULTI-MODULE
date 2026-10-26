import { useEffect, useState } from 'react';
import api from '../../../services/api';
import useUrlState from '../../../hooks/useUrlState';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table } from '../../ui/table';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { todayManila, dailyTypeLabel, downloadDailySummary, printDailySummary } from '../../../utils/dailyLedgerSummary';

const peso = value => Number(value || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const PAGE_SIZE = 50;

export default function DailyLedgerSummary({ refreshVersion = 0 }) {
  const [date, setDate] = useUrlState('dailyDate', todayManila());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState('');
  const ready = !loading && !error && result?.date === date;
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setExportError(''); setResult(null); setPage(1);
    api.get('/mortuary/treasurer/ledger/daily-summary', { params: { date } }).then(response => {
      if (!response.data.success) throw new Error(response.data.message || 'Unable to load summary.');
      if (!cancelled) setResult(response.data.data);
    }).catch(cause => {
      if (!cancelled) setError(cause.response?.data?.message || cause.message || 'Unable to load the daily summary.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, refresh, refreshVersion]);
  const exportData = action => {
    setExportError('');
    try { action(result); } catch (cause) { setExportError(cause.message || 'Unable to export the summary.'); }
  };
  const totals = result?.totals;
  const rows = ready ? result.rows : [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  return <section aria-labelledby="daily-summary-title" className="space-y-5">
    <div className="ml-filters">
      <h2 id="daily-summary-title" className="text-lg font-semibold">Daily transaction summary</h2>
      <p className="mt-1 text-sm text-slate-600">Check recorded transactions against your payment system. Uses the transaction date, not the upload date, in Philippine time.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Transaction date<Input type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label>
        <Button variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh summary</Button>
        <Button variant="outline" disabled={!ready} onClick={() => exportData(printDailySummary)}>Print summary</Button>
        <Button variant="outline" disabled={!ready} onClick={() => exportData(downloadDailySummary)}>Download CSV</Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Print and CSV include every transaction for the selected date, across all pages.</p>
    </div>
    {loading && <p role="status">Loading daily transactions…</p>}
    {error && <p role="alert" className="text-red-700">{error} Use Refresh summary to retry.</p>}
    {exportError && <p role="alert" className="text-red-700">{exportError}</p>}
    {ready && <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Contributions recorded", peso(totals.contributions)], ["Deductions / withdrawals", peso(totals.deductions)], ["Net ledger change", peso(totals.netChange)], ["Members with transactions", totals.members]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold">Opening balances and other adjustments</p>
        <p className="mt-1">Credits: {peso(totals.adjustmentCredits)} · Debits: {peso(totals.adjustmentDebits)}</p>
        <p className="mt-1 text-slate-600">These are separate from contributions. Net ledger change includes adjustments; it is not cash collected.</p>
      </div>
      {totals.pendingEdits > 0 && <p role="status" className="text-sm text-amber-800">{totals.pendingEdits} saved edit(s) still need payment reporting or audit completion. This summary shows their latest ledger amounts.</p>}
      <div className="ml-register">
        <div className="ml-register-heading"><h3>Transactions for {date}</h3><p>{totals.transactions} recorded transaction(s). Duplicate CSV rows are excluded.</p></div>
        <div className="ml-table-scroll" role="region" aria-label="Daily transactions" tabIndex={0}><Table className="w-full text-sm">
          <thead><tr>{['Passbook No.', 'Member', 'Reference', 'Type', 'Contributions', 'Deductions / withdrawals', 'Adjustment credits', 'Adjustment debits'].map(label => <th key={label} scope="col" className="p-3 text-left">{label}</th>)}</tr></thead>
          <tbody>{rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row => <tr key={row.id} className="border-t border-slate-200">
            <td className="p-3">{row.memberId}</td><td className="p-3">{row.memberName}</td><td className="p-3 break-all">{row.reference}</td><td className="p-3">{dailyTypeLabel(row.transactionType)}</td>
            {[row.contribution, row.deduction, row.adjustmentCredit, row.adjustmentDebit].map((value, index) => <td key={index} className="p-3 text-right tabular-nums">{value ? peso(value) : '—'}</td>)}
          </tr>)}</tbody>
        </Table></div>
        {!rows.length && <p role="status" className="p-6 text-slate-600">No transactions recorded for this date.</p>}
        {rows.length > 0 && <div className="ml-pagination"><PaginationInfo currentPage={page} limit={PAGE_SIZE} total={rows.length} /><Pagination currentPage={page} totalPages={pages} onPageChange={setPage} hasNextPage={page < pages} hasPrevPage={page > 1} /></div>}
      </div>
    </>}
  </section>;
}
