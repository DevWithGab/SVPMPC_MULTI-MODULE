import React, { useState, useEffect, useMemo } from 'react';
import { Download, TrendingUp, Users, PhilippinePeso, FileText, ClipboardCheck, Heart, AlertTriangle, Receipt } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { treasurerAPI } from '../../../services/api';
import { getClaimStatusMeta } from '../shared/claimMeta';
import { createMortuaryReportPdf, loadReportLogo, negativeBalanceMembers, reportAmount } from '../../../utils/mortuaryReportPdf';
import { loadAllPages } from '../../../utils/loadAllPages';


const REPORT_TYPES = [
  { id: 'summary', label: 'Financial Summary', icon: FileText },
  { id: 'contributions', label: 'Contributions', icon: TrendingUp },
  { id: 'claims', label: 'Claims Report', icon: ClipboardCheck },
  { id: 'deceasedMembers', label: 'Deceased Members', icon: Heart },
  { id: 'negativeBalances', label: 'Negative Balances', icon: AlertTriangle },
  { id: 'memberStanding', label: 'Member Standing', icon: AlertTriangle },
  { id: 'deductions', label: 'Deductions & Payouts', icon: Receipt },
];

// Mirrors the balance thresholds used server-side in dashboardController.js
// so this report's categories match the Member Standing pie chart on the
// dashboard exactly.
const STANDING_THRESHOLDS = { excellent: 10000, good: 5000, fair: 1000 };
const getStandingLabel = (balance) => {
  const value = balance ?? 0;
  if (value >= STANDING_THRESHOLDS.excellent) return 'Excellent';
  if (value >= STANDING_THRESHOLDS.good) return 'Good';
  if (value >= STANDING_THRESHOLDS.fair) return 'Fair';
  return 'At Risk';
};
const STANDING_BADGE_STYLES = {
  Excellent: 'bg-green-50 text-green-700 border-green-200',
  Good: 'bg-blue-50 text-blue-700 border-blue-200',
  Fair: 'bg-amber-50 text-amber-700 border-amber-200',
  'At Risk': 'bg-red-50 text-red-700 border-red-200',
};

// 'YYYY-MM' for monthly, 'YYYY' for annually — sorts correctly as plain
// strings, which is why month is zero-padded.
const getPeriodKey = (dateValue, granularity) => {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  if (granularity === 'annually') return String(d.getFullYear());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatPeriodLabel = (key, granularity) => {
  if (granularity === 'annually') return key;
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const Reports = ({ contributions = [], stats = {}, members = [], membersLoading = false, membersError = null }) => {
  const [reportType, setReportType] = useState('summary');
  const [summaryPeriod, setSummaryPeriod] = useState('monthly'); // 'monthly' | 'annually'
  const [barangayFilter, setBarangayFilter] = useState('all');
  const { page, limit, setPage } = usePagination(1, 10);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [barangayFilter, reportType, setPage]);

  useEffect(() => {
    let cancelled = false;
    loadAllPages(page => treasurerAPI.getAllClaims({ page, limit: 100 }))
      .then(records => { if (!cancelled) setClaims(records); })
      .catch(() => { if (!cancelled) setClaimsError('Unable to load all claims. Reload the Reports page before exporting.'); })
      .finally(() => { if (!cancelled) setClaimsLoading(false); });
    return () => {
      cancelled = true;
    };
  }, []);

  const negativeMembers = useMemo(() => negativeBalanceMembers(members), [members]);
  const needsClaims = ['summary', 'claims', 'deductions'].includes(reportType);
  const reportLoading = membersLoading || (needsClaims && claimsLoading);
  const reportError = membersError || (needsClaims ? claimsError : '');
  const exportDisabled = exporting || reportLoading || !!reportError;

  // Contributions and claims don't carry a barangay of their own — only the
  // member record does — so every other report type (everything except
  // Financial Summary, which is a fund-wide total and deliberately stays
  // unscoped) resolves it through this memberId -> barangay lookup.
  const barangayByMemberId = useMemo(() => {
    const map = new Map();
    members.forEach((m) => {
      const id = m.id || m.memberId;
      if (id) map.set(String(id), m.barangay || '');
    });
    return map;
  }, [members]);

  const barangayOptions = useMemo(
    () => [...new Set(members.map((m) => m.barangay).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [members],
  );

  const matchesBarangay = (barangay) => barangayFilter === 'all' || barangay === barangayFilter;

  const deceasedMembers = useMemo(() => members.filter((m) => m.status === 'deceased'), [members]);

  // Active members ranked worst-balance-first so the treasurer can act on
  // the ones nearest a balance notice without re-sorting.
  const memberStandingList = useMemo(() => {
    return members
      .filter((m) => m.status === 'active')
      .map((m) => ({
        id: m.id || m.memberId,
        name: m.name || m.memberName,
        barangay: m.barangay || 'N/A',
        balance: m.currentBalance ?? 0,
        standing: getStandingLabel(m.currentBalance),
      }))
      .sort((a, b) => a.balance - b.balance);
  }, [members]);

  // Per-claim deduction/payout line items — richer than a single aggregate
  // total since it shows exactly which claims funded the collected amount.
  const deductionsData = useMemo(() => {
    return claims.map((c) => ({
      claimId: c.claimId,
      memberId: c.memberId,
      memberName: c.memberName,
      status: c.status,
      deductionCollected: c.deduction?.totalCollected || 0,
      deductionDate: c.deduction?.processedAt || null,
      payoutAmount: c.payout?.amount || 0,
      payoutDate: c.payout?.releasedAt || null,
    }));
  }, [claims]);

  // Filtered-by-barangay versions of every non-summary report's data.
  // Financial Summary intentionally keeps reading the unfiltered arrays
  // above (contributions, claims, deductionsData, members) everywhere else
  // in this file.
  const filteredContributions = useMemo(
    () => (barangayFilter === 'all' ? contributions : contributions.filter((c) => matchesBarangay(barangayByMemberId.get(String(c.member_id))))),
    [contributions, barangayFilter, barangayByMemberId],
  );
  const filteredClaims = useMemo(
    () => (barangayFilter === 'all' ? claims : claims.filter((c) => matchesBarangay(barangayByMemberId.get(String(c.memberId))))),
    [claims, barangayFilter, barangayByMemberId],
  );
  const filteredDeceasedMembers = useMemo(
    () => (barangayFilter === 'all' ? deceasedMembers : deceasedMembers.filter((m) => matchesBarangay(m.barangay))),
    [deceasedMembers, barangayFilter],
  );
  const filteredMemberStandingList = useMemo(
    () => (barangayFilter === 'all' ? memberStandingList : memberStandingList.filter((m) => matchesBarangay(m.barangay))),
    [memberStandingList, barangayFilter],
  );
  const filteredNegativeMembers = useMemo(
    () => (barangayFilter === 'all' ? negativeMembers : negativeMembers.filter((m) => matchesBarangay(m.barangay))),
    [negativeMembers, barangayFilter],
  );
  const filteredTotalShortfall = useMemo(
    () => Math.round(filteredNegativeMembers.reduce((sum, member) => sum - member.balance, 0) * 100) / 100,
    [filteredNegativeMembers],
  );
  const filteredDeductionsData = useMemo(
    () => (barangayFilter === 'all' ? deductionsData : deductionsData.filter((c) => matchesBarangay(barangayByMemberId.get(String(c.memberId))))),
    [deductionsData, barangayFilter, barangayByMemberId],
  );

  // Financial Summary's Monthly/Annually breakdown — each period bucket
  // sums contributions by payment date, deductions by when they were
  // processed, and payouts by when they were released (each can land in a
  // different period than when the claim itself was filed).
  const periodBreakdown = useMemo(() => {
    const buckets = new Map();
    const ensure = (key) => {
      if (!buckets.has(key)) {
        buckets.set(key, { period: key, contributions: 0, deductionsCollected: 0, payoutsReleased: 0 });
      }
      return buckets.get(key);
    };

    contributions.forEach((c) => {
      const key = getPeriodKey(c.payment_date || c.created_at, summaryPeriod);
      if (key) ensure(key).contributions += c.amount || 0;
    });

    deductionsData.forEach((c) => {
      if (c.deductionCollected) {
        const key = getPeriodKey(c.deductionDate, summaryPeriod);
        if (key) ensure(key).deductionsCollected += c.deductionCollected;
      }
      if (c.payoutAmount) {
        const key = getPeriodKey(c.payoutDate, summaryPeriod);
        if (key) ensure(key).payoutsReleased += c.payoutAmount;
      }
    });

    return Array.from(buckets.values())
      .sort((a, b) => (a.period < b.period ? 1 : -1))
      .map((row) => ({
        ...row,
        label: formatPeriodLabel(row.period, summaryPeriod),
      }));
  }, [contributions, deductionsData, summaryPeriod]);

  const metrics = useMemo(() => {
    const totalContributions = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalDeductionsCollected = deductionsData.reduce((sum, c) => sum + c.deductionCollected, 0);
    const totalPayoutsReleased = deductionsData.reduce((sum, c) => sum + c.payoutAmount, 0);
    return {
      totalContributions,
      totalDeductionsCollected,
      totalPayoutsReleased,
      activeMembers: members.filter(m => m.status === 'active').length,
      inactiveMembers: members.filter(m => m.status === 'inactive').length,
      deceasedMembers: deceasedMembers.length,
      totalMembers: members.length,
    };
  }, [contributions, members, deceasedMembers, deductionsData]);

  const paginatedData = useMemo(() => {
    let data = [];
    if (reportType === 'contributions') data = filteredContributions;
    else if (reportType === 'claims') data = filteredClaims;
    else if (reportType === 'deceasedMembers') data = filteredDeceasedMembers;
    else if (reportType === 'memberStanding') data = filteredMemberStandingList;
    else if (reportType === 'negativeBalances') data = filteredNegativeMembers;
    else if (reportType === 'deductions') data = filteredDeductionsData;

    const total = data.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      data: data.slice(startIndex, endIndex),
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: endIndex < total,
      hasPrevPage: page > 1
    };
  }, [reportType, filteredContributions, filteredClaims, filteredDeceasedMembers, filteredMemberStandingList, filteredNegativeMembers, filteredDeductionsData, page, limit]);

  const generatePDF = async () => {
    if (exportDisabled) return;
    setExporting(true);
    setExportError('');
    try {
      const date = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      let sections = [];
      let scope = 'All recorded transactions.';
      if (reportType === 'summary') {
        sections = [
          { title: 'Financial position', head: ['Particulars', 'Amount (PHP)'], widths: [125, 51], numberColumns: [1],
            body: [['Total fund balance', reportAmount(stats?.fundBalance)],
              ['Contributions collected', reportAmount(metrics.totalContributions)],
              ['Deductions collected', reportAmount(metrics.totalDeductionsCollected)],
              ['Payouts released', reportAmount(metrics.totalPayoutsReleased)]] },
          { title: summaryPeriod === 'monthly' ? 'Monthly breakdown' : 'Annual breakdown',
            head: [summaryPeriod === 'monthly' ? 'Month' : 'Year', 'Contributions', 'Deductions', 'Payouts'],
            widths: [44, 44, 44, 44], numberColumns: [1, 2, 3],
            body: periodBreakdown.map(row => [row.label, reportAmount(row.contributions), reportAmount(row.deductionsCollected), reportAmount(row.payoutsReleased)]) },
        ];
      } else if (reportType === 'contributions') {
        sections = [{ head: ['Payment date', 'Member ID', 'Member name', 'Amount (PHP)', 'Status'],
          widths: [28, 30, 62, 32, 24], numberColumns: [3],
          body: filteredContributions.map(c => [date(c.payment_date || c.created_at), c.member_id, c.member_name || '-', reportAmount(c.amount), c.status || 'Paid']) }];
      } else if (reportType === 'claims') {
        sections = [{ head: ['Claim ID', 'Member', 'Beneficiary', 'Date filed', 'Status'],
          widths: [31, 42, 42, 28, 33],
          body: filteredClaims.map(c => [c.claimId, c.memberName, c.beneficiaryName, date(c.dateFiled), getClaimStatusMeta(c.status).label]) }];
      } else if (reportType === 'deceasedMembers') {
        scope = 'Current member roster. Deceased members only.';
        sections = [{ head: ['Member ID', 'Member name', 'Barangay', 'Join date'], widths: [31, 66, 49, 30],
          body: filteredDeceasedMembers.map(m => [m.id || m.memberId, m.name || m.memberName, m.barangay || '-', date(m.join_date || m.joinDate)]) }];
      } else if (reportType === 'memberStanding') {
        scope = 'Current posted balances. Active members only; lowest balance first.';
        sections = [{ head: ['Member ID', 'Member name', 'Barangay', 'Balance (PHP)', 'Standing'],
          widths: [28, 53, 37, 33, 25], numberColumns: [3],
          body: filteredMemberStandingList.map(m => [m.id, m.name, m.barangay, reportAmount(m.balance), m.standing]) }];
      } else if (reportType === 'negativeBalances') {
        scope = 'Current posted balances below zero, across all member statuses. Largest shortfall first.';
        sections = [
          { title: 'Balance overview', head: ['Particulars', 'Value'], widths: [125, 51], numberColumns: [1],
            body: [['Members with negative balances', String(filteredNegativeMembers.length)], ['Total shortfall to zero (PHP)', reportAmount(filteredTotalShortfall)]] },
          { title: 'Members with negative balances', head: ['Member ID', 'Member name', 'Barangay', 'Status', 'Balance (PHP)'],
            widths: [28, 55, 37, 23, 33], numberColumns: [4],
            body: filteredNegativeMembers.map(m => [m.id, m.name, m.barangay, m.status, reportAmount(m.balance)]),
            emptyMessage: 'No members have a negative balance.',
            total: ['Total balance', '', '', '', reportAmount(-filteredTotalShortfall)] },
        ];
      } else if (reportType === 'deductions') {
        sections = [{ head: ['Claim ID', 'Member name', 'Status', 'Deducted (PHP)', 'Released (PHP)'],
          widths: [31, 48, 31, 33, 33], numberColumns: [3, 4],
          body: filteredDeductionsData.map(c => [c.claimId, c.memberName, getClaimStatusMeta(c.status).label, reportAmount(c.deductionCollected), reportAmount(c.payoutAmount)]) }];
      }
      const logo = await loadReportLogo();
      const title = REPORT_TYPES.find(type => type.id === reportType)?.label || 'Mortuary Fund Report';
      const doc = createMortuaryReportPdf({ title, scope, sections, logo });
      doc.save('mortuary-' + reportType + '-report-' + new Date().toISOString().slice(0, 10) + '.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setExportError(error.message || 'Unable to generate this report. Please retry.');
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    if (exportDisabled) return;
    let csvContent = '';
    let filename = '';

    if (reportType === 'summary') {
      filename = `summary-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Metric,Value\n';
      csvContent += `"Total Fund Balance","₱${(stats?.fundBalance || 0).toLocaleString()}"\n`;
      csvContent += `"Total Contributions","₱${metrics.totalContributions.toLocaleString()}"\n`;
      csvContent += `"Total Deductions Collected","₱${metrics.totalDeductionsCollected.toLocaleString()}"\n`;
      csvContent += `"Total Payouts Released","₱${metrics.totalPayoutsReleased.toLocaleString()}"\n`;
      csvContent += '\n';
      csvContent += `"${summaryPeriod === 'monthly' ? 'Month' : 'Year'}","Contributions","Deductions Collected","Payouts Released"\n`;
      periodBreakdown.forEach((row) => {
        csvContent += `"${row.label}","₱${row.contributions.toLocaleString()}","₱${row.deductionsCollected.toLocaleString()}","₱${row.payoutsReleased.toLocaleString()}"\n`;
      });
    } else if (reportType === 'contributions') {
      filename = `contributions-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Date,Passbook Number,Member Name,Amount,Status\n';
      filteredContributions.forEach(c => {
        csvContent += `"${new Date(c.payment_date || c.created_at).toLocaleDateString()}","${c.member_id}","${c.member_name || ''}","${c.amount}","${c.status}"\n`;
      });
    } else if (reportType === 'claims') {
      filename = `claims-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Beneficiary,Date Filed,Status\n';
      filteredClaims.forEach(c => {
        csvContent += `"${c.claimId}","${c.memberName}","${c.beneficiaryName}","${new Date(c.dateFiled).toLocaleDateString()}","${getClaimStatusMeta(c.status).label}"\n`;
      });
    } else if (reportType === 'deceasedMembers') {
      filename = `deceased-members-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Barangay,Join Date\n';
      filteredDeceasedMembers.forEach(m => {
        csvContent += `"${m.id || m.memberId}","${m.name || m.memberName}","${m.barangay || ''}","${m.join_date || ''}"\n`;
      });
    } else if (reportType === 'memberStanding') {
      filename = `member-standing-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Barangay,Balance,Standing\n';
      filteredMemberStandingList.forEach(m => {
        csvContent += `"${m.id}","${m.name}","${m.barangay}","${m.balance}","${m.standing}"\n`;
      });
    } else if (reportType === 'negativeBalances') {
      filename = 'negative-balances-' + new Date().toISOString().slice(0, 10) + '.csv';
      const rows = [['Member ID', 'Member Name', 'Barangay', 'Status', 'Balance (PHP)', 'Shortfall to Zero (PHP)'],
        ...filteredNegativeMembers.map(m => [m.id, m.name, m.barangay, m.status, m.balance.toFixed(2), (-m.balance).toFixed(2)])];
      csvContent = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    } else if (reportType === 'deductions') {
      filename = `deductions-payouts-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Status,Deducted,Released\n';
      filteredDeductionsData.forEach(c => {
        csvContent += `"${c.claimId}","${c.memberName}","${getClaimStatusMeta(c.status).label}","${c.deductionCollected}","${c.payoutAmount}"\n`;
      });
    }

    // Without a BOM, Excel guesses the file's encoding from the system
    // codepage instead of reading it as UTF-8 — the multi-byte ₱ (U+20B1)
    // then gets misread as unrelated CJK characters. Same fix already used
    // by the backup CSV exports.
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Comprehensive mortuary fund and claims analytics.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Total Contributions</p>
            <p className="text-xl font-bold text-slate-900 mt-1 truncate">₱{metrics.totalContributions.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg shrink-0 ml-3">
            <TrendingUp className="w-5 h-5 text-coop-green" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Fund Balance</p>
            <p className="text-xl font-bold text-slate-900 mt-1 truncate">₱{(stats?.fundBalance || 0).toLocaleString()}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg shrink-0 ml-3">
            <PhilippinePeso className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">Active Members</p>
            <p className="text-xl font-bold text-slate-900 mt-1 truncate">{metrics.activeMembers}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg shrink-0 ml-3">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {reportLoading && <p role="status" className="text-sm text-slate-500">Loading complete report data...</p>}
      {(reportError || exportError) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{reportError || exportError}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl h-fit overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-900">Report Type</p>
          </div>
          <div className="p-4 space-y-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => { setReportType(type.id); setPage(1); }}
                className={`w-full flex items-center p-3 rounded-lg border transition-all ${
                  reportType === type.id
                    ? 'bg-green-50 border-green-200 text-coop-green'
                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <type.icon className={`w-4 h-4 mr-3 shrink-0 ${reportType === type.id ? 'text-coop-green' : 'text-slate-400'}`} />
                <span className="text-xs font-semibold text-left">{type.label}</span>
              </button>
            ))}

            <div className="pt-4 space-y-2">
              <button
                onClick={generatePDF}
                disabled={exportDisabled}
                className="w-full inline-flex items-center justify-center gap-2 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-xs py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> {exporting ? 'Preparing PDF...' : 'Export PDF'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={exportDisabled}
                className="w-full inline-flex items-center justify-center gap-2 border border-slate-200 hover:border-coop-green hover:text-coop-green text-slate-600 font-semibold text-xs py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl max-h-[600px] flex flex-col overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-slate-900">{REPORT_TYPES.find(t => t.id === reportType)?.label}</p>
              {reportType !== 'summary' && (
                <p className="text-xs text-slate-400 mt-0.5">{paginatedData.total} record{paginatedData.total === 1 ? '' : 's'}</p>
              )}
            </div>
            {reportType !== 'summary' && (
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                aria-label="Filter by barangay"
                className="h-9 px-3 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none"
              >
                <option value="all">All barangays</option>
                {barangayOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {reportType === 'summary' && (
              <div className="p-5">
                <div className="space-y-1 max-w-md">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Financial Metrics</p>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Total Fund Balance</span>
                    <span className="font-semibold text-slate-900">₱{(stats?.fundBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Total Contributions</span>
                    <span className="font-semibold text-coop-green">₱{metrics.totalContributions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Total Deductions Collected</span>
                    <span className="font-semibold text-slate-900">₱{metrics.totalDeductionsCollected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-slate-500">Total Payouts Released</span>
                    <span className="font-semibold text-rose-600">₱{metrics.totalPayoutsReleased.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {reportType === 'summary' && (
              <div className="px-5 pb-5">
                <div className="flex items-center justify-between gap-3 mb-3 pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Breakdown</p>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    {['monthly', 'annually'].map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSummaryPeriod(period)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                          summaryPeriod === period ? 'bg-white text-coop-green shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {summaryPeriod === 'monthly' ? 'Month' : 'Year'}
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Contributions</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Deductions Collected</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Payouts Released</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodBreakdown.map((row) => (
                        <tr key={row.period}>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-900">{row.label}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-coop-green font-semibold">₱{row.contributions.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-slate-700">₱{row.deductionsCollected.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-rose-600">₱{row.payoutsReleased.toLocaleString()}</td>
                        </tr>
                      ))}
                      {periodBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                            No dated records to break down yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportType === 'contributions' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((c, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{new Date(c.payment_date || c.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{c.member_name || `Member #${c.member_id}`}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-coop-green">₱{(c.amount || 0).toLocaleString()}</td>
                      <td className="px-5 py-2.5">
                        <span className="text-xs font-semibold bg-green-50 text-coop-green px-2 py-0.5 rounded-full">{c.status || 'Paid'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'claims' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Claim ID</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Beneficiary</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Date Filed</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((c) => {
                    const meta = getClaimStatusMeta(c.status);
                    return (
                      <tr key={c.claimId}>
                        <td className="px-5 py-2.5 text-xs font-mono text-slate-500">{c.claimId.slice(0, 8)}</td>
                        <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{c.memberName}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">{c.beneficiaryName}</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500">{new Date(c.dateFiled).toLocaleDateString()}</td>
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {reportType === 'deceasedMembers' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">ID</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Barangay</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Join Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">#{m.id || m.memberId}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{m.name || m.memberName}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.barangay || 'N/A'}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.join_date || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'negativeBalances' && !reportLoading && !reportError && (
              <div>
                <div className="border-b border-slate-200 p-5">
                  <p className="text-sm text-slate-600">Current balances below zero across all member statuses, sorted by largest shortfall.</p>
                  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <p><span className="text-slate-500">Members: </span><strong>{filteredNegativeMembers.length}</strong></p>
                    <p><span className="text-slate-500">Total shortfall to zero: </span><strong className="text-rose-700">PHP {reportAmount(filteredTotalShortfall)}</strong></p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                      <tr>{['Member ID', 'Name', 'Barangay', 'Status', 'Balance (PHP)'].map((label, index) => <th key={label} className={index === 4 ? 'px-4 py-3 text-right font-medium' : 'px-4 py-3 text-left font-medium'}>{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.data.map(member => <tr key={member.id}>
                        <td className="px-4 py-3 text-slate-500">{member.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                        <td className="px-4 py-3 text-slate-600">{member.barangay}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{member.status}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-700">{reportAmount(member.balance)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportType === 'memberStanding' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">ID</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Barangay</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Balance</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">#{m.id}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{m.name}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.barangay}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">₱{m.balance.toLocaleString()}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${STANDING_BADGE_STYLES[m.standing]}`}>
                          {m.standing}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'deductions' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Claim ID</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Deducted</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Released</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((c) => {
                    const meta = getClaimStatusMeta(c.status);
                    return (
                      <tr key={c.claimId}>
                        <td className="px-5 py-2.5 text-xs font-mono text-slate-500">{c.claimId.slice(0, 8)}</td>
                        <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{c.memberName}</td>
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">₱{c.deductionCollected.toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-xs font-semibold text-rose-600">₱{c.payoutAmount.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {paginatedData.total === 0 && reportType !== 'summary' && !reportLoading && !reportError && (
              <div className="py-16 text-center text-sm text-slate-400">{reportType === 'negativeBalances' ? 'No members have a negative balance.' : 'No records to display.'}</div>
            )}
          </div>

          {reportType !== 'summary' && paginatedData.total > 0 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <PaginationInfo currentPage={page} limit={limit} total={paginatedData.total} />
              <Pagination
                currentPage={page}
                totalPages={paginatedData.totalPages}
                onPageChange={setPage}
                hasNextPage={paginatedData.hasNextPage}
                hasPrevPage={paginatedData.hasPrevPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
