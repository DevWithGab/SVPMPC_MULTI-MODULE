import React from 'react';
import { DollarSign, TrendingUp, Activity, Search, FileText, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

const exportToCSV = (data, filename) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => 
    Object.values(obj).map(val => 
      typeof val === 'string' ? `"${String(val).replace(/"/g, '""')}"` : val
    ).join(',')
  ).join('\n');
  const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const Contributions = ({ 
  contributions, contributionSearch, setContributionSearch, 
  contributionStatusFilter, setContributionStatusFilter, setIsAddContributionOpen 
}) => {
  const filteredContributions = contributions.filter((c) => {
    const matchesSearch = (c.member_name?.toLowerCase() || '').includes(contributionSearch.toLowerCase()) || 
                         c.id?.toString().includes(contributionSearch);
    const matchesStatus = contributionStatusFilter === 'all' || (c.status?.toLowerCase() || '') === contributionStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalCollected = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCollected = contributions
    .filter((c) => c.payment_date?.startsWith(thisMonth))
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const pendingCount = contributions.filter((c) => (c.status?.toLowerCase() || '') === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Contributions</h2>
          <p className="text-slate-500 mt-1">Manage and track member mortuary fund payments</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Button variant="outline" onClick={() => exportToCSV(contributions, 'contributions')} className="border-slate-200/60 flex-1 md:flex-none">
            <FileText className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button className="bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg shadow-slate-200/40 flex-1 md:flex-none" onClick={() => setIsAddContributionOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">₱{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </Card>
        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">This Month</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">₱{thisMonthCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </Card>
        <Card className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Verification</p>
              <p className="text-2xl font-bold text-amber-800 mt-1">{pendingCount}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <Activity className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold text-slate-800">Payment History</CardTitle>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {['all', 'paid', 'pending'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setContributionStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      contributionStatusFilter === status 
                        ? 'bg-white text-emerald-800 shadow-lg shadow-slate-200/40' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by member or ID..." 
                  className="pl-9 h-9 text-sm border-slate-200/60 focus:ring-emerald-600" 
                  value={contributionSearch}
                  onChange={(e) => setContributionSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-bold text-slate-600">Date</TableHead>
                <TableHead className="font-bold text-slate-600">Member</TableHead>
                <TableHead className="font-bold text-slate-600">Amount</TableHead>
                <TableHead className="font-bold text-slate-600">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContributions.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-slate-600 font-medium">{c.payment_date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{c.member_name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: #{c.member_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-emerald-800 text-lg">₱{c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={c.status.toLowerCase() === 'paid' ? 'default' : 'secondary'}
                      className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        c.status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50">
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContributions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center">
                      <Search className="w-8 h-8 mb-2 opacity-20" />
                      <p className="font-medium">No contributions found matching your criteria.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>
    </div>
  );
};

export default Contributions;
