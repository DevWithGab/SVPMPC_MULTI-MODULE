import { SearchField } from '../../ui/workspace';
import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput, Select } from '../../ui/input';
import { Panel, PanelHeader } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import useUrlState from '../../../hooks/useUrlState';
import { loadAllPages } from '../../../utils/loadAllPages';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, FileText, Clock, CheckCircle2, Banknote, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import '../../attendance/shared/AttendanceMetricGrid.css';
import '../treasurer/MemberBalances.css';
import '../treasurer/Claims.css';
import '../treasurer/Dashboard.css';
import './Claims.css';
import { claimAPI, mortuaryMemberAPI, mortuaryDashboardAPI } from '../../../services/api';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { getClaimStatusMeta, getClaimAction, CLAIM_STATUS_ORDER } from '../shared/claimMeta';
import ClaimDetails from './ClaimDetails';
import RegisterClaimModal from './modals/RegisterClaimModal';

const STAT_TILES = [
  { status: 'pending_requirements', icon: Clock, color: 'amber' },
  { status: 'pending_deduction', icon: Banknote, color: 'blue' },
  { status: 'released', icon: CheckCircle2, color: 'emerald' },
  { status: 'rejected', icon: XCircle, color: 'rose' },
];

export default function Claims({ user }) {
  const [claims, setClaims] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [claimCounts, setClaimCounts] = useState({});
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedClaimId, setSelectedClaimId] = useUrlState('claim', null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await claimAPI.getAllClaims({
        page,
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setClaims(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load claims.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await mortuaryDashboardAPI.getAdminDashboard();
      setClaimCounts(res?.data?.claims || {});
    } catch {
      // Non-fatal — stat tiles just show 0s if this fails.
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const records = await loadAllPages(page => mortuaryMemberAPI.getAllMembers({ page, limit: 100 }));
      setMembers(records.filter(m => m.status !== 'deceased'));
    } catch {
      setMembersError('Unable to load members.');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    loadCounts();
    loadMembers();
  }, [loadCounts, loadMembers]);

  const handleChanged = () => {
    loadClaims();
    loadCounts();
    loadMembers();
  };

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  if (selectedClaimId) {
    return (
      <ClaimDetails
        claimId={selectedClaimId}
        user={user}
        onBack={() => setSelectedClaimId(null)}
        onChanged={handleChanged}
      />
    );
  }

  const hasActiveFilters = search !== '' || statusFilter !== 'all';
  const updateFilter = (setter, value) => { setter(value); setPage(1); };
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPage(1); };

  return (
    <div className="mortuary-claims admin-claims treasurer-dashboard treasurer-member-balances treasurer-claims">
      <p className="td-eyebrow"><span>Mortuary management</span><span aria-hidden="true">/</span><strong>Claims</strong></p>
      <header className="td-header">
        <div>
          <h1>Claims management</h1>
          <p className="td-description">Register, verify, and process death benefit claims.</p>
        </div>
        <div className="td-header-actions">
          <ActionButton variant="outline" className="td-button" onClick={handleChanged} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          <ActionButton variant="default" type="button" aria-haspopup="dialog" onClick={() => setShowRegisterModal(true)} className="td-button td-primary"><Plus size={15} aria-hidden="true" />Register new claim</ActionButton>
        </div>
      </header>

      <section className="ac-metrics" aria-label="Claim status overview">
        {STAT_TILES.map(({ status, icon }) => {
          const meta = getClaimStatusMeta(status);
          return (
            <button key={status} className="ac-metric" aria-pressed={statusFilter === status} onClick={() => updateFilter(setStatusFilter, statusFilter === status ? 'all' : status)}>
              <div className="attendance-metric-heading"><p>{meta.label}</p><span className="attendance-metric-icon">{React.createElement(icon, { size: 15, 'aria-hidden': true })}</span></div>
              <strong>{(claimCounts[status] ?? 0).toLocaleString()}</strong>
              <span>{statusFilter === status ? 'Selected · Click to clear' : 'Click to filter claims'}</span>
            </button>
          );
        })}
      </section>

      <section className="mb-filters" aria-labelledby="ac-filter-title">
        <div className="mb-filter-heading"><h2 id="ac-filter-title">Find a claim</h2><button className="mb-text-button" onClick={clearFilters} disabled={!hasActiveFilters}>Reset filters</button></div>
        <div className="mb-filter-grid ac-filter-grid">
          <div><label htmlFor="ac-search">Search claims</label><SearchField as="span" className="mb-search"><Search size={16} aria-hidden="true" /><TextInput id="ac-search" unstyled value={search} onChange={e => updateFilter(setSearch, e.target.value)} placeholder="Claim ID, member, or beneficiary" /></SearchField></div>
          <div><label htmlFor="ac-status-filter">Claim status</label><Select id="ac-status-filter" value={statusFilter} onChange={e => updateFilter(setStatusFilter, e.target.value)}><option value="all">All statuses</option>{CLAIM_STATUS_ORDER.map(status => <option key={status} value={status}>{getClaimStatusMeta(status).label}</option>)}</Select></div>
        </div>
      </section>

      <Panel as="section" className="mc-register" aria-labelledby="ac-register-title" aria-busy={loading}>
        <PanelHeader as="div" className="mb-register-heading"><div><h2 id="ac-register-title">Claim register</h2><p>Review requirements, track progress, and open a claim to take action.</p></div></PanelHeader>
        <div className="mb-scope"><span role="status">{loading ? 'Loading claims…' : error ? 'Claims unavailable' : `${pagination.total.toLocaleString()} matching claims`}</span><span>Highlighted rows need admin action</span></div>
        <p className="mc-scroll-hint">Scroll horizontally to view beneficiaries, dates, status, and claim actions.</p>
        <div className="mc-table-scroll" role="region" aria-label="Claim register" tabIndex={0}>
        <DataTable className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th scope="col" className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Claim ID</th>
              <th scope="col" className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th scope="col" className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Beneficiary</th>
              <th scope="col" className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Date Filed</th>
              <th scope="col" className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="text-right px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">Loading claims...</td>
              </tr>
            ) : error ? (
              <tr><td colSpan={6}><div className="mb-empty"><p role="alert">{error}</p><ActionButton variant="outline" className="td-button" onClick={loadClaims}>Try again</ActionButton></div></td></tr>
            ) : claims.length > 0 ? (
              claims.map((claim) => {
                const meta = getClaimStatusMeta(claim.status);
                const action = getClaimAction(claim.status);
                const needsAdmin = action.actor === 'admin';
                const open = () => setSelectedClaimId(claim.claimId);
                return (
                  /* Naka-clickable pa rin ang row bilang mouse convenience,
                  pero hindi ito binigyan ng role="button"/tabIndex: mag-nest
                  kasi ng interactive element sa loob ng isa pa. Ang Action
                  button sa baba ang totoong control, kaya diretso ang tab ng
                  keyboard users papunta dito. */
                  <tr
                    key={claim.claimId}
                    data-needs-admin={needsAdmin ? true : undefined}
                    onClick={open}
                    className={`transition-colors cursor-pointer ${
                      needsAdmin ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Nasa first cell ang accent imbes na sa row - dahil
                        nalulunod ng border-collapse ang border sa isang <tr>. */}
                    <td className={`px-6 py-4 text-xs font-mono text-slate-500 border-l-2 ${
                      needsAdmin ? 'border-amber-400' : 'border-transparent'
                    }`}>
                      {claim.claimId}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{claim.memberName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">{claim.beneficiaryName}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(claim.dateFiled).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span data-status={claim.status} className={`ac-status inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${meta.bg} ${meta.text} ${meta.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      {/* Sinasabi ng badge kung ano ang claim; ito naman ang
                          sinasabi kung kaninong turn na, na talagang
                          hinahanap ng Admin. */}
                      {action.hint && (
                        <span className={`block text-[11px] mt-1 ${
                          needsAdmin ? 'font-semibold text-amber-700' : 'text-slate-400'
                        }`}>
                          {action.hint}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); open(); }}
                        aria-label={`${action.label} for the claim of ${claim.memberName}`}
                        className={`td-button ${needsAdmin ? 'td-primary' : ''}`}
                      >
                        {action.label}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <strong>{hasActiveFilters ? 'No claims match these filters' : 'No claims found'}</strong>
                    {hasActiveFilters && <ActionButton variant="outline" className="td-button" onClick={clearFilters}>Reset filters</ActionButton>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
        </div>
        {!loading && !error && pagination.total > 0 && (
          <div className="mc-pagination">
            <PaginationInfo currentPage={page} limit={100} total={pagination.total} />
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              hasNextPage={page < pagination.totalPages}
              hasPrevPage={page > 1}
            />
          </div>
        )}
      </Panel>

      <RegisterClaimModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        members={members}
        membersLoading={membersLoading}
        membersError={membersError}
        onRetryMembers={loadMembers}
        user={user}
        onRegistered={handleChanged}
      />
    </div>
  );
}
