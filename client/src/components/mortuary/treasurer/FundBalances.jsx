import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, DollarSign, AlertTriangle, Minus, 
  MessageSquare, RefreshCw, Search, CheckCircle2 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { Pie, PieChart } from 'recharts';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import api from '../../../services/api';

const StatCard = ({ title, value, icon: Icon, color = "green" }) => (
  <Card className="p-6 border-slate-200/60 shadow-lg rounded-[2rem] bg-white">
    <div className="flex items-center gap-4">
      <div className={`p-3 ${color === 'green' ? 'bg-green-50' : `bg-${color}-50`} rounded-xl`}>
        <Icon className={`w-6 h-6 ${color === 'green' ? 'text-coop-green' : `text-${color}-600`}`} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <h3 className="text-2xl font-black text-slate-950">{value}</h3>
      </div>
    </div>
  </Card>
);

const MemberRow = ({ member }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${member.isLowBalance ? 'bg-red-500' : 'bg-coop-green'}`} />
      <div>
        <p className="font-black text-slate-900">{member.memberName}</p>
        <p className="text-xs text-slate-500 font-bold">{member.memberId}</p>
      </div>
    </div>
    <div className="text-right">
      <p className={`text-lg font-black ${member.isLowBalance ? 'text-red-600' : 'text-coop-green'}`}>
        ₱{member.balance?.toLocaleString() || '0'}
      </p>
      <p className="text-xs text-slate-500 font-bold">
        {member.isLowBalance ? 'Low Balance' : 'Good Standing'}
      </p>
    </div>
  </div>
);

export default function FundBalances({ user }) {
  const [memberBalances, setMemberBalances] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [deductionLoading, setDeductionLoading] = useState(false);

  useEffect(() => {
    fetchMemberBalances();
  }, []);

  const fetchMemberBalances = async () => {
    try {
      setLoading(true);
      const response = await api.get('/mortuary/treasurer/balances/all');
      if (response.data.success) {
        setMemberBalances(response.data.data.members);
        setSummary(response.data.data.summary);
      }
    } catch (error) {
      console.error('Error fetching member balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutomaticDeduction = async () => {
    const deceasedName = prompt('Enter the name of the deceased member:');
    if (!deceasedName) return;

    try {
      setDeductionLoading(true);
      const response = await api.post('/mortuary/treasurer/balances/automatic-deduction', {
        deceasedMemberName: deceasedName,
        recordedBy: user?.name || 'treasurer'
      });

      if (response.data.success) {
        alert(`Automatic deduction processed successfully!\n\nProcessed: ${response.data.data.processedMembers} members\nLow balance alerts: ${response.data.data.lowBalanceMembers} members`);
        await fetchMemberBalances();
      }
    } catch (error) {
      console.error('Error processing automatic deduction:', error);
      alert('Error processing automatic deduction. Please try again.');
    } finally {
      setDeductionLoading(false);
    }
  };

  const handleSendLowBalanceNotifications = async () => {
    if (!confirm('Send SMS notifications to all members with low balance?')) return;

    try {
      const response = await api.post('/mortuary/treasurer/balances/send-low-balance-notifications');
      if (response.data.success) {
        alert(`Low balance notifications prepared for ${response.data.data.count} members.`);
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      alert('Error sending notifications. Please try again.');
    }
  };

  const filteredMembers = memberBalances.filter(member => {
    const matchesSearch = member.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.memberId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterType === 'low-balance') {
      matchesFilter = member.isLowBalance;
    } else if (filterType === 'normal') {
      matchesFilter = !member.isLowBalance;
    }
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Fund Balances</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">Monitor all member fund balances and process deductions</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAutomaticDeduction}
            disabled={deductionLoading}
            variant="danger"
            className="rounded-xl font-bold"
          >
            {deductionLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Minus className="w-4 h-4 mr-2" />
            )}
            Process Death Deduction
          </Button>
          <Button
            onClick={fetchMemberBalances}
            disabled={loading}
            variant="secondary"
            className="rounded-xl font-bold"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Fund Balance"
          value={`₱${summary.totalBalance?.toLocaleString() || '0'}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Active Members"
          value={summary.totalMembers || '0'}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Average Balance"
          value={`₱${summary.averageBalance?.toLocaleString() || '0'}`}
          icon={TrendingUp}
          color="yellow"
        />
        <StatCard
          title="Low Balance Alerts"
          value={summary.lowBalanceCount || '0'}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Low Balance Alert */}
      {summary.lowBalanceCount > 0 && (
        <Card className="border-red-200 bg-red-50 rounded-[2rem] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-black text-red-800">Low Balance Alert</h3>
                <p className="text-red-700 font-bold">
                  {summary.lowBalanceCount} member(s) have balance below ₱{summary.minimumBalance?.toLocaleString()}.
                </p>
              </div>
            </div>
            <Button
              onClick={handleSendLowBalanceNotifications}
              variant="secondary"
              className="border-red-300 text-red-700 hover:bg-red-100 rounded-xl"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send SMS Alerts
            </Button>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={Search}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('all')}
                className="rounded-xl font-bold"
              >
                All
              </Button>
              <Button
                variant={filterType === 'low-balance' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('low-balance')}
                className="rounded-xl font-bold"
              >
                Low Balance
              </Button>
              <Button
                variant={filterType === 'normal' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('normal')}
                className="rounded-xl font-bold"
              >
                Normal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member List */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-coop-green" /> 
            Member Balances ({filteredMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-4 animate-spin" />
              <p className="text-slate-400 font-bold">Loading member balances...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-bold text-lg">No members found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <MemberRow key={member.memberId} member={member} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}