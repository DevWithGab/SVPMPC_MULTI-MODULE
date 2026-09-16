import React, { useState, useEffect, useRef } from 'react';
import {
  Users, CreditCard, FileText, LayoutGrid,
  LogOut, BarChart3, ChevronLeft, ChevronRight, Loader2, ClipboardCheck, Menu
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

// Import modular components
import {
  Dashboard,
  MemberBalances,
  Contributions,
  Reports,
  MemberLedger,
  ClaimsPendingDeduction,
  ClaimsAwaitingRelease,
  ClaimDisbursementReport
} from '../../components/mortuary/treasurer';

// Import shared components
import Modal from '../../components/mortuary/shared/Modal';
import SearchableMemberSelect from '../../components/mortuary/shared/SearchableMemberSelect';
import { Toast } from '../../components/ui/toast';
import Button from '../../components/shared/ui/Button';
import Input from '../../components/shared/ui/Input';
import api from '../../services/api';

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

const extractBarangay = (address) => {
  if (!address) return 'Not Specified';
  const parts = address.split(',');
  return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
};

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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [claimsView, setClaimsView] = useState('pending-deduction'); // 'pending-deduction' | 'awaiting-release' | 'disbursement-report'
  const [members, setMembers] = useState([]);
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
  const [selectedMemberLedger, setSelectedMemberLedger] = useState([]);
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
  const skipNextLedgerPageFetchRef = useRef(false);
  const ledgerFetchTimeoutRef = useRef(null);
  
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
  const [selectedLedgerMember, setSelectedLedgerMember] = useState(null);
  const prevMembersRef = useRef([]);

  // Data fetching functions
  const fetchMembers = async () => {
    try {
      const response = await api.get('/mortuary/treasurer/balances/all');
      if (response.data.success) {
        setMembers(response.data.data.members || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]); // Set empty array on error
    }
  };

  const fetchLedgerMembers = async (page = currentPage, search = searchQuery, barangay = barangayFilter) => {
    try {
      const response = await api.get('/mortuary/treasurer/balances/all', {
        params: {
          page,
          limit: itemsPerPage,
          search,
          barangay,
        },
      });

      if (response.data.success) {
        setLedgerMembers(response.data.data.members || []);
        setLedgerPagination(response.data.data.pagination || null);
      }
    } catch (error) {
      console.error('Error fetching paginated ledger members:', error);
      setLedgerMembers([]);
      setLedgerPagination(null);
    }
  };

  const fetchContributions = async () => {
    try {
      const response = await api.get('/mortuary/treasurer/contributions');
      if (response.data.success) {
        setContributions(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching contributions:', error);
      setContributions([]); // Set empty array on error
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/mortuary/treasurer/dashboard');
      if (response.data.success) {
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
      // Keep default stats on error
    }
  };

  // A member's full ledger history, fetched from the dedicated per-member
  // endpoint (not the old global /mortuary/ledger, which only ever returned
  // the 10 most recent entries system-wide — nowhere near "since the start"
  // for any individual member once other members had also transacted).
  // The endpoint caps each page at 100 rows, so long histories are paged
  // through in a loop rather than truncated to the first page.
  const fetchMemberLedgerEntries = async (memberId) => {
    if (!memberId) return [];
    const perPage = 100;
    let page = 1;
    let totalPages = 1;
    let allEntries = [];
    try {
      do {
        const response = await api.get(`/mortuary/treasurer/ledger/${memberId}`, {
          params: { page, limit: perPage },
        });
        if (!response.data.success) break;
        allEntries = allEntries.concat(response.data.data || []);
        totalPages = response.data.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);
    } catch (error) {
      console.error('Error fetching member ledger:', error);
    }
    return allEntries;
  };

  const refreshSelectedMemberLedger = async (memberId) => {
    const id = memberId || selectedLedgerMember?.id || selectedLedgerMember?.memberId;
    if (!id) return;
    setLoadingMemberLedger(true);
    const entries = await fetchMemberLedgerEntries(id);
    setSelectedMemberLedger(entries);
    setLoadingMemberLedger(false);
  };

  // Counts for the Claims tab toggle badges. limit: 1 keeps these cheap —
  // only the pagination total is needed, not the actual rows.
  const fetchClaimsCounts = async () => {
    try {
      const [pendingRes, releaseRes] = await Promise.all([
        api.get('/mortuary/treasurer/claims/pending-deduction', { params: { limit: 1 } }),
        api.get('/mortuary/treasurer/claims/awaiting-release', { params: { limit: 1 } }),
      ]);
      setClaimsCounts({
        pendingDeduction: pendingRes.data?.pagination?.total ?? 0,
        awaitingRelease: releaseRes.data?.pagination?.total ?? 0,
      });
    } catch (error) {
      console.error('Error fetching claims counts:', error);
    }
  };

  // Utility functions
  const showToast = (message, type) => setToast({ message, type });

  const openMemberLedger = (member) => {
    setSelectedLedgerMember(member);
    setActiveTab('ledger');
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
      ...(selectedLedgerMember ? [refreshSelectedMemberLedger()] : [])
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
        
        // Refresh all data after contribution is recorded
        await Promise.all([
          fetchContributions(),
          fetchLedgerMembers(currentPage, searchQuery, barangayFilter),
          fetchDashboardStats()
        ]);

        // Fetch members last so we can update the selected member
        const membersResponse = await api.get('/mortuary/treasurer/balances/all');
        if (membersResponse.data.success) {
          const updatedMembers = membersResponse.data.data.members || [];
          setMembers(updatedMembers);

          // If we're viewing the member we just added a contribution for, update the selection
          if (selectedLedgerMember) {
            if (selectedLedgerMember.id === contributedMemberId || selectedLedgerMember.memberId === contributedMemberId) {
              const updatedMember = updatedMembers.find(m => m.id === contributedMemberId || m.memberId === contributedMemberId);
              if (updatedMember) {
                setSelectedLedgerMember(updatedMember);
              }
              await refreshSelectedMemberLedger(contributedMemberId);
            }
          }
        }
        
        showToast('Contribution recorded.', 'success');
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      showToast(error.response?.data?.message || 'Error recording contribution.', 'error');
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  const handleTriggerAutomatedNotice = async () => {
    if (barangayFilter === 'All') {
       return showToast('Please select a specific sector to trigger an automated notice.', 'error');
    }

    const extractBarangay = (address) => {
      if (!address) return 'Not Specified';
      const parts = address.split(',');
      return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
    };

    const targetedMembersCount = members.filter(m => {
        if (!m.address) return false;
        const parts = m.address.split(',');
        const brgy = parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
        return brgy === barangayFilter;
    }).length;

    try {
      const res = await fetch('/api/admin/trigger-sector-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSector: barangayFilter, count: targetedMembersCount }),
      });

      if (res.ok) {
        showToast(`Event triggered: Automated Notice queued for ${targetedMembersCount} members in Brgy ${barangayFilter}.`, 'success');
      } else {
        showToast('Failed to queue automated notice.', 'error');
      }
    } catch (error) {
      console.error('Error triggering automated notice:', error);
      showToast('Failed to queue automated notice.', 'error');
    }
  };

  // Effects
  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchMembers(),
        fetchContributions(),
        fetchDashboardStats(),
        fetchClaimsCounts()
      ]);
      setInitialLoading(false);
    })();
  }, []);

  // `members` is otherwise only fetched once on mount, so a member added by
  // the Super Admin (or elsewhere) after this portal loaded would silently
  // be missing from the Record Contribution modal until a full page
  // refresh. Re-fetch every time the modal opens so it's never stale.
  useEffect(() => {
    if (isAddContributionOpen) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddContributionOpen]);

  useEffect(() => {
    window.localStorage.setItem('treasurerSidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger' && currentPage !== 1) {
      skipNextLedgerPageFetchRef.current = true;
    }

    setCurrentPage(1);

    if (activeTab !== 'ledger') return;

    // Debounce so typing in the search box doesn't fire a request per keystroke
    if (ledgerFetchTimeoutRef.current) clearTimeout(ledgerFetchTimeoutRef.current);
    ledgerFetchTimeoutRef.current = setTimeout(() => {
      fetchLedgerMembers(1, searchQuery, barangayFilter);
    }, 350);

    return () => {
      if (ledgerFetchTimeoutRef.current) clearTimeout(ledgerFetchTimeoutRef.current);
    };
  }, [searchQuery, barangayFilter, memberFilter, activeTab]);

  useEffect(() => {
    if (activeTab !== 'ledger') return;

    if (skipNextLedgerPageFetchRef.current) {
      skipNextLedgerPageFetchRef.current = false;
      return;
    }

    fetchLedgerMembers(currentPage, searchQuery, barangayFilter);
  }, [activeTab, currentPage]);

  // Load the selected member's full ledger history whenever the selection
  // changes — covers both entry points (MemberBalances' "Open Ledger" and
  // clicking a row directly inside the Members Ledger tab).
  useEffect(() => {
    const id = selectedLedgerMember?.id || selectedLedgerMember?.memberId;
    if (!id) {
      setSelectedMemberLedger([]);
      return;
    }
    refreshSelectedMemberLedger(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLedgerMember?.id, selectedLedgerMember?.memberId]);

  // Update selected ledger member when members array changes
  useEffect(() => {
    if (selectedLedgerMember && members.length > 0) {
      const updatedMember = members.find(m => 
        (m.id === selectedLedgerMember.id) || 
        (m.memberId === selectedLedgerMember.id) ||
        (m.id === selectedLedgerMember.memberId) ||
        (m.memberId === selectedLedgerMember.memberId)
      );
      
      if (updatedMember && updatedMember.balance !== selectedLedgerMember.balance) {
        setSelectedLedgerMember(updatedMember);
      }
    }
    prevMembersRef.current = members;
  }, [members, selectedLedgerMember]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, barangayFilter, memberFilter, activeTab]);

  // Render active view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            contributions={contributions}
          />
        );
      case 'members':
        return (
          <MemberBalances 
            members={members}
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
            ) : (
              <ClaimDisbursementReport />
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
          />
        );
      case 'reports':
        return (
          <Reports 
            members={members}
            contributions={contributions}
            stats={stats}
          />
        );
      case 'ledger':
        return (
          <MemberLedger
            members={members}
            ledgerMembers={ledgerMembers}
            memberLedgerEntries={selectedMemberLedger}
            loadingMemberLedger={loadingMemberLedger}
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
            handleTriggerAutomatedNotice={handleTriggerAutomatedNotice}
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
        className="bg-coop-darkGreen flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden"
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
          <SidebarItem id="reports" icon={BarChart3} label="Fund Reports" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} onNavigate={() => !isDesktop && setIsMobileMenuOpen(false)} />
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
        <div className="lg:hidden bg-coop-darkGreen p-4 flex items-center justify-between shrink-0">
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
          {initialLoading ? <PortalSkeleton /> : renderActiveView()}
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