import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CreditCard, FileText, LayoutDashboard, LayoutGrid, 
  Heart, LogOut, BarChart3, CalendarDays, BadgeDollarSign, ArrowLeft
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// Import modular components
import { 
  Dashboard, 
  MemberBalances, 
  Contributions, 
  Reports, 
  MemberLedger 
} from '../../components/mortuary/treasurer';

// Import shared components
import Modal from '../../components/mortuary/treasurer/shared/Modal';
import SearchableMemberSelect from '../../components/mortuary/treasurer/shared/SearchableMemberSelect';
import { Toast } from '../../components/ui/toast';
import Button from '../../components/shared/ui/Button';
import Input from '../../components/shared/ui/Input';
import api from '../../services/api';

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${
      activeTab === id ? 'bg-coop-green text-white shadow-lg shadow-green-200' : 'text-slate-500 hover:bg-slate-50 hover:text-coop-green'
    }`}
  >
    <Icon className="w-5 h-5 mr-3" />
    <span className="text-sm font-bold tracking-tight">{label}</span>
  </button>
);

const extractBarangay = (address) => {
  if (!address) return 'Not Specified';
  const parts = address.split(',');
  return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
};

const TreasurerPortal = ({ user, onBack, token }) => {
  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({
    fundBalance: 0,
    activeMembers: 0,
    totalMembers: 0,
    lowBalanceMembers: 0,
    totalCollected: 0
  });
  const [ledger, setLedger] = useState([]);
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
  
  // Modal states
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isProcessingDeduction, setIsProcessingDeduction] = useState(false);
  const [contributionBarangayFilter, setContributionBarangayFilter] = useState('All');
  
  // Form data states
  const [newContribution, setNewContribution] = useState({ 
    member_id: '', 
    amount: '', 
    payment_date: new Date().toISOString().split('T')[0], 
    status: 'paid' 
  });
  const [deductionAmount, setDeductionAmount] = useState('25');
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

  const fetchClaims = async () => {
    try {
      const response = await api.get('/mortuary/claims');
      if (response.data.success) {
        setClaims(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
      setClaims([]); // Set empty array on error
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
          totalCollected: 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Keep default stats on error
    }
  };

  const fetchLedger = async () => {
    try {
      const response = await api.get('/mortuary/ledger');
      if (response.data.success) {
        setLedger(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching ledger:', error);
      setLedger([]); // Set empty array on error
    }
  };

  // Utility functions
  const showToast = (message, type) => setToast({ message, type });

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
      fetchLedger()
    ]);
  };

  // Event handlers
  const handleAddContribution = async (e) => {
    e.preventDefault();
    if (!newContribution.member_id) return showToast('Please select a member.', 'error');
    if (!newContribution.amount || parseFloat(newContribution.amount) <= 0) return showToast('Please enter a valid amount.', 'error');

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
          fetchLedger(),
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
            }
          }
        }
        
        showToast('Contribution recorded.', 'success');
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      showToast('Error recording contribution.', 'error');
    }
  };

  const updateClaimStatus = async (claimId, status, amount) => {
    const res = await fetch(`/api/claims/${claimId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, amount }),
    });
    if (res.ok) {
      fetchClaims();
      fetchMembers();
      fetchDashboardStats();
      fetchLedger();
      showToast('Claim verified and deductions triggered.', 'success');
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

    const res = await fetch('/api/admin/trigger-sector-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetSector: barangayFilter, count: targetedMembersCount }),
    });
    
    if (res.ok) {
        showToast(`Event triggered: Automated Notice queued for ${targetedMembersCount} members in Brgy ${barangayFilter}.`, 'success');
    }
  };

  const handleDeathDeduction = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isProcessingDeduction) {
      return;
    }
    
    const amount = parseFloat(deductionAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid deduction amount.', 'error');
      return;
    }

    if (!confirm(`This will immediately deduct ₱${amount} from ALL active members for death fund contribution. Proceed?`)) return;
    
    setIsProcessingDeduction(true);
    
    try {
      const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', {
        deceasedMemberName: "Death Fund Deduction (All Members)",
        recordedBy: user?.name || 'treasurer',
        customAmount: amount
      });

      if (response.data.success) {
        setIsAddClaimOpen(false);
        setDeductionAmount('25');
        await Promise.all([
          fetchMembers(),
          fetchLedgerMembers(currentPage, searchQuery, barangayFilter),
          fetchDashboardStats(),
          fetchLedger()
        ]);
        showToast(`₱${amount} deduction processed for all active members.`, 'success');
      }
    } catch (error) {
      console.error('Error processing deduction:', error);
      showToast('Failed to process deduction.', 'error');
    } finally {
      setIsProcessingDeduction(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchMembers();
    fetchContributions();
    fetchDashboardStats();
    fetchLedger();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger' && currentPage !== 1) {
      skipNextLedgerPageFetchRef.current = true;
    }

    setCurrentPage(1);

    if (activeTab === 'ledger') {
      fetchLedgerMembers(1, searchQuery, barangayFilter);
    }
  }, [searchQuery, barangayFilter, memberFilter, activeTab]);

  useEffect(() => {
    if (activeTab !== 'ledger') return;

    if (skipNextLedgerPageFetchRef.current) {
      skipNextLedgerPageFetchRef.current = false;
      return;
    }

    fetchLedgerMembers(currentPage, searchQuery, barangayFilter);
  }, [activeTab, currentPage]);

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
            claims={claims} 
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
            setIsAddClaimOpen={setIsAddClaimOpen}
          />
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
          />
        );
      case 'ledger':
        return (
          <MemberLedger 
            members={members}
            ledgerMembers={ledgerMembers}
            ledger={ledger}
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
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-100">
            <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight text-slate-950 uppercase">Treasurer Portal</h1>
            <p className="text-[10px] font-bold text-coop-green uppercase tracking-widest">Mortuary Fund Control</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem id="dashboard" icon={LayoutGrid} label="Dashboard" activeTab={activeTab} setActiveTab={setActiveTab} />
          <SidebarItem id="members" icon={Users} label="Member Balances" activeTab={activeTab} setActiveTab={setActiveTab} />
          <SidebarItem id="ledger" icon={FileText} label="Members Ledger" activeTab={activeTab} setActiveTab={setActiveTab} />
          <SidebarItem id="contributions" icon={CreditCard} label="Contributions" activeTab={activeTab} setActiveTab={setActiveTab} />
          <SidebarItem id="reports" icon={BarChart3} label="Fund Reports" activeTab={activeTab} setActiveTab={setActiveTab} />
        </nav>

        <div className="pt-6 border-t border-slate-100">
           <button onClick={onBack} className="w-full flex items-center px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
             <LogOut className="w-5 h-5 mr-3" />
             <span className="text-sm font-bold">Logout Portal</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {renderActiveView()}
      </main>

      {/* Modals */}
      {/* Add Contribution Modal */}
      <Modal isOpen={isAddContributionOpen} onClose={() => setIsAddContributionOpen(false)} title="Record Contribution">
        <form onSubmit={handleAddContribution} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 flex items-center gap-2">
                  <BadgeDollarSign className="w-3.5 h-3.5 text-coop-green" />
                  Contribution Details
                </p>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Filter members by barangay, then record the contribution details.
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.25em] text-coop-green border border-emerald-100">
                Required
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Filter by Barangay</label>
                <div className="relative">
                  <select
                    value={contributionBarangayFilter}
                    onChange={(e) => setContributionBarangayFilter(e.target.value)}
                    className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 pr-10 text-sm font-bold text-slate-900 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                  >
                    {contributionBarangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-[10px] font-medium text-slate-400">
                  Showing {contributionMemberOptions.length} member{contributionMemberOptions.length !== 1 ? 's' : ''} in this selection.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Member</label>
                <SearchableMemberSelect 
                  members={contributionMemberOptions}
                  value={newContribution.member_id}
                  onChange={(val) => setNewContribution({ ...newContribution, member_id: val })}
                  placeholder="Search member by name..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Amount (₱)</label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="500"
                    value={newContribution.amount}
                    onChange={e => setNewContribution({ ...newContribution, amount: e.target.value })}
                    required
                    className="rounded-xl h-12 bg-slate-50 border-slate-200 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Payment Date</label>
                  <Input
                    type="date"
                    value={newContribution.payment_date}
                    onChange={e => setNewContribution({ ...newContribution, payment_date: e.target.value })}
                    required
                    className="rounded-xl h-12 bg-slate-50 border-slate-200 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3 text-sm text-slate-500">
            <CalendarDays className="w-4 h-4 text-coop-green shrink-0" />
            <span>Make sure the contribution date matches the deposit slip before submitting.</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddContributionOpen(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 h-12 text-slate-600 font-black uppercase text-[10px] tracking-[0.28em] shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-coop-green/20 bg-coop-green px-6 h-12 text-white font-black uppercase text-[10px] tracking-[0.28em] shadow-xl shadow-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-coop-darkGreen hover:shadow-2xl hover:shadow-emerald-200 focus:ring-2 focus:ring-coop-green/20"
            >
              <CreditCard className="w-4 h-4" />
              Submit Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Trigger Death Deduction Modal */}
      <Modal isOpen={isAddClaimOpen} onClose={() => setIsAddClaimOpen(false)} title="Trigger Death Deduction">
        <form onSubmit={handleDeathDeduction} className="space-y-6">
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-6">
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
              <Heart className="w-3 h-3" /> Death Fund Contribution
            </p>
            <p className="text-xs text-rose-600 mt-1 font-medium leading-relaxed">
              This will immediately deduct the specified amount from ALL active members for the death fund.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Deduction Amount (₱ per member)</label>
              <Input 
                type="number" 
                placeholder="25" 
                value={deductionAmount}
                onChange={e => setDeductionAmount(e.target.value)}
                required
                className="h-14 text-lg font-bold"
                min="1"
                step="0.01"
              />
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 italic">Standard contribution is ₱25 per member</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Members</p>
                <p className="text-lg font-black text-slate-900">{members.length}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Deduction</p>
                <p className="text-2xl font-black text-rose-600">₱{(parseFloat(deductionAmount || 0) * members.length).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isProcessingDeduction}
            className="w-full h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessingDeduction ? 'Processing Deduction...' : `Apply ₱${deductionAmount} Deduction to All Members`}
          </Button>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TreasurerPortal;