import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import useUrlState from '../../../hooks/useUrlState';
import { loadAllPages } from '../../../utils/loadAllPages';
import { getBarangay } from '../../../utils/helpers';
import LoadError from '../../shared/common/LoadError';
import MemberLedger from '../finance_officer/MemberLedger';
import Reports from '../finance_officer/Reports';

const PAGE_SIZE = 100;

export default function FinancialRecords({ view, user, stats, showToast }) {
  const [members, setMembers] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [memberId, setMemberId] = useUrlState('member', null);
  const [snapshot, setSnapshot] = useState({ memberId: null, entries: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [search, setSearch] = useState('');
  const [barangay, setBarangay] = useState('All');
  const [page, setPage] = useState(1);
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      await Promise.all([
        api.get('/mortuary/treasurer/balances/all', { params: { status: 'all' } }),
        api.get('/mortuary/treasurer/notice-thresholds'),
      ]).then(([roster, settings]) => {
        if (!roster.data.success || !settings.data.success) throw new Error('Incomplete records');
        if (cancelled) return;
        setMembers((roster.data.data.members || []).map(member => ({ ...member, currentBalance: member.balance ?? 0 })));
        setThresholds(settings.data.data);
      }).catch(() => {
        if (!cancelled) setError('Unable to load member balances and ledger settings.');
      }).finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    return () => { cancelled = true; };
  }, [version]);

  useEffect(() => {
    if (view !== 'ledger' || !memberId) return;
    let cancelled = false;
    const load = async () => {
      setLedgerLoading(true);
      setLedgerError('');
      setSnapshot({ memberId: null, entries: [] });
      await loadAllPages(async page => {
        const response = await api.get(`/mortuary/treasurer/ledger/${encodeURIComponent(memberId)}`, { params: { page, limit: PAGE_SIZE } });
        return response.data;
      }).then(entries => {
        if (!cancelled) setSnapshot({ memberId, entries });
      }).catch(() => {
        if (!cancelled) setLedgerError('Unable to load the complete member ledger.');
      }).finally(() => { if (!cancelled) setLedgerLoading(false); });
    };
    load();
    return () => { cancelled = true; };
  }, [memberId, view, version]);

  if (error) return <LoadError message={error} onRetry={refresh} retrying={loading} />;
  if (loading) return <p role="status">Loading member records...</p>;
  if (view === 'reports') return <Reports members={members} stats={stats} />;
  if (ledgerError) return <LoadError message={ledgerError} onRetry={refresh} retrying={ledgerLoading} />;

  const selectedMember = members.find(member => String(member.id || member.memberId) === memberId);
  if (memberId && !selectedMember) return <div role="status">This member could not be found. <button onClick={() => setMemberId(null)}>Back to member ledgers</button></div>;
  const filtered = members.filter(member =>
    (barangay === 'All' || getBarangay(member) === barangay) &&
    (!search || member.name?.toLowerCase().includes(search.toLowerCase()) || String(member.id).includes(search))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  return <MemberLedger
    user={user} members={members} noticeThresholds={thresholds}
    ledgerMembers={filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
    pagination={{ total: filtered.length, totalPages }}
    selectedLedgerMember={selectedMember || null}
    setSelectedLedgerMember={member => setMemberId(member ? String(member.id || member.memberId) : null)}
    memberLedgerEntries={snapshot.memberId === memberId ? snapshot.entries : []}
    loadingMemberLedger={ledgerLoading || (!!memberId && snapshot.memberId !== memberId)}
    searchQuery={search} setSearchQuery={setSearch}
    barangayFilter={barangay} setBarangayFilter={setBarangay}
    currentPage={currentPage} setCurrentPage={setPage} itemsPerPage={PAGE_SIZE}
    showToast={showToast} refreshData={refresh}
  />;
}
