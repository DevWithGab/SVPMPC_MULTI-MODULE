import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet, Users, CreditCard, Download, Bell, FilePlus2, BarChart3,
  Clock, Banknote, ClipboardCheck, XCircle, CheckCircle2, Calendar,
  HeartHandshake, Leaf, CreditCard as PaymentIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { mortuaryDashboardAPI } from '../../../services/api';
import { getClaimStatusMeta } from './claimMeta';

// ---- Local presentational pieces -------------------------------------
// Kept local to this page (rather than extending the shared StatCard/Card)
// so this redesign doesn't ripple into the treasurer or attendance
// dashboards, which use those same primitives.

const TONE = {
  green: { bg: 'bg-green-50', text: 'text-coop-green' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

const StatTile = ({ label, value, subtitle, icon: Icon, tone = 'green', solid = false, onClick }) => {
  const t = TONE[tone] || TONE.green;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 ${
        onClick
          ? 'transition-colors hover:border-coop-green/40 hover:bg-green-50/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/40'
          : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${solid ? 'bg-coop-green' : t.bg}`}>
        <Icon className={`w-5 h-5 ${solid ? 'text-white' : t.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>}
      </div>
    </Tag>
  );
};

const getActivityIcon = (status) => {
  switch (status) {
    case 'released':
    case 'approved':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    case 'pending_deduction':
    case 'deduction_processed':
      return Banknote;
    default:
      return Clock;
  }
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

const NotificationBell = ({ items, count, onViewAll }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-coop-green hover:border-coop-green/40 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-coop-green text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">Needs Attention</p>
            <p className="text-xs text-slate-400 mt-0.5">Claims awaiting review or processing</p>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((a, i) => {
                const meta = getClaimStatusMeta(a.status);
                return (
                  <div key={i} className="p-3.5 flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{a.memberName}</p>
                      <p className="text-[11px] text-slate-400">{meta.label}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="p-4 text-xs text-slate-400 text-center">You're all caught up.</p>
            )}
          </div>
          {onViewAll && (
            <button
              onClick={() => { setOpen(false); onViewAll(); }}
              className="w-full p-3 text-xs font-semibold text-coop-green hover:bg-green-50 border-t border-slate-100 transition-colors"
            >
              View all claims
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const RecentActivities = ({ contributions, payouts, onViewAll }) => {
  const activities = [
    ...(contributions || []).slice(0, 3).map((c) => ({
      type: 'contribution',
      title: 'New Contribution',
      desc: `₱${c.amount?.toLocaleString() || '0'} from ${c.member_name || `Member #${c.member_id}`}`,
      time: c.created_at || c.date,
      status: c.status || 'Paid',
    })),
    ...(payouts || []).slice(0, 3).map((p) => ({
      type: 'payout',
      title: 'Benefit Disbursement',
      desc: `Payout of ₱${p.amount?.toLocaleString() || '0'} to ${p.beneficiary || 'Beneficiary'}`,
      time: p.created_at || p.date,
      status: p.status || 'Released',
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white h-full">
      <CardHeader className="border-b border-slate-100 p-5 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-bold text-slate-900">Recent Fund Activity</CardTitle>
        <button onClick={onViewAll} className="text-xs font-semibold text-coop-green hover:text-coop-darkGreen transition-colors">
          View All
        </button>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        {activities.length > 0 ? (
          activities.slice(0, 5).map((act, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${act.type === 'contribution' ? 'bg-green-50 text-coop-green' : 'bg-amber-50 text-amber-600'}`}>
                {act.type === 'contribution' ? <PaymentIcon className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{act.title}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${act.type === 'contribution' ? 'bg-green-50 text-coop-green' : 'bg-amber-50 text-amber-700'}`}>
                    {act.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{act.desc}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(act.time)}</p>
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

const RecentClaimActivities = ({ activities, onViewAll }) => (
  <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white h-full">
    <CardHeader className="border-b border-slate-100 p-5 flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm font-bold text-slate-900">Recent Claim Activity</CardTitle>
      <button onClick={onViewAll} className="text-xs font-semibold text-coop-green hover:text-coop-darkGreen transition-colors">
        View All
      </button>
    </CardHeader>
    <CardContent className="p-5 space-y-5">
      {activities.length > 0 ? (
        activities.slice(0, 5).map((a, i) => {
          const meta = getClaimStatusMeta(a.status);
          const Icon = getActivityIcon(a.status);
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                <Icon className={`w-4 h-4 ${meta.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{a.memberName}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{a.changedBy || 'system'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(a.changedAt)}</p>
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

const Dashboard = ({ stats, contributions, payouts, members, setActiveTab, user }) => {
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
  const needsAttention = recentClaimActivities.filter(
    (a) => a.status === 'pending_requirements' || a.status === 'pending_deduction'
  );
  const needsAttentionCount = (claimCounts.pending_requirements || 0) + (claimCounts.pending_deduction || 0);

  const generateFundOverviewData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const data = months.map((month) => ({ month, collected: 0, paidOut: 0 }));

    (contributions || []).forEach((c) => {
      const date = new Date(c.created_at || c.date);
      if (date.getFullYear() === currentYear) data[date.getMonth()].collected += c.amount || 0;
    });

    (payouts || []).forEach((p) => {
      const date = new Date(p.created_at || p.date);
      if (date.getFullYear() === currentYear) data[date.getMonth()].paidOut += p.amount || 0;
    });

    return data.slice(0, new Date().getMonth() + 1);
  };

  const fundOverviewData = generateFundOverviewData();

  const totalCollected = stats?.totalCollected || 0;
  const totalPaidOut = (payouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const currentBalance = stats?.fundBalance || 0;
  const openingBalance = currentBalance - totalCollected + totalPaidOut;

  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((obj) =>
      Object.values(obj).map((val) =>
        typeof val === 'string' ? `"${String(val).replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const quickActions = [
    { icon: FilePlus2, label: 'Register New Claim', desc: 'File a new claim request', tab: 'claims' },
    { icon: Clock, label: 'View Pending Claims', desc: 'Review claims for approval', tab: 'claims' },
    { icon: Users, label: 'Manage Members', desc: 'View and manage members', tab: 'members' },
    { icon: HeartHandshake, label: 'Beneficiaries', desc: 'Manage claim beneficiaries', tab: 'beneficiaries' },
    { icon: BarChart3, label: 'Generate Reports', desc: 'View and export reports', tab: 'reports' },
  ];

  const firstName = user?.name?.split(' ')[0] || 'Admin';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, {firstName}! Here's what's happening with your mortuary fund today.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => exportToCSV(members, 'mortuary_report')}
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold border border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
          <div className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <NotificationBell items={needsAttention} count={needsAttentionCount} onViewAll={() => setActiveTab('claims')} />
        </div>
      </div>

      {/* Fund stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Fund Balance" value={`₱${currentBalance.toLocaleString()}`} subtitle="Available Balance" icon={Wallet} solid />
        <StatTile label="Active Members" value={stats?.activeMembers?.toLocaleString() || '0'} subtitle="Total Active Members" icon={Users} tone="green" />
        <StatTile label="Total Collected" value={`₱${totalCollected.toLocaleString()}`} subtitle="All Time" icon={CreditCard} tone="amber" />
        <StatTile label="Pending Requirements" value={claimCounts.pending_requirements ?? 0} subtitle="For Processing" icon={Clock} tone="amber" onClick={() => setActiveTab('claims')} />
      </div>

      {/* Claim stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Pending Deduction" value={claimCounts.pending_deduction ?? 0} subtitle="Awaiting Deduction" icon={Banknote} tone="blue" onClick={() => setActiveTab('claims')} />
        <StatTile label="Claims Released" value={claimCounts.released ?? 0} subtitle="All Time" icon={ClipboardCheck} tone="green" onClick={() => setActiveTab('claims')} />
        <StatTile label="Claims Rejected" value={claimCounts.rejected ?? 0} subtitle="All Time" icon={XCircle} tone="rose" onClick={() => setActiveTab('claims')} />
      </div>

      {/* Quick Actions + Recent Activity (left) / Fund Overview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="p-5 pb-4 space-y-0">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-coop-green" />
                <CardTitle className="text-sm font-bold text-slate-900">Quick Actions</CardTitle>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">Access frequently used features</p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => setActiveTab(action.tab)}
                    className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl border border-slate-200 hover:border-coop-green hover:bg-green-50 transition-colors group text-center"
                  >
                    <div className="p-3 bg-green-50 rounded-xl group-hover:bg-white group-hover:shadow-sm transition-all">
                      <action.icon className="w-5 h-5 text-coop-green" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{action.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{action.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecentActivities contributions={contributions} payouts={payouts} onViewAll={() => setActiveTab('reports')} />
            <RecentClaimActivities activities={recentClaimActivities} onViewAll={() => setActiveTab('claims')} />
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-5 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-coop-green" />
                <CardTitle className="text-sm font-bold text-slate-900">Fund Overview</CardTitle>
              </div>
              <span className="text-xs font-medium text-slate-400">This Year</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-xs font-semibold text-slate-500 mb-3">Collection vs Payout</p>
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-coop-green inline-block" /> Collected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-200 inline-block" /> Paid Out
              </span>
            </div>

            {fundOverviewData.length > 0 ? (
              <div className="h-55 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundOverviewData} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)}
                      width={32}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(value, name) => [`₱${value.toLocaleString()}`, name === 'collected' ? 'Collected' : 'Paid Out']}
                    />
                    <Bar dataKey="collected" fill="#2D7A3E" radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="paidOut" fill="#bbe5c3" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-55 flex items-center justify-center">
                <p className="text-sm text-slate-400">No fund data available</p>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Fund Summary</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Opening Balance</span>
                <span className="font-semibold text-slate-900">₱{openingBalance.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Collected</span>
                <span className="font-semibold text-slate-900">₱{totalCollected.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Paid Out</span>
                <span className="font-semibold text-slate-900">₱{totalPaidOut.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm bg-green-50 -mx-2 px-2 py-2.5 rounded-lg">
                <span className="font-semibold text-coop-green">Current Balance</span>
                <span className="font-bold text-coop-green">₱{currentBalance.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
