import React, { useState } from 'react';
import { 
  Search, ArrowLeft, Printer, CreditCard, FileText, DollarSign, 
  ChevronRight, MessageSquare, ArrowRight, Upload, X, Loader
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
  handleQuickDeposit,
  setIsAddContributionOpen,
  handleTriggerAutomatedNotice,
  showToast,
  refreshData
}) => {
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [loading, setLoading] = useState(false);

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
  // Individual Member Ledger View
  if (selectedLedgerMember) {
    const currentMember = members.find(m => m.id === selectedLedgerMember.id) || selectedLedgerMember;
    const mEntries = [...ledger].filter(l => l.member_id === currentMember.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const totalReceived = mEntries.reduce((sum, e) => sum + (e.received || 0), 0);
    const totalWithdrawn = mEntries.reduce((sum, e) => sum + (e.withdrawn || 0), 0);

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedLedgerMember(null)}
            className="rounded-xl hover:bg-slate-100 flex items-center gap-2 font-black text-slate-600 uppercase text-[10px] tracking-widest px-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Member List
          </Button>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => window.print()}
              className="border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest px-6"
            >
              <Printer className="w-4 h-4 mr-2" /> Print Official Copy
            </Button>
            <Button 
              className="bg-coop-green text-white rounded-xl shadow-lg hover:bg-coop-darkGreen font-black uppercase text-[10px] tracking-widest px-6"
              onClick={() => setIsAddContributionOpen(true)}
            >
              <CreditCard className="w-4 h-4 mr-2" /> Add Deposit
            </Button>
          </div>
        </div>

        {/* Ledger Document */}
        <div id="printable-ledger" className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden print:border-none print:shadow-none min-h-[900px] flex flex-col relative">
          {/* Visual Anchor */}
          <div className="absolute top-10 right-10 opacity-[0.03] pointer-events-none select-none hidden lg:block">
            <p className="text-[12rem] font-black leading-none tracking-tighter">MAF</p>
          </div>

          {/* Header Section */}
          <div className="p-10 border-b border-slate-100 bg-slate-50/30 print:bg-transparent relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-coop-green rounded-full text-[9px] font-black uppercase tracking-widest mb-4">
                    <FileText className="w-3 h-3" /> Digital Ledger System
                  </div>
                  <h1 className="text-5xl font-black text-slate-950 tracking-tighter leading-none mb-2">Member Ledger</h1>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Official Mortuary Assistance Fund Record</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Full Legal Name</p>
                    <p className="text-xl font-black text-slate-900 leading-tight">{currentMember.name}</p>
                    <p className="text-[9px] font-bold text-slate-400">UUID: {currentMember.id.toString().padStart(6, '0')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Address</p>
                    <p className="text-sm font-bold text-slate-600 leading-snug max-w-xs">{currentMember.address || 'Not Provided'}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Beneficiary Information</p>
                    <p className="text-sm font-bold text-slate-600 leading-snug">{currentMember.beneficiaries || 'No recorded beneficiaries'}</p>
                  </div>
                </div>
              </div>

              {/* Balance Card */}
              <div className="flex flex-col gap-4">
                <div className="bg-slate-950 p-6 rounded-[2rem] text-white shadow-xl shadow-slate-200 min-w-[280px]">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Fund Standing</p>
                    <div className="w-8 h-8 bg-coop-green rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-4xl font-black tracking-tighter mb-1">₱{currentMember.balance?.toLocaleString()}</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${currentMember.balance >= 1000 ? 'bg-coop-green' : 'bg-rose-500 animate-pulse'}`} />
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      {currentMember.balance >= 1000 ? 'Maintaining Balance Met' : 'Action Required: Low Balance'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100/50">
                    <p className="text-[8px] font-black uppercase text-coop-green mb-1">Total Inflow</p>
                    <p className="text-sm font-black text-coop-green">₱{totalReceived.toLocaleString()}</p>
                  </div>
                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                    <p className="text-[8px] font-black uppercase text-rose-600 mb-1">Total Outflow</p>
                    <p className="text-sm font-black text-rose-700">₱{totalWithdrawn.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Ledger Table */}
          <div className="flex-1">
            <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 flex py-4 px-10 print:static print:bg-transparent">
              <div className="grid grid-cols-6 w-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="col-span-1">Date</div>
                <div className="col-span-1">OR/DV Number</div>
                <div className="col-span-2 px-4">Description</div>
                <div className="col-span-1 text-right">Flow (In/Out)</div>
                <div className="col-span-1 text-right">End Balance</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {mEntries.length > 0 ? (
                mEntries.map((entry, idx) => (
                  <div key={entry.id} className="grid grid-cols-6 w-full items-center py-5 px-10 hover:bg-slate-50/50 transition-colors group">
                    <div className="col-span-1 font-mono text-xs font-bold text-slate-500">{entry.date}</div>
                    <div className="col-span-1 font-mono text-xs font-black text-slate-900 uppercase">{entry.ref_no}</div>
                    <div className="col-span-2 px-4">
                      <p className="text-xs font-bold text-slate-600 leading-snug">{entry.description}</p>
                      {entry.withdrawn > 0 && <p className="text-[8px] font-black uppercase text-rose-400 mt-1">Deduction applied</p>}
                      {entry.received > 500 && <p className="text-[8px] font-black uppercase text-coop-green mt-1">Lump sum contribution</p>}
                    </div>
                    <div className="col-span-1 text-right">
                      {entry.received > 0 ? (
                        <p className="text-sm font-black text-coop-green font-mono">+₱{entry.received.toLocaleString()}</p>
                      ) : entry.withdrawn > 0 ? (
                        <p className="text-sm font-black text-rose-600 font-mono">-₱{entry.withdrawn.toLocaleString()}</p>
                      ) : (
                        <p className="text-sm font-black text-slate-300">0.00</p>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <p className="text-sm font-black text-slate-950 font-mono tracking-tighter">₱{entry.balance.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                  <FileText className="w-16 h-16 mb-4 opacity-[0.05]" />
                  <p className="text-xs font-black uppercase tracking-widest">No transaction history recorded yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-12 border-t border-slate-100 bg-slate-50/50 mt-auto flex flex-col md:flex-row justify-between items-end gap-12">
            <div className="text-left space-y-4 max-w-sm">
              <div className="w-12 h-1 bg-slate-200" />
              <p className="text-[9px] leading-relaxed font-bold text-slate-400 uppercase tracking-widest">
                This document serves as an official electronic transcript of the Mortuary Assistance Fund ledger. Validated as of {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}.
              </p>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="text-[10px] font-black text-slate-400 mb-16 uppercase tracking-[0.3em]">Authorized Certification:</p>
              <div className="pt-2 border-t-2 border-slate-950 inline-block min-w-[300px]">
                <p className="font-black text-slate-950 text-base uppercase tracking-tighter">Federation Treasurer Signature</p>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest tracking-[0.5em]">SYSTEM AUDIT COMPLETE</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Member List View
  const uniqueBarangays = ['All', ...Array.from(new Set(members.map(m => extractBarangay(m.address))))].sort();

  const filteredMembersList = members
    .filter(m => (barangayFilter === 'All' ? true : extractBarangay(m.address) === barangayFilter))
    .filter(m => (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.id?.toString().includes(searchQuery)));

  const totalPages = Math.ceil(filteredMembersList.length / itemsPerPage) || 1;
  const currentMembersChunk = filteredMembersList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
              className="w-full h-12 bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 text-emerald-700 hover:text-white transition-all shadow-sm rounded-2xl font-black uppercase tracking-widest text-[10px] px-6 gap-2"
            >
              <Upload className="w-4 h-4" /> Bulk Upload CSV
            </Button>
          </div>
          {barangayFilter !== 'All' && (
            <div className="w-full sm:w-auto self-end">
              <Button 
                onClick={handleTriggerAutomatedNotice}
                className="w-full h-12 bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-700 hover:text-white transition-all shadow-sm rounded-2xl font-black uppercase tracking-widest text-[10px] px-6 gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Trigger Automated Notice
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Members Table */}
      <Card className="rounded-[3rem] border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/40 bg-white border relative">
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
              {currentMembersChunk.map(member => (
                <TableRow key={member.id} className="hover:bg-slate-50/80 transition-all duration-300 group cursor-default border-b border-slate-50">
                  <TableCell className="px-10 py-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-100 text-slate-400 flex items-center justify-center font-black text-2xl tracking-tighter transition-all duration-500 group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-6 shadow-inner">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-950 text-xl leading-tight tracking-tight">{member.name}</p>
                        <p className="text-[10px] font-black text-coop-green uppercase tracking-[0.3em] mt-1.5 opacity-60">UID {member.id.toString().padStart(6, '0')}</p>
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
                      <p className={`text-2xl font-black tracking-tighter tabular-nums leading-none ${member.balance < 1000 ? 'text-rose-600' : 'text-slate-900 group-hover:text-coop-green transition-colors'}`}>
                        ₱{member.balance?.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${member.balance >= 1000 ? 'bg-coop-green' : 'bg-rose-500 animate-pulse'}`} />
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Standing: {member.balance >= 1000 ? 'Verified' : 'At Risk'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-10 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost"
                        onClick={() => handleQuickDeposit(member.memberId || member.id)}
                        className="bg-transparent border border-green-200 text-coop-green hover:bg-green-50 hover:text-coop-green hover:border-green-300 font-bold uppercase text-[10px] tracking-widest h-12 px-6 rounded-2xl transition-all"
                      >
                        + Quick Deposit
                      </Button>
                      <Button 
                        onClick={() => setSelectedLedgerMember(member)}
                        className="bg-white border border-slate-200 text-slate-900 hover:bg-slate-950 hover:text-white hover:border-slate-950 font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-2xl shadow-sm transition-all transform group-hover:scale-105 active:scale-95"
                      >
                        Open Ledger <ArrowRight className="ml-2 w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMembersList.length === 0 && (
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
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredMembersList.length)} of {filteredMembersList.length} indexed records
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