import React, { useState, useEffect } from 'react';
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
  DeathVerifications, 
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
  const [isBulkDeductOpen, setIsBulkDeductOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  
  // Form data states
  const [newContribution, setNewContribution] = useState({ 
    member_id: '', 
    amount: '', 
    payment_date: new Date().toISOString().split('T')[0], 
    status: 'paid' 
  });
  const [newClaim, setNewClaim] = useState({
    member_id: '',
    date_of_death: new Date().toISOString().split('T')[0],
    cause: '',
    claimant_name: '',
    claimant_relationship: '',
    deduction_amount: '25'
  });
  const [bulkDeductData, setBulkDeductData] = useState({ amount: '', reason: '' });
  const [smsData, setSmsData] = useState({ memberId: null, message: '', memberName: '' });
  const [selectedLedgerMember, setSelectedLedgerMember] = useState(null);

  // Data fetching functions
  const fetchMembers = async () => {
    try {
      console.log('Fetching members...');
      const response = await api.get('/mortuary/treasurer/balances/all');
      console.log('Members response:', response.data);
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
      fetchClaims(),
      fetchDashboardStats(),
      fetchLedger()
    ]);
  };

  // Event handlers
  const handleQuickDeposit = (memberId) => {
    console.log('🔍 handleQuickDeposit called with:', memberId);
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
        amount: parseFloat(newContribution.amount),
        member_id: parseInt(newContribution.member_id)
      });

      if (response.data.success) {
        setIsAddContributionOpen(false);
        setNewContribution({ member_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], status: 'paid' });
        fetchContributions();
        fetchDashboardStats();
        fetchMembers();
        fetchLedger();
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

  const handleAddClaim = async (e) => {
    e.preventDefault();
    if (!newClaim.member_id) return showToast('Please select a deceased member.', 'error');
    if (!newClaim.deduction_amount || parseFloat(newClaim.deduction_amount) <= 0) return showToast('Please enter a valid deduction amount.', 'error');
    
    // Check for bulk deduction shortcut
    if (newClaim.member_id === 'all') {
      const amount = parseFloat(newClaim.deduction_amount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid deduction amount.', 'error');
        return;
      }

      if (!confirm(`This will immediately deduct ₱${amount} from ALL active members for a general death fund contribution. Proceed?`)) return;
      
      try {
        const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', {
          deceasedMemberName: "General Death Fund Deduction (All Members)",
          recordedBy: user?.name || 'treasurer',
          customAmount: amount
        });

        if (response.data.success) {
          setIsAddClaimOpen(false);
          setNewClaim({
            member_id: '',
            date_of_death: new Date().toISOString().split('T')[0],
            cause: '',
            claimant_name: '',
            claimant_relationship: '',
            deduction_amount: '25'
          });
          fetchMembers();
          fetchDashboardStats();
          fetchLedger();
          showToast('Bulk ₱25 deduction processed for all active members.', 'success');
        }
      } catch (error) {
        console.error('Error processing bulk deduction:', error);
        showToast('Failed to process bulk deduction.', 'error');
      }
      return;
    }

    try {
      const response = await api.post('/mortuary/claims', {
        ...newClaim,
        member_id: parseInt(newClaim.member_id)
      });

      if (response.data.success) {
        setIsAddClaimOpen(false);
        setNewClaim({
          member_id: '',
          date_of_death: new Date().toISOString().split('T')[0],
          cause: '',
          claimant_name: '',
          claimant_relationship: '',
          deduction_amount: '25'
        });
        fetchClaims();
        showToast('Death case recorded. Please verify in the Verifications tab to trigger deductions.', 'success');
        setActiveTab('verifications');
      }
    } catch (error) {
      console.error('Error adding claim:', error);
      showToast('Error recording death case.', 'error');
    }
  };

  const handleBulkDeduct = async (e) => {
    e.preventDefault();
    if (!confirm(`Are you sure you want to deduct ₱${bulkDeductData.amount} from ALL active members for "${bulkDeductData.reason}"?`)) return;

    try {
      const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', {
        deceasedMemberName: bulkDeductData.reason,
        recordedBy: user?.name || 'treasurer',
        customAmount: parseFloat(bulkDeductData.amount)
      });

      if (response.data.success) {
        setIsBulkDeductOpen(false);
        setBulkDeductData({ amount: '', reason: '' });
        fetchMembers();
        fetchDashboardStats();
        fetchLedger();
        showToast(`Bulk deduction of ₱${bulkDeductData.amount} processed.`, 'success');
      }
    } catch (error) {
      console.error('Error processing bulk deduction:', error);
      showToast('Failed to process bulk deduction.', 'error');
    }
  };

  // Effects
  useEffect(() => {
    fetchMembers();
    fetchContributions();
    fetchClaims();
    fetchDashboardStats();
    fetchLedger();
  }, []);

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
            setIsBulkDeductOpen={setIsBulkDeductOpen}
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
      case 'verifications':
        return (
          <DeathVerifications 
            claims={claims}
            updateClaimStatus={updateClaimStatus}
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
          <SidebarItem id="verifications" icon={Heart} label="Death Verifications" activeTab={activeTab} setActiveTab={setActiveTab} />
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

      {/* Trigger Death Deduction (Add Claim) Modal */}
      <Modal isOpen={isAddClaimOpen} onClose={() => setIsAddClaimOpen(false)} title="Trigger Death Deduction">
        <form onSubmit={handleAddClaim} className="space-y-6">
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-6">
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
              <Heart className="w-3 h-3" /> Important Notice
            </p>
            <p className="text-xs text-rose-600 mt-1 font-medium leading-relaxed">
              Recording a death case allows you to trigger the automatic ₱25 deduction from all members.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Deceased Member</label>
              <SearchableMemberSelect 
                members={members}
                value={newClaim.member_id}
                onChange={(val) => setNewClaim({ ...newClaim, member_id: val })}
                placeholder="Search deceased member..."
                extraOptions={[{ value: 'all', label: 'ALL ACTIVE MEMBERS (Rapid Death Relief)', className: 'text-rose-600 bg-rose-50/50' }]}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Deduction Amount (₱ per member)</label>
              <Input 
                type="number" 
                placeholder="25" 
                value={newClaim.deduction_amount}
                onChange={e => setNewClaim({ ...newClaim, deduction_amount: e.target.value })}
                required
              />
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 italic">Standard contribution is ₱25 unless adjusted by treasurer</p>
            </div>

            {newClaim.member_id !== 'all' && newClaim.member_id !== '' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Date of Death</label>
                    <Input type="date" value={newClaim.date_of_death} onChange={e => setNewClaim({ ...newClaim, date_of_death: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Cause of Death</label>
                    <Input placeholder="e.g. Natural Causes" value={newClaim.cause} onChange={e => setNewClaim({ ...newClaim, cause: e.target.value })} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Claimant Name</label>
                    <Input placeholder="Full Name" value={newClaim.claimant_name} onChange={e => setNewClaim({ ...newClaim, claimant_name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Relationship</label>
                    <Input placeholder="e.g. Spouse" value={newClaim.claimant_relationship} onChange={e => setNewClaim({ ...newClaim, claimant_relationship: e.target.value })} required />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className={`w-full h-14 text-white rounded-2xl font-black uppercase tracking-widest ${newClaim.member_id === 'all' ? 'bg-slate-950 hover:bg-slate-800' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {newClaim.member_id === 'all' ? `Apply Bulk ₱${newClaim.deduction_amount} Deduction` : 'Record & Continue to Verify'}
          </Button>
        </form>
      </Modal>

      {/* General Bulk Deduction Modal */}
      <Modal isOpen={isBulkDeductOpen} onClose={() => setIsBulkDeductOpen(false)} title="General Bulk Deduction">
        <form onSubmit={handleBulkDeduct} className="space-y-6">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-6">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              Manual Fund Adjustment
            </p>
            <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
              This will deduct the specified amount from the balance of ALL active members simultaneously.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Deduction Amount (₱)</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={bulkDeductData.amount} 
                onChange={e => setBulkDeductData({...bulkDeductData, amount: e.target.value})} 
                required 
                className="h-12 rounded-xl" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Reason for Deduction</label>
              <Input 
                placeholder="e.g. Annual Maintenance Fee" 
                value={bulkDeductData.reason} 
                onChange={e => setBulkDeductData({...bulkDeductData, reason: e.target.value})} 
                required 
                className="h-12 rounded-xl" 
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800">
            Apply Bulk Deduction
          </Button>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TreasurerPortal;