import React, { useState } from "react";
import BackupWorkspace from "../../shared/BackupWorkspace";
import { backupAPI } from "../../../services/api";
import { downloadJson, isModuleBackup } from "../../../utils/moduleBackup";

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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [lastExport, setLastExport] = useState(null);

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

  /* The complete backup is built by the server from every Attendance
  collection (members, events, attendance, reports, audit logs), so it never
  depends on what this screen has loaded. */
  const downloadFullBackup = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const backup = await backupAPI.exportAttendance();
      downloadJson(backup, `attendance_full_backup_${todayStamp()}.json`);
      setLastExport(backup.counts || null);
    } catch (error) {
      setExportError(error.response?.data?.message || "Unable to prepare the backup. Please try again.");
    } finally {
      setExporting(false);
    }
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
      if (!isModuleBackup(parsed, "attendance")) {
        setParseError(
          "This file doesn't contain any Attendance backup data (members, events, attendance records, reports or audit logs).",
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


  return (
    <BackupWorkspace
      module="attendance"
      exports={[
        { label: "Members", description: "Member profiles and contact details", count: members.length, download: downloadMembersCSV },
        { label: "Events", description: "Event dates, locations and status", count: events.length, download: downloadEventsCSV },
        { label: "Attendance logs", description: "Member attendance and scan times", count: attendanceLogs.length, download: downloadAttendanceCSV },
      ]}
      {...{ downloadFullBackup, exporting, exportError, lastExport,
        restoreFile, pendingRestore, restoring, restoreResult, parseError,
        handleFileSelect, cancelRestore, confirmRestore }}
    />
  );
}