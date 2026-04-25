import React, { useState } from 'react';
import { Search, CreditCard, Mail, ChevronRight } from 'lucide-react';
import { Card } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

const extractBarangay = (address) => {
  if (!address) return 'Not Specified';
  const parts = address.split(',');
  return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
};

const MemberBalances = ({ 
  members, 
  searchQuery, 
  setSearchQuery,
  barangayFilter,
  setBarangayFilter,
  memberFilter,
  setMemberFilter,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  handleQuickDeposit,
  setSmsData,
  setIsSmsModalOpen,
  setIsBulkDeductOpen,
  setIsAddClaimOpen
}) => {
  const lowBalanceMembers = members.filter(m => m.balance < 1000);
  const totalCapital = members.reduce((s, m) => s + (m.balance || 0), 0);
  const lowBalancePercent = members.length > 0 ? (lowBalanceMembers.length / members.length) * 100 : 0;

  const filteredMembers = members
    .filter(m => (memberFilter === 'low' ? m.balance < 1000 : true))
    .filter(m => (barangayFilter === 'All' ? true : extractBarangay(m.address) === barangayFilter))
    .filter(m => (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.id?.toString().includes(searchQuery)));
    
  const totalPagesMemberBalances = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
  const currentMembersBalancesChunk = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Member Balance</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Audit Standing & Capital Monitoring</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button 
            onClick={setIsBulkDeductOpen}
            variant="outline" 
            className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 font-black uppercase text-[10px] tracking-widest px-6 h-12 shadow-sm"
          >
            Custom Bulk Deduction
          </Button>
          <Button 
            onClick={setIsAddClaimOpen}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl shadow-xl shadow-rose-100 font-black uppercase text-[10px] tracking-widest px-8 h-12 transform hover:-translate-y-1 transition-all"
          >
            Trigger Death Deduction
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg group hover:border-green-200 transition-colors">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Capital Pool</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">₱{totalCapital.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2">
            <div className="px-2 py-0.5 bg-green-50 text-coop-green rounded-lg text-[9px] font-black uppercase">Official Fund</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg group hover:border-rose-200 transition-colors">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Low Balance Warning</p>
          <p className="text-3xl font-black text-rose-600 tracking-tighter">{lowBalanceMembers.length}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Members below ₱1,000</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Exposure Risk</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{lowBalancePercent.toFixed(1)}%</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${lowBalancePercent > 20 ? 'bg-rose-500' : 'bg-coop-green'}`} 
              style={{ width: `${lowBalancePercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => setMemberFilter('all')}
            className={`rounded-xl px-4 py-2 font-black uppercase text-[9px] tracking-widest transition-all ${memberFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            All Members ({members.length})
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setMemberFilter('low')}
            className={`rounded-xl px-4 py-2 font-black uppercase text-[9px] tracking-widest transition-all ${memberFilter === 'low' ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' : 'text-slate-400 hover:text-rose-600'}`}
          >
            At Risk Only ({lowBalanceMembers.length})
          </Button>
        </div>
        
        <div className="flex gap-4 flex-wrap sm:flex-nowrap w-full md:w-auto">
          <div className="relative w-full sm:w-56">
            <p className="absolute -top-5 left-1 text-[8px] font-black uppercase text-slate-400 tracking-widest">Filter by Barangay</p>
            <select 
              className="w-full h-12 rounded-2xl bg-white border-slate-200 shadow-sm focus:ring-coop-green/20 text-xs font-black uppercase tracking-widest px-4 appearance-none cursor-pointer hover:border-green-200 transition-colors"
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
            >
              {['All', ...Array.from(new Set(members.map(m => extractBarangay(m.address))))].sort().map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search identity index..." 
              className="pl-12 rounded-2xl h-12 bg-white border-slate-200 shadow-xl shadow-slate-100 focus:ring-coop-green/20 font-medium" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* Members Table */}
      <Card className="rounded-[3rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white border">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="px-10 h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Account Identity</TableHead>
              <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verified Balance</TableHead>
              <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lifecycle</TableHead>
              <TableHead className="px-10 h-20 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Communications</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentMembersBalancesChunk.map(m => (
              <TableRow key={m.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-50 group">
                <TableCell className="px-10 py-6">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm tracking-tighter shadow-lg transition-all group-hover:scale-110 ${m.balance < 1000 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-green-50 text-coop-green border border-green-100'}`}>
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{m.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">UID-{m.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className={`text-xl font-black tabular-nums transition-colors ${m.balance < 1000 ? 'text-rose-600' : 'text-slate-900 group-hover:text-coop-green'}`}>
                      ₱{m.balance?.toLocaleString()}
                    </p>
                    {m.balance < 1000 && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Maintenance Alert</p>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-lg px-2 py-1 text-[8px] font-black uppercase border-slate-200 text-slate-500 tracking-widest group-hover:border-green-200 group-hover:text-coop-green transition-colors">
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-10 text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl border-green-200 text-coop-green hover:bg-green-50 font-black uppercase text-[10px] tracking-widest h-12 px-6 shadow-sm group-hover:border-green-300 transition-all"
                      onClick={(e) => { e.stopPropagation(); handleQuickDeposit(m.id); }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Quick Deposit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-6 transition-all transform hover:-translate-y-0.5 ${m.balance < 1000 ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'}`}
                      onClick={() => { setSmsData({ memberId: m.id, message: '', memberName: m.name }); setIsSmsModalOpen(true); }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Send Notice
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Search className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No member identifiers matched</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredMembers.length)} of {filteredMembers.length} active records
          </p>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="text-[10px] font-black uppercase tracking-widest hover:text-coop-green focus:ring-2 focus:ring-coop-green/20 px-4"
            >
              Previous
            </Button>
            <Button 
              variant="ghost" 
              disabled={currentPage === totalPagesMemberBalances}
              onClick={() => setCurrentPage(p => Math.min(totalPagesMemberBalances, p + 1))}
              className="text-[10px] font-black uppercase tracking-widest text-coop-green hover:bg-green-50 focus:ring-2 focus:ring-coop-green/20 px-4"
            >
              Next Page
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MemberBalances;