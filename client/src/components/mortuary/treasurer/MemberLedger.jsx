import React, { useState } from 'react';
import { 
  Search, ArrowLeft, Printer, CreditCard, FileText, DollarSign, 
  ChevronRight, MessageSquare, ArrowRight, Upload, X, Loader,
  Download, Filter, Calendar, TrendingUp, TrendingDown, Activity,
  User, MapPin, Users
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';
import { treasurerAPI } from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const extractBarangay = (address) => {
  if (!address) return 'Not Specified';
  const parts = address.split(',');
  return parts[0].trim().replace(/^Brgy\.\s*/i, '').replace(/^Barangay\s*/i, '');
};

const MemberLedger = ({ 
  members,
  ledgerMembers = [],
  ledger,
  selectedLedgerMember,
  setSelectedLedgerMember,
  searchQuery,
  setSearchQuery,
  barangayFilter,
  setBarangayFilter,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  pagination,
  setIsAddContributionOpen,
  handleTriggerAutomatedNotice,
  showToast,
  refreshData
}) => {
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState('all'); // all, deposits, withdrawals
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  const handleCSVUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV properly handling quoted fields
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        const preview = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
          }, {});
        });
        setCsvPreview(preview);
      };
      reader.readAsText(file);
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile) return;
    
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV properly handling quoted fields
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        console.log('Ledger CSV Headers:', headers);
        
        const ledgerEntries = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = parseCSVLine(line);
            console.log(`Ledger Row ${index + 1}:`, values);
            
            return {
              memberId: values[headers.indexOf('memberId')],
              transactionDate: values[headers.indexOf('transactionDate')],
              credit: parseFloat(values[headers.indexOf('credit')]) || 0,
              debit: parseFloat(values[headers.indexOf('debit')]) || 0,
              description: values[headers.indexOf('description')] || 'Bulk upload',
              transactionType: values[headers.indexOf('transactionType')] || '',
              referenceId: values[headers.indexOf('referenceId')] || values[headers.indexOf('ref_no')] || '',
              paymentMethod: values[headers.indexOf('paymentMethod')] || 'Cash',
              status: values[headers.indexOf('status')] || 'completed'
            };
          });

        console.log('Sending ledger entries:', ledgerEntries);
        const response = await treasurerAPI.bulkUploadLedger(ledgerEntries);
        console.log('Ledger upload response:', response);
        
        showToast(`Bulk upload complete! ${response.results.success.length} successful, ${response.results.failed.length} failed`, 'success');
        
        if (response.results.failed.length > 0) {
          console.log('Failed entries:', response.results.failed);
        }
        
        setShowBulkModal(false);
        setCsvFile(null);
        setCsvPreview([]);
        
        // Refresh ledger data without reloading page
        if (refreshData) {
          await refreshData();
        }
      };
      reader.readAsText(csvFile);
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Error uploading CSV: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  // Export ledger to CSV
  const exportLedgerToCSV = (entries, memberName) => {
    const headers = ['Date', 'Reference Number', 'Received', 'Withdrawn', 'Balance', 'Description'];
    const csvContent = [
      headers.join(','),
      ...entries.map(e => [
        e.date,
        e.ref_no,
        e.received || 0,
        e.withdrawn || 0,
        e.balance,
        `"${e.description || 'N/A'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${memberName.replace(/\s+/g, '_')}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Individual Member Ledger View
  if (selectedLedgerMember) {
    const currentMember = members.find(m => m.id === selectedLedgerMember.id) || selectedLedgerMember;
    
    // Filter and sort entries
    let mEntries = [...ledger].filter(l => l.member_id === currentMember.id);
    
    // Apply transaction type filter
    if (transactionFilter === 'deposits') {
      mEntries = mEntries.filter(e => e.received > 0);
    } else if (transactionFilter === 'withdrawals') {
      mEntries = mEntries.filter(e => e.withdrawn > 0);
    }
    
    // Apply date range filter
    if (dateRange.start) {
      mEntries = mEntries.filter(e => new Date(e.date) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      mEntries = mEntries.filter(e => new Date(e.date) <= new Date(dateRange.end));
    }
    
    // Sort entries by date (pure chronological order regardless of type)
    mEntries.sort((a, b) => {
      // Get dates with fallback handling
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      
      // Primary sort: by transaction date
      const dateDiff = sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      if (dateDiff !== 0) return dateDiff;
      
      // Secondary sort (if dates are identical): by received amount (newer transactions first)
      // This ensures stable sorting when dates are the same
      const receivedDiff = (b.received || 0) - (a.received || 0);
      return receivedDiff;
    });
    
    const totalReceived = mEntries.reduce((sum, e) => sum + (e.received || 0), 0);
    const totalWithdrawn = mEntries.reduce((sum, e) => sum + (e.withdrawn || 0), 0);
    const transactionCount = mEntries.length;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        {/* Header Controls */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Button 
              variant="ghost" 
              onClick={() => {
                setSelectedLedgerMember(null);
                setTransactionFilter('all');
                setDateRange({ start: '', end: '' });
                setSortOrder('desc');
              }}
              className="rounded-lg hover:bg-slate-100 flex items-center gap-2 font-black text-slate-700 uppercase text-[9px] tracking-[0.15em] px-4 h-11 border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Member List
            </Button>
            <div className="flex gap-3 flex-wrap">
              <Button 
                variant="outline"
                onClick={() => exportLedgerToCSV(mEntries, currentMember.name)}
                className="border-slate-300 text-slate-700 rounded-lg font-black uppercase text-[9px] tracking-[0.15em] px-6 h-11"
              >
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.print()}
                className="border-slate-300 text-slate-700 rounded-lg font-black uppercase text-[9px] tracking-[0.15em] px-6 h-11"
              >
                <Printer className="w-4 h-4 mr-2" /> Print Official Copy
              </Button>
              <Button 
                className="bg-coop-green text-white rounded-lg shadow-lg hover:bg-coop-darkGreen font-black uppercase text-[9px] tracking-[0.15em] px-6 h-11"
                onClick={() => setIsAddContributionOpen(true)}
              >
                <CreditCard className="w-4 h-4 mr-2" /> Add Deposit
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-6 rounded-lg border-slate-200 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Filter className="w-3 h-3" /> Transaction Type
                  </label>
                  <select
                    value={transactionFilter}
                    onChange={(e) => setTransactionFilter(e.target.value)}
                    className="w-full h-10 rounded-lg bg-white border-slate-200 text-xs font-bold px-3 cursor-pointer"
                  >
                    <option value="all">All Transactions</option>
                    <option value="deposits">Deposits Only</option>
                    <option value="withdrawals">Withdrawals Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full h-10 rounded-lg bg-white border-slate-200 text-xs font-bold px-3"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full h-10 rounded-lg bg-white border-slate-200 text-xs font-bold px-3"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-10"
                >
                  {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTransactionFilter('all');
                    setDateRange({ start: '', end: '' });
                    setSortOrder('desc');
                  }}
                  className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-10 text-slate-500"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
            
            {/* Filter Summary */}
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Transactions</p>
                <p className="text-lg font-black text-slate-900">{transactionCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase text-coop-green tracking-widest flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Total Deposits
                </p>
                <p className="text-lg font-black text-coop-green">₱{totalReceived.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase text-rose-600 tracking-widest flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Total Withdrawals
                </p>
                <p className="text-lg font-black text-rose-600">₱{totalWithdrawn.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Net Change
                </p>
                <p className={`text-lg font-black ${(totalReceived - totalWithdrawn) >= 0 ? 'text-coop-green' : 'text-rose-600'}`}>
                  ₱{(totalReceived - totalWithdrawn).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Ledger Document */}
        <div id="printable-ledger" className="bg-white border border-slate-200 shadow-2xl overflow-hidden print:border-none print:shadow-none min-h-screen flex flex-col relative">
          {/* Visual Anchor - Watermark */}
          <div className="absolute top-20 right-20 opacity-[0.02] pointer-events-none select-none hidden lg:block">
            <p className="text-[14rem] font-black leading-none tracking-tighter">MAF</p>
          </div>

          {/* Header Section */}
          <div className="p-12 border-b-2 border-slate-300 bg-white print:bg-white relative z-10">
            {/* Centered Professional Header */}
            <div className="text-center mb-10 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">Mortuary Assistance Fund</p>
              <h1 className="text-4xl font-black text-slate-950 tracking-tight">MEMBER LEDGER</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Official Financial Record</p>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-coop-green to-transparent mx-auto mt-4" />
            </div>

            {/* Member Information */}
            <div className="grid grid-cols-3 gap-x-12 gap-y-6 text-sm mb-8 border-t border-b border-slate-200 py-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Full Legal Name</p>
                <p className="text-base font-bold text-slate-900">{currentMember.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Member ID</p>
                <p className="text-base font-mono font-black text-slate-900">{currentMember.id.toString().padStart(6, '0')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Current Address</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.address || 'Not Provided'}</p>
              </div>
              <div className="space-y-1 col-span-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Beneficiary Information</p>
                <p className="text-sm font-medium text-slate-700">{currentMember.beneficiaries || 'Not Recorded'}</p>
              </div>
            </div>

            {/* Financial Summary Section */}
            <table className="w-full text-left border-collapse">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="py-5 pr-8">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Current Fund Standing</p>
                    <p className="text-3xl font-black text-slate-950">₱{currentMember.balance?.toLocaleString()}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-2">
                      {currentMember.balance >= 1000 ? 'Status: Maintained' : 'Status: Below Threshold'}
                    </p>
                  </td>
                  <td className="py-5 px-8 border-l border-slate-300">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Total Inflow</p>
                    <p className="text-2xl font-black text-slate-950">₱{totalReceived.toLocaleString()}</p>
                  </td>
                  <td className="py-5 px-8 border-l border-slate-300 text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Total Outflow</p>
                    <p className="text-2xl font-black text-slate-950">₱{totalWithdrawn.toLocaleString()}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Ledger Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white print:bg-slate-800 border-b-2 border-slate-700">
                <th className="py-4 px-10 text-left text-[9px] font-black uppercase tracking-[0.2em]">Transaction Date</th>
                <th className="py-4 px-10 text-left text-[9px] font-black uppercase tracking-[0.2em]">Reference Number</th>
                <th className="py-4 px-10 text-right text-[9px] font-black uppercase tracking-[0.2em]">Received</th>
                <th className="py-4 px-10 text-right text-[9px] font-black uppercase tracking-[0.2em]">Withdrawn</th>
                <th className="py-4 px-10 text-right text-[9px] font-black uppercase tracking-[0.2em]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {mEntries.length > 0 ? (
                mEntries.map((entry, idx) => (
                  <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors print:hover:bg-white">
                    <td className="py-4 px-10 font-mono text-sm font-bold text-slate-600">{entry.date}</td>
                    <td className="py-4 px-10 font-mono text-xs font-black text-slate-900 uppercase tracking-wide">{entry.ref_no}</td>
                    <td className="py-4 px-10 text-right">
                      <p className="text-sm font-black font-mono text-slate-950">
                        {entry.received > 0 ? `+₱${entry.received.toLocaleString()}` : '—'}
                      </p>
                    </td>
                    <td className="py-4 px-10 text-right">
                      <p className="text-sm font-black font-mono text-slate-950">
                        {entry.withdrawn > 0 ? `-₱${entry.withdrawn.toLocaleString()}` : '—'}
                      </p>
                    </td>
                    <td className="py-4 px-10 text-right">
                      <p className="text-sm font-black text-slate-950 font-mono tracking-tighter">₱{entry.balance.toLocaleString()}</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="h-64">
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <FileText className="w-16 h-16 mb-4 opacity-[0.05]" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        {transactionFilter !== 'all' || dateRange.start || dateRange.end 
                          ? 'No transactions match the selected filters' 
                          : 'No transaction history recorded yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

          {/* Footer - Official Document Section */}
          <div className="p-12 border-t-2 border-slate-300 bg-white mt-auto flex flex-col md:flex-row justify-between items-end gap-12">
            <div className="text-left space-y-3 max-w-md">
              <p className="text-[8px] leading-tight font-bold text-slate-600 uppercase tracking-[0.15em]">
                This document is an official record of the Mortuary Assistance Fund Financial Ledger and is intended for authorized personnel only.
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                Generated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} • {new Date().toLocaleTimeString()}
              </p>
            </div>
            <div className="text-right flex flex-col items-end space-y-6">
              <div className="space-y-2">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em]">Authorized By:</p>
                <div className="pt-12 border-t-2 border-slate-950 inline-block min-w-[320px] text-center">
                  <p className="font-black text-slate-950 text-sm uppercase tracking-tight">Federation Treasurer</p>
                  <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-[0.1em]">Signature / Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Member List View
  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(m => extractBarangay(m.address))))].sort();

  const visibleMembers = ledgerMembers;
  const totalMembers = pagination?.total ?? visibleMembers.length;
  const totalPages = pagination?.totalPages ?? (Math.ceil(totalMembers / itemsPerPage) || 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">Audit Ledger Index</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Search & Sector Filter for 7,000+ Records</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-56">
            <p className="absolute -top-5 left-1 text-[8px] font-black uppercase text-slate-400 tracking-widest">Filter by Barangay</p>
            <select 
              className="w-full h-12 rounded-2xl bg-white border-slate-200 shadow-sm focus:ring-coop-green/20 text-xs font-black uppercase tracking-widest px-4 appearance-none cursor-pointer hover:border-green-200 transition-colors"
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
            >
              {uniqueBarangays.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <p className="absolute -top-5 left-1 text-[8px] font-black uppercase text-slate-400 tracking-widest">Search Identity</p>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Member identifier..." 
              className="pl-12 h-12 rounded-2xl bg-white border-slate-200 shadow-xl shadow-slate-100 focus:ring-coop-green/20 font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto self-end">
            <Button 
              onClick={() => setShowBulkModal(true)}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 hover:border-emerald-700 text-white transition-all shadow-sm rounded-lg font-black uppercase tracking-widest text-[10px] px-6 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> 
              <span>Bulk Upload CSV</span>
            </Button>
          </div>
          {barangayFilter !== 'All' && (
            <div className="w-full sm:w-auto self-end">
              <Button 
                onClick={handleTriggerAutomatedNotice}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 border border-blue-600 hover:border-blue-700 text-white transition-all shadow-sm rounded-lg font-black uppercase tracking-widest text-[10px] px-6 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> 
                <span>Trigger Automated Notice</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Members Table */}
      <Card className="rounded-lg border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/40 bg-white border relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-coop-green" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100">
                <TableHead className="px-10 h-24 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Account Identity</TableHead>
                <TableHead className="h-24 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sector / Address</TableHead>
                <TableHead className="h-24 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fund Liquidity</TableHead>
                <TableHead className="px-10 h-24 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.map(member => (
                <TableRow key={member.id} className="hover:bg-slate-50/80 transition-all duration-300 group cursor-default border-b border-slate-50">
                  <TableCell className="px-10 py-8">
                    <div className="flex items-center gap-6">
                      <div className="relative group/avatar">
                        {/* Main Avatar - Circular with professional colors */}
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl tracking-tighter shadow-md transition-all duration-500 group-hover:scale-110 relative overflow-hidden ${
                          member.balance < 1000 
                            ? 'bg-slate-700 text-white group-hover:shadow-lg group-hover:shadow-slate-400/30' 
                            : 'bg-slate-800 text-white group-hover:shadow-lg group-hover:shadow-slate-500/30'
                        }`}>
                          {/* Subtle shine effect */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                          <span className="relative z-10">{member.name.charAt(0)}</span>
                        </div>
                        
                        {/* Status Badge - Professional styling */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-3 border-white shadow-sm flex items-center justify-center ${
                          member.balance >= 1000 
                            ? 'bg-emerald-600' 
                            : 'bg-amber-500'
                        }`}>
                          {member.balance >= 1000 ? (
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
                        <p className="font-black text-slate-950 text-lg leading-tight tracking-tight truncate group-hover:text-slate-700 transition-colors">{member.name}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            UID {member.id.toString().padStart(6, '0')}
                          </p>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${member.balance >= 1000 ? 'bg-emerald-600' : 'bg-amber-500'}`}></div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                              {member.balance >= 1000 ? 'Active' : 'Needs Attention'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 leading-none">{extractBarangay(member.address)}</p>
                      <p className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]">{member.address}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <p className={`text-2xl font-black tracking-tighter tabular-nums leading-none ${member.balance < 1000 ? 'text-slate-700' : 'text-slate-900 group-hover:text-slate-700 transition-colors'}`}>
                        ₱{member.balance?.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${member.balance >= 1000 ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Standing: {member.balance >= 1000 ? 'Verified' : 'Review Required'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-10 text-right">
                    <Button 
                      onClick={() => setSelectedLedgerMember(member)}
                      className="bg-coop-green border border-coop-green text-white hover:bg-coop-darkGreen hover:border-coop-darkGreen font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-lg shadow-sm transition-all transform group-hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2"
                    >
                      <span>Open Ledger</span>
                      <ArrowRight className="w-4 h-4 transition-all" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {visibleMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-10 h-10 opacity-10" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em]">No member identifiers matched in {barangayFilter}</p>
                      <Button variant="ghost" onClick={() => { setSearchQuery(''); setBarangayFilter('All'); }} className="mt-4 text-[10px] font-black uppercase text-coop-green tracking-widest">Clear all filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalMembers)} of {totalMembers} indexed records
          </p>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="text-[10px] font-black uppercase tracking-widest hover:text-coop-green focus:ring-2 focus:ring-coop-green/20"
            >
              Previous
            </Button>
            <Button 
              variant="ghost" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="text-[10px] font-black uppercase tracking-widest text-coop-green hover:bg-green-50 focus:ring-2 focus:ring-coop-green/20"
            >
              Next Page
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Bulk Upload Ledger Entries</h3>
                  <p className="text-xs text-slate-500 mt-1">Upload CSV file with member ledger transactions</p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-700 mb-2">Upload CSV File</p>
                  <p className="text-xs text-slate-500 mb-4">
                    Required columns: memberId, transactionDate, credit, debit, description
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Optional: transactionType, referenceId, paymentMethod, status
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                    id="ledger-csv-upload"
                  />
                  <label
                    htmlFor="ledger-csv-upload"
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </label>
                  {csvFile && (
                    <p className="text-sm text-emerald-600 mt-4 font-bold">
                      {csvFile.name} selected
                    </p>
                  )}
                </div>
                {csvPreview.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Preview (first 5 rows):</p>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {Object.keys(csvPreview[0]).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              {Object.values(row).map((val, i) => (
                                <td key={i} className="px-3 py-2 text-slate-600 whitespace-nowrap">{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-bold text-blue-900 mb-2">CSV Format Example:</p>
                  <pre className="text-xs text-blue-700 font-mono overflow-x-auto">
{`memberId,transactionDate,credit,debit,description
M001,2024-01-15,500,0,Monthly contribution
M002,2024-01-15,0,5000,Death benefit payout`}
                  </pre>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 flex gap-4 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBulkModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  disabled={!csvFile || loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Ledger Entries
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemberLedger;