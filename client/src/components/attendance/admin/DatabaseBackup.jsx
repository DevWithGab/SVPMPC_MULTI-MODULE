import React, { useState } from "react";
import BackupWorkspace from "../../shared/BackupWorkspace";
import { backupAPI } from "../../../services/api";
import { downloadJson, isModuleBackup } from "../../../utils/moduleBackup";
import useBackupDatasetExports from "../../../hooks/useBackupDatasetExports";

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
  const { datasetExports, individualExportError } = useBackupDatasetExports("attendance", { members: members.length, events: events.length, attendanceLogs: attendanceLogs.length });

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
      exports={datasetExports}
      {...{ downloadFullBackup, exporting, exportError, lastExport,
        restoreFile, pendingRestore, restoring, restoreResult, parseError,
        handleFileSelect, cancelRestore, confirmRestore, individualExportError }}
    />
  );
}
