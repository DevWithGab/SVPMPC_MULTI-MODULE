import React from 'react';
import { Search, Banknote, CalendarDays, Archive } from 'lucide-react';
import StatCard from '../shared/StatCard';

const Contributions = ({
  contributions,
  paymentSearchQuery,
  setPaymentSearchQuery,
  setIsAddContributionOpen
}) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Record Payments</h2>
        <p className="text-sm text-slate-500 mt-1">Track and manage member contributions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Today"
          value={`₱${totalToday.toLocaleString()}`}
          subtitle={`${contributionsToday.length} transactions`}
          icon={Banknote}
          color="emerald"
        />
        <StatCard
          title="This Month"
          value={`₱${totalMonth.toLocaleString()}`}
          subtitle={new Date().toLocaleString('default', { month: 'long' })}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          title="All Time"
          value={contributions.length}
          subtitle="total records"
          icon={Archive}
          color="amber"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="Search contributions by name or ID"
              placeholder="Search name or ID..."
              value={paymentSearchQuery}
              onChange={e => setPaymentSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setIsAddContributionOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-5 text-sm font-medium bg-green-700 hover:bg-green-800 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
          >
            Record Payment
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Member</th>
              <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="text-center px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredContributions.slice(0, 50).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-sm text-slate-700">{c.payment_date}</p>
                  <p className="text-xs text-slate-400">#{c.id.toString().padStart(6, '0')}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                      {(c.member_name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.member_name || `Member #${c.member_id}`}</p>
                      <p className="text-xs text-slate-400">{c.member_id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">₱{c.amount?.toLocaleString()}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                    c.status === 'paid' || c.status === 'completed'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'paid' || c.status === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredContributions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredContributions.length > 50 && (
        <p className="text-xs text-slate-400">
          Showing 50 of {filteredContributions.length} records
        </p>
      )}
    </div>
  );
};

export default Contributions;
