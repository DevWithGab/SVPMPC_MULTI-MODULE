import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MapPin,
  RotateCcw,
  Trash2,
  XCircle,
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
import { eventAPI } from "../../../services/api";
import { formatDate, formatTimeRange } from "../../../utils/date";

const getEventKey = (event) => event?.eventId || event?._id || event?.id;
const getEventName = (event) =>
  event?.eventName || event?.name || "Untitled Event";
const eventDisplayName = (event) => getEventName(event) || "this event";

const statusLabels = {
  draft: "Pending Approval",
  pending_approval: "Pending Approval",
  upcoming: "Upcoming",
  active: "Active",
  closed: "Close",
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

  const pendingEvents = useMemo(
    () =>
      events.filter((event) =>
        ["draft", "pending_approval"].includes(event.status),
      ),
    [events],
  );
  const approvedEvents = useMemo(
    () =>
      events.filter((event) => ["upcoming", "active"].includes(event.status)),
    [events],
  );
  const closedEvents = useMemo(
    () => events.filter((event) => event.status === "closed"),
    [events],
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

  // A closed event's old date/time has already passed, so reopening it needs
  // a new schedule — otherwise the 60s auto-status timer would just close it
  // again right away. The Admin also has to say why it's being reopened.
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

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          EVENT APPROVALS
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review Secretary submissions and manage approved attendance events.
        </p>
      </div>

      {notice && (
        <Toast
          message={notice.message}
          type={notice.type}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Pending Approvals */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-coop-green" />
                Pending Event Approvals ({pendingEvents.length})
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Events submitted by the Secretary for Admin review.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date &amp; Time
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Location
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Created By
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingEvents.map((event) => (
                  <TableRow
                    key={getEventKey(event)}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {getEventName(event)}
                        </p>
                        <div
                          className={`mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusColor(event.status)}`}
                        >
                          {getStatusIcon(event.status)}
                          <span>{getStatusLabel(event.status)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {eventDate(event)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTimeRange(event.startTime, event.endTime)} PHT
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
                    <TableCell className="py-3 text-sm text-slate-600">
                      Secretary
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
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEventToReject(event)}
                          title="Reject event"
                          className="border-red-200 text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveEvent(event)}
                          className="bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingEvents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      No pending event approvals.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approved Events */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-coop-green" />
            Approved Events ({approvedEvents.length})
          </CardTitle>
          <p className="text-xs text-slate-400 mt-1">
            Approved by the Admin — status updates to Active/Close automatically at their PHT schedule.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date &amp; Time
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
              <TableBody>
                {approvedEvents.map((event) => (
                  <TableRow
                    key={getEventKey(event)}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-3 text-sm font-semibold text-slate-900">
                      {getEventName(event)}
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {eventDate(event)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTimeRange(event.startTime, event.endTime)} PHT
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
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusColor(event.status)}`}
                      >
                        {getStatusIcon(event.status)}
                        <span>{getStatusLabel(event.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewedEvent(event)}
                        title="View event details"
                        aria-label={`View details for ${eventDisplayName(event)}`}
                        className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {approvedEvents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-12 text-slate-400"
                    >
                      No approved events yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Closed Events */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-coop-green" />
            Closed Events ({closedEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Event
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Date &amp; Time
                  </TableHead>
                  <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedEvents.map((event) => (
                  <TableRow
                    key={getEventKey(event)}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-3 text-sm font-semibold text-slate-900">
                      {getEventName(event)}
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {eventDate(event)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTimeRange(event.startTime, event.endTime)} PHT
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReopenModal(event)}
                          title="Reopen event"
                          className="border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg"
                        >
                          <RotateCcw className="w-4 h-4 mr-1.5" />
                          Reopen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEventToDelete(event)}
                          aria-label={`Delete ${eventDisplayName(event)}`}
                          title="Delete event"
                          className="border-red-200 text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {closedEvents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-12 text-slate-400"
                    >
                      No closed events.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

      {/* Reject Event Modal */}
      <Modal
        isOpen={Boolean(eventToReject)}
        onClose={() => setEventToReject(null)}
        title="Reject Event"
        className="max-w-lg"
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
          <div className="flex gap-3">
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

      {/* Delete Event Modal */}
      <Modal
        isOpen={Boolean(eventToDelete)}
        onClose={() => !deleting && setEventToDelete(null)}
        title="Delete Event"
        className="max-w-md"
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
          <div className="flex gap-3">
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
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">
              {eventDisplayName(eventToReopen)}
            </span>{" "}
            already closed on its original schedule. Set a new date and time
            so it reactivates correctly, and note why it's being reopened.
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
          <div className="flex gap-3 pt-2">
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
