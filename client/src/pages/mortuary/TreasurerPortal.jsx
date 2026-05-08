import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, CreditCard, FileText, LayoutDashboard, LayoutGrid, 
  Heart, LogOut, BarChart3
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
  
  // Modal states
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  
  // Form data states
  const [newContribution, setNewContribution] = useState({ 
    member_id: '', 
    amount: '', 
    payment_date: new Date().toISOString().split('T')[0], 
    status: 'paid' 
  });
  const [deductionAmount, setDeductionAmount] = useState('25');
  const [smsData, setSmsData] = useState({ memberId: null, message: '', memberName: '' });
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

  // Refresh all data
  const refreshAllData = async () => {
    await Promise.all([
      fetchMembers(),
      fetchContributions(),
      fetchDashboardStats(),
      fetchLedger()
    ]);
  };

  // Event handlers
  const handleQuickDeposit = (memberId) => {
    setNewContribution({ 
      member_id: memberId, 
      amount: '', 
      payment_date: new Date().toISOString().split('T')[0], 
      status: 'paid' 
    });
    setIsAddContributionOpen(true);
  };

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

  const handleSendSms = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/mortuary/treasurer/notifications/send-reminder', {
        memberId: smsData.memberId,
        message: smsData.message
      });

      if (response.data.success) {
        setIsSmsModalOpen(false);
        setSmsData({ memberId: null, message: '', memberName: '' });
        showToast('SMS notification sent.', 'success');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      showToast('Error sending SMS.', 'error');
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
    
    const amount = parseFloat(deductionAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid deduction amount.', 'error');
      return;
    }

    if (!confirm(`This will immediately deduct ₱${amount} from ALL active members for death fund contribution. Proceed?`)) return;
    
    try {
      const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', {
        deceasedMemberName: "Death Fund Deduction (All Members)",
        recordedBy: user?.name || 'treasurer',
        customAmount: amount
      });

      if (response.data.success) {
        setIsAddClaimOpen(false);
        setDeductionAmount('25');
        fetchMembers();
        fetchDashboardStats();
        fetchLedger();
        showToast(`₱${amount} deduction processed for all active members.`, 'success');
      }
    } catch (error) {
      console.error('Error processing deduction:', error);
      showToast('Failed to process deduction.', 'error');
    }
  };

  // Effects
  useEffect(() => {
    fetchMembers();
    fetchContributions();
    fetchDashboardStats();
    fetchLedger();
  }, []);

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
            handleQuickDeposit={handleQuickDeposit}
            setSmsData={setSmsData}
            setIsSmsModalOpen={setIsSmsModalOpen}
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
            handleQuickDeposit={handleQuickDeposit}
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
      {/* SMS Modal */}
      <Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)} title={`Notify: ${smsData.memberName}`}>
        <form onSubmit={handleSendSms} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Message Content</label>
            <textarea 
              className="w-full min-h-[150px] p-4 rounded-2xl bg-slate-50 border-slate-100 font-medium text-sm focus:bg-white focus:ring-coop-green/20"
              placeholder="Enter message for member..."
              value={smsData.message}
              onChange={e => setSmsData({...smsData, message: e.target.value})}
              required
            />
          </div>
          <Button type="submit" className="w-full h-14 bg-coop-green text-white rounded-2xl font-black uppercase tracking-widest">
            Send SMS Notification
          </Button>
        </form>
      </Modal>

      {/* Add Contribution Modal */}
      <Modal isOpen={isAddContributionOpen} onClose={() => setIsAddContributionOpen(false)} title="Record Contribution">
        <form onSubmit={handleAddContribution} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Member</label>
              <SearchableMemberSelect 
                members={members}
                value={newContribution.member_id}
                onChange={(val) => setNewContribution({ ...newContribution, member_id: val })}
                placeholder="Search member by name..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Amount (₱)</label>
              <Input type="number" value={newContribution.amount} onChange={e => setNewContribution({...newContribution, amount: e.target.value})} required className="rounded-xl h-12" />
            </div>
          </div>
          <Button type="submit" className="w-full h-14 bg-coop-green text-white rounded-2xl font-black tracking-widest uppercase">
            Submit Payment
          </Button>
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

          <Button type="submit" className="w-full h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-rose-100">
            Apply ₱{deductionAmount} Deduction to All Members
          </Button>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TreasurerPortal;