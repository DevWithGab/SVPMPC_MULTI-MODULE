import React, { useState, useEffect, useMemo } from 'react';
import { Download, TrendingUp, Users, PhilippinePeso, FileText, ClipboardCheck, Heart, AlertTriangle, Receipt } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { treasurerAPI } from '../../../services/api';
import { getClaimStatusMeta } from '../shared/claimMeta';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COOP_GREEN_RGB = [45, 122, 62];

const REPORT_TYPES = [
  { id: 'summary', label: 'Financial Summary', icon: FileText },
  { id: 'contributions', label: 'Contributions', icon: TrendingUp },
  { id: 'claims', label: 'Claims Report', icon: ClipboardCheck },
  { id: 'deceasedMembers', label: 'Deceased Members', icon: Heart },
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

const Reports = ({ contributions = [], stats = {}, members = [] }) => {
  const [reportType, setReportType] = useState('summary');
  const [summaryPeriod, setSummaryPeriod] = useState('monthly'); // 'monthly' | 'annually'
  const { page, limit, setPage } = usePagination(1, 10);
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    let cancelled = false;
    treasurerAPI
      .getAllClaims({ limit: 100 })
      .then((res) => {
        if (!cancelled) setClaims(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
      memberName: c.memberName,
      status: c.status,
      deductionCollected: c.deduction?.totalCollected || 0,
      deductionDate: c.deduction?.processedAt || null,
      payoutAmount: c.payout?.amount || 0,
      payoutDate: c.payout?.releasedAt || null,
    }));
  }, [claims]);

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
        net: row.contributions + row.deductionsCollected - row.payoutsReleased,
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
    if (reportType === 'contributions') data = contributions;
    else if (reportType === 'claims') data = claims;
    else if (reportType === 'deceasedMembers') data = deceasedMembers;
    else if (reportType === 'memberStanding') data = memberStandingList;
    else if (reportType === 'deductions') data = deductionsData;

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
  }, [reportType, contributions, claims, deceasedMembers, memberStandingList, deductionsData, page, limit]);

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('SVPMPC Mortuary Fund Report', 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Report Type: ${REPORT_TYPES.find(t => t.id === reportType)?.label || reportType}`, 14, 34);
      doc.setTextColor(0);

      const startY = 45;

      if (reportType === 'summary') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Financial Summary', 14, startY);
        const summaryData = [
          ['Total Fund Balance', `P${stats?.fundBalance || 0}`],
          ['Total Contributions Collected', `P${metrics.totalContributions}`],
          ['Total Deductions Collected', `P${metrics.totalDeductionsCollected}`],
          ['Total Payouts Released', `P${metrics.totalPayoutsReleased}`],
        ];
        autoTable(doc, {
          startY: startY + 5,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 10, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 }, 1: { halign: 'right', cellWidth: 80 } },
        });

        const breakdownStartY = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${summaryPeriod === 'monthly' ? 'Monthly' : 'Annual'} Breakdown`, 14, breakdownStartY);
        const breakdownData = periodBreakdown.map((row) => [
          row.label,
          `P${row.contributions.toLocaleString()}`,
          `P${row.deductionsCollected.toLocaleString()}`,
          `P${row.payoutsReleased.toLocaleString()}`,
          `P${row.net.toLocaleString()}`,
        ]);
        autoTable(doc, {
          startY: breakdownStartY + 5,
          head: [[summaryPeriod === 'monthly' ? 'Month' : 'Year', 'Contributions', 'Deductions', 'Payouts', 'Net']],
          body: breakdownData,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        });
      } else if (reportType === 'contributions') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Contributions Report', 14, startY);
        const contribData = contributions.slice(0, 200).map(c => [
          new Date(c.payment_date || c.created_at).toLocaleDateString(),
          c.member_name || `Member #${c.member_id}`,
          `P${c.amount || 0}`,
          c.status || 'Paid',
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Date', 'Member', 'Amount', 'Status']],
          body: contribData,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'right' } },
        });
      } else if (reportType === 'claims') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Claims Report', 14, startY);
        const claimData = claims.slice(0, 200).map(c => [
          c.claimId.slice(0, 8),
          c.memberName,
          c.beneficiaryName,
          new Date(c.dateFiled).toLocaleDateString(),
          getClaimStatusMeta(c.status).label,
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Claim ID', 'Member', 'Beneficiary', 'Date Filed', 'Status']],
          body: claimData,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
        });
      } else if (reportType === 'deceasedMembers') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Deceased Members Report', 14, startY);
        const data = deceasedMembers.slice(0, 200).map(m => [
          m.id || m.memberId, m.name || m.memberName, m.barangay || 'N/A', m.join_date || 'N/A',
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['ID', 'Name', 'Barangay', 'Join Date']],
          body: data,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
        });
      } else if (reportType === 'memberStanding') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Member Standing Report', 14, startY);
        const data = memberStandingList.slice(0, 200).map(m => [
          m.id, m.name, m.barangay, `P${m.balance}`, m.standing,
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['ID', 'Name', 'Barangay', 'Balance', 'Standing']],
          body: data,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: { 3: { halign: 'right' } },
        });
      } else if (reportType === 'deductions') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Deductions & Payouts Report', 14, startY);
        const data = deductionsData.slice(0, 200).map(c => [
          c.claimId.slice(0, 8),
          c.memberName,
          getClaimStatusMeta(c.status).label,
          `P${c.deductionCollected}`,
          `P${c.payoutAmount}`,
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Claim ID', 'Member', 'Status', 'Deducted', 'Released']],
          body: data,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
        });
      }

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        doc.text('SVPMPC Mortuary Fund Management System', 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`mortuary-${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  const exportToCSV = () => {
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
      csvContent += `"${summaryPeriod === 'monthly' ? 'Month' : 'Year'}","Contributions","Deductions Collected","Payouts Released","Net"\n`;
      periodBreakdown.forEach((row) => {
        csvContent += `"${row.label}","₱${row.contributions.toLocaleString()}","₱${row.deductionsCollected.toLocaleString()}","₱${row.payoutsReleased.toLocaleString()}","₱${row.net.toLocaleString()}"\n`;
      });
    } else if (reportType === 'contributions') {
      filename = `contributions-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Date,Member ID,Member Name,Amount,Status\n';
      contributions.forEach(c => {
        csvContent += `"${new Date(c.payment_date || c.created_at).toLocaleDateString()}","${c.member_id}","${c.member_name || ''}","${c.amount}","${c.status}"\n`;
      });
    } else if (reportType === 'claims') {
      filename = `claims-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Beneficiary,Date Filed,Status\n';
      claims.forEach(c => {
        csvContent += `"${c.claimId}","${c.memberName}","${c.beneficiaryName}","${new Date(c.dateFiled).toLocaleDateString()}","${getClaimStatusMeta(c.status).label}"\n`;
      });
    } else if (reportType === 'deceasedMembers') {
      filename = `deceased-members-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Barangay,Join Date\n';
      deceasedMembers.forEach(m => {
        csvContent += `"${m.id || m.memberId}","${m.name || m.memberName}","${m.barangay || ''}","${m.join_date || ''}"\n`;
      });
    } else if (reportType === 'memberStanding') {
      filename = `member-standing-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Barangay,Balance,Standing\n';
      memberStandingList.forEach(m => {
        csvContent += `"${m.id}","${m.name}","${m.barangay}","${m.balance}","${m.standing}"\n`;
      });
    } else if (reportType === 'deductions') {
      filename = `deductions-payouts-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Status,Deducted,Released\n';
      deductionsData.forEach(c => {
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
                className="w-full inline-flex items-center justify-center gap-2 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-xs py-3 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button
                onClick={exportToCSV}
                className="w-full inline-flex items-center justify-center gap-2 border border-slate-200 hover:border-coop-green hover:text-coop-green text-slate-600 font-semibold text-xs py-3 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl max-h-[600px] flex flex-col overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0">
            <p className="text-sm font-bold text-slate-900">{REPORT_TYPES.find(t => t.id === reportType)?.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{paginatedData.total} record{paginatedData.total === 1 ? '' : 's'}</p>
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
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodBreakdown.map((row) => (
                        <tr key={row.period}>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-900">{row.label}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-coop-green font-semibold">₱{row.contributions.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-slate-700">₱{row.deductionsCollected.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-right text-rose-600">₱{row.payoutsReleased.toLocaleString()}</td>
                          <td className={`px-4 py-2.5 text-xs text-right font-semibold ${row.net >= 0 ? 'text-coop-green' : 'text-rose-600'}`}>
                            ₱{row.net.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {periodBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
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

            {paginatedData.total === 0 && reportType !== 'summary' && (
              <div className="py-16 text-center text-sm text-slate-400">No records to display.</div>
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
