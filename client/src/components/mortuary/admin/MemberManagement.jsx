import React from 'react';
import { Users, UserCheck, UserMinus, Heart, Search, Upload, FileText, Plus, Mail, Calendar } from 'lucide-react';
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

const MemberManagement = ({ 
  filteredMembers, members, statusFilter, setStatusFilter, searchQuery, setSearchQuery, 
  contributions, setIsAddMemberOpen, setIsSmsModalOpen, setSmsData, setSelectedMember 
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Member Management</h2>
          <p className="text-slate-500 mt-1">Directory of all registered mortuary fund participants</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={() => exportToCSV(members, 'members')} className="flex-1 sm:flex-none">
            <FileText className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button className="bg-emerald-800 hover:bg-emerald-900 text-white flex-1 sm:flex-none" onClick={() => setIsAddMemberOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Member Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Members</p>
            <p className="text-xl font-black text-slate-900">{members.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <UserCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</p>
            <p className="text-xl font-black text-slate-900">{members.filter((m) => m.status === 'active').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <UserMinus className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inactive</p>
            <p className="text-xl font-black text-slate-900">{members.filter((m) => m.status === 'inactive').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
          <div className="p-3 bg-rose-50 rounded-xl">
            <Heart className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deceased</p>
            <p className="text-xl font-black text-slate-900">{members.filter((m) => m.status === 'deceased').length}</p>
          </div>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Member Directory</CardTitle>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                {(['all', 'active', 'inactive', 'deceased']).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      statusFilter === status 
                        ? 'bg-white text-emerald-800 shadow-lg shadow-slate-200/40' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search members..." 
                  className="pl-8" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 text-slate-900">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6">ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Contact</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Balance</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Join Date</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="px-6 font-medium text-slate-500">#{member.id}</TableCell>
                    <TableCell className="font-bold text-slate-900">{member.name}</TableCell>
                    <TableCell>
                      <p className="text-xs text-slate-600">{member.contact}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-700">₱{(contributions.filter((c) => c.member_id === member.id && c.status === 'paid').reduce((sum, c) => sum + c.amount, 0)).toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : member.status === 'deceased' ? 'destructive' : 'secondary'}
                        className={member.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200' : ''}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-500">{member.join_date}</TableCell>
                    <TableCell className="px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          title="Send manual SMS"
                          onClick={() => {
                            setSmsData({ memberId: member.id, message: '', memberName: member.name });
                            setIsSmsModalOpen(true);
                          }}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-emerald-700 font-bold hover:bg-emerald-50 px-3 uppercase text-[10px] tracking-widest" onClick={() => setSelectedMember(member)}>Profile</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                      No members found.
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

export default MemberManagement;
