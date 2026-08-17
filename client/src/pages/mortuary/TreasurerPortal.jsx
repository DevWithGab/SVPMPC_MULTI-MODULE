import React, { useState, useEffect, useRef } from 'react';
import {
  Users, CreditCard, FileText, LayoutGrid,
  LogOut, BarChart3, ChevronLeft, ChevronRight, Loader2, ClipboardCheck
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// Import modular components
import {
  Dashboard,
  MemberBalances,
  Contributions,
  Reports,
  MemberLedger,
  ClaimsPendingDeduction,
  ClaimsAwaitingRelease
} from '../../components/mortuary/treasurer';

// Import shared components
import Modal from '../../components/mortuary/shared/Modal';
import SearchableMemberSelect from '../../components/mortuary/shared/SearchableMemberSelect';
import { Toast } from '../../components/ui/toast';
import Button from '../../components/shared/ui/Button';
import Input from '../../components/shared/ui/Input';
import api from '../../services/api';

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, collapsed }) => (
  <button
    onClick={() => setActiveTab(id)}
    title={collapsed ? label : undefined}
    aria-label={label}
    aria-current={activeTab === id ? 'page' : undefined}
    className={`w-full flex items-center gap-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset ${
      collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
    } ${
      activeTab === id
        ? 'bg-coop-green text-white'
        : 'text-slate-500 hover:bg-slate-50 hover:text-coop-green'
    }`}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!collapsed && <span className="text-sm font-bold tracking-tight">{label}</span>}
  </button>
);

const ClaimsViewToggle = ({ claimsView, setClaimsView, counts }) => (
  <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
    {[
      { id: 'pending-deduction', label: 'Pending Deduction', count: counts?.pendingDeduction ?? 0 },
      { id: 'awaiting-release', label: 'Awaiting Release', count: counts?.awaitingRelease ?? 0 },
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
  const [claimsView, setClaimsView] = useState('pending-deduction'); // 'pending-deduction' | 'awaiting-release'
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
  const [contributionBarangayFilter, setContributionBarangayFilter] = useState('All');
  
  // Form data states
  const [newContribution, setNewContribution] = useState({ 
    member_id: '', 
    amount: '', 
    payment_date: new Date().toISOString().split('T')[0], 
    status: 'paid' 
  });
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

  const contributionMemberOptions = members.filter(member => (
    contributionBarangayFilter === 'All' || extractBarangay(member.address) === contributionBarangayFilter
  ));

  const contributionBarangays = ['All', ...Array.from(new Set(members.map(member => extractBarangay(member.address))))].sort();

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
        
        setIsAddContributionOpen(false);
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

  useEffect(() => {
    window.localStorage.setItem('treasurerSidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
        return claimsView === 'pending-deduction' ? (
          <div className="space-y-4">
            <ClaimsViewToggle claimsView={claimsView} setClaimsView={setClaimsView} counts={claimsCounts} />
            <ClaimsPendingDeduction user={user} showToast={showToast} onProcessed={refreshAllData} />
          </div>
        ) : (
          <div className="space-y-4">
            <ClaimsViewToggle claimsView={claimsView} setClaimsView={setClaimsView} counts={claimsCounts} />
            <ClaimsAwaitingRelease user={user} showToast={showToast} onReleased={refreshAllData} />
          </div>
        );
      case 'contributions':
        return (
          <Contributions 
            contributions={contributions}
            paymentSearchQuery={paymentSearchQuery}
            setPaymentSearchQuery={setPaymentSearchQuery}
            setIsAddContributionOpen={setIsAddContributionOpen}
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
            setIsAddContributionOpen={setIsAddContributionOpen}
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
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-[68px]' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}>
        {/* Header */}
        <div className={`border-b border-slate-100 flex items-center ${sidebarCollapsed ? 'justify-center py-4' : 'justify-between px-4 py-4'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5">
              <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-7 h-7 object-contain" />
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">Treasurer</h1>
                <p className="text-[11px] text-slate-400 mt-0.5">Mortuary Fund</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-6 h-6 object-contain" />
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 space-y-1 ${sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
          <SidebarItem id="dashboard" icon={LayoutGrid} label="Dashboard" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
          <SidebarItem id="members" icon={Users} label="Member Balances" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
          <SidebarItem id="claims" icon={ClipboardCheck} label="Claims" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
          <SidebarItem id="ledger" icon={FileText} label="Members Ledger" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
          <SidebarItem id="contributions" icon={CreditCard} label="Contributions" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
          <SidebarItem id="reports" icon={BarChart3} label="Fund Reports" activeTab={activeTab} setActiveTab={setActiveTab} collapsed={sidebarCollapsed} />
        </nav>

        {/* Footer */}
        <div className={`border-t border-slate-100 ${sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          <button
            onClick={onBack}
            title={sidebarCollapsed ? 'Logout' : undefined}
            aria-label="Logout"
            className={`w-full flex items-center gap-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-inset ${
              sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
            }`}
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="border-t border-slate-100 py-3 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {initialLoading ? <PortalSkeleton /> : renderActiveView()}
      </main>

      {/* Record Contribution Modal */}
      <Modal isOpen={isAddContributionOpen} onClose={() => setIsAddContributionOpen(false)} title="Record Contribution">
        <form onSubmit={handleAddContribution} className="space-y-5">
          {/* Barangay Filter */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Barangay</label>
            <select
              value={contributionBarangayFilter}
              onChange={(e) => setContributionBarangayFilter(e.target.value)}
              className="w-full h-11 border border-slate-200 px-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
            >
              {contributionBarangays.map((barangay) => (
                <option key={barangay} value={barangay}>{barangay}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">{contributionMemberOptions.length} member{contributionMemberOptions.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Member */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Member</label>
            <SearchableMemberSelect
              members={contributionMemberOptions}
              value={newContribution.member_id}
              onChange={(val) => setNewContribution({ ...newContribution, member_id: val })}
              placeholder="Search by name..."
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
              onClick={() => setIsAddContributionOpen(false)}
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