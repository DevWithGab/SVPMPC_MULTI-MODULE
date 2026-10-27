import { Button as ActionButton } from '../../ui/button';
import { Panel, PanelHeader } from '../../ui/workspace';
import React, { useState, useEffect, useRef } from "react";
import {
  Wallet,
  Bell,
  Users,
  Clock,
  Banknote,
  ClipboardCheck,
  XCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { mortuaryDashboardAPI } from "../../../services/api";
import { getClaimStatusMeta } from "../shared/claimMeta";
import { formatLongDate } from "../../../utils/date";
import MonthlyDeductionsChart from '../shared/MonthlyDeductionsChart';
import "../treasurer/Dashboard.css";
import "./Dashboard.css";
import { getMemberStanding } from '../../../utils/memberStanding';

// ---- Local presentational pieces -------------------------------------

const toAmount = (value) => Number(value) || 0;
const formatAmount = (value) => toAmount(value).toLocaleString();

const getActivityIcon = (status) => {
  switch (status) {
    case "released":
    case "approved":
      return CheckCircle2;
    case "rejected":
      return XCircle;
    case "pending_deduction":
    case "deduction_processed":
      return Banknote;
    default:
      return Clock;
  }
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const NotificationBell = ({ items, count, onViewAll }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    const handleKey = event => { if (event.key === 'Escape' && ref.current?.querySelector('.mad-notification-menu')) { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener('keydown', handleKey); };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <ActionButton variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="td-button mad-notification-button relative"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-coop-green text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </ActionButton>

      {open && (
        <div className="mad-notification-menu absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">Needs Attention</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Claims awaiting review or processing
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((a, i) => {
                const meta = getClaimStatusMeta(a.status);
                return (
                  <div key={i} className="p-3.5 flex items-start gap-3">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {a.memberName}
                      </p>
                      <p className="text-[11px] text-slate-400">{meta.label}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="p-4 text-xs text-slate-400 text-center">
                You're all caught up.
              </p>
            )}
          </div>
          {onViewAll && (
            <button
              onClick={() => {
                setOpen(false);
                onViewAll();
              }}
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

const RecentClaimActivities = ({ activities, onViewAll }) => (
  <section className="mad-recent-claims" aria-labelledby="mad-recent-claims-title">
    <header className="mad-recent-heading">
      <div><h2 id="mad-recent-claims-title">Recent Claim Activity</h2><p>Latest updates to member claims</p></div>
      <ActionButton variant="outline" className="td-button" onClick={onViewAll}>View all claims <ArrowRight size={17} aria-hidden="true" /></ActionButton>
    </header>
    {activities.length > 0 ? <div className="mad-recent-scroll" role="region" aria-label="Recent claim updates" tabIndex={0}>
      <table className="mad-recent-table">
        <caption className="sr-only">The five most recent claim updates, newest first</caption>
        <thead><tr><th scope="col">Member / claim</th><th scope="col">Status</th><th scope="col">Updated by</th><th scope="col">Date & time</th></tr></thead>
        <tbody>{activities.slice(0, 5).map((activity, index) => {
          const meta = getClaimStatusMeta(activity.status);
          const Icon = getActivityIcon(activity.status);
          return <tr key={`${activity.claimId || 'claim'}-${activity.changedAt}-${index}`}>
            <td><div className="mad-recent-member"><span className="mad-recent-icon"><Icon size={18} aria-hidden="true" /></span><div><strong>{activity.memberName || 'Unknown member'}</strong>{activity.claimId && <span className="mad-recent-reference">{activity.claimId}</span>}</div></div></td>
            <td><span className="mad-recent-badge" data-status={activity.status}><span aria-hidden="true" />{meta.label}</span></td>
            <td className="mad-recent-author">{activity.changedBy || 'System'}</td>
            <td className="mad-recent-date"><time dateTime={activity.changedAt}>{formatDateTime(activity.changedAt)}</time></td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <div className="mad-recent-empty" role="status"><ClipboardCheck size={28} aria-hidden="true" /><p>No claim activity yet</p><span>Claim updates will appear here as they are processed.</span></div>}
  </section>
);
const Dashboard = ({
  stats,
  members = [],
  setActiveTab,
  showToast,
}) => {
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    mortuaryDashboardAPI
      .getAdminDashboard()
      .then((res) => {
        if (!cancelled) setAdminData(res?.data || null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error fetching mortuary admin dashboard data:", error);
        showToast?.(
          "Couldn't load claims and fund activity. Please refresh the page.",
          "error"
        );
      });
    return () => {
      cancelled = true;
    };
    /* Hindi memoized ng caller nito yung showToast (addToast from
    useToast()), kaya yung bagong reference sa every render ay dapat hindi
    mag re-trigger ulit nitong fetch. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimCounts = adminData?.claims || {};
  const recentClaimActivities = adminData?.recentClaimActivities || [];
  /* Base sa current status ng each claim (server-filtered), hindi sa
  pag-scan sa historical activity log sa taas - yung claim na nalipat na
  (o na-release na) ay may luma pa ring "pending" entries sa log na yun,
  na nagpapalabas ng already-resolved claims sa notification bell. */
  const needsAttention = adminData?.claimsNeedingAttention || [];
  const needsAttentionCount =
    (claimCounts.pending_requirements || 0) +
    (claimCounts.pending_deduction || 0);


  const currentBalance = toAmount(stats?.fundBalance);
  const activeMembers = members.filter(member => member.status === 'active');
  const statusData = [
    { status: 'Active', members: members.filter(member => member.status === 'active').length, color: '#357456' },
    { status: 'Inactive', members: members.filter(member => member.status === 'inactive').length, color: '#d4a34c' },
    { status: 'Deceased', members: members.filter(member => member.status === 'deceased').length, color: '#8996a5' },
  ];
  const statusTotal = statusData.reduce((sum, item) => sum + item.members, 0);
  const metricIcons = [Wallet, Users, Banknote];
  const minimumBalance = stats?.minimumBalance ?? 1000;
  const negativeBalanceCount = activeMembers.filter(member => getMemberStanding(member.currentBalance, minimumBalance) === 'negativeBalance').length;
  const atRiskCount = activeMembers.filter(member => getMemberStanding(member.currentBalance, minimumBalance) === 'atRisk').length;
  const standingData = [
    { standing: 'atRisk', members: atRiskCount, fill: 'var(--color-atRisk)', label: 'At Risk', description: `Active members with PHP 0 to below PHP ${minimumBalance.toLocaleString()}` },
    { standing: 'negativeBalance', members: negativeBalanceCount, fill: 'var(--color-negativeBalance)', label: 'Negative Balance', description: 'Active members with a balance below PHP 0' },
  ];
  const standingTotal = atRiskCount + negativeBalanceCount;
  const standingConfig = {
    members: { label: 'Members' },
    atRisk: { label: 'At Risk', color: '#d4a34c' },
    negativeBalance: { label: 'Negative Balance', color: '#a64b4b' },
  };

  /* Claim-specific total (death-fund assessment collected) - iba ito sa
  member-contribution figures sa taas. */
  const totalDeductionsCollected = toAmount(
    claimCounts.totalDeductionsCollected,
  );

  return (
    <div className="treasurer-dashboard mortuary-admin-dashboard">
      <p className="td-eyebrow"><span>Mortuary management</span><span aria-hidden="true">/</span><strong>Dashboard</strong></p>
      <header className="td-header">
        <div>
          <h1>Dashboard</h1>
          <p className="td-description">{formatLongDate(new Date())} <span>· Philippine time</span></p>
        </div>
        <div className="td-header-actions">

          <ActionButton variant="default" className="td-button td-primary" onClick={() => setActiveTab("claims")}>
            Manage claims <ArrowRight size={15} aria-hidden="true" />
          </ActionButton>
          <NotificationBell items={needsAttention} count={needsAttentionCount} onViewAll={() => setActiveTab("claims")} />
        </div>
      </header>

      <dl className="td-metrics mad-metrics" aria-label="Mortuary fund overview">
        {[
          ["Total fund balance", `₱${currentBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Available balance"],
          ["Active members", formatAmount(stats?.activeMembers), "Currently contributing"],
          ["Pending deductions", adminData ? formatAmount(claimCounts.pending_deduction) : '—', "Claims awaiting deduction"],
        ].map(([label, value, detail], index) => {
          const Icon = metricIcons[index];
          return <div key={label} className={`td-stat-card td-stat-card-${index}`}><dt><span>{label}</span><span className="td-stat-icon"><Icon size={19} aria-hidden="true" /></span></dt><dd data-negative={index === 0 && currentBalance < 0 ? true : undefined}>{value}</dd><p>{detail}</p></div>;
        })}
      </dl>

      <div className="td-workspace">
        <div className="td-main">
        <MonthlyDeductionsChart deductions={adminData?.monthlyDeductions || []} />
        </div>

        <aside className="td-sidebar td-attention" aria-label="Claims overview">
          <Panel as="section" className="td-panel" aria-labelledby="mad-claims-title">
            <PanelHeader as="div" className="td-panel-heading">
              <h2 id="mad-claims-title">Needs attention</h2>
              <p>Review pending requirements and track claim outcomes.</p>
            </PanelHeader>
            <div className="mad-claim-list">
              {[
                ["Pending requirements", claimCounts.pending_requirements, Clock, "amber"],
                ["Pending deduction", claimCounts.pending_deduction, Banknote, "blue"],
                ["Deductions processed", (claimCounts.deduction_processed || 0) + (claimCounts.released || 0), ClipboardCheck, "green"],
                ["Claims rejected", claimCounts.rejected, XCircle, "rose"],
              ].map(([label, count, Icon, tone]) => (
                <button key={label} onClick={() => setActiveTab("claims")}>
                  <span className={`mad-claim-icon mad-tone-${tone}`}>{React.createElement(Icon, { size: 16, "aria-hidden": true })}</span>
                  <span>{label}</span>
                  <strong>{formatAmount(count)}</strong>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel as="section" className="td-panel" aria-labelledby="mad-fund-title">
            <PanelHeader as="div" className="td-panel-heading"><h2 id="mad-fund-title">Fund activity</h2><p>All-time claim assessments.</p></PanelHeader>
            <dl className="td-fund-totals">
              <div><dt><TrendingUp size={15} aria-hidden="true" />Total deductions collected</dt><dd>₱{totalDeductionsCollected.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
            </dl>
          </Panel>

        </aside>
      </div>

      <div className="mad-member-panels">
      <section className="td-member-overview" aria-labelledby="mad-members-title">
        <header className="td-overview-heading"><div><h2 id="mad-members-title">Member overview</h2><p>Membership by current status</p></div><span className="td-total-badge">{members.length.toLocaleString()} total members</span></header>
        <div className="td-overview-body">
          <div className="td-member-graph" role="img" aria-label={`Member status distribution: ${statusData.map(item => `${item.members} ${item.status.toLowerCase()}`).join(', ')}`}>
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="76" fill="none" stroke="#edf1ee" strokeWidth="24" />
              {statusData.map((item, index) => {
                const circumference = 2 * Math.PI * 76;
                const preceding = statusData.slice(0, index).reduce((sum, entry) => sum + entry.members, 0);
                return <circle key={item.status} cx="100" cy="100" r="76" fill="none" stroke={item.color} strokeWidth="24" strokeDasharray={`${statusTotal ? item.members / statusTotal * circumference : 0} ${circumference}`} strokeDashoffset={statusTotal ? -preceding / statusTotal * circumference : 0} transform="rotate(-90 100 100)" />;
              })}
              <text x="100" y="99" textAnchor="middle" className="td-donut-value">{statusTotal.toLocaleString()}</text>
              <text x="100" y="121" textAnchor="middle" className="td-donut-label">members</text>
            </svg>
          </div>
          <dl className="td-status-list">{statusData.map(item => <div key={item.status}><dt><span className="td-status-dot" style={{ backgroundColor: item.color }} />{item.status} members</dt><dd>{item.members.toLocaleString()}<span>{statusTotal ? Math.round(item.members / statusTotal * 100) : 0}%</span></dd><div className="td-status-track" aria-hidden="true"><span style={{ width: `${statusTotal ? item.members / statusTotal * 100 : 0}%`, backgroundColor: item.color }} /></div></div>)}</dl>
        </div>
        {!statusTotal && <p className="td-empty">No member data available yet.</p>}
      </section>
      <section className="td-member-overview mad-standing-overview" aria-labelledby="mad-standing-title">
        <header className="td-overview-heading"><div><h2 id="mad-standing-title">Member standing</h2><p>Active members below the minimum balance</p></div><span className="td-total-badge">{standingTotal.toLocaleString()} members below minimum</span></header>
        <div className="mad-standing-body">
          {standingTotal > 0 ? <ChartContainer config={standingConfig} className="mad-standing-chart" role="img" aria-label={`Member standing: ${atRiskCount} at risk, ${negativeBalanceCount} with negative balances`}>
            <PieChart accessibilityLayer>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="standing" formatter={(value, name) => <span>{standingConfig[name]?.label || name}: {Number(value).toLocaleString()} members ({Math.round(Number(value) / standingTotal * 100)}%)</span>} />} />
              <Pie data={standingData.filter(item => item.members > 0)} dataKey="members" nameKey="standing" outerRadius="85%" stroke="#fff" strokeWidth={2} isAnimationActive={false} />
            </PieChart>
          </ChartContainer> : <p className="td-empty mad-standing-empty" role="status">No active members below minimum.</p>}
          <dl className="mad-standing-legend">{standingData.map(item => <div key={item.standing}><dt><span className={`mad-standing-dot mad-standing-dot-${item.standing}`} />{item.label}</dt><dd>{item.members.toLocaleString()} <span>({standingTotal ? Math.round(item.members / standingTotal * 100) : 0}%)</span></dd><p>{item.description}</p></div>)}</dl>
        </div>
      </section>
      </div>
      <div className="mad-activity-grid">
        <RecentClaimActivities activities={recentClaimActivities} onViewAll={() => setActiveTab("claims")} />
      </div>
    </div>
  );
};

export default Dashboard;
