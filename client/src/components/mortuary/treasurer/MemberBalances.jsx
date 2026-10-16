import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowUpDown, BookOpen, Wallet, Clock, AlertTriangle, Printer, Download, Loader2, FileText, RefreshCw } from 'lucide-react';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import './MemberBalances.css';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNoticesBulk, downloadBalanceNoticesBulkPDF, DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import { treasurerAPI } from '../../../services/api';
import { Pagination, PaginationInfo } from '../../ui/pagination';

// Above this, generating the batch PDF is handed off to a background server
// job instead of built instantly in the browser — native text rendering is
// fast enough that smaller batches still feel instant client-side (see
// balanceNotice.js), but a very large run (hundreds to 1,000+) shouldn't tie
// up the Treasurer's tab or risk a request timeout regardless of how fast
// the per-page work is.
const LARGE_BATCH_THRESHOLD = 100;
const BATCH_POLL_INTERVAL_MS = 4000;

const MemberBalances = ({
  members,
  user,
  noticeThresholds,
  showToast,
  searchQuery,
  setSearchQuery,
  barangayFilter,
  setBarangayFilter,
  memberFilter,
  setMemberFilter,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  onOpenLedger,
  onRefresh,
  refreshing = false
}) => {
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [printingLevel, setPrintingLevel] = useState(null);
  const [downloadingLevel, setDownloadingLevel] = useState(null);
  const [noticeBarangay, setNoticeBarangay] = useState('All');
  const [readyDownload, setReadyDownload] = useState(null);
  // { jobId, level } while a background batch is generating server-side;
  // null otherwise. Distinct from downloadingLevel, which is only for the
  // instant client-side path below the large-batch threshold.
  const [batchJob, setBatchJob] = useState(null);
  const batchPollRef = useRef(null);

  const targetBalance = noticeThresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance;
  const lowBalanceMembers = members.filter(m => m.balance < targetBalance);
  const totalCapital = members.reduce((s, m) => s + (m.balance || 0), 0);
  const lowBalancePercent = members.length > 0 ? (lowBalanceMembers.length / members.length) * 100 : 0;

  // Notice scope is independent of the member table's filters and pagination.
  const noticeTargetMembers = useMemo(
    () => (noticeBarangay === 'All' ? members : members.filter((m) => getBarangay(m) === noticeBarangay)),
    [members, noticeBarangay]
  );
  const barangayLabel = noticeBarangay === 'All' ? '' : ` in ${noticeBarangay}`;
  const noticeBusy = printingLevel !== null || downloadingLevel !== null || batchJob !== null;
  const thresholds = noticeThresholds || DEFAULT_NOTICE_THRESHOLDS;
  const peso = (value) => `₱${value.toLocaleString('en-PH')}`;
  const noticeRanges = {
    1: `${peso(thresholds.notice1Min)} – ${peso(thresholds.notice1Max)}`,
    2: `${peso(thresholds.notice2Min)} – ${peso(thresholds.notice2Max)}`,
    3: `Below ${peso(thresholds.notice2Min)}`,
  };

  // Counted across every matching member (not just the current
  // filtered/paginated table view) so the bulk-print buttons below always
  // reflect the true batch size regardless of what's on screen.
  const noticeLevelCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    noticeTargetMembers.forEach((m) => {
      const level = getNoticeLevel(m.balance, noticeThresholds);
      if (level) counts[level] += 1;
    });
    return counts;
  }, [noticeTargetMembers, noticeThresholds]);

  const handleBulkPrint = (level) => {
    const count = noticeLevelCounts[level];
    if (count === 0 || noticeBusy) return;
    if (!window.confirm(`Print ${NOTICE_LEVEL_LABELS[level]} for ${count} member${count === 1 ? '' : 's'}${barangayLabel}? Each will print as a separate page in one job.`)) {
      return;
    }
    setPrintingLevel(level);
    try {
      const printed = printBalanceNoticesBulk(noticeTargetMembers, level, user?.name, noticeThresholds);
      if (printed === 0) {
        showToast?.('Your browser blocked the print window. Please allow pop-ups and try again.', 'error');
      } else {
        showToast?.(`Queued ${printed} ${NOTICE_LEVEL_LABELS[level]} letter${printed === 1 ? '' : 's'}${barangayLabel} for printing.`, 'success');
      }
    } finally {
      setPrintingLevel(null);
    }
  };

  // Starts the server-side background job for a batch too large to build
  // instantly in the browser. Polling (below) picks up the result.
  const handleBulkDownloadBackground = async (level, count) => {
    setDownloadingLevel(level);
    try {
      const response = await treasurerAPI.startNoticeBatch(level, noticeBarangay === 'All' ? undefined : noticeBarangay);
      setBatchJob({ jobId: response.jobId, level });
      showToast?.(
        `Preparing ${count} ${NOTICE_LEVEL_LABELS[level]} letters${barangayLabel} in the background — this may take a moment. We'll let you know when it's ready.`,
        'success'
      );
    } catch (error) {
      console.error('Error starting notice batch job:', error);
      showToast?.('Unable to start generating the notices. Please try again.', 'error');
    } finally {
      setDownloadingLevel(null);
    }
  };

  const handleBulkDownload = async (level) => {
    const count = noticeLevelCounts[level];
    if (count === 0 || noticeBusy) return;
    if (!window.confirm(`Download ${NOTICE_LEVEL_LABELS[level]} for ${count} member${count === 1 ? '' : 's'}${barangayLabel} as one PDF?`)) {
      return;
    }

    if (count >= LARGE_BATCH_THRESHOLD) {
      handleBulkDownloadBackground(level, count);
      return;
    }

    setDownloadingLevel(level);
    try {
      const downloaded = await downloadBalanceNoticesBulkPDF(noticeTargetMembers, level, user?.name, noticeThresholds);
      showToast?.(`Downloaded ${downloaded} ${NOTICE_LEVEL_LABELS[level]} letter${downloaded === 1 ? '' : 's'}${barangayLabel} as a PDF.`, 'success');
    } catch (error) {
      console.error('Error downloading notices PDF:', error);
      showToast?.('Unable to generate the notices PDF. Please try again.', 'error');
    } finally {
      setDownloadingLevel(null);
    }
  };

  // Polls the background job's status while one is running, downloading the
  // finished PDF and clearing the job once it's ready (or reporting failure).
  useEffect(() => {
    if (!batchJob) return undefined;

    const poll = async () => {
      try {
        const status = await treasurerAPI.getNoticeBatchStatus(batchJob.jobId);
        if (status.status === 'completed') {
          clearInterval(batchPollRef.current);
          // The PDF is behind auth now, so it has to be fetched through the
          // authenticated client (not just resolved to a static URL) and
          // turned into a blob URL the <a download> link can point to.
          let url;
          try {
            url = await treasurerAPI.downloadNoticeBatchPdf(batchJob.jobId);
          } catch (downloadError) {
            console.error('Error fetching notice batch PDF:', downloadError);
          }
          if (!url) {
            showToast?.('The PDF download link is unavailable. Please try again.', 'error');
            setBatchJob(null);
            return;
          }
          setReadyDownload({ url, level: batchJob.level, count: status.totalMembers, barangay: status.barangay });
          showToast?.(
            `${status.totalMembers} ${NOTICE_LEVEL_LABELS[batchJob.level]} letters ready. Select Download ready PDF in the notice panel.`,
            'success'
          );
          setBatchJob(null);
        } else if (status.status === 'failed') {
          clearInterval(batchPollRef.current);
          showToast?.('Generating the notices failed. Please try again.', 'error');
          setBatchJob(null);
        }
      } catch (error) {
        console.error('Error polling notice batch status:', error);
      }
    };

    poll();
    batchPollRef.current = setInterval(poll, BATCH_POLL_INTERVAL_MS);
    return () => clearInterval(batchPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchJob?.jobId]);

  // readyDownload.url is a blob: URL (see downloadNoticeBatchPdf) — release it
  // once replaced by a newer one or on unmount, so the PDF's memory isn't
  // held onto after the Treasurer is done with it.
  useEffect(() => {
    const url = readyDownload?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [readyDownload?.url]);

  const filteredMembers = members
    .filter(m => (memberFilter === 'low' ? m.balance < targetBalance : true))
    .filter(m => (barangayFilter === 'All' ? true : getBarangay(m) === barangayFilter))
    .filter(m => (statusFilter === 'all' ? true : m.status === statusFilter))
    .filter(m => (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.id?.toString().includes(searchQuery)))
    .sort((a, b) => sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance);

  const totalPagesMemberBalances = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
  const visiblePage = Math.min(currentPage, totalPagesMemberBalances);
  const currentMembersBalancesChunk = filteredMembers.slice((visiblePage - 1) * itemsPerPage, visiblePage * itemsPerPage);
  const updateFilter = (setter, value) => { setter(value); setCurrentPage(1); };

  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(getBarangay)))].sort();
  const hasActiveFilters = searchQuery !== '' || barangayFilter !== 'All' || statusFilter !== 'all' || memberFilter !== 'all' || sortOrder !== 'asc';
  const clearFilters = () => {
    setSearchQuery('');
    setBarangayFilter('All');
    setStatusFilter('all');
    setMemberFilter('all');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  return (
    <div className="member-balances">
      <header className="mb-header">
        <div><p className="mb-eyebrow">Mortuary management / Members</p><h1>Member balances</h1><p className="mb-description">Track contributions, review member balances, and prepare balance notices.</p></div>
        <button className="mb-button" onClick={onRefresh} disabled={refreshing || noticeBusy}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      </header>
      <AttendanceMetricGrid label="Member balance overview" busy={refreshing} items={[
        ['Total capital', peso(totalCapital), 'Across ' + members.length.toLocaleString() + ' active members', Wallet],
        ['Low balance', lowBalanceMembers.length.toLocaleString(), 'Members below ' + peso(targetBalance), Clock],
        ['At risk', lowBalancePercent.toFixed(1) + '%', 'Share of members with a low balance', AlertTriangle],
      ]} />
      <section className="mb-filters" aria-labelledby="mb-filter-title">
        <div className="mb-filter-heading"><h2 id="mb-filter-title">Find a member</h2><button className="mb-text-button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button></div>
        <div className="mb-filter-grid">
          <label>Search members<span className="mb-search"><Search size={16} aria-hidden="true" /><input value={searchQuery} onChange={e => updateFilter(setSearchQuery, e.target.value)} placeholder="Name or Passbook No." /></span></label>
          <label>Barangay<select value={barangayFilter} onChange={e => updateFilter(setBarangayFilter, e.target.value)}>{uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}</select></label>
          <label>Membership status<select value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Sort by balance<select value={sortOrder} onChange={e => updateFilter(setSortOrder, e.target.value)}><option value="asc">Lowest first</option><option value="desc">Highest first</option></select></label>
        </div>
      </section>
      <section className="mb-panel" aria-labelledby="mb-register-title" aria-busy={refreshing}>
        <div className="mb-register-heading"><div><h2 id="mb-register-title">Member register</h2><p>Open a member's ledger to review contributions and deductions.</p></div>
          <div className="mb-view-switch" role="group" aria-label="Balance filter">
            <button aria-pressed={memberFilter === 'all'} onClick={() => updateFilter(setMemberFilter, 'all')}>All members <span>{members.length.toLocaleString()}</span></button>
            <button aria-pressed={memberFilter === 'low'} onClick={() => updateFilter(setMemberFilter, 'low')}>At risk <span>{lowBalanceMembers.length.toLocaleString()}</span></button>
          </div>
        </div>
        <div className="mb-scope"><span>{filteredMembers.length.toLocaleString()} of {members.length.toLocaleString()} members{barangayFilter !== 'All' && ' · ' + barangayFilter}</span><span>Low balance: below {peso(targetBalance)}</span></div>
        <div className="mb-table-scroll" role="region" aria-label="Member balances" tabIndex={0}>
          <table><thead><tr><th scope="col">Member / Passbook</th><th scope="col">Barangay</th><th scope="col" className="mb-number" aria-sort={sortOrder === 'asc' ? 'ascending' : 'descending'}><button className="mb-sort" onClick={() => updateFilter(setSortOrder, sortOrder === 'asc' ? 'desc' : 'asc')}>Balance <ArrowUpDown size={14} aria-hidden="true" /></button></th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{currentMembersBalancesChunk.map(m => <tr key={m.id} onClick={() => onOpenLedger?.(m)}>
            <td><strong>{m.name}</strong><span className="mb-secondary">#{m.id.toString().padStart(6, '0')}</span></td>
            <td>{getBarangay(m)}</td>
            <td className="mb-number"><strong className={m.balance < targetBalance ? 'mb-low-balance' : ''}>₱{m.balance?.toLocaleString()}</strong></td>
            <td><span className={'mb-status' + (m.status === 'active' ? ' mb-status-active' : '')}>{m.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td><button className="mb-button mb-ledger-button" onClick={e => { e.stopPropagation(); onOpenLedger?.(m); }} aria-label={'Open ledger for ' + m.name}><BookOpen size={14} aria-hidden="true" />Open ledger</button></td>
          </tr>)}</tbody></table>
        </div>
        {filteredMembers.length === 0 && <div className="mb-empty" role="status"><strong>{hasActiveFilters ? 'No members match these filters' : 'No members found'}</strong><p>{hasActiveFilters ? 'Try a different name, passbook number, status, or barangay.' : 'Member balances will appear here when records are available.'}</p>{hasActiveFilters && <button className="mb-button" onClick={clearFilters}>Reset filters</button>}</div>}
        <footer className="mb-pagination">
          <PaginationInfo currentPage={visiblePage} limit={itemsPerPage} total={filteredMembers.length} />
          {filteredMembers.length > 0 && <Pagination currentPage={visiblePage} totalPages={totalPagesMemberBalances} onPageChange={setCurrentPage} hasNextPage={visiblePage < totalPagesMemberBalances} hasPrevPage={visiblePage > 1} />}
        </footer>
      </section>
      <section aria-labelledby="notice-panel-title" className="mb-panel mb-notices">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-700"><FileText className="w-5 h-5" aria-hidden="true" /></div>
            <div>
              <h3 id="notice-panel-title" className="text-base font-semibold text-slate-900">Member notices</h3>
              <p className="text-sm text-slate-500 mt-1">Download one PDF per notice level, or print a letter for each member.</p>
            </div>
          </div>
          <div className="w-full lg:w-56 shrink-0">
            <label htmlFor="notice-barangay" className="block text-xs font-semibold text-slate-600 mb-1.5">Barangay for notices</label>
            <select id="notice-barangay" value={noticeBarangay} onChange={e => setNoticeBarangay(e.target.value)} disabled={noticeBusy} aria-describedby="notice-scope-help" className="w-full h-11 px-3 text-sm rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60">
              {uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5">
          <p id="notice-scope-help" className="text-xs text-slate-500 mb-4">Includes all eligible members in {noticeBarangay === 'All' ? 'all barangays' : noticeBarangay}. Member register filters do not change these downloads.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map(level => {
              const count = noticeLevelCounts[level];
              const preparing = downloadingLevel === level || batchJob?.level === level;
              const tone = level === 3 ? 'bg-red-50 text-red-700 border-red-100' : level === 2 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-amber-50 text-amber-700 border-amber-100';
              return (
                <div key={level} role="group" aria-labelledby={'notice-level-' + level} className="rounded-md border border-slate-200 p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 id={'notice-level-' + level} className={'rounded-md border px-2 py-1 text-xs font-bold ' + tone}>{NOTICE_LEVEL_LABELS[level]}</h4>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">{count} {count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mt-4 tabular-nums">{noticeRanges[level]}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">{count === 0 ? 'No members need this notice.' : 'Current member balance'}</p>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button onClick={() => handleBulkDownload(level)} disabled={count === 0 || noticeBusy} aria-label={'Download ' + NOTICE_LEVEL_LABELS[level] + ' PDF for ' + count + ' members'} className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md bg-[#245e32] text-white text-sm font-semibold hover:bg-[#163a1e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                      {preparing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : <Download className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      {preparing ? 'Preparing...' : 'Download PDF'}
                    </button>
                    <button onClick={() => handleBulkPrint(level)} disabled={count === 0 || noticeBusy} aria-label={'Print ' + NOTICE_LEVEL_LABELS[level] + ' for ' + count + ' members'} className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                      <Printer className="w-4 h-4" aria-hidden="true" /> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div role="status" aria-live="polite" aria-atomic="true">
            {noticeBusy && <p className="flex items-center gap-2 mt-4 text-sm text-emerald-700"><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />Preparing {NOTICE_LEVEL_LABELS[batchJob?.level || downloadingLevel || printingLevel]}. {batchJob ? 'Large batches may take a few moments. Keep this page open.' : 'Please wait...'}</p>}
            {!noticeBusy && readyDownload && <p className="sr-only">Your notice PDF is ready. Use the Download ready PDF link.</p>}
          </div>
          {readyDownload && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-900">{NOTICE_LEVEL_LABELS[readyDownload.level]} is ready &middot; {readyDownload.count} members &middot; {readyDownload.barangay || 'All barangays'}</p>
              <a href={readyDownload.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-md bg-[#245e32] text-white text-sm font-semibold hover:bg-[#163a1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shrink-0"><Download className="w-4 h-4" aria-hidden="true" />Download ready PDF</a>
            </div>
          )}
        </div>
      </section>


      <p className="mb-footnote">Death-fund deductions are processed per claim from the Claims tab.</p>
    </div>
  );
};

export default MemberBalances;
