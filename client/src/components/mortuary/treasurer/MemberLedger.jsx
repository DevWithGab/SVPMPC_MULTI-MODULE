import './MemberLedger.css';
import React, { useState } from 'react';
import { Search, ArrowLeft, Printer, Upload, Loader2, Download } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import BulkLedgerUpload from './BulkLedgerUpload';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNotice, downloadBalanceNoticePDF } from '../../../utils/balanceNotice';
import { outputMemberLedgerPdf } from '../../../utils/memberLedgerPdf';


const formatPeso = (amount, { signed = false } = {}) => {
  const value = amount || 0;
  const formatted = Math.abs(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? '-' : signed ? '+' : '';
  return `${sign}₱${formatted}`;
};

const formatLedgerDate = (dateStr) => {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const monthKeyOf = (dateStr) => (dateStr ? dateStr.slice(0, 7) : 'unknown');


const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const getPresetDateRange = (preset) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'thisMonth':
      return { start: isoDate(y, m, 1), end: isoDate(y, m, new Date(y, m + 1, 0).getDate()) };
    case 'lastMonth': {
      const ly = m === 0 ? y - 1 : y;
      const lm = m === 0 ? 11 : m - 1;
      return { start: isoDate(ly, lm, 1), end: isoDate(ly, lm, new Date(ly, lm + 1, 0).getDate()) };
    }
    case 'thisYear':
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    default:
      return { start: null, end: null };
  }
};

const monthLabelOf = (dateStr) => {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'UNDATED';
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
};


const shortenRef = (ref) => {
  if (!ref) return '—';
  return ref.length > 20 ? `${ref.slice(0, 8)}…${ref.slice(-6)}` : ref;
};


const groupEntriesByMonth = (entries, sortOrder) => {
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = monthKeyOf(entry.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });

  const orderedKeys = Array.from(buckets.keys()).sort((a, b) =>
    sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  );

  return orderedKeys.map((key) => {
    const groupEntries = buckets.get(key);
    const chronologicallyLast = [...groupEntries].sort(
      (a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )[0];
    return {
      key,
      label: monthLabelOf(groupEntries[0].date),
      entries: groupEntries,
      closingBalance: chronologicallyLast?.balance ?? 0,
    };
  });
};

const MemberLedger = ({
  user,
  members,
  noticeThresholds,
  ledgerMembers = [],
  memberLedgerEntries = [],
  loadingMemberLedger = false,
  selectedLedgerMember,
  setSelectedLedgerMember,
  searchQuery,
  setSearchQuery,
  barangayFilter,
  setBarangayFilter,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  pagination,
  onAddDeposit,
  showToast,
  refreshData
}) => {
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'thisMonth' | 'lastMonth' | 'thisYear'
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadingNotice, setDownloadingNotice] = useState(false);
  const [preparingLedger, setPreparingLedger] = useState(null);

  const handleLedgerPdf = async (member, entries, filtered, print = false) => {
    setPreparingLedger(print ? 'print' : 'download');
    try {
      await outputMemberLedgerPdf(member, entries, { filtered, print });
    } catch (error) {
      console.error('Error preparing ledger PDF:', error);
      showToast?.(error.message || 'Unable to prepare the ledger PDF. Please try again.', 'error');
    } finally {
      setPreparingLedger(null);
    }
  };

  const handleDownloadNotice = async (member) => {
    setDownloadingNotice(true);
    try {
      await downloadBalanceNoticePDF(member, user?.name, noticeThresholds);
    } catch (error) {
      console.error('Error downloading notice PDF:', error);
      showToast?.('Unable to generate the notice PDF. Please try again.', 'error');
    } finally {
      setDownloadingNotice(false);
    }
  };

  const downloadLedgerTemplate = () => {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const csv = [
      'Passbook No.,transactionDate,credit,debit,description,transactionType,referenceId,paymentMethod',
      `000123,${date},100.00,0.00,Member contribution,contribution,RECEIPT-001,cash`,
    ].join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'member-ledger-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportLedgerToCSV = (entries, memberName) => {
    const headers = ['Date', 'Reference Number', 'Received', 'Withdrawn', 'Balance', 'Description'];
    const csvContent = [
      headers.join(','),
      ...entries.map(e => [
        e.date, e.ref_no, e.received || 0, e.withdrawn || 0, e.balance, `"${e.description || 'N/A'}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${memberName.replace(/\s+/g, '_')}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ─── Individual Member Ledger View ───
  if (selectedLedgerMember) {
    const currentMember = members.find(m => m.id === selectedLedgerMember.id) || selectedLedgerMember;


    let mEntries = [...memberLedgerEntries];
    if (transactionFilter === 'deposits') mEntries = mEntries.filter(e => e.received > 0);
    if (transactionFilter === 'withdrawals') mEntries = mEntries.filter(e => e.withdrawn > 0);
    const { start: presetStart, end: presetEnd } = getPresetDateRange(datePreset);
    if (presetStart) mEntries = mEntries.filter(e => new Date(e.date) >= new Date(presetStart));
    if (presetEnd) mEntries = mEntries.filter(e => new Date(e.date) <= new Date(presetEnd));
    mEntries.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      const dateDiff = sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      if (dateDiff !== 0) return dateDiff;

      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'asc' ? createdA - createdB : createdB - createdA;
    });

    const totalReceived = mEntries.reduce((sum, e) => sum + (e.received || 0), 0);
    const totalWithdrawn = mEntries.reduce((sum, e) => sum + (e.withdrawn || 0), 0);
    const hasActiveLedgerFilters =
      transactionFilter !== 'all' || datePreset !== 'all';
    const monthGroups = groupEntriesByMonth(mEntries, sortOrder);
    const noticeLevel = getNoticeLevel(currentMember.balance, noticeThresholds);
    const noticeLabel = noticeLevel ? NOTICE_LEVEL_LABELS[noticeLevel] : 'Notice';

    return (
      <div className="member-ledger space-y-5 print:space-y-0">
        {/* Header */}
        <header className="ml-header ml-screen"><p className="ml-eyebrow">Mortuary management / Member ledger</p><h1>Member ledger</h1><p className="ml-description">Transaction history for {currentMember.name}</p></header>

        {/* Controls */}
        <div className="ml-controls ml-screen">
          <button
            onClick={() => {
              setSelectedLedgerMember(null);
              setTransactionFilter('all');
              setDatePreset('all');
              setSortOrder('desc');
            }}
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <ArrowLeft className="w-4 h-4" /> Back to list
          </button>
          <button
            onClick={() => onAddDeposit(currentMember)}
            className="ml-button ml-primary"
          >
            Add Deposit
          </button>
        </div>
        <div className="ml-document-actions ml-screen">
          <section className="ml-action-group" aria-labelledby="ml-ledger-actions-title">
            <h2 id="ml-ledger-actions-title">Ledger records</h2>
            <p>Export, download, or print the transactions shown with your current filters.</p>
          <div className="ml-actions">
            <button
              onClick={() => exportLedgerToCSV(mEntries, currentMember.name)}
              disabled={loadingMemberLedger || mEntries.length === 0}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              <Download className="w-4 h-4" /> Export Ledger CSV
            </button>
            <button
              onClick={() => handleLedgerPdf(currentMember, mEntries, hasActiveLedgerFilters, true)}
              disabled={loadingMemberLedger || preparingLedger !== null}
              aria-busy={preparingLedger === 'print'}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              {preparingLedger === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {preparingLedger === 'print' ? 'Preparing Ledger...' : 'Print Ledger'}
            </button>
            <button
              onClick={() => handleLedgerPdf(currentMember, mEntries, hasActiveLedgerFilters)}
              disabled={loadingMemberLedger || preparingLedger !== null}
              aria-busy={preparingLedger === 'download'}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {preparingLedger === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {preparingLedger === 'download' ? 'Preparing Ledger PDF...' : 'Download Ledger PDF'}
            </button>
          </div>
          </section>
          <section className="ml-action-group ml-notice-actions" aria-labelledby="ml-notice-actions-title">
            <h2 id="ml-notice-actions-title">Balance notice</h2>
            <p id="ml-notice-status">{noticeLevel ? `${noticeLabel} letter based on the member's current balance.` : 'No notice is required for the current balance.'}</p>
            <div className="ml-actions">
                <button
                  onClick={() => printBalanceNotice(currentMember, user?.name, noticeThresholds)}
                  disabled={!noticeLevel}
                  aria-describedby="ml-notice-status"
                  className={`inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                    noticeLevel === 3
                      ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white focus-visible:ring-red-500'
                      : noticeLevel
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white focus-visible:ring-amber-400'
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  Print {noticeLabel}
                </button>
                <button
                  onClick={() => handleDownloadNotice(currentMember)}
                  disabled={!noticeLevel || downloadingNotice}
                  aria-describedby="ml-notice-status"
                  aria-busy={downloadingNotice}
                  className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloadingNotice ? 'Preparing Notice PDF...' : `Download ${noticeLabel} PDF`}
                </button>
            </div>
          </section>
        </div>

        <section className="ml-filters ml-screen" aria-labelledby="ml-entry-filter-title">
          <div className="ml-filter-heading"><h2 id="ml-entry-filter-title">Find a transaction</h2><button className="ml-text-button" disabled={!hasActiveLedgerFilters && sortOrder === 'desc'} onClick={() => { setTransactionFilter('all'); setDatePreset('all'); setSortOrder('desc'); }}>Reset filters</button></div>
          <div className="ml-filter-grid ml-entry-filters">
            <label>Transaction type<select value={transactionFilter} onChange={e => setTransactionFilter(e.target.value)}><option value="all">All entries</option><option value="deposits">Received</option><option value="withdrawals">Withdrawn</option></select></label>
            <label>Date range<select value={datePreset} onChange={e => setDatePreset(e.target.value)}><option value="all">All time</option><option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="thisYear">This year</option></select></label>
            <label>Sort by date<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
          </div>
        </section>

        {/* Member Info Card */}
        <div id="printable-ledger" className="ml-register bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="ml-member-info p-4 border-b border-slate-100">
            {/* Letterhead — screen-hidden, shown only on the printed statement */}
            <div className="hidden print:flex items-center justify-center gap-3 pb-4 mb-4 border-b border-slate-100">
              <img
                src="/SVPMPC-LOGO(MAIN).png"
                alt=""
                className="w-10 h-10 object-contain shrink-0"
              />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900 tracking-tight">
                  St. Vincent Parish Multi-Purpose Cooperative
                </p>
                <p className="text-[11px] text-slate-400">Mortuary Aid Fund Program</p>
              </div>
            </div>

            <div className="ml-identity flex items-center gap-4">
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-900">{currentMember.name}</p>
                <p className="text-xs text-slate-400">#{currentMember.id.toString().padStart(6, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Current Balance</p>
                <p className={`text-xl font-mono font-bold ${currentMember.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatPeso(currentMember.balance)}
                </p>
                {(() => {
                  const level = getNoticeLevel(currentMember.balance, noticeThresholds);
                  if (!level) return null;
                  return (
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        level === 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {NOTICE_LEVEL_LABELS[level]} due
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="ml-member-details mt-3 pt-3 border-t border-slate-100 space-y-3">
              <div>
                <p className="text-xs text-slate-400">Address</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.address || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Beneficiary</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.beneficiaries || '—'}</p>
              </div>
            </div>
            <p className="hidden print:block text-center text-2xl font-extrabold text-coop-green uppercase tracking-widest mt-3 pt-3 border-t border-slate-100">
              Mortuary Assistance Fund
            </p>
          </div>

          {/* Financial summary — statement-style: entry count on the left,
              monospaced totals on the right. Kept inside #printable-ledger so
              it appears on the printed statement too. Reflects whatever
              filter/date range is applied above. */}
          <div className="ml-summary px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{mEntries.length}</span>{' '}
              {mEntries.length === 1 ? 'entry' : 'entries'} shown &middot;{' '}
              {hasActiveLedgerFilters ? 'filtered view' : 'full history'}
            </p>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Received</p>
                <p className="font-mono text-sm font-semibold text-green-600">{formatPeso(totalReceived)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Withdrawn</p>
                <p className="font-mono text-sm font-semibold text-red-500">{formatPeso(totalWithdrawn)}</p>
              </div>
            </div>
          </div>

          {/* Table — ruled like a paper ledger (outer border + vertical
              dividers between columns, on top of the row separators) since
              this is printed as an official statement. */}
          <div className="ml-table-scroll overflow-x-auto" role="region" aria-label="Member transaction history" tabIndex={0}>
            <table className="w-full border border-slate-200 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 divide-x divide-slate-200">
                  <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                  <th scope="col" className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Reference</th>
                  <th scope="col" className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Received</th>
                  <th scope="col" className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Withdrawn</th>
                  <th scope="col" className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              {loadingMemberLedger ? (
                <tbody>
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-400">
                      Loading transaction history...
                    </td>
                  </tr>
                </tbody>
              ) : monthGroups.length > 0 ? monthGroups.map((group) => (
                <tbody key={group.key} className="divide-y divide-slate-200">
                  <tr className="bg-slate-50/70 divide-x divide-slate-200">
                    <td colSpan={4} className="px-5 py-2 text-xs font-bold text-slate-500 tracking-wider">
                      {group.label}
                    </td>
                    <td className="px-5 py-2 text-xs text-right text-slate-400">
                      closing balance <span className="font-mono text-slate-500">{formatPeso(group.closingBalance)}</span>
                    </td>
                  </tr>
                  {group.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors divide-x divide-slate-200">
                      <td className="px-5 py-3.5 text-sm text-slate-500 font-mono whitespace-nowrap align-top">
                        {formatLedgerDate(entry.date)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 font-mono align-top" title={entry.ref_no}>
                        {shortenRef(entry.ref_no)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono font-medium align-top text-green-600">
                        {entry.received > 0 ? formatPeso(entry.received) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono font-medium align-top text-red-500">
                        {entry.withdrawn > 0 ? formatPeso(entry.withdrawn) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-mono font-bold text-slate-900 align-top">
                        {formatPeso(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )) : (
                <tbody>
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-400">
                      No transactions found.
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 print:border-slate-200">
            <span>Generated {new Date().toLocaleDateString()}</span>
            <span>Federation Treasurer</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Member List View ───
  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(getBarangay)))].sort();
  const visibleMembers = ledgerMembers;
  const totalMembers = pagination?.total ?? visibleMembers.length;
  const totalPages = pagination?.totalPages ?? (Math.ceil(totalMembers / itemsPerPage) || 1);
  const hasActiveFilters = searchQuery !== '' || barangayFilter !== 'All';
  const clearFilters = () => {
    setSearchQuery('');
    setBarangayFilter('All');
    setCurrentPage(1);
  };

  return (
    <div className="member-ledger">
      <header className="ml-header ml-list-header"><div><p className="ml-eyebrow">Mortuary management / Member ledger</p><h1>Member ledger</h1><p className="ml-description">Find a member to review their contributions, deductions, and running balance.</p></div><button type="button" className="ml-button ml-primary" onClick={() => setShowBulkModal(true)}><Upload size={15} aria-hidden="true" />Bulk upload CSV</button></header>
      <section className="ml-filters" aria-labelledby="ml-member-filter-title">
        <div className="ml-filter-heading"><h2 id="ml-member-filter-title">Find a member</h2><button className="ml-text-button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button></div>
        <div className="ml-filter-grid">
          <label>Search members<span className="ml-search"><Search size={16} aria-hidden="true" /><input placeholder="Search member…" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></span></label>
          <label>Barangay<select value={barangayFilter} onChange={e => { setBarangayFilter(e.target.value); setCurrentPage(1); }}>{uniqueBarangays.map(b => <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>)}</select></label>
        </div>
      </section>

      {/* Table */}
      <section className="ml-register" aria-labelledby="ml-register-title">
        <div className="ml-register-heading"><h2 id="ml-register-title">Member register</h2><p>Select a member to open their complete ledger.</p></div>
        <div className="ml-scope"><span>{totalMembers.toLocaleString()} {hasActiveFilters ? 'matching ' : ''}member{totalMembers === 1 ? '' : 's'}</span><span>{barangayFilter === 'All' ? 'All barangays' : barangayFilter}</span></div>
        <div className="ml-table-scroll" role="region" aria-label="Member ledger register" tabIndex={0}><table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th scope="col" className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Barangay</th>
              <th scope="col" className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</th>
              <th scope="col" className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleMembers.map(member => (
              <tr
                key={member.id}
                onClick={() => setSelectedLedgerMember(member)}
                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-400">#{member.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{getBarangay(member)}</td>
                <td className="px-5 py-4 text-right">
                  <span className={`text-sm font-bold tabular-nums ${member.balance < 1000 ? 'text-red-500' : 'text-slate-900'}`}>
                    ₱{member.balance?.toLocaleString()}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedLedgerMember(member); }}
                    className="ml-button"
                    aria-label={'Open ledger for ' + member.name}
                  >
                    Open Ledger
                  </button>
                </td>
              </tr>
            ))}
            {visibleMembers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
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
        </table></div>
        {totalMembers > 0 && (
          <div className="ml-pagination">
            <PaginationInfo currentPage={currentPage} limit={itemsPerPage} total={totalMembers} />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              hasNextPage={currentPage < totalPages}
              hasPrevPage={currentPage > 1}
            />
          </div>
        )}
      </section>

      {/* Bulk Upload Modal */}
      {showBulkModal && <BulkLedgerUpload onClose={() => setShowBulkModal(false)} onImported={refreshData} onDownloadTemplate={downloadLedgerTemplate} />}
    </div>
  );
};

export default MemberLedger;
