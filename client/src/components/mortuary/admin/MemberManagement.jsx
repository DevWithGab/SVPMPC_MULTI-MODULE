import React from 'react';
import { Users, UserCheck, UserMinus, Heart, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

const MemberManagement = ({ 
  filteredMembers, members, statusFilter, setStatusFilter, searchQuery, setSearchQuery
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#2D7A3E" }}>Member Management</h2>
          <p className="text-gray-600 font-medium">Directory of all registered mortuary fund participants</p>
        </div>
      </div>

      {/* Member Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Members</p>
            <p className="text-xl font-bold text-gray-900">{members.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <UserCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active</p>
            <p className="text-xl font-bold text-gray-900">{members.filter((m) => m.status === 'active').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <UserMinus className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Inactive</p>
            <p className="text-xl font-bold text-gray-900">{members.filter((m) => m.status === 'inactive').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-50 rounded-xl">
            <Heart className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Deceased</p>
            <p className="text-xl font-bold text-gray-900">{members.filter((m) => m.status === 'deceased').length}</p>
          </div>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold" style={{ color: "#2D7A3E" }}>Member Directory</CardTitle>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                {(['all', 'active', 'inactive', 'deceased']).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      statusFilter === status 
                        ? 'bg-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={statusFilter === status ? { color: "#2D7A3E" } : {}}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
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
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400 px-6">ID</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Contact</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Balance</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-400">Join Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-gray-50 transition-colors group">
                    <TableCell className="px-6 font-medium text-gray-600">#{member.id}</TableCell>
                    <TableCell className="font-bold text-gray-900">{member.name}</TableCell>
                    <TableCell>
                      <p className="text-xs text-gray-600">{member.contact}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-emerald-700">₱{(member.currentBalance || 0).toLocaleString()}</span>
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
                    <TableCell className="text-xs font-medium text-gray-600">{member.join_date}</TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500">
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
