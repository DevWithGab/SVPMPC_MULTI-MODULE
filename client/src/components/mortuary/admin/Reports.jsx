import React, { useState, useMemo } from 'react';
import { Download, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Pagination, PaginationInfo } from '../../ui/pagination';
import { usePagination } from '../../../hooks/usePagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports = ({ contributions = [], payouts = [], stats = {}, members = [] }) => {
  const [reportType, setReportType] = useState('summary');
  const { page, limit, setPage } = usePagination(1, 10);

  // Calculate financial metrics
  const metrics = useMemo(() => {
    const totalContributions = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Status breakdown
    const activeMembers = members.filter(m => m.status === 'active').length;
    const inactiveMembers = members.filter(m => m.status === 'inactive').length;
    const deceasedMembers = members.filter(m => m.status === 'deceased').length;

    return {
      totalContributions,
      activeMembers,
      inactiveMembers,
      deceasedMembers,
      totalMembers: members.length
    };
  }, [contributions, members]);

  // Paginate data for display
  const paginatedData = useMemo(() => {
    let data = [];
    let total = 0;

    if (reportType === 'contributions') {
      data = contributions;
      total = contributions.length;
    } else if (reportType === 'members') {
      data = members;
      total = members.length;
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      data: data.slice(startIndex, endIndex),
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: endIndex < total,
      hasPrevPage: page > 1
    };
  }, [reportType, contributions, members, page, limit]);

  // Generate PDF Report
  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('SVPMPC Mortuary Fund Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 34);
      
      // Reset color
      doc.setTextColor(0);
      
      let startY = 45;

      if (reportType === 'summary') {
        // Financial Summary
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
          ['Deceased Members', metrics.deceasedMembers.toString()]
        ];
        
        autoTable(doc, {
          startY: startY + 5,
          head: [['Metric', 'Value']],
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [45, 122, 62], fontSize: 10, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 100 },
            1: { halign: 'right', cellWidth: 80 }
          }
        });
      } else if (reportType === 'contributions') {
        // Contributions Report
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Contributions Report', 14, startY);
        
        const contribData = contributions.slice(0, 50).map(c => [
          new Date(c.payment_date || c.created_at).toLocaleDateString(),
          c.member_name || `Member #${c.member_id}`,
          `P${c.amount || 0}`,
          c.status || 'Paid'
        ]);
        
        autoTable(doc, {
          startY: startY + 5,
          head: [['Date', 'Member', 'Amount', 'Status']],
          body: contribData,
          theme: 'striped',
          headStyles: { fillColor: [45, 122, 62], fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: {
            2: { halign: 'right' }
          }
        });
        
        // Summary at bottom
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: P${metrics.totalContributions}`, 14, finalY);
        doc.text(`Count: ${contributions.length} transactions`, 120, finalY);
      } else if (reportType === 'members') {
        // Members Report
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Members Report', 14, startY);
        
        const memberData = members.slice(0, 50).map(m => [
          m.id || m.memberId,
          m.name || m.memberName,
          m.barangay || 'N/A',
          m.status || 'active',
          m.join_date || 'N/A'
        ]);
        
        autoTable(doc, {
          startY: startY + 5,
          head: [['ID', 'Name', 'Barangay', 'Status', 'Join Date']],
          body: memberData,
          theme: 'striped',
          headStyles: { fillColor: [45, 122, 62], fontSize: 9, fontStyle: 'bold' },
          styles: { fontSize: 8 }
        });
        
        // Summary at bottom
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Members: ${members.length}`, 14, finalY);
      }
      
      // Footer
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

  // Export to CSV
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#2D7A3E" }}>Financial Reports</h2>
          <p className="text-gray-600 font-medium">Comprehensive mortuary fund analytics and reporting</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Total Contributions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 truncate">₱{metrics.totalContributions.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl flex-shrink-0 ml-3">
                <TrendingUp className="w-6 h-6 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Fund Balance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 truncate">₱{(stats?.fundBalance || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0 ml-3">
                <DollarSign className="w-6 h-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">Active Members</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{metrics.activeMembers}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl flex-shrink-0 ml-3">
                <Users className="w-6 h-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Type Selection and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Type Selector */}
        <Card className="lg:col-span-1 border-gray-200 shadow-sm h-fit">
          <CardHeader className="bg-gray-50 border-b border-gray-100">
            <CardTitle className="font-bold uppercase tracking-wider" style={{ color: "#2D7A3E" }}>Report Type</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {[
              { id: 'summary', label: 'Financial Summary', icon: FileText },
              { id: 'contributions', label: 'Contributions', icon: TrendingUp },
              { id: 'members', label: 'Members', icon: Users }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setReportType(type.id)}
                className={`w-full flex items-center p-3 rounded-lg border transition-all ${
                  reportType === type.id 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm' 
                    : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <type.icon className={`w-4 h-4 mr-3 ${reportType === type.id ? 'text-emerald-700' : 'text-gray-400'}`} />
                <span className="text-xs font-bold">{type.label}</span>
              </button>
            ))}

            <div className="pt-4 space-y-2">
              <Button 
                onClick={generatePDF}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-5 rounded-lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                onClick={exportToCSV}
                variant="outline"
                className="w-full font-bold text-xs py-5 rounded-lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Preview */}
        <Card className="lg:col-span-3 border-gray-200 shadow-sm max-h-[600px] flex flex-col">
          <CardHeader className="bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-bold uppercase tracking-wider" style={{ color: "#2D7A3E" }}>
                  {reportType === 'summary' && 'Financial Summary'}
                  {reportType === 'contributions' && 'Recent Contributions'}
                  {reportType === 'members' && 'Member Directory'}
                </CardTitle>
                <CardDescription className="text-xs mt-1 font-medium text-gray-400">
                  {reportType === 'summary' && 'Overview of fund performance'}
                  {reportType === 'contributions' && `${contributions.length} total transactions`}
                  {reportType === 'members' && `${members.length} total members`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            <div className="overflow-x-auto">
              {reportType === 'summary' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Financial Metrics</p>
                      <div className="space-y-1">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Total Fund Balance</span>
                          <span className="text-sm font-bold text-gray-900">₱{(stats?.fundBalance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Total Contributions</span>
                          <span className="text-sm font-bold text-emerald-700">₱{metrics.totalContributions.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-sm text-gray-600 font-bold">Fund Balance</span>
                          <span className="text-sm font-bold text-gray-900">₱{(stats?.fundBalance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Member Statistics</p>
                      <div className="space-y-1">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Total Members</span>
                          <span className="text-sm font-bold text-gray-900">{metrics.totalMembers}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Active</span>
                          <span className="text-sm font-bold text-emerald-700">{metrics.activeMembers}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Inactive</span>
                          <span className="text-sm font-bold text-amber-600">{metrics.inactiveMembers}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-sm text-gray-600">Deceased</span>
                          <span className="text-sm font-bold text-gray-500">{metrics.deceasedMembers}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reportType === 'contributions' && (
                <>
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Date</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Member</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Amount</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.data.map((c, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs text-gray-600">
                            {new Date(c.payment_date || c.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-gray-900">
                            {c.member_name || `Member #${c.member_id}`}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-700">
                            ₱{(c.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-emerald-100 text-emerald-800 text-xs">
                              {c.status || 'Paid'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <PaginationInfo 
                      currentPage={page}
                      limit={limit}
                      total={paginatedData.total}
                    />
                    <Pagination
                      currentPage={page}
                      totalPages={paginatedData.totalPages}
                      onPageChange={setPage}
                      hasNextPage={paginatedData.hasNextPage}
                      hasPrevPage={paginatedData.hasPrevPage}
                    />
                  </div>
                </>
              )}

              {reportType === 'members' && (
                <>
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">ID</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Name</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Barangay</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Join Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.data.map((m, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs text-gray-600">#{m.id || m.memberId}</TableCell>
                          <TableCell className="text-xs font-bold text-gray-900">{m.name || m.memberName}</TableCell>
                          <TableCell className="text-xs text-gray-600">{m.barangay || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={m.status === 'active' ? 'default' : 'secondary'}
                              className={m.status === 'active' ? 'bg-emerald-100 text-emerald-800 text-xs' : 'text-xs'}
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">{m.join_date || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <PaginationInfo 
                      currentPage={page}
                      limit={limit}
                      total={paginatedData.total}
                    />
                    <Pagination
                      currentPage={page}
                      totalPages={paginatedData.totalPages}
                      onPageChange={setPage}
                      hasNextPage={paginatedData.hasNextPage}
                      hasPrevPage={paginatedData.hasPrevPage}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
