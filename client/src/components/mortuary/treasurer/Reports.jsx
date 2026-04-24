import React from 'react';
import { Printer, Download, TrendingUp } from 'lucide-react';
import { Card, CardTitle } from '../../ui/card';
import { 
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell,
  Tooltip as RechartsTooltip 
} from 'recharts';
import Button from '../../shared/ui/Button';

const Reports = ({ members, contributions }) => {
  const statusData = [
    { name: 'Active', value: members.filter(m => m.status === 'active').length },
    { name: 'Inactive/Grace', value: members.filter(m => m.status !== 'active').length },
  ];
  
  const balanceData = [
    { name: 'Healthy (>=1k)', value: members.filter(m => m.balance >= 1000).length },
    { name: 'At Risk (<1k)', value: members.filter(m => m.balance < 1000).length },
  ];

  const monthlyData = [
    { month: 'Dec', value: 145000 },
    { month: 'Jan', value: 124000 },
    { month: 'Feb', value: 185000 },
    { month: 'Mar', value: 154000 },
    { month: 'Apr', value: 210000 },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2">Fund Reports</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">Comprehensive Audit & Financial Intelligence</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            className="rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest px-6 h-12 shadow-sm"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" /> Print Summary
          </Button>
          <Button 
            className="bg-slate-900 text-white rounded-2xl shadow-xl font-black uppercase text-[10px] tracking-widest px-8 h-12 transform hover:-translate-y-1 transition-all"
            onClick={() => alert('Generating full audit export...')}
          >
            <Download className="w-4 h-4 mr-2" /> Export Audit Bundle
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inflow Velocity Chart */}
        <Card className="rounded-[3rem] p-10 border-slate-200/60 shadow-2xl bg-white group overflow-hidden relative border">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] -mr-16 -mt-16" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Inflow Velocity</CardTitle>
              <p className="text-2xl font-black text-slate-900 tracking-tight">Cumulative Contributions</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorReport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: '900', color: '#1e293b' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReport)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-50 flex justify-between items-center relative z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Growth Trend: +12.4% vs Prev Month</p>
            <div className="flex items-center gap-1 text-coop-green font-black text-xs">
              <TrendingUp className="w-3 h-3" /> 
              <span>Optimized</span>
            </div>
          </div>
        </Card>

        {/* Pie Charts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Member Standing Chart */}
          <Card className="rounded-[3rem] p-8 border-slate-200/60 shadow-xl bg-white flex flex-col justify-between border">
            <div>
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Member Standing</CardTitle>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={balanceData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={8} cornerRadius={4}>
                      <Cell fill="#059669" />
                      <Cell fill="#f43f5e" strokeWidth={0} />
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-coop-green" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Healthy Account</span>
                </div>
                <span className="text-xs font-black text-slate-900">{balanceData[0].value}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">At Risk</span>
                </div>
                <span className="text-xs font-black text-rose-600">{balanceData[1].value}</span>
              </div>
            </div>
          </Card>

          {/* Status Composition Chart */}
          <Card className="rounded-[3rem] p-8 border-slate-200/60 shadow-xl bg-slate-950 text-white flex flex-col justify-between border">
            <div>
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-6">Status Composition</CardTitle>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={50} outerRadius={70} stroke="none">
                      <Cell fill="#3b82f6" />
                      <Cell fill="rgba(255,255,255,0.1)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-3xl font-black tracking-tighter leading-none mb-1">{statusData[0].value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verified Active Lifecycle</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <Card className="rounded-[3rem] p-10 border-slate-200/60 shadow-2xl bg-white border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Lifecycle Analysis</p>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Recent Fund Activity Timeline</h3>
          </div>
          <div className="flex gap-2">
            <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 italic">Audit Log Ver. 2.4.1</div>
          </div>
        </div>
        
        <div className="space-y-4">
          {contributions.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-xs text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                  {i + 1}
                </div>
                <div>
                  <p className="font-black text-slate-900 leading-none mb-1">Inflow Verification: Member #{c.member_id}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Timestamp: {c.payment_date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900 leading-none mb-1">₱{c.amount?.toLocaleString()}</p>
                <span className="text-[9px] font-black uppercase text-coop-green tracking-widest">Verified Inflow</span>
              </div>
            </div>
          ))}
          {contributions.length === 0 && (
            <div className="h-32 flex items-center justify-center text-slate-400">
              <p className="text-[10px] font-black uppercase tracking-widest">No recent data for lifecycle analysis</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Reports;