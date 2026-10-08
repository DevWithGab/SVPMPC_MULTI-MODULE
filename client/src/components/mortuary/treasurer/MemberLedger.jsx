import React, { useState } from 'react';
import { Search, ArrowLeft, Printer, Upload, Loader2, Download } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';
import { Button } from '../../ui/button';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { BulkUploadDialog, UploadFilePicker, UploadTemplateCard } from '../shared/BulkUploadDialog';
import { getBarangay } from '../../../utils/helpers';
import { getNoticeLevel, NOTICE_LEVEL_LABELS, printBalanceNotice, downloadBalanceNoticePDF, DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';


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
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'thisMonth' | 'lastMonth' | 'thisYear'
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadingNotice, setDownloadingNotice] = useState(false);

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
      'memberId,transactionDate,credit,debit,description,transactionType,referenceId,paymentMethod',
      `MEMBER-ID,${date},100.00,0.00,Member contribution,contribution,RECEIPT-001,cash`,
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

  const handleCSVUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
            else { current += char; }
          }
          result.push(current.trim());
          return result;
        };
        const headers = parseCSVLine(lines[0]);
        const preview = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
          }, {});
        });
        setCsvPreview(preview);
      };
      reader.readAsText(file);
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile || loading) return;
    setLoading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += char; }
        }
        result.push(current.trim());
        return result;
      };
      const headers = parseCSVLine(lines[0]);
      const ledgerEntries = lines.slice(1)
        .filter(line => line.trim())
        .map((line) => {
          const values = parseCSVLine(line);
          return {
            memberId: values[headers.indexOf('memberId')],
            transactionDate: values[headers.indexOf('transactionDate')],
            credit: parseFloat(values[headers.indexOf('credit')]) || 0,
            debit: parseFloat(values[headers.indexOf('debit')]) || 0,
            description: values[headers.indexOf('description')] || 'Bulk upload',
            transactionType: values[headers.indexOf('transactionType')] || '',
            referenceId: values[headers.indexOf('referenceId')] || values[headers.indexOf('ref_no')] || '',
            paymentMethod: values[headers.indexOf('paymentMethod')] || 'Cash',
            status: values[headers.indexOf('status')] || 'completed'
          };
        });
      const response = await treasurerAPI.bulkUploadLedger(ledgerEntries);
      showToast(`Uploaded: ${response.results.success.length} ok, ${response.results.failed.length} failed`, 'success');
      setShowBulkModal(false);
      setCsvFile(null);
      setCsvPreview([]);
      if (refreshData) await refreshData();
    } catch (error) {
      showToast('Upload error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
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

    return (
      <div className="space-y-5 print:space-y-0">
        {/* Header */}
        <div className="print:hidden">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Member Ledger</h2>
          <p className="text-sm text-slate-500 mt-1">Transaction history for {currentMember.name}</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
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
          <div className="flex gap-2">
            <button
              onClick={() => exportLedgerToCSV(mEntries, currentMember.name)}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              <Printer className="w-4 h-4" /> Print Ledger
            </button>
            {(() => {
              const noticeLevel = getNoticeLevel(currentMember.balance, noticeThresholds);
              return (
                <button
                  onClick={() => printBalanceNotice(currentMember, user?.name, noticeThresholds)}
                  disabled={!noticeLevel}
                  title={noticeLevel ? undefined : `Balance is above ₱${(noticeThresholds?.notice1Max ?? DEFAULT_NOTICE_THRESHOLDS.notice1Max).toLocaleString()} — no notice needed`}
                  className={`inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                    noticeLevel === 3
                      ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white focus-visible:ring-red-500'
                      : noticeLevel
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white focus-visible:ring-amber-400'
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  {noticeLevel ? `Print ${NOTICE_LEVEL_LABELS[noticeLevel]}` : 'Print Notice'}
                </button>
              );
            })()}
            {(() => {
              const noticeLevel = getNoticeLevel(currentMember.balance, noticeThresholds);
              if (!noticeLevel) return null;
              return (
                <button
                  onClick={() => handleDownloadNotice(currentMember)}
                  disabled={downloadingNotice}
                  title={`Download ${NOTICE_LEVEL_LABELS[noticeLevel]} as PDF`}
                  className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </button>
              );
            })()}
            <button
              onClick={() => onAddDeposit(currentMember)}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium bg-green-700 hover:bg-green-800 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            >
              Add Deposit
            </button>
          </div>
        </div>

        {/* Filters — kept outside #printable-ledger so it never prints,
            and separate from the ledger card itself (not just print:hidden
            inside it) per the requested layout. */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 print:hidden">
          <div className="flex flex-wrap gap-x-5 gap-y-3 items-center">
            <div className="inline-flex border border-slate-200 overflow-hidden shrink-0" role="group" aria-label="Filter by transaction direction">
              {[
                { value: 'all', label: 'All entries' },
                { value: 'deposits', label: 'Received' },
                { value: 'withdrawals', label: 'Withdrawn' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTransactionFilter(value)}
                  aria-pressed={transactionFilter === value}
                  className={`h-9 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:relative ${
                    transactionFilter === value
                      ? 'bg-green-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="inline-flex border border-slate-200 overflow-hidden shrink-0" role="group" aria-label="Filter by date range">
              {[
                { value: 'all', label: 'All time' },
                { value: 'thisMonth', label: 'This month' },
                { value: 'lastMonth', label: 'Last month' },
                { value: 'thisYear', label: 'This year' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDatePreset(value)}
                  aria-pressed={datePreset === value}
                  className={`h-9 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:relative ${
                    datePreset === value
                      ? 'bg-green-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="ledger-order" className="text-sm text-slate-500">Order</label>
              <select
                id="ledger-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-9 border border-slate-200 px-3 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>

            {hasActiveLedgerFilters && (
              <button
                onClick={() => { setTransactionFilter('all'); setDatePreset('all'); setSortOrder('desc'); }}
                className="h-9 px-3 text-sm text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Member Info Card */}
        <div id="printable-ledger" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100">
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

            <div className="flex items-center gap-4">
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
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
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
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
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
          <div className="overflow-x-auto">
            <table className="w-full border border-slate-200 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 divide-x divide-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Reference</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Received</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Withdrawn</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</th>
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Member Ledger</h2>
        <p className="text-sm text-slate-500 mt-1">Search and view individual member transaction history</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Barangay Filter */}
          <select
            className="h-10 px-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none shrink-0"
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            aria-label="Filter by barangay"
          >
            {uniqueBarangays.map(b => (
              <option key={b} value={b}>{b === 'All' ? 'All barangays' : b}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search members"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none transition-all"
            />
          </div>

          <span className="text-sm text-slate-400 shrink-0">
            {totalMembers} member{totalMembers === 1 ? '' : 's'}
          </span>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded shrink-0"
            >
              Clear filters
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-2 sm:ml-auto w-full sm:w-auto">
            <Button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="gap-1.5 shrink-0 whitespace-nowrap bg-coop-green text-white hover:bg-coop-darkGreen"
            >
              <Upload className="w-4 h-4" aria-hidden="true" /> Bulk Upload CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Barangay</th>
              <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</th>
              <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
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
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-green-700 hover:bg-green-800 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
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
        </table>
        {totalMembers > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
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
      </div>

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <BulkUploadDialog
          title="Bulk Upload Ledger"
          description="Import transaction entries into your members' ledgers."
          busy={loading}
          onClose={() => { setShowBulkModal(false); setCsvFile(null); setCsvPreview([]); }}
          footer={<>
            <Button type="button" variant="outline" disabled={loading}
              onClick={() => { setShowBulkModal(false); setCsvFile(null); setCsvPreview([]); }}
              className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Cancel</Button>
            <Button type="button" onClick={handleBulkUpload} disabled={!csvFile || loading}
              className="gap-2 bg-coop-green text-white hover:bg-coop-darkGreen">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {loading ? 'Uploading...' : 'Upload Entries'}
            </Button>
          </>}
        >
          <UploadTemplateCard onDownload={downloadLedgerTemplate} disabled={loading}>
            <p>Replace the sample row with actual member IDs and ledger entries. Keep leading zeros in member IDs and use YYYY-MM-DD dates.</p>
            <p>Credit adds to the balance; debit deducts from it. Enter a positive amount in one column and 0 in the other, without currency signs or thousands separators.</p>
            <p>Columns: memberId, transactionDate, credit, debit, description, transactionType, referenceId, paymentMethod (cash). Keep the column headers unchanged.</p>
          </UploadTemplateCard>
          <UploadFilePicker filename={csvFile?.name} onChange={handleCSVUpload} disabled={loading}
            hint="CSV only ? Review the first 5 entries before uploading" />
          {csvPreview.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Entry preview</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">First 5 rows</span>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>{Object.keys(csvPreview[0]).map(key => <th key={key} className="px-3 py-3 font-medium whitespace-nowrap">{key}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {Object.values(row).map((val, i) => <td key={i} className="px-3 py-3 text-slate-600 whitespace-nowrap">{val}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </BulkUploadDialog>
      )}
    </div>
  );
};

export default MemberLedger;
