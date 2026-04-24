import React, { useState } from 'react';
import { 
  BarChart3, Download, Calendar, Users, Filter, 
  TrendingUp, FileText, Search, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { pdfReportGenerator } from '../../../utils/pdfReportGenerator';

export default function AttendanceReports({ user, attendanceLogs, events }) {
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [dateRange, setDateRange] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter attendance logs based on selected event and date range
  const filteredLogs = attendanceLogs.filter(log => {
    const matchesEvent = selectedEvent === 'all' || log.event === selectedEvent;
    const matchesSearch = log.member_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateRange !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      
      switch (dateRange) {
        case 'today':
          matchesDate = logDate.toDateString() === now.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = logDate >= weekAgo;
          break;
        case 'month':
          matchesDate = logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
          break;
        case 'year':
          matchesDate = logDate.getFullYear() === now.getFullYear();
          break;
      }
    }
    
    return matchesEvent && matchesSearch && matchesDate;
  });

  // Calculate statistics
  const totalAttendance = filteredLogs.length;
  const uniqueMembers = [...new Set(filteredLogs.map(log => log.member_name))].length;
  const uniqueEvents = [...new Set(filteredLogs.map(log => log.event))].length;
  const averagePerEvent = uniqueEvents > 0 ? Math.round(totalAttendance / uniqueEvents) : 0;

  // Group attendance by event for summary
  const eventSummary = events.map(event => {
    const eventLogs = filteredLogs.filter(log => log.event === event.name);
    return {
      ...event,
      attendanceCount: eventLogs.length,
      uniqueAttendees: [...new Set(eventLogs.map(log => log.member_name))].length
    };
  });

  const handleExportCSV = () => {
    const csvContent = [
      ['Member Name', 'Event', 'Date', 'Time'],
      ...filteredLogs.map(log => [
        log.member_name,
        log.event,
        new Date(log.timestamp).toLocaleDateString(),
        new Date(log.timestamp).toLocaleTimeString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    try {
      // Transform the attendance logs to match the expected format
      const transformedData = filteredLogs.map(log => ({
        scanTime: log.timestamp,
        memberId: log.member_id || 'N/A',
        memberName: log.member_name,
        eventName: log.event,
        barangay: log.barangay || 'N/A',
        status: 'Present'
      }));

      const reportOptions = {
        data: transformedData,
        filters: {
          event: selectedEvent,
          eventName: selectedEvent !== 'all' ? selectedEvent : null,
          search: searchTerm,
          dateRange: dateRange === 'all' ? 'All time' : 
                    dateRange === 'today' ? 'Today' :
                    dateRange === 'week' ? 'This Week' :
                    dateRange === 'month' ? 'This Month' :
                    dateRange === 'year' ? 'This Year' : 'Custom'
        },
        stats: {
          totalRecords: totalAttendance,
          uniqueMembers: uniqueMembers,
          uniqueEvents: uniqueEvents,
          presentCount: totalAttendance
        },
        title: 'Attendance Report',
        subtitle: 'Secretary Dashboard - Cooperative Management System'
      };

      const result = pdfReportGenerator.generateAttendanceReport(reportOptions);
      
      if (result.success) {
        console.log(`PDF report generated: ${result.filename}`);
        // You could add a toast notification here if available
      }
    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('Error generating PDF report. Please try again.');
    }
  };

  const handleExportEventSummary = (eventName) => {
    try {
      const selectedEventData = events.find(e => e.name === eventName);
      const eventAttendance = filteredLogs
        .filter(log => log.event === eventName)
        .map(log => ({
          scanTime: log.timestamp,
          memberId: log.member_id || 'N/A',
          memberName: log.member_name,
          eventName: log.event,
          barangay: log.barangay || 'N/A',
          status: 'Present'
        }));

      if (!selectedEventData) {
        alert('Event data not found');
        return;
      }

      const reportOptions = {
        eventData: {
          eventName: selectedEventData.name,
          eventDate: selectedEventData.date,
          eventTime: selectedEventData.time || 'N/A',
          location: selectedEventData.location,
          status: selectedEventData.status || 'completed',
          description: selectedEventData.description || ''
        },
        attendanceData: eventAttendance,
        title: 'Event Summary Report',
        subtitle: `${selectedEventData.name} - Detailed Attendance Analysis`
      };

      const result = pdfReportGenerator.generateEventSummaryReport(reportOptions);
      
      if (result.success) {
        console.log(`Event summary PDF generated: ${result.filename}`);
      }
    } catch (error) {
      console.error('Error generating event summary PDF:', error);
      alert('Error generating event summary. Please try again.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Attendance Reports</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">View and export attendance data</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportCSV}
            variant="outline"
            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            onClick={handleExportPDF}
            className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-green-200"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Search Member</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.name}>{event.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSelectedEvent('all');
                  setDateRange('month');
                  setSearchTerm('');
                }}
                variant="outline"
                className="w-full border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Attendance', 
            value: totalAttendance, 
            icon: Users, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Total records'
          },
          { 
            label: 'Unique Members', 
            value: uniqueMembers, 
            icon: Users, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Different attendees'
          },
          { 
            label: 'Events Covered', 
            value: uniqueEvents, 
            icon: Calendar, 
            color: 'text-coop-yellow', 
            bg: 'bg-yellow-50',
            description: 'Events with attendance'
          },
          { 
            label: 'Avg per Event', 
            value: averagePerEvent, 
            icon: TrendingUp, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Average attendance'
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

      {/* Event Summary */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-coop-green" /> 
            Event Summary
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Attendance by event</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Event Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Date</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Total Attendance</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Unique Attendees</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventSummary.map((event) => (
                  <TableRow key={event.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">{event.name}</p>
                        <p className="text-xs text-slate-500 font-bold">{event.location}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{new Date(event.date).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500 font-bold">{new Date(event.date).toLocaleTimeString()}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-coop-green">{event.attendanceCount}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{event.attendanceCount} records</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-900">{event.uniqueAttendees} members</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEvent(event.name)}
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-xl"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportEventSummary(event.name)}
                          className="border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl"
                          title="Export Event Summary PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {eventSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-slate-300" />
                        <p className="font-bold">No events found.</p>
                        <p className="text-xs">Create events to see attendance reports.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Attendance Records */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-coop-green" /> 
            Detailed Records ({filteredLogs.length})
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Individual attendance records</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Member Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Event</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Date & Time</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 50).map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-coop-green rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-white">{log.member_name.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">{log.member_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="px-3 py-1 bg-green-100 text-coop-green rounded-full text-xs font-bold">
                        {log.event}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{new Date(log.timestamp).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-coop-green rounded-full"></div>
                        <span className="text-xs font-bold text-coop-green">Present</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-4">
                        <Users className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="font-bold text-lg">No attendance records found</p>
                          <p className="text-sm">Try adjusting your filters or date range</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredLogs.length > 50 && (
            <div className="p-4 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 font-bold">
                Showing first 50 of {filteredLogs.length} records. Export to view all data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}