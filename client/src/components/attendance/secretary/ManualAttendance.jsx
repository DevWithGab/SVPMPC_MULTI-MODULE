import React, { useState } from 'react';
import { 
  UserCheck, Search, Calendar, Clock, AlertCircle, 
  CheckCircle2, Plus, Save, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Modal } from '../../ui/modal';

export default function ManualAttendance({ user, events }) {
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [justification, setJustification] = useState('');
  const [manualRecords, setManualRecords] = useState([]);

  // Mock member data - in real app, this would come from API
  const mockMembers = [
    { id: 1, name: 'John Doe', memberId: 'SVMPC-001', status: 'active' },
    { id: 2, name: 'Jane Smith', memberId: 'SVMPC-002', status: 'active' },
    { id: 3, name: 'Bob Johnson', memberId: 'SVMPC-003', status: 'active' },
    { id: 4, name: 'Alice Brown', memberId: 'SVMPC-004', status: 'active' },
    { id: 5, name: 'Charlie Wilson', memberId: 'SVMPC-005', status: 'active' },
  ];

  // Filter members based on search term
  const filteredMembers = mockMembers.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.memberId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMarkAttendance = (member) => {
    setSelectedMember(member);
    setShowMarkModal(true);
  };

  const handleSubmitAttendance = (e) => {
    e.preventDefault();
    
    if (!selectedEvent || !justification.trim()) {
      alert('Please select an event and provide justification');
      return;
    }

    const newRecord = {
      id: Date.now(),
      memberId: selectedMember.memberId,
      memberName: selectedMember.name,
      eventId: selectedEvent,
      eventName: events.find(e => e.id.toString() === selectedEvent)?.name || 'Unknown Event',
      timestamp: new Date().toISOString(),
      justification: justification.trim(),
      markedBy: user?.name || 'Secretary',
      type: 'manual'
    };

    setManualRecords(prev => [newRecord, ...prev]);
    setShowMarkModal(false);
    setSelectedMember(null);
    setJustification('');
    
    // Here you would typically call an API to save the manual attendance record
    console.log('Manual attendance recorded:', newRecord);
  };

  const getEventName = (eventId) => {
    const event = events.find(e => e.id.toString() === eventId);
    return event ? event.name : 'Unknown Event';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Manual Attendance</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">Mark attendance manually with audit trail</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span className="font-bold">All manual entries are logged for audit purposes</span>
        </div>
      </div>

      {/* Event Selection */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                required
              >
                <option value="">Choose an event...</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.name} - {new Date(event.date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Search Members</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or member ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member List */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-coop-green" /> 
            Member Directory ({filteredMembers.length})
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Select members to mark attendance</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Member Details</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Member ID</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Status</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-coop-green rounded-full flex items-center justify-center">
                          <span className="text-sm font-black text-white">{member.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-500 font-bold">Active Member</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="font-mono text-sm font-bold text-slate-900">{member.memberId}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-coop-green rounded-full"></div>
                        <span className="text-xs font-bold text-coop-green capitalize">{member.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Button
                        onClick={() => handleMarkAttendance(member)}
                        disabled={!selectedEvent}
                        className="bg-coop-green hover:bg-coop-darkGreen text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Mark Present
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-4">
                        <Search className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="font-bold text-lg">No members found</p>
                          <p className="text-sm">Try adjusting your search terms</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Records History */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-coop-green" /> 
            Manual Records History ({manualRecords.length})
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Audit trail of manual attendance entries</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Member</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Event</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Date & Time</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Justification</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">Marked By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">{record.memberName}</p>
                        <p className="text-xs text-slate-500 font-bold">{record.memberId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                        {record.eventName}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{new Date(record.timestamp).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500 font-bold">{new Date(record.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-sm text-slate-700 max-w-xs truncate" title={record.justification}>
                        {record.justification}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-coop-green rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-white">{record.markedBy.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{record.markedBy}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {manualRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-4">
                        <History className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="font-bold text-lg">No manual records yet</p>
                          <p className="text-sm">Manual attendance entries will appear here</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mark Attendance Modal */}
      <Modal isOpen={showMarkModal} onClose={() => setShowMarkModal(false)}>
        <div className="p-6">
          <h2 className="text-2xl font-black text-slate-950 mb-6">Mark Manual Attendance</h2>
          
          {selectedMember && (
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-coop-green rounded-full flex items-center justify-center">
                  <span className="text-lg font-black text-white">{selectedMember.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{selectedMember.name}</p>
                  <p className="text-sm text-slate-500 font-bold">ID: {selectedMember.memberId}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitAttendance} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                required
              >
                <option value="">Choose an event...</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.name} - {new Date(event.date).toLocaleDateString()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Please provide a reason for manual attendance marking (e.g., technical issues, late arrival, etc.)"
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-500 mt-1 font-bold">
                This justification will be logged for audit purposes
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-yellow-800">Audit Trail Notice</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This manual attendance entry will be permanently logged with your name, timestamp, and justification for audit purposes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMarkModal(false)}
                className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-xl font-bold"
              >
                <Save className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}