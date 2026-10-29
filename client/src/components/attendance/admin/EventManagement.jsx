import EventDetails from '../shared/EventDetails';
import { SearchField } from '../../ui/workspace';
import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput, Textarea } from '../../ui/input';
import { PageHeader, Panel, PanelHeader, ModalActions, FormField } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Search,
  RotateCcw,
  Trash2,
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
  draft: "Scheduled",
  pending_approval: "Scheduled",
  upcoming: "Upcoming",
  active: "Active",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const getStatusLabel = (status) => statusLabels[status] || status;

const EventManagement = ({ events = [], setEvents, user }) => {
  const [selectedEvent, setViewedEvent] = useState(null);
  const [eventGroup, setEventGroup] = useState('upcoming');
  const [search, setSearch] = useState('');
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
  const [eventFormError, setEventFormError] = useState('');

  // Keep displayed status accurate between server refreshes.
  const correctedEvents = useScheduledSecretaryEvents(events);
  const viewedEvent = correctedEvents.find(event => getEventKey(event) === getEventKey(selectedEvent)) || selectedEvent;

  const upcomingEvents = useMemo(
    () =>
      correctedEvents.filter((event) =>
        event.status === "upcoming",
      ),
    [correctedEvents],
  );
  const activeEvents = useMemo(
    () => correctedEvents.filter(event => event.status === "active"),
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

  // A new schedule prevents reopened events from closing immediately.
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

  // Closed event schedules change only through Reopen.
  const openEditModal = (event) => {
    setEventFormError('');
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

  const submitEditEvent = async (event) => {
    event?.preventDefault();
    if (!editingEvent || savingEdit) return;
    if (!editForm.name.trim() || !editForm.location.trim()) return;

    setSavingEdit(true);
    setEventFormError('');
    try {
      const isClosed = editingEvent.status === "closed";
      const payload = {};
      payload.eventName = editForm.name.trim();
      payload.description = editForm.description;
      payload.location = editForm.location.trim();

      if (!isClosed) {
        const startTime = normalizeTimeValue(editForm.startTime);
        const endTime = normalizeTimeValue(editForm.endTime);
        payload.eventDate = editForm.date;
        payload.eventTime = startTime;
        payload.startTime = startTime;
        payload.endTime = endTime;
      }

      if (!isClosed && (!payload.eventDate || !payload.startTime || !payload.endTime || payload.endTime <= payload.startTime)) {
        setEventFormError('Choose a date and an end time after the start time.');
        return;
      }
      const response = editingEvent.isNew
        ? await eventAPI.createEvent({ ...payload, createdBy: user?.userId || user?.username || 'secretary' })
        : await eventAPI.updateEvent(getEventKey(editingEvent), payload);
      if (editingEvent.isNew) setEvents([...events, response.event]);
      else updateEventInList(response.event);
      setNotice({ type: "success", message: editingEvent.isNew ? "Event created. It will open automatically at its scheduled time." : "Event updated successfully." });
      setEditingEvent(null);
    } catch (error) {
      setEventFormError(error.response?.data?.message || "Unable to save the event. Please try again.");
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

  const openCreateModal = () => {
    setEventFormError('');
    setEditingEvent({ isNew: true });
    setEditForm({ name: '', description: '', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()), startTime: '', endTime: '', location: '' });
  };
  const groups = [
    { key: 'upcoming', label: 'Upcoming', title: 'Upcoming events', ariaLabel: 'Upcoming events', records: upcomingEvents, description: 'Events open automatically at their scheduled Philippine start time.' },
    { key: 'active', label: 'Active', title: 'Active events', ariaLabel: 'Active events', records: activeEvents, description: 'Attendance is open until the scheduled Philippine end time.' },
    { key: 'closed', label: 'Closed', title: 'Closed events', ariaLabel: 'Closed events', records: closedEvents, description: 'View past events or reopen with a reason and a new schedule.' },
  ];
  const query = search.trim().toLowerCase();
  const matchesSearch = event => !query || [getEventName(event), event.location, getEventKey(event)]
    .some(value => String(value || '').toLowerCase().includes(query));
  const currentGroup = groups.find(group => group.key === eventGroup);
  const visibleCount = currentGroup.records.filter(matchesSearch).length;

  return (
    <div className="secretary-dashboard attendance-admin-events">
      <PageHeader separateBreadcrumb className="sd-header">
        <div>
          <p className="sd-eyebrow attendance-breadcrumb"><span>Attendance management</span><span aria-hidden="true">/</span><strong>Events</strong></p>
          <h1>Event Management</h1>
          <p className="sd-description">Create, edit, and manage attendance schedules.</p>
        </div>
        <div><ActionButton tooltip="Create an event and set its attendance schedule." type="button" onClick={openCreateModal}>Create event</ActionButton></div>
      </PageHeader>

      {notice && <Toast message={notice.message} type={notice.type} onClose={() => setNotice(null)} />}

      <Panel as="section" className="sd-panel aae-filters" aria-labelledby="aae-filter-title">
        <div className="aae-filter-heading">
          <h2 id="aae-filter-title">Find an event</h2>
          <button type="button" className="sd-link" disabled={!search && eventGroup === 'upcoming'} onClick={() => { setSearch(''); setEventGroup('upcoming'); }}>Reset filters</button>
        </div>
        <div className="aae-filter-grid">
          <label className="aae-search-label">
            Search events
            <SearchField as="span" className="aae-search"><Search size={16} aria-hidden="true" /><TextInput unstyled type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Event name or location" /></SearchField>
          </label>
          <div className="aae-group-filter">
            <span>Event status</span>
            <nav className="aae-groups" aria-label="Event groups">
              {groups.map(group => <button
                type="button"
                key={group.key}
                aria-pressed={eventGroup === group.key}
                aria-controls={`aae-${group.key}-panel`}
                onClick={() => setEventGroup(group.key)}
              >{group.label}<span>{group.records.length.toLocaleString()}</span></button>)}
            </nav>
          </div>
        </div>
      </Panel>

      <Panel as="div" className="sd-panel aae-register">
        <PanelHeader as="div" className="sd-panel-heading aae-toolbar">
          <div><h2>{currentGroup.title}</h2><p>{currentGroup.description}</p></div>
          <span className="aae-result-count">{visibleCount.toLocaleString()} {visibleCount === 1 ? 'event' : 'events'}</span>
        </PanelHeader>
        {groups.map(group => {
          const records = group.records.filter(matchesSearch);
          return <section key={group.key} id={`aae-${group.key}-panel`} hidden={eventGroup !== group.key} aria-label={group.title}>
            <div className="aae-table-scroll" role="region" aria-label={`${group.title} table`} tabIndex={0}>
              <DataTable className="aae-table" aria-label={group.ariaLabel}>
                <thead><tr><th scope="col">Event</th><th scope="col">Schedule</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {records.map(event => <tr key={getEventKey(event)}>
                    <td><strong>{getEventName(event)}</strong><span className="aae-secondary">{getEventKey(event)}</span></td>
                    <td><span>{eventDate(event)}</span><span className="aae-secondary">{formatTimeRange(event.startTime, event.endTime)}</span></td>
                    <td>{event.location || 'Not specified'}</td>
                    <td><span className={`aae-event-status aae-status-${event.status}`}>{getStatusLabel(event.status)}</span></td>
                    <td><div className="aae-row-actions">
                      <ActionButton tooltip="Review the event details, schedule, and current status." variant="outline" type="button" className="sd-button" onClick={() => setViewedEvent(event)} aria-label={`View details for ${eventDisplayName(event)}`}>View</ActionButton>
                      <ActionButton tooltip="Update the event details and attendance schedule." variant="outline" type="button" className="sd-button" onClick={() => openEditModal(event)} aria-label={`Edit ${eventDisplayName(event)}`}>Edit</ActionButton>
                      {group.key === 'closed' && <ActionButton tooltip="Set a new attendance schedule for this closed event." variant="outline" type="button" className="sd-button" onClick={() => openReopenModal(event)} aria-label={`Reopen ${eventDisplayName(event)}`}>Reopen</ActionButton>}
                      <ActionButton tooltip="Review the confirmation before permanently deleting this event." variant="outline" type="button" className="sd-button aae-reject" onClick={() => setEventToDelete(event)} aria-label={`Delete ${eventDisplayName(event)}`}>Delete</ActionButton>
                    </div></td>
                  </tr>)}
                  {records.length === 0 && <tr><td colSpan={5}><div className="aae-empty">
                    <strong>{query ? 'No matching events' : `No ${group.label.toLowerCase()} events`}</strong>
                    <p>{query ? 'Try another event name or location.' : group.description}</p>
                    {query && <button type="button" onClick={() => setSearch('')}>Clear search</button>}
                  </div></td></tr>}
                </tbody>
              </DataTable>
            </div>
          </section>;
        })}
        <footer className="sd-panel-footer aae-register-footer"><span>{visibleCount.toLocaleString()} {visibleCount === 1 ? 'event' : 'events'}{query ? ' matching your search' : ` in ${currentGroup.label.toLowerCase()}`}</span><span>Event status follows the scheduled start and end times.</span></footer>
      </Panel>
      {/* View Event Details Modal */}
      <Modal
        isOpen={Boolean(viewedEvent)}
        onClose={() => setViewedEvent(null)}
        title={viewedEvent?.status === "closed" ? "Closed event details" : "Event details"}
        className="aae-event-modal aae-view-modal"
        footer={viewedEvent && (<ModalActions className="aae-view-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewedEvent(null)}
                className="sd-button"
              >
                Close
              </Button>
              {['upcoming', 'active'].includes(viewedEvent.status) && <Button tooltip="Update the event details and attendance schedule." type="button" onClick={() => { openEditModal(viewedEvent); setViewedEvent(null); }} className="sd-button sd-primary bg-coop-green text-white">Edit event</Button>}
              {viewedEvent.status === 'closed' && <Button tooltip="Set a new attendance schedule for this closed event." type="button" onClick={() => { openReopenModal(viewedEvent); setViewedEvent(null); }} className="sd-button sd-primary bg-coop-green text-white">Reopen event</Button>}
            </ModalActions>)}
      >
        {viewedEvent && (
          <div>
            <EventDetails event={viewedEvent} name={getEventName(viewedEvent)} formattedDate={eventDate(viewedEvent)} statusLabel={getStatusLabel(viewedEvent.status)} closedNote={<>This event is closed. Use <strong>Reopen event</strong> to set a new attendance schedule.</>} />

          </div>
        )}
      </Modal>

      {/* Create and edit event form */}
      <Modal
        isOpen={Boolean(editingEvent)}
        onClose={() => !savingEdit && setEditingEvent(null)}
        title={editingEvent?.isNew ? "Create event" : "Edit event"}
        description="Set the event details and its attendance schedule."
        className="aae-event-modal aae-event-form-modal"
        footer={editingEvent && <ModalActions className="aae-event-form-footer">
          <Button type="button" variant="outline" disabled={savingEdit} onClick={() => setEditingEvent(null)}>Cancel</Button>
          <Button type="submit" form="attendance-event-form" disabled={savingEdit || !editForm.name.trim() || !editForm.location.trim()} className="bg-coop-green text-white">
            {savingEdit && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {savingEdit ? 'Saving...' : editingEvent.isNew ? 'Create event' : 'Save event'}
          </Button>
        </ModalActions>}
      >
        {editingEvent && <form id="attendance-event-form" className="aae-event-form" onSubmit={submitEditEvent}>
          <p className="aae-required-note"><span aria-hidden="true">*</span> Required fields</p>
          <div className="aae-event-details-fields">
            <FormField id="admin-edit-event-name" label="Event name" required>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. General Assembly" autoComplete="off" />
            </FormField>
            <FormField id="admin-edit-event-location" label="Location" required>
              <Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g. Parish Hall, Poblacion" autoComplete="off" />
            </FormField>
            <FormField id="admin-edit-event-description" label={<>Description <span className="aae-optional">Optional</span></>}>
              <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} placeholder="Add a short description or instructions for attendees." />
            </FormField>
          </div>
          {editingEvent.status === 'closed' ? <p className="aae-schedule-note">This event is closed. Use Reopen to set a new schedule and record a reason.</p> : <section className="aae-schedule-fields" aria-labelledby="aae-schedule-title">
            <div className="aae-schedule-heading"><h3 id="aae-schedule-title">Attendance schedule</h3><span>Philippine time (PHT)</span></div>
            <div className="aae-schedule-grid">
              <FormField id="admin-edit-event-date" label="Date" required><Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} /></FormField>
              <FormField id="admin-edit-event-start" label="Start time" required><Input type="time" value={editForm.startTime} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })} /></FormField>
              <FormField id="admin-edit-event-end" label="End time" required><Input type="time" value={editForm.endTime} onChange={e => setEditForm({ ...editForm, endTime: e.target.value })} /></FormField>
            </div>
            <p className="aae-schedule-note">Attendance opens at the start time and closes at the end time automatically.</p>
          </section>}
          {eventFormError && <p role="alert" className="aae-form-error">{eventFormError}</p>}
        </form>}
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
          <ModalActions className="aae-modal-actions">
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
          </ModalActions>
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
            <FormField>
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
            </FormField>
            <FormField>
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
            </FormField>
            <FormField>
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
            </FormField>
          </div>
          <FormField>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Reason for Reopening
            </label>
            <Textarea
              value={reopenForm.reason}
              onChange={(e) =>
                setReopenForm({ ...reopenForm, reason: e.target.value })
              }
              rows={3}
              required
              placeholder="e.g., Secretary requested a make-up session for absentees"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </FormField>
          <ModalActions className="aae-modal-actions">
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
          </ModalActions>
        </div>
      </Modal>
    </div>
  );
};

export default EventManagement;
