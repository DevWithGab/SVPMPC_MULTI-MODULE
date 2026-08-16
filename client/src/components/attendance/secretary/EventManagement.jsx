import React, { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  Edit3,
  Trash2,
  MapPin,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Toast } from "../../ui/toast";
import { eventAPI } from "../../../services/attendance/secretary";
import { formatDate } from "../../../utils/date";

export default function EventManagement({ user, events, onRefreshEvents }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventPendingDelete, setEventPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [toast, setToast] = useState(null);
  const [eventList, setEventList] = useState(events || []);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    type: "General Assembly",
    status: "upcoming",
  });

  useEffect(() => {
    setEventList(events || []);
  }, [events]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const response = await eventAPI.getEvents();
      if (response.success) {
        const loadedEvents = Array.isArray(response.data?.events)
          ? response.data.events
          : Array.isArray(response.data)
            ? response.data
            : [];
        setEventList(loadedEvents);
      } else {
        console.error("Error fetching events:", response.message);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const normalizeTimeValue = (time) => {
    if (!time) return "";
    const trimmed = time.toString().trim();

    // Already in HH:mm format
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [hours, minutes] = trimmed.split(":");
      return `${hours.padStart(2, "0")}:${minutes}`;
    }

    // Convert 12-hour format to 24-hour time
    const match12Hour = /^([0-1]?\d|2[0-3]):([0-5]\d)\s*(AM|PM)$/i.exec(
      trimmed,
    );
    if (match12Hour) {
      let [, hour, minute, period] = match12Hour;
      hour = parseInt(hour, 10);
      if (/pm/i.test(period) && hour !== 12) hour += 12;
      if (/am/i.test(period) && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, "0")}:${minute}`;
    }

    // Convert HH:mm:ss format
    const matchSeconds = /^([0-1]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(
      trimmed,
    );
    if (matchSeconds) {
      const [, hour, minute] = matchSeconds;
      return `${hour.padStart(2, "0")}:${minute}`;
    }

    return "";
  };

  // Filter events based on search and status
  const filteredEvents = eventList.filter((event) => {
    const eventName = event.eventName || event.name || "";
    const eventLocation = event.location || "";
    const matchesSearch =
      eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eventLocation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedStartTime = normalizeTimeValue(newEvent.startTime);
      const normalizedEndTime = normalizeTimeValue(newEvent.endTime);

      // Combine date and startTime into a single datetime for eventDate
      const eventDateTime = new Date(`${newEvent.date}T${normalizedStartTime}`);

      const eventData = {
        eventName: newEvent.name,
        eventDate: eventDateTime.toISOString(),
        eventTime: normalizedStartTime,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        location: newEvent.location,
        description: newEvent.description,
        status: newEvent.status || "upcoming",
        createdBy: user?.id || user?.memberId || "secretary",
      };

      const response = await eventAPI.createEvent(eventData);

      setToast({
        message: response.message || "Event created successfully!",
        type: "success",
      });
      // Close modal and reset form
      setShowCreateModal(false);
      setNewEvent({
        name: "",
        description: "",
        date: "",
        startTime: "",
        endTime: "",
        location: "",
        type: "General Assembly",
        status: "upcoming",
      });

      await fetchEvents();
      if (onRefreshEvents) {
        await onRefreshEvents();
      }
    } catch (error) {
      console.error("Error creating event:", error);
      setToast({
        message:
          error.response?.data?.message ||
          "Failed to create event. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    const eventDate = new Date(event.eventDate || event.date);
    setNewEvent({
      name: event.eventName || event.name || "",
      description: event.description || "",
      date: eventDate.toISOString().split("T")[0],
      startTime: normalizeTimeValue(
        event.startTime ||
          event.eventTime ||
          eventDate.toTimeString().slice(0, 5),
      ),
      endTime: normalizeTimeValue(event.endTime || ""),
      location: event.location || "",
      type: event.type || "General Assembly",
      status: event.status || "upcoming",
    });
    setShowEditModal(true);
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedStartTime = normalizeTimeValue(newEvent.startTime);
      const normalizedEndTime = normalizeTimeValue(newEvent.endTime);

      // Combine date and startTime into a single datetime
      const eventDateTime = new Date(`${newEvent.date}T${normalizedStartTime}`);

      const eventData = {
        eventName: newEvent.name,
        eventDate: eventDateTime.toISOString(),
        eventTime: normalizedStartTime,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        location: newEvent.location,
        description: newEvent.description,
        status: newEvent.status || "upcoming",
      };

      const eventId =
        selectedEvent.eventId || selectedEvent._id || selectedEvent.id;
      const response = await eventAPI.updateEvent(eventId, eventData);

      setToast({
        message: response.message || "Event updated successfully!",
        type: "success",
      });

      setShowEditModal(false);
      setSelectedEvent(null);

      await fetchEvents();
      // Refresh events list if callback provided
      if (onRefreshEvents) {
        await onRefreshEvents();
      }
    } catch (error) {
      console.error("Error updating event:", error);
      setToast({
        message:
          error.response?.data?.message ||
          "Failed to update event. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventPendingDelete || deleting) return;
    const eventId = eventPendingDelete.eventId || eventPendingDelete.id;

    setDeleting(true);
    try {
      const response = await eventAPI.deleteEvent(eventId);

      setToast({
        message: response.message || "Event deleted successfully!",
        type: "success",
      });

      setEventPendingDelete(null);
      await fetchEvents();
      if (onRefreshEvents) {
        await onRefreshEvents();
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      setToast({
        message:
          error.response?.data?.message ||
          "Failed to delete event. Please try again.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-coop-green bg-green-50 border-green-200";
      case "upcoming":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "completed":
        return "text-slate-500 bg-slate-50 border-slate-200";
      case "closed":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-slate-500 bg-slate-50 border-slate-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4" />;
      case "upcoming":
        return <Clock className="w-4 h-4" />;
      case "closed":
        return <XCircle className="w-4 h-4" />;
      case "completed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const eventDisplayName = (event) => event?.eventName || event?.name || "this event";

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Event Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create and manage General Assembly events
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search events by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "active", "upcoming", "completed", "closed"].map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  aria-pressed={filterStatus === status}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize border transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/40 ${
                    filterStatus === status
                      ? "bg-coop-green border-coop-green text-white"
                      : "border-slate-200 text-slate-600 hover:border-coop-green hover:bg-green-50 hover:text-coop-green"
                  }`}
                >
                  {status}
                </button>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-coop-green" />
                Events ({filteredEvents.length})
              </CardTitle>
              <p className="text-slate-400 text-xs mt-1">
                All General Assembly and secretary-managed events
              </p>
            </div>
            {loadingEvents && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Refreshing...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event Details
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Location
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
                {filteredEvents.map((event) => (
                  <TableRow
                    key={event.eventId || event._id || event.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {event.eventName || event.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {event.type || "General Assembly"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatDate(event.eventDate || event.date)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {event.startTime || event.eventTime}
                          {event.endTime ? ` - ${event.endTime}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {event.location}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(event.status)}`}
                      >
                        {getStatusIcon(event.status)}
                        <span className="capitalize">{event.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                          aria-label={`Edit ${eventDisplayName(event)}`}
                          title="Edit event"
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEventPendingDelete(event)}
                          aria-label={`Delete ${eventDisplayName(event)}`}
                          title="Delete event"
                          className="border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg"
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEvents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <Calendar className="w-10 h-10 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-600">No events found</p>
                          <p className="text-sm">
                            Create your first event to get started
                          </p>
                        </div>
                        <Button
                          onClick={() => setShowCreateModal(true)}
                          className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Event
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Event"
        className="max-w-lg"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Name
            </label>
            <Input
              type="text"
              value={newEvent.name}
              onChange={(e) =>
                setNewEvent({ ...newEvent, name: e.target.value })
              }
              placeholder="e.g., Monthly General Assembly"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
              placeholder="Event description..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date
              </label>
              <Input
                type="date"
                value={newEvent.date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, date: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Start Time
              </label>
              <Input
                type="time"
                value={newEvent.startTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, startTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                End Time
              </label>
              <Input
                type="time"
                value={newEvent.endTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, endTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location
            </label>
            <Input
              type="text"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
              placeholder="e.g., Main Hall"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Type
            </label>
            <select
              value={newEvent.type}
              onChange={(e) =>
                setNewEvent({ ...newEvent, type: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            >
              <option value="General Assembly">General Assembly</option>
              <option value="Special Meeting">Special Meeting</option>
              <option value="Training Session">Training Session</option>
              <option value="Community Service">Community Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Status
            </label>
            <select
              value={newEvent.status}
              onChange={(e) =>
                setNewEvent({ ...newEvent, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" /> Create Event
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Event"
        className="max-w-lg"
      >
        <form onSubmit={handleUpdateEvent} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Name
            </label>
            <Input
              type="text"
              value={newEvent.name}
              onChange={(e) =>
                setNewEvent({ ...newEvent, name: e.target.value })
              }
              placeholder="e.g., Monthly General Assembly"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
              placeholder="Event description..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date
              </label>
              <Input
                type="date"
                value={newEvent.date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, date: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Start Time
              </label>
              <Input
                type="time"
                value={newEvent.startTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, startTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                End Time
              </label>
              <Input
                type="time"
                value={newEvent.endTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, endTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location
            </label>
            <Input
              type="text"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
              placeholder="e.g., Main Hall"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Type
            </label>
            <select
              value={newEvent.type}
              onChange={(e) =>
                setNewEvent({ ...newEvent, type: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            >
              <option value="General Assembly">General Assembly</option>
              <option value="Special Meeting">Special Meeting</option>
              <option value="Training Session">Training Session</option>
              <option value="Community Service">Community Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Status
            </label>
            <select
              value={newEvent.status}
              onChange={(e) =>
                setNewEvent({ ...newEvent, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" /> Update Event
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(eventPendingDelete)}
        onClose={() => !deleting && setEventPendingDelete(null)}
        title="Delete Event"
        className="max-w-md"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              This will permanently delete{" "}
              <span className="font-semibold">
                {eventDisplayName(eventPendingDelete)}
              </span>
              . This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setEventPendingDelete(null)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDeleteEvent}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete event
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
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
