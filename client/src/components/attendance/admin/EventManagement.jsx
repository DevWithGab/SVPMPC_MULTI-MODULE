import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Trash2, FileText, Settings, Clock, Users, XCircle } from 'lucide-react';

const EventManagement = ({ events, setEvents, attendanceLogs, setActiveTab, setCurrentEvent }) => {
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!newEventName) return;
    
    const newEvent = {
      id: Date.now(),
      name: newEventName,
      date: newEventDate,
      status: 'upcoming'
    };
    
    setEvents([...events, newEvent]);
    setNewEventName('');
    setIsAddEventOpen(false);
  };

  const toggleEventStatus = (eventId) => {
    setEvents(events.map((ev) => {
      if (ev.id === eventId) {
        const statuses = ['upcoming', 'active', 'completed', 'closed'];
        const currentIndex = statuses.indexOf(ev.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        return { ...ev, status: nextStatus };
      }
      return ev;
    }));
  };

  const deleteEvent = (eventId) => {
    if (window.confirm("Are you sure you want to delete this event? This will not delete the attendance logs associated with it.")) {
      setEvents(events.filter((ev) => ev.id !== eventId));
    }
  };

  const generateEventReport = (event) => {
    const eventLogs = attendanceLogs.filter((log) => log.event === event.name);
    if (eventLogs.length === 0) {
      alert("No attendance records for this event yet.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const presentCount = new Set(eventLogs.map((log) => log.member_name)).size;
    const rate = 100; // Simplified for now

    const rows = eventLogs.map((log) => {
      const date = new Date(log.timestamp);
      return `<tr><td>${date.toLocaleDateString()}</td><td>${date.toLocaleTimeString()}</td><td>${log.member_name}</td></tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${event.name} - Attendance Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #2D7A3E; padding-bottom: 20px; margin-bottom: 30px; }
            .stats { display: flex; gap: 20px; justify-content: center; margin-bottom: 30px; }
            .stat { border: 1px solid #e2e8f0; padding: 15px 30px; border-radius: 12px; text-align: center; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #f8fafc; padding: 12px; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Attendance Report: ${event.name}</h1>
            <p>Event Date: ${event.date}</p>
          </div>
          <div class="stats">
            <div class="stat"><h3>${presentCount}</h3><p>Attendees</p></div>
            <div class="stat"><h3>${rate}%</h3><p>Attendance Rate</p></div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Member Name</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#2D7A3E' }}>Assembly Events</h2>
          <p className="text-gray-600 font-medium tracking-tight">Manage cooperative sessions and general meetings</p>
        </div>
        <button 
          onClick={() => setIsAddEventOpen(true)}
          className="h-12 px-8 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
          style={{ backgroundColor: '#2D7A3E' }}
        >
          <Plus className="w-4 h-4 mr-2 inline" /> Schedule New Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {events.map((event) => (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group hover:border-green-200 transition-all duration-300">
                <div className="bg-gray-50/50 p-6 pb-4 border-b border-gray-100 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                      event.status === 'active' ? 'bg-green-100 border-green-200 text-green-700' :
                      event.status === 'upcoming' ? 'bg-yellow-100 border-yellow-200 text-yellow-700' :
                      'bg-gray-100 border-gray-200 text-gray-500'
                    }`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        event.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' :
                        event.status === 'upcoming' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                        'bg-gray-50 text-gray-500 border border-gray-100'
                      }`}>
                        {event.status}
                      </span>
                      <h3 className="font-bold text-gray-900 group-hover:text-green-950 transition-colors mt-1">{event.name}</h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteEvent(event.id)} 
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500 font-bold">
                        <Clock className="w-4 h-4" />
                        <span>Event Date</span>
                      </div>
                      <span className="text-gray-900 font-bold">{event.date}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-500 font-bold">
                        <Users className="w-4 h-4" />
                        <span>Attendees Recorded</span>
                      </div>
                      <span className="text-gray-900 font-bold">
                        {attendanceLogs.filter((l) => l.event === event.name).length}
                      </span>
                    </div>

                    <div className="pt-4 grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => generateEventReport(event)}
                        className="h-10 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all"
                      >
                        <FileText className="w-3 h-3 mr-2 inline" /> Report
                      </button>
                      <button 
                        onClick={() => toggleEventStatus(event.id)}
                        className="h-10 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
                      >
                        <Settings className="w-3 h-3 mr-2 inline text-gray-400" /> Status
                      </button>
                    </div>
                    
                    {event.status === 'active' && (
                      <div className="mt-2 text-center">
                        <button 
                          onClick={() => {
                            setCurrentEvent(event);
                            setActiveTab('dashboard');
                          }}
                          className="w-full h-10 rounded-xl border-none text-white text-xs font-bold uppercase tracking-wider shadow-lg"
                          style={{ backgroundColor: '#2D7A3E' }}
                        >
                          Launch Scanner Station
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isAddEventOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddEventOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border"
              style={{ borderColor: '#2D7A3E' }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight uppercase">New Assembly Event</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">Schedule dynamic session</p>
                  </div>
                  <button 
                    onClick={() => setIsAddEventOpen(false)} 
                    className="rounded-full hover:bg-gray-100 p-2"
                  >
                    <XCircle className="w-6 h-6 text-gray-300" />
                  </button>
                </div>

                <form onSubmit={handleAddEvent} className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Official Event Name</label>
                    <input 
                      autoFocus
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g. 25th Annual General Meeting"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>
                  
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Scheduled Date</label>
                    <input 
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsAddEventOpen(false)}
                      className="flex-1 h-14 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                    >
                      Discard
                    </button>
                    <button 
                      type="submit"
                      disabled={!newEventName}
                      className="flex-1 h-14 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#2D7A3E' }}
                    >
                      Establish Event
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventManagement;