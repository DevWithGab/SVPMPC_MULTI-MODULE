import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowUpDown, BookOpen, Wallet, Clock, AlertTriangle, Printer, Download, Loader2, FileText } from 'lucide-react';
import StatCard from '../shared/StatCard';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNoticesBulk, downloadBalanceNoticesBulkPDF, DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import { treasurerAPI, resolveQrAssetUrl } from '../../../services/api';

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
  onOpenLedger
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
          const url = resolveQrAssetUrl(status.downloadUrl);
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

  const filteredMembers = members
    .filter(m => (memberFilter === 'low' ? m.balance < targetBalance : true))
    .filter(m => (barangayFilter === 'All' ? true : getBarangay(m) === barangayFilter))
    .filter(m => (statusFilter === 'all' ? true : m.status === statusFilter))
    .filter(m => (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.id?.toString().includes(searchQuery)))
    .sort((a, b) => sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance);

  const totalPagesMemberBalances = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
  const currentMembersBalancesChunk = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(getBarangay)))].sort();
  const hasActiveFilters = searchQuery !== '' || barangayFilter !== 'All' || statusFilter !== 'all' || memberFilter !== 'all';
  const clearFilters = () => {
    setSearchQuery('');
    setBarangayFilter('All');
    setStatusFilter('all');
    setMemberFilter('all');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Member Balances
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Track contributions and spot balances that need attention. Death-fund deductions are now
          triggered per claim from the Claims tab.
        </p>
      </div>

      {/* Stats are informational only — the "All / At risk" tabs below are
          the actual filter control. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total capital"
          value={`₱${totalCapital.toLocaleString()}`}
          subtitle={`Across ${members.length} active members`}
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Low balance"
          value={<>{lowBalanceMembers.length} <span className="text-base font-normal text-slate-500">members</span></>}
          subtitle={`Below ₱${targetBalance.toLocaleString()}`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="At risk"
          value={`${lowBalancePercent.toFixed(1)}%`}
          subtitle="Share of members with a low balance"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      <section aria-labelledby="notice-panel-title" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700"><FileText className="w-5 h-5" aria-hidden="true" /></div>
            <div>
              <h3 id="notice-panel-title" className="text-base font-semibold text-slate-900">Member notices</h3>
              <p className="text-sm text-slate-500 mt-1">Download one PDF per notice level, or print a letter for each member.</p>
            </div>
          </div>
          <div className="w-full lg:w-56 shrink-0">
            <label htmlFor="notice-barangay" className="block text-xs font-semibold text-slate-600 mb-1.5">Barangay for notices</label>
            <select id="notice-barangay" value={noticeBarangay} onChange={e => setNoticeBarangay(e.target.value)} disabled={noticeBusy} aria-describedby="notice-scope-help" className="w-full h-11 px-3 text-sm rounded-lg border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60">
              {uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5">
          <p id="notice-scope-help" className="text-xs text-slate-500 mb-4">Includes all eligible members in {noticeBarangay === 'All' ? 'all barangays' : noticeBarangay}. Table filters below do not change these downloads.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map(level => {
              const count = noticeLevelCounts[level];
              const preparing = downloadingLevel === level || batchJob?.level === level;
              const tone = level === 3 ? 'bg-red-50 text-red-700 border-red-100' : level === 2 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-amber-50 text-amber-700 border-amber-100';
              return (
                <div key={level} role="group" aria-labelledby={'notice-level-' + level} className="rounded-xl border border-slate-200 p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 id={'notice-level-' + level} className={'rounded-md border px-2 py-1 text-xs font-bold ' + tone}>{NOTICE_LEVEL_LABELS[level]}</h4>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">{count} {count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mt-4 tabular-nums">{noticeRanges[level]}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">{count === 0 ? 'No members need this notice.' : 'Current member balance'}</p>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button onClick={() => handleBulkDownload(level)} disabled={count === 0 || noticeBusy} aria-label={'Download ' + NOTICE_LEVEL_LABELS[level] + ' PDF for ' + count + ' members'} className="flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                      {preparing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : <Download className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      {preparing ? 'Preparing...' : 'Download PDF'}
                    </button>
                    <button onClick={() => handleBulkPrint(level)} disabled={count === 0 || noticeBusy} aria-label={'Print ' + NOTICE_LEVEL_LABELS[level] + ' for ' + count + ' members'} className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
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
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-900">{NOTICE_LEVEL_LABELS[readyDownload.level]} is ready &middot; {readyDownload.count} members &middot; {readyDownload.barangay || 'All barangays'}</p>
              <a href={readyDownload.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shrink-0"><Download className="w-4 h-4" aria-hidden="true" />Download ready PDF</a>
            </div>
          )}
        </div>
      </section>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setMemberFilter('all')}
              aria-pressed={memberFilter === 'all'}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                memberFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All <span className="ml-1 text-slate-400">{members.length}</span>
            </button>
            <button
              onClick={() => setMemberFilter('low')}
              aria-pressed={memberFilter === 'low'}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                memberFilter === 'low'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              At risk <span className="ml-1 text-slate-400">{lowBalanceMembers.length}</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search member by name or ID"
              placeholder="Search member or ID"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none transition-all"
            />
          </div>

          {/* Barangay Dropdown — this filter was previously invisible on this tab
              (it's shared state set from the Ledger tab), silently hiding members
              with no on-screen explanation. Surfacing it here makes the filter visible
              and lets the treasurer control it directly from this screen too. */}
          <select
            value={barangayFilter}
            onChange={e => setBarangayFilter(e.target.value)}
            aria-label="Filter by barangay"
            className="h-10 px-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none"
          >
            {uniqueBarangays.map(b => (
              <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="h-10 px-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Member
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                Barangay
              </th>
              <th className="text-right px-6 py-3.5">
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  aria-label={`Sort by balance, currently ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded"
                >
                  Balance
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentMembersBalancesChunk.map(m => (
              <tr
                key={m.id}
                onClick={() => onOpenLedger?.(m)}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {m.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        #{m.id.toString().padStart(6, '0')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">
                  {getBarangay(m)}
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-sm font-bold tabular-nums ${m.balance < targetBalance ? 'text-red-500' : 'text-slate-900'}`}
                  >
                    ₱{m.balance?.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      m.status === 'active'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {m.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenLedger?.(m); }}
                    aria-label={`Open ledger for ${m.name}`}
                    className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                  {hasActiveFilters ? (
                    <>
                      No members match these filters.{' '}
                      <button onClick={clearFilters} className="text-emerald-700 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded">
                        Clear filters
                      </button>
                    </>
                  ) : 'No members found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filteredMembers.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredMembers.length)} of {filteredMembers.length}
        </p>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="h-9 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            Previous
          </button>
          <button
            disabled={currentPage === totalPagesMemberBalances}
            onClick={() => setCurrentPage(p => Math.min(totalPagesMemberBalances, p + 1))}
            className="h-9 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberBalances;
