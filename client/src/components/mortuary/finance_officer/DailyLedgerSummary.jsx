import { Tooltip } from '../../ui/tooltip';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import useUrlState from '../../../hooks/useUrlState';
import { Download, Printer } from 'lucide-react';
import './Reports.css';
import './DailyLedgerSummary.css';
import { Input } from '../../ui/input';
import { Table } from '../../ui/table';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { todayManila, dailyTypeLabel, downloadDailySummary, downloadDailySummaryPdf, printDailySummary } from '../../../utils/dailyLedgerSummary';

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
  const [exporting, setExporting] = useState(false);
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
  const exportData = async action => {
    if (!ready || exporting) return;
    setExporting(true);
    setExportError('');
    try { await action(result); } catch (cause) { setExportError(cause.message || 'Unable to export the summary.'); }
    finally { setExporting(false); }
  };
  const totals = result?.totals;
  const rows = ready ? result.rows : [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  return <section aria-labelledby="daily-summary-title" className="financial-reports daily-ledger-summary reports-document" aria-busy={loading}>
    <div className="reports-document-heading">
      <div><h2 id="daily-summary-title">Daily summary</h2><p>Review amounts added to member ledgers for one day.</p></div>
      <div className="reports-export-actions">
        <Tooltip content="Download all ledger entries for the selected date as PDF."><button className="reports-button reports-button-primary" disabled={!ready || exporting} onClick={() => exportData(downloadDailySummaryPdf)}><Download size={16} aria-hidden="true" />Download PDF</button></Tooltip>
        <Tooltip content="Prepare the complete ledger summary for the selected date for printing."><button className="reports-button" disabled={!ready || exporting} onClick={() => exportData(printDailySummary)}><Printer size={16} aria-hidden="true" />Print summary</button></Tooltip>
        <Tooltip content="Export all ledger entries for the selected date as CSV."><button className="reports-button" disabled={!ready || exporting} onClick={() => exportData(downloadDailySummary)}>Download CSV</button></Tooltip>
      </div>
    </div>
    <div className="reports-filters">
      <div className="daily-date-controls">
        <label>Transaction date<Input type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label>
        <button className="reports-button" disabled={date === todayManila()} onClick={() => setDate(todayManila())}>Today</button>
        <button className="reports-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh summary</button>
      </div>
      <p>Choose a date to view its summary automatically. Uses the transaction date in Philippine time.</p>
    </div>
    {loading && <p role="status" className="reports-empty">Loading amounts added...</p>}
    {error && <p role="alert" className="p-5 text-red-700">{error} Use Refresh summary to retry.</p>}
    {exporting && <p role="status" className="p-5 text-sm">Preparing your export...</p>}
    {exportError && <p role="alert" className="p-5 text-red-700">{exportError}</p>}
    {ready && <>
      <dl className="daily-summary-totals">
        {[["Total added", peso(totals.totalAdded)], ["Members", totals.members], ["Entries", totals.transactions]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="reports-scope-bar"><span>Includes contributions and opening balance credits.</span><span>Downloads include all entries for this date.</span></div>
      {totals.pendingEdits > 0 && <p role="status" className="p-5 text-sm text-amber-800">{totals.pendingEdits} saved edit(s) still need payment reporting or audit completion. This summary shows their latest ledger amounts.</p>}
      <div className="reports-content" role="region" aria-label="Daily amounts added" tabIndex={0}><Table className="w-full">
        <thead><tr>{['Passbook No.', 'Member', 'Reference', 'Type', 'Amount added'].map(label => <th key={label} scope="col" className={label === 'Amount added' ? 'text-right' : 'text-left'}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row => <tr key={row.id}>
          <td>{row.memberId}</td><td>{row.memberName}</td><td className="break-all">{row.reference}</td><td>{dailyTypeLabel(row.transactionType)}</td><td className="text-right">{peso(row.amount)}</td>
        </tr>)}</tbody>
      </Table></div>
      {!rows.length && <p role="status" className="reports-empty">No amounts added on this date. Choose another date to view entries.</p>}
      {rows.length > 0 && <div className="reports-pagination"><PaginationInfo currentPage={page} limit={PAGE_SIZE} total={rows.length} /><Pagination currentPage={page} totalPages={pages} onPageChange={setPage} hasNextPage={page < pages} hasPrevPage={page > 1} /></div>}
    </>}
  </section>;
}
