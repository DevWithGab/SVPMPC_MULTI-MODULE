import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Plus,
  Edit3,
  Eye,
  MapPin,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Users,
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
import { formatDate, formatTimeRange } from "../../../utils/date";
import { eventStatusLabels, validateEventForm, loadSecretaryEvents } from '../../../utils/eventManagement';
import AttendanceMetricGrid from '../shared/AttendanceMetricGrid';
import './EventManagement.css';

export default function EventManagement({ user, events, onRefreshEvents }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewedEvent, setViewedEvent] = useState(null);
  const [eventPendingDelete, setEventPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const requestVersion = useRef({ version: 0 });
  const [toast, setToast] = useState(null);
  const [eventList, setEventList] = useState(events || []);
  const phtDateTime = (date, time) => `${date}T${time || "00:00"}:00+08:00`;
  // Every Secretary event is a General Assembly — there's no type picker
  // in the form, so this never varies.
  const EVENT_TYPE = "General Assembly";
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    status: "pending_approval",
  });

  useEffect(() => {
    setEventList(events || []);
  }, [events]);

  const fetchEvents = async () => {
    const version = ++requestVersion.current.version;
    setLoadingEvents(true);
    setLoadError('');
    try {
      const loaded = await loadSecretaryEvents(eventAPI.getEvents);
      if (version === requestVersion.current.version) setEventList(loaded);
    } catch (error) {
      if (version === requestVersion.current.version) setLoadError(error.message || 'Unable to load events. Please retry.');
    } finally {
      if (version === requestVersion.current.version) setLoadingEvents(false);
    }
  };

  useEffect(() => {
    const requests = requestVersion.current;
    fetchEvents();
    return () => { requests.version++; };
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
      eventName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      eventLocation.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus =
      filterStatus === "all" || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortOrder === 'name') return (a.eventName || a.name || '').localeCompare(b.eventName || b.name || '');
    const difference = (new Date(a.eventDate || a.date).getTime() || 0) - (new Date(b.eventDate || b.date).getTime() || 0);
    return sortOrder === 'oldest' ? difference : -difference;
  });
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / 10));
  const currentPage = Math.min(page, totalPages);
  const busy = loading || deleting || actionPending;
  const resetFilters = () => { setSearchTerm(''); setFilterStatus('all'); setSortOrder('newest'); setPage(1); };
  const openCreate = () => {
    setNewEvent({ name: '', description: '', date: '', startTime: '', endTime: '', location: '', status: 'pending_approval' });
    setFormError(''); setShowCreateModal(true);
  };
  const displayDate = event => {
    const value = event.eventDate || event.date;
    return value && Number.isFinite(new Date(value).getTime()) ? formatDate(value) : 'Date not recorded';
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (loading) return;
    const validation = validateEventForm(newEvent);
    setFormError(validation);
    if (validation) return;
    setLoading(true);

    try {
      const normalizedStartTime = normalizeTimeValue(newEvent.startTime);
      const normalizedEndTime = normalizeTimeValue(newEvent.endTime);

      // Combine date and startTime into a single datetime for eventDate
      const eventDateTime = new Date(
        phtDateTime(newEvent.date, normalizedStartTime),
      );

      const eventData = {
        eventName: newEvent.name.trim(),
        eventDate: eventDateTime.toISOString(),
        eventTime: normalizedStartTime,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        location: newEvent.location.trim(),
        description: newEvent.description,
        createdBy: user?.id || user?.memberId || "secretary",
        type: EVENT_TYPE,
      };

      const response = await eventAPI.createEvent(eventData);
      if (!response.success) throw new Error(response.message || "Unable to create event.");

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
        status: "upcoming",
      });

      await fetchEvents();
      if (onRefreshEvents) {
        await onRefreshEvents();
      }
    } catch (error) {
      setFormError(error.response?.data?.message || error.message || "Unable to create event.");
      setToast({
        message:
          error.response?.data?.message || error.message ||
          "Failed to create event. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditEvent = (event) => {
    setFormError('');
    setSelectedEvent(event);
    const eventDate = new Date(event.eventDate || event.date);
    setNewEvent({
      name: event.eventName || event.name || "",
      description: event.description || "",
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
      }).format(eventDate),
      startTime: normalizeTimeValue(
        event.startTime ||
          event.eventTime ||
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(eventDate),
      ),
      endTime: normalizeTimeValue(event.endTime || ""),
      location: event.location || "",
      status: event.status || "draft",
    });
    setShowEditModal(true);
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (loading) return;
    const validation = validateEventForm(newEvent);
    setFormError(validation);
    if (validation) return;
    setLoading(true);

    try {
      const normalizedStartTime = normalizeTimeValue(newEvent.startTime);
      const normalizedEndTime = normalizeTimeValue(newEvent.endTime);

      // Combine date and startTime into a single datetime
      const eventDateTime = new Date(
        phtDateTime(newEvent.date, normalizedStartTime),
      );

      const eventData = {
        eventName: newEvent.name.trim(),
        eventDate: eventDateTime.toISOString(),
        eventTime: normalizedStartTime,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        location: newEvent.location.trim(),
        description: newEvent.description,
        type: EVENT_TYPE,
      };

      const eventId =
        selectedEvent.eventId || selectedEvent._id || selectedEvent.id;
      const response = await eventAPI.updateEvent(eventId, eventData);
      if (!response.success) throw new Error(response.message || "Unable to update event.");

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
      setFormError(error.response?.data?.message || error.message || "Unable to update event.");
      setToast({
        message:
          error.response?.data?.message || error.message ||
          "Failed to update event. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmCancelEvent = async () => {
    if (!eventPendingDelete || deleting) return;
    const eventId = eventPendingDelete.eventId || eventPendingDelete._id || eventPendingDelete.id;

    setDeleting(true);
    try {
      const response = await eventAPI.cancelEvent(eventId);

      setToast({
        message: response.message || "Event cancelled successfully!",
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
          error.response?.data?.message || error.message ||
          "Failed to cancel event. Please try again.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const runEventAction = async (event, action, successMessage) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const response = await eventAPI[action](event.eventId || event._id || event.id);
      if (!response.success) throw new Error(response.message || 'Event action failed.');
      setToast({ message: successMessage, type: "success" });
      await fetchEvents();
      await onRefreshEvents?.();
    } catch (error) {
      setToast({
        message: error.response?.data?.message || error.message || "Event action failed.",
        type: "error",
      });
    } finally { setActionPending(false); }
  };

  // Human-readable labels for each lifecycle status. "Upcoming", "Active" and
  // "Close" are set automatically by the system based on PHT start/end time;
  // the Secretary never sets these directly.
  const getStatusLabel = status => eventStatusLabels[status] || status || "Not recorded";

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "text-coop-green bg-green-50 border-green-200";
      case "upcoming":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "pending_approval":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      case "cancelled":
        return "text-slate-500 bg-slate-50 border-slate-200";
      case "completed":
        return "text-slate-500 bg-slate-50 border-slate-200";
      case "closed":
        return "text-slate-600 bg-slate-50 border-slate-200";
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
      case "pending_approval":
        return <Loader2 className="w-4 h-4" />;
      case "rejected":
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      case "closed":
        return <XCircle className="w-4 h-4" />;
      case "completed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const eventDisplayName = (event) =>
    event?.eventName || event?.name || "this event";

  return (
    <div className="event-management space-y-6 pb-12">
      <header className="em-header">
        <div><p className="em-eyebrow">Attendance management / Events</p><h1>Event management</h1><p className="em-description">Plan General Assemblies and track each event from approval to completion.</p></div>
        <div className="em-header-actions"><button className="em-button" onClick={fetchEvents} disabled={loadingEvents || busy}><RefreshCw size={15} className={loadingEvents ? 'animate-spin' : ''} /> Refresh</button><button className="em-button em-primary" onClick={openCreate} disabled={busy}><Plus size={16} /> Create event</button></div>
      </header>
      {loadError && <div className="em-notice em-error" role="alert"><span>{loadError} The list may be out of date.</span><button className="em-button" onClick={fetchEvents} disabled={loadingEvents}>Retry</button></div>}
      <AttendanceMetricGrid label="Event overview" busy={loadingEvents} items={[
          ['All events', eventList.length, 'Across all lifecycle stages', Calendar],
          ['Pending approval', eventList.filter(event => event.status === 'pending_approval').length, 'Awaiting administrator review', Clock],
          ['Scheduled & active', eventList.filter(event => ['upcoming', 'active'].includes(event.status)).length, 'Approved events on the calendar', CheckCircle2],
          ['Needs revision', eventList.filter(event => event.status === 'rejected').length, 'Review feedback and resubmit', AlertTriangle],
        ].map(([label, value, note, Icon]) => [label, loadingEvents || loadError ? '—' : value.toLocaleString(), note, Icon])} />
      <section className="em-filters" aria-label="Event filters">
        <div className="em-filter-heading"><h2>Find an event</h2><button className="em-reset" onClick={resetFilters} disabled={!searchTerm && filterStatus === 'all' && sortOrder === 'newest'}>Reset filters</button></div>
        <div className="em-filter-grid">
          <label>Search events<div className="em-search"><Search size={16} /><input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} placeholder="Event name or location" /></div></label>
          <label>Status<select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option>{Object.entries(eventStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Sort by<select value={sortOrder} onChange={e => { setSortOrder(e.target.value); setPage(1); }}><option value="newest">Event date: newest first</option><option value="oldest">Event date: oldest first</option><option value="name">Event name: A–Z</option></select></label>
        </div>
      </section>

      {/* Events Table */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-coop-green" />
                Event register
              </CardTitle>
              <p className="text-slate-400 text-xs mt-1">
                Review schedules, approval status, and available actions.
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
        <div className="em-scope"><span>{filterStatus === 'all' ? 'All statuses' : getStatusLabel(filterStatus)} · {loadingEvents ? 'Loading events…' : filteredEvents.length + ' matching events'}</span><span>Schedules use Philippine time (PHT)</span></div>
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
                {!loadingEvents && filteredEvents.slice((currentPage - 1) * 10, currentPage * 10).map((event) => (
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
                          {displayDate(event)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTimeRange(
                            event.startTime || event.eventTime,
                            event.endTime,
                          )}{" "}
                          PHT
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
                        <span>{getStatusLabel(event.status)}</span>
                      </div>
                      {event.status === "rejected" && (
                        <div className="mt-2 max-w-xs text-xs text-red-700">
                          <p className="font-bold">
                            Event Rejected - Revision required
                          </p>
                          {event.rejectionReason && (
                            <p className="mt-1">
                              Reason: {event.rejectionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewedEvent(event)}
                          title="View event details"
                          aria-label={`View details for ${eventDisplayName(event)}`}
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                        >
                          <Eye className="w-4 h-4 mr-1.5" /> View
                        </Button>
                        {["draft", "pending_approval", "rejected"].includes(
                          event.status,
                        ) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEvent(event)}
                            title="Edit event"
                            disabled={busy || !!loadError}
                            aria-label={`Edit ${eventDisplayName(event)}`}
                            className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                          >
                            <Edit3 className="w-4 h-4 mr-1.5" /> Edit
                          </Button>
                        )}
                        {event.status === "rejected" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              runEventAction(
                                event,
                                "resubmitEvent",
                                "Event resubmitted for Admin approval.",
                              )
                            }
                            title="Resubmit event"
                            disabled={busy || !!loadError}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            Resubmit
                          </Button>
                        )}
                        {["draft", "pending_approval", "rejected"].includes(
                          event.status,
                        ) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEventPendingDelete(event)}
                            aria-label={`Cancel ${eventDisplayName(event)}`}
                            title="Cancel event"
                            className="border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg"
                            disabled={busy || !!loadError}
                          >
                            <XCircle className="w-4 h-4 mr-1.5" /> Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {loadingEvents && <TableRow><TableCell colSpan={5}><div className="em-empty" role="status"><Loader2 size={24} className="animate-spin" /><strong>Loading event register</strong><p>Gathering all events and their latest approval status.</p></div></TableCell></TableRow>}
                {!loadingEvents && filteredEvents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <Calendar className="w-10 h-10 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-600">
                            {loadError ? 'Event register unavailable' : eventList.length ? 'No matching events' : 'No events yet'}
                          </p>
                          <p className="text-sm">
                            {loadError ? 'Retry loading to see the latest events.' : eventList.length ? 'Try another search or status filter.' : 'Create a General Assembly event to begin the approval process.'}
                          </p>
                        </div>
                        <Button
                          onClick={eventList.length ? resetFilters : openCreate}
                          className="bg-coop-green hover:bg-coop-darkGreen text-white font-semibold px-5 py-2.5 rounded-lg"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {eventList.length ? 'Reset filters' : 'Create event'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <footer className="em-pagination"><span>{loadingEvents ? 'Loading…' : filteredEvents.length ? ((currentPage - 1) * 10 + 1) + '–' + Math.min(currentPage * 10, filteredEvents.length) + ' of ' + filteredEvents.length + ' events' : '0 events'}</span><nav aria-label="Event pages"><button className="em-button" disabled={loadingEvents || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage} / {totalPages}</span><button className="em-button" disabled={loadingEvents || currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button></nav></footer>
        </CardContent>
      </Card>
      <p className="em-footnote">New events require administrator approval. Approved events become active and close automatically according to their schedule.</p>

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => !loading && setShowCreateModal(false)}
        title="Create New Event"
        className="max-w-lg"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <p className="em-form-intro">Submit a General Assembly for administrator approval. All schedule times are in PHT.</p>
          {formError && <div role="alert" className="em-notice em-error">{formError}</div>}
          <fieldset disabled={loading} className="space-y-4"><legend className="sr-only">Event details</legend>
          <div>
            <label htmlFor="em-create-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Name
            </label>
            <Input
              type="text"
              id="em-create-name"
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
            <label htmlFor="em-create-description" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description (optional)
            </label>
            <textarea
              id="em-create-description"
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
              <label htmlFor="em-create-date" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date
              </label>
              <Input
                type="date"
                id="em-create-date"
              value={newEvent.date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, date: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="em-create-startTime" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Start Time
              </label>
              <Input
                type="time"
                id="em-create-startTime"
              value={newEvent.startTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, startTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="em-create-endTime" className="block text-sm font-semibold text-slate-700 mb-1.5">
                End Time
              </label>
              <Input
                type="time"
                id="em-create-endTime"
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
            <label htmlFor="em-create-location" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location
            </label>
            <Input
              type="text"
              id="em-create-location"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
              placeholder="e.g., Main Hall"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          </fieldset>
          <p className="em-footnote">All fields except description are required. End time must follow start time on the same day.</p>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
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
                  <Plus className="w-4 h-4 mr-2" /> Submit for approval
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => !loading && setShowEditModal(false)}
        title="Edit Event"
        className="max-w-lg"
      >
        <form onSubmit={handleUpdateEvent} className="space-y-4">
          <p className="em-form-intro">Update the event details. Rejected events can be resubmitted from the register after saving. All schedule times are in PHT.</p>
          {formError && <div role="alert" className="em-notice em-error">{formError}</div>}
          <fieldset disabled={loading} className="space-y-4"><legend className="sr-only">Event details</legend>
          <div>
            <label htmlFor="em-edit-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Event Name
            </label>
            <Input
              type="text"
              id="em-edit-name"
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
            <label htmlFor="em-edit-description" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description (optional)
            </label>
            <textarea
              id="em-edit-description"
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
              <label htmlFor="em-edit-date" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Date
              </label>
              <Input
                type="date"
                id="em-edit-date"
              value={newEvent.date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, date: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="em-edit-startTime" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Start Time
              </label>
              <Input
                type="time"
                id="em-edit-startTime"
              value={newEvent.startTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, startTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="em-edit-endTime" className="block text-sm font-semibold text-slate-700 mb-1.5">
                End Time
              </label>
              <Input
                type="time"
                id="em-edit-endTime"
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
            <label htmlFor="em-edit-location" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location
            </label>
            <Input
              type="text"
              id="em-edit-location"
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent({ ...newEvent, location: e.target.value })
              }
              placeholder="e.g., Main Hall"
              required
              className="border-slate-200 rounded-lg"
            />
          </div>
          </fieldset>
          <p className="em-footnote">All fields except description are required. End time must follow start time on the same day.</p>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
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

      {/* View Event Details Modal */}
      <Modal
        isOpen={Boolean(viewedEvent)}
        onClose={() => setViewedEvent(null)}
        title="Event Details"
        className="max-w-lg"
      >
        {viewedEvent && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {eventDisplayName(viewedEvent)}
                </h3>
                <p className="text-xs text-slate-400">
                  {viewedEvent.type || "General Assembly"}
                </p>
              </div>
              <div
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${getStatusColor(viewedEvent.status)}`}
              >
                {getStatusIcon(viewedEvent.status)}
                <span>{getStatusLabel(viewedEvent.status)}</span>
              </div>
            </div>

            {viewedEvent.status === "rejected" && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                <p className="font-bold">
                  Event Rejected - Revision required
                </p>
                {viewedEvent.rejectionReason && (
                  <p className="mt-1">Reason: {viewedEvent.rejectionReason}</p>
                )}
              </div>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Date
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {displayDate(viewedEvent)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Time (PHT)
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {formatTimeRange(
                    viewedEvent.startTime || viewedEvent.eventTime,
                    viewedEvent.endTime,
                  )}{" "}
                  PHT
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Location
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {viewedEvent.location}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Description
                </dt>
                <dd className="mt-1 text-slate-700">
                  {viewedEvent.description || "No description provided."}
                </dd>
              </div>
            </dl>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewedEvent(null)}
                className="border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={Boolean(eventPendingDelete)}
        onClose={() => !deleting && setEventPendingDelete(null)}
        title="Cancel Event"
        className="max-w-md"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              This will cancel{" "}
              <span className="font-semibold">
                {eventDisplayName(eventPendingDelete)}
              </span>
              . Only pending workflow events can be cancelled.
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
              Keep event
            </Button>
            <Button
              type="button"
              onClick={confirmCancelEvent}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" /> Cancel event
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
