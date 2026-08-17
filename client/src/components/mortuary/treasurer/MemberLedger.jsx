import React, { useState } from 'react';
import { Search, ArrowLeft, Printer, Upload, X, Loader, Download } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';

const extractBarangay = (address) => {
  if (!address) return 'Not Specified';
  const parts = address.split(',');
  return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

// Always two decimals, statement-style. `signed` prefixes +/- instead of
// relying on color alone to carry the direction (accessibility).
const formatPeso = (amount, { signed = false } = {}) => {
  const value = amount || 0;
  const formatted = Math.abs(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return signed ? `${value < 0 ? '-' : '+'}₱${formatted}` : `₱${formatted}`;
};

const formatLedgerDate = (dateStr) => {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const monthKeyOf = (dateStr) => (dateStr ? dateStr.slice(0, 7) : 'unknown');

// Quick date-range presets for the ledger filter, replacing manual From/To
// pickers — the table is already grouped by month, so "pick two exact
// dates" was more friction than the common cases actually need. Returned as
// YYYY-MM-DD strings so they compare the same way entry.date already does
// (both parsed via `new Date(...)`, so no timezone drift between the two).
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

// Some entries (e.g. system-generated deductions) carry a raw UUID as their
// reference instead of a short human-assigned code — shorten those in the
// table while keeping the full value available on hover.
const shortenRef = (ref) => {
  if (!ref) return '—';
  return ref.length > 20 ? `${ref.slice(0, 8)}…${ref.slice(-6)}` : ref;
};

// Groups already-sorted entries by month for statement-style section headers.
// "Closing balance" is always the balance as of the chronologically last
// entry in that month, regardless of which way the table is currently sorted.
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
  members,
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
  setIsAddContributionOpen,
  handleTriggerAutomatedNotice,
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
    if (!csvFile) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
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
      };
      reader.readAsText(csvFile);
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

    // memberLedgerEntries is already scoped to this member (fetched via the
    // dedicated per-member endpoint, paged through in full) — no client-side
    // filtering by member_id needed.
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
      // `date` is day-only, so same-day entries tie above — break the tie by
      // when each entry was actually posted (createdAt) so the one just
      // recorded lands first under "Newest first" instead of being ordered
      // by transaction amount.
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'asc' ? createdA - createdB : createdB - createdA;
    });

    const totalReceived = mEntries.reduce((sum, e) => sum + (e.received || 0), 0);
    const totalWithdrawn = mEntries.reduce((sum, e) => sum + (e.withdrawn || 0), 0);
    const netMovement = totalReceived - totalWithdrawn;
    const hasActiveLedgerFilters =
      transactionFilter !== 'all' || datePreset !== 'all';
    const monthGroups = groupEntriesByMonth(mEntries, sortOrder);

    return (
      <div className="space-y-5 print:space-y-0">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Member Ledger</h2>
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
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={() => setIsAddContributionOpen(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium bg-green-700 hover:bg-green-800 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            >
              Add Deposit
            </button>
          </div>
        </div>

        {/* Member Info Card */}
        <div id="printable-ledger" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-base font-bold text-green-700">
                {getInitials(currentMember.name)}
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-900">{currentMember.name}</p>
                <p className="text-xs text-slate-400">#{currentMember.id.toString().padStart(6, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Current Balance</p>
                <p className="text-xl font-mono font-bold text-slate-900">{formatPeso(currentMember.balance)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Address</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.address || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Beneficiary</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.beneficiaries || '—'}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-x-5 gap-y-3 items-center print:hidden">
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
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Net Movement</p>
                <p className="font-mono text-sm font-bold text-slate-900">{formatPeso(netMovement, { signed: true })}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
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
                <tbody key={group.key} className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70">
                    <td colSpan={4} className="px-5 py-2 text-xs font-bold text-slate-500 tracking-wider">
                      {group.label}
                    </td>
                    <td className="px-5 py-2 text-xs text-right text-slate-400">
                      closing balance <span className="font-mono text-slate-500">{formatPeso(group.closingBalance)}</span>
                    </td>
                  </tr>
                  {group.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
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
  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(m => extractBarangay(m.address))))].sort();
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
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Member Ledger</h2>
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
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            >
              <Upload className="w-4 h-4" /> Bulk Upload
            </button>
            <button
              onClick={handleTriggerAutomatedNotice}
              disabled={barangayFilter === 'All'}
              title={barangayFilter === 'All' ? 'Select a specific barangay above to send notices to its members' : undefined}
              className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              Send Notices
            </button>
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
                    <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-400">#{member.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{extractBarangay(member.address)}</td>
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
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalMembers)} of {totalMembers}
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
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="h-9 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-slate-900">Bulk Upload Ledger</h3>
              <button
                onClick={() => { setShowBulkModal(false); setCsvFile(null); setCsvPreview([]); }}
                aria-label="Close bulk upload dialog"
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm font-medium text-slate-700 mb-1">Upload a CSV file</p>
                <p className="text-xs text-slate-400 mb-4">
                  Columns: memberId, transactionDate, credit, debit, description
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="ledger-csv-upload"
                />
                <label
                  htmlFor="ledger-csv-upload"
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-1"
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Choose File
                </label>
                {csvFile && <p className="text-sm text-emerald-600 mt-3 font-medium">{csvFile.name}</p>}
              </div>
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Preview (first 5 rows)</p>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {Object.keys(csvPreview[0]).map(key => (
                            <th key={key} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            {Object.values(row).map((val, i) => (
                              <td key={i} className="px-3 py-2 text-slate-600 whitespace-nowrap">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 shrink-0">
              <button
                onClick={() => { setShowBulkModal(false); setCsvFile(null); setCsvPreview([]); }}
                className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!csvFile || loading}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin mr-1.5 inline" /> : null}
                {loading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberLedger;
