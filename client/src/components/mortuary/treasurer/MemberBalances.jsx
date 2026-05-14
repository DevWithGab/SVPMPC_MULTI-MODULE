import React, { useState } from 'react';
import { Search, ChevronRight, TrendingDown, AlertCircle, CheckCircle2, Wallet, Users } from 'lucide-react';
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Member Balance</h2>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Capital Monitoring & Risk Assessment</p>
          </div>
          
          {/* Action Button */}
          <Button 
            onClick={setIsAddClaimOpen}
            className="bg-red-700 hover:bg-red-800 text-white rounded-lg shadow-lg font-black uppercase text-[10px] tracking-widest px-6 h-11 flex items-center gap-2 transition-all hover:shadow-xl"
          >
            <TrendingDown className="w-4 h-4" />
            <span>Trigger Death Deduction</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Capital Card */}
        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Wallet className="w-6 h-6 text-coop-green" />
            </div>
            <Badge className="bg-green-50 text-coop-green border-none uppercase tracking-widest text-[9px] font-black">
              Official Fund
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Total Capital Pool</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-3">₱{totalCapital.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-coop-green" />
            <p className="text-xs font-bold">Verified & Secured</p>
          </div>
        </div>

        {/* Low Balance Warning Card */}
        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-700" />
            </div>
            <Badge className="bg-red-50 text-red-700 border-none uppercase tracking-widest text-[9px] font-black">
              Alert Status
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Low Balance Warning</p>
          <p className="text-4xl font-black text-red-700 tracking-tighter mb-3">{lowBalanceMembers.length}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="w-4 h-4 text-red-700" />
            <p className="text-xs font-bold">Members below ₱1,000</p>
          </div>
        </div>

        {/* Exposure Risk Card */}
        <div className="bg-white p-8 rounded-xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 group hover:shadow-slate-300/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-slate-600" />
            </div>
            <Badge className={`${lowBalancePercent > 20 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-coop-green'} border-none uppercase tracking-widest text-[9px] font-black`}>
              {lowBalancePercent > 20 ? 'High Risk' : 'Low Risk'}
            </Badge>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Exposure Risk</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-4">{lowBalancePercent.toFixed(1)}%</p>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${lowBalancePercent > 20 ? 'bg-red-600' : 'bg-coop-green'}`} 
              style={{ width: `${lowBalancePercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Filters & Search Section */}
      <Card className="p-6 rounded-xl border-slate-200 shadow-lg bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Filter Tabs */}
          <div className="flex bg-slate-50 p-1.5 rounded-lg border border-slate-200 shadow-sm flex-wrap">
            <Button 
              variant="ghost" 
              onClick={() => setMemberFilter('all')}
              className={`rounded-lg px-5 py-2.5 font-black uppercase text-[9px] tracking-widest transition-all ${
                memberFilter === 'all' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white'
              }`}
            >
              All Members ({members.length})
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setMemberFilter('low')}
              className={`rounded-lg px-5 py-2.5 font-black uppercase text-[9px] tracking-widest transition-all ${
                memberFilter === 'low' 
                  ? 'bg-red-700 text-white shadow-md shadow-red-100' 
                  : 'text-slate-400 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              At Risk Only ({lowBalanceMembers.length})
            </Button>
          </div>
          
          {/* Search & Barangay Filter */}
          <div className="flex gap-3 flex-wrap sm:flex-nowrap w-full lg:w-auto">
            <div className="relative w-full sm:w-56">
              <p className="absolute -top-5 left-1 text-[8px] font-black uppercase text-slate-400 tracking-widest">Filter by Barangay</p>
              <select 
                className="w-full h-11 rounded-lg bg-white border-slate-200 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-black uppercase tracking-widest px-4 appearance-none cursor-pointer hover:border-slate-300 transition-colors"
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
                placeholder="Search member name or ID..." 
                className="pl-12 rounded-lg h-11 bg-white border-slate-200 shadow-sm focus:ring-emerald-500/20 focus:border-emerald-500 font-medium" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
        </div>
      </Card>
      {/* Members Table */}
      <Card className="rounded-lg border-slate-200/60 shadow-2xl overflow-hidden bg-white border">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="px-10 h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Account Identity</TableHead>
              <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verified Balance</TableHead>
              <TableHead className="px-10 h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lifecycle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentMembersBalancesChunk.map(m => (
              <TableRow key={m.id} className="hover:bg-slate-50/80 transition-all border-b border-slate-100 group">
                <TableCell className="px-10 py-6">
                  <div className="flex items-center gap-5">
                    <div className="relative group/avatar">
                      {/* Main Avatar - Circular with professional colors */}
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl tracking-tighter shadow-md transition-all duration-500 group-hover:scale-110 relative overflow-hidden ${
                        m.balance < 1000 
                          ? 'bg-slate-700 text-white group-hover:shadow-lg group-hover:shadow-slate-400/30' 
                          : 'bg-slate-800 text-white group-hover:shadow-lg group-hover:shadow-slate-500/30'
                      }`}>
                        {/* Subtle shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <span className="relative z-10">{m.name.charAt(0)}</span>
                      </div>
                      
                      {/* Status Badge - Professional styling */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-3 border-white shadow-sm flex items-center justify-center ${
                        m.balance >= 1000 
                          ? 'bg-emerald-600' 
                          : 'bg-amber-500'
                      }`}>
                        {m.balance >= 1000 ? (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 leading-tight text-base truncate group-hover:text-slate-700 transition-colors">{m.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          UID-{m.id.toString().padStart(6, '0')}
                        </p>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${m.balance >= 1000 ? 'bg-emerald-600' : 'bg-amber-500'}`}></div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            {m.balance >= 1000 ? 'Good Standing' : 'Needs Attention'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <p className={`text-2xl font-black tabular-nums transition-colors ${
                      m.balance < 1000 ? 'text-slate-700' : 'text-slate-900 group-hover:text-slate-700'
                    }`}>
                      ₱{m.balance?.toLocaleString()}
                    </p>
                    {m.balance < 1000 && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg w-fit">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        <p className="text-[9px] font-black uppercase text-amber-700 tracking-widest">Requires Attention</p>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-10">
                  <Badge 
                    variant="outline" 
                    className={`rounded-lg px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${
                      m.status === 'active' 
                        ? 'border-green-200 text-coop-green bg-green-50 group-hover:border-green-300 group-hover:bg-green-100' 
                        : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}
                  >
                    {m.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-64 text-center">
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