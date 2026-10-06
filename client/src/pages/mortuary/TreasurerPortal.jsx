import { loadAllPages } from '../../utils/loadAllPages';
import LoadError from '../../components/shared/common/LoadError';
import useUrlState from '../../hooks/useUrlState';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, CreditCard, FileText, LayoutGrid, BarChart3,
  LogOut, ChevronLeft, ChevronRight, Loader2, ClipboardCheck, Menu
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

// Import modular components
import {
  Dashboard,
  MemberBalances,
  Contributions,
  MemberLedger,
  ClaimsPendingDeduction,
  ClaimsAwaitingRelease,
  ClaimDisbursementReport,
  ClaimIncomeReport,
  Reports
} from '../../components/mortuary/treasurer';

// Import shared components
import Modal from '../../components/mortuary/shared/Modal';
import SearchableMemberSelect from '../../components/mortuary/shared/SearchableMemberSelect';
import { Toast } from '../../components/ui/toast';
import Button from '../../components/shared/ui/Button';
import Input from '../../components/shared/ui/Input';
import api from '../../services/api';
import { DEFAULT_NOTICE_THRESHOLDS } from '../../utils/balanceNotice';

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, collapsed, onNavigate }) => (
  <button
    onClick={() => {
      setActiveTab(id);
      onNavigate?.();
    }}
    title={collapsed ? label : undefined}
    aria-label={label}
    aria-current={activeTab === id ? 'page' : undefined}
    className={`w-full flex items-center gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset ${
      collapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'
    } ${
      activeTab === id
        ? 'bg-white text-coop-darkGreen shadow-sm'
        : 'text-green-100/80 hover:bg-white/10 hover:text-white'
    }`}
  >
    <Icon className="w-4.5 h-4.5 shrink-0" />
    {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
  </button>
);

const ClaimsViewToggle = ({ claimsView, setClaimsView, counts }) => (
  <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
    {[
      { id: 'pending-deduction', label: 'Pending Deduction', count: counts?.pendingDeduction ?? 0 },
      { id: 'awaiting-release', label: 'Awaiting Release', count: counts?.awaitingRelease ?? 0 },
      { id: 'disbursement-report', label: 'Disbursement Report', count: 0 },
      { id: 'income-report', label: 'Claims Summary', count: 0 },
    ].map((opt) => (
      <button
        key={opt.id}
        onClick={() => setClaimsView(opt.id)}
        aria-pressed={claimsView === opt.id}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
          claimsView === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {opt.label}
        {opt.count > 0 && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[11px] font-bold rounded-full bg-rose-100 text-rose-700">
            {opt.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

const PortalSkeleton = () => (
  <div className="space-y-6 animate-pulse" role="status" aria-label="Loading treasurer data">
    <div className="space-y-2">
      <div className="h-8 w-56 bg-slate-200 rounded" />
      <div className="h-4 w-72 bg-slate-100 rounded" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-24" />
      ))}
    </div>
    <div className="bg-white border border-slate-200 rounded-xl h-72" />
  </div>
);

const TreasurerPortal = ({ user, onBack, token }) => {
  // State management
  const [activeTab, setActiveTab] = useUrlState('tab', 'dashboard', ['dashboard', 'members', 'claims', 'ledger', 'contributions', 'reports']);
  const [claimsView, setClaimsView] = useUrlState('claimsView', 'pending-deduction', ['pending-deduction', 'awaiting-release', 'disbursement-report', 'income-report']); // 'pending-deduction' | 'awaiting-release' | 'disbursement-report' | 'income-report'
  const [members, setMembers] = useState([]);
  // Separate from `members` above (which the balances aggregation scopes to
  // active members only — exactly what Member Balances/Ledger need). Reports
  // needs every status so Deceased/Inactive counts and the Deceased Members
  // report aren't silently empty, so it gets its own full-roster fetch
  // instead of widening `members` and risking those other screens.
  const [reportMembers, setReportMembers] = useState([]);
  const [loadingReportMembers, setLoadingReportMembers] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState({
    fundBalance: 0,
    activeMembers: 0,
    totalMembers: 0,
    lowBalanceMembers: 0,
    totalCollected: 0,
    memberStanding: {
      excellent: 0,
      good: 0,
      fair: 0,
      atRisk: 0
    },
    statusComposition: {
      active: 0,
      inactive: 0,
      deceased: 0
    }
  });
  const [noticeThresholds, setNoticeThresholds] = useState(DEFAULT_NOTICE_THRESHOLDS);
  const [ledgerSnapshot, setLedgerSnapshot] = useState({ memberId: null, entries: [] });
  const [loadingMemberLedger, setLoadingMemberLedger] = useState(false);
  const [claimsCounts, setClaimsCounts] = useState({ pendingDeduction: 0, awaitingRelease: 0 });
  const [toast, setToast] = useState(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [ledgerMembers, setLedgerMembers] = useState([]);
  const [ledgerPagination, setLedgerPagination] = useState(null);
  
  // Modal states
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('treasurerSidebarCollapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // Form data states
  const [newContribution, setNewContribution] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    status: 'paid'
  });
  // Set when "Add Deposit" is opened from a specific member's ledger page —
  // the Member field then shows this member locked/read-only instead of a
  // search box, since the treasurer already picked them by being on their
  // ledger. Null means the general "Record Payment" flow, which still
  // searches across all members.
  const [lockedContributionMember, setLockedContributionMember] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useUrlState('member', null);
  const selectedMemberLedger = ledgerSnapshot.memberId === selectedMemberId ? ledgerSnapshot.entries : [];
  const selectedLedgerMember = members.find(member => String(member.id || member.memberId) === selectedMemberId) || null;
  const setSelectedLedgerMember = member => setSelectedMemberId(member ? String(member.id || member.memberId) : null);
  const [loadErrors, setLoadErrors] = useState({});
  const [loaded, setLoaded] = useState({});
  const [retrying, setRetrying] = useState(false);
  const ledgerRequestRef = useRef(0);
  const ledgerListRequestRef = useRef(0);
  const markLoaded = useCallback(key => {
    setLoadErrors(previous => ({ ...previous, [key]: null }));
    setLoaded(previous => ({ ...previous, [key]: true }));
  }, []);
  const markFailed = useCallback((key, label) => setLoadErrors(previous => ({ ...previous, [key]: `Unable to load ${label}.` })), []);

  // Data fetching functions
  const fetchMembers = useCallback(async () => {
    try {
      const response = await api.get('/mortuary/treasurer/balances/all');
      if (!response.data.success) throw new Error(response.data.message || 'Request failed');
      if (response.data.success) {
        setMembers(response.data.data.members || []);
        markLoaded('members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      markFailed('members', 'member balances');
    }
  }, [markLoaded, markFailed]);

  // Full member roster (every status) for Reports — fetched lazily, only
  // once the Reports tab is actually opened, since it's the one screen that
  // needs more than the active-only balances list above.
  const fetchReportMembers = useCallback(async () => {
    setLoadingReportMembers(true);
    try {
      const response = await api.get('/mortuary/treasurer/balances/all', { params: { status: 'all' } });
      if (!response.data.success) throw new Error(response.data.message || 'Request failed');
      const normalized = (response.data.data.members || []).map((m) => ({
        ...m,
        currentBalance: m.balance ?? 0,
      }));
      setReportMembers(normalized);
      markLoaded('reportMembers');
    } catch (error) {
      console.error('Error fetching report members:', error);
      markFailed('reportMembers', 'the member roster for reports');
    } finally {
      setLoadingReportMembers(false);
    }
  }, [markLoaded, markFailed]);

  // Admin-configured balance notice thresholds (Notice 1/2/Final) — read-only
  // here, so Member Ledger / Member Balances classify members the same way
  // the Admin set in Mortuary Admin → Notice Thresholds. Falls back to
  // DEFAULT_NOTICE_THRESHOLDS if this fails, so the screens stay usable.
  const fetchNoticeThresholds = useCallback(async () => {
    try {
      const response = await api.get('/mortuary/treasurer/notice-thresholds');
      if (response.data?.success && response.data?.data) {
        setNoticeThresholds(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching notice thresholds:', error);
    }
  }, []);

  const fetchLedgerMembers = useCallback(async (page = currentPage, search = searchQuery, barangay = barangayFilter) => {
    const request = ++ledgerListRequestRef.current;
    try {
      const response = await api.get('/mortuary/treasurer/balances/all', {
        params: {
          page,
          limit: itemsPerPage,
          search,
          barangay,
        },
      });

      if (!response.data.success) throw new Error(response.data.message || 'Request failed');
      if (response.data.success) {
        if (request !== ledgerListRequestRef.current) return;
        markLoaded('ledgerList');
        setLedgerMembers(response.data.data.members || []);
        setLedgerPagination(response.data.data.pagination || null);
      }
    } catch (error) {
      console.error('Error fetching paginated ledger members:', error);
      if (request === ledgerListRequestRef.current) markFailed('ledgerList', 'the member ledger list');
    }
  }, [markLoaded, markFailed, currentPage, searchQuery, barangayFilter]);

  const fetchContributions = useCallback(async () => {
    try {
      const records = await loadAllPages(async page => {
        const response = await api.get('/mortuary/treasurer/contributions', { params: { page, limit: 100 } });
        return response.data;
      });
      setContributions(records);
      markLoaded('contributions');
    } catch (error) {
      console.error('Error fetching contributions:', error);
      markFailed('contributions', 'contributions');
    }
  }, [markLoaded, markFailed]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await api.get('/mortuary/treasurer/dashboard');
      if (!response.data.success || !response.data.data) throw new Error(response.data.message || 'Request failed');
      if (response.data.success) {
        markLoaded('stats');
        setStats(response.data.data || {
          fundBalance: 0,
          activeMembers: 0,
          totalMembers: 0,
          lowBalanceMembers: 0,
          totalCollected: 0,
          memberStanding: {
            excellent: 0,
            good: 0,
            fair: 0,
            atRisk: 0
          },
          statusComposition: {
            active: 0,
            inactive: 0,
            deceased: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      markFailed('stats', 'dashboard totals');
    }
  }, [markLoaded, markFailed]);

  // A member's full ledger history, fetched from the dedicated per-member
  // endpoint (not the old global /mortuary/ledger, which only ever returned
  // the 10 most recent entries system-wide — nowhere near "since the start"
  // for any individual member once other members had also transacted).
  // The endpoint caps each page at 100 rows, so long histories are paged
  // through in a loop rather than truncated to the first page.
  const fetchMemberLedgerEntries = memberId => loadAllPages(async page => {
    const response = await api.get(`/mortuary/treasurer/ledger/${encodeURIComponent(memberId)}`, {
      params: { page, limit: 100 },
    });
    return response.data;
  });

  const refreshSelectedMemberLedger = async (memberId) => {
    const id = memberId || selectedMemberId;
    if (!id) return;
    const request = ++ledgerRequestRef.current;
    setLoadingMemberLedger(true);
    try {
      const entries = await fetchMemberLedgerEntries(id);
      if (request !== ledgerRequestRef.current) return;
      setLedgerSnapshot({ memberId: String(id), entries });
      markLoaded('ledger');
    } catch {
      if (request === ledgerRequestRef.current) markFailed('ledger', 'the complete member ledger');
    } finally {
      if (request === ledgerRequestRef.current) setLoadingMemberLedger(false);
    }
  };

  // Counts for the Claims tab toggle badges. limit: 1 keeps these cheap —
  // only the pagination total is needed, not the actual rows.
  const fetchClaimsCounts = useCallback(async () => {
    try {
      const [pendingRes, releaseRes] = await Promise.all([
        api.get('/mortuary/treasurer/claims/pending-deduction', { params: { limit: 1 } }),
        api.get('/mortuary/treasurer/claims/awaiting-release', { params: { limit: 1 } }),
      ]);
      if (!pendingRes.data.success || !releaseRes.data.success) throw new Error('Unable to load claim counts');
      markLoaded('claims');
      setClaimsCounts({
        pendingDeduction: pendingRes.data?.pagination?.total ?? 0,
        awaitingRelease: releaseRes.data?.pagination?.total ?? 0,
      });
    } catch (error) {
      console.error('Error fetching claims counts:', error);
      markFailed('claims', 'claim counts');
    }
  }, [markLoaded, markFailed]);

  // Utility functions
  const showToast = (message, type) => setToast({ message, type });

  const openMemberLedger = (member) => {
    setActiveTab('ledger', { member: member.id || member.memberId });
  };

  // "Record Payment" (Contributions tab) — the general flow, searching
  // across every member.
  const openAddContribution = () => {
    setLockedContributionMember(null);
    setNewContribution((prev) => ({ ...prev, member_id: '' }));
    setIsAddContributionOpen(true);
  };

  // "Add Deposit" from a specific member's ledger page — that member is
  // already chosen by virtue of being on their ledger, so lock the Member
  // field to them instead of making the treasurer search again.
  const openAddDepositForMember = (member) => {
    setLockedContributionMember(member);
    setNewContribution((prev) => ({ ...prev, member_id: (member.id || member.memberId)?.toString() || '' }));
    setIsAddContributionOpen(true);
  };

  const closeAddContributionModal = () => {
    setIsAddContributionOpen(false);
    setLockedContributionMember(null);
  };

  // The Record Contribution modal no longer lets the Treasurer pick a
  // barangay up front — they just search for the member, and the member's
  // real (required) Member.barangay field is displayed automatically once
  // selected, read-only.
  const selectedContributionMember = members.find(
    (member) => (member.id || member.memberId)?.toString() === newContribution.member_id?.toString()
  );

  // Refresh all data
  const refreshAllData = async () => {
    await Promise.all([
      fetchMembers(),
      fetchLedgerMembers(currentPage, searchQuery, barangayFilter),
      fetchContributions(),
      fetchDashboardStats(),
      fetchClaimsCounts(),
      ...(selectedMemberId ? [refreshSelectedMemberLedger()] : [])
    ]);
  };

  // Event handlers
  const handleAddContribution = async (e) => {
    e.preventDefault();
    if (!newContribution.member_id) return showToast('Please select a member.', 'error');
    if (!newContribution.amount || parseFloat(newContribution.amount) <= 0) return showToast('Please enter a valid amount.', 'error');
    if (isSubmittingContribution) return;

    setIsSubmittingContribution(true);
    try {
      const response = await api.post('/mortuary/treasurer/contributions/record', {
        ...newContribution,
        amount: parseFloat(newContribution.amount)
      });

      if (response.data.success) {
        const contributedMemberId = newContribution.member_id;
        
        closeAddContributionModal();
        setNewContribution({ member_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], status: 'paid' });
        
        // A refresh failure must not tell the user that a successful payment failed.
        await Promise.all([
          fetchMembers(), fetchContributions(), fetchLedgerMembers(), fetchDashboardStats(),
          ...(selectedMemberId === String(contributedMemberId) ? [refreshSelectedMemberLedger(contributedMemberId)] : []),
        ]);

        showToast('Contribution recorded.', 'success');
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      showToast(error.response?.data?.message || 'Error recording contribution.', 'error');
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  // Effects
  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchMembers(),
        fetchContributions(),
        fetchDashboardStats(),
        fetchClaimsCounts(),
        fetchNoticeThresholds()
      ]);
      setInitialLoading(false);
    })();
  }, [fetchMembers, fetchContributions, fetchDashboardStats, fetchClaimsCounts, fetchNoticeThresholds]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // `members` is otherwise only fetched once on mount, so a member added by
  // the Super Admin (or elsewhere) after this portal loaded would silently
  // be missing from the Record Contribution modal until a full page
  // refresh. Re-fetch every time the modal opens so it's never stale.
  useEffect(() => {
    if (isAddContributionOpen) {
      fetchMembers();
    }
  }, [isAddContributionOpen, fetchMembers]);

  useEffect(() => {
    window.localStorage.setItem('treasurerSidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeTab !== 'ledger') return;
    const timeout = setTimeout(() => fetchLedgerMembers(), 350);
    return () => clearTimeout(timeout);
  }, [activeTab, fetchLedgerMembers]);

  useEffect(() => {
    setLedgerSnapshot({ memberId: null, entries: [] });
    setLoaded(previous => ({ ...previous, ledger: false }));
    setLoadErrors(previous => ({ ...previous, ledger: null }));
    if (selectedMemberId) refreshSelectedMemberLedger(selectedMemberId);
    return () => { ledgerRequestRef.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, barangayFilter, memberFilter, activeTab]);

  const relevantKeys = {
    dashboard: ['stats', 'contributions'], members: ['members'],
    contributions: ['contributions'], claims: ['claims'],
    ledger: selectedMemberId ? ['members', 'ledger'] : ['ledgerList'],
    reports: ['reportMembers'],
  }[activeTab] || [];
  const hasInitialFailure = relevantKeys.some(key => loadErrors[key] && !loaded[key]);
  const retryLoads = async () => {
    setRetrying(true);
    try { await refreshAllData(); } finally { setRetrying(false); }
  };

  // Render active view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            stats={stats}
            contributions={contributions}
            claimsCounts={loaded.claims ? claimsCounts : null}
            claimsError={loadErrors.claims}
          />
        );
      case 'members':
        return (
          <MemberBalances
            members={members}
            user={user}
            noticeThresholds={noticeThresholds}
            showToast={showToast}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            barangayFilter={barangayFilter}
            setBarangayFilter={setBarangayFilter}
            memberFilter={memberFilter}
            setMemberFilter={setMemberFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onOpenLedger={openMemberLedger}
          />
        );
      case 'claims':
        return (
          <div className="space-y-4">
            <ClaimsViewToggle claimsView={claimsView} setClaimsView={setClaimsView} counts={claimsCounts} />
            {claimsView === 'pending-deduction' ? (
              <ClaimsPendingDeduction user={user} showToast={showToast} onProcessed={refreshAllData} />
            ) : claimsView === 'awaiting-release' ? (
              <ClaimsAwaitingRelease user={user} showToast={showToast} onReleased={refreshAllData} />
            ) : claimsView === 'disbursement-report' ? (
              <ClaimDisbursementReport />
            ) : (
              <ClaimIncomeReport />
            )}
          </div>
        );
      case 'contributions':
        return (
          <Contributions
            contributions={contributions}
            paymentSearchQuery={paymentSearchQuery}
            setPaymentSearchQuery={setPaymentSearchQuery}
            setIsAddContributionOpen={openAddContribution}
            onPaymentsImported={refreshAllData}
          />
        );
      case 'reports':
        return (
          <Reports
            contributions={contributions}
            stats={stats}
            members={reportMembers}
            membersLoading={loadingReportMembers}
            membersError={loadErrors.reportMembers}
          />
        );
      case 'ledger':
        if (selectedMemberId && !selectedLedgerMember) return <p role="status" className="text-sm text-slate-600">{loaded.members ? 'This member could not be found. Select Members Ledger to return to the list.' : 'Loading member...'}</p>;
        return (
          <MemberLedger
            user={user}
            members={members}
            noticeThresholds={noticeThresholds}
            ledgerMembers={ledgerMembers}
            memberLedgerEntries={selectedMemberLedger}
            loadingMemberLedger={loadingMemberLedger || (!!selectedMemberId && ledgerSnapshot.memberId !== selectedMemberId && !loadErrors.ledger)}
            selectedLedgerMember={selectedLedgerMember}
            setSelectedLedgerMember={setSelectedLedgerMember}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            barangayFilter={barangayFilter}
            setBarangayFilter={setBarangayFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            pagination={ledgerPagination}
            onAddDeposit={openAddDepositForMember}
            showToast={showToast}
            refreshData={refreshAllData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-dvh bg-slate-50 flex font-sans text-slate-900 relative overflow-hidden">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Motion.aside
        initial={false}
        animate={{
          width: isDesktop
            ? sidebarCollapsed ? 76 : 268
            : isMobileMenuOpen ? 268 : 0,
        }}
        transition={{ type: 'tween', duration: 0.2 }}
        className="bg-coop-darkGreen flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden print:hidden"
      >
        {/* Header */}
        <div className={`border-b border-white/10 flex items-center shrink-0 ${sidebarCollapsed ? 'justify-center py-5' : 'gap-3 px-5 py-5'}`}>
          <img
            src="/SVPMPC-LOGO(MAIN).png"
            alt="SVPMPC Logo"
            className={`object-contain shrink-0 ${sidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}
          />
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <h1 className="text-sm font-bold text-white leading-tight truncate">St. Vincent Parish</h1>
                <p className="text-[11px] text-green-100/70 leading-tight truncate">Multi-Purpose Cooperative</p>
                <p className="text-[10px] font-bold text-coop-yellow tracking-wider mt-1">MORTUARY FUND SYSTEM</p>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className={`flex-1 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'px-2.5 py-4' : 'px-3 py-4'}`}>
          <SidebarItem id="dashboard" icon={LayoutGrid} label="Dashboard" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="members" icon={Users} label="Member Balances" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="claims" icon={ClipboardCheck} label="Claims" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="ledger" icon={FileText} label="Members Ledger" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="contributions" icon={CreditCard} label="Contributions" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="reports" icon={BarChart3} label="Reports" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
        </nav>

        {/* Footer */}
        <div className={`border-t border-white/10 shrink-0 ${sidebarCollapsed ? 'px-2.5 py-3' : 'px-3 py-3'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 px-1 pb-2">
              <div className="w-9 h-9 bg-white/10 border border-white/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{(user?.name || 'Treasurer').charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || 'Treasurer'}</p>
                <p className="text-[11px] text-green-100/60">Fund Treasurer</p>
              </div>
            </div>
          )}
          <button
            onClick={onBack}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            aria-label="Sign Out"
            className={`w-full flex items-center gap-3 text-green-100/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        {isDesktop && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="border-t border-white/10 py-3 flex items-center justify-center text-green-100/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </Motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden bg-coop-darkGreen p-4 flex items-center justify-between shrink-0 print:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-white text-base tracking-tight">Treasurer</h1>
            <p className="text-green-100/60 text-xs font-medium">Mortuary Fund</p>
          </div>
          <div className="w-10 h-10" />
        </div>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          {Object.entries(loadErrors).filter(([, message]) => message).map(([key, message]) => (
            <LoadError key={key} message={message} onRetry={retryLoads} retrying={retrying} />
          ))}
          {initialLoading ? <PortalSkeleton /> : hasInitialFailure ? null : renderActiveView()}
        </main>
      </div>

      {/* Record Contribution Modal */}
      <Modal isOpen={isAddContributionOpen} onClose={closeAddContributionModal} title="Record Contribution">
        <form onSubmit={handleAddContribution} className="space-y-5">
          {/* Member — locked to the ledger owner when opened via "Add
              Deposit" from their own ledger page (no need to search for
              someone the treasurer already picked by being on this page).
              Otherwise, the normal search-across-all-members flow. */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Member</label>
            {lockedContributionMember ? (
              <div className="w-full min-h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 flex items-center">
                <span className="font-bold text-slate-900 text-sm">
                  {lockedContributionMember.name || lockedContributionMember.memberName}
                  <span className="text-slate-400 text-xs font-normal ml-2">
                    UID: {(lockedContributionMember.id || lockedContributionMember.memberId)?.toString().padStart(6, '0')}
                  </span>
                </span>
              </div>
            ) : (
              <SearchableMemberSelect
                members={members}
                value={newContribution.member_id}
                onChange={(val) => setNewContribution({ ...newContribution, member_id: val })}
                placeholder="Search by name..."
              />
            )}
          </div>

          {/* Barangay — auto-filled from the selected member's own record,
              never typed by the Treasurer. */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Barangay</label>
            <Input
              type="text"
              value={selectedContributionMember?.barangay || ''}
              placeholder="Select a member to see their barangay"
              disabled
              readOnly
              className="h-11 text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Amount (₱)</label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="500"
                value={newContribution.amount}
                onChange={e => setNewContribution({ ...newContribution, amount: e.target.value })}
                required
                className="h-11 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Payment Date</label>
              <Input
                type="date"
                value={newContribution.payment_date}
                onChange={e => setNewContribution({ ...newContribution, payment_date: e.target.value })}
                required
                className="h-11 text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmittingContribution}
              onClick={closeAddContributionModal}
              className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingContribution}
              className="flex-1 h-11 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingContribution ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                </>
              ) : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TreasurerPortal;
