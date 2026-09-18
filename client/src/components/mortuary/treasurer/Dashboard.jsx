import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, Users, AlertTriangle, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, Pie, PieChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import StatCard from '../shared/StatCard';

const Dashboard = ({ stats, contributions = [] }) => {
  const atRiskMembersCount = stats?.lowBalanceMembers || 0;
  const totalMembersCount = stats?.totalMembers || 1;
  const healthyRatio = Math.round(((totalMembersCount - atRiskMembersCount) / totalMembersCount) * 100) || 0;
  const isOptimal = healthyRatio >= 80;

  const memberStandingData = [
    { standing: "excellent", members: stats?.memberStanding?.excellent || 0, fill: "#10b981" },
    { standing: "good", members: stats?.memberStanding?.good || 0, fill: "#3b82f6" },
    { standing: "fair", members: stats?.memberStanding?.fair || 0, fill: "#f59e0b" },
    { standing: "atRisk", members: stats?.memberStanding?.atRisk || 0, fill: "#ef4444" },
  ].filter(item => item.members > 0);

  const statusCompositionData = [
    { status: "active", members: stats?.statusComposition?.active || stats?.activeMembers || 0, fill: "#2D7A3E" },
    { status: "inactive", members: stats?.statusComposition?.inactive || stats?.inactiveMembers || 0, fill: "#64748b" },
    { status: "deceased", members: stats?.statusComposition?.deceased || stats?.deceasedMembers || 0, fill: "#1e293b" },
  ].filter(item => item.members > 0);

  const memberStandingConfig = {
    members: { label: "Members" },
    excellent: { label: "Excellent (₱10k+)", color: "#10b981" },
    good: { label: "Good (₱5k-10k)", color: "#3b82f6" },
    fair: { label: "Fair (₱1k-5k)", color: "#f59e0b" },
    atRisk: { label: "At Risk (<₱1k)", color: "#ef4444" },
  };

  const statusCompositionConfig = {
    members: { label: "Members" },
    active: { label: "Active", color: "#2D7A3E" },
    inactive: { label: "Inactive", color: "#64748b" },
    deceased: { label: "Deceased", color: "#1e293b" },
  };

  const calculateChartData = () => {
    const monthlyTotals = {};
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    contributions.forEach(c => {
      if (c.payment_date) {
        const date = new Date(c.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = { contributions: 0, count: 0 };
        }
        monthlyTotals[monthKey].contributions += c.amount || 0;
        monthlyTotals[monthKey].count += 1;
      }
    });

    // Walk every one of the trailing 6 calendar months, not just the ones
    // that had a contribution — otherwise a month with zero activity is
    // skipped entirely and the line jumps straight from the last active
    // month to the next, masking the gap (and skewing the growth-rate
    // comparison, which assumes it's comparing consecutive months).
    const now = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const totals = monthlyTotals[monthKey] || { contributions: 0, count: 0 };
      last6Months.push({ month: monthNames[d.getMonth()], fullKey: monthKey, ...totals });
    }

    if (!last6Months.some(item => item.contributions > 0)) {
      return [{ month: 'No Data', contributions: 0, balance: 0, count: 0 }];
    }

    let cumulativeBalance = 0;
    return last6Months.map(item => {
      cumulativeBalance += item.contributions;
      return { ...item, balance: cumulativeBalance };
    });
  };

  const chartData = calculateChartData();

  const calculateGrowthRate = () => {
    if (chartData.length < 2) return 0;
    const lastMonth = chartData[chartData.length - 1].contributions;
    const previousMonth = chartData[chartData.length - 2].contributions;
    if (previousMonth === 0) return 0;
    return (((lastMonth - previousMonth) / previousMonth) * 100).toFixed(1);
  };

  const growthRate = calculateGrowthRate();
  const isPositiveGrowth = growthRate >= 0;
  const hasEnoughDataToCompare = chartData.length >= 2 && chartData[0].month !== 'No Data';

  // "January - June 2024" style range, matching shadcn's chart caption convention.
  const dateRangeLabel = (() => {
    if (!chartData.length || chartData[0].month === 'No Data') return 'No contributions recorded yet';
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const firstYear = first.fullKey?.slice(0, 4);
    const lastYear = last.fullKey?.slice(0, 4);
    if (first === last) return `${first.month} ${firstYear}`;
    return firstYear === lastYear
      ? `${first.month} - ${last.month} ${lastYear}`
      : `${first.month} ${firstYear} - ${last.month} ${lastYear}`;
  })();

  const trendCaption = hasEnoughDataToCompare
    ? `${isPositiveGrowth ? 'Trending up' : 'Trending down'} vs last month · ${dateRangeLabel}`
    : dateRangeLabel;

  const chartConfig = {
    contributions: { label: "Contributions", color: "#2D7A3E" },
    balance: { label: "Fund Balance", color: "#10b981" },
  };

  const standingColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Financial overview and member insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Fund"
          value={`₱${stats?.fundBalance?.toLocaleString() || '0'}`}
          subtitle="Mortuary fund balance"
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Active Members"
          value={stats?.activeMembers?.toLocaleString() || '0'}
          subtitle="Currently contributing"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Low Balance"
          value={<>{stats?.lowBalanceMembers || 0} <span className="text-base font-normal text-slate-500">members</span></>}
          subtitle="Below ₱1,000"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Capital Adequacy"
          value={`${healthyRatio}%`}
          subtitle={isOptimal ? 'Optimal' : 'Needs attention'}
          icon={ShieldCheck}
          color={isOptimal ? 'emerald' : 'rose'}
        />
      </div>

      {/* Claims Fund — death-fund assessment money in vs. benefit money out,
          across every claim. Separate from Total Fund above, which is
          members' own contribution balances. A claim releases what was collected
          for it up to the ₱50,000 benefit cap; the surplus above the cap is
          the cooperative's income, which is what Net Claims Income totals. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Deductions Collected"
          value={`₱${(stats?.totalDeductionsCollected || 0).toLocaleString()}`}
          subtitle="Held, awaiting release"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Total Claims Released"
          value={`₱${(stats?.totalReleased || 0).toLocaleString()}`}
          subtitle="Benefits paid out (max ₱50,000/claim)"
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Net Claims Income"
          value={`₱${(stats?.netClaimsBalance || 0).toLocaleString()}`}
          subtitle="Surplus retained by the cooperative"
          icon={Wallet}
          color={(stats?.netClaimsBalance || 0) >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fund Growth Line Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Fund Growth</p>
                {hasEnoughDataToCompare && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${isPositiveGrowth ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {isPositiveGrowth ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(growthRate)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{trendCaption}</p>
            </div>
          </div>

          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillContributions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-contributions)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-contributions)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => `₱${v.toLocaleString()}`} />} />
              <Area type="natural" dataKey="contributions" stroke="var(--color-contributions)" strokeWidth={2} fill="url(#fillContributions)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ChartContainer>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Total Collected</p>
              <p className="text-sm font-bold text-slate-900">₱{chartData.reduce((s, d) => s + d.contributions, 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Avg/Month</p>
              <p className="text-sm font-bold text-slate-900">₱{(chartData.reduce((s, d) => s + d.contributions, 0) / Math.max(chartData.length, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Transactions</p>
              <p className="text-sm font-bold text-slate-900">{chartData.reduce((s, d) => s + (d.count || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Cumulative Balance Area Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Fund Balance</p>
            <p className="text-xs text-slate-400 mt-0.5">{trendCaption}</p>
          </div>

          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => `₱${v.toLocaleString()}`} />} />
              <Area type="natural" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} fill="url(#fillBalance)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ChartContainer>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Current Balance</p>
            <p className="text-lg font-bold text-slate-900">₱{stats?.fundBalance?.toLocaleString() || '0'}</p>
          </div>
        </div>
      </div>

      {/* Pie Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Member Standing */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-slate-900 mb-1">Member Standing</p>
          <p className="text-xs text-slate-400 mb-4">Balance-based categories</p>

          <div className="h-[220px]">
            <ChartContainer config={memberStandingConfig} className="w-full h-full">
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent
                    hideLabel
                    formatter={(v) => <span className="font-semibold">{v.toLocaleString()} members</span>}
                  />}
                />
                <Pie
                  data={memberStandingData}
                  dataKey="members"
                  label={({ standing, percent }) =>
                    `${standing === 'atRisk' ? 'At Risk' : standing.charAt(0).toUpperCase() + standing.slice(1)}: ${(percent * 100).toFixed(0)}%`
                  }
                  nameKey="standing"
                />
              </PieChart>
            </ChartContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
            {memberStandingData.map((item, i) => (
              <div key={item.standing} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: standingColors[i] }} />
                  <span className="text-slate-600">{item.standing === 'atRisk' ? 'At Risk' : item.standing.charAt(0).toUpperCase() + item.standing.slice(1)}</span>
                </span>
                <span className="font-bold text-slate-900">{item.members}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Composition */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-slate-900 mb-1">Status Composition</p>
          <p className="text-xs text-slate-400 mb-4">Member status breakdown</p>

          <div className="flex items-center gap-6">
            <div className="h-[180px] w-[180px] shrink-0">
              <ChartContainer config={statusCompositionConfig} className="w-full h-full">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent
                      hideLabel
                      formatter={(v) => <span className="font-semibold">{v.toLocaleString()} members</span>}
                    />}
                  />
                  <Pie data={statusCompositionData} dataKey="members" nameKey="status" stroke="0" />
                </PieChart>
              </ChartContainer>
            </div>
            <div className="space-y-3 flex-1">
              {statusCompositionData.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
                  <span className="font-bold text-slate-900">{item.members}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">Total members</p>
                <p className="text-lg font-bold text-slate-900">{stats?.totalMembers?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
