import React from 'react';
import { 
  DollarSign, Users, Heart, CreditCard, TrendingUp, Calendar, Download,
  UserPlus, Plus, FileText, BarChart3
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, 
  Cell, Legend 
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

const StatCard = ({ title, value, icon: Icon, color = "emerald" }) => {
  return (
    <Card className="p-5 sm:p-6 border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden rounded-[2rem]">
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</p>
          <p className="text-3xl sm:text-4xl font-black mt-1 text-slate-900 tracking-tight">{value}</p>
        </div>
        <div className={`p-4 rounded-2xl bg-slate-50 text-slate-500 group-hover:bg-${color}-50 group-hover:text-${color}-600 transition-colors duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

const RecentActivities = ({ contributions, payouts }) => {
  const activities = [
    ...(contributions || []).slice(0, 3).map(c => ({ 
      type: 'contribution', 
      title: 'New Contribution', 
      desc: `₱${c.amount?.toLocaleString() || '0'} from ${c.member_name || `Member #${c.member_id}`}`, 
      time: new Date(c.created_at || c.date).toLocaleDateString(), 
      status: c.status || 'Verified' 
    })),
    ...(payouts || []).slice(0, 3).map(p => ({ 
      type: 'payout', 
      title: 'Benefit Disbursement', 
      desc: `Payout of ₱${p.amount?.toLocaleString() || '0'} to ${p.beneficiary || 'Beneficiary'}`, 
      time: new Date(p.created_at || p.date).toLocaleDateString(), 
      status: p.status || 'Completed' 
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <Card className="border-slate-200/50 bg-white/50 backdrop-blur-sm shadow-lg shadow-slate-200/40 h-full">
      <CardHeader>
        <CardTitle className="text-slate-900 text-sm font-bold uppercase tracking-widest">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {activities.length > 0 ? (
          activities.map((act, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={`p-2 rounded-xl ${act.type === 'contribution' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {act.type === 'contribution' ? <CreditCard className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">{act.title}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${act.type === 'contribution' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {act.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{act.desc}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">{act.time}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400 font-medium">No recent activities</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ContributionHeatMap = ({ contributions }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Generate heatmap data from real contributions
  const generateHeatmapData = () => {
    const weeks = 52;
    const heatmapData = Array.from({ length: weeks }, (_, weekIndex) => ({
      week: weekIndex,
      days: Array.from({ length: 7 }, (_, dayIndex) => ({
        day: dayIndex,
        value: 0,
      })),
    }));

    // Populate with real contribution data
    contributions.forEach(contribution => {
      const date = new Date(contribution.created_at || contribution.date);
      const weekOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const dayOfWeek = date.getDay();
      
      if (weekOfYear < weeks && weekOfYear >= 0) {
        heatmapData[weekOfYear].days[dayOfWeek].value += 1;
      }
    });

    return heatmapData;
  };

  const contributionHeatmapData = generateHeatmapData();
  
  const getColor = (value) => {
    if (value === 0) return 'bg-slate-100';
    if (value < 3) return 'bg-emerald-100';
    if (value < 6) return 'bg-emerald-300';
    if (value < 10) return 'bg-emerald-500';
    return 'bg-emerald-700';
  };

  return (
    <Card className="border-slate-200/50 bg-white shadow-xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden">
      <CardHeader className="p-8 border-b border-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-900 text-xs font-black uppercase tracking-[0.2em]">Contribution Intensity</CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily collection activity across all sectors</CardDescription>
          </div>
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.15em] border-emerald-100 text-emerald-700 bg-emerald-50/50">Activity Heatmap</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex gap-2">
          <div className="flex flex-col justify-between py-1 text-[8px] font-bold text-slate-300 uppercase tracking-tighter">
            {days.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
            <div className="flex gap-[3px]">
              {contributionHeatmapData.map((week, wIndex) => (
                <div key={wIndex} className="flex flex-col gap-[3px]">
                  {week.days.map((day, dIndex) => (
                    <div 
                      key={dIndex}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-colors cursor-help hover:ring-2 hover:ring-emerald-200 ${getColor(day.value)}`}
                      title={`${day.value} contributions on week ${wIndex + 1}, ${days[day.day]}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 shrink-0">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Less</span>
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 bg-slate-100 rounded-[2px]" />
            <div className="w-2.5 h-2.5 bg-emerald-100 rounded-[2px]" />
            <div className="w-2.5 h-2.5 bg-emerald-300 rounded-[2px]" />
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-[2px]" />
            <div className="w-2.5 h-2.5 bg-emerald-700 rounded-[2px]" />
          </div>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">More</span>
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = ({ stats, contributions, payouts, members, setActiveTab }) => {
  // Calculate member status distribution from real data
  const memberStatusData = [
    { 
      name: 'Active', 
      value: members.filter(m => m.status === 'active').length, 
      color: '#10b981' 
    },
    { 
      name: 'Inactive', 
      value: members.filter(m => m.status === 'inactive').length, 
      color: '#94a3b8' 
    },
    { 
      name: 'Deceased', 
      value: members.filter(m => m.status === 'deceased').length, 
      color: '#f59e0b' 
    },
  ].filter(item => item.value > 0); // Only show categories with data

  // Generate fund growth data from real contributions
  const generateFundGrowthData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const monthlyData = months.map((month, index) => ({
      month,
      balance: 0,
      contributions: 0,
    }));

    // Aggregate contributions by month
    contributions.forEach(contribution => {
      const date = new Date(contribution.created_at || contribution.date);
      if (date.getFullYear() === currentYear) {
        const monthIndex = date.getMonth();
        monthlyData[monthIndex].contributions += contribution.amount || 0;
      }
    });

    // Calculate cumulative balance
    let cumulativeBalance = 0;
    monthlyData.forEach((data, index) => {
      cumulativeBalance += data.contributions;
      // Subtract payouts for the month
      payouts.forEach(payout => {
        const date = new Date(payout.created_at || payout.date);
        if (date.getFullYear() === currentYear && date.getMonth() === index) {
          cumulativeBalance -= payout.amount || 0;
        }
      });
      data.balance = cumulativeBalance;
    });

    // Return only months up to current month
    const currentMonth = new Date().getMonth();
    return monthlyData.slice(0, currentMonth + 1);
  };

  const fundGrowthData = generateFundGrowthData();

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Admin Dashboard</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Overview of your mortuary fund performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl">
            <Calendar className="w-4 h-4 text-emerald-700 mr-2" />
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Fiscal Year 2024</span>
          </div>
          <Button variant="outline" className="rounded-2xl border-slate-200 h-10 px-5 text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => exportToCSV(members, 'members_summary')}>
            <Download className="w-4 h-4 mr-2" />
            Backup Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Total Fund" value={`₱${stats?.fundBalance?.toLocaleString() || '0'}`} icon={DollarSign} />
        <StatCard title="Active Members" value={stats?.activeMembers?.toLocaleString() || '0'} icon={Users} color="blue" />
        <StatCard title="Total Payouts" value={stats?.totalPayouts?.toLocaleString() || '0'} icon={Heart} color="rose" />
        <StatCard title="Total Collected" value={`₱${contributions.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}`} icon={CreditCard} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <Card className="lg:col-span-2 border-slate-200/50 bg-white shadow-xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 text-sm font-black uppercase tracking-[0.2em]">Fund Growth</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monthly collection vs balance performance</CardDescription>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {fundGrowthData.length > 0 ? (
              <div className="h-[350px] w-full min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fundGrowthData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center">
                <p className="text-sm text-slate-400 font-medium">No contribution data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <RecentActivities contributions={contributions} payouts={payouts} />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <ContributionHeatMap contributions={contributions} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        <Card className="border-slate-200/50 bg-white shadow-xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
            <CardTitle className="text-slate-900 text-xs font-black uppercase tracking-[0.2em]">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveTab('members')}
                className="flex flex-col items-center justify-center p-6 rounded-3xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-100/50 group"
              >
                <div className="p-3 bg-white rounded-2xl shadow-sm mb-3 group-hover:scale-110 transition-transform">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">New Member</span>
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className="flex flex-col items-center justify-center p-6 rounded-3xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all border border-blue-100/50 group"
              >
                <div className="p-3 bg-white rounded-2xl shadow-sm mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Reports</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1 lg:col-span-2 border-slate-200/50 bg-white shadow-xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
            <CardTitle className="text-slate-900 text-xs font-black uppercase tracking-[0.2em]">Member Demographics</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[250px] w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={memberStatusData}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {memberStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
