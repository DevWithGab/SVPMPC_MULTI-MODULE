import React from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, Activity, Clock, CheckCircle2, ArrowRight, 
  Download, LifeBuoy, TrendingUp, ArrowUpRight, Camera 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

export default function Dashboard({ 
  profile, 
  myContributions, 
  myClaims, 
  setActiveTab, 
  handleAvatarUpload 
}) {
  const totalContributions = myContributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const membershipProgress = Math.min((totalContributions / 10000) * 100, 100);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Section */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-coop-green rounded-[2.5rem] opacity-20 group-hover:opacity-30 transition-opacity duration-700" />
        <div className="relative bg-white border border-slate-100 p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/40 flex flex-col lg:flex-row justify-between items-center gap-8 overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-coop-green/5 rounded-full -mr-48 -mt-48 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-coop-yellow/10 rounded-full -ml-32 -mb-32 blur-2xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-[2rem] bg-coop-green flex items-center justify-center shadow-2xl shadow-green-200 shrink-0 transform group-hover:rotate-3 transition-transform duration-500 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Heart className="w-12 h-12 text-white" />
                )}
              </div>
              <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 w-8 h-8 bg-coop-yellow rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform duration-300 border-2 border-white">
                <Camera className="w-4 h-4 text-slate-700" />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-2">
                Welcome back, {profile?.name || 'Member'}!
              </h1>
              <p className="text-slate-500 text-sm font-bold mb-4">
                Member ID: <span className="text-coop-green font-black">{profile?.id || 'Loading...'}</span>
              </p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Badge className="bg-green-50 text-coop-green border-green-200 px-4 py-2 rounded-full font-black text-xs">
                  {profile?.status || 'Active'}
                </Badge>
                <Badge className="bg-slate-50 text-slate-600 border-slate-200 px-4 py-2 rounded-full font-black text-xs">
                  Since {profile?.join_date ? new Date(profile.join_date).getFullYear() : '2023'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Button onClick={() => setActiveTab('claims')} className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-200 hover:shadow-green-300 transition-all duration-300 hover:scale-105 text-sm">
              File New Claim
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Main Stats - Total Contributions */}
        <Card className="md:col-span-2 border-green-600/30 bg-coop-green shadow-2xl shadow-green-900/20 rounded-[2rem] relative overflow-hidden text-white group p-6 transition-all duration-500 hover:shadow-green-900/40 ring-1 ring-white/20 inset shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
          {/* Animated Background Elements */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full -mr-24 -mt-24 blur-[60px] group-hover:scale-125 transition-transform duration-1000" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-coop-yellow/20 rounded-full -ml-16 -mb-16 blur-[40px] group-hover:scale-110 transition-transform duration-700" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Total Contributions</p>
              <h3 className="text-4xl font-black tracking-tighter">₱{totalContributions.toLocaleString()}</h3>
              <p className="text-[10px] text-white/60 font-bold">
                {myContributions.length} payments made
              </p>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="flex items-center justify-between text-[10px] font-bold text-white/80 mb-2">
                <span>MEMBERSHIP PROGRESS</span>
                <span>{membershipProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-coop-yellow rounded-full transition-all duration-1000 ease-out shadow-lg"
                  style={{ width: `${membershipProgress}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Membership Status Circle */}
        <Card className="md:col-span-2 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-6 flex flex-col items-center justify-center text-center bg-white relative overflow-hidden group hover:border-green-200 transition-all duration-500 hover:shadow-xl hover:shadow-green-900/5">
          <div className="absolute inset-0 bg-green-50/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 bg-green-50 rounded-full animate-pulse" />
            
            <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_4px_12px_rgba(45,122,62,0.15)]">
              <circle 
                cx="56" 
                cy="56" 
                r="48" 
                stroke="transparent" 
                strokeWidth="8" 
                fill="transparent" 
              />
              <circle 
                cx="56" 
                cy="56" 
                r="48" 
                stroke="#2D7A3E" 
                strokeWidth="8" 
                fill="transparent" 
                strokeDasharray={301} 
                strokeDashoffset={301 * (1 - 0.85)} 
                className="transition-all duration-1000 ease-out" 
                strokeLinecap="round" 
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-coop-green mb-1" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active</span>
            </div>
          </div>
          
          <div className="mt-6 relative z-10">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Membership Status</p>
            <h4 className="text-lg font-black text-slate-950 tracking-tight">Good Standing</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-1">85% Complete</p>
          </div>
        </Card>

        {/* Contribution Chart */}
        <Card className="md:col-span-2 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-6 bg-white group hover:border-green-200 transition-all duration-500 hover:shadow-xl hover:shadow-green-900/5">
          <CardHeader className="p-0 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-slate-950 tracking-tight">Payment History</CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Last 4 months</CardDescription>
              </div>
              <div className="p-2 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                <Activity className="w-4 h-4 text-coop-green" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={[...myContributions].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="payment_date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)' }}
                  labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px', color: '#64748b', letterSpacing: '0.1em' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#2D7A3E" strokeWidth={4} fill="#2D7A3E" fillOpacity={0.15} animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions - Now integrated into the same row as Chart on desktop */}
        <div className="md:col-span-2 space-y-4">
          <Button onClick={() => setActiveTab('documents')} variant="outline" className="w-full h-[calc(50%-8px)] flex items-center justify-start gap-4 border-slate-200/60 hover:border-coop-green hover:bg-green-50 transition-all rounded-[2rem] group p-4 border-2">
            <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
              <Download className="w-5 h-5 text-coop-green group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left">
              <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-950 leading-tight">Certificate</span>
              <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Download PDF</span>
            </div>
          </Button>
          <Button onClick={() => setActiveTab('support')} variant="outline" className="w-full h-[calc(50%-8px)] flex items-center justify-start gap-4 border-slate-200/60 hover:border-coop-green hover:bg-green-50 transition-all rounded-[2rem] group p-4 border-2">
            <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
              <LifeBuoy className="w-5 h-5 text-coop-green group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left">
              <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-950 leading-tight">Help Center</span>
              <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Contact Support</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}