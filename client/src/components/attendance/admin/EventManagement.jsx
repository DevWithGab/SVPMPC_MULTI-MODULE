import React, { useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Trash2,
  FileText,
  Settings,
  Clock,
  Users,
  XCircle,
  Edit3,
  Grid,
  List,
  MapPin,
  Search,
  Filter,
} from "lucide-react";
import { eventAPI } from "../../../services/api";
import { formatDate, formatTime } from "../../../utils/date";

const getEventKey = (event) => event.eventId || event._id || event.id;
const getEventName = (event) =>
  event.eventName || event.name || "Untitled Event";
const getEventDateValue = (event) => event.eventDate || event.date || "";
const getEventDisplayDate = (event) => {
  const dateValue = getEventDateValue(event);
  return dateValue ? formatDate(dateValue) : "No date";
};

const getEventAttendanceCount = (event, attendanceLogs) => {
  const eventKey = String(getEventKey(event) || "");
  const eventName = String(getEventName(event) || "");

  return attendanceLogs.filter((log) => {
    const logEventKey = String(log?.eventId || log?.event_id || "");
    const logEventName = String(log?.event || log?.eventName || "");
    const isMatchingEvent =
      (eventKey && logEventKey === eventKey) ||
      (eventName && logEventName === eventName);
    const isPresent = String(log?.status || "").toLowerCase() === "present";

    return isMatchingEvent && isPresent;
  }).length;
};

const EventManagement = ({ events, setEvents, attendanceLogs }) => {
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [viewType, setViewType] = useState("card"); // "card" or "table"
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLocation, setFilterLocation] = useState("All");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [newEventStatus, setNewEventStatus] = useState("upcoming");
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventDate, setEditEventDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [editEventLocation, setEditEventLocation] = useState("");
  const [editEventStartTime, setEditEventStartTime] = useState("");
  const [editEventEndTime, setEditEventEndTime] = useState("");
  const [editEventStatus, setEditEventStatus] = useState("upcoming");

  // Filter events based on search term
  const filteredEvents = events.filter((event) => {
    const searchLower = searchTerm.toLowerCase();
    const eventName = getEventName(event).toLowerCase();
    const eventLocation = (event.location || "").toLowerCase();

    return (
      eventName.includes(searchLower) || eventLocation.includes(searchLower)
    );
  });

  const handleLocationChange = async (e) => {
    const value = e.target.value;
    setFilterLocation(value);

    try {
      const params = {};
      if (value && value !== "All") params.location = value;

      const response = await eventAPI.getEvents(params);
      // response expected { count, events }
      const data = response.events || response.data || response;
      if (Array.isArray(data)) {
        setEvents(data);
      } else if (data && data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Error fetching filtered events:", err);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return;

    try {
      const eventData = {
        eventName: newEventName,
        eventDate: `${newEventDate}T${newEventStartTime || "00:00"}`,
        eventTime: newEventStartTime || "00:00",
        startTime: newEventStartTime || "00:00",
        endTime: newEventEndTime || "00:00",
        location: newEventLocation,
        description: "",
        status: newEventStatus,
        createdBy: "admin",
      };

      const response = await eventAPI.createEvent(eventData);
      const createdEvent = response.event || response.data || response;

      if (createdEvent) {
        setEvents([...events, createdEvent]);
      }

      setNewEventName("");
      setNewEventDate(new Date().toISOString().split("T")[0]);
      setNewEventLocation("");
      setNewEventStartTime("");
      setNewEventEndTime("");
      setNewEventStatus("upcoming");
      setIsAddEventOpen(false);
    } catch (error) {
      console.error("Error creating event:", error);
      alert(
        error.response?.data?.message ||
          "Failed to create event. Please try again.",
      );
    }
  };

  const handleOpenEditEvent = (event) => {
    setEditEvent(event);
    setEditEventName(getEventName(event));
    setEditEventDate(
      getEventDateValue(event) || new Date().toISOString().split("T")[0],
    );
    setEditEventLocation(event.location || "");
    setEditEventStartTime(event.startTime || event.eventTime || "");
    setEditEventEndTime(event.endTime || "");
    setEditEventStatus(event.status || "upcoming");
    setIsEditEventOpen(true);
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editEvent) return;

    try {
      const editKey = editEvent.eventId || editEvent.id;
      const eventId = editEvent.eventId || editEvent._id || editKey;
      const eventData = {
        eventName: editEventName,
        eventDate: `${editEventDate}T${editEventStartTime || "00:00"}`,
        eventTime: editEventStartTime || "00:00",
        startTime: editEventStartTime || "00:00",
        endTime: editEventEndTime || "00:00",
        location: editEventLocation || editEvent.location || "",
        description: editEvent.description || "",
        status: editEventStatus,
      };

      const response = await eventAPI.updateEvent(eventId, eventData);
      const updatedEvent = response.event || response.data || response;

      setEvents(
        events.map((ev) =>
          (ev.eventId || ev.id) === editKey ? updatedEvent : ev,
        ),
      );

      setIsEditEventOpen(false);
      setEditEvent(null);
      setEditEventName("");
      setEditEventDate(new Date().toISOString().split("T")[0]);
      setEditEventLocation("");
      setEditEventStartTime("");
      setEditEventEndTime("");
      setEditEventStatus("upcoming");
    } catch (error) {
      console.error("Error updating event:", error);
      alert(
        error.response?.data?.message ||
          "Failed to update event. Please try again.",
      );
    }
  };

  const toggleEventStatus = async (event) => {
    const eventId = getEventKey(event);
    const statuses = ["upcoming", "active", "completed", "closed"];
    const currentIndex = statuses.indexOf(event.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    try {
      if (eventId) {
        await eventAPI.updateEvent(eventId, { status: nextStatus });
      }
      setEvents(
        events.map((ev) =>
          getEventKey(ev) === eventId ? { ...ev, status: nextStatus } : ev,
        ),
      );
    } catch (error) {
      console.error("Error updating event status:", error);
      alert(
        error.response?.data?.message ||
          "Failed to update event status. Please try again.",
      );
    }
  };

  const deleteEvent = async (event) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this event? This will not delete the attendance logs associated with it.",
      )
    ) {
      return;
    }

    const eventId = getEventKey(event);
    try {
      const response = await eventAPI.deleteEvent(eventId);
      if (response.message) {
        setEvents(events.filter((ev) => getEventKey(ev) !== eventId));
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      alert(
        error.response?.data?.message ||
          "Failed to delete event. Please try again.",
      );
    }
  };

  const generateEventReport = (event) => {
    const eventLogs = attendanceLogs.filter((log) => {
      const eventKey = String(getEventKey(event) || "");
      const eventName = String(getEventName(event) || "");
      const logEventKey = String(log?.eventId || log?.event_id || "");
      const logEventName = String(log?.event || log?.eventName || "");
      const isMatchingEvent =
        (eventKey && logEventKey === eventKey) ||
        (eventName && logEventName === eventName);
      const isPresent = String(log?.status || "").toLowerCase() === "present";

      return isMatchingEvent && isPresent;
    });
    if (eventLogs.length === 0) {
      alert("No attendance records for this event yet.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const presentCount = eventLogs.length;
    const rate = 100; // Simplified for now

    const rows = eventLogs
      .map((log) => {
        const date = new Date(log.timestamp);
        return `<tr><td>${formatDate(date)}</td><td>${formatTime(date)}</td><td>${log.member_name}</td></tr>`;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${getEventName(event)} - Attendance Report</title>
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
            <h1>Attendance Report: ${getEventName(event)}</h1>
            <p>Event Date: ${getEventDisplayDate(event)}</p>
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
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#2D7A3E" }}
          >
            Assembly Events
          </h2>
          <p className="text-gray-600 font-medium tracking-tight">
            Manage cooperative sessions and general meetings
          </p>
        </div>
        <button
          onClick={() => setIsAddEventOpen(true)}
          className="h-12 px-8 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
          style={{ backgroundColor: "#2D7A3E" }}
        >
          <Plus className="w-4 h-4 mr-2 inline" /> Schedule New Event
        </button>
      </div>

      {/* Search, Filter and View Toggle */}
      <div className="flex gap-3 items-center bg-white rounded-xl border border-gray-200 px-4 py-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by event name or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent"
        />

        <div className="flex items-center gap-3 border-l border-gray-200 pl-3 ml-1">
          <div className="flex gap-1">
            <button
              onClick={() => setViewType("table")}
              className={`p-2 rounded transition-all ${
                viewType === "table"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewType("card")}
              className={`p-2 rounded transition-all ${
                viewType === "card"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="Grid View"
            >
              <Grid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Card View */}
      {viewType === "card" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredEvents.map((event) => (
              <Motion.div
                key={getEventKey(event)}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group hover:border-green-200 transition-all duration-300">
                  <div className="bg-gray-50/50 p-6 pb-4 border-b border-gray-100 flex flex-row items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                          event.status === "active"
                            ? "bg-green-100 border-green-200 text-green-700"
                            : event.status === "upcoming"
                              ? "bg-yellow-100 border-yellow-200 text-yellow-700"
                              : "bg-gray-100 border-gray-200 text-gray-500"
                        }`}
                      >
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            event.status === "active"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : event.status === "upcoming"
                                ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                : event.status === "completed"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : event.status === "closed"
                                    ? "bg-gray-100 text-gray-600 border border-gray-200"
                                    : "bg-gray-50 text-gray-500 border border-gray-100"
                          }`}
                        >
                          {event.status === "closed" ? "Closed" : event.status}
                        </span>
                        <h3 className="font-bold text-gray-900 group-hover:text-green-950 transition-colors mt-1">
                          {getEventName(event)}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteEvent(event)}
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
                          <span>Event Schedule</span>
                        </div>
                        <span className="text-gray-900 font-bold">
                          {getEventDisplayDate(event)}{" "}
                          {event.startTime && event.endTime
                            ? `${event.startTime} - ${event.endTime}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-500 font-bold">
                          <Users className="w-4 h-4" />
                          <span>Attendees Recorded</span>
                        </div>
                        <span className="text-gray-900 font-bold">
                          {getEventAttendanceCount(event, attendanceLogs)}
                        </span>
                      </div>

                      <div className="pt-4 grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleOpenEditEvent(event)}
                          className="h-10 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                        >
                          <Edit3 className="w-3 h-3 mr-2 inline text-gray-500" />{" "}
                          Edit
                        </button>
                        <button
                          onClick={() => toggleEventStatus(event)}
                          className="h-10 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
                        >
                          <Settings className="w-3 h-3 mr-2 inline text-gray-400" />{" "}
                          Status
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Table View */}
      {viewType === "table" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                    Event Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                    Date & Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
                    Attendees
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <tr
                      key={getEventKey(event)}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {getEventName(event)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {getEventDisplayDate(event)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {event.startTime || "N/A"}
                            {event.endTime ? ` - ${event.endTime}` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900">
                            {event.location || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block ${
                            event.status === "active"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : event.status === "upcoming"
                                ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                : event.status === "completed"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : event.status === "closed"
                                    ? "bg-gray-100 text-gray-600 border border-gray-200"
                                    : "bg-gray-50 text-gray-500 border border-gray-100"
                          }`}
                        >
                          {event.status === "closed" ? "Closed" : event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900">
                            {getEventAttendanceCount(event, attendanceLogs)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Report button removed */}
                          <button
                            onClick={() => handleOpenEditEvent(event)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                            title="Edit Event"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleEventStatus(event)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-all"
                            title="Change Status"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteEvent(event)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 hover:border-red-200 transition-all"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Calendar className="w-12 h-12 text-gray-300" />
                        <p className="text-gray-500 font-bold">
                          No events found. Create your first event to get
                          started.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      <AnimatePresence>
        {isAddEventOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddEventOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <Motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border"
              style={{ borderColor: "#2D7A3E" }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight uppercase">
                      New Assembly Event
                    </h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">
                      Schedule dynamic session
                    </p>
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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Official Event Name
                    </label>
                    <input
                      autoFocus
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g. 25th Annual General Meeting"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Event Location
                    </label>
                    <input
                      value={newEventLocation}
                      onChange={(e) => setNewEventLocation(e.target.value)}
                      placeholder="e.g. Main Hall"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={newEventStartTime}
                        onChange={(e) => setNewEventStartTime(e.target.value)}
                        className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      />
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                        className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Initial Status
                    </label>
                    <select
                      value={newEventStatus}
                      onChange={(e) => setNewEventStatus(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active (Started)</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed (Ended)</option>
                    </select>
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
                      style={{ backgroundColor: "#2D7A3E" }}
                    >
                      Establish Event
                    </button>
                  </div>
                </form>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Event Modal */}
      <AnimatePresence>
        {isEditEventOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditEventOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <Motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border"
              style={{ borderColor: "#2D7A3E" }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight uppercase">
                      Edit Assembly Event
                    </h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">
                      Update event details and status
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditEventOpen(false)}
                    className="rounded-full hover:bg-gray-100 p-2"
                  >
                    <XCircle className="w-6 h-6 text-gray-300" />
                  </button>
                </div>

                <form onSubmit={handleUpdateEvent} className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Official Event Name
                    </label>
                    <input
                      autoFocus
                      value={editEventName}
                      onChange={(e) => setEditEventName(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={editEventDate}
                      onChange={(e) => setEditEventDate(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Event Location
                    </label>
                    <input
                      value={editEventLocation}
                      onChange={(e) => setEditEventLocation(e.target.value)}
                      placeholder="e.g. Main Hall"
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={editEventStartTime}
                        onChange={(e) => setEditEventStartTime(e.target.value)}
                        className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      />
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={editEventEndTime}
                        onChange={(e) => setEditEventEndTime(e.target.value)}
                        className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                      Event Status
                    </label>
                    <select
                      value={editEventStatus}
                      onChange={(e) => setEditEventStatus(e.target.value)}
                      className="h-14 w-full rounded-xl border-gray-200 font-bold focus:ring-green-500 bg-gray-50 px-4"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active (Started)</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed (Ended)</option>
                    </select>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditEventOpen(false);
                        setEditEvent(null);
                      }}
                      className="flex-1 h-14 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!editEventName}
                      className="flex-1 h-14 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "#2D7A3E" }}
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventManagement;
