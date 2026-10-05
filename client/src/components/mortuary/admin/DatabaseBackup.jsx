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

// The `members` prop comes back from the Mortuary admin member listing
// reshaped for that screen's own display (id/name/contact instead of the
// real Member schema fields) — dumping it as-is into the backup would make
// restore silently unable to update memberName/phoneNumber on existing
// records, since the schema has no "name" or "contact" path. Normalize back
// to the real field names so what gets exported is what upsertMany expects.
const normalizeMemberForBackup = (m) => ({
  memberId: m.memberId || m.id,
  memberName: m.memberName || m.name,
  email: m.email || "",
  phoneNumber: m.phoneNumber || m.contact || "",
  barangay: m.barangay || "",
  address: m.address || "",
  beneficiaries: m.beneficiaries || "",
  status: m.status || "active",
  dateOfBirth: m.dateOfBirth || undefined,
  gender: m.gender || undefined,
  joinDate: m.joinDate || m.join_date || undefined,
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
  contributions = [],
  user,
  onRestored,
}) {
  const [restoreFile, setRestoreFile] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null); // parsed backup data awaiting confirm
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null); // { summary } | { error }
  const [parseError, setParseError] = useState("");

  // A member's balance isn't a field on Member — it's derived from the
  // latest entry in their Ledger history. Fetched separately (and lazily,
  // only while this screen is open) since it can grow large and nothing
  // else on the admin dashboard needs it.
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
        "ID",
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

  const downloadFullBackup = () => {
    const data = {
      exportDate: new Date().toISOString(),
      exportVersion: "2.0",
      system: "Mortuary Fund Management",
      members: members.map(normalizeMemberForBackup),
      contributions,
      ledgers,
      metadata: {
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.status === "active").length,
        totalContributions: contributions.length,
        totalLedgerEntries: ledgers.length,
        exportedBy: user?.name || "Admin",
      },
    };
    downloadBlob(
      JSON.stringify(data, null, 2),
      "application/json",
      `mortuary_full_backup_${todayStamp()}.json`,
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
        Array.isArray(parsed?.contributions) ||
        Array.isArray(parsed?.ledgers);
      if (!hasAny) {
        setParseError(
          'This file has no "members", "contributions", or "ledgers" array — it doesn\'t look like a Mortuary system backup.',
        );
        return;
      }
      setPendingRestore(parsed);
    } catch (error) {
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

  const summaryCounts = (key) => {
    const s = restoreResult?.summary?.[key];
    if (!s) return null;
    return `${s.created} created, ${s.updated} updated${s.errors.length ? `, ${s.errors.length} failed` : ""}`;
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Database Backup & Restore
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Export and restore your mortuary fund data for emergency recovery.
        </p>
      </div>

      {/* Backup Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <Users className="w-5 h-5 text-coop-green" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Members
            </p>
            <p className="text-xl font-bold text-slate-900">{members.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <Wallet className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Contributions
            </p>
            <p className="text-xl font-bold text-slate-900">
              {contributions.length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <Database className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ledger Entries (Balances)
            </p>
            <p className="text-xl font-bold text-slate-900">
              {loadingLedgers ? "…" : ledgers.length}
            </p>
          </div>
        </div>
      </div>

      {ledgerLoadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            {ledgerLoadError} The "Complete System Backup" below won't include
            member balances until this loads — refresh the page to retry.
          </p>
        </div>
      )}

      {/* Backup Options */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
          Backup
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-50 rounded-xl shrink-0">
                <Users className="w-6 h-6 text-coop-green" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
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
              className="w-full h-11 px-4 mt-auto bg-white border-2 border-coop-green text-coop-green hover:bg-green-50 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 rounded-xl shrink-0">
                <Wallet className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
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
              className="w-full h-11 px-4 mt-auto bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-50 rounded-xl shrink-0">
                <Wallet className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
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
              className="w-full h-11 px-4 mt-auto bg-white border-2 border-amber-600 text-amber-700 hover:bg-amber-50 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-50 rounded-xl shrink-0">
                <Database className="w-6 h-6 text-coop-green" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
                  Complete Backup
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Full export in JSON — restorable from below
                </p>
              </div>
            </div>
            <div className="space-y-2.5 mb-6 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Members</span>
                <span className="font-semibold text-slate-900">
                  {members.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Contributions</span>
                <span className="font-semibold text-slate-900">
                  {contributions.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ledger Entries (Balances)</span>
                <span className="font-semibold text-slate-900">
                  {loadingLedgers ? "…" : ledgers.length}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center mt-auto mb-2">
              Don't open or edit this file — just save it somewhere safe and
              upload it below if you ever need to restore.
            </p>
            <button
              onClick={downloadFullBackup}
              disabled={loadingLedgers}
              className="w-full h-11 px-4 bg-coop-green hover:bg-coop-darkGreen text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Download JSON Backup
            </button>
          </div>
        </div>
      </div>

      {/* Restore */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
          Restore
        </h2>
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-slate-100 rounded-xl shrink-0">
              <Upload className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900">
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

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4">
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="hidden"
              id="mortuary-restore-upload"
              disabled={restoring}
            />
            <label
              htmlFor="mortuary-restore-upload"
              className="cursor-pointer text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              {restoreFile
                ? restoreFile.name
                : "Click to select a backup .json file"}
            </label>
          </div>

          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4 flex items-start gap-2.5">
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
                  className="flex-1 h-10 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestore}
                  disabled={restoring}
                  className="flex-1 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
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
              <div className="text-xs text-green-800 space-y-1">
                <p className="font-bold">Restore complete.</p>
                {summaryCounts("members") && (
                  <p>Members: {summaryCounts("members")}</p>
                )}
                {summaryCounts("contributions") && (
                  <p>Contributions: {summaryCounts("contributions")}</p>
                )}
                {summaryCounts("ledgers") && (
                  <p>Ledger entries (balances): {summaryCounts("ledgers")}</p>
                )}
              </div>
            </div>
          )}

          {restoreResult?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{restoreResult.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Backup Instructions */}
      <div className="bg-amber-50/40 border border-slate-200 shadow-sm rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
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
