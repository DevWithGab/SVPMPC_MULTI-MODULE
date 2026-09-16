import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, History, Pencil } from 'lucide-react';
import { beneficiaryAPI } from '../../../services/api';
import BeneficiaryHistory from './BeneficiaryHistory';
import UpdateBeneficiaryModal from './modals/UpdateBeneficiaryModal';

export default function Beneficiaries({ user }) {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [historyMember, setHistoryMember] = useState(null); // { memberId, memberName }
  const [editRecord, setEditRecord] = useState(null); // beneficiary record being edited (or null)

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await beneficiaryAPI.getAllBeneficiaries({ page, limit: 10, search: search.trim() || undefined });
      setBeneficiaries(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load beneficiaries.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  if (historyMember) {
    return (
      <BeneficiaryHistory
        memberId={historyMember.memberId}
        memberName={historyMember.memberName}
        onBack={() => setHistoryMember(null)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beneficiaries</h1>
        <p className="text-slate-500 text-sm mt-1">Current beneficiary on file for each member.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by member or beneficiary name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member Name</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Beneficiary Name</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Relationship</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Contact Number</th>
              <th className="text-right px-6 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">Loading beneficiaries...</td>
              </tr>
            ) : beneficiaries.length > 0 ? (
              beneficiaries.map((b) => (
                <tr key={b.beneficiaryId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{b.memberName}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{b.beneficiaryName}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 hidden sm:table-cell">{b.relationship}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 hidden md:table-cell">{b.contactNumber}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setHistoryMember({ memberId: b.memberId, memberName: b.memberName })}
                        className="text-slate-400 hover:text-coop-green transition-colors"
                        title="View history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditRecord(b)}
                        className="text-slate-400 hover:text-coop-green transition-colors"
                        title="Update"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-slate-300" />
                    {error || 'No beneficiaries found.'}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} record{pagination.total === 1 ? '' : 's'}
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

      <UpdateBeneficiaryModal
        isOpen={Boolean(editRecord)}
        onClose={() => setEditRecord(null)}
        memberId={editRecord?.memberId}
        memberName={editRecord?.memberName}
        current={editRecord}
        user={user}
        onSaved={load}
      />
    </div>
  );
}
