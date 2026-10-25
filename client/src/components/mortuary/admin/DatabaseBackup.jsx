import React, { useState, useEffect } from "react";
import {
  Users,
  Wallet,
  FileText,
  Database,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { backupAPI } from "../../../services/api";
import { BACKUP_COLLECTIONS, downloadJson, isModuleBackup, restoreSummaryLines } from "../../../utils/moduleBackup";
import AttendanceMetricGrid from "../../attendance/shared/AttendanceMetricGrid";
import "../treasurer/Dashboard.css";
import "./DatabaseBackup.css";

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
  contributions = [],
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

  /* Hindi field sa Member yung balance ng member - derived ito sa latest
  entry ng Ledger history nila. Fetched separately (at lazily, habang bukas
  lang itong screen) dahil puwede itong lumaki at wala namang ibang parte
  ng admin dashboard na kailangan nito. */
  const [ledgers, setLedgers] = useState([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [ledgerLoadError, setLedgerLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingLedgers(true);
    backupAPI
      .getMortuaryLedgerExport()
      .then((res) => {
        if (!cancelled) setLedgers(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setLedgerLoadError("Unable to load ledger data for backup.");
      })
      .finally(() => {
        if (!cancelled) setLoadingLedgers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadMembersCSV = () => {
    const csv = toCSV([
      [
        "Passbook No.",
        "Name",
        "Email",
        "Phone",
        "Barangay",
        "Address",
        "Status",
        "Join Date",
      ],
      ...members.map((m) => [
        m.memberId || m.id,
        m.memberName || m.name,
        m.email || "",
        m.phoneNumber || m.contact || "",
        m.barangay || "",
        m.address || "",
        m.status || "active",
        m.joinDate || m.join_date || "",
      ]),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `mortuary_members_backup_${todayStamp()}.csv`,
    );
  };

  const downloadContributionsCSV = () => {
    const csv = toCSV([
      [
        "ID",
        "Passbook Number",
        "Amount",
        "Payment Date",
        "Due Date",
        "Status",
        "Reference Number",
      ],
      ...contributions.map((c) => [
        c.contributionId || c.id,
        c.memberId || "",
        c.amount ?? "",
        c.paymentDate || "",
        c.dueDate || "",
        c.status || "paid",
        c.referenceNumber || "",
      ]),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `mortuary_contributions_backup_${todayStamp()}.csv`,
    );
  };

  const downloadLedgerCSV = () => {
    const csv = toCSV([
      [
        "Ledger ID",
        "Passbook Number",
        "Transaction Type",
        "Description",
        "Credit",
        "Debit",
        "Balance",
        "Transaction Date",
      ],
      ...ledgers.map((l) => [
        l.ledgerId || "",
        l.memberId || "",
        l.transactionType || "",
        l.description || "",
        l.credit ?? 0,
        l.debit ?? 0,
        l.balance ?? "",
        l.transactionDate || "",
      ]),
    ]);
    downloadBlob(
      "﻿" + csv,
      "text/csv;charset=utf-8;",
      `mortuary_ledger_backup_${todayStamp()}.csv`,
    );
  };

  /* The complete backup is built by the server from every Mortuary
  collection (members, beneficiaries, claims, contributions, ledgers,
  settings, notice batches, payment imports, audit logs), so it never
  depends on what this screen has loaded. */
  const downloadFullBackup = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const backup = await backupAPI.exportMortuary();
      downloadJson(backup, `mortuary_full_backup_${todayStamp()}.json`);
      setLastExport(backup?.counts || null);
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
      if (!isModuleBackup(parsed, "mortuary")) {
        setParseError(
          "This file doesn't contain any Mortuary backup data (members, beneficiaries, claims, contributions, ledgers, settings or audit logs).",
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
      const response = await backupAPI.restoreMortuary(pendingRestore);
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
    <div className="treasurer-dashboard admin-backup">
      <header className="td-header">
        <div>
          <p className="td-eyebrow">Mortuary management / Backup &amp; restore</p>
          <h1>Backup &amp; restore</h1>
          <p className="td-description">Export mortuary fund records and restore data from a saved JSON backup.</p>
        </div>
      </header>

      <AttendanceMetricGrid label="Records available for backup" busy={loadingLedgers} items={[
        ['Members', members.length.toLocaleString(), 'Member records available for export', Users],
        ['Contributions', contributions.length.toLocaleString(), 'Contribution records available for export', Wallet],
        ['Ledger entries', loadingLedgers ? '?' : ledgerLoadError ? 'Unavailable' : ledgers.length.toLocaleString(), 'Transaction history behind member balances', Database],
      ]} />

      {ledgerLoadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700" role="alert">
            {ledgerLoadError} The "Complete System Backup" below won't include
            member balances until this loads — refresh the page to retry.
          </p>
        </div>
      )}

      {/* Backup Options */}
      <div>
        <h2 className="backup-section-title">
          Backup
        </h2>
        <div className="backup-options">
          <div className="backup-card">
            <div className="backup-card-heading">
              <div className="backup-icon">
                <Users className="w-6 h-6 text-coop-green" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="backup-card-title">
                  Members Database
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Export all member records in CSV format
                </p>
              </div>
            </div>
            <div className="space-y-2.5 mb-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Records</span>
                <span className="font-semibold text-slate-900">
                  {members.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Format</span>
                <span className="font-semibold text-slate-900">CSV</span>
              </div>
            </div>
            <button
              onClick={downloadMembersCSV}
              className="td-button backup-download"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="backup-card">
            <div className="backup-card-heading">
              <div className="backup-icon">
                <Wallet className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="backup-card-title">
                  Contributions
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Export all contribution records in CSV format
                </p>
              </div>
            </div>
            <div className="space-y-2.5 mb-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Records</span>
                <span className="font-semibold text-slate-900">
                  {contributions.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Format</span>
                <span className="font-semibold text-slate-900">CSV</span>
              </div>
            </div>
            <button
              onClick={downloadContributionsCSV}
              className="td-button backup-download"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="backup-card">
            <div className="backup-card-heading">
              <div className="backup-icon">
                <Wallet className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="backup-card-title">
                  Member Balances
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Export the full ledger history behind every balance
                </p>
              </div>
            </div>
            <div className="space-y-2.5 mb-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Records</span>
                <span className="font-semibold text-slate-900">
                  {loadingLedgers ? "…" : ledgers.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Format</span>
                <span className="font-semibold text-slate-900">CSV</span>
              </div>
            </div>
            <button
              onClick={downloadLedgerCSV}
              disabled={loadingLedgers}
              className="td-button backup-download"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="backup-card">
            <div className="backup-card-heading">
              <div className="backup-icon">
                <Database className="w-6 h-6 text-coop-green" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="backup-card-title">
                  Complete Backup
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Full export in JSON — restorable from below
                </p>
              </div>
            </div>
            <div className="space-y-2.5 mb-6 text-sm">
              {BACKUP_COLLECTIONS.mortuary.map(([key, label]) => (
                <div className="flex items-center justify-between" key={key}>
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">
                    {lastExport?.[key] !== undefined ? lastExport[key].toLocaleString() : "Included"}
                  </span>
                </div>
              ))}
            </div>
            {exportError && <p className="text-xs text-red-600 mb-2" role="alert">{exportError}</p>}
            <p className="text-xs text-slate-400 text-center mt-auto mb-2">
              Don't open or edit this file — just save it somewhere safe and
              upload it below if you ever need to restore.
            </p>
            <button
              onClick={downloadFullBackup}
              disabled={exporting}
              className="td-button td-primary backup-download"
            >
              <FileText className="w-4 h-4" />
              {exporting ? "Preparing backup…" : "Download JSON Backup"}
            </button>
          </div>
        </div>
      </div>

      {/* Restore */}
      <div>
        <h2 className="backup-section-title">
          Restore
        </h2>
        <div className="backup-restore-panel">
          <div className="backup-card-heading">
            <div className="backup-icon">
              <Upload className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="backup-card-title">
                Restore from Backup
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Upload a "Complete System Backup" .json file to restore
                members, contributions, and member balances.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Restoring updates any existing record that shares an ID with the
              backup, and adds records that don't exist yet. It never deletes
              data that isn't in the file, but overwritten fields cannot be
              undone — export a fresh backup first if you're unsure.
            </p>
          </div>

          <div className="backup-file-picker">
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="sr-only"
              aria-describedby="backup-file-help"
              id="mortuary-restore-upload"
              disabled={restoring}
            />
            <label
              htmlFor="mortuary-restore-upload"
              className="backup-file-label"
            >
              {restoreFile
                ? restoreFile.name
                : "Click to select a backup .json file"}
            </label>
            <p id="backup-file-help">Select a JSON backup to preview its records before confirming restore.</p>
            <p className="text-xs text-slate-500 mt-2">
              Existing members: restores beneficiary fields only. Shared profiles, status, QR details, and module assignments are preserved.
              Missing members are automatically enrolled in both Attendance and Mortuary.
            </p>
          </div>

          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700" role="alert">{parseError}</p>
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
                {Array.isArray(pendingRestore.contributions) && (
                  <span>
                    {pendingRestore.contributions.length} contributions
                  </span>
                )}
                {Array.isArray(pendingRestore.ledgers) && (
                  <span>
                    {pendingRestore.ledgers.length} ledger entries (balances)
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelRestore}
                  disabled={restoring}
                  className="td-button flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestore}
                  disabled={restoring}
                  className="td-button backup-confirm flex-1"
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
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-coop-green shrink-0 mt-0.5" />
              <div className="text-xs text-green-800 space-y-1" role="status">
                <p className="font-bold">Restore complete.</p>
                {restoreSummaryLines(restoreResult.summary, "mortuary").map(([label, text]) => (
                  <p key={label}>{label}: {text}</p>
                ))}
              </div>
            </div>
          )}

          {restoreResult?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700" role="alert">{restoreResult.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Backup Instructions */}
      <div className="backup-guidance">
        <div className="flex items-start gap-4">
          <div className="backup-icon">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="backup-card-title mb-2">
              Backup Best Practices
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-coop-green font-bold mt-0.5">•</span>
                <span>
                  <strong className="font-bold text-slate-900">
                    Regular Backups:
                  </strong>{" "}
                  Download backups weekly or after major data changes
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-coop-green font-bold mt-0.5">•</span>
                <span>
                  <strong className="font-bold text-slate-900">
                    Secure Storage:
                  </strong>{" "}
                  Store backup files in a secure location (external drive, cloud
                  storage)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-coop-green font-bold mt-0.5">•</span>
                <span>
                  <strong className="font-bold text-slate-900">
                    Multiple Copies:
                  </strong>{" "}
                  Keep at least 2-3 backup copies in different locations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-coop-green font-bold mt-0.5">•</span>
                <span>
                  <strong className="font-bold text-slate-900">
                    Test Recovery:
                  </strong>{" "}
                  Periodically restore a backup into a test environment to
                  confirm it actually works
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
