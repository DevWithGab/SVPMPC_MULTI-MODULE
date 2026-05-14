import React from 'react';
import { Search, Plus, TrendingUp, Calendar, CreditCard, BarChart3, Clock3 } from 'lucide-react';
import { Card } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

const Contributions = ({ 
  contributions, 
  paymentSearchQuery, 
  setPaymentSearchQuery,
  setIsAddContributionOpen 
}) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const contributionsToday = contributions.filter(c => c.payment_date === today);
  const totalToday = contributionsToday.reduce((sum, c) => sum + (c.amount || 0), 0);
  const contributionsMonth = contributions.filter(c => c.payment_date?.startsWith(currentMonth));
  const totalMonth = contributionsMonth.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  const filteredContributions = contributions.filter(c => 
    c.memberName?.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
    c.member_name?.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
    c.memberId?.toString().includes(paymentSearchQuery) ||
    c.member_id?.toString().includes(paymentSearchQuery)
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Record Payments</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Contribution Processing & Inflow Management</p>
          </div>
          <Button 
            onClick={() => setIsAddContributionOpen(true)} 
            className="inline-flex items-center gap-3 rounded-2xl border border-coop-green/20 bg-coop-green px-6 h-12 text-white shadow-xl shadow-emerald-100 font-black uppercase text-[10px] tracking-[0.28em] transition-all duration-300 hover:-translate-y-0.5 hover:bg-coop-darkGreen hover:shadow-2xl hover:shadow-emerald-200 focus:ring-2 focus:ring-coop-green/20"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <Plus className="w-4 h-4" />
            </span>
            <span>Record New Payment</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <CreditCard className="w-6 h-6 text-coop-green" />
            </div>
            <Badge className="bg-green-50 text-coop-green border-none uppercase tracking-widest text-[9px] font-black">
              Today
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Collection Today</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-3">₱{totalToday.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock3 className="w-4 h-4 text-coop-green" />
            <p className="text-xs font-bold">{contributionsToday.length} transactions processed</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <Calendar className="w-6 h-6 text-slate-600" />
            </div>
            <Badge className="bg-slate-50 text-slate-600 border-none uppercase tracking-widest text-[9px] font-black">
              Month
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Current Month Cycle</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-3">₱{totalMonth.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <BarChart3 className="w-4 h-4 text-slate-600" />
            <p className="text-xs font-bold">Active fiscal month: {new Date().toLocaleString('default', { month: 'long' })}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-coop-green" />
            </div>
            <Badge className="bg-emerald-50 text-coop-green border-none uppercase tracking-widest text-[9px] font-black">
              Verified
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">System Performance</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-3">{contributions.length}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <CreditCard className="w-4 h-4 text-coop-green" />
            <p className="text-xs font-bold">Total transaction logs verified</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="p-6 rounded-xl border-slate-200 shadow-lg bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Search records</p>
              <p className="text-xs font-bold text-slate-500">Match by member name, ID, or OR reference</p>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search OR / Member Identity..." 
            className="pl-12 rounded-lg h-11 bg-white border-slate-200 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500 font-medium" 
            value={paymentSearchQuery} 
            onChange={e => setPaymentSearchQuery(e.target.value)} 
          />
        </div>
        </div>
      </Card>

      {/* Contributions Table */}
      <Card className="rounded-lg border-slate-200/60 shadow-2xl overflow-hidden bg-white border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100">
                <TableHead className="px-10 h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Timeline</TableHead>
                <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Contributor Details</TableHead>
                <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount Processed</TableHead>
                <TableHead className="px-10 h-20 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContributions.slice(0, 50).map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/80 transition-all border-b border-slate-50 group">
                  <TableCell className="px-10 py-6">
                    <div className="space-y-1">
                      <p className="font-black text-slate-950 text-base tabular-nums leading-none tracking-tight">{c.payment_date}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Entry Ref: #{c.id.toString().padStart(6, '0')}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-black text-xs uppercase group-hover:bg-green-50 group-hover:text-coop-green transition-all">
                        {c.member_name?.charAt(0) || 'M'}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 group-hover:text-coop-green transition-colors">{c.member_name || `Member #${c.member_id}`}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">UID: {c.member_id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xl font-black text-slate-950 tabular-nums leading-none tracking-tight">₱{c.amount?.toLocaleString()}</p>
                  </TableCell>
                  <TableCell className="px-10 text-right">
                    <Badge className="bg-green-50 text-coop-green border border-green-100 rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-sm">
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContributions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <TrendingUp className="w-12 h-12 mb-4 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">No contribution records found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredContributions.length > 50 && (
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Showing most recent 50 transactions for processing speed</p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{filteredContributions.length} total records match the current search</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Contributions;