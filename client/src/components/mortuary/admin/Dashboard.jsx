import React, { useState, useEffect } from 'react';
import {
  DollarSign, Users, CreditCard, TrendingUp, Download,
  UserPlus, FileText, BarChart3, FilePlus2, ClipboardList, Clock, Banknote,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie,
  Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import StatCard from '../shared/StatCard';
import { mortuaryDashboardAPI } from '../../../services/api';
import { getClaimStatusMeta } from './claimMeta';

const RecentActivities = ({ contributions, payouts }) => {
  const activities = [
    ...(contributions || []).slice(0, 3).map(c => ({
      type: 'contribution',
      title: 'New Contribution',
      desc: `₱${c.amount?.toLocaleString() || '0'} from ${c.member_name || `Member #${c.member_id}`}`,
      time: new Date(c.created_at || c.date).toLocaleDateString(),
      status: c.status || 'Verified'
    })),
    ...(payouts || []).slice(0, 3).map(p => ({
      type: 'payout',
      title: 'Benefit Disbursement',
      desc: `Payout of ₱${p.amount?.toLocaleString() || '0'} to ${p.beneficiary || 'Beneficiary'}`,
      time: new Date(p.created_at || p.date).toLocaleDateString(),
      status: p.status || 'Completed'
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white h-full">
      <CardHeader className="border-b border-slate-100 p-5">
        <CardTitle className="text-sm font-bold text-slate-900">Recent Fund Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        {activities.length > 0 ? (
          activities.map((act, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${act.type === 'contribution' ? 'bg-green-50 text-coop-green' : 'bg-amber-50 text-amber-600'}`}>
                {act.type === 'contribution' ? <CreditCard className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{act.title}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${act.type === 'contribution' ? 'bg-green-50 text-coop-green' : 'bg-amber-50 text-amber-700'}`}>
                    {act.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{act.desc}</p>
                <p className="text-xs text-slate-400 mt-0.5">{act.time}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No recent activities</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const RecentClaimActivities = ({ activities }) => (
  <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white h-full">
    <CardHeader className="border-b border-slate-100 p-5">
      <CardTitle className="text-sm font-bold text-slate-900">Recent Claim Activity</CardTitle>
    </CardHeader>
    <CardContent className="p-5 space-y-4">
      {activities.length > 0 ? (
        activities.map((a, i) => {
          const meta = getClaimStatusMeta(a.status);
          return (
            <div key={i} className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{a.memberName}</p>
                <p className="text-xs text-slate-500">
                  {meta.label} • {a.changedBy || 'system'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(a.changedAt).toLocaleString()}</p>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">No claim activity yet</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const Dashboard = ({ stats, contributions, payouts, members, setActiveTab }) => {
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    mortuaryDashboardAPI
      .getAdminDashboard()
      .then((res) => {
        if (!cancelled) setAdminData(res?.data || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const claimCounts = adminData?.claims || {};
  const recentClaimActivities = adminData?.recentClaimActivities || [];

  const memberStatusData = [
    { name: 'Active', value: members.filter(m => m.status === 'active').length, color: '#2D7A3E' },
    { name: 'Inactive', value: members.filter(m => m.status === 'inactive').length, color: '#94a3b8' },
    { name: 'Deceased', value: members.filter(m => m.status === 'deceased').length, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const generateFundGrowthData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const monthlyData = months.map((month) => ({ month, balance: 0, contributions: 0 }));

    (contributions || []).forEach(contribution => {
      const date = new Date(contribution.created_at || contribution.date);
      if (date.getFullYear() === currentYear) {
        monthlyData[date.getMonth()].contributions += contribution.amount || 0;
      }
    });

    let cumulativeBalance = 0;
    monthlyData.forEach((data, index) => {
      cumulativeBalance += data.contributions;
      (payouts || []).forEach(payout => {
        const date = new Date(payout.created_at || payout.date);
        if (date.getFullYear() === currentYear && date.getMonth() === index) {
          cumulativeBalance -= payout.amount || 0;
        }
      });
      data.balance = cumulativeBalance;
    });

    return monthlyData.slice(0, new Date().getMonth() + 1);
  };

  const fundGrowthData = generateFundGrowthData();

  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj =>
      Object.values(obj).map(val =>
        typeof val === 'string' ? `"${String(val).replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of your mortuary fund and claims activity.</p>
        </div>
        <button
          onClick={() => exportToCSV(members, 'members_summary')}
          className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold border border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" /> Backup Data
        </button>
      </div>

      {/* Fund stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Fund" value={`₱${stats?.fundBalance?.toLocaleString() || '0'}`} icon={DollarSign} color="emerald" />
        <StatCard title="Active Members" value={stats?.activeMembers?.toLocaleString() || '0'} icon={Users} color="blue" />
        <StatCard title="Total Collected" value={`₱${stats?.totalCollected?.toLocaleString() || '0'}`} icon={CreditCard} color="amber" />
      </div>

      {/* Claim stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending Requirements" value={claimCounts.pending_requirements ?? 0} icon={Clock} color="amber" onClick={() => setActiveTab('claims')} />
        <StatCard title="Pending Deduction" value={claimCounts.pending_deduction ?? 0} icon={Banknote} color="blue" onClick={() => setActiveTab('claims')} />
        <StatCard title="Claims Released" value={claimCounts.released ?? 0} icon={ClipboardList} color="emerald" onClick={() => setActiveTab('claims')} />
        <StatCard title="Claims Rejected" value={claimCounts.rejected ?? 0} icon={FileText} color="rose" onClick={() => setActiveTab('claims')} />
      </div>

      {/* Quick Actions */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: FilePlus2, label: 'Register New Claim', tab: 'claims' },
              { icon: Clock, label: 'View Pending Claims', tab: 'claims' },
              { icon: UserPlus, label: 'View Members', tab: 'members' },
              { icon: BarChart3, label: 'Generate Reports', tab: 'reports' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveTab(action.tab)}
                className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl border border-slate-200 hover:border-coop-green hover:bg-green-50 transition-colors group"
              >
                <div className="p-3 bg-green-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                  <action.icon className="w-5 h-5 text-coop-green" />
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivities contributions={contributions} payouts={payouts} />
        <RecentClaimActivities activities={recentClaimActivities} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">Fund Growth</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">Monthly collection vs. balance performance</CardDescription>
              </div>
              <TrendingUp className="w-4 h-4 text-coop-green" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {fundGrowthData.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fundGrowthData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D7A3E" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2D7A3E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="balance" stroke="#2D7A3E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-slate-400">No contribution data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold text-slate-900">Member Standing</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={memberStatusData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                    {memberStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
