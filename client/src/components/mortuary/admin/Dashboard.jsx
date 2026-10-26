import { Button as ActionButton } from '../../ui/button';
import { PageHeader, Panel, PanelHeader } from '../../ui/workspace';
import React, { useState, useEffect, useRef } from "react";
import {
  Wallet,
  Users,
  CreditCard,
  Download,
  Bell,
  FilePlus2,
  Clock,
  Banknote,
  ClipboardCheck,
  XCircle,
  CheckCircle2,
  ArrowRight,
  HeartHandshake,
  Leaf,
  CreditCard as PaymentIcon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { reportCsvHeader } from "../../../utils/reportCsvHeader";
import { mortuaryDashboardAPI } from "../../../services/api";
import { getClaimStatusMeta } from "../shared/claimMeta";
import AttendanceMetricGrid from "../../attendance/shared/AttendanceMetricGrid";
import { formatLongDate } from "../../../utils/date";
import "../treasurer/Dashboard.css";
import "./Dashboard.css";
import { getMemberStanding, getStandingLabel } from '../../../utils/memberStanding';

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
    return () => document.removeEventListener("mousedown", handleClick);
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
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
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

const RecentActivities = ({ contributions, onViewAll }) => {
  const activities = [
    ...(contributions || []).slice(0, 3).map((c) => ({
      type: "contribution",
      title: "New Contribution",
      desc: `₱${formatAmount(c.amount)} from ${c.member_name || `Member #${c.member_id}`}`,
      time: c.created_at || c.date,
      status: c.status || "Paid",
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <Card className="td-panel mad-activity-panel shadow-none h-full">
      <CardHeader className="border-b border-slate-100 p-5 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-bold text-slate-900">
          Recent Fund Activity
        </CardTitle>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-coop-green hover:text-coop-darkGreen transition-colors"
          >
            View All
          </button>
        )}
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        {activities.length > 0 ? (
          activities.slice(0, 5).map((act, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${act.type === "contribution" ? "bg-green-50 text-coop-green" : "bg-amber-50 text-amber-600"}`}
              >
                {act.type === "contribution" ? (
                  <PaymentIcon className="w-4 h-4" />
                ) : (
                  <Wallet className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {act.title}
                  </p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${act.type === "contribution" ? "bg-green-50 text-coop-green" : "bg-amber-50 text-amber-700"}`}
                  >
                    {act.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{act.desc}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDateTime(act.time)}
                </p>
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
  <Card className="td-panel mad-activity-panel shadow-none h-full">
    <CardHeader className="border-b border-slate-100 p-5 flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm font-bold text-slate-900">
        Recent Claim Activity
      </CardTitle>
      <button
        onClick={onViewAll}
        className="text-xs font-semibold text-coop-green hover:text-coop-darkGreen transition-colors"
      >
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
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}
              >
                <Icon className={`w-4 h-4 ${meta.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {a.memberName}
                  </p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {a.changedBy || "system"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDateTime(a.changedAt)}
                </p>
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

const Dashboard = ({
  stats,
  contributions,
  members = [],
  setActiveTab,
  user,
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

  const generateFundOverviewData = () => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentYear = new Date().getFullYear();
    const data = months.map((month) => ({ month, collected: 0 }));

    (contributions || []).forEach((c) => {
      const date = new Date(c.created_at || c.date);
      if (date.getFullYear() === currentYear)
        data[date.getMonth()].collected += toAmount(c.amount);
    });

    return data.slice(0, new Date().getMonth() + 1);
  };

  const fundOverviewData = generateFundOverviewData();

  const totalCollected = toAmount(stats?.totalCollected);
  const currentBalance = toAmount(stats?.fundBalance);
  const activeMembers = members.filter(member => member.status === 'active');
  const minimumBalance = stats?.minimumBalance ?? 1000;
  const negativeBalanceCount = activeMembers.filter(member => getMemberStanding(member.currentBalance, minimumBalance) === 'negativeBalance').length;
  const atRiskCount = activeMembers.filter(member => getMemberStanding(member.currentBalance, minimumBalance) === 'atRisk').length;

  /* Claim-specific total (death-fund assessment collected) - iba ito sa
  member-contribution figures sa taas. */
  const totalDeductionsCollected = toAmount(
    claimCounts.totalDeductionsCollected,
  );

  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data
      .map((obj) =>
        Object.values(obj)
          .map((val) =>
            typeof val === "string"
              ? `"${String(val).replace(/"/g, '""')}"`
              : val,
          )
          .join(","),
      )
      .join("\n");
    const header = reportCsvHeader({
      title: "Mortuary Member Report",
      program: "Mortuary Aid Fund Program",
      scope: "All members with their current balance and standing.",
      metadata: ["Records", `${data.length} members`],
    });
    // A Blob with a BOM (instead of a data: URI) keeps ₱ and "#" intact in Excel.
    const url = URL.createObjectURL(
      new Blob([`${String.fromCharCode(0xfeff)}${header}${headers}\r\n${rows}`], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const quickActions = [
    {
      icon: FilePlus2,
      label: "Register New Claim",
      desc: "File a new claim request",
      tab: "claims",
    },
    {
      icon: Clock,
      label: "View Pending Claims",
      desc: "Review claims for approval",
      tab: "claims",
    },
    {
      icon: HeartHandshake,
      label: "Beneficiaries",
      desc: "Manage claim beneficiaries",
      tab: "beneficiaries",
    },
  ];

  const firstName = user?.name?.split(" ")[0] || "Claims Officer";

  return (
    <div className="treasurer-dashboard mortuary-admin-dashboard">
      <PageHeader className="td-header">
        <div>
          <p className="td-eyebrow">Mortuary management / Overview</p>
          <h1>Mortuary dashboard</h1>
          <p className="td-description">{formatLongDate(new Date())} <span>· Philippine time</span></p>
        </div>
        <div className="td-header-actions">
          <ActionButton variant="outline" className="td-button" onClick={() => exportToCSV(members.map(member => ({ ...member, standing: getStandingLabel(member.currentBalance, minimumBalance) })), "mortuary_report")} disabled={!members.length}>
            <Download size={15} aria-hidden="true" /> Export report
          </ActionButton>
          <ActionButton variant="default" className="td-button td-primary" onClick={() => setActiveTab("claims")}>
            Manage claims <ArrowRight size={15} aria-hidden="true" />
          </ActionButton>
          <NotificationBell items={needsAttention} count={needsAttentionCount} onViewAll={() => setActiveTab("claims")} />
        </div>
      </PageHeader>

      <AttendanceMetricGrid label="Mortuary fund overview" items={[
        ["Total fund balance", `₱${currentBalance.toLocaleString()}`, "Available balance", Wallet],
        ["Active members", formatAmount(stats?.activeMembers), "Currently contributing", Users],
        ["Total collected", `₱${totalCollected.toLocaleString()}`, "All-time member contributions", CreditCard],
        ["At Risk", atRiskCount.toLocaleString(), `Active members with PHP 0 to below PHP ${minimumBalance.toLocaleString()}`, Clock],
        ["Negative Balance", negativeBalanceCount.toLocaleString(), "Active members with a balance below PHP 0", XCircle],
      ]} />
      <p className="td-overview">Welcome back, {firstName}. Review the fund's financial overview and manage member claims.</p>

      <div className="td-workspace">
        <div className="td-main">
        <Card className="td-panel mad-fund-panel shadow-none">
          <CardHeader className="p-5 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-coop-green" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Fund Overview
                </CardTitle>
              </div>
              <span className="text-xs font-medium text-slate-400">
                This Year
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-xs font-semibold text-slate-500 mb-3">
              Monthly Collections
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-coop-green inline-block" />{" "}
                Collected
              </span>
            </div>

            {fundOverviewData.length > 0 ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundOverviewData} barGap={3}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : v)}
                      width={32}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                      formatter={(value) => [
                        `₱${value.toLocaleString()}`,
                        "Collected",
                      ]}
                    />
                    <Bar
                      dataKey="collected"
                      fill="#2D7A3E"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-slate-400">No fund data available</p>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Fund Summary
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Collected</span>
                <span className="font-semibold text-slate-900">
                  ₱{totalCollected.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm bg-green-50 -mx-2 px-2 py-2.5 rounded-lg">
                <span className="font-semibold text-coop-green">
                  Current Balance
                </span>
                <span className="font-bold text-coop-green">
                  ₱{currentBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
          <div className="mad-activity-grid">
            <RecentActivities contributions={contributions} />
            <RecentClaimActivities activities={recentClaimActivities} onViewAll={() => setActiveTab("claims")} />
          </div>
        </div>

        <aside className="td-sidebar" aria-label="Claims overview">
          <Panel as="section" className="td-panel" aria-labelledby="mad-claims-title">
            <PanelHeader as="div" className="td-panel-heading">
              <h2 id="mad-claims-title">Claims overview</h2>
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
              <div><dt><TrendingUp size={15} aria-hidden="true" />Total deductions collected</dt><dd>₱{totalDeductionsCollected.toLocaleString()}</dd><small>One time assessment collected</small></div>
            </dl>
            <button className="mad-panel-link" onClick={() => setActiveTab("claims")}>View claims <ArrowRight size={15} aria-hidden="true" /></button>
          </Panel>

          <nav className="td-tools" aria-label="Claims workspace">
            <h2>Workspace</h2>
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => setActiveTab(action.tab)}>
                <span><strong>{action.label}</strong><small>{action.desc}</small></span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
