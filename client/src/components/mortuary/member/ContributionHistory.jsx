import React from 'react';
import { 
  TrendingUp, Calendar, CreditCard, CheckCircle2, 
  Clock, AlertCircle, Download, Filter, Search 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

export default function ContributionHistory({ myContributions }) {
  const totalContributions = myContributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const paidContributions = myContributions.filter(c => c.status === 'paid');
  const pendingContributions = myContributions.filter(c => c.status === 'pending');

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-50 text-coop-green border-green-200';
      case 'pending': return 'bg-yellow-50 text-coop-yellow border-yellow-200';
      case 'overdue': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return CheckCircle2;
      case 'pending': return Clock;
      case 'overdue': return AlertCircle;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Contribution History</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Track your payment history and upcoming dues</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-4 py-2 rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Contribution Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Paid', 
            value: `₱${totalContributions.toLocaleString()}`, 
            icon: TrendingUp, 
            color: 'coop-green', 
            bg: 'bg-green-50',
            count: `${paidContributions.length} payments`
          },
          { 
            label: 'This Month', 
            value: `₱${paidContributions.filter(c => new Date(c.payment_date).getMonth() === new Date().getMonth()).reduce((sum, c) => sum + c.amount, 0).toLocaleString()}`, 
            icon: Calendar, 
            color: 'coop-green', 
            bg: 'bg-green-50',
            count: 'Current period'
          },
          { 
            label: 'Pending', 
            value: pendingContributions.length, 
            icon: Clock, 
            color: 'coop-yellow', 
            bg: 'bg-yellow-50',
            count: 'Due payments'
          },
          { 
            label: 'Average', 
            value: `₱${myContributions.length > 0 ? (totalContributions / paidContributions.length).toLocaleString() : '0'}`, 
            icon: CreditCard, 
            color: 'coop-green', 
            bg: 'bg-green-50',
            count: 'Per payment'
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bg} rounded-full -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-950 tracking-tighter mb-1">{stat.value}</h3>
                <p className="text-[10px] text-slate-500 font-bold">{stat.count}</p>
              </div>
              <div className={`p-3 ${stat.bg} rounded-xl group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon className={`w-5 h-5 ${stat.color === 'coop-green' ? 'text-coop-green' : stat.color === 'coop-yellow' ? 'text-coop-yellow' : 'text-slate-600'}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Payment Trend Chart */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white">
        <CardHeader className="p-0 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black text-slate-950 tracking-tight">Payment Trends</CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Monthly contribution overview</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-3 py-2 rounded-xl">
                <Filter className="w-3 h-3 mr-1" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={[...myContributions].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="payment_date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                tickFormatter={(value) => `₱${value}`}
              />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none', 
                  borderRadius: '16px', 
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                formatter={(value) => [`₱${value.toLocaleString()}`, 'Amount']}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#2D7A3E" 
                strokeWidth={3}
                fill="#2D7A3E" 
                fillOpacity={0.15}
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Contribution History Table */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-black text-slate-950 tracking-tight">Payment Records</CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Complete payment history</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search payments..."
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        {myContributions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 hover:bg-slate-50/50">
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em] py-6">Payment Date</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Amount</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Method</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Reference</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Status</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myContributions.map((contribution) => {
                const StatusIcon = getStatusIcon(contribution.status);
                return (
                  <TableRow key={contribution.id} className="border-slate-100 hover:bg-slate-50/50 group">
                    <TableCell className="py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-green-50 transition-colors">
                          <Calendar className="w-4 h-4 text-slate-400 group-hover:text-coop-green" />
                        </div>
                        <div>
                          <p className="font-black text-slate-950 text-sm">
                            {contribution.payment_date ? new Date(contribution.payment_date).toLocaleDateString() : 'Pending'}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {contribution.payment_date ? new Date(contribution.payment_date).toLocaleDateString('en-US', { weekday: 'short' }) : 'Not paid'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        <span className="font-black text-slate-950 text-lg">₱{contribution.amount.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 rounded-lg px-3 py-1 text-[9px] font-bold uppercase tracking-widest">
                        {contribution.payment_method || 'Cash'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-600">
                      {contribution.reference_number || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="w-4 h-4" />
                        <Badge className={`${getStatusColor(contribution.status)} px-3 py-1 rounded-full font-black text-xs`}>
                          {contribution.status || 'Pending'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-4 py-2 rounded-xl">
                        View Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-black text-slate-400 mb-2">No Contributions Yet</h4>
            <p className="text-slate-400 text-sm">Your contribution history will appear here once you make payments.</p>
          </div>
        )}
      </Card>
    </div>
  );
}