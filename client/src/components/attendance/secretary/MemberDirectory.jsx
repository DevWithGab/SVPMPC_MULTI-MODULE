import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  QrCode,
  Download,
  Grid,
  List,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Modal } from "../../ui/modal";
import { memberAPI, attendanceAPI, resolveQrAssetUrl } from "../../../services/api";

// A deceased member's QR is never shown/printable here, even if one was
// generated back when they were active — Member.status is shared with the
// Mortuary module, and the backend already refuses to record attendance
// for a deceased member, so a code that can no longer actually check
// anyone in shouldn't be presented as usable.
const getQrUnavailableReason = (member) => {
  if (member.status === "deceased") return "Member is deceased";
  if (!member.qrCodeGenerated) return "QR not generated";
  return null;
};

export default function MemberDirectory({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'grid'
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDirectoryData = async () => {
      setLoading(true);
      setError("");
      try {
        const [membersResponse, attendanceResponse] = await Promise.all([
          memberAPI.getAllMembers(),
          attendanceAPI.getAllAttendance(),
        ]);

        setMembers(
          Array.isArray(membersResponse?.members)
            ? membersResponse.members
            : [],
        );
        setAttendanceLogs(
          Array.isArray(attendanceResponse?.attendance)
            ? attendanceResponse.attendance
            : [],
        );
      } catch (fetchError) {
        setError(fetchError?.message || "Unable to load member directory.");
      } finally {
        setLoading(false);
      }
    };

    fetchDirectoryData();
  }, []);

  const latestAttendanceByMemberId = useMemo(() => {
    const latestMap = new Map();

    attendanceLogs.forEach((record) => {
      const recordMemberId = String(
        record?.memberId || record?.member_id || record?.member?.memberId || "",
      ).trim();
      if (!recordMemberId) return;

      const timestamp =
        record?.scanTime ||
        record?.timestamp ||
        record?.createdAt ||
        record?.updatedAt ||
        null;
      if (!timestamp) return;

      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime())) return;

      const existing = latestMap.get(recordMemberId);
      if (!existing || parsed.getTime() > existing.getTime()) {
        latestMap.set(recordMemberId, parsed);
      }
    });

    return latestMap;
  }, [attendanceLogs]);

  const normalizedMembers = useMemo(
    () =>
      members.map((member) => {
        const memberId = String(member?.memberId || member?.id || "N/A");
        const computedLastAttendance = latestAttendanceByMemberId.get(memberId);

        return {
          id: member?._id || member?.memberId || member?.id,
          name: member?.memberName || member?.name || "Unknown Member",
          memberId,
          email: member?.email || "N/A",
          phone: member?.phoneNumber || member?.phone || "N/A",
          status: String(member?.status || "inactive").toLowerCase(),
          joinDate: member?.joinDate || member?.createdAt || null,
          lastAttendance:
            computedLastAttendance || member?.lastAttendance || null,
          qrCode: member?.qrCode || null,
          // The admin-issued QR — never generate one client-side from the
          // memberId, since that would show what looks like a valid,
          // scannable code for a member the admin hasn't actually issued
          // one for yet.
          qrCodeGenerated: Boolean(member?.qrCodeGenerated),
          qrCodeUrl: member?.qrCodeUrl || null,
          qrCodeActive: member?.qrCodeActive !== false,
        };
      }),
    [members, latestAttendanceByMemberId],
  );

  // Filter members based on search term and status
  const filteredMembers = normalizedMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || member.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewQR = (member) => {
    if (getQrUnavailableReason(member)) return;
    setSelectedMember(member);
    setShowQRModal(true);
  };

  const handlePrintQR = (member) => {
    if (getQrUnavailableReason(member)) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      // The real admin-issued QR image — never a client-rendered stand-in
      // from the memberId, which would print as if it were a valid code.
      const qrSrc = resolveQrAssetUrl(member.qrCodeUrl);
      const qrMarkup = qrSrc
        ? `<img src="${qrSrc}" alt="QR code" width="168" height="168" />`
        : "";

      const isActive = member.status === "active";
      const statusLabel = member.status.charAt(0).toUpperCase() + member.status.slice(1);
      const joinDate = member.joinDate
        ? new Date(member.joinDate).toLocaleDateString()
        : "N/A";
      // Absolute URL — a print window's about:blank document can't reliably
      // resolve a root-relative asset path against the app's origin.
      const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;

      // Member fields are admin-entered but still get embedded into a raw
      // HTML string below — escape them so a stray "<" or "&" can't break
      // the markup (or worse) in the print window.
      const esc = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]);

      printWindow.document.write(`
        <html>
          <head>
            <title>${esc(member.name)} - QR Code</title>
            <style>
              @page { margin: 12mm; }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 24px;
                background: #f8fafc;
              }
              .card {
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                max-width: 340px;
                width: 100%;
                background: #ffffff;
                overflow: hidden;
              }
              .header {
                background: #2D7A3E;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                gap: 10px;
              }
              .header img {
                width: 24px;
                height: 24px;
                object-fit: contain;
                background: #fff;
                border-radius: 9999px;
                padding: 2px;
                flex-shrink: 0;
              }
              .header .org {
                margin: 0;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.03em;
                color: #fff;
              }
              .header .tagline {
                margin: 0;
                font-size: 10px;
                color: #dcfce7;
              }
              .status-pill {
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 2px 10px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                white-space: nowrap;
                background: ${isActive ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
                color: ${isActive ? "#ffffff" : "#dcfce7"};
              }
              .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 9999px;
                background: ${isActive ? "#ffffff" : "#dcfce7"};
              }
              .body {
                padding: 20px 20px 16px;
                text-align: center;
              }
              h1 {
                margin: 0;
                color: #0f172a;
                font-size: 18px;
                font-weight: 700;
              }
              .member-id {
                margin: 2px 0 16px;
                color: #94a3b8;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .member-id span {
                font-family: ui-monospace, "SFMono-Regular", monospace;
                text-transform: none;
              }
              .qr-box {
                display: inline-block;
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px;
                line-height: 0;
              }
              .qr-caption {
                margin: 10px 0 0;
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #94a3b8;
              }
              .details {
                border-top: 1px solid #f1f5f9;
                text-align: left;
              }
              .details .cell {
                padding: 10px 20px;
              }
              .details .cell-row {
                display: flex;
              }
              .details .cell-row .cell {
                flex: 1;
              }
              .details .cell-row .cell:first-child {
                border-right: 1px solid #f1f5f9;
              }
              .details .cell-full {
                border-bottom: 1px solid #f1f5f9;
              }
              .details .label {
                margin: 0;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #94a3b8;
              }
              .details .value {
                margin: 1px 0 0;
                font-size: 13px;
                font-weight: 500;
                color: #1e293b;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <img src="${logoUrl}" alt="" />
                <div>
                  <p class="org">SVPMPC</p>
                  <p class="tagline">Member Identification</p>
                </div>
                <span class="status-pill"><span class="status-dot"></span>${esc(statusLabel)}</span>
              </div>
              <div class="body">
                <h1>${esc(member.name)}</h1>
                <p class="member-id">Member ID &middot; <span>${esc(member.memberId)}</span></p>
                <div class="qr-box">${qrMarkup}</div>
                <p class="qr-caption">Scan to verify membership</p>
              </div>
              <div class="details">
                <div class="cell cell-full">
                  <p class="label">Email</p>
                  <p class="value">${esc(member.email)}</p>
                </div>
                <div class="cell-row">
                  <div class="cell">
                    <p class="label">Phone</p>
                    <p class="value">${esc(member.phone)}</p>
                  </div>
                  <div class="cell">
                    <p class="label">Member Since</p>
                    <p class="value">${esc(joinDate)}</p>
                  </div>
                </div>
              </div>
            </div>
            <script>
              setTimeout(() => window.print(), 500);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportDirectory = () => {
    const csvContent = [
      [
        "Name",
        "Member ID",
        "Email",
        "Phone",
        "Status",
        "Join Date",
        "Last Attendance",
      ],
      ...filteredMembers.map((member) => [
        member.name,
        member.memberId,
        member.email,
        member.phone,
        member.status,
        member.joinDate,
        member.lastAttendance,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `member-directory-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    return status === "active"
      ? "text-coop-green bg-green-50 border-green-200"
      : "text-slate-500 bg-slate-50 border-slate-200";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Member Directory
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            View member information and QR codes
          </p>
        </div>
        <Button
          onClick={handleExportDirectory}
          variant="outline"
          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-semibold rounded-lg"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters and View Controls */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {["all", "active", "inactive"].map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? "default" : "outline"}
                  onClick={() => setFilterStatus(status)}
                  className="rounded-lg font-medium capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 border border-slate-200 rounded-lg p-1">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                aria-pressed={viewMode === "table"}
                className="rounded-md"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className="rounded-md"
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Directory */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 p-5">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-coop-green" />
            Members ({filteredMembers.length})
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">
            Member directory and QR codes
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-medium">
              Loading member directory...
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Member Details
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Contact Info
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Last Attendance
                    </TableHead>
                    <TableHead className="font-semibold uppercase text-[10px] tracking-wide text-slate-500">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="stagger-in">
                  {filteredMembers.map((member) => (
                    <TableRow
                      key={member.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-white">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {member.name}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">
                              {member.memberId}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {member.email}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div
                          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(member.status)}`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${member.status === "active" ? "bg-coop-green" : "bg-slate-400"}`}
                          ></div>
                          <span className="capitalize">{member.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-slate-700">
                          {member.lastAttendance
                            ? new Date(
                                member.lastAttendance,
                              ).toLocaleDateString()
                            : "Not recorded"}
                        </p>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const unavailableReason = getQrUnavailableReason(member);
                            if (!unavailableReason) {
                              return (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewQR(member)}
                                    aria-label={`View QR code for ${member.name}`}
                                    title="View QR code"
                                    className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrintQR(member)}
                                    aria-label={`Print QR card for ${member.name}`}
                                    title="Print QR card"
                                    className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Button>
                                </>
                              );
                            }
                            return (
                              <span
                                className="text-xs font-medium text-slate-400 italic"
                                title={
                                  member.status === "deceased"
                                    ? "This member is recorded as deceased — their QR code is no longer valid."
                                    : "The attendance admin hasn't generated a QR code for this member yet."
                                }
                              >
                                {member.status === "deceased" ? "QR invalid" : "QR not generated"}
                              </span>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-slate-400"
                      >
                        <div className="flex flex-col items-center gap-4">
                          <Users className="w-10 h-10 text-slate-300" />
                          <div>
                            <p className="font-semibold text-slate-600">
                              No members found
                            </p>
                            <p className="text-sm">
                              Try adjusting your search or filter criteria
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-in">
              {filteredMembers.map((member) => (
                <Card
                  key={member.id}
                  className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white hover:border-green-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                        <span className="text-base font-bold text-white">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {member.memberId}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(member.status)}`}
                      >
                        {member.status}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <p className="text-xs text-slate-500">
                        Email: {member.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        Phone: {member.phone}
                      </p>
                      <p className="text-xs text-slate-500">
                        Last Attendance:{" "}
                        {member.lastAttendance
                          ? new Date(member.lastAttendance).toLocaleDateString()
                          : "Not recorded"}
                      </p>
                    </div>

                    {!getQrUnavailableReason(member) ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewQR(member)}
                          className="flex-1 border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                        >
                          <QrCode className="w-4 h-4 mr-1" />
                          View QR
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintQR(member)}
                          aria-label={`Print QR card for ${member.name}`}
                          title="Print QR card"
                          className="border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green rounded-lg"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="text-center text-xs font-medium text-slate-400 italic py-2 rounded-lg bg-slate-50 border border-dashed border-slate-200"
                        title={
                          member.status === "deceased"
                            ? "This member is recorded as deceased — their QR code is no longer valid."
                            : "The attendance admin hasn't generated a QR code for this member yet."
                        }
                      >
                        {member.status === "deceased" ? "QR invalid" : "QR not generated"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {filteredMembers.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-4">
                    <Users className="w-10 h-10 text-slate-300" />
                    <div>
                      <p className="font-semibold text-slate-600">No members found</p>
                      <p className="text-sm">
                        Try adjusting your search or filter criteria
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Member QR Code"
        className="max-w-sm"
      >
        {selectedMember && (
          <div className="space-y-5">
            {/* ID card */}
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header band */}
              <div className="bg-coop-green px-5 py-3 flex items-center gap-2.5">
                <img
                  src="/SVPMPC-LOGO(MAIN).png"
                  alt=""
                  className="w-6 h-6 object-contain bg-white rounded-full p-0.5 shrink-0"
                />
                <div className="leading-tight min-w-0">
                  <p className="text-[11px] font-bold text-white tracking-wide truncate">
                    SVPMPC
                  </p>
                  <p className="text-[10px] text-green-100">Member Identification</p>
                </div>
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                    selectedMember.status === "active"
                      ? "bg-white/20 text-white"
                      : "bg-black/15 text-green-50"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedMember.status === "active" ? "bg-white" : "bg-green-100/70"
                    }`}
                  />
                  {selectedMember.status}
                </span>
              </div>

              {/* Body */}
              <div className="bg-white px-5 pt-5 pb-4 text-center">
                <p className="text-lg font-bold text-slate-900">{selectedMember.name}</p>
                <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5 mb-4">
                  Member ID &middot;{" "}
                  <span className="font-mono normal-case">{selectedMember.memberId}</span>
                </p>

                <div className="inline-flex bg-white p-3 rounded-lg border border-slate-200">
                  <img
                    src={resolveQrAssetUrl(selectedMember.qrCodeUrl)}
                    alt={`QR code for ${selectedMember.name}`}
                    width={168}
                    height={168}
                  />
                </div>
                <p className="mt-2.5 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                  Scan to verify membership
                </p>
              </div>

              {/* Details */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Email
                  </p>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {selectedMember.email}
                  </p>
                </div>
                <div className="grid grid-cols-2">
                  <div className="px-5 py-3 border-r border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="text-sm font-medium text-slate-800">{selectedMember.phone}</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Member Since
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedMember.joinDate
                        ? new Date(selectedMember.joinDate).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowQRModal(false)}
                className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
              >
                Close
              </Button>
              <Button
                onClick={() => handlePrintQR(selectedMember)}
                className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print QR Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
