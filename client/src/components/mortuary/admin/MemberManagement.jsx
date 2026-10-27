import { SearchField } from '../../ui/workspace';
import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput, Select } from '../../ui/input';
import { Panel, PanelHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useEffect, useState } from 'react';
import { Heart, Search, FileText, UserPlus } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import '../treasurer/MemberBalances.css';
import './MemberManagement.css';
import { getStandingLabel, getMemberStanding } from '../../../utils/memberStanding';
import BeneficiaryHistory from './BeneficiaryHistory';
import CreateMemberModal from '../../shared/CreateMemberModal';
import { mortuaryMemberAPI } from '../../../services/api';

const MemberManagement = ({
  filteredMembers, members, statusFilter, setStatusFilter, searchQuery, setSearchQuery, setActiveTab, minimumBalance = 1000, onMemberAdded
}) => {
  const { page, limit, setPage } = usePagination(1, 100);
  const [beneficiaryMember, setBeneficiaryMember] = useState(null);
  const [addingMember, setAddingMember] = useState(false);
  const barangays = [...new Set(members.map((m) => m.barangay).filter(Boolean))].sort();

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

  if (beneficiaryMember) {
    return <BeneficiaryHistory
      memberId={beneficiaryMember.memberId || beneficiaryMember.id}
      memberName={beneficiaryMember.name || beneficiaryMember.memberName}
      onBack={() => setBeneficiaryMember(null)}
      backLabel="Back to members"
      parentSection="Members"
      registrationBeneficiary={{ name: beneficiaryMember.beneficiaries, relationship: beneficiaryMember.beneficiaryRelationship }}
      className="treasurer-member-balances admin-member-history"
    />;
  }

  return (
    <div className="member-balances treasurer-member-balances admin-member-management">
      <p className="mb-eyebrow"><span>Mortuary management</span><span aria-hidden="true">/</span><strong>Members</strong></p>
      <header className="mb-header">
        <div>
          <h1>Member management</h1>
          <p className="mb-description">Review registered members, check balances, and access claims and beneficiaries.</p>
        </div>
        {onMemberAdded && <ActionButton className="mb-button admin-member-add" onClick={() => setAddingMember(true)}><UserPlus size={20} aria-hidden="true" />Add member</ActionButton>}
      </header>
      <CreateMemberModal isOpen={addingMember} onClose={() => setAddingMember(false)} barangays={barangays} createMember={mortuaryMemberAPI.createMember} onCreated={onMemberAdded} />

      <dl className="mb-metrics" aria-label="Membership overview">
        {[
          ['Total members', members.length.toLocaleString(), 'Registered mortuary fund participants'],
          ['Active', members.filter(m => m.status === 'active').length.toLocaleString(), 'Active memberships'],
          ['Inactive', members.filter(m => m.status === 'inactive').length.toLocaleString(), 'Inactive memberships'],
          ['Deceased', members.filter(m => m.status === 'deceased').length.toLocaleString(), 'Members recorded as deceased'],
        ].map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><p>{detail}</p></div>)}
      </dl>

      <section className="mb-filters" aria-labelledby="admin-member-filter-title">
        <div className="mb-filter-heading">
          <h2 id="admin-member-filter-title">Find a member</h2>
          <button className="mb-text-button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button>
        </div>
        <div className="mb-filter-grid admin-member-filters">
          <div>
            <label htmlFor="admin-member-search">Search members</label>
            <SearchField as="span" className="mb-search">
              <Search size={16} aria-hidden="true" />
              <TextInput id="admin-member-search" unstyled value={searchQuery} onChange={e => updateFilter(setSearchQuery, e.target.value)} placeholder="Name or Passbook No." />
            </SearchField>
          </div>
          <div>
            <label htmlFor="admin-member-status">Membership status</label>
            <Select id="admin-member-status" value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deceased">Deceased</option>
            </Select>
          </div>
        </div>
      </section>

      <Panel as="section" className="mb-panel" aria-labelledby="admin-member-register-title">
        <PanelHeader as="div" className="mb-register-heading">
          <div>
            <h2 id="admin-member-register-title">Member directory</h2>
            <p>Membership details and current balances for mortuary fund participants.</p>
          </div>
        </PanelHeader>
        <div className="mb-scope">
          <span role="status">{totalMembers.toLocaleString()} of {members.length.toLocaleString()} members</span>
          <span>{statusFilter === 'all' ? 'All membership statuses' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} members`}</span>
        </div>
        <p className="mb-scroll-hint">Scroll horizontally to view contact details, balances, and member actions.</p>
        <div className="mb-table-scroll" role="region" aria-label="Member directory" tabIndex={0}>
          <DataTable>
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
                  <td className="mb-number"><strong className={Number(member.currentBalance) < 0 ? 'mb-negative-balance' : undefined}>₱{(Number(member.currentBalance) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="mb-secondary" data-standing={getMemberStanding(member.currentBalance, minimumBalance)}>{getStandingLabel(member.currentBalance, minimumBalance)}</span></td>
                  <td>
                    <span className={`mb-status${member.status === 'active' ? ' mb-status-active' : member.status === 'deceased' ? ' admin-member-deceased' : ''}`}>
                      {member.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : 'Unknown'}
                    </span>
                  </td>
                  <td className="admin-member-join-date">{member.join_date || '—'}</td>
                  <td>
                      <div className="admin-member-actions">
                        <ActionButton variant="outline" className="mb-button mb-ledger-button" onClick={() => setBeneficiaryMember(member)} aria-label={`View beneficiaries for ${member.name}`}>
                          <Heart size={14} aria-hidden="true" /> Beneficiaries
                        </ActionButton>
                        {setActiveTab && <ActionButton variant="outline" className="mb-button mb-ledger-button" onClick={() => setActiveTab('claims')} aria-label="Open claims">
                          <FileText size={14} aria-hidden="true" /> Claims
                        </ActionButton>}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        {totalMembers === 0 && (
          <div className="mb-empty" role="status">
            <strong>{hasActiveFilters ? 'No members match these filters' : 'No members found'}</strong>
            <p>{hasActiveFilters ? 'Try a different name, passbook number, or membership status.' : 'Registered mortuary fund participants will appear here when records are available.'}</p>
            {hasActiveFilters && <ActionButton variant="outline" className="mb-button" onClick={clearFilters}>Reset filters</ActionButton>}
          </div>
        )}
        <footer className="mb-pagination">
          <PaginationInfo currentPage={visiblePage} limit={limit} total={totalMembers} />
          {totalMembers > 0 && (
            <Pagination currentPage={visiblePage} totalPages={totalPages} onPageChange={setPage} hasNextPage={visiblePage < totalPages} hasPrevPage={visiblePage > 1} />
          )}
        </footer>
      </Panel>
      <p className="mb-footnote">View a member's beneficiaries from their row. Register or update records in the Beneficiaries tab.</p>
    </div>
  );
};

export default MemberManagement;
