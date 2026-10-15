import React, { useState } from "react";
import {
  Users,
  Calendar,
  Activity,
  FileText,
  Database,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { backupAPI } from "../../../services/api";
import AttendanceMetricGrid from "../shared/AttendanceMetricGrid";
import "../secretary/Dashboard.css";
import "./DatabaseBackup.css";

const normalizeAttendanceRecord = (record) => ({
  ...record,
  memberId: record.memberId || record.member_id,
  eventId: record.eventId || record.event_id,
  memberName:
    record.memberName ||
    record.member_name ||
    record.member?.memberName ||
    record.member?.member_name,
  eventName:
    record.eventName ||
    record.event ||
    record.event?.eventName ||
    record.event?.name,
  scanTime:
    record.scanTime || record.timestamp || record.createdAt || record.date,
});

const downloadBlob = (content, type, filename) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toCSV = (rows) =>
  rows
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

const todayStamp = () => new Date().toISOString().split("T")[0];

export default function DatabaseBackup({
  members = [],
  events = [],
  attendanceLogs = [],
  onRestored,
}) {
  const [restoreFile, setRestoreFile] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null); // parsed backup data awaiting confirm
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { summary } | { error }
  const [parseError, setParseError] = useState("");

  const downloadMembersCSV = () => {
    const csv = toCSV([
      ["Passbook No.", "Name", "Email", "Phone", "Status", "Join Date"],
      ...members.map((m) => [
        m.memberId || m.id,
        m.memberName || m.name,
        m.email || "",
        m.phoneNumber || m.contact || "",
        m.status || "active",
        m.joinDate || m.createdAt || "",
      ]),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `attendance_members_backup_${todayStamp()}.csv`,
    );
  };

  const downloadEventsCSV = () => {
    const csv = toCSV([
      ["ID", "Name", "Date", "Location", "Status", "Created At"],
      ...events.map((e) => [
        e.eventId || e.id,
        e.eventName || e.name,
        e.eventDate || e.date,
        e.location || "",
        e.status || "active",
        e.createdAt || "",
      ]),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `attendance_events_backup_${todayStamp()}.csv`,
    );
  };

  const downloadAttendanceCSV = () => {
    const csv = toCSV([
      [
        "Passbook Number",
        "Member Name",
        "Event ID",
        "Event Name",
        "Scan Time",
        "Status",
      ],
      ...attendanceLogs.map((log) => {
        const n = normalizeAttendanceRecord(log);
        return [
          n.memberId || "",
          n.memberName || "",
          n.eventId || "",
          n.eventName || "",
          n.scanTime || "",
          n.status || "present",
        ];
      }),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `attendance_logs_backup_${todayStamp()}.csv`,
    );
  };

  const downloadFullBackup = () => {
    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: "1.0",
      system: "Attendance Management System",
      members,
      events,
      attendanceLogs,
      metadata: {
        totalMembers: members.length,
        totalEvents: events.length,
        totalAttendance: attendanceLogs.length,
        exportedBy: "Admin",
      },
    };
    downloadBlob(
      JSON.stringify(data, null, 2),
      "application/json",
      `attendance_full_backup_${todayStamp()}.json`,
    );
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    setRestoreResult(null);
    setParseError("");
    setPendingRestore(null);
    if (!file) {
      setRestoreFile(null);
      return;
    }
    setRestoreFile(file);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const hasAny =
        Array.isArray(parsed?.members) ||
        Array.isArray(parsed?.events) ||
        Array.isArray(parsed?.attendanceLogs) ||
        Array.isArray(parsed?.attendance);
      if (!hasAny) {
        setParseError(
          'This file has no "members", "events", or "attendanceLogs" array — it doesn\'t look like an Attendance system backup.',
        );
        return;
      }
      setPendingRestore(parsed);
    } catch {
      setParseError(
        "Couldn't read this file as JSON. Select a backup .json file exported from this page.",
      );
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestore || restoring) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const response = await backupAPI.restore(pendingRestore);
      setRestoreResult({ summary: response.summary });
      setPendingRestore(null);
      setRestoreFile(null);
      await onRestored?.();
    } catch (error) {
      setRestoreResult({
        error: error.response?.data?.message || "Failed to restore backup.",
      });
    } finally {
      setRestoring(false);
    }
  };

  const cancelRestore = () => {
    setPendingRestore(null);
    setRestoreFile(null);
    setParseError("");
  };

  const summaryCounts = (key) => {
    const s = restoreResult?.summary?.[key];
    if (!s) return null;
    return `${s.created} created, ${s.updated} updated${s.errors.length ? `, ${s.errors.length} failed` : ""}`;
  };

  return (
    <div className="secretary-dashboard attendance-admin-backup">
      <header className="sd-header">
        <div>
          <p className="sd-eyebrow">Attendance management / Data recovery</p>
          <h1>Backup &amp; restore</h1>
          <p className="sd-description">Export your attendance data and restore records from a saved backup.</p>
        </div>
      </header>

      <AttendanceMetricGrid label="Available backup records" items={[
        ['Registered members', members.length.toLocaleString(), 'Member profiles available to export', Users],
        ['Events', events.length.toLocaleString(), 'Event records available to export', Calendar],
        ['Attendance records', attendanceLogs.length.toLocaleString(), 'Attendance logs available to export', Activity],
      ]} />

      <section className="sd-panel aab-full-backup" aria-labelledby="aab-full-title">
        <div className="aab-full-description">
          <span className="aab-icon"><Database size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="aab-full-title">Complete backup</h2>
            <p>Save members, events, and attendance records together in one JSON file.</p>
            <span className="sd-secondary">Keep this file in a secure location. Upload it below when you need to restore.</span>
          </div>
        </div>
        <button type="button" onClick={downloadFullBackup} className="sd-button sd-primary">
          <FileText size={15} aria-hidden="true" /> Download JSON backup
        </button>
      </section>

      <section className="sd-panel aab-exports" aria-labelledby="aab-exports-title">
        <div className="sd-panel-heading">
          <div>
            <h2 id="aab-exports-title">Individual exports</h2>
            <p>Download CSV files for review or reporting. Use a complete JSON backup to restore data.</p>
          </div>
        </div>
        <div className="aab-export-list">
          {[
            ['Members', 'Member profiles and contact details', members.length, Users, downloadMembersCSV],
            ['Events', 'Event schedules, locations, and statuses', events.length, Calendar, downloadEventsCSV],
            ['Attendance logs', 'Member attendance and scan records', attendanceLogs.length, Activity, downloadAttendanceCSV],
          ].map(([title, description, count, Icon, download]) => (
            <div className="aab-export-row" key={title}>
              <span className="aab-icon">{React.createElement(Icon, { size: 17, 'aria-hidden': true })}</span>
              <div className="aab-export-description"><h3>{title}</h3><p>{description}</p></div>
              <span className="aab-record-count">{count.toLocaleString()} records</span>
              <button type="button" className="sd-button" onClick={download} aria-label={`Download ${title.toLowerCase()} CSV`}>
                <FileText size={15} aria-hidden="true" /> Download CSV
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Restore */}
      <section className="sd-panel aab-restore" aria-labelledby="aab-restore-title" aria-busy={restoring}>
        <div className="sd-panel-heading">
          <div>
            <h2 id="aab-restore-title">Restore from backup</h2>
            <p>Select a complete JSON backup, review its contents, and confirm the restore.</p>
          </div>
        </div>
        <div className="aab-restore-body">

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Restoring updates any existing record that shares an ID with the
              backup, and adds records that don't exist yet. It never deletes
              data that isn't in the file, but overwritten fields cannot be
              undone — export a fresh backup first if you're unsure.
            </p>
          </div>

          <div className="aab-upload">
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="aab-file-input"
              id="restore-upload"
              disabled={restoring}
            />
            <label
              htmlFor="restore-upload"
              className="aab-file-label"
            >
              <Upload size={22} aria-hidden="true" />
              <strong>{restoreFile ? restoreFile.name : "Choose a JSON backup file"}</strong>
              <span>{restoring ? "Restoring records. Please wait." : "Select a .json file exported from Complete backup."}</span>
            </label>
          </div>

          {parseError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{parseError}</p>
            </div>
          )}

          {pendingRestore && (
            <div className="rounded-lg border border-slate-200 p-4 mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                This backup contains
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700 mb-4">
                {Array.isArray(pendingRestore.members) && (
                  <span>{pendingRestore.members.length} members</span>
                )}
                {Array.isArray(pendingRestore.events) && (
                  <span>{pendingRestore.events.length} events</span>
                )}
                {Array.isArray(
                  pendingRestore.attendanceLogs || pendingRestore.attendance,
                ) && (
                  <span>
                    {
                      (
                        pendingRestore.attendanceLogs ||
                        pendingRestore.attendance
                      ).length
                    }{" "}
                    attendance records
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelRestore}
                  disabled={restoring}
                  className="sd-button"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestore}
                  disabled={restoring}
                  className="sd-button sd-primary"
                >
                  {restoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {restoring ? "Restoring..." : "Confirm Restore"}
                </button>
              </div>
            </div>
          )}

          {restoreResult?.summary && (
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-coop-green shrink-0 mt-0.5" />
              <div className="text-xs text-green-800 space-y-1">
                <p className="font-bold">Restore complete.</p>
                {summaryCounts("members") && (
                  <p>Members: {summaryCounts("members")}</p>
                )}
                {summaryCounts("events") && (
                  <p>Events: {summaryCounts("events")}</p>
                )}
                {summaryCounts("attendance") && (
                  <p>Attendance: {summaryCounts("attendance")}</p>
                )}
              </div>
            </div>
          )}

          {restoreResult?.error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{restoreResult.error}</p>
            </div>
          )}
        </div>
      </section>

      <aside className="aab-guidance" aria-labelledby="aab-guidance-title">
        <h2 id="aab-guidance-title">Backup best practices</h2>
        <div>
          <p><strong>Keep backups current</strong><span>Download a backup weekly or after major data changes.</span></p>
          <p><strong>Store copies securely</strong><span>Keep multiple copies in separate, secure locations.</span></p>
          <p><strong>Check recovery</strong><span>Periodically test a backup in a test environment.</span></p>
        </div>
      </aside>
    </div>
  );
}
