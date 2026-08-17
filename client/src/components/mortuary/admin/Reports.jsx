import React, { useState, useEffect, useMemo } from 'react';
import { Download, TrendingUp, Users, DollarSign, FileText, ClipboardCheck, Heart } from 'lucide-react';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import { claimAPI } from '../../../services/api';
import { getClaimStatusMeta } from './claimMeta';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COOP_GREEN_RGB = [45, 122, 62];

const REPORT_TYPES = [
  { id: 'summary', label: 'Financial Summary', icon: FileText },
  { id: 'contributions', label: 'Contributions', icon: TrendingUp },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'claims', label: 'Claims Report', icon: ClipboardCheck },
  { id: 'approvedClaims', label: 'Approved Claims', icon: ClipboardCheck },
  { id: 'deceasedMembers', label: 'Deceased Members', icon: Heart },
];

const Reports = ({ contributions = [], stats = {}, members = [] }) => {
  const [reportType, setReportType] = useState('summary');
  const { page, limit, setPage } = usePagination(1, 10);
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    let cancelled = false;
    claimAPI
      .getAllClaims({ limit: 100 })
      .then((res) => {
        if (!cancelled) setClaims(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const approvedClaims = useMemo(() => claims.filter((c) => c.approval?.approvedAt), [claims]);
  const deceasedMembers = useMemo(() => members.filter((m) => m.status === 'deceased'), [members]);

  const metrics = useMemo(() => {
    const totalContributions = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
    return {
      totalContributions,
      activeMembers: members.filter(m => m.status === 'active').length,
      inactiveMembers: members.filter(m => m.status === 'inactive').length,
      deceasedMembers: deceasedMembers.length,
      totalMembers: members.length,
    };
  }, [contributions, members, deceasedMembers]);

  const paginatedData = useMemo(() => {
    let data = [];
    if (reportType === 'contributions') data = contributions;
    else if (reportType === 'members') data = members;
    else if (reportType === 'claims') data = claims;
    else if (reportType === 'approvedClaims') data = approvedClaims;
    else if (reportType === 'deceasedMembers') data = deceasedMembers;

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
  }, [reportType, contributions, members, claims, approvedClaims, deceasedMembers, page, limit]);

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
          ['', ''],
          ['Total Members', metrics.totalMembers.toString()],
          ['Active Members', metrics.activeMembers.toString()],
          ['Inactive Members', metrics.inactiveMembers.toString()],
          ['Deceased Members', metrics.deceasedMembers.toString()],
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
      } else if (reportType === 'members') {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Members Report', 14, startY);
        const memberData = members.slice(0, 200).map(m => [
          m.id || m.memberId, m.name || m.memberName, m.barangay || 'N/A', m.status || 'active', m.join_date || 'N/A',
        ]);
        autoTable(doc, {
          startY: startY + 5,
          head: [['ID', 'Name', 'Barangay', 'Status', 'Join Date']],
          body: memberData,
          theme: 'striped',
          headStyles: { fillColor: COOP_GREEN_RGB, fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
        });
      } else if (reportType === 'claims' || reportType === 'approvedClaims') {
        const source = reportType === 'claims' ? claims : approvedClaims;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(reportType === 'claims' ? 'Claims Report' : 'Approved Claims Report', 14, startY);
        const claimData = source.slice(0, 200).map(c => [
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
      csvContent += `"Total Members","${metrics.totalMembers}"\n`;
      csvContent += `"Active Members","${metrics.activeMembers}"\n`;
      csvContent += `"Inactive Members","${metrics.inactiveMembers}"\n`;
      csvContent += `"Deceased Members","${metrics.deceasedMembers}"\n`;
    } else if (reportType === 'contributions') {
      filename = `contributions-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Date,Member ID,Member Name,Amount,Status\n';
      contributions.forEach(c => {
        csvContent += `"${new Date(c.payment_date || c.created_at).toLocaleDateString()}","${c.member_id}","${c.member_name || ''}","${c.amount}","${c.status}"\n`;
      });
    } else if (reportType === 'members') {
      filename = `members-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Email,Contact,Barangay,Status,Join Date\n';
      members.forEach(m => {
        csvContent += `"${m.id || m.memberId}","${m.name || m.memberName}","${m.email || ''}","${m.contact || m.phoneNumber || ''}","${m.barangay || ''}","${m.status}","${m.join_date || ''}"\n`;
      });
    } else if (reportType === 'claims' || reportType === 'approvedClaims') {
      const source = reportType === 'claims' ? claims : approvedClaims;
      filename = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Claim ID,Member,Beneficiary,Date Filed,Status\n';
      source.forEach(c => {
        csvContent += `"${c.claimId}","${c.memberName}","${c.beneficiaryName}","${new Date(c.dateFiled).toLocaleDateString()}","${getClaimStatusMeta(c.status).label}"\n`;
      });
    } else if (reportType === 'deceasedMembers') {
      filename = `deceased-members-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'ID,Name,Barangay,Join Date\n';
      deceasedMembers.forEach(m => {
        csvContent += `"${m.id || m.memberId}","${m.name || m.memberName}","${m.barangay || ''}","${m.join_date || ''}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
            <DollarSign className="w-5 h-5 text-blue-600" />
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
              <div className="p-5 grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Financial Metrics</p>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Total Fund Balance</span>
                    <span className="font-semibold text-slate-900">₱{(stats?.fundBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-slate-500">Total Contributions</span>
                    <span className="font-semibold text-coop-green">₱{metrics.totalContributions.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Member Statistics</p>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Total</span><span className="font-semibold text-slate-900">{metrics.totalMembers}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Active</span><span className="font-semibold text-coop-green">{metrics.activeMembers}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                    <span className="text-slate-500">Inactive</span><span className="font-semibold text-amber-600">{metrics.inactiveMembers}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-slate-500">Deceased</span><span className="font-semibold text-rose-600">{metrics.deceasedMembers}</span>
                  </div>
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

            {reportType === 'members' && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">ID</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Barangay</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Join Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.data.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 text-xs text-slate-500">#{m.id || m.memberId}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-900">{m.name || m.memberName}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.barangay || 'N/A'}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-600">{m.status}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{m.join_date || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {(reportType === 'claims' || reportType === 'approvedClaims') && (
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
