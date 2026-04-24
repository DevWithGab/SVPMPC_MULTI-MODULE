import React, { useState } from 'react';
import { 
  Calendar, Clock, CheckCircle2, Search, Filter, 
  Download, TrendingUp, Activity, Users, Eye 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';

export default function AttendanceHistory({ user, attendanceLogs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  
  const myLogs = attendanceLogs.filter((log) => log.member_name === user.name);
  
  // Filter logs based on search and month
  const filteredLogs = myLogs.filter(log => {
    const matchesSearch = log.event.toLowerCase().includes(searchTerm.toLowerCase());
    const logDate = new Date(log.timestamp);
    const matchesMonth = selectedMonth === 'all' || 
      logDate.getMonth() === parseInt(selectedMonth);
    return matchesSearch && matchesMonth;
  });

  // Calculate stats
  const totalAttendance = myLogs.length;
  const thisMonth = myLogs.filter(log => 
    new Date(log.timestamp).getMonth() === new Date().getMonth()
  ).length;
  const uniqueEvents = [...new Set(myLogs.map(log => log.event))].length;
  const averagePerMonth = totalAttendance > 0 ? Math.round(totalAttendance / 12) : 0;

  // Group logs by month for stats
  const monthlyStats = myLogs.reduce((acc, log) => {
    const month = new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const months = [
    { value: 'all', label: 'All Months' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Attendance History</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Complete record of your event attendance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-4 py-2 rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Attendance', 
            value: totalAttendance, 
            icon: CheckCircle2, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'All time records'
          },
          { 
            label: 'This Month', 
            value: thisMonth, 
            icon: Calendar, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Current period'
          },
          { 
            label: 'Unique Events', 
            value: uniqueEvents, 
            icon: Users, 
            color: 'text-coop-yellow', 
            bg: 'bg-yellow-50',
            description: 'Different events'
          },
          { 
            label: 'Monthly Average', 
            value: averagePerMonth, 
            icon: TrendingUp, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Per month'
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white group hover:border-green-200 transition-all relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 ${stat.bg} rounded-full -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-950 tracking-tighter mb-1">{stat.value}</h3>
                <p className="text-[10px] text-slate-500 font-bold">{stat.description}</p>
              </div>
              <div className={`p-3 ${stat.bg} rounded-xl group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Monthly Overview */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-xl font-black text-slate-950 tracking-tight">Monthly Overview</CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Attendance by month</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(monthlyStats).slice(-6).map(([month, count]) => (
              <div key={month} className="text-center p-4 bg-slate-50 rounded-2xl hover:bg-green-50 transition-colors">
                <p className="text-2xl font-black text-slate-950 mb-1">{count}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{month}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-6 bg-white">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-8 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent bg-white"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Attendance Records Table */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-black text-slate-950 tracking-tight">Attendance Records</CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Showing {filteredLogs.length} of {myLogs.length} records
              </p>
            </div>
          </div>
        </CardHeader>
        
        {filteredLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 hover:bg-slate-50/50">
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em] py-6">Date & Time</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Event</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Status</TableHead>
                <TableHead className="font-black text-slate-600 text-[10px] uppercase tracking-[0.2em]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="border-slate-100 hover:bg-slate-50/50 group">
                  <TableCell className="py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-green-50 transition-colors">
                        <Calendar className="w-4 h-4 text-slate-400 group-hover:text-coop-green" />
                      </div>
                      <div>
                        <p className="font-black text-slate-950 text-sm">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-950 text-sm">{log.event}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-coop-green" />
                      <Badge className="bg-green-50 text-coop-green border-green-200 px-3 py-1 rounded-full font-black text-xs">
                        Present
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold text-xs px-4 py-2 rounded-xl">
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-black text-slate-400 mb-2">No Records Found</h4>
            <p className="text-slate-400 text-sm">
              {searchTerm || selectedMonth !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Your attendance records will appear here after scanning QR codes at events.'
              }
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}