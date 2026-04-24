import React, { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

export default function LedgerReports({ user }) {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">Ledger Reports</h1>
        <p className="text-slate-500 text-sm font-bold mt-1">Generate and export fund ledger reports</p>
      </div>

      {/* Report Generation */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-coop-green" /> 
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">End Date</label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <Button className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl">
            <Download className="w-4 h-4 mr-2" />
            Generate & Download Report
          </Button>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-coop-green" /> 
            Report History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-bold text-lg">No reports generated</p>
            <p className="text-sm">Generated reports will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}