import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  UserCheck,
  Search,
  AlertCircle,
  Plus,
  Save,
  History,
  Loader2,
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
import { Toast } from "../../ui/toast";
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
  const [submitting, setSubmitting] = useState(false);
  const [manualHistory, setManualHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [members, setMembers] = useState([]);
  const [liveEvents, setLiveEvents] = useState(
    Array.isArray(events) ? events : [],
  );
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [toast, setToast] = useState(null);

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

  const loadManualHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await attendanceAPI.getAllAttendance();
      const allRecords = Array.isArray(response)
        ? response
        : response?.attendance || response?.data?.attendance || [];

      const manualOnly = allRecords
        .filter((record) => record?.entrySource === "manual")
        .sort(
          (a, b) =>
            new Date(b.scanTime || b.createdAt || 0) -
            new Date(a.scanTime || a.createdAt || 0),
        );

      setManualHistory(manualOnly);
    } catch (error) {
      console.error("Error loading manual attendance history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadManualHistory();
  }, [loadManualHistory]);

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
      setToast({
        message: "Please select an event and provide justification.",
        type: "error",
      });
      return;
    }

    if (!isSelectedEventActive) {
      setToast({
        message: "Manual attendance is only allowed for active events.",
        type: "error",
      });
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      await attendanceAPI.recordAttendance(
        selectedMember.memberId,
        selectedEvent,
        new Date().toISOString(),
        user?.name || "Secretary",
        { entrySource: "manual", justification: justification.trim() },
      );

      setShowMarkModal(false);
      setSelectedMember(null);
      setJustification("");

      await loadManualHistory();

      // Notify parent to refresh live attendance
      if (onAttendanceRecorded) {
        onAttendanceRecorded();
      }

      setToast({ message: "Attendance recorded successfully!", type: "success" });
    } catch (error) {
      console.error("Error recording attendance:", error);
      setToast({
        message:
          error?.response?.data?.message ||
          "Failed to record attendance. Please try again.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manual Attendance
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Mark attendance manually with audit trail
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">
            All manual entries are logged for audit purposes
          </span>
        </div>
      </div>

      {/* Event Selection */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Select Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                disabled={loadingEvents || normalizedEvents.length === 0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
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
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Loading events from database...
                </p>
              )}
              {eventsError && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {eventsError}
                </p>
              )}
              {!loadingEvents &&
                !eventsError &&
                normalizedEvents.length === 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    No events found in database.
                  </p>
                )}
              {selectedEvent && !isSelectedEventActive && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Selected event is not active. You can only mark present for
                  active events.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Search Members
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or member ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member List */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-coop-green" />
            Member Directory ({filteredMembers.length})
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">
            Select members to mark attendance
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {membersError && (
            <div className="px-5 pt-5 text-sm font-medium text-red-600">
              {membersError}
            </div>
          )}
          {loadingMembers ? (
            <div className="py-12 text-center text-slate-500 font-medium">
              Loading members...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Member Details
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Member ID
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="stagger-in">
                  {filteredMembers.map((member) => (
                    <TableRow
                      key={member.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-white">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {member.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              Active Member
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono text-sm font-medium text-slate-700">
                          {member.memberId}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-coop-green rounded-full"></div>
                          <span className="text-xs font-semibold text-coop-green capitalize">
                            {member.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Button
                          onClick={() => handleMarkAttendance(member)}
                          disabled={!selectedEvent || !isSelectedEventActive}
                          className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-3.5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <Search className="w-10 h-10 text-slate-300" />
                          <div>
                            <p className="font-semibold text-slate-600">
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
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-coop-green" />
            Manual Records History ({manualHistory.length})
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">
            Audit trail of manual attendance entries
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Member
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Justification
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Marked By
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="stagger-in">
                {loadingHistory && manualHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      Loading history...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {manualHistory.map((record) => (
                      <TableRow
                        key={record.attendanceId || record._id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell className="py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {record.memberName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.memberId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">
                            {record.eventName}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {new Date(record.scanTime).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(record.scanTime).toLocaleTimeString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <p
                            className="text-sm text-slate-600 max-w-xs truncate"
                            title={record.justification}
                          >
                            {record.justification || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-white">
                                {(record.scannedBy || "S").charAt(0)}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                              {record.scannedBy || "Secretary"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingHistory && manualHistory.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-12 text-slate-400"
                        >
                          <div className="flex flex-col items-center gap-4">
                            <History className="w-10 h-10 text-slate-300" />
                            <div>
                              <p className="font-semibold text-slate-600">
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
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mark Attendance Modal */}
      <Modal
        isOpen={showMarkModal}
        onClose={() => !submitting && setShowMarkModal(false)}
        title="Mark Manual Attendance"
      >
        {selectedMember && (
          <div className="mb-5 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-white">
                  {selectedMember.name.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {selectedMember.name}
                </p>
                <p className="text-sm text-slate-500">
                  ID: {selectedMember.memberId}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitAttendance} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              disabled={loadingEvents || normalizedEvents.length === 0}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Please provide a reason for manual attendance marking (e.g., technical issues, late arrival, etc.)"
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              This justification will be logged for audit purposes
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Audit Trail Notice
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This manual attendance entry will be permanently logged with
                  your name, timestamp, and justification for audit purposes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setShowMarkModal(false)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isSelectedEventActive || submitting}
              className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Mark Attendance
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
