import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Plus,
  Clock,
  Activity,
  CheckCircle2,
  History,
  Target,
  QrCode,
  Search,
  ShieldCheck,
  XCircle,
  Calendar,
  Users,
} from "lucide-react";
import { memberAPI } from "../../../services/api";
import { formatDate, formatTime } from "../../../utils/date";

const getEventKey = (event) =>
  event?.eventId || event?._id || event?.id || event?.eventName || event?.name;
const getEventName = (event) =>
  event?.eventName || event?.name || "Untitled Event";
const getEventDate = (event) =>
  event?.eventDate || event?.date
    ? formatDate(event?.eventDate || event?.date)
    : "No date";

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
  status: String(
    record.status || record.entryStatus || record.attendanceStatus || "present",
  ).toLowerCase(),
});

const getAttendanceLogMemberName = (log) =>
  normalizeAttendanceRecord(log).memberName || "Unknown Member";
const getAttendanceLogEventName = (log) =>
  normalizeAttendanceRecord(log).eventName || "Unknown Event";
const getAttendanceLogTime = (log) => normalizeAttendanceRecord(log).scanTime;
const getAttendanceLogStatus = (log) => normalizeAttendanceRecord(log).status;
const getAttendanceLogId = (log) =>
  log.id ||
  log._id ||
  `${getAttendanceLogMemberName(log)}-${getAttendanceLogTime(log)}`;

const getAttendanceStatusMeta = (status) => {
  const normalizedStatus = String(status || "present").toLowerCase();

  if (normalizedStatus === "absent") {
    return {
      label: "Absent",
      textClass: "text-red-600",
      bgClass: "bg-red-50",
      borderClass: "border-red-200",
      dotClass: "bg-red-500",
    };
  }

  return {
    label: "Present",
    textClass: "text-green-700",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
    dotClass: "bg-green-500",
  };
};

const Dashboard = ({
  members,
  attendanceLogs,
  events,
  currentEvent,
  setCurrentEvent,
}) => {
  const [scanInput, setScanInput] = useState("");
  const [scanStatus, setScanStatus] = useState({
    type: "idle",
    message: "",
    memberName: "",
  });
  const [isEventSelectorOpen, setIsEventSelectorOpen] = useState(false);
  const inputRef = useRef(null);
  const activeEvents = useMemo(
    () =>
      Array.isArray(events)
        ? events.filter((event) => event?.status === "active")
        : [],
    [events],
  );

  useEffect(() => {
    if (!activeEvents.length) {
      if (currentEvent) setCurrentEvent(null);
      return;
    }

    const currentEventKey = getEventKey(currentEvent);
    const isCurrentEventActive = activeEvents.some(
      (event) => getEventKey(event) === currentEventKey,
    );

    if (!currentEvent || !isCurrentEventActive) {
      setCurrentEvent(activeEvents[0]);
    }
  }, [activeEvents, currentEvent, setCurrentEvent]);

  // Focus input on mount for physical scanner
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleManualScan = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    if (!currentEvent) {
      setScanStatus({
        type: "error",
        message: "Please select an active event session first",
      });
      setScanInput("");
      return;
    }

    const scanValue = scanInput.trim();
    const normalizedScanValue = scanValue.toLowerCase();
    let member = members.find((m) => {
      const memberId = String(m.memberId || m.id || m._id || "");
      const email = String(m.email || "");
      const phoneNumber = String(m.phoneNumber || "");
      const memberName = String(m.memberName || m.member_name || m.name || "");

      return (
        memberId === scanValue ||
        email === scanValue ||
        phoneNumber === scanValue ||
        memberName.toLowerCase() === normalizedScanValue
      );
    });

    if (!member) {
      try {
        const memberResult = await memberAPI.getMemberById(scanValue);
        member = memberResult?.member || memberResult;
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Error fetching member:", error);
        }
      }
    }

    if (!member) {
      setScanStatus({ type: "error", message: "Unknown Identity" });
      setScanInput("");
      setTimeout(() => {
        setScanStatus({ type: "idle", message: "", memberName: "" });
        if (inputRef.current) inputRef.current.focus();
      }, 2500);
      return;
    }

    const eventId = currentEvent.eventId || currentEvent.id || currentEvent._id;
    const memberId = member.memberId || member.id || member._id;

    const matchingRecord = attendanceLogs.find((log) => {
      const logMemberId = log.memberId || log.member_id || log.member?.memberId;
      const logEventId =
        log.eventId ||
        log.event_id ||
        log.event?.eventId ||
        log.eventId ||
        log.event;
      const logStatus = String(log.status || "present").toLowerCase();

      return (
        String(logMemberId) === String(memberId) &&
        String(logEventId) === String(eventId) &&
        logStatus !== "absent"
      );
    });

    if (matchingRecord) {
      setScanStatus({
        type: "success",
        message: "Present",
        memberName: member.memberName || member.member_name || member.name,
      });
    } else {
      setScanStatus({
        type: "error",
        message: "Absent",
        memberName: member.memberName || member.member_name || member.name,
      });
    }

    setScanInput("");
    setTimeout(() => {
      setScanStatus({ type: "idle", message: "", memberName: "" });
      if (inputRef.current) inputRef.current.focus();
    }, 2500);
  };

  // Analytics Calculations
  const totalMembers = members.length;
  const presentMembers = new Set(
    attendanceLogs.map((log) => getAttendanceLogMemberName(log)),
  ).size;
  const absentMembers = totalMembers - presentMembers;
  const attendancePercentage =
    totalMembers > 0 ? Math.round((presentMembers / totalMembers) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Dashboard Header & Event Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#2D7A3E" }}
          >
            System Overview
          </h2>
          <p className="text-gray-600 font-medium">
            Real-time attendance intelligence & controls
          </p>
        </div>

        <div className="relative">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
            Active Event Session
          </label>
          <div
            onClick={() => setIsEventSelectorOpen(!isEventSelectorOpen)}
            className="flex items-center justify-between w-full md:w-80 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-500 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#2D7A3E" }}
              >
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate uppercase tracking-wide">
                  {currentEvent
                    ? getEventName(currentEvent)
                    : "No active event"}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {currentEvent
                    ? getEventDate(currentEvent)
                    : "No active event"}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isEventSelectorOpen ? "rotate-180" : ""}`}
            />
          </div>

          <AnimatePresence>
            {isEventSelectorOpen && (
              <Motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50"
              >
                {activeEvents.length > 0 ? (
                  activeEvents.map((ev) => {
                    const isSelected =
                      currentEvent &&
                      getEventKey(currentEvent) === getEventKey(ev);

                    return (
                      <button
                        key={getEventKey(ev)}
                        onClick={() => {
                          setCurrentEvent(ev);
                          setIsEventSelectorOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-all mb-1 last:mb-0 ${
                          isSelected
                            ? "text-white border"
                            : "hover:bg-gray-50 text-gray-600"
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: "#2D7A3E",
                                borderColor: "#F2E416",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              isSelected ? "bg-white/20" : "bg-gray-100"
                            }`}
                          >
                            <Calendar
                              className={`w-3 h-3 ${
                                isSelected ? "text-white" : "text-gray-400"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold tracking-tight truncate">
                              {ev.eventName || ev.name}
                            </p>
                            <p className="text-xs font-medium opacity-60 uppercase">
                              {getEventDate(ev)} • {ev.status}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm font-bold text-gray-400">
                    No active event
                  </div>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -mr-12 -mt-12 group-hover:bg-gray-100 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  Registered
                </label>
                <h3 className="text-4xl font-bold text-gray-900 tracking-tight">
                  {totalMembers}
                </h3>
              </div>
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Users className="w-7 h-7 text-gray-900" />
              </div>
            </div>
            <div
              className="mt-4 flex items-center text-xs font-bold uppercase tracking-wider"
              style={{ color: "#2D7A3E" }}
            >
              <Activity className="w-3 h-3 mr-1" />
              +3 New this week
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group">
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 group-hover:opacity-80 transition-all duration-700"
            style={{ backgroundColor: "#2D7A3E", opacity: 0.1 }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wider mb-2 block"
                  style={{ color: "#2D7A3E", opacity: 0.6 }}
                >
                  Present
                </label>
                <h3
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: "#2D7A3E" }}
                >
                  {presentMembers}
                </h3>
              </div>
              <div
                className="w-14 h-14 border rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500"
                style={{
                  backgroundColor: "#2D7A3E",
                  opacity: 0.1,
                  borderColor: "#2D7A3E",
                  color: "#2D7A3E",
                }}
              >
                <CheckCircle2 className="w-7 h-7" />
              </div>
            </div>
            <div
              className="mt-4 flex items-center text-xs font-bold uppercase tracking-wider"
              style={{ color: "#2D7A3E" }}
            >
              <Clock className="w-3 h-3 mr-1" />
              Last Scan: Just now
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 group-hover:bg-red-100 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-red-600/60 uppercase tracking-wider mb-2 block">
                  Expected
                </label>
                <h3 className="text-4xl font-bold text-red-700 tracking-tight">
                  {absentMembers}
                </h3>
              </div>
              <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 text-red-600">
                <History className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-red-400 uppercase tracking-wider">
              Not yet checked in
            </div>
          </div>
        </div>

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #2D7A3E 0%, #163A1E 100%)",
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wider mb-2 block"
                  style={{ color: "#F2E416" }}
                >
                  Success Rate
                </label>
                <h3 className="text-4xl font-bold text-white tracking-tight">
                  {attendancePercentage}%
                </h3>
              </div>
              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 text-white/80">
                <Target className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-6 h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
              <Motion.div
                initial={{ width: 0 }}
                animate={{ width: `${attendancePercentage}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full rounded-full shadow-lg"
                style={{ backgroundColor: "#F2E416" }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Scanning Station */}
        <div className="lg:col-span-1">
          <div
            className="h-full border rounded-xl shadow-sm overflow-hidden flex flex-col"
            style={{ borderColor: "#2D7A3E", backgroundColor: "white" }}
          >
            <div
              className="p-6 border-b"
              style={{
                backgroundColor: "#2D7A3E",
                borderColor: "#2D7A3E",
                opacity: 0.1,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="font-bold uppercase tracking-wider"
                    style={{ color: "#2D7A3E" }}
                  >
                    Scanning Station
                  </h3>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: "#2D7A3E", opacity: 0.6 }}
                  >
                    Live Capture Terminal • v4.2
                  </p>
                </div>
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: "#2D7A3E" }}
                />
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {scanStatus.type === "idle" ? (
                  <Motion.div
                    key="idle"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="text-center space-y-8"
                  >
                    <div className="relative mx-auto w-48 h-48 flex items-center justify-center">
                      <div
                        className="absolute inset-0 border-4 border-dashed rounded-3xl animate-spin opacity-50"
                        style={{
                          borderColor: "#2D7A3E",
                          animationDuration: "20s",
                        }}
                      />
                      <div
                        className="absolute inset-4 border-2 rounded-2xl"
                        style={{
                          borderColor: "#2D7A3E",
                          opacity: 0.3,
                          animation: "spin 10s linear infinite reverse",
                        }}
                      />
                      <div
                        className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg group"
                        style={{ backgroundColor: "#2D7A3E", opacity: 0.1 }}
                      >
                        <QrCode
                          className="w-12 h-12 group-hover:scale-110 transition-transform duration-300"
                          style={{ color: "#2D7A3E" }}
                        />
                      </div>
                    </div>
                    <div>
                      <p
                        className="font-bold uppercase tracking-wider text-sm"
                        style={{ color: "#2D7A3E" }}
                      >
                        Verification Standby
                      </p>
                      <p className="text-gray-400 text-xs mt-2 max-w-[200px] mx-auto leading-relaxed uppercase font-bold tracking-tight opacity-60">
                        See if member is present
                      </p>
                    </div>
                  </Motion.div>
                ) : (
                  <Motion.div
                    key="status"
                    initial={{ opacity: 0, y: 30, scale: 0.5, rotateY: 90 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 1.5,
                      filter: "blur(20px)",
                      y: -50,
                    }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className={`text-center p-8 rounded-3xl border-4 shadow-xl relative overflow-hidden h-[340px] flex flex-col items-center justify-center ${
                      scanStatus.type === "success"
                        ? "border-green-200 shadow-green-200/50"
                        : "border-red-200 shadow-red-200/50"
                    }`}
                    style={
                      scanStatus.type === "success"
                        ? { backgroundColor: "#2D7A3E", opacity: 0.05 }
                        : { backgroundColor: "#fee2e2" }
                    }
                  >
                    {scanStatus.type === "success" && (
                      <Motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [1, 3], opacity: [0.3, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="absolute rounded-full w-40 h-40"
                        style={{ backgroundColor: "#2D7A3E" }}
                      />
                    )}
                    <Motion.div
                      className={`w-28 h-28 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-2xl relative z-10 ${
                        scanStatus.type === "success"
                          ? "text-white"
                          : "bg-red-500 text-white"
                      }`}
                      style={
                        scanStatus.type === "success"
                          ? { backgroundColor: "#2D7A3E" }
                          : {}
                      }
                      animate={
                        scanStatus.type === "success"
                          ? {
                              scale: [1, 1.3, 1],
                              rotate: [0, 10, -10, 0],
                            }
                          : {
                              x: [-15, 15, -15, 15, 0],
                              rotate: [-5, 5, -5, 5, 0],
                            }
                      }
                      transition={{ duration: 0.5 }}
                    >
                      {scanStatus.type === "success" ? (
                        <CheckCircle2 className="w-14 h-14" />
                      ) : (
                        <XCircle className="w-14 h-14" />
                      )}
                    </Motion.div>
                    <h3
                      className={`text-3xl font-bold uppercase tracking-tight leading-none mb-3 relative z-10 ${
                        scanStatus.type === "success"
                          ? "text-green-900"
                          : "text-red-900"
                      }`}
                    >
                      {scanStatus.message}
                    </h3>
                    {scanStatus.memberName && (
                      <Motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, type: "spring" }}
                        className="bg-white px-4 py-4 rounded-2xl shadow-lg border flex flex-col items-center min-w-[220px] relative z-10"
                        style={{ borderColor: "#2D7A3E" }}
                      >
                        <p
                          className="text-xl font-bold text-center uppercase tracking-tight"
                          style={{ color: "#2D7A3E" }}
                        >
                          {scanStatus.memberName}
                        </p>
                      </Motion.div>
                    )}
                  </Motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleManualScan} className="mt-12 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Enter Member ID or Name..."
                    className="h-16 w-full pl-14 pr-4 rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500 text-lg font-bold tracking-tight shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-14 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg"
                  style={{ backgroundColor: "#2D7A3E" }}
                >
                  Sync Entry Log
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between p-6">
              <div>
                <h3
                  className="font-bold uppercase tracking-wider"
                  style={{ color: "#2D7A3E" }}
                >
                  Recent Activity
                </h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">
                  Live stream of validated entries
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: "#2D7A3E" }}
                />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Real-time sync
                </span>
              </div>
            </div>
            <div className="p-0">
              <div className="overflow-x-auto min-w-full">
                <table className="min-w-full">
                  <thead className="bg-gray-50/30">
                    <tr className="border-b border-gray-100">
                      <th className="text-xs font-bold uppercase tracking-wider text-gray-400 py-4 px-6 text-left">
                        Timestamp
                      </th>
                      <th className="text-xs font-bold uppercase tracking-wider text-gray-400 px-6 text-left">
                        Member
                      </th>
                      <th className="text-xs font-bold uppercase tracking-wider text-gray-400 px-6 text-left">
                        Event
                      </th>
                      <th className="text-xs font-bold uppercase tracking-wider text-gray-400 px-6 text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {attendanceLogs.slice(0, 5).map((log) => (
                        <Motion.tr
                          key={getAttendanceLogId(log)}
                          initial={{
                            opacity: 0,
                            y: -20,
                            backgroundColor: "rgba(45, 122, 62, 0.1)",
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            backgroundColor: "rgba(255, 255, 255, 0)",
                          }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.5 }}
                          className="border-b border-gray-50 last:border-0 relative"
                        >
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-gray-300" />
                              <span className="text-xs font-bold text-gray-500">
                                {(() => {
                                  const logTime = getAttendanceLogTime(log);
                                  return logTime
                                    ? formatTime(logTime)
                                    : "No time";
                                })()}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                                style={{ backgroundColor: "#2D7A3E" }}
                              >
                                {getAttendanceLogMemberName(log)
                                  .split(" ")
                                  .map((n) => n[0] || "")
                                  .join("")
                                  .toUpperCase() || "?"}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-gray-900 block leading-none">
                                  {getAttendanceLogMemberName(log)}
                                </span>
                                <span
                                  className="text-xs font-bold uppercase mt-0.5 block tracking-wider animate-pulse"
                                  style={{ color: "#2D7A3E" }}
                                >
                                  Just Recorded
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-500 italic">
                              "{getAttendanceLogEventName(log)}"
                            </span>
                          </td>
                          <td className="text-right px-6 whitespace-nowrap">
                            {(() => {
                              const statusMeta = getAttendanceStatusMeta(
                                getAttendanceLogStatus(log),
                              );

                              return (
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full mr-2 ${statusMeta.dotClass}`}
                                  />
                                  {statusMeta.label}
                                </span>
                              );
                            })()}
                          </td>
                        </Motion.tr>
                      ))}
                    </AnimatePresence>
                    {attendanceLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12">
                          <p className="text-gray-400 text-sm font-medium">
                            No activity recorded for this session.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
