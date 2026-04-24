import React from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, Users, CreditCard, FileText, Calendar, TrendingUp 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip as RechartsTooltip 
} from 'recharts';
import { CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import StatCard from './shared/StatCard';

const Dashboard = ({ stats, claims }) => {
  const pendingClaimsCount = claims.filter(c => c.status === 'Pending').length;
  const atRiskMembersCount = stats?.lowBalanceMembers || 0;
  const totalMembersCount = stats?.totalMembers || 1;
  const healthyRatio = Math.round(((totalMembersCount - atRiskMembersCount) / totalMembersCount) * 100) || 0;
  const isOptimal = healthyRatio >= 80;

  const chartData = [
    {month: 'Jan', val: 124000}, 
    {month: 'Feb', val: 185000}, 
    {month: 'Mar', val: 154000}, 
    {month: 'Apr', val: 210000},
    {month: 'May', val: 198000},
    {month: 'Jun', val: 245000}
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Financial Overview</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Treasurer Portfolio & Fund Performance</p>
        </div>
        <div className="px-6 py-3 bg-white border border-slate-200 rounded-[1.5rem] flex items-center gap-3 shadow-xl shadow-slate-100/50 transform hover:-translate-y-0.5 transition-all">
          <div className="w-2 h-2 bg-coop-green rounded-full animate-pulse" />
          <Calendar className="w-4 h-4 text-coop-green" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            Active Fiscal Cycle: {new Date().getFullYear()}
          </span>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          title="Total Collected" 
          value={`₱${stats?.totalCollected?.toLocaleString() || '0'}`} 
          icon={CreditCard} 
          color="amber" 
        />
        <StatCard 
          title="In Review" 
          value={pendingClaimsCount} 
          icon={FileText} 
          color="rose" 
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
          <div className="h-[300px] w-full">
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

        {/* Reserve Health Card */}
        <div className="bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group flex flex-col justify-between">
          <div className={`absolute top-0 right-0 w-64 h-64 ${isOptimal ? 'bg-coop-green/10' : 'bg-amber-500/10'} blur-[80px] -mr-32 -mt-32 transition-colors duration-700`} />
          
          <div className="relative z-10 mb-8">
            <div className="flex justify-between items-start mb-6">
              <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${isOptimal ? 'text-coop-green' : 'text-amber-400'}`}>
                Reserve Health
              </p>
              <Badge className={`${isOptimal ? 'bg-coop-green/20 text-coop-green' : 'bg-amber-500/20 text-amber-400'} border-none uppercase tracking-widest text-[9px]`}>
                {isOptimal ? 'Optimal' : 'Needs Attention'}
              </Badge>
            </div>
            <p className="text-5xl font-black tracking-tighter mb-4 leading-none">
              ₱{stats?.fundBalance?.toLocaleString() || '0'}
            </p>
            <p className="text-slate-400 text-sm font-bold leading-relaxed line-clamp-2">
              Available liquid capital to cover upcoming mortality deductions and operational disbursements.
            </p>
          </div>
          
          <div className="relative z-10 space-y-6 mt-auto">
            <div className="grid grid-cols-2 gap-4 mb-4 mt-2 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Pending Claims</p>
                <p className="text-2xl font-black">{pendingClaimsCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Mbrs At Risk</p>
                <p className={`text-2xl font-black ${atRiskMembersCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {atRiskMembersCount}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                <span>Capital Adequacy Ratio</span>
                <span className={healthyRatio >= 80 ? "text-coop-green" : (healthyRatio >= 50 ? "text-amber-400" : "text-rose-400")}>
                  {healthyRatio}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${healthyRatio}%` }} 
                  transition={{ duration: 1.5, ease: "easeOut" }} 
                  className={`h-full ${healthyRatio >= 80 ? 'bg-coop-green' : (healthyRatio >= 50 ? 'bg-amber-500' : 'bg-rose-500')} rounded-full`} 
                />
              </div>
              <p className="text-[9px] font-medium text-slate-500 mt-2">
                Based on percentage of members maintaining required minimum balance (₱1,000).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;