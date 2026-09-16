import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Upload,
  Printer,
  Search,
  Grid,
  List,
  Download,
  XCircle,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  Ban,
  Power,
  Loader2,
} from "lucide-react";
import { memberAPI, resolveQrAssetUrl } from "../../../services/api";

// A member's QR is in exactly one of three states — this is the single
// source of truth the whole screen (badges, filters, actions) reads from.
const qrState = (member) => {
  if (!member?.qrCodeGenerated) return "none";
  return member.qrCodeActive === false ? "inactive" : "active";
};

const QR_STATE_META = {
  none: { label: "Not Generated", className: "bg-slate-100 text-slate-700" },
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  inactive: { label: "Inactive", className: "bg-amber-100 text-amber-800" },
};

// Member.status is shared with the Mortuary module — filing a death claim
// there flips a member to 'deceased', which this screen needs to surface
// (and gate QR issuance on) instead of treating every member as active.
const MEMBER_STATUS_META = {
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  deceased: { label: "Deceased", className: "bg-rose-100 text-rose-700" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-600" },
  staff: { label: "Staff", className: "bg-blue-100 text-blue-700" },
};

const MemberStatusBadge = ({ member }) => {
  const meta = MEMBER_STATUS_META[member?.status] || MEMBER_STATUS_META.inactive;
  return (
    <span
      className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${meta.className}`}
    >
      {meta.label}
    </span>
  );
};

const QRStatusBadge = ({ member }) => {
  const meta = QR_STATE_META[qrState(member)];
  return (
    <span
      className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${meta.className}`}
    >
      {meta.label}
    </span>
  );
};

const printQRCodes = (members) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const qrCards = members
    .map((member) => {
      const src = resolveQrAssetUrl(member.qrCodeUrl);
      return `
      <div class="qr-card">
        <div class="qr-header">
          <h3>${member.memberName}</h3>
          <p>ID: ${member.memberId}</p>
        </div>
        <div class="qr-code">
          ${
            src
              ? `<img src="${src}" alt="QR Code" />`
              : '<div class="no-qr">QR Code Not Generated</div>'
          }
        </div>
        <div class="qr-footer">
          <p>${member.barangay || ""}</p>
        </div>
      </div>
    `;
    })
    .join("");

  printWindow.document.write(`
      <html>
        <head>
          <title>Member QR Codes</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .qr-card { border: 2px solid #2D7A3E; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
            .qr-header h3 { margin: 0; color: #2D7A3E; font-size: 18px; }
            .qr-header p { margin: 5px 0; color: #64748b; font-size: 14px; }
            .qr-code { margin: 20px 0; }
            .qr-code img { width: 200px; height: 200px; }
            .no-qr { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #94a3b8; margin: 0 auto; }
            .qr-footer p { margin: 0; color: #64748b; font-size: 12px; }
            @media print { .qr-card { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; color: #2D7A3E; margin-bottom: 30px;">Member QR Codes</h1>
          <div class="qr-grid">${qrCards}</div>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
};

const downloadQRCode = async (member) => {
  const src = resolveQrAssetUrl(member.qrCodeUrl);
  if (!src) return;
  const response = await fetch(src);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${member.memberId}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// The QR management console for one member — every admin action from the
// spec (generate, view, download, print, regenerate, deactivate,
// reactivate, check status) lives here so a table/grid row only ever needs
// one entry point instead of a wall of icon buttons.
const QRManagerModal = ({ member, onClose, onUpdated }) => {
  const [current, setCurrent] = useState(member);
  const [busy, setBusy] = useState(null); // which action is in flight
  const [error, setError] = useState(null);

  useEffect(() => {
    setCurrent(member);
    setError(null);
  }, [member]);

  const applyUpdate = (updatedMember) => {
    setCurrent(updatedMember);
    onUpdated(updatedMember);
  };

  const run = async (action, fn, successMessage) => {
    setBusy(action);
    setError(null);
    try {
      const response = await fn();
      if (response.member) {
        applyUpdate(response.member);
      } else {
        // generateMemberQR (bulk endpoint under the hood) doesn't echo the
        // updated member back — pull its fresh state explicitly instead.
        const status = await memberAPI.getMemberQRStatus(current.memberId);
        applyUpdate({ ...current, ...status });
      }
      if (successMessage) setError({ type: "success", text: successMessage });
    } catch (err) {
      setError({
        type: "error",
        text: err.response?.data?.message || "That action failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCheckStatus = async () => {
    setBusy("status");
    setError(null);
    try {
      const status = await memberAPI.getMemberQRStatus(current.memberId);
      applyUpdate({ ...current, ...status });
      setError({ type: "success", text: "Status refreshed from the server." });
    } catch (err) {
      setError({
        type: "error",
        text: err.response?.data?.message || "Unable to check status.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (!member) return null;
  const state = qrState(current);
  const src = resolveQrAssetUrl(current.qrCodeUrl);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">
              {current.memberName || current.name}
            </h3>
            <p className="text-xs text-slate-500">ID: {current.memberId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-500 rounded-full p-1"
            aria-label="Close"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <QRStatusBadge member={current} />
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={busy !== null}
              title="Check QR status"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              {busy === "status" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Check Status
            </button>
          </div>

          <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl h-56">
            {src ? (
              <img
                src={src}
                alt={`QR code for ${current.memberName}`}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <p className="text-sm text-slate-400 px-6 text-center">
                No QR code generated yet
              </p>
            )}
          </div>

          {error && (
            <p
              className={`text-xs font-medium ${error.type === "error" ? "text-red-600" : "text-green-600"}`}
            >
              {error.text}
            </p>
          )}

          {state === "none" ? (
            <button
              onClick={() =>
                run(
                  "generate",
                  () => memberAPI.generateMemberQR(current.memberId),
                  "QR code generated.",
                )
              }
              disabled={busy !== null}
              className="w-full h-11 rounded-xl text-white font-bold text-sm shadow disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2D7A3E" }}
            >
              {busy === "generate" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Generate QR
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => downloadQRCode(current)}
                  className="h-11 rounded-xl border border-slate-200 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => printQRCodes([current])}
                  className="h-11 rounded-xl border border-slate-200 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
              <button
                onClick={() =>
                  run(
                    "regenerate",
                    () => memberAPI.regenerateMemberQR(current.memberId),
                    "QR code regenerated — the old code no longer scans.",
                  )
                }
                disabled={busy !== null}
                className="w-full h-11 rounded-xl border border-blue-200 text-blue-700 font-bold text-xs hover:bg-blue-50 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {busy === "regenerate" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate QR
              </button>
              {state === "active" ? (
                <button
                  onClick={() =>
                    run(
                      "deactivate",
                      () => memberAPI.deactivateMemberQR(current.memberId),
                      "QR code deactivated — it will no longer scan.",
                    )
                  }
                  disabled={busy !== null}
                  className="w-full h-11 rounded-xl border border-amber-200 text-amber-700 font-bold text-xs hover:bg-amber-50 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {busy === "deactivate" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Deactivate QR
                </button>
              ) : (
                <button
                  onClick={() =>
                    run(
                      "reactivate",
                      () => memberAPI.reactivateMemberQR(current.memberId),
                      "QR code reactivated.",
                    )
                  }
                  disabled={busy !== null}
                  className="w-full h-11 rounded-xl text-white font-bold text-xs shadow disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: "#2D7A3E" }}
                >
                  {busy === "reactivate" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  Reactivate QR
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const MemberManagement = () => {
  const [members, setMembers] = useState([]);
  const [barangays, setBarangays] = useState(["All"]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'grid'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [managingMember, setManagingMember] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await memberAPI.getAllMembers();
      if (response.members) {
        setMembers(response.members);
        const unique = Array.from(
          new Set(
            response.members
              .map((m) => (m.barangay || "Unassigned").trim())
              .filter(Boolean),
          ),
        );
        setBarangays(["All", ...unique]);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  // Keep the roster and the open modal (if any) in sync with a single
  // member's updated QR state, without a full refetch.
  const patchMember = (updated) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.memberId === updated.memberId ? { ...m, ...updated } : m,
      ),
    );
    setManagingMember((prev) =>
      prev && prev.memberId === updated.memberId
        ? { ...prev, ...updated }
        : prev,
    );
  };

  const filteredMembers = members.filter((member) => {
    const searchValue = searchTerm.toLowerCase();
    const memberName = String(member?.memberName || "").toLowerCase();
    const memberId = String(member?.memberId || "").toLowerCase();
    const email = String(member?.email || "").toLowerCase();

    const matchesSearch =
      memberName.includes(searchValue) ||
      memberId.includes(searchValue) ||
      email.includes(searchValue);

    const matchesBarangay =
      selectedBarangay === "All" || member?.barangay === selectedBarangay;

    return matchesSearch && matchesBarangay;
  });

  const getMemberDisplayName = (member) =>
    String(member?.memberName || member?.name || "Unknown Member");

  const getMemberInitials = (member) => {
    const displayName = getMemberDisplayName(member).trim();
    return (
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") {
      setUploadFile(file);
    } else {
      alert("Please select a valid CSV file");
    }
  };

  const handleImportCSV = async () => {
    if (!uploadFile) return;

    setUploadProgress("uploading");
    try {
      const response = await memberAPI.uploadMembers(uploadFile);

      if (response.members) {
        setUploadProgress("success");
        setTimeout(() => {
          setIsImportModalOpen(false);
          setUploadFile(null);
          setUploadProgress(null);
          fetchMembers();
        }, 2000);
      }
    } catch (error) {
      console.error("Error importing members:", error);
      setUploadProgress("error");
      alert("Failed to import members. Please check the CSV format.");
    }
  };

  const handleGenerateAllMissing = async () => {
    setGeneratingAll(true);
    try {
      const response = await memberAPI.generateAllMissingQR();
      alert(response.message || "QR codes generated.");
      fetchMembers();
    } catch (error) {
      alert(
        error.response?.data?.message || "Failed to generate missing QR codes.",
      );
    } finally {
      setGeneratingAll(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Member ID",
      "Name",
      "Email",
      "Phone",
      "Barangay",
      "Address",
      "QR Status",
    ];
    const rows = filteredMembers.map((member) => [
      member.memberId,
      member.memberName,
      member.email,
      member.phoneNumber,
      member.barangay,
      member.address,
      QR_STATE_META[qrState(member)].label,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `members_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            MEMBER QR MANAGEMENT
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Generate, print, and manage member QR codes used for attendance
            scanning · {filteredMembers.length} of {members.length} members
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center h-11 px-5 bg-white border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </button>
          <button
            onClick={handleGenerateAllMissing}
            disabled={generatingAll}
            className="inline-flex items-center h-11 px-5 bg-white border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {generatingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="w-4 h-4 mr-2" />
            )}
            Generate Missing QR
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center h-11 px-5 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, or email..."
                className="w-full h-10 pl-9 pr-4 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="h-10 px-4 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none"
            >
              {barangays.map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </select>

            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 h-10 ${viewMode === "table" ? "bg-slate-100" : "bg-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 h-10 border-l border-slate-200 ${viewMode === "grid" ? "bg-slate-100" : "bg-white"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members Display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin"></div>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    QR Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((member) => {
                  const isDeceased = member?.status === "deceased";
                  return (
                    <tr
                      key={member._id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3"
                            style={{ backgroundColor: "#2D7A3E" }}
                          >
                            {getMemberInitials(member)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {getMemberDisplayName(member)}
                            </div>
                            <div className="text-sm text-slate-500">
                              ID: {member?.memberId || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {member?.email || "N/A"}
                        </div>
                        <div className="text-sm text-slate-500">
                          {member?.phoneNumber || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-slate-900">
                          <MapPin className="w-4 h-4 mr-1 text-slate-400" />
                          {member?.barangay || "Unassigned"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <MemberStatusBadge member={member} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <QRStatusBadge member={member} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isDeceased ? (
                          <span
                            className="text-slate-400 font-semibold"
                            title="This member is recorded as deceased — QR management is disabled."
                          >
                            Deceased — QR disabled
                          </span>
                        ) : (
                          <button
                            onClick={() => setManagingMember(member)}
                            className="inline-flex items-center gap-1.5 text-green-700 hover:text-green-900 font-bold"
                          >
                            <QrCode className="w-4 h-4" />
                            {qrState(member) === "none"
                              ? "Generate QR"
                              : "Manage QR"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => {
            const isDeceased = member?.status === "deceased";
            return (
              <motion.div
                key={member._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-green-200 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: "#2D7A3E" }}
                  >
                    {getMemberInitials(member)}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <MemberStatusBadge member={member} />
                    <QRStatusBadge member={member} />
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 mb-1">
                  {getMemberDisplayName(member)}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  ID: {member?.memberId || "N/A"}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-slate-600">
                    <Mail className="w-4 h-4 mr-2 text-slate-400" />
                    {member?.email || "N/A"}
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <Phone className="w-4 h-4 mr-2 text-slate-400" />
                    {member?.phoneNumber || "N/A"}
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                    {member?.barangay || "Unassigned"}
                  </div>
                </div>

                {isDeceased ? (
                  <div
                    className="w-full h-10 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1.5"
                    title="This member is recorded as deceased — QR management is disabled."
                  >
                    Deceased — QR disabled
                  </div>
                ) : (
                  <button
                    onClick={() => setManagingMember(member)}
                    className="w-full h-10 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "#2D7A3E" }}
                  >
                    <QrCode className="w-4 h-4" />
                    {qrState(member) === "none" ? "Generate QR" : "Manage QR"}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* QR Manager Modal */}
      <AnimatePresence>
        {managingMember && (
          <QRManagerModal
            member={managingMember}
            onClose={() => setManagingMember(null)}
            onUpdated={patchMember}
          />
        )}
      </AnimatePresence>

      {/* Import CSV Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploadProgress && setIsImportModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border"
              style={{ borderColor: "#2D7A3E" }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight uppercase">
                      Import Members
                    </h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                      Upload CSV file
                    </p>
                  </div>
                  {!uploadProgress && (
                    <button
                      onClick={() => setIsImportModalOpen(false)}
                      className="rounded-full hover:bg-slate-100 p-2"
                    >
                      <XCircle className="w-6 h-6 text-slate-300" />
                    </button>
                  )}
                </div>

                {uploadProgress === "success" ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-900">
                      Import Successful!
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Members have been added to the system
                    </p>
                  </div>
                ) : uploadProgress === "error" ? (
                  <div className="text-center py-8">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-900">
                      Import Failed
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Please check the CSV format and try again
                    </p>
                    <button
                      onClick={() => setUploadProgress(null)}
                      className="mt-4 px-6 py-2 bg-slate-100 rounded-xl font-bold text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                ) : uploadProgress === "uploading" ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-bold text-slate-900">
                      Importing Members...
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Please wait while we process your file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="cursor-pointer text-sm font-bold text-slate-600 hover:text-slate-900"
                      >
                        {uploadFile
                          ? uploadFile.name
                          : "Click to select CSV file"}
                      </label>
                    </div>

                    <div className="pt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(false)}
                        className="flex-1 h-14 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImportCSV}
                        disabled={!uploadFile}
                        className="flex-1 h-14 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: "#2D7A3E" }}
                      >
                        Import Members
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemberManagement;
