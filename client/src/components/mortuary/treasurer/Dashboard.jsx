import { Button as ActionButton } from '../../ui/button';
import { deductionTrend } from '../../../utils/dashboardMetrics';
import { ArrowRight, RefreshCw, Wallet, Users, TriangleAlert, ShieldCheck } from 'lucide-react';
import MonthlyDeductionsChart from '../shared/MonthlyDeductionsChart';
import { Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';

import { formatLongDate } from '../../../utils/date';
import { MEMBER_STANDING_LABELS } from '../../../utils/memberStanding';
import './Dashboard.css';

const money = (value = 0) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Dashboard = ({ stats, deductions = [], claimsCounts, claimsError, setActiveTab, onRefresh, refreshing = false }) => {
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
  const standingColors = { excellent: '#174b38', good: '#357456', fair: '#8996a5', atRisk: '#d4a34c', negativeBalance: '#a64b4b' };
  const standingConfig = Object.fromEntries(Object.entries(standingColors).map(([key, color]) => [key, { label: MEMBER_STANDING_LABELS[key], color }]));
  const standingChartData = memberStandingData.map(item => ({ ...item, fill: `var(--color-${item.standing})` }));
  const statusCompositionData = [
    { status: 'Active', members: stats?.statusComposition?.active ?? stats?.activeMembers ?? 0, color: '#357456' },
    { status: 'Inactive', members: stats?.statusComposition?.inactive ?? stats?.inactiveMembers ?? 0, color: '#d4a34c' },
    { status: 'Deceased', members: stats?.statusComposition?.deceased ?? stats?.deceasedMembers ?? 0, color: '#8996a5' },
  ];
  const chartData = deductionTrend(deductions);
  const collected = chartData.reduce((sum, row) => sum + row.deductions, 0);
  const outstandingClaims = claimsCounts?.pendingDeduction ?? 0;
  const activeMembers = stats?.activeMembers || 0;
  const lowBalanceMembers = stats?.lowBalanceMembers || 0;
  const coveredMembers = activeMembers - Math.min(activeMembers, Math.max(0, lowBalanceMembers));

  const compositionTotal = statusCompositionData.reduce((sum, item) => sum + item.members, 0);
  const metricIcons = [Wallet, Users, TriangleAlert, ShieldCheck];

  return (
    <div className="treasurer-dashboard" aria-busy={refreshing}>
      <p className="td-eyebrow">Mortuary management <span aria-hidden="true">/</span> <strong>Dashboard</strong></p>
      <header className="td-header">
        <div><h1>Dashboard</h1><p className="td-description">{formatLongDate(new Date())} · Philippine time</p></div>
        <div className="td-header-actions">
          <ActionButton tooltip="Reload the latest fund totals and claim counts." variant="outline" className="td-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</ActionButton>
          <ActionButton tooltip="Find a member and review their deposits, deductions, and running balance." className="td-button td-primary" onClick={() => setActiveTab('ledger')}>Open member ledger <ArrowRight size={19} aria-hidden="true" /></ActionButton>
        </div>
      </header>

      <dl className="td-metrics" aria-label="Mortuary fund overview">
        {[
          ['Active member balances', money(stats?.fundBalance || 0), 'Sum of active member ledgers'],
          ['Active members', activeMembers.toLocaleString(), 'Currently contributing'],
          ['Below minimum', lowBalanceMembers.toLocaleString(), `Balances below ₱${minimumBalance.toLocaleString()}`],
          ['At or above minimum', coveredMembers.toLocaleString(), `${coveredMembers.toLocaleString()} of ${activeMembers.toLocaleString()} active members`],
        ].map(([label, value, description], index) => {
          const Icon = metricIcons[index];
          return <div key={label} className={`td-stat-card td-stat-card-${index}`}><dt><span>{label}</span><span className="td-stat-icon"><Icon size={19} aria-hidden="true" /></span></dt><dd data-negative={index === 0 && Number(stats?.fundBalance) < 0 ? true : undefined}>{value}</dd><p>{description}</p></div>;
        })}
      </dl>

      <div className="td-workspace">
        <MonthlyDeductionsChart deductions={deductions} />

        <aside className="td-attention" aria-labelledby="td-attention-title">
          <h2 id="td-attention-title">Needs attention</h2>
          <section className="td-attention-item" aria-label="Claims awaiting deduction">
            {claimsError || !claimsCounts ? <p role="status" className="td-status">{claimsError ? 'Unable to load claim counts. Retry using the notice above.' : 'Loading claim counts…'}</p> : <>
              <strong className="td-attention-number">{outstandingClaims.toLocaleString()}</strong>
              <div><h3>Claims awaiting deduction</h3><p>{outstandingClaims ? 'Approved claims ready for member assessment.' : 'No claims pending deduction.'}</p>
                <ActionButton tooltip="Review approved claims awaiting deduction." variant="outline" className="td-button" onClick={() => setActiveTab('claims')}>Review claims <ArrowRight size={18} aria-hidden="true" /></ActionButton>
              </div>
            </>}
          </section>
          <section className="td-attention-item" aria-label="Members below minimum">
            <strong className="td-attention-number">{lowBalanceMembers.toLocaleString()}</strong>
            <div><h3>Members below minimum</h3><p>Includes {(stats?.memberStanding?.atRisk || 0).toLocaleString()} at risk and {(stats?.memberStanding?.negativeBalance || 0).toLocaleString()} with negative balances.</p>
              <ActionButton tooltip="Review member balances and identify accounts needing attention." variant="outline" className="td-button" onClick={() => setActiveTab('members')}>View balances <ArrowRight size={18} aria-hidden="true" /></ActionButton>
            </div>
          </section>
        </aside>
      </div>

      <div className="td-member-panels">
      <section className="td-member-overview" aria-labelledby="td-members-title">
        <header className="td-overview-heading"><div><h2 id="td-members-title">Member overview</h2><p>Membership by current status</p></div><span className="td-total-badge">{(stats?.totalMembers ?? compositionTotal).toLocaleString()} total members</span></header>
        <div className="td-overview-body">
          <div className="td-member-graph" role="img" aria-label={`Member status distribution: ${statusCompositionData.map(item => `${item.members} ${item.status.toLowerCase()}`).join(', ')}`}>
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="76" fill="none" stroke="#edf1ee" strokeWidth="24" />
              {statusCompositionData.map((item, index) => {
                const circumference = 2 * Math.PI * 76;
                const preceding = statusCompositionData.slice(0, index).reduce((sum, entry) => sum + entry.members, 0);
                return <circle key={item.status} cx="100" cy="100" r="76" fill="none" stroke={item.color} strokeWidth="24" strokeDasharray={`${compositionTotal ? item.members / compositionTotal * circumference : 0} ${circumference}`} strokeDashoffset={compositionTotal ? -preceding / compositionTotal * circumference : 0} transform="rotate(-90 100 100)" />;
              })}
              <text x="100" y="99" textAnchor="middle" className="td-donut-value">{compositionTotal.toLocaleString()}</text>
              <text x="100" y="121" textAnchor="middle" className="td-donut-label">members</text>
            </svg>
          </div>
          <dl className="td-status-list">{statusCompositionData.map(item => <div key={item.status}><dt><span className="td-status-dot" style={{ backgroundColor: item.color }} />{item.status} members</dt><dd>{item.members.toLocaleString()}<span>{compositionTotal ? Math.round(item.members / compositionTotal * 100) : 0}%</span></dd><div className="td-status-track" aria-hidden="true"><span style={{ width: `${compositionTotal ? item.members / compositionTotal * 100 : 0}%`, backgroundColor: item.color }} /></div></div>)}</dl>
        </div>
        {!compositionTotal && <p className="td-empty">No member data available yet.</p>}
      </section>

      <section className="td-member-overview td-standing-overview" aria-labelledby="td-standing-title">
        <header className="td-overview-heading"><div><h2 id="td-standing-title">Member standing</h2><p>Members grouped by ledger balance</p></div><span className="td-total-badge">{memberStandingTotal.toLocaleString()} active members</span></header>
        <div className="td-standing-body">
          {memberStandingTotal > 0 ? <ChartContainer config={standingConfig} className="td-standing-chart" role="img" aria-label={`Member standing: ${memberStandingData.map(item => `${item.members} ${MEMBER_STANDING_LABELS[item.standing]}`).join(', ')}`}>
            <PieChart accessibilityLayer>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="standing" formatter={(value, name) => <span>{standingConfig[name]?.label || name}: {Number(value).toLocaleString()} members ({Math.round(Number(value) / memberStandingTotal * 100)}%)</span>} />} />
              <Pie data={standingChartData} dataKey="members" nameKey="standing" outerRadius="85%" stroke="#fff" strokeWidth={2} isAnimationActive={false} />
            </PieChart>
          </ChartContainer> : <p className="td-empty" role="status">No member standing data available.</p>}
          <dl className="td-standing-legend">{memberStandingData.map(item => <div key={item.standing}><dt><span style={{ backgroundColor: standingColors[item.standing] }} />{MEMBER_STANDING_LABELS[item.standing]}</dt><dd>{item.members.toLocaleString()} <span>({memberStandingTotal ? Math.round(item.members / memberStandingTotal * 100) : 0}%)</span></dd><p>{standingDescriptions[item.standing]}</p></div>)}</dl>
        </div>
      </section>
      </div>

      <section className="td-details" aria-labelledby="td-fund-title">
        <div className="td-details-grid">
          <section className="td-insight-card"><h3 id="td-fund-title">Fund activity</h3><p>Claim assessments and collections</p>
            <dl className="td-standing-list"><div><dt>Total deductions collected<small>One time assessment collected</small></dt><dd>{money(stats?.totalDeductionsCollected || 0)}</dd></div><div><dt>Avg/month</dt><dd>₱{(collected / Math.max(chartData.length, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd></div><div><dt>Claims deducted</dt><dd>{chartData.reduce((sum, row) => sum + (row.count || 0), 0).toLocaleString()}</dd></div></dl>
          </section>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
