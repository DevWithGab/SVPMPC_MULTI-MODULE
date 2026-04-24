import React, { useRef } from 'react';
import { 
  Calendar, Printer, QrCode, TrendingUp, Clock, 
  CheckCircle2, Users, Activity 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { QRCodeSVG } from 'qrcode.react';

export default function AttendanceDashboard({ user, attendanceLogs, setActiveTab }) {
  const myLogs = attendanceLogs.filter((log) => log.member_name === user.name);
  const qrRef = useRef(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrRef.current) {
      const svg = qrRef.current.querySelector('svg');
      const svgData = new XMLSerializer().serializeToString(svg);
      printWindow.document.write(`
        <html>
          <head>
            <title>My Attendance QR</title>
            <style>
              body { 
                font-family: sans-serif; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                margin: 0; 
              }
              .card { 
                border: 2px solid #2D7A3E; 
                padding: 40px; 
                border-radius: 20px; 
                text-align: center; 
              }
              h1 { 
                margin: 0 0 10px 0; 
                color: #2D7A3E; 
              }
              p { 
                margin: 0 0 30px 0; 
                color: #64748b; 
              }
              svg { 
                width: 200px; 
                height: 200px; 
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>${user.name}</h1>
              <p>Member ID: ${user.id}</p>
              ${svgData}
            </div>
            <script>setTimeout(() => window.print(), 500);</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Calculate stats
  const totalAttendance = myLogs.length;
  const thisMonth = myLogs.filter(log => 
    new Date(log.timestamp).getMonth() === new Date().getMonth()
  ).length;
  const uniqueEvents = [...new Set(myLogs.map(log => log.event))].length;

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
                <QrCode className="w-12 h-12 text-white" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-2">
                Welcome back, {user?.name || 'Member'}!
              </h1>
              <p className="text-slate-500 text-sm font-bold mb-4">
                Member ID: <span className="text-coop-green font-black">{user?.id?.toString().padStart(6, '0') || 'Loading...'}</span>
              </p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="bg-green-50 text-coop-green border border-green-200 px-4 py-2 rounded-full font-black text-xs">
                  Active Member
                </div>
                <div className="bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-full font-black text-xs">
                  Attendance System
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={() => setActiveTab('scanner')} 
              className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-green-200 hover:shadow-green-300 transition-all duration-300 hover:scale-105 text-sm"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Scan QR Code
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            label: 'Events Attended', 
            value: uniqueEvents, 
            icon: Users, 
            color: 'text-coop-yellow', 
            bg: 'bg-yellow-50',
            description: 'Unique events'
          },
          { 
            label: 'Attendance Rate', 
            value: '95%', 
            icon: TrendingUp, 
            color: 'text-coop-green', 
            bg: 'bg-green-50',
            description: 'Overall rate'
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* QR Code Card */}
        <Card className="md:col-span-1 border-slate-200/60 shadow-xl rounded-[2rem] overflow-hidden bg-white text-center">
          <CardHeader className="bg-green-50 border-b border-green-100 pb-8 pt-8">
            <CardTitle className="text-xl font-black text-coop-darkGreen">Your QR Pass</CardTitle>
            <p className="text-coop-green/70 text-xs font-medium">Present this code for attendance</p>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 mb-6" ref={qrRef}>
              <QRCodeSVG 
                value={user?.id?.toString() || 'loading'} 
                size={200} 
                level="H" 
                fgColor="#2D7A3E" 
              />
            </div>
            <h3 className="text-2xl font-black text-slate-900">{user?.name || 'Loading...'}</h3>
            <p className="text-slate-500 font-mono mt-1 mb-6">
              ID: {user?.id?.toString().padStart(6, '0') || '000000'}
            </p>
            <Button 
              onClick={handlePrint} 
              className="w-full h-12 rounded-xl bg-coop-green hover:bg-coop-darkGreen text-white font-black tracking-widest shadow-lg shadow-green-700/20"
            >
              <Printer className="w-4 h-4 mr-2" /> 
              Print ID Card
            </Button>
          </CardContent>
        </Card>

        {/* Attendance History */}
        <Card className="md:col-span-2 border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 p-6">
            <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-coop-green" /> 
              My Attendance History
            </CardTitle>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Recent attendance records</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Date & Time</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Event</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLogs.slice(0, 5).map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-slate-900 font-bold py-4">
                        <div>
                          <p className="text-sm font-black">{new Date(log.timestamp).toLocaleDateString()}</p>
                          <p className="text-xs text-slate-500 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="px-3 py-1 bg-green-100 text-coop-green rounded-full text-xs font-bold">
                          {log.event}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-coop-green" />
                          <span className="text-xs font-bold text-coop-green">Present</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Activity className="w-8 h-8 text-slate-300" />
                          <p className="font-bold">No attendance records found.</p>
                          <p className="text-xs">Your attendance will appear here after scanning QR codes.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {myLogs.length > 5 && (
              <div className="p-4 border-t border-slate-100 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('history')}
                  className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold"
                >
                  View All Records ({myLogs.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Button 
          onClick={() => setActiveTab('scanner')} 
          variant="outline" 
          className="h-20 flex items-center justify-start gap-4 border-slate-200/60 hover:border-coop-green hover:bg-green-50 transition-all rounded-[2rem] group p-6 border-2"
        >
          <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
            <QrCode className="w-6 h-6 text-coop-green group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-black uppercase tracking-[0.2em] text-slate-950 leading-tight">QR Scanner</span>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Scan for attendance</span>
          </div>
        </Button>

        <Button 
          onClick={() => setActiveTab('history')} 
          variant="outline" 
          className="h-20 flex items-center justify-start gap-4 border-slate-200/60 hover:border-coop-green hover:bg-green-50 transition-all rounded-[2rem] group p-6 border-2"
        >
          <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
            <Calendar className="w-6 h-6 text-coop-green group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-black uppercase tracking-[0.2em] text-slate-950 leading-tight">Full History</span>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">View all records</span>
          </div>
        </Button>

        <Button 
          onClick={handlePrint} 
          variant="outline" 
          className="h-20 flex items-center justify-start gap-4 border-slate-200/60 hover:border-coop-green hover:bg-green-50 transition-all rounded-[2rem] group p-6 border-2"
        >
          <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
            <Printer className="w-6 h-6 text-coop-green group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-black uppercase tracking-[0.2em] text-slate-950 leading-tight">Print QR Card</span>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Physical ID card</span>
          </div>
        </Button>
      </div>
    </div>
  );
}