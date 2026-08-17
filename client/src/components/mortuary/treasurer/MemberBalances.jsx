import React, { useState } from 'react';
import { Search, ArrowUpDown, ChevronRight, Wallet, Clock, AlertTriangle } from 'lucide-react';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import StatCard from '../shared/StatCard';

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

const MemberBalances = ({
  members,
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

  const lowBalanceMembers = members.filter(m => m.balance < 1000);
  const totalCapital = members.reduce((s, m) => s + (m.balance || 0), 0);
  const lowBalancePercent = members.length > 0 ? (lowBalanceMembers.length / members.length) * 100 : 0;

  const filteredMembers = members
    .filter(m => (memberFilter === 'low' ? m.balance < 1000 : true))
    .filter(m => (barangayFilter === 'All' ? true : extractBarangay(m.address) === barangayFilter))
    .filter(m => (statusFilter === 'all' ? true : m.status === statusFilter))
    .filter(m => (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.id?.toString().includes(searchQuery)))
    .sort((a, b) => sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance);

  const totalPagesMemberBalances = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
  const currentMembersBalancesChunk = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(m => extractBarangay(m.address))))].sort();
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
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Member Balances
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Track contributions and spot balances that need attention. Death-fund deductions are now
          triggered per claim from the Claims tab.
        </p>
      </div>

      {/* Stats — the two risk-related cards double as quick filters (click to
          jump straight to that segment of the table, click again to clear it) */}
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
          subtitle={memberFilter === 'low' ? 'Showing this filter — click to clear' : 'Below ₱1,000 — click to filter'}
          icon={Clock}
          color="amber"
          active={memberFilter === 'low'}
          onClick={() => setMemberFilter(memberFilter === 'low' ? 'all' : 'low')}
        />
        <StatCard
          title="At risk"
          value={`${lowBalancePercent.toFixed(1)}%`}
          subtitle={memberFilter === 'low' ? 'Showing this filter — click to clear' : 'Requires follow-up — click to filter'}
          icon={AlertTriangle}
          color="rose"
          active={memberFilter === 'low'}
          onClick={() => setMemberFilter(memberFilter === 'low' ? 'all' : 'low')}
        />
      </div>

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
                    <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
                      {getInitials(m.name)}
                    </div>
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
                  {extractBarangay(m.address)}
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-sm font-bold tabular-nums ${m.balance < 1000 ? 'text-red-500' : 'text-slate-900'}`}
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
                    <ChevronRight className="w-4 h-4" />
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
