import React from 'react';
import { 
  Calendar, Users, BarChart3, UserCheck, Plus, 
  TrendingUp, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';

export default function SecretaryDashboard({ user, attendanceLogs, events, setActiveTab }) {
  // Calculate stats
  const totalEvents = events.length;
  const activeEvents = events.filter(event => event.status === 'active').length;
  const totalAttendance = attendanceLogs.length;
  const todayAttendance = attendanceLogs.filter(log => 
    new Date(log.timestamp).toDateString() === new Date().toDateString()
  ).length;

  // Get recent events
  const recentEvents = events.slice(0, 5);

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
                <BarChart3 className="w-12 h-12 text-white" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-2">
                Secretary Dashboard
              </h1>
              <p className="text-slate-500 text-sm font-bold mb-4">
                Welcome back, <span className="text-coop-green font-black">{user?.name || 'Secretary'}</span>
              </p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="bg-green-50 text-coop-green border border-green-200 px-4 py-2 rounded-full font-black text-xs">
                  Secretary Access
                </div>
                <div className="bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-full font-black text-xs">
                  Attendance System
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={() => setActiveTab('events')} 
              className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-200 hover:shadow-green-300 transition-all duration-300 hover:scale-105 text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Events', 
            value: totalEvents, 
            icon: Calendar, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'All events created'
          },
          { 
            label: 'Active Events', 
            value: activeEvents, 
            icon: Clock, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Currently running'
          },
          { 
            label: 'Total Attendance', 
            value: totalAttendance, 
            icon: Users, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'All time records'
          },
          { 
            label: 'Today\'s Attendance', 
            value: todayAttendance, 
            icon: CheckCircle2, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Today\'s records'
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Events */}
        <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 p-6">
            <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-coop-green" /> 
              Recent Events
            </CardTitle>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Latest event activities</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Event Name</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Date</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((event) => (
                    <TableRow key={event.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-slate-900 font-bold py-4">
                        <div>
                          <p className="text-sm font-black">{event.eventName || event.name}</p>
                          <p className="text-xs text-slate-500 font-bold">{event.location}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{new Date(event.eventDate || event.date).toLocaleDateString()}</p>
                          <p className="text-xs text-slate-500 font-bold">{event.eventTime || new Date(event.eventDate || event.date).toLocaleTimeString()}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          {event.status === 'active' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-coop-green" />
                              <span className="text-xs font-bold text-coop-green">Active</span>
                            </>
                          ) : event.status === 'upcoming' ? (
                            <>
                              <Clock className="w-4 h-4 text-coop-green" />
                              <span className="text-xs font-bold text-coop-green">Upcoming</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold text-slate-400">Completed</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="w-8 h-8 text-slate-300" />
                          <p className="font-bold">No events found.</p>
                          <p className="text-xs">Create your first event to get started.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-slate-100 text-center">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab('events')}
                className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold"
              >
                Manage All Events
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-50 p-6">
              <CardTitle className="text-lg font-black text-slate-900">Quick Actions</CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Common tasks</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button 
                onClick={() => setActiveTab('events')} 
                className="w-full h-16 flex items-center justify-start gap-4 bg-coop-green hover:bg-coop-darkGreen text-white rounded-2xl p-4"
              >
                <div className="p-3 bg-white/20 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black">Create New Event</span>
                  <span className="block text-xs opacity-80">Set up General Assembly</span>
                </div>
              </Button>

              <Button 
                onClick={() => setActiveTab('manual')} 
                variant="outline"
                className="w-full h-16 flex items-center justify-start gap-4 border-slate-200 hover:border-coop-green hover:bg-green-50 rounded-2xl p-4"
              >
                <div className="p-3 bg-green-50 rounded-xl">
                  <UserCheck className="w-5 h-5 text-coop-green" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black text-slate-900">Manual Attendance</span>
                  <span className="block text-xs text-slate-500">Mark attendance manually</span>
                </div>
              </Button>

              <Button 
                onClick={() => setActiveTab('reports')} 
                variant="outline"
                className="w-full h-16 flex items-center justify-start gap-4 border-slate-200 hover:border-coop-green hover:bg-green-50 rounded-2xl p-4"
              >
                <div className="p-3 bg-green-50 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-coop-green" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black text-slate-900">View Reports</span>
                  <span className="block text-xs text-slate-500">Export attendance data</span>
                </div>
              </Button>

              <Button 
                onClick={() => setActiveTab('directory')} 
                variant="outline"
                className="w-full h-16 flex items-center justify-start gap-4 border-slate-200 hover:border-coop-green hover:bg-green-50 rounded-2xl p-4"
              >
                <div className="p-3 bg-green-50 rounded-xl">
                  <Users className="w-5 h-5 text-coop-green" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black text-slate-900">Member Directory</span>
                  <span className="block text-xs text-slate-500">View member QR codes</span>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}