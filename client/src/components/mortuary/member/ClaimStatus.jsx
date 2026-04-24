import React from 'react';
import { 
  ClipboardList, Clock, CheckCircle2, FileText, 
  Calendar, User, CreditCard, Eye 
} from 'lucide-react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';

export default function ClaimStatus({ myClaims }) {
  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-50 text-coop-green border-green-200';
      case 'pending': return 'bg-yellow-50 text-coop-yellow border-yellow-200';
      case 'rejected': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">My Claims</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">View your benefit request status history</p>
        </div>
      </div>

      {/* Claims Stats with Enhanced Depth */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Total Claims', value: myClaims.length, icon: ClipboardList, color: 'coop-green', bg: 'bg-green-50' },
          { label: 'Pending Review', value: myClaims.filter(c => c.status === 'Pending').length, icon: Clock, color: 'coop-yellow', bg: 'bg-yellow-50' },
          { label: 'Approved Claims', value: myClaims.filter(c => c.status === 'Approved').length, icon: CheckCircle2, color: 'coop-green', bg: 'bg-green-50' },
        ].map((stat) => (
          <Card key={stat.label} className="p-8 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] bg-white group hover:border-green-200 transition-all relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 relative z-10">{stat.label}</p>
            <div className="flex items-end justify-between relative z-10">
              <h3 className="text-4xl font-black text-slate-950 tracking-tighter">{stat.value}</h3>
              <div className={`p-4 ${stat.bg} rounded-2xl group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon className={`w-6 h-6 ${stat.color === 'coop-green' ? 'text-coop-green' : stat.color === 'coop-yellow' ? 'text-coop-yellow' : 'text-slate-600'}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Claim Process Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { step: '01', title: 'Submit Documents', desc: 'Upload required documents and fill out claim form', icon: FileText, status: 'complete' },
          { step: '02', title: 'Review Process', desc: 'Our team reviews your claim and documents', icon: Eye, status: 'current' },
          { step: '03', title: 'Claim Approval', desc: 'Receive notification and claim disbursement', icon: CheckCircle2, status: 'pending' },
        ].map((item) => (
          <Card key={item.step} className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                item.status === 'complete' ? 'bg-coop-green text-white' :
                item.status === 'current' ? 'bg-coop-yellow text-slate-900' :
                'bg-slate-100 text-slate-400'
              }`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Step {item.step}</span>
                  {item.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-coop-green" />}
                </div>
                <h4 className="text-sm font-black text-slate-950 tracking-tight mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Claims History Table */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-8 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-950 tracking-tight">Claims History</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">All your submitted claims</p>
        </div>
        
        {myClaims.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 hover:bg-slate-50/50">
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em] py-6">Claim ID</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Filed Date</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Claimant</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Amount</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Status</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myClaims.map((claim) => (
                <TableRow key={claim.id} className="border-slate-100 hover:bg-slate-50/50 group">
                  <TableCell className="font-black text-slate-950 py-6">#{claim.id}</TableCell>
                  <TableCell className="text-slate-600 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {new Date(claim.filed_date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      {claim.claimant_name}
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      ₱{claim.amount?.toLocaleString() || '0'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(claim.status)} px-3 py-1 rounded-full font-black text-xs`}>
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-4 py-2 rounded-xl">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-black text-slate-400 mb-2">No Claims Yet</h4>
            <p className="text-slate-400 text-sm">You haven't submitted any claims. When you do, they'll appear here.</p>
          </div>
        )}
      </Card>

      {/* Claim Guidelines Info Card */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] p-8 bg-coop-darkGreen text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-coop-green/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:bg-coop-green/20 transition-all duration-700" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-coop-yellow rounded-[2rem] flex items-center justify-center shadow-2xl shadow-yellow-200 shrink-0">
            <FileText className="w-10 h-10 text-slate-900" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight mb-3">Need to File a Claim?</h3>
            <p className="text-green-100/80 text-sm leading-relaxed mb-6">
              Our claims process is designed to be simple and transparent. Make sure you have all required documents ready before starting your claim.
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <Badge className="bg-green-600/30 text-coop-yellow border-green-600/30 px-4 py-2 rounded-full font-black text-xs">
                Death Certificate
              </Badge>
              <Badge className="bg-green-600/30 text-coop-yellow border-green-600/30 px-4 py-2 rounded-full font-black text-xs">
                Valid ID
              </Badge>
              <Badge className="bg-green-600/30 text-coop-yellow border-green-600/30 px-4 py-2 rounded-full font-black text-xs">
                Claim Form
              </Badge>
            </div>
          </div>
          <Button className="bg-coop-yellow hover:bg-yellow-400 text-slate-900 font-black px-8 py-4 rounded-2xl shadow-lg hover:shadow-yellow-300 transition-all duration-300 hover:scale-105 shrink-0">
            Start New Claim
          </Button>
        </div>
      </Card>
    </div>
  );
}