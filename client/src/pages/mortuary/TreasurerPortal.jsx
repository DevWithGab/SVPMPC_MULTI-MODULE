import '../../components/mortuary/treasurer/Claims.css';
import { loadAllPages } from '../../utils/loadAllPages';
import LoadError from '../../components/shared/common/LoadError';
import useUrlState from '../../hooks/useUrlState';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  Users, CreditCard, FileText, LayoutGrid, BarChart3, Bell,
  LogOut, ChevronLeft, ChevronRight, Loader2, ClipboardCheck, Menu
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

// Import modular components
import {
  Dashboard,
  MemberBalances,
  Notices,
  Contributions,
  MemberLedger,
  ClaimsPendingDeduction,
  ClaimsAwaitingRelease,
  ClaimDisbursementReport,
  ClaimIncomeReport,
  Reports
} from '../../components/mortuary/treasurer';

// Import shared components
import RecordContributionModal from '../../components/mortuary/treasurer/RecordContributionModal';
import { Toast } from '../../components/ui/toast';
import api from '../../services/api';
import { DEFAULT_NOTICE_THRESHOLDS } from '../../utils/balanceNotice';

const contributionAlert = Swal.mixin({
  confirmButtonColor: '#245e32',
  cancelButtonColor: '#647069',
  customClass: { container: 'contribution-alert-container' },
  // Handle keyboard events before the underlying payment modal's focus trap.
  keydownListenerCapture: true,
  returnFocus: false,
});

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, collapsed, onNavigate, badgeCount = 0 }) => (
  <button
    onClick={() => {
      setActiveTab(id);
      onNavigate?.();
    }}
    title={collapsed ? (badgeCount > 0 ? `${label}: ${badgeCount} pending deduction` : label) : undefined}
    aria-label={badgeCount > 0 ? `${label}, ${badgeCount} ${badgeCount === 1 ? 'claim' : 'claims'} pending deduction` : label}
    aria-current={activeTab === id ? 'page' : undefined}
    className={`relative w-full flex items-center gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset ${
      collapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'
    } ${
      activeTab === id
        ? 'bg-white text-coop-darkGreen shadow-sm'
        : 'text-green-100/80 hover:bg-white/10 hover:text-white'
    }`}
  >
    <Icon className="w-4.5 h-4.5 shrink-0" />
    {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
    {badgeCount > 0 && (
      <span
        aria-hidden="true"
        className={`inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white ${collapsed ? 'absolute -top-1 -right-1' : '-ml-1'}`}
      >
        {badgeCount.toLocaleString('en-PH')}
      </span>
    )}
  </button>
);

const ClaimsViewToggle = ({ claimsView, setClaimsView, counts }) => (
  <div className="mc-tabs" role="group" aria-label="Claims views">
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
        className="mc-tab"
      >
        {opt.label}
        {opt.count > 0 && (
          <span className="mc-count">
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
  const [activeTab, setActiveTab] = useUrlState('tab', 'dashboard', ['dashboard', 'members', 'notices', 'claims', 'ledger', 'contributions', 'reports']);
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
      atRisk: 0, negativeBalance: 0
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
  const itemsPerPage = 100;
  const [ledgerMembers, setLedgerMembers] = useState([]);
  const [ledgerPagination, setLedgerPagination] = useState(null);
  
  // Modal states
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const contributionInFlight = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('treasurerSidebarCollapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // The mobile nav drawer otherwise has no keyboard-reachable way to close
  // without navigating — only the backdrop's onClick, which a keyboard-only
  // user can't trigger.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // Form data states
  const [newContribution, setNewContribution] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    status: 'paid',
    referenceNumber: ''
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
            atRisk: 0, negativeBalance: 0
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

  // Counts for the Claims sidebar and view badges. limit: 1 keeps these cheap —
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
    if (contributionInFlight.current) return;
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
    if (contributionInFlight.current) return;
    const amount = Number(newContribution.amount);
    const validationError = !newContribution.member_id ? 'Please select a member.'
      : !Number.isFinite(amount) || amount < 1 ? 'Please enter an amount of at least ₱1.'
      : !newContribution.payment_date ? 'Please enter a payment date.'
      : !newContribution.referenceNumber?.trim() ? 'Please enter a reference number.' : null;

    contributionInFlight.current = true;
    setIsSubmittingContribution(true);
    try {
      if (validationError) {
        await contributionAlert.fire({ icon: 'warning', title: 'Check payment details', text: validationError });
        return;
      }
      const member = lockedContributionMember || selectedContributionMember;
      const formattedAmount = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
      const confirmation = await contributionAlert.fire({
        icon: 'question',
        title: 'Record this contribution?',
        text: `Member: ${member?.name || member?.memberName || newContribution.member_id}\nAmount: ${formattedAmount}\nPayment date: ${newContribution.payment_date}\nReference: ${newContribution.referenceNumber.trim()}`,
        showCancelButton: true,
        confirmButtonText: 'Yes, record payment',
        cancelButtonText: 'Review details',
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;

      const response = await api.post('/mortuary/treasurer/contributions/record', {
        ...newContribution,
        amount,
        referenceNumber: newContribution.referenceNumber.trim(),
      });

      if (!response.data.success) throw new Error(response.data.message || 'Error recording contribution.');
      if (response.data.success) {
        const contributedMemberId = newContribution.member_id;
        
        setIsAddContributionOpen(false);
        setLockedContributionMember(null);
        setNewContribution({ member_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], status: 'paid', referenceNumber: '' });
        
        // A refresh failure must not tell the user that a successful payment failed.
        await Promise.all([
          fetchMembers(), fetchContributions(), fetchLedgerMembers(), fetchDashboardStats(),
          ...(selectedMemberId === String(contributedMemberId) ? [refreshSelectedMemberLedger(contributedMemberId)] : []),
        ]);

        await contributionAlert.fire({
          icon: 'success',
          title: 'Contribution recorded',
          text: `${formattedAmount} has been recorded for ${member?.name || member?.memberName || newContribution.member_id}.`,
          confirmButtonText: 'Done',
        });
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      await contributionAlert.fire({
        icon: 'error',
        title: 'Could not record contribution',
        text: error.response?.data?.message || error.message || 'Error recording contribution. Please try again.',
      });
    } finally {
      contributionInFlight.current = false;
      setIsSubmittingContribution(false);
      requestAnimationFrame(() => {
        document.querySelector('#contribution-amount')?.focus();
      });
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
    const refreshClaims = () => {
      if (!document.hidden) fetchClaimsCounts();
    };
    const interval = window.setInterval(refreshClaims, 30000);
    window.addEventListener('focus', refreshClaims);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshClaims);
    };
  }, [fetchClaimsCounts]);

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
    dashboard: ['stats', 'contributions'], members: ['members'], notices: ['members'],
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
            setActiveTab={setActiveTab}
            onRefresh={retryLoads}
            refreshing={retrying}
          />
        );
      case 'members':
        return (
          <MemberBalances
            onRefresh={retryLoads}
            refreshing={retrying}
            members={members}
            noticeThresholds={noticeThresholds}
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
      case 'notices':
        return (
          <Notices
            members={members}
            user={user}
            noticeThresholds={noticeThresholds}
            showToast={showToast}
            onRefresh={retryLoads}
            refreshing={retrying}
          />
        );
      case 'claims':
        return (
          <div className="mortuary-claims">
            <header className="mc-header"><p className="mc-eyebrow">Mortuary management / Claims</p><h1>Claims</h1><p className="mc-description">Review member assessments, release benefits, and track claim records.</p></header>
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
          <SidebarItem id="notices" icon={Bell} label="Notices" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
          <SidebarItem id="claims" icon={ClipboardCheck} label="Claims" badgeCount={claimsCounts.pendingDeduction} activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
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

      <RecordContributionModal
        isOpen={isAddContributionOpen}
        onClose={closeAddContributionModal}
        onSubmit={handleAddContribution}
        members={members}
        lockedMember={lockedContributionMember}
        selectedMember={selectedContributionMember}
        contribution={newContribution}
        setContribution={setNewContribution}
        submitting={isSubmittingContribution}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TreasurerPortal;
