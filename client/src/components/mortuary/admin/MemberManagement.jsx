import React from 'react';
import { Users, UserCheck, UserMinus, Heart, Search, FileText } from 'lucide-react';

const MemberManagement = ({
  filteredMembers, members, statusFilter, setStatusFilter, searchQuery, setSearchQuery, setActiveTab
}) => {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Member Management</h1>
        <p className="text-slate-500 text-sm mt-1">Directory of all registered mortuary fund participants.</p>
      </div>

      {/* Member Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <Users className="w-5 h-5 text-coop-green" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Members</p>
            <p className="text-xl font-bold text-slate-900">{members.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <UserCheck className="w-5 h-5 text-coop-green" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active</p>
            <p className="text-xl font-bold text-slate-900">{members.filter((m) => m.status === 'active').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg">
            <UserMinus className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Inactive</p>
            <p className="text-xl font-bold text-slate-900">{members.filter((m) => m.status === 'inactive').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-rose-50 rounded-lg">
            <Heart className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Deceased</p>
            <p className="text-xl font-bold text-slate-900">{members.filter((m) => m.status === 'deceased').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm font-bold text-slate-900">Member Directory</p>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto">
              {(['all', 'active', 'inactive', 'deceased']).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === status
                      ? 'bg-white text-coop-green shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Balance</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">Join Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-xs font-medium text-slate-500">#{member.id}</td>
                  <td className="px-6 py-3.5 text-sm font-semibold text-slate-900">{member.name}</td>
                  <td className="px-6 py-3.5 text-xs text-slate-500 hidden md:table-cell">{member.contact}</td>
                  <td className="px-6 py-3.5 text-sm font-semibold text-coop-green">
                    ₱{(member.currentBalance || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        member.status === 'active'
                          ? 'bg-green-50 text-coop-green border-green-200'
                          : member.status === 'deceased'
                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-500 hidden sm:table-cell">{member.join_date}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {setActiveTab && (
                        <>
                          <button
                            onClick={() => setActiveTab('beneficiaries')}
                            title="View beneficiaries"
                            className="text-slate-400 hover:text-coop-green transition-colors"
                          >
                            <Heart className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveTab('claims')}
                            title="View claim history"
                            className="text-slate-400 hover:text-coop-green transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-400">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MemberManagement;
