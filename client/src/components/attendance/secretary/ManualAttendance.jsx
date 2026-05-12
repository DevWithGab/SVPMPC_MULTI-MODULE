import React, { useEffect, useMemo, useState } from "react";
import {
  UserCheck,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  Save,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Modal } from "../../ui/modal";
import { memberAPI, attendanceAPI, eventAPI } from "../../../services/api";

export default function ManualAttendance({
  user,
  events,
  onAttendanceRecorded,
}) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [justification, setJustification] = useState("");
  const [manualRecords, setManualRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [liveEvents, setLiveEvents] = useState(
    Array.isArray(events) ? events : [],
  );
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [eventsError, setEventsError] = useState("");

  useEffect(() => {
    setLiveEvents(Array.isArray(events) ? events : []);
  }, [events]);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      setLoadingEvents(true);
      setEventsError("");

      try {
        const response = await eventAPI.getAllEvents();
        const dbEvents = Array.isArray(response)
          ? response
          : Array.isArray(response?.events)
            ? response.events
            : Array.isArray(response?.data?.events)
              ? response.data.events
              : [];

        if (isMounted) {
          setLiveEvents(dbEvents);
        }
      } catch (error) {
        if (isMounted) {
          setEventsError(
            error?.response?.data?.message ||
              error?.message ||
              "Unable to load events.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingEvents(false);
        }
      }
    };

    fetchEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      setMembersError("");
      try {
        const response = await memberAPI.getAllMembers();
        setMembers(Array.isArray(response?.members) ? response.members : []);
      } catch (error) {
        setMembersError(
          error?.response?.data?.message ||
            error?.message ||
            "Unable to load members.",
        );
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  const normalizedEvents = useMemo(
    () =>
      (Array.isArray(liveEvents) ? liveEvents : []).map((event) => ({
        value: String(event?.eventId || event?.id || event?._id || ""),
        name: event?.eventName || event?.name || "Untitled Event",
        date: event?.eventDate || event?.date || null,
        status: String(event?.status || "upcoming").toLowerCase(),
      })),
    [liveEvents],
  );

  useEffect(() => {
    if (!selectedEvent) return;

    const hasSelectedEvent = normalizedEvents.some(
      (event) => event.value === selectedEvent,
    );

    if (!hasSelectedEvent) {
      setSelectedEvent("");
    }
  }, [normalizedEvents, selectedEvent]);

  const selectedEventDetails = useMemo(
    () =>
      normalizedEvents.find((event) => event.value === selectedEvent) || null,
    [normalizedEvents, selectedEvent],
  );

  const isSelectedEventActive = selectedEventDetails?.status === "active";

  const formatEventDate = (dateValue) => {
    if (!dateValue) return "No date";
    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime())
      ? "No date"
      : parsedDate.toLocaleDateString();
  };

  const normalizedMembers = useMemo(
    () =>
      (Array.isArray(members) ? members : []).map((member) => ({
        id: member?._id || member?.memberId || member?.id,
        name: member?.memberName || member?.name || "Unknown Member",
        memberId: member?.memberId || member?.id || "N/A",
        status: String(member?.status || "inactive").toLowerCase(),
      })),
    [members],
  );

  // Filter members based on search term
  const filteredMembers = normalizedMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.memberId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleMarkAttendance = (member) => {
    setSelectedMember(member);
    setShowMarkModal(true);
  };

  const handleSubmitAttendance = async (e) => {
    e.preventDefault();

    if (!selectedEvent || !justification.trim()) {
      alert("Please select an event and provide justification");
      return;
    }

    if (!isSelectedEventActive) {
      alert("Manual attendance is only allowed for active events.");
      return;
    }

    try {
      // Call the API to record attendance
      await attendanceAPI.recordAttendance(
        selectedMember.memberId,
        selectedEvent,
        new Date().toISOString(),
        user?.name || "Secretary",
      );

      const newRecord = {
        id: Date.now(),
        memberId: selectedMember.memberId,
        memberName: selectedMember.name,
        eventId: selectedEvent,
        eventName: selectedEventDetails?.name || "Unknown Event",
        timestamp: new Date().toISOString(),
        justification: justification.trim(),
        markedBy: user?.name || "Secretary",
        type: "manual",
      };

      setManualRecords((prev) => [newRecord, ...prev]);
      setShowMarkModal(false);
      setSelectedMember(null);
      setJustification("");

      // Notify parent to refresh live attendance
      if (onAttendanceRecorded) {
        onAttendanceRecorded();
      }

      alert("Attendance recorded successfully!");
    } catch (error) {
      console.error("Error recording attendance:", error);
      alert("Failed to record attendance. Please try again.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Manual Attendance
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1">
            Mark attendance manually with audit trail
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span className="font-bold">
            All manual entries are logged for audit purposes
          </span>
        </div>
      </div>

      {/* Event Selection */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Select Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                disabled={loadingEvents || normalizedEvents.length === 0}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                required
              >
                <option value="">Choose an event...</option>
                {normalizedEvents.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.name} - {formatEventDate(event.date)} ({event.status}
                    )
                  </option>
                ))}
              </select>
              {loadingEvents && (
                <p className="mt-2 text-xs font-bold text-slate-500">
                  Loading events from database...
                </p>
              )}
              {eventsError && (
                <p className="mt-2 text-xs font-bold text-red-700">
                  {eventsError}
                </p>
              )}
              {!loadingEvents &&
                !eventsError &&
                normalizedEvents.length === 0 && (
                  <p className="mt-2 text-xs font-bold text-amber-700">
                    No events found in database.
                  </p>
                )}
              {selectedEvent && !isSelectedEventActive && (
                <p className="mt-2 text-xs font-bold text-amber-700">
                  Selected event is not active. You can only mark present for
                  active events.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Search Members
              </label>
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
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Select members to mark attendance
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {membersError && (
            <div className="px-6 pt-6 text-sm font-bold text-red-700">
              {membersError}
            </div>
          )}
          {loadingMembers ? (
            <div className="py-12 text-center text-slate-500 font-bold">
              Loading members...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                      Member Details
                    </TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                      Member ID
                    </TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                      Status
                    </TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow
                      key={member.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-coop-green rounded-full flex items-center justify-center">
                            <span className="text-sm font-black text-white">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {member.name}
                            </p>
                            <p className="text-xs text-slate-500 font-bold">
                              Active Member
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {member.memberId}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-coop-green rounded-full"></div>
                          <span className="text-xs font-bold text-coop-green capitalize">
                            {member.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Button
                          onClick={() => handleMarkAttendance(member)}
                          disabled={!selectedEvent || !isSelectedEventActive}
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
                      <TableCell
                        colSpan={4}
                        className="text-center py-12 text-slate-400"
                      >
                        <div className="flex flex-col items-center gap-4">
                          <Search className="w-12 h-12 text-slate-300" />
                          <div>
                            <p className="font-bold text-lg">
                              No members found
                            </p>
                            <p className="text-sm">
                              Try adjusting your search terms
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Records History */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-coop-green" />
            Manual Records History ({manualRecords.length})
          </CardTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Audit trail of manual attendance entries
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Member
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Event
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Justification
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-600">
                    Marked By
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {record.memberName}
                        </p>
                        <p className="text-xs text-slate-500 font-bold">
                          {record.memberId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                        {record.eventName}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {new Date(record.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-500 font-bold">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <p
                        className="text-sm text-slate-700 max-w-xs truncate"
                        title={record.justification}
                      >
                        {record.justification}
                      </p>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-coop-green rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-white">
                            {record.markedBy.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {record.markedBy}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {manualRecords.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <History className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="font-bold text-lg">
                            No manual records yet
                          </p>
                          <p className="text-sm">
                            Manual attendance entries will appear here
                          </p>
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
          <h2 className="text-2xl font-black text-slate-950 mb-6">
            Mark Manual Attendance
          </h2>

          {selectedMember && (
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-coop-green rounded-full flex items-center justify-center">
                  <span className="text-lg font-black text-white">
                    {selectedMember.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {selectedMember.name}
                  </p>
                  <p className="text-sm text-slate-500 font-bold">
                    ID: {selectedMember.memberId}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitAttendance} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                disabled={loadingEvents || normalizedEvents.length === 0}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-coop-green focus:border-transparent"
                required
              >
                <option value="">Choose an event...</option>
                {normalizedEvents.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.name} - {formatEventDate(event.date)} ({event.status}
                    )
                  </option>
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
                  <p className="text-sm font-bold text-yellow-800">
                    Audit Trail Notice
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This manual attendance entry will be permanently logged with
                    your name, timestamp, and justification for audit purposes.
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
                disabled={!isSelectedEventActive}
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
