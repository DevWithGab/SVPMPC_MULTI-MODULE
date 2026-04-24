import React, { useState, useEffect } from 'react';
import { Download, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const Reports = ({ activeTab, contributions, payouts, stats }) => {
  const [reportType, setReportType] = useState('contributions');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (activeTab === 'monthly-contributions') setReportType('contributions');
    if (activeTab === 'payout-disbursements') setReportType('payouts');
    if (activeTab === 'fund-balance') setReportType('fund-balance');
  }, [activeTab]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const title = reportType === 'contributions' ? 'Monthly Contribution Summary' : 
                  reportType === 'payouts' ? 'Payout Disbursement Report' : 
                  'Fund Balance Statement';
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    let tableData = [];
    let tableHeaders = [];

    if (reportType === 'contributions') {
      tableHeaders = ['Date', 'Member Name', 'Member ID', 'Amount', 'Status'];
      tableData = contributions.map((c) => [c.payment_date, c.member_name, `#${c.member_id}`, `₱${c.amount.toLocaleString()}`, c.status]);
    } else if (reportType === 'payouts') {
      tableHeaders = ['Date', 'Beneficiary', 'Member Name', 'Method', 'Amount'];
      tableData = payouts.map((p) => [p.payout_date, p.beneficiary, p.member_name, p.payment_method, `₱${p.amount.toLocaleString()}`]);
    } else {
      tableHeaders = ['Metric', 'Value'];
      tableData = [
        ['Total Fund Balance', `₱${stats?.fundBalance?.toLocaleString() || '0'}`],
        ['Total Collected', `₱${contributions.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}`],
        ['Total Payouts', `₱${payouts.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}`]
      ];
    }

    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`${reportType}-report.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-950 tracking-tight">Financial Reports</h2>
          <p className="text-slate-500 mt-1">Generate and export detailed financial statements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-slate-200/60 shadow-lg shadow-slate-200/40 overflow-hidden h-fit lg:sticky lg:top-24">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-slate-800 text-sm font-black uppercase tracking-widest">Report Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                {[
                  { id: 'contributions', label: 'Contribution Summary', icon: CreditCard },
                  { id: 'payouts', label: 'Payout Disbursement', icon: DollarSign },
                  { id: 'fund-balance', label: 'Fund Ledger Statement', icon: DollarSign }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setReportType(type.id)}
                    className={`flex items-center p-3 rounded-xl border transition-all ${
                      reportType === type.id 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-lg shadow-slate-200/40' 
                        : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <type.icon className={`w-4 h-4 mr-3 ${reportType === type.id ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                onClick={generatePDF}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase tracking-widest text-[10px] py-6 rounded-xl shadow-lg shadow-emerald-100"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200/60 shadow-lg shadow-slate-200/40 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-slate-800 text-sm font-black uppercase tracking-widest">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-8 text-center text-slate-400">
              <p className="text-xs font-bold uppercase tracking-widest italic">A live preview of the generated report will appear here when exported.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
