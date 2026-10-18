import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, History, Pencil, RefreshCw, Upload } from 'lucide-react';
import { beneficiaryAPI } from '../../../services/api';
import BeneficiaryHistory from './BeneficiaryHistory';
import UpdateBeneficiaryModal from './modals/UpdateBeneficiaryModal';
import BulkBeneficiaryUpload from './modals/BulkBeneficiaryUpload';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import '../treasurer/MemberBalances.css';
import './Beneficiaries.css';

export default function Beneficiaries({ user }) {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyMember, setHistoryMember] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const res = await beneficiaryAPI.getAllBeneficiaries({ page, limit: 10, search: search.trim() || undefined });
      if (currentRequest !== requestId.current) return;
      setBeneficiaries(Array.isArray(res?.data) ? res.data : []);
      setPagination(res?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.response?.data?.message || 'Unable to load beneficiaries.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  const updateSearch = (value) => { setSearch(value); setPage(1); };

  if (historyMember) {
    return <BeneficiaryHistory memberId={historyMember.memberId} memberName={historyMember.memberName} onBack={() => setHistoryMember(null)} />;
  }

  return (
    <div className="member-balances admin-beneficiaries">
      <header className="mb-header">
        <div>
          <p className="mb-eyebrow">Mortuary management / Beneficiaries</p>
          <h1>Beneficiaries</h1>
          <p className="mb-description">Review the beneficiary on file for each member, update details, and track changes.</p>
        </div>
        <div className="mb-header-actions">
          <button className="mb-button" onClick={() => setBulkUploadOpen(true)}>
            <Upload size={15} aria-hidden="true" />Bulk register
          </button>
          <button className="mb-button" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="mb-filters" aria-labelledby="beneficiary-filter-title">
        <div className="mb-filter-heading">
          <h2 id="beneficiary-filter-title">Find a beneficiary</h2>
          <button className="mb-text-button" onClick={() => updateSearch('')} disabled={!search}>Reset search</button>
        </div>
        <div className="mb-filter-grid beneficiary-filter-grid">
          <label>
            Search members or beneficiaries
            <span className="mb-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Member or beneficiary name" value={search} onChange={e => updateSearch(e.target.value)} />
            </span>
          </label>
        </div>
      </section>

      <section className="mb-panel" aria-labelledby="beneficiary-directory-title" aria-busy={loading}>
        <div className="mb-register-heading">
          <div><h2 id="beneficiary-directory-title">Beneficiary directory</h2><p>Register a beneficiary or update an existing record. Previous records remain in history.</p></div>
        </div>
        <div className="mb-scope">
          <span role="status">{loading ? 'Loading beneficiary records…' : error ? 'Beneficiary records unavailable' : `${pagination.total.toLocaleString()} ${search.trim() ? 'matching' : 'member'} records`}</span>
          <span>Current beneficiary on file</span>
        </div>
        <div className="mb-table-scroll" role="region" aria-label="Beneficiary directory" tabIndex={0}>
          <table>
            <thead><tr>
              <th scope="col">Member</th><th scope="col">Beneficiary</th><th scope="col">Relationship</th><th scope="col">Contact number</th><th scope="col">Status</th><th scope="col">Actions</th>
            </tr></thead>
            <tbody>
              {!loading && !error && beneficiaries.map(b => (
                <tr key={b.memberId}>
                  <td><strong>{b.memberName}</strong></td>
                  <td>{b.beneficiaryName || '—'}</td>
                  <td>{b.relationship || '—'}</td>
                  <td className="beneficiary-contact">{b.contactNumber || '—'}</td>
                  <td><span className={`mb-status ${b.isRegistered ? 'mb-status-active' : 'beneficiary-unregistered'}`}>
                    {b.isRegistered ? 'Registered' : 'Not registered'}
                  </span></td>
                  <td><div className="beneficiary-actions">
                    <button className="mb-button mb-ledger-button" onClick={() => setHistoryMember({ memberId: b.memberId, memberName: b.memberName })} aria-label={`View beneficiary history for ${b.memberName}`}>
                      <History size={14} aria-hidden="true" /> History
                    </button>
                    <button className="mb-button mb-ledger-button" onClick={() => setEditRecord(b)} aria-label={`${b.isRegistered ? 'Update' : 'Register'} beneficiary for ${b.memberName}`}>
                      <Pencil size={14} aria-hidden="true" /> {b.isRegistered ? 'Update' : 'Register'}
                    </button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <div className="mb-empty" role="status"><RefreshCw size={22} className="animate-spin" aria-hidden="true" /><p>Loading beneficiaries…</p></div>
        ) : error ? (
          <div className="mb-empty"><p role="alert">{error}</p><button className="mb-button" onClick={load}>Try again</button></div>
        ) : beneficiaries.length === 0 && (
          <div className="mb-empty" role="status">
            <Users size={28} aria-hidden="true" />
            <strong>{search.trim() ? 'No beneficiaries match your search' : 'No active members found'}</strong>
            <p>{search.trim() ? 'Try a different member or beneficiary name.' : 'Beneficiary details will appear here when member records are available.'}</p>
            {search && <button className="mb-button" onClick={() => updateSearch('')}>Reset search</button>}
          </div>
        )}
        {!loading && !error && <footer className="mb-pagination">
          <PaginationInfo currentPage={page} limit={10} total={pagination.total} />
          {pagination.total > 0 && <Pagination currentPage={page} totalPages={pagination.totalPages} onPageChange={setPage} hasNextPage={page < pagination.totalPages} hasPrevPage={page > 1} />}
        </footer>}
      </section>
      <p className="mb-footnote">Not registered means the beneficiary was captured at sign-up and does not yet have a formal beneficiary record.</p>

      <UpdateBeneficiaryModal isOpen={Boolean(editRecord)} onClose={() => setEditRecord(null)} memberId={editRecord?.memberId} memberName={editRecord?.memberName} current={editRecord} user={user} onSaved={load} />
      {bulkUploadOpen && <BulkBeneficiaryUpload onClose={() => setBulkUploadOpen(false)} onImported={load} />}
    </div>
  );
}
