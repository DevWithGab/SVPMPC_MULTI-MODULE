import React, { useState, useEffect } from "react";
import BackupWorkspace from "../../shared/BackupWorkspace";
import { backupAPI } from "../../../services/api";
import { downloadJson, isModuleBackup } from "../../../utils/moduleBackup";

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
    <BackupWorkspace
      module="mortuary"
      exports={[
        { label: "Members", description: "Member profiles and contact details", count: members.length, download: downloadMembersCSV },
        { label: "Contributions", description: "Payments and reference numbers", count: contributions.length, download: downloadContributionsCSV },
        { label: "Member balances", description: "Full ledger and transaction history", count: loadingLedgers ? "Loading…" : ledgerLoadError ? "Unavailable" : ledgers.length, download: downloadLedgerCSV, disabled: loadingLedgers || Boolean(ledgerLoadError) },
      ]}
      {...{ downloadFullBackup, exporting, exportError, lastExport,
        restoreFile, pendingRestore, restoring, restoreResult, parseError,
        handleFileSelect, cancelRestore, confirmRestore, ledgerLoadError }}
    />
  );
}