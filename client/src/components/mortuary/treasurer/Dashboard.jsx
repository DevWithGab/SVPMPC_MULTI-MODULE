import React from 'react';
import { 
  DollarSign, Users, CreditCard, FileText, Calendar, TrendingUp 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip as RechartsTooltip 
} from 'recharts';
import { CardTitle } from '../../ui/card';
import StatCard from './shared/StatCard';

const Dashboard = ({ stats, contributions = [] }) => {
  const atRiskMembersCount = stats?.lowBalanceMembers || 0;
  const totalMembersCount = stats?.totalMembers || 1;
  const healthyRatio = Math.round(((totalMembersCount - atRiskMembersCount) / totalMembersCount) * 100) || 0;
  const isOptimal = healthyRatio >= 80;

  // Calculate real monthly contribution data
  const calculateChartData = () => {
    const monthlyTotals = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Group contributions by month
    contributions.forEach(c => {
      if (c.payment_date) {
        const date = new Date(c.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = monthNames[date.getMonth()];
        
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = { month: monthLabel, val: 0, fullKey: monthKey };
        }
        monthlyTotals[monthKey].val += c.amount || 0;
      }
    });
    
    // Convert to array and sort by date
    const sortedData = Object.values(monthlyTotals)
      .sort((a, b) => a.fullKey.localeCompare(b.fullKey))
      .slice(-6); // Get last 6 months
    
    // If no data, return placeholder
    return sortedData.length > 0 ? sortedData : [
      { month: 'No Data', val: 0 }
    ];
  };

  const chartData = calculateChartData();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Financial Overview</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Treasurer Portfolio & Fund Performance</p>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Mortuary Fund"
          value={`₱${stats?.fundBalance?.toLocaleString() || '0'}`}
          icon={DollarSign}
        />
        <StatCard
          title="Active Contributors"
          value={stats?.activeMembers?.toLocaleString() || '0'}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Capital Adequacy"
          value={`${healthyRatio}%`}
          icon={TrendingUp}
          color={isOptimal ? 'emerald' : 'amber'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fund Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200/60 p-10 shadow-2xl shadow-slate-200/50 group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                Fund Growth Analytics
              </CardTitle>
              <p className="text-2xl font-black text-slate-900 tracking-tight">Financial Inflow Velocity</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <TrendingUp className="w-5 h-5 text-coop-green" />
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D7A3E" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2D7A3E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight="bold" 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', 
                    padding: '15px' 
                  }}
                  labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="val" 
                  stroke="#2D7A3E" 
                  fillOpacity={1} 
                  fill="url(#colorVal)" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#2D7A3E', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-950 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group flex flex-col justify-between">
          <div className={`absolute top-0 right-0 w-64 h-64 ${isOptimal ? 'bg-coop-green/10' : 'bg-amber-500/10'} blur-[80px] -mr-32 -mt-32 transition-colors duration-700`} />

          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${isOptimal ? 'text-coop-green' : 'text-amber-400'}`}>
                  Capital Snapshot
                </p>
                <p className="mt-3 text-4xl font-black tracking-tighter leading-none text-white">
                  {healthyRatio}%
                </p>
              </div>
              <div className={`px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] ${isOptimal ? 'bg-coop-green/20 text-coop-green' : 'bg-amber-500/20 text-amber-300'}`}>
                {isOptimal ? 'Healthy' : 'Watch List'}
              </div>
            </div>

            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              {isOptimal
                ? 'Most members are maintaining the required minimum balance, so the mortuary fund is currently in a stable position.'
                : 'A noticeable portion of members are below the minimum balance, so deductions and collections may need closer monitoring.'}
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">
                  <span>Fund Coverage</span>
                  <span className={isOptimal ? 'text-coop-green' : 'text-amber-400'}>{healthyRatio}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isOptimal ? 'bg-coop-green' : 'bg-amber-500'}`}
                    style={{ width: `${healthyRatio}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Members Healthy</p>
                  <p className="text-2xl font-black text-white">{Math.max(totalMembersCount - atRiskMembersCount, 0)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Members At Risk</p>
                  <p className={`text-2xl font-black ${atRiskMembersCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>{atRiskMembersCount}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="text-slate-300">Fund Balance</span>
                  <span className="text-white">₱{stats?.fundBalance?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="text-slate-300">Total Collected</span>
                  <span className="text-white">₱{stats?.totalCollected?.toLocaleString() || '0'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;