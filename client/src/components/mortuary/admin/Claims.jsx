import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, FileText, Clock, CheckCircle2, Banknote, XCircle } from 'lucide-react';
import StatCard from '../shared/StatCard';
import { claimAPI, mortuaryMemberAPI, mortuaryDashboardAPI } from '../../../services/api';
import { getClaimStatusMeta, CLAIM_STATUS_ORDER } from './claimMeta';
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

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await claimAPI.getAllClaims({
        page,
        limit: 10,
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
    try {
      const res = await mortuaryMemberAPI.getAllMembers({ limit: 100 });
      setMembers((res?.members || []).filter((m) => m.status !== 'deceased'));
    } catch {
      // Non-fatal — the register modal will just show an empty picker.
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Claims Management</h1>
          <p className="text-slate-500 text-sm mt-1">Register, verify, and process death benefit claims.</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-2 h-11 px-5 text-sm font-semibold bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg transition-colors shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Register New Claim
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_TILES.map(({ status, icon, color }) => {
          const meta = getClaimStatusMeta(status);
          return (
            <StatCard
              key={status}
              title={meta.label}
              value={claimCounts[status] ?? 0}
              icon={icon}
              color={color}
              active={statusFilter === status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            />
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by claim ID, member, or beneficiary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-4 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none"
          >
            <option value="all">All statuses</option>
            {CLAIM_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{getClaimStatusMeta(status).label}</option>
            ))}
          </select>

          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors shrink-0"
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
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Claim ID</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Beneficiary</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Date Filed</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">Loading claims...</td>
              </tr>
            ) : claims.length > 0 ? (
              claims.map((claim) => {
                const meta = getClaimStatusMeta(claim.status);
                return (
                  <tr
                    key={claim.claimId}
                    onClick={() => setSelectedClaimId(claim.claimId)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{claim.claimId.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{claim.memberName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">{claim.beneficiaryName}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(claim.dateFiled).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    {error || 'No claims found.'}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} claim{pagination.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="h-9 px-4 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <RegisterClaimModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        members={members}
        user={user}
        onRegistered={handleChanged}
      />
    </div>
  );
}
