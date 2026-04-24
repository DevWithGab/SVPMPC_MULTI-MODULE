import React from 'react';
import { Heart, FileText, User, Plus } from 'lucide-react';
import { Card } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

const DeathVerifications = ({ claims, updateClaimStatus }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Death Verifications</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Audit Phase & Deduction Authorization</p>
        </div>
        <div className="px-6 py-3 bg-rose-50 border border-rose-100 rounded-[1.5rem] flex items-center gap-3">
          <Heart className="w-4 h-4 text-rose-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">
            {claims.filter(c => c.status === 'Pending').length} Pending Audits
          </span>
        </div>
      </div>

      {/* Verifications Table */}
      <Card className="rounded-[3rem] border-slate-200 shadow-2xl overflow-hidden bg-white border">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="px-10 h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deceased Profile</TableHead>
              <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Claimant Record</TableHead>
              <TableHead className="h-20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Audit Status</TableHead>
              <TableHead className="px-10 h-20 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Authorization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((c) => (
              <TableRow key={c.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-50 group">
                <TableCell className="px-10 py-8">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shadow-xl group-hover:scale-110 transition-transform duration-500">
                      <User className="w-5 h-5 opacity-40" />
                    </div>
                    <div>
                      <p className="font-black text-slate-950 text-base leading-none mb-1">{c.member_name}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">Verified Death Case</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-black text-slate-700 leading-none mb-1">{c.claimant_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.claimant_relationship}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`rounded-xl px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${c.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-coop-green border-green-100'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${c.status === 'Pending' ? 'bg-amber-500 animate-pulse' : 'bg-coop-green'}`} />
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-10 text-right">
                  {c.status === 'Pending' && (
                    <div className="flex items-center justify-end gap-4">
                      <div className="w-32">
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 text-left px-1">Deduction (₱)</label>
                        <Input 
                          type="number" 
                          defaultValue="25" 
                          className="h-12 text-sm font-black rounded-xl border-slate-200 focus:ring-coop-green/20 bg-slate-50/50" 
                          id={`deduct-amt-${c.id}`}
                        />
                      </div>
                      <Button 
                        className="bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest px-8 h-12 rounded-xl mt-5 shadow-xl transition-all transform hover:-translate-y-1"
                        onClick={() => {
                          const amtInput = document.getElementById(`deduct-amt-${c.id}`);
                          const amt = parseFloat(amtInput.value);
                          if (confirm(`Authorize Verify & Deduct? This will deduct ₱${amt} from all members for ${c.member_name}.`)) {
                            updateClaimStatus(c.id, 'Approved', amt);
                          }
                        }}
                      >
                        Execute Audit
                      </Button>
                    </div>
                  )}
                  {c.status === 'Approved' && (
                    <div className="flex items-center justify-end gap-2 text-coop-green">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Deductions Processed</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {claims.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 opacity-20">
                    <FileText className="w-16 h-16 mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.3em]">No pending verifications</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default DeathVerifications;