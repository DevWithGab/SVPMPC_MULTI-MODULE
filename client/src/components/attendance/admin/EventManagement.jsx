import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MapPin,
  Search,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import { Toast } from "../../ui/toast";
import { eventAPI } from "../../../services/api";
import { formatDate, formatTimeRange } from "../../../utils/date";
import useScheduledSecretaryEvents from "../../../hooks/useScheduledSecretaryEvents";
import "../secretary/Dashboard.css";
import "./EventManagement.css";

const getEventKey = (event) => event?.eventId || event?._id || event?.id;
const getEventName = (event) =>
  event?.eventName || event?.name || "Untitled Event";
const eventDisplayName = (event) => getEventName(event) || "this event";

const statusLabels = {
  draft: "Pending Approval",
  pending_approval: "Pending Approval",
  upcoming: "Upcoming",
  active: "Active",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const getStatusColor = (status) => {
  switch (status) {
    case "active":
      return "text-coop-green bg-green-50 border-green-200";
    case "upcoming":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "pending_approval":
    case "draft":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "rejected":
      return "text-red-600 bg-red-50 border-red-200";
    case "cancelled":
      return "text-slate-500 bg-slate-50 border-slate-200";
    case "closed":
      return "text-slate-500 bg-slate-50 border-slate-200";
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
    case "draft":
      return <Loader2 className="w-4 h-4" />;
    case "rejected":
    case "cancelled":
    case "closed":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Calendar className="w-4 h-4" />;
  }
};

const getStatusLabel = (status) => statusLabels[status] || status;

const EventManagement = ({ events = [], setEvents }) => {
  const [viewedEvent, setViewedEvent] = useState(null);
  const [eventGroup, setEventGroup] = useState('pending');
  const [search, setSearch] = useState('');
  const [eventToReject, setEventToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [eventToReopen, setEventToReopen] = useState(null);
  const [reopenForm, setReopenForm] = useState({
    eventDate: "",
    startTime: "",
    endTime: "",
    reason: "",
  });
  const [reopening, setReopening] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const approvedDetailsLocked = ["upcoming", "active", "closed"].includes(editingEvent?.status);

  /* Ang server lang ang nagpapalit ng stored status ng approved event mula
  upcoming/active papunta sa closed, at ginagawa niya ito sa background sweep
  (every 60s) - kaya kung direkta lang basahin ang event.status mula sa fetched
  list, pwedeng magpakita ng "Active" kahit isa o dalawang minuto na pasado ang
  actual end time nito. Dito, kinukwenta ulit ang upcoming/active/closed base sa
  sariling schedule ng event gamit ang once-a-second clock - parehong correction
  na ginagamit na ng Secretary's Event Management at Dashboard - kaya tama lang
  ang oras ng pagsara ng badges dito, kahit gaano pa katagal ang stale ng
  persisted status. */
  const correctedEvents = useScheduledSecretaryEvents(events);

  const pendingEvents = useMemo(
    () =>
      correctedEvents.filter((event) =>
        ["draft", "pending_approval"].includes(event.status),
      ),
    [correctedEvents],
  );
  const approvedEvents = useMemo(
    () =>
      correctedEvents.filter((event) =>
        ["upcoming", "active"].includes(event.status),
      ),
    [correctedEvents],
  );
  const closedEvents = useMemo(
    () => correctedEvents.filter((event) => event.status === "closed"),
    [correctedEvents],
  );

  const updateEventInList = (updatedEvent) =>
    setEvents(
      events.map((event) =>
        getEventKey(event) === getEventKey(updatedEvent) ? updatedEvent : event,
      ),
    );
  const eventDate = (event) => formatDate(event.eventDate || event.date);

  const approveEvent = async (event) => {
    try {
      const response = await eventAPI.approveEvent(getEventKey(event));
      updateEventInList(response.event);
      setNotice({
        type: "success",
        message:
          "Event approved. It will activate automatically at its PHT start time.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to approve event.",
      });
    }
  };

  const rejectEvent = async () => {
    if (!eventToReject || !rejectionReason.trim()) return;
    try {
      const response = await eventAPI.rejectEvent(
        getEventKey(eventToReject),
        rejectionReason.trim(),
      );
      updateEventInList(response.event);
      setNotice({
        type: "success",
        message:
          "Event Rejected - Revision required. The Secretary has been notified.",
      });
      setEventToReject(null);
      setRejectionReason("");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to reject event.",
      });
    }
  };

  /* Pasado na yung old date/time ng closed event, kaya kapag ire-reopen ito
  kailangan ng bagong schedule - kung hindi, isasara ulit agad ito ng 60s
  auto-status timer. Required din na ilagay ng Admin kung bakit ito ire-reopen. */
  const openReopenModal = (event) => {
    const todayPht = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(new Date());
    setEventToReopen(event);
    setReopenForm({
      eventDate: todayPht,
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      reason: "",
    });
  };

  const submitReopenEvent = async () => {
    if (!eventToReopen || reopening) return;
    if (
      !reopenForm.eventDate ||
      !reopenForm.startTime ||
      !reopenForm.endTime ||
      !reopenForm.reason.trim()
    ) {
      return;
    }
    setReopening(true);
    try {
      const response = await eventAPI.reopenEvent(getEventKey(eventToReopen), {
        eventDate: reopenForm.eventDate,
        startTime: reopenForm.startTime,
        endTime: reopenForm.endTime,
        reason: reopenForm.reason.trim(),
      });
      updateEventInList(response.event);
      setNotice({
        type: "success",
        message: "Event reopened with its new schedule.",
      });
      setEventToReopen(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to reopen event.",
      });
    } finally {
      setReopening(false);
    }
  };

  const normalizeTimeValue = (time) => {
    if (!time) return "";
    const trimmed = time.toString().trim();

    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [hours, minutes] = trimmed.split(":");
      return `${hours.padStart(2, "0")}:${minutes}`;
    }

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

    const matchSeconds = /^([0-1]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(
      trimmed,
    );
    if (matchSeconds) {
      const [, hour, minute] = matchSeconds;
      return `${hour.padStart(2, "0")}:${minute}`;
    }

    return "";
  };

  /* Puwede ng Admin i-edit ang kahit anong approved o closed event - kasama
  na yung closed (time-exceeded) na dati hindi talaga magalaw. Pero yung
  date/time ay off-limits dito para sa closed event: ang status-refresh timer
  ay bumabantay lang sa upcoming/active events, kaya kung ie-edit ang schedule
  ng closed event dito sa form, hindi naman ito babalik sa labas ng 'closed' -
  dahil dito, yung dedicated Reopen flow ang gamitin para dun. */
  const openEditModal = (event) => {
    const parsedDate = new Date(event.eventDate || event.date);
    setEditingEvent(event);
    setEditForm({
      name: getEventName(event),
      description: event.description || "",
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
      }).format(parsedDate),
      startTime: normalizeTimeValue(event.startTime || event.eventTime || ""),
      endTime: normalizeTimeValue(event.endTime || ""),
      location: event.location || "",
    });
  };

  const submitEditEvent = async () => {
    if (!editingEvent || savingEdit || editingEvent.status === "closed") return;
    if (!editForm.name.trim() || !editForm.location.trim()) return;

    setSavingEdit(true);
    try {
      const isClosed = editingEvent.status === "closed";
      const payload = {};
      if (!approvedDetailsLocked) {
        payload.eventName = editForm.name.trim();
        payload.description = editForm.description;
        payload.location = editForm.location.trim();
      }

      if (!isClosed) {
        const startTime = normalizeTimeValue(editForm.startTime);
        const endTime = normalizeTimeValue(editForm.endTime);
        payload.eventDate = editForm.date;
        payload.eventTime = startTime;
        payload.startTime = startTime;
        payload.endTime = endTime;
      }

      const response = await eventAPI.updateEventAsAdmin(
        getEventKey(editingEvent),
        payload,
      );
      updateEventInList(response.event);
      setNotice({ type: "success", message: "Event updated successfully." });
      setEditingEvent(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to update event.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete || deleting) return;
    setDeleting(true);
    try {
      await eventAPI.deleteEvent(getEventKey(eventToDelete));
      setEvents(
        events.filter(
          (event) => getEventKey(event) !== getEventKey(eventToDelete),
        ),
      );
      setNotice({
        type: "success",
        message: `"${getEventName(eventToDelete)}" was deleted.`,
      });
      setEventToDelete(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Unable to delete event.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const groups = [
    { key: 'pending', label: 'Pending', title: 'Pending approvals', ariaLabel: 'Pending event approvals', records: pendingEvents, description: 'Review each submission before approving its attendance schedule.' },
    { key: 'approved', label: 'Approved', title: 'Approved events', ariaLabel: 'Approved events', records: approvedEvents, description: 'Manage schedules for upcoming and active events.' },
    { key: 'closed', label: 'Closed', title: 'Closed events', ariaLabel: 'Closed events', records: closedEvents, description: 'Review past events or reopen a session with a new schedule.' },
  ];
  const query = search.trim().toLowerCase();
  const matchesSearch = event => !query || [getEventName(event), event.location, getEventKey(event)]
    .some(value => String(value || '').toLowerCase().includes(query));
  const currentGroup = groups.find(group => group.key === eventGroup);
  const visibleCount = currentGroup.records.filter(matchesSearch).length;

  return (
    <div className="secretary-dashboard attendance-admin-events">
      <header className="aae-header">
        <div>
          <h1>Event approvals</h1>
          <p>Review submissions and manage attendance schedules.</p>
        </div>
        <span className="aae-timezone">Philippine Standard Time (PHT)</span>
      </header>

      {notice && <Toast message={notice.message} type={notice.type} onClose={() => setNotice(null)} />}

      <div className="aae-register">
        <nav className="aae-groups" aria-label="Event groups">
          {groups.map(group => <button
            type="button"
            key={group.key}
            aria-pressed={eventGroup === group.key}
            aria-controls={`aae-${group.key}-panel`}
            onClick={() => setEventGroup(group.key)}
          >{group.label}<span>{group.records.length.toLocaleString()}</span></button>)}
        </nav>

        <div className="aae-toolbar">
          <div><h2>{currentGroup.title}</h2><p>{currentGroup.description}</p></div>
          <label className="aae-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search events</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search event or location" />
          </label>
        </div>

        {groups.map(group => {
          const records = group.records.filter(matchesSearch);
          return <section key={group.key} id={`aae-${group.key}-panel`} hidden={eventGroup !== group.key} aria-label={group.title}>
            <div className="aae-table-scroll" role="region" aria-label={`${group.title} table`} tabIndex={0}>
              <table className="aae-table" aria-label={group.ariaLabel}>
                <thead><tr><th scope="col">Event</th><th scope="col">Schedule</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {records.map(event => <tr key={getEventKey(event)}>
                    <td><strong>{getEventName(event)}</strong><span className="aae-secondary">{group.key === 'pending' ? 'Submitted by Secretary' : getEventKey(event)}</span></td>
                    <td><span>{eventDate(event)}</span><span className="aae-secondary">{formatTimeRange(event.startTime, event.endTime)}</span></td>
                    <td>{event.location || 'Not specified'}</td>
                    <td><span className={`aae-event-status aae-status-${event.status}`}>{getStatusLabel(event.status)}</span></td>
                    <td><div className="aae-row-actions">
                      <button type="button" onClick={() => setViewedEvent(event)} aria-label={`View details for ${eventDisplayName(event)}`}>View</button>
                      {group.key === 'pending' ? <>
                        <button type="button" className="aae-reject" onClick={() => setEventToReject(event)} aria-label={`Reject ${eventDisplayName(event)}`}>Reject</button>
                        <button type="button" className="aae-approve" onClick={() => approveEvent(event)} aria-label={`Approve ${eventDisplayName(event)}`}>Approve</button>
                      </> : <>
                        {group.key !== 'closed' && <button type="button" onClick={() => openEditModal(event)} aria-label={`Edit ${eventDisplayName(event)}`}>Edit schedule</button>}
                        {group.key === 'closed' && <>
                          <button type="button" onClick={() => openReopenModal(event)} aria-label={`Reopen ${eventDisplayName(event)}`}>Reopen</button>
                          <button type="button" className="aae-reject" onClick={() => setEventToDelete(event)} aria-label={`Delete ${eventDisplayName(event)}`}>Delete</button>
                        </>}
                      </>}
                    </div></td>
                  </tr>)}
                  {records.length === 0 && <tr><td colSpan={5}><div className="aae-empty">
                    <strong>{query ? 'No matching events' : group.key === 'pending' ? 'No events awaiting approval' : group.key === 'approved' ? 'No approved events' : 'No closed events'}</strong>
                    <p>{query ? 'Try another event name or location.' : group.key === 'pending' ? 'New submissions from the Secretary will appear here.' : group.description}</p>
                    {query && <button type="button" onClick={() => setSearch('')}>Clear search</button>}
                  </div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>;
        })}
        <footer className="aae-register-footer"><span>{visibleCount.toLocaleString()} {visibleCount === 1 ? 'event' : 'events'}{query ? ' matching your search' : ` in ${currentGroup.label.toLowerCase()}`}</span><span>Event status follows the scheduled start and end times.</span></footer>
      </div>
      {/* View Event Details Modal */}
      <Modal
        isOpen={Boolean(viewedEvent)}
        onClose={() => setViewedEvent(null)}
        title="Event Details"
        className="aae-event-modal max-w-lg"
      >
        {viewedEvent && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">
                {getEventName(viewedEvent)}
              </h3>
              <div
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${getStatusColor(viewedEvent.status)}`}
              >
                {getStatusIcon(viewedEvent.status)}
                <span>{getStatusLabel(viewedEvent.status)}</span>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Date
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {eventDate(viewedEvent)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                  Time (PHT)
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {formatTimeRange(
                    viewedEvent.startTime,
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

            <div className="aae-modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewedEvent(null)}
                className="border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                Close
              </Button>
              {['draft', 'pending_approval'].includes(viewedEvent.status) && <>
                <Button type="button" variant="outline" onClick={() => { setEventToReject(viewedEvent); setViewedEvent(null); }} className="border-red-200 text-red-700">Reject event</Button>
                <Button type="button" onClick={() => { approveEvent(viewedEvent); setViewedEvent(null); }} className="bg-coop-green text-white">Approve event</Button>
              </>}
              {['upcoming', 'active'].includes(viewedEvent.status) && <Button type="button" onClick={() => { openEditModal(viewedEvent); setViewedEvent(null); }} className="bg-coop-green text-white">Edit schedule</Button>}
              {viewedEvent.status === 'closed' && <Button type="button" onClick={() => { openReopenModal(viewedEvent); setViewedEvent(null); }} className="bg-coop-green text-white">Reopen event</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Event Modal */}
      <Modal
        isOpen={Boolean(eventToReject)}
        onClose={() => setEventToReject(null)}
        title="Reject Event"
        className="aae-event-modal max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            The Secretary will receive "Event Rejected - Revision required".
          </p>
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={4}
            required
            placeholder="Reason for rejection"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
          <div className="aae-modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEventToReject(null)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={rejectEvent}
              disabled={!rejectionReason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              Reject Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        isOpen={Boolean(editingEvent)}
        onClose={() => !savingEdit && setEditingEvent(null)}
        title={editingEvent?.status === "closed" ? "Event Details" : "Edit schedule"}
        className="aae-event-modal max-w-lg"
      >
        {editingEvent && (
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-edit-event-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Event Name
              </label>
              <Input
                id="admin-edit-event-name"
                type="text"
                value={editForm.name}
                readOnly={approvedDetailsLocked}
                aria-describedby={approvedDetailsLocked ? "approved-event-details-help" : undefined}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                required
                className={`border-slate-200 rounded-lg${approvedDetailsLocked ? " bg-slate-50 text-slate-500" : ""}`}
              />
            </div>
            <div>
              <label htmlFor="admin-edit-event-description" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                id="admin-edit-event-description"
                value={editForm.description}
                readOnly={approvedDetailsLocked}
                aria-describedby={approvedDetailsLocked ? "approved-event-details-help" : undefined}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                rows={3}
                className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green${approvedDetailsLocked ? " bg-slate-50 text-slate-500" : ""}`}
              />
            </div>

            {approvedDetailsLocked && <p id="approved-event-details-help" className="text-xs text-slate-500">The event name, description, and location are locked after approval.</p>}

            {editingEvent.status === "closed" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                This event's time has already passed, so its date and time
                aren't editable here. Use <strong>Reopen</strong> instead to
                give it a new schedule.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, date: e.target.value })
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
                    value={editForm.startTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, startTime: e.target.value })
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
                    value={editForm.endTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, endTime: e.target.value })
                    }
                    required
                    className="border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="admin-edit-event-location" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Location
              </label>
              <Input
                type="text"
                id="admin-edit-event-location"
                readOnly={approvedDetailsLocked}
                aria-describedby={approvedDetailsLocked ? "approved-event-details-help" : undefined}
                value={editForm.location}
                onChange={(e) =>
                  setEditForm({ ...editForm, location: e.target.value })
                }
                required
                className={`border-slate-200 rounded-lg${approvedDetailsLocked ? " bg-slate-50 text-slate-500" : ""}`}
              />
            </div>

            <div className="aae-modal-actions">
              <Button
                type="button"
                variant="outline"
                disabled={savingEdit}
                onClick={() => setEditingEvent(null)}
                className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                {editingEvent.status === "closed" ? "Close" : "Cancel"}
              </Button>
              {editingEvent.status !== "closed" && (
              <Button
                type="button"
                onClick={submitEditEvent}
                disabled={
                  savingEdit ||
                  !editForm.name.trim() ||
                  !editForm.location.trim()
                }
                className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2 inline" />
                    Save schedule
                  </>
                )}
              </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Event Modal */}
      <Modal
        isOpen={Boolean(eventToDelete)}
        onClose={() => !deleting && setEventToDelete(null)}
        title="Delete Event"
        className="aae-event-modal max-w-md"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              This permanently deletes{" "}
              <span className="font-semibold">
                {eventDisplayName(eventToDelete)}
              </span>{" "}
              and its record. This cannot be undone.
            </p>
          </div>
          <div className="aae-modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setEventToDelete(null)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDeleteEvent}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2 inline" />
                  Delete Event
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reopen Event Modal */}
      <Modal
        isOpen={Boolean(eventToReopen)}
        onClose={() => !reopening && setEventToReopen(null)}
        title="Reopen Event"
        className="aae-event-modal max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">
              {eventDisplayName(eventToReopen)}
            </span>{" "}
            already closed on its original schedule. Set a new date and time so
            it reactivates correctly, and note why it's being reopened.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                New Date
              </label>
              <Input
                type="date"
                value={reopenForm.eventDate}
                onChange={(e) =>
                  setReopenForm({ ...reopenForm, eventDate: e.target.value })
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
                value={reopenForm.startTime}
                onChange={(e) =>
                  setReopenForm({ ...reopenForm, startTime: e.target.value })
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
                value={reopenForm.endTime}
                onChange={(e) =>
                  setReopenForm({ ...reopenForm, endTime: e.target.value })
                }
                required
                className="border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Reason for Reopening
            </label>
            <textarea
              value={reopenForm.reason}
              onChange={(e) =>
                setReopenForm({ ...reopenForm, reason: e.target.value })
              }
              rows={3}
              required
              placeholder="e.g., Secretary requested a make-up session for absentees"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>
          <div className="aae-modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={reopening}
              onClick={() => setEventToReopen(null)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitReopenEvent}
              disabled={
                reopening ||
                !reopenForm.eventDate ||
                !reopenForm.startTime ||
                !reopenForm.endTime ||
                !reopenForm.reason.trim()
              }
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {reopening ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Reopening...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 inline" />
                  Reopen Event
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EventManagement;
