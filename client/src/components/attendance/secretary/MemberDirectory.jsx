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
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { memberAPI, attendanceAPI } from "../../../services/api";

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
    setSelectedMember(member);
    setShowQRModal(true);
  };

  const handlePrintQR = (member) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const qrMarkup = renderToStaticMarkup(
        <QRCodeSVG
          value={member.memberId}
          size={200}
          level="H"
          fgColor="#2D7A3E"
        />,
      );

      printWindow.document.write(`
        <html>
          <head>
            <title>${member.name} - QR Code</title>
            <style>
              @page {
                margin: 12mm;
              }
              * {
                box-sizing: border-box;
              }
              body {
                font-family: sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 24px;
                margin: 0;
              }
              .card {
                border: 2px solid #2D7A3E;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 400px;
                width: 100%;
              }
              h1 {
                margin: 0 0 10px 0;
                color: #2D7A3E;
                font-size: 24px;
              }
              .member-id {
                margin: 0 0 20px 0;
                color: #64748b;
                font-size: 16px;
              }
              .contact-info {
                margin: 20px 0;
                color: #64748b;
                font-size: 14px;
              }
              .qr-container {
                margin: 20px 0;
              }
              .qr-container svg {
                display: block;
                width: 200px;
                height: 200px;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>${member.name}</h1>
              <p class="member-id">Member ID: ${member.memberId}</p>
              <div class="qr-container">
                ${qrMarkup}
              </div>
              <div class="contact-info">
                <p>Email: ${member.email}</p>
                <p>Phone: ${member.phone}</p>
                <p>Status: ${member.status.charAt(0).toUpperCase() + member.status.slice(1)}</p>
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
      >
        {selectedMember && (
          <div className="text-center">
            <div className="mb-5">
              <div className="flex items-center gap-3 justify-center mb-4">
                <div className="w-14 h-14 bg-coop-green rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-white">
                    {selectedMember.name.charAt(0)}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-slate-900">
                    {selectedMember.name}
                  </p>
                  <p className="text-sm text-slate-500 font-mono">
                    {selectedMember.memberId}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 mb-5 inline-block">
              <QRCodeSVG
                value={selectedMember.memberId}
                size={200}
                level="H"
                fgColor="#2D7A3E"
              />
            </div>

            <div className="space-y-1.5 mb-5 text-sm text-slate-600 text-left inline-block">
              <p>
                <span className="font-semibold">Email:</span> {selectedMember.email}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {selectedMember.phone}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                <span className="capitalize">{selectedMember.status}</span>
              </p>
              <p>
                <span className="font-semibold">Join Date:</span>{" "}
                {selectedMember.joinDate
                  ? new Date(selectedMember.joinDate).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>

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
