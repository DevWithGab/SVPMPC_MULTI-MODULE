import React, { useState } from 'react';
import { Search, ArrowUpDown, BookOpen, Wallet, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import './MemberBalances.css';
import { getBarangay } from '../../../utils/helpers';
import { DEFAULT_NOTICE_THRESHOLDS } from '../../../utils/balanceNotice';
import { Pagination, PaginationInfo } from '../../ui/pagination';

const MemberBalances = ({
  members,
  noticeThresholds,
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
  const targetBalance = noticeThresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance;
  const lowBalanceMembers = members.filter(m => m.balance < targetBalance);
  const totalCapital = members.reduce((s, m) => s + (m.balance || 0), 0);
  const lowBalancePercent = members.length > 0 ? (lowBalanceMembers.length / members.length) * 100 : 0;

  const peso = (value) => `₱${value.toLocaleString('en-PH')}`;

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
        <div><p className="mb-eyebrow">Mortuary management / Members</p><h1>Member balances</h1><p className="mb-description">Track contributions and review member balances.</p></div>
        <button className="mb-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
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

      <p className="mb-footnote">Death-fund deductions are processed per claim from the Claims tab.</p>
    </div>
  );
};

export default MemberBalances;
