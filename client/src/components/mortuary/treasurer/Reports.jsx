import { Select } from '../../ui/input';
import { PageHeader, Panel } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useState, useEffect, useMemo } from 'react';
import { Download, TrendingUp, Users, FileText, ClipboardCheck, Heart, AlertTriangle, Receipt, Loader2 } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { treasurerAPI } from '../../../services/api';
import { getClaimStatusMeta } from '../shared/claimMeta';
import { createMortuaryReportPdf, loadReportLogo, negativeBalanceMembers, reportAmount } from '../../../utils/mortuaryReportPdf';
import { reportCsvHeader } from '../../../utils/reportCsvHeader';
import { loadAllPages } from '../../../utils/loadAllPages';
import { getStandingLabel } from '../../../utils/memberStanding';
import AttendanceMetricGrid from '../../attendance/shared/AttendanceMetricGrid';
import './Reports.css';


const REPORT_TYPES = [
  { id: 'summary', label: 'Financial Summary', icon: FileText },
  { id: 'contributions', label: 'Contributions', icon: TrendingUp },
  { id: 'claims', label: 'Claims Report', icon: ClipboardCheck },
  { id: 'deceasedMembers', label: 'Deceased Members', icon: Heart },
  { id: 'negativeBalances', label: 'Negative Balances', icon: AlertTriangle },
  { id: 'memberStanding', label: 'Member Standing', icon: Users },
  { id: 'deductions', label: 'Claim Deductions', icon: Receipt },
];

const STANDING_BADGE_STYLES = {
  Excellent: 'bg-green-50 text-green-700 border-green-200',
  Good: 'bg-blue-50 text-blue-700 border-blue-200',
  Fair: 'bg-amber-50 text-amber-700 border-amber-200',
  'At Risk': 'bg-amber-50 text-amber-700 border-amber-200',
  'Negative Balance': 'bg-red-50 text-red-700 border-red-200',
};

/* 'YYYY-MM' for monthly, 'YYYY' for annually - tama yung sort kahit plain
strings lang, kaya zero-padded yung month. */
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
  const minimumBalance = stats?.minimumBalance ?? 1000;
  const [reportType, setReportType] = useState('summary');
  const [summaryPeriod, setSummaryPeriod] = useState('monthly'); // 'monthly' | 'annually'
  const [barangayFilter, setBarangayFilter] = useState('all');
  const { page, limit, setPage } = usePagination(1, 100);
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

  /* Yung contributions at claims walang sariling barangay - yung member
  record lang meron - kaya lahat ng ibang report type (lahat except Financial
  Summary, na fund-wide total talaga at sadyang hindi scoped) kinukuha yung
  barangay through sa memberId -> barangay lookup na ito. */
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

  /* Active members ranked worst-balance-first para madali makita ng
  treasurer yung mga malapit na mag-receive ng balance notice, hindi na
  kailangan mag re-sort. */
  const memberStandingList = useMemo(() => {
    return members
      .filter((m) => m.status === 'active')
      .map((m) => ({
        id: m.id || m.memberId,
        name: m.name || m.memberName,
        barangay: m.barangay || 'N/A',
        balance: m.currentBalance ?? m.balance ?? 0,
        standing: getStandingLabel(m.currentBalance ?? m.balance, minimumBalance),
      }))
      .sort((a, b) => a.balance - b.balance);
  }, [members, minimumBalance]);

  /* Per-claim deduction line items - mas detalyado kesa sa isang
  aggregate total kasi makikita exactly kung aling claims nag-fund sa
  collected amount. */
  const deductionsData = useMemo(() => {
    return claims.map((c) => ({
      claimId: c.claimId,
      memberId: c.memberId,
      memberName: c.memberName,
      status: c.status,
      deductionCollected: c.deduction?.totalCollected || 0,
      deductionDate: c.deduction?.processedAt || null,
    }));
  }, [claims]);

  /* Filtered-by-barangay versions ng data ng lahat ng non-summary report.
  Yung Financial Summary sadyang binabasa yung unfiltered arrays sa taas
  (contributions, claims, deductionsData, members) sa ibang parte ng file
  na ito. */
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

  /* Monthly/Annually breakdown ng Financial Summary - bawat period bucket
  nagsum ng contributions base sa payment date at deductions base kung kailan
  na-process (puwedeng magkaiba ang period kesa sa pagkafile mismo ng claim). */
  const periodBreakdown = useMemo(() => {
    const buckets = new Map();
    const ensure = (key) => {
      if (!buckets.has(key)) {
        buckets.set(key, { period: key, contributions: 0, deductionsCollected: 0 });
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
    return {
      totalContributions,
      totalDeductionsCollected,
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

  /* Title, scope and emphasised filter shared by the PDF and CSV exports, so
  both open with the same report header. A barangay the report is filtered to
  is emphasised instead of repeated in the scope (summary is fund-wide). */
  const REPORT_SCOPES = {
    deceasedMembers: 'Current member roster. Deceased members only.',
    memberStanding: 'Current posted balances. Active members only; lowest balance first.',
    negativeBalances: 'Current posted balances below zero, excluding deceased members. Largest shortfall first.',
  };
  const reportHeader = () => {
    const byBarangay = reportType !== 'summary' && barangayFilter !== 'all';
    let scope = REPORT_SCOPES[reportType] || 'All recorded transactions.';
    if (reportType !== 'summary' && !byBarangay) scope += ' Barangay: All barangays.';
    return {
      byBarangay,
      scope,
      title: REPORT_TYPES.find(type => type.id === reportType)?.label || 'Mortuary Fund Report',
      highlights: byBarangay ? [{ label: 'Barangay', value: barangayFilter }] : [],
    };
  };

  const generatePDF = async () => {
    if (exportDisabled) return;
    setExporting(true);
    setExportError('');
    try {
      const date = value => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      /* A barangay the report is filtered to leaves the tables and is shown,
      emphasised, in the PDF header instead (same rule as attendance reports). */
      const { byBarangay, scope, title, highlights } = reportHeader();
      const brgyCol = (values) => (byBarangay ? [] : values);
      let sections = [];
      if (reportType === 'summary') {
        sections = [
          { title: 'Financial position', head: ['Particulars', 'Amount (PHP)'], widths: [125, 51], numberColumns: [1],
            body: [['Total fund balance', reportAmount(stats?.fundBalance)],
              ['Contributions collected', reportAmount(metrics.totalContributions)],
              ['Deductions collected', reportAmount(metrics.totalDeductionsCollected)]] },
          { title: summaryPeriod === 'monthly' ? 'Monthly breakdown' : 'Annual breakdown',
            head: [summaryPeriod === 'monthly' ? 'Month' : 'Year', 'Contributions', 'Deductions'],
            widths: [60, 58, 58], numberColumns: [1, 2],
            body: periodBreakdown.map(row => [row.label, reportAmount(row.contributions), reportAmount(row.deductionsCollected)]) },
        ];
      } else if (reportType === 'contributions') {
        sections = [{ head: ['Payment date', 'Passbook No.', 'Member name', 'Amount (PHP)', 'Status'],
          widths: [28, 30, 62, 32, 24], numberColumns: [3],
          body: filteredContributions.map(c => [date(c.payment_date || c.created_at), c.member_id, c.member_name || '-', reportAmount(c.amount), c.status || 'Paid']) }];
      } else if (reportType === 'claims') {
        sections = [{ head: ['Claim ID', 'Member', 'Beneficiary', 'Date filed', 'Status'],
          widths: [31, 42, 42, 28, 33],
          body: filteredClaims.map(c => [c.claimId, c.memberName, c.beneficiaryName, date(c.dateFiled), getClaimStatusMeta(c.status).label]) }];
      } else if (reportType === 'deceasedMembers') {
        sections = [{ head: ['Passbook No.', 'Member name', ...brgyCol(['Barangay']), 'Join date'], widths: byBarangay ? [40, 100, 36] : [31, 66, 49, 30],
          body: filteredDeceasedMembers.map(m => [m.id || m.memberId, m.name || m.memberName, ...brgyCol([m.barangay || '-']), date(m.join_date || m.joinDate)]) }];
      } else if (reportType === 'memberStanding') {
        sections = [{ head: ['Passbook No.', 'Member name', ...brgyCol(['Barangay']), 'Balance (PHP)', 'Standing'],
          widths: byBarangay ? [34, 75, 37, 30] : [28, 53, 37, 33, 25], numberColumns: [byBarangay ? 2 : 3],
          body: filteredMemberStandingList.map(m => [m.id, m.name, ...brgyCol([m.barangay]), reportAmount(m.balance), m.standing]) }];
      } else if (reportType === 'negativeBalances') {
        sections = [
          { title: 'Balance overview', head: ['Particulars', 'Value'], widths: [125, 51], numberColumns: [1],
            body: [['Members with negative balances', String(filteredNegativeMembers.length)], ['Total shortfall to zero (PHP)', reportAmount(filteredTotalShortfall)]] },
          { title: 'Members with negative balances', head: ['Passbook No.', 'Member name', ...brgyCol(['Barangay']), 'Status', 'Balance (PHP)'],
            widths: byBarangay ? [34, 80, 27, 35] : [28, 55, 37, 23, 33], numberColumns: [byBarangay ? 3 : 4],
            body: filteredNegativeMembers.map(m => [m.id, m.name, ...brgyCol([m.barangay]), m.status, reportAmount(m.balance)]),
            emptyMessage: 'No members have a negative balance.',
            total: ['Total balance', '', ...brgyCol(['']), '', reportAmount(-filteredTotalShortfall)] },
        ];
      } else if (reportType === 'deductions') {
        sections = [{ head: ['Claim ID', 'Member name', 'Status', 'Deducted (PHP)'],
          widths: [38, 64, 38, 36], numberColumns: [3],
          body: filteredDeductionsData.map(c => [c.claimId, c.memberName, getClaimStatusMeta(c.status).label, reportAmount(c.deductionCollected)]) }];
      }
      const logo = await loadReportLogo();
      const doc = createMortuaryReportPdf({ title, scope, sections, logo, highlights });
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
      csvContent += '\n';
      csvContent += `"${summaryPeriod === 'monthly' ? 'Month' : 'Year'}","Contributions","Deductions Collected"\n`;
      periodBreakdown.forEach((row) => {
        csvContent += `"${row.label}","₱${row.contributions.toLocaleString()}","₱${row.deductionsCollected.toLocaleString()}"\n`;
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
      csvContent = 'Passbook No.,Name,Barangay,Join Date\n';
      filteredDeceasedMembers.forEach(m => {
        csvContent += `"${m.id || m.memberId}","${m.name || m.memberName}","${m.barangay || ''}","${m.join_date || ''}"\n`;
      });
    } else if (reportType === 'memberStanding') {
      filename = `member-standing-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Passbook No.,Name,Barangay,Balance,Standing\n';
      filteredMemberStandingList.forEach(m => {
        csvContent += `"${m.id}","${m.name}","${m.barangay}","${m.balance}","${m.standing}"\n`;
      });
    } else if (reportType === 'negativeBalances') {
      filename = 'negative-balances-' + new Date().toISOString().slice(0, 10) + '.csv';
      const rows = [['Passbook No.', 'Member Name', 'Barangay', 'Status', 'Balance (PHP)', 'Shortfall to Zero (PHP)'],
        ...filteredNegativeMembers.map(m => [m.id, m.name, m.barangay, m.status, m.balance.toFixed(2), (-m.balance).toFixed(2)])];
      csvContent = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    } else if (reportType === 'deductions') {
      filename = `claim-deductions-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Status,Deducted\n';
      filteredDeductionsData.forEach(c => {
        csvContent += `"${c.claimId}","${c.memberName}","${getClaimStatusMeta(c.status).label}","${c.deductionCollected}"\n`;
      });
    }

    /* Kung walang BOM, mag-guess si Excel ng encoding base sa system
    codepage imbes na basahin as UTF-8 - yung multi-byte ₱ (U+20B1) mamali-
    mali mabasa bilang unrelated CJK characters. Parehong fix na ginamit na
    sa backup CSV exports. */
    const { scope, title, highlights } = reportHeader();
    const header = reportCsvHeader({ title, scope, highlights, program: 'Mortuary Aid Fund Program', metadata: ['Currency', 'Philippine pesos (PHP)'] });
    const blob = new Blob(['﻿' + header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const scope = {
    summary: 'All recorded contributions and claim deductions.',
    contributions: 'All recorded member contributions and payment statuses.',
    claims: 'All filed claims, beneficiaries and processing statuses.',
    deductions: 'Amount collected for each claim.',
    deceasedMembers: 'Deceased members in the current roster.',
    negativeBalances: 'Deceased members excluded. Largest shortfall first.',
    memberStanding: 'Active members only. Lowest posted balance first.',
  }[reportType];
  return (
    <div className="financial-reports pb-12">
      <PageHeader className="reports-page-heading">
        <div><p className="reports-eyebrow">Mortuary management / Reports</p><h1>Reports</h1>
          <p className="reports-description">Review fund activity, member balances and claim deductions.</p></div>
        <p className="text-xs text-slate-500">Reporting currency <strong className="ml-1 text-slate-700">PHP</strong></p>
      </PageHeader>
      <div className="reports-workspace">
        <nav className="reports-navigation" aria-label="Financial report selection">
          {[
            { label: 'Fund activity', ids: ['summary', 'contributions', 'claims', 'deductions'] },
            { label: 'Member records', ids: ['memberStanding', 'negativeBalances', 'deceasedMembers'] },
          ].map(group => <div key={group.label} className="reports-nav-group">
            <p className="reports-eyebrow">{group.label}</p>
            {group.ids.map(id => {
              const type = REPORT_TYPES.find(item => item.id === id);
              return <button key={id} type="button" aria-current={reportType === id ? 'page' : undefined}
                onClick={() => { setReportType(id); setPage(1); setExportError(''); }}>
                <type.icon size={16} aria-hidden="true" /><span>{type.label}</span>
              </button>;
            })}
          </div>)}
          <p className="reports-nav-note">Exports include the complete selected report, across all pages.</p>
        </nav>
        <Panel as="section" className="reports-document" aria-labelledby="report-title" aria-busy={reportLoading}>
          <div className="reports-document-heading">
            <div><h2 id="report-title">{REPORT_TYPES.find(type => type.id === reportType).label}</h2>
              <p className="mt-1 text-sm text-slate-600">{scope}</p></div>
            <div className="reports-export-actions">
              <button type="button" onClick={exportToCSV} disabled={exportDisabled} className="reports-button">Export CSV</button>
              <button type="button" onClick={generatePDF} disabled={exportDisabled} className="reports-button reports-button-primary">
                {exporting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}{exporting ? 'Preparing PDF...' : 'Export PDF'}</button>
            </div>
          </div>
          <div className="reports-scope-bar flex-wrap items-center">
            <span>{['memberStanding', 'negativeBalances', 'deceasedMembers'].includes(reportType) ? 'Current member records' : 'All recorded activity'}</span>
            <span>{reportLoading ? 'Loading records...' : reportError ? 'Data unavailable' : reportType === 'summary' ? periodBreakdown.length + ' reporting periods' : paginatedData.total.toLocaleString() + ' records'}</span>
          </div>
          {reportType !== 'summary' && <section className="reports-filters" aria-labelledby="reports-filter-title">
            <div className="reports-filter-heading"><h3 id="reports-filter-title">Filter report</h3><button type="button" className="reports-text-button" disabled={barangayFilter === 'all'} onClick={() => { setBarangayFilter('all'); setPage(1); }}>Reset filter</button></div>
            <label>Barangay<Select value={barangayFilter} onChange={e => { setBarangayFilter(e.target.value); setPage(1); }}><option value="all">All barangays</option>{barangayOptions.map(b => <option key={b} value={b}>{b}</option>)}</Select></label>
            <p>Applies to the displayed records and both exports.</p>
          </section>}
          {(reportError || exportError) && <p role="alert" className="m-5 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{reportError || exportError}</p>}
          {reportLoading ? <div role="status" className="p-12 text-center text-sm text-slate-600">Loading complete report data...</div> : reportError ? <div className="p-10 text-center text-sm text-slate-600">Reload this page to retrieve the complete report.</div> : <div className="reports-content" data-report={reportType} role="region" aria-label={REPORT_TYPES.find(type => type.id === reportType).label + ' data'} tabIndex={0}>
            {reportType === 'summary' && (
              <div className="reports-metrics"><AttendanceMetricGrid label="Financial summary" items={[
                ['Total fund balance', '₱' + reportAmount(stats?.fundBalance), 'Current fund position', FileText],
                ['Contributions collected', '₱' + reportAmount(metrics.totalContributions), 'All recorded contributions', TrendingUp],
                ['Deductions collected', '₱' + reportAmount(metrics.totalDeductionsCollected), 'Member assessments collected', ClipboardCheck],
              ]} /></div>
            )}
            {reportType === 'summary' && (
              <div className="px-5 pb-5">
                <div className="flex items-center justify-between gap-3 mb-3 pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Activity by period</p>
                  <div className="reports-period-switch" role="group" aria-label="Reporting period">
                    {['monthly', 'annually'].map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSummaryPeriod(period)}
                        aria-pressed={summaryPeriod === period}
                        className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                          summaryPeriod === period ? 'bg-white text-coop-green shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {period === 'monthly' ? 'Monthly' : 'Annual'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded overflow-x-auto">
                  <DataTable className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th scope="col" className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {summaryPeriod === 'monthly' ? 'Month' : 'Year'}
                        </th>
                        <th scope="col" className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Contributions</th>
                        <th scope="col" className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Deductions Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodBreakdown.map((row) => (
                        <tr key={row.period}>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-900">{row.label}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-coop-green font-semibold">₱{reportAmount(row.contributions)}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-slate-700">₱{reportAmount(row.deductionsCollected)}</td>
                        </tr>
                      ))}
                      {periodBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-sm text-slate-400">
                            No dated records to break down yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </DataTable>
                </div>
              </div>
            )}

            {reportType === 'contributions' && (
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Date</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Amount</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((c, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{new Date(c.payment_date || c.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{c.member_name || `Member #${c.member_id}`}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-coop-green">₱{reportAmount((c.amount || 0))}</td>
                      <td className="px-5 py-2.5">
                        <span className="text-xs font-semibold bg-green-50 text-coop-green px-2 py-0.5 rounded-full">{c.status || 'Paid'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}

            {reportType === 'claims' && (
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Claim ID</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Beneficiary</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Date Filed</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
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
              </DataTable>
            )}

            {reportType === 'deceasedMembers' && (
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Passbook No.</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Barangay</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Join Date</th>
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
              </DataTable>
            )}

            {reportType === 'negativeBalances' && !reportLoading && !reportError && (
              <div>
                <div className="border-b border-slate-200 p-5">
                  <p className="text-sm text-slate-600">Current balances below zero, excluding deceased members, sorted by largest shortfall.</p>
                  <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <p><span className="text-slate-500">Members: </span><strong>{filteredNegativeMembers.length}</strong></p>
                    <p><span className="text-slate-500">Total shortfall to zero: </span><strong className="text-rose-700">PHP {reportAmount(filteredTotalShortfall)}</strong></p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <DataTable className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                      <tr>{['Passbook No.', 'Name', 'Barangay', 'Status', 'Balance (PHP)'].map((label, index) => <th scope="col" key={label} className={index === 4 ? 'px-4 py-3 text-right font-medium' : 'px-4 py-3 text-left font-medium'}>{label}</th>)}</tr>
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
                  </DataTable>
                </div>
              </div>
            )}

            {reportType === 'memberStanding' && (
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Passbook No.</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Barangay</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Balance</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">#{m.id}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{m.name}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.barangay}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">₱{reportAmount(m.balance)}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${STANDING_BADGE_STYLES[m.standing]}`}>
                          {m.standing}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}

            {reportType === 'deductions' && (
              <DataTable className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Claim ID</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Member</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th scope="col" className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Deducted</th>
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
                        <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">₱{reportAmount(c.deductionCollected)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}

            {paginatedData.total === 0 && reportType !== 'summary' && !reportLoading && !reportError && (
              <div role="status" className="reports-empty">{reportType === 'negativeBalances' ? 'No members have a negative balance.' : 'No records to display.'}</div>
            )}
          </div>}

          {reportType !== 'summary' && !reportLoading && !reportError && paginatedData.total > 0 && (
            <div className="reports-pagination">
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
        </Panel>
      </div>
    </div>
  );
};

export default Reports;
