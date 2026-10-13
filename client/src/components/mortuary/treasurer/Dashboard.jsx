import { contributionTrend, memberBalanceCoverage, contributionGrowth } from '../../../utils/dashboardMetrics';
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, Users, AlertTriangle, ShieldCheck, TrendingUp, TrendingDown, ArrowRight, RefreshCw } from 'lucide-react';
import { AreaChart, Area, Bar, BarChart, Pie, PieChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import { formatLongDate } from '../../../utils/date';
import './Dashboard.css';

const Dashboard = ({ user, stats, contributions = [], claimsCounts, claimsError, setActiveTab, onRefresh, refreshing = false }) => {
  const firstName = user?.name?.split(' ')[0] || 'Treasurer';
  const healthyRatio = memberBalanceCoverage(stats);

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

  const chartData = contributionTrend(contributions);
  const growthRate = contributionGrowth(chartData);
  const isPositiveGrowth = growthRate >= 0;
  const hasEnoughDataToCompare = growthRate !== null;

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
    ? `Month to date vs full previous month · ${dateRangeLabel}`
    : dateRangeLabel;

  const chartConfig = {
    contributions: { label: "Contributions", color: "#2D7A3E" },
  };

  const claimsConfig = {
    claims: { label: "Claims" },
    pendingDeduction: { label: "Pending deduction", color: "#f59e0b" },
    awaitingRelease: { label: "Awaiting release", color: "#3b82f6" },
  };
  const claimsData = [
    { stage: 'pendingDeduction', claims: claimsCounts?.pendingDeduction ?? 0, fill: 'var(--color-pendingDeduction)' },
    { stage: 'awaitingRelease', claims: claimsCounts?.awaitingRelease ?? 0, fill: 'var(--color-awaitingRelease)' },
  ];
  const outstandingClaims = claimsData.reduce((total, row) => total + row.claims, 0);

  return (
    <div className="treasurer-dashboard">
      <header className="td-header">
        <div><p className="td-eyebrow">Mortuary management / Overview</p><h1>Mortuary dashboard</h1><p className="td-description">{formatLongDate(new Date())} <span>· Philippine time</span></p></div>
        <div className="td-header-actions">
          <button className="td-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <button className="td-button td-primary" onClick={() => setActiveTab('contributions')}>Manage contributions <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </header>
      <AttendanceMetricGrid label="Mortuary fund overview" busy={refreshing} items={[
        ['Active member balances', '₱' + (stats?.fundBalance?.toLocaleString() || '0'), 'Sum of active member ledger balances', Wallet],
        ['Active members', stats?.activeMembers?.toLocaleString() || '0', 'Currently contributing', Users],
        ['Low balance', (stats?.lowBalanceMembers || 0).toLocaleString(), 'Members with balances below ₱1,000', AlertTriangle],
        ['Above minimum balance', healthyRatio === null ? 'N/A' : healthyRatio + '%', 'Active members with at least PHP 1,000', ShieldCheck],
      ]} />
      <p className="td-overview">Welcome back, {firstName}. Review the fund's financial overview and member insights.</p>
      <div className="td-workspace"><div className="td-main">
        {/* Fund Growth Line Chart */}
        <div className="td-panel td-chart-panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Monthly Contributions</p>
                {hasEnoughDataToCompare && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${isPositiveGrowth ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {isPositiveGrowth ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(growthRate).toFixed(1)}%
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
              <Area type="monotone" dataKey="contributions" stroke="var(--color-contributions)" strokeWidth={2} fill="url(#fillContributions)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ChartContainer>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Collected in Shown Period</p>
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

      {/* Pie Charts Section */}
      <div className="td-pies">
        {/* Member Standing */}
        <div className="td-panel td-chart-panel">
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
            {memberStandingData.map((item) => (
              <div key={item.standing} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.fill }} />
                  <span className="text-slate-600">{item.standing === 'atRisk' ? 'At Risk' : item.standing.charAt(0).toUpperCase() + item.standing.slice(1)}</span>
                </span>
                <span className="font-bold text-slate-900">{item.members}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Composition */}
        <div className="td-panel td-chart-panel">
          <p className="text-sm font-semibold text-slate-900 mb-1">Status Composition</p>
          <p className="text-xs text-slate-400 mb-4">Member status breakdown</p>

          <div className="td-composition">
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
</div><aside className="td-sidebar" aria-label="Claims and fund activity">        {/* Claims awaiting treasurer action */}
        <div className="td-panel td-chart-panel">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Claims Awaiting Action</p>
            <p className="text-xs text-slate-400 mt-0.5">Current claims pending deduction or benefit release</p>
          </div>

          {claimsError || !claimsCounts || outstandingClaims === 0 ? (
            <div role="status" className="flex h-[240px] items-center justify-center text-center text-sm text-slate-500">
              {claimsError ? 'Unable to load claim counts. Retry using the notice above.'
                : !claimsCounts ? 'Loading claim counts...'
                : 'No claims pending deduction or release.'}
            </div>
          ) : (
            <ChartContainer config={claimsConfig} className="h-[240px] w-full">
              <BarChart accessibilityLayer data={claimsData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={115}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(stage) => claimsConfig[stage].label}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent
                  labelKey="stage"
                  formatter={(value) => `${value.toLocaleString()} ${value === 1 ? 'claim' : 'claims'}`}
                />} />
                <Bar dataKey="claims" radius={4} barSize={32} />
              </BarChart>
            </ChartContainer>
          )}

          {claimsCounts && !claimsError && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              {claimsData.map((item) => (
                <div key={item.stage} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: claimsConfig[item.stage].color }} />
                    {claimsConfig[item.stage].label}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">{item.claims.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

          <section className="td-panel" aria-labelledby="td-fund-title">
            <div className="td-panel-heading"><h2 id="td-fund-title">Fund activity</h2><p>All-time assessments and benefits.</p></div>
            <dl className="td-fund-totals">
              <div><dt><TrendingUp size={15} aria-hidden="true" />Total deductions collected</dt><dd>₱{(stats?.totalDeductionsCollected || 0).toLocaleString()}</dd><small>All-time assessments collected</small></div>
              <div><dt><TrendingDown size={15} aria-hidden="true" />Total claims released</dt><dd>₱{(stats?.totalReleased || 0).toLocaleString()}</dd><small>Benefits paid out (max ₱50,000/claim)</small></div>
            </dl>
          </section>
          <nav className="td-tools" aria-label="Mortuary workspace">
            <h2>Workspace</h2>
            {[
              ['claims', 'Claims', 'Process deductions and release benefits.'],
              ['members', 'Member balances', 'Review balances and member standing.'],
              ['reports', 'Mortuary reports', 'Review fund activity and export records.'],
            ].map(([tab, label, description]) => <button key={tab} onClick={() => setActiveTab(tab)}><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={15} aria-hidden="true" /></button>)}
          </nav>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
