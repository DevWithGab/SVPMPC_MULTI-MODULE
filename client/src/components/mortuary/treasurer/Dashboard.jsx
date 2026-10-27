import { Button as ActionButton } from '../../ui/button';
import { contributionTrend, memberBalanceCoverage, contributionGrowth } from '../../../utils/dashboardMetrics';
import { ArrowRight, RefreshCw, ChevronDown } from 'lucide-react';
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { formatLongDate } from '../../../utils/date';
import { MEMBER_STANDING_LABELS } from '../../../utils/memberStanding';
import './Dashboard.css';

const money = (value = 0) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactMoney = (value) => `₱${Number(value).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 })}`;

const Dashboard = ({ user, stats, contributions = [], claimsCounts, claimsError, setActiveTab, onRefresh, refreshing = false }) => {
  const firstName = user?.name?.split(' ')[0] || 'Finance Officer';
  const healthyRatio = memberBalanceCoverage(stats);
  const minimumBalance = stats?.minimumBalance ?? 1000;
  const standingDescriptions = {
    excellent: '₱10,000 and above', good: '₱5,000 to below ₱10,000',
    fair: `₱${minimumBalance.toLocaleString()} to below ₱5,000`,
    atRisk: `₱0 to below ₱${minimumBalance.toLocaleString()}`, negativeBalance: 'Below ₱0',
  };
  const memberStandingData = ['excellent', 'good', 'fair', 'atRisk', 'negativeBalance']
    .map(standing => ({ standing, members: stats?.memberStanding?.[standing] || 0 }))
    .filter(item => item.members > 0);
  const memberStandingTotal = memberStandingData.reduce((sum, item) => sum + item.members, 0);
  const statusCompositionData = [
    { status: 'Active', members: stats?.statusComposition?.active || stats?.activeMembers || 0 },
    { status: 'Inactive', members: stats?.statusComposition?.inactive || stats?.inactiveMembers || 0 },
    { status: 'Deceased', members: stats?.statusComposition?.deceased || stats?.deceasedMembers || 0 },
  ];
  const chartData = contributionTrend(contributions);
  const growthRate = contributionGrowth(chartData);
  const first = chartData[0];
  const last = chartData.at(-1);
  const dateRangeLabel = first.fullKey.slice(0, 4) === last.fullKey.slice(0, 4)
    ? `${first.month} – ${last.month} ${last.fullKey.slice(0, 4)}`
    : `${first.month} ${first.fullKey.slice(0, 4)} – ${last.month} ${last.fullKey.slice(0, 4)}`;
  const collected = chartData.reduce((sum, row) => sum + row.contributions, 0);
  const outstandingClaims = claimsCounts?.pendingDeduction ?? 0;
  const activeMembers = stats?.activeMembers || 0;
  const lowBalanceMembers = stats?.lowBalanceMembers || 0;
  const coveredMembers = activeMembers - Math.min(activeMembers, Math.max(0, lowBalanceMembers));
  const chartConfig = { contributions: { label: 'Contributions', color: '#3E7055' } };

  return (
    <div className="treasurer-dashboard" aria-busy={refreshing}>
      <p className="td-eyebrow">Mortuary management <span aria-hidden="true">/</span> <strong>Dashboard</strong></p>
      <header className="td-header">
        <div><h1>Mortuary dashboard</h1><p className="td-description">{formatLongDate(new Date())} · Philippine time</p></div>
        <div className="td-header-actions">
          <ActionButton variant="outline" className="td-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</ActionButton>
          <ActionButton className="td-button td-primary" onClick={() => setActiveTab('ledger')}>Open member ledger <ArrowRight size={19} aria-hidden="true" /></ActionButton>
        </div>
      </header>

      <dl className="td-metrics" aria-label="Mortuary fund overview">
        {[
          ['Active member balances', money(stats?.fundBalance || 0), 'Sum of active member ledgers'],
          ['Active members', activeMembers.toLocaleString(), 'Currently contributing'],
          ['Below minimum', lowBalanceMembers.toLocaleString(), `Balances below ₱${minimumBalance.toLocaleString()}`],
          ['At or above minimum', healthyRatio === null ? 'N/A' : `${healthyRatio}%`, `${coveredMembers.toLocaleString()} of ${activeMembers.toLocaleString()} active members`],
        ].map(([label, value, description], index) => <div key={label}><dt>{label}</dt><dd data-negative={index === 0 && Number(stats?.fundBalance) < 0 ? true : undefined}>{value}</dd><p>{description}</p></div>)}
      </dl>

      <div className="td-workspace">
        <section className="td-chart-panel" aria-labelledby="td-contributions-title">
          <header><h2 id="td-contributions-title">Monthly contributions</h2><p>{dateRangeLabel} · {last.month} to date.</p></header>
          <ChartContainer config={chartConfig} className="td-contribution-chart" aria-label={`Monthly contributions, ${dateRangeLabel}`}>
            <BarChart accessibilityLayer data={chartData} margin={{ top: 30, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e3e8e5" />
              <XAxis dataKey="month" tickFormatter={month => month.slice(0, 3)} tickLine={false} axisLine={false} tickMargin={12} stroke="#646C78" fontSize={13} interval={0} />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tickMargin={8} width={57} stroke="#646C78" fontSize={12} />
              <ChartTooltip cursor={{ fill: '#F8FBF8' }} content={<ChartTooltipContent formatter={value => money(value)} />} />
              <Bar dataKey="contributions" radius={[6, 6, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                {chartData.map((row, index) => <Cell key={row.fullKey} fill={index === chartData.length - 1 ? '#3E7055' : '#A8C3AF'} />)}
                <LabelList dataKey="contributions" position="top" formatter={compactMoney} fill="#101820" fontSize={12} offset={10} />
              </Bar>
            </BarChart>
          </ChartContainer>
          {!contributions.length && <p className="td-empty" role="status">No contributions recorded yet.</p>}
          <footer className="td-chart-footer"><div><p>Collected in shown period</p><strong>{money(collected)}</strong></div><p>{last.month} is month to date.</p></footer>
        </section>

        <aside className="td-attention" aria-labelledby="td-attention-title">
          <h2 id="td-attention-title">Needs attention</h2>
          <section className="td-attention-item" aria-label="Claims awaiting deduction">
            {claimsError || !claimsCounts ? <p role="status" className="td-status">{claimsError ? 'Unable to load claim counts. Retry using the notice above.' : 'Loading claim counts…'}</p> : <>
              <strong className="td-attention-number">{outstandingClaims.toLocaleString()}</strong>
              <div><h3>Claims awaiting deduction</h3><p>{outstandingClaims ? 'Approved claims ready for member assessment.' : 'No claims pending deduction.'}</p>
                <ActionButton variant="outline" className="td-button" onClick={() => setActiveTab('claims')}>Review claims <ArrowRight size={18} aria-hidden="true" /></ActionButton>
              </div>
            </>}
          </section>
          <section className="td-attention-item" aria-label="Members below minimum">
            <strong className="td-attention-number">{lowBalanceMembers.toLocaleString()}</strong>
            <div><h3>Members below minimum</h3><p>Includes {(stats?.memberStanding?.atRisk || 0).toLocaleString()} at risk and {(stats?.memberStanding?.negativeBalance || 0).toLocaleString()} with negative balances.</p>
              <ActionButton variant="outline" className="td-button" onClick={() => setActiveTab('members')}>View balances <ArrowRight size={18} aria-hidden="true" /></ActionButton>
            </div>
          </section>
        </aside>
      </div>

      <section className="td-member-overview" aria-labelledby="td-members-title">
        <h2 id="td-members-title">Member overview</h2>
        <dl>{[...statusCompositionData.map(item => [`${item.status} members`, item.members]), ['Total members', stats?.totalMembers || 0]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl>
      </section>

      <details className="td-details">
        <summary>More fund insights <ChevronDown size={17} aria-hidden="true" /></summary>
        <p className="td-welcome">Welcome back, {firstName}. Review the fund's financial overview and member insights.</p>
        <div className="td-details-grid">
          <section><h2>Member standing</h2><p>Balance-based categories</p>
            <dl className="td-standing-list">{memberStandingData.map(item => <div key={item.standing}><dt>{MEMBER_STANDING_LABELS[item.standing]}<small>{standingDescriptions[item.standing]}</small></dt><dd>{item.members.toLocaleString()} <span>({memberStandingTotal ? Math.round(item.members / memberStandingTotal * 100) : 0}%)</span></dd></div>)}</dl>
            {!memberStandingData.length && <p>No member standing data available.</p>}
          </section>
          <section><h2 id="td-fund-title">Fund activity</h2><p>All-time claim assessments.</p>
            <dl className="td-standing-list"><div><dt>Total deductions collected<small>One time assessment collected</small></dt><dd>{money(stats?.totalDeductionsCollected || 0)}</dd></div><div><dt>Avg/month</dt><dd>₱{(collected / Math.max(chartData.length, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd></div><div><dt>Transactions</dt><dd>{chartData.reduce((sum, row) => sum + (row.count || 0), 0).toLocaleString()}</dd></div></dl>
            {growthRate !== null && <p className="td-growth">{growthRate >= 0 ? 'Increase' : 'Decrease'} of {Math.abs(growthRate).toFixed(1)}% · Month to date vs full previous month.</p>}
          </section>
          <nav className="td-tools" aria-label="Mortuary workspace"><h2>Workspace</h2>{[
            ['claims', 'Claims', 'Process claim deductions.'],
            ['members', 'Member balances', 'Review balances and member standing.'],
            ['reports', 'Mortuary reports', 'Review fund activity and export records.'],
          ].map(([tab, label, description]) => <button key={tab} onClick={() => setActiveTab(tab)}><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={18} aria-hidden="true" /></button>)}</nav>
        </div>
        <details className="td-chart-data"><summary>View monthly contribution data</summary><div className="td-table-scroll"><table><caption>{dateRangeLabel} · {last.month} to date</caption><thead><tr><th scope="col">Month</th><th scope="col">Contributions</th><th scope="col">Transactions</th></tr></thead><tbody>{chartData.map(row => <tr key={row.fullKey}><th scope="row">{row.month} {row.fullKey.slice(0, 4)}</th><td>{money(row.contributions)}</td><td>{row.count}</td></tr>)}</tbody></table></div></details>
      </details>
    </div>
  );
};

export default Dashboard;
