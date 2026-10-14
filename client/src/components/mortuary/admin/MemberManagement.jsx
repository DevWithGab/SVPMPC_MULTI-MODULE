import React, { useEffect } from 'react';
import { Users, UserCheck, UserMinus, Heart, Search, FileText } from 'lucide-react';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import '../treasurer/MemberBalances.css';
import './MemberManagement.css';

const MemberManagement = ({
  filteredMembers, members, statusFilter, setStatusFilter, searchQuery, setSearchQuery, setActiveTab
}) => {
  const { page, limit, setPage } = usePagination(1, 10);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, setPage]);

  const totalMembers = filteredMembers.length;
  const totalPages = Math.ceil(totalMembers / limit) || 1;
  const visiblePage = Math.min(page, totalPages);
  const startIndex = (visiblePage - 1) * limit;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + limit);
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all';
  const updateFilter = (setter, value) => { setter(value); setPage(1); };
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <div className="member-balances admin-member-management">
      <header className="mb-header">
        <div>
          <p className="mb-eyebrow">Mortuary management / Members</p>
          <h1>Member management</h1>
          <p className="mb-description">Review registered members, check balances, and access claims and beneficiaries.</p>
        </div>
      </header>

      <AttendanceMetricGrid label="Membership overview" items={[
        ['Total members', members.length.toLocaleString(), 'Registered mortuary fund participants', Users],
        ['Active', members.filter(m => m.status === 'active').length.toLocaleString(), 'Active memberships', UserCheck],
        ['Inactive', members.filter(m => m.status === 'inactive').length.toLocaleString(), 'Inactive memberships', UserMinus],
        ['Deceased', members.filter(m => m.status === 'deceased').length.toLocaleString(), 'Members recorded as deceased', Heart],
      ]} />

      <section className="mb-filters" aria-labelledby="admin-member-filter-title">
        <div className="mb-filter-heading">
          <h2 id="admin-member-filter-title">Find a member</h2>
          <button className="mb-text-button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button>
        </div>
        <div className="mb-filter-grid admin-member-filters">
          <label>
            Search members
            <span className="mb-search">
              <Search size={16} aria-hidden="true" />
              <input value={searchQuery} onChange={e => updateFilter(setSearchQuery, e.target.value)} placeholder="Name or Passbook No." />
            </span>
          </label>
          <label>
            Membership status
            <select value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deceased">Deceased</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-panel" aria-labelledby="admin-member-register-title">
        <div className="mb-register-heading">
          <div>
            <h2 id="admin-member-register-title">Member directory</h2>
            <p>Membership details and current balances for mortuary fund participants.</p>
          </div>
        </div>
        <div className="mb-scope">
          <span role="status">{totalMembers.toLocaleString()} of {members.length.toLocaleString()} members</span>
          <span>{statusFilter === 'all' ? 'All membership statuses' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} members`}</span>
        </div>
        <div className="mb-table-scroll" role="region" aria-label="Member directory" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Member / Passbook</th>
                <th scope="col">Contact</th>
                <th scope="col" className="mb-number">Balance</th>
                <th scope="col">Status</th>
                <th scope="col">Join date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.map(member => (
                <tr key={member.id}>
                  <td><strong>{member.name}</strong><span className="mb-secondary">#{String(member.id).padStart(6, '0')}</span></td>
                  <td>{member.contact || '—'}</td>
                  <td className="mb-number"><strong>₱{(Number(member.currentBalance) || 0).toLocaleString('en-PH')}</strong></td>
                  <td>
                    <span className={`mb-status${member.status === 'active' ? ' mb-status-active' : member.status === 'deceased' ? ' admin-member-deceased' : ''}`}>
                      {member.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : 'Unknown'}
                    </span>
                  </td>
                  <td className="admin-member-join-date">{member.join_date || '—'}</td>
                  <td>
                    {setActiveTab && (
                      <div className="admin-member-actions">
                        <button className="mb-button mb-ledger-button" onClick={() => setActiveTab('beneficiaries')} aria-label="Open beneficiaries">
                          <Heart size={14} aria-hidden="true" /> Beneficiaries
                        </button>
                        <button className="mb-button mb-ledger-button" onClick={() => setActiveTab('claims')} aria-label="Open claims">
                          <FileText size={14} aria-hidden="true" /> Claims
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalMembers === 0 && (
          <div className="mb-empty" role="status">
            <strong>{hasActiveFilters ? 'No members match these filters' : 'No members found'}</strong>
            <p>{hasActiveFilters ? 'Try a different name, passbook number, or membership status.' : 'Registered mortuary fund participants will appear here when records are available.'}</p>
            {hasActiveFilters && <button className="mb-button" onClick={clearFilters}>Reset filters</button>}
          </div>
        )}
        <footer className="mb-pagination">
          <PaginationInfo currentPage={visiblePage} limit={limit} total={totalMembers} />
          {totalMembers > 0 && (
            <Pagination currentPage={visiblePage} totalPages={totalPages} onPageChange={setPage} hasNextPage={visiblePage < totalPages} hasPrevPage={visiblePage > 1} />
          )}
        </footer>
      </section>
      <p className="mb-footnote">Manage claim requests and beneficiary records through their respective tabs.</p>
    </div>
  );
};

export default MemberManagement;
