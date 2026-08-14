import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

const Reports = ({ members, contributions, stats = {} }) => {
  const calculateMemberStanding = () => {
    if (stats.memberStanding && Object.values(stats.memberStanding).some(v => v > 0)) {
      return stats.memberStanding;
    }
    const standing = { excellent: 0, good: 0, fair: 0, atRisk: 0 };
    members.forEach(m => {
      const balance = m.balance || 0;
      if (balance >= 10000) standing.excellent++;
      else if (balance >= 5000) standing.good++;
      else if (balance >= 1000) standing.fair++;
      else standing.atRisk++;
    });
    return standing;
  };

  const calculateStatusComposition = () => {
    if (stats.statusComposition && Object.values(stats.statusComposition).some(v => v > 0)) {
      return stats.statusComposition;
    }
    return {
      active: members.filter(m => m.status === 'active').length,
      inactive: members.filter(m => m.status === 'inactive').length,
      deceased: members.filter(m => m.status === 'deceased').length,
    };
  };

  const memberStanding = calculateMemberStanding();
  const statusComposition = calculateStatusComposition();

  const memberStandingData = [
    { standing: "Excellent", members: memberStanding.excellent || 0, fill: "#059669" },
    { standing: "Good", members: memberStanding.good || 0, fill: "#14b8a6" },
    { standing: "Fair", members: memberStanding.fair || 0, fill: "#f59e0b" },
    { standing: "At Risk", members: memberStanding.atRisk || 0, fill: "#ef4444" },
  ];

  const statusCompositionData = [
    { status: "Active", members: statusComposition.active || 0, fill: "#3b82f6" },
    { status: "Inactive", members: statusComposition.inactive || 0, fill: "#94a3b8" },
    { status: "Deceased", members: statusComposition.deceased || 0, fill: "#1e293b" },
  ];

  const calculateMonthlyData = () => {
    const monthlyTotals = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    contributions.forEach(c => {
      if (c.payment_date) {
        const date = new Date(c.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = monthNames[date.getMonth()];
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = { month: monthLabel, value: 0, fullKey: monthKey };
        }
        monthlyTotals[monthKey].value += c.amount || 0;
      }
    });
    const sortedData = Object.values(monthlyTotals).sort((a, b) => a.fullKey.localeCompare(b.fullKey)).slice(-5);
    return sortedData.length > 0 ? sortedData : [{ month: 'No Data', value: 0 }];
  };

  const monthlyData = calculateMonthlyData();

  const calculateGrowthTrend = () => {
    if (monthlyData.length < 2) return '+0%';
    const current = monthlyData[monthlyData.length - 1].value;
    const previous = monthlyData[monthlyData.length - 2].value;
    if (previous === 0) return '+0%';
    const growth = ((current - previous) / previous * 100).toFixed(1);
    return growth > 0 ? `+${growth}%` : `${growth}%`;
  };

  const growthTrend = calculateGrowthTrend();
  const isPositiveGrowth = !growthTrend.startsWith('-');

  const standingColors = ['#059669', '#14b8a6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Fund Reports</h2>
        <p className="text-sm text-slate-500 mt-1">Audit and financial overview</p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inflow Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Contributions Trend</p>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isPositiveGrowth ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {growthTrend}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Last 5 months</p>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <RechartsTooltip contentStyle={{ border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReport)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Charts */}
        <div className="space-y-4">
          {/* Member Standing */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-900 mb-3">Member Standing</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={memberStandingData} dataKey="members" innerRadius={40} outerRadius={55} paddingAngle={4}>
                    {memberStandingData.map((entry, i) => (
                      <Cell key={i} fill={standingColors[i]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {memberStandingData.map((item, i) => (
                <div key={item.standing} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: standingColors[i] }} />
                  <span className="text-xs text-slate-600">{item.standing}</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">{item.members}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Composition */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-900 mb-3">Status Composition</p>
            <div className="flex items-center gap-4">
              <div className="h-[100px] w-[100px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusCompositionData} dataKey="members" innerRadius={30} outerRadius={42} stroke="none">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#94a3b8" />
                      <Cell fill="#1e293b" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {statusCompositionData.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{item.status}</span>
                    <span className="font-bold text-slate-900">{item.members}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-sm font-bold text-slate-900">{stats?.totalMembers?.toLocaleString() || members.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Recent Activity</p>
          <p className="text-xs text-slate-400 mt-0.5">Latest contributions</p>
        </div>
        <div className="divide-y divide-slate-100">
          {contributions.slice(0, 5).map((c, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                  {(c.member_name || 'M').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.member_name || `Member #${c.member_id}`}</p>
                  <p className="text-xs text-slate-400">{c.payment_date}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900">₱{c.amount?.toLocaleString()}</p>
            </div>
          ))}
          {contributions.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-slate-400">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
