import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ChevronDown,
  Calendar,
  Users,
  Zap,
  HelpCircle,
  X,
  XCircle,
  Info,
  PieChart as PieChartIcon,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { ChartContainer } from "../../ui/chart";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { attendanceAPI, eventAPI, memberAPI } from "../../../services/api";
import jsQR from "jsqr";
import { formatDate, formatTime, formatDateTime } from "../../../utils/date";

const AVATAR_COLORS = [
  { bg: "bg-green-100", text: "text-green-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
];

const getAvatarColor = (name = "") => {
  const code = name.trim().charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const METRIC_TONE = {
  green: "bg-green-50 border-green-100 text-coop-green",
  amber: "bg-amber-50 border-amber-100 text-amber-600",
  slate: "bg-slate-50 border-slate-100 text-slate-500",
};

const MetricTile = ({ icon: Icon, value, label, tone = "slate" }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
    <div
      className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${METRIC_TONE[tone]}`}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  </div>
);

export default function QRScanner({
  user,
  onScanSuccess,
  events: initialEvents = [],
  onStatusChange,
  onViewAll,
}) {
  const [events, setEvents] = useState(initialEvents);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready to scan");
  const [selectedEventId, setSelectedEventId] = useState(
    initialEvents[0]?.eventId || "",
  );
  const [scanHistory, setScanHistory] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState("");
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [eventStats, setEventStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastStatsUpdate, setLastStatsUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // Brief on-camera flash shown right after a code is processed —
  // null | 'success' | 'duplicate' | 'invalid'. Mirrors the playScanSound
  // outcomes so the visual and audio feedback always agree.
  const [scanFeedback, setScanFeedback] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const scanFeedbackTimeoutRef = useRef(null);
  const detectorRef = useRef(null);
  const lastValueRef = useRef("");
  const isProcessingRef = useRef(false);
  const scanCooldownRef = useRef(null);
  // Timestamp (Date.now()-based) until which the scan loop skips decoding
  // entirely. The camera frame the code was just read from is usually still
  // in view for the next several frames (or longer, if it's held there) —
  // without this, that same still-visible code gets re-detected and
  // re-processed on every single animation frame.
  const pauseDetectionUntilRef = useRef(0);

  const activeEventCount = Array.isArray(events)
    ? events.filter((event) => event?.status === "active").length
    : 0;
  const hasActiveEvent = activeEventCount > 0;

  useEffect(() => {
    setEvents(initialEvents);
    if (!selectedEventId && initialEvents?.length > 0) {
      setSelectedEventId(initialEvents[0].eventId);
    }
  }, [initialEvents, selectedEventId]);

  useEffect(() => {
    if (!isScanning) {
      setStatusMessage(
        hasActiveEvent ? "Ready to scan" : "Scanner is on standby.",
      );
    }
  }, [hasActiveEvent, isScanning]);

  const fetchActiveEvents = useCallback(async () => {
    try {
      const response = await eventAPI.getAllEvents();
      const allEvents = Array.isArray(response?.events) ? response.events : [];
      const activeEvents = allEvents.filter(
        (event) => event.status === "active",
      );
      setEvents(activeEvents);
      if (!selectedEventId && activeEvents.length > 0) {
        setSelectedEventId(activeEvents[0].eventId);
      }
    } catch (err) {
      console.error("Error fetching active events:", err);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (!initialEvents?.length) {
      fetchActiveEvents();
    }
  }, [initialEvents, fetchActiveEvents]);

  useEffect(() => {
    let isMounted = true;

    const fetchMembers = async () => {
      setLoadingMembers(true);
      setMemberLoadError("");

      try {
        const response = await memberAPI.getAllMembers();
        const memberList = Array.isArray(response?.members)
          ? response.members
          : Array.isArray(response)
            ? response
            : [];

        if (isMounted) {
          setMembers(memberList);
        }
      } catch (err) {
        if (isMounted) {
          setMemberLoadError(
            err?.response?.data?.message ||
              err?.message ||
              "Unable to load members.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };

    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live attendance stats (Total Members / Present / Pending) for the selected event
  const refreshStats = useCallback(async (eventId) => {
    if (!eventId) return;
    setStatsLoading(true);
    try {
      const response = await attendanceAPI.getAttendanceStats(eventId);
      setEventStats({
        totalMembers: Number(response?.totalMembers) || 0,
        presentCount: Number(response?.presentCount) || 0,
      });
      setLastStatsUpdate(new Date());
    } catch (err) {
      console.error("Error fetching attendance stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      refreshStats(selectedEventId);
    } else {
      setEventStats(null);
    }
  }, [selectedEventId, refreshStats]);

  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return undefined;
    const interval = setInterval(() => {
      refreshStats(selectedEventId);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEventId, refreshStats]);

  // Flashes a colored ring + icon over the camera viewport for ~900ms.
  const triggerScanFeedback = useCallback((type) => {
    setScanFeedback(type);
    if (scanFeedbackTimeoutRef.current) {
      clearTimeout(scanFeedbackTimeoutRef.current);
    }
    scanFeedbackTimeoutRef.current = setTimeout(() => {
      setScanFeedback(null);
      scanFeedbackTimeoutRef.current = null;
    }, 900);
  }, []);

  const stopScanning = useCallback(() => {
    // Stop the animation frame loop first
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Update stateRef immediately
    stateRef.current.isScanning = false;
    pauseDetectionUntilRef.current = 0;

    if (scanCooldownRef.current) {
      clearTimeout(scanCooldownRef.current);
      scanCooldownRef.current = null;
    }

    if (scanFeedbackTimeoutRef.current) {
      clearTimeout(scanFeedbackTimeoutRef.current);
      scanFeedbackTimeoutRef.current = null;
    }
    setScanFeedback(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setFlashOn(false);
    setFlashSupported(false);
    setStatusMessage("Ready to scan");
    if (typeof onStatusChange === "function") onStatusChange(false);
  }, [onStatusChange]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const toggleFlash = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;

    try {
      const next = !flashOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setFlashOn(next);
    } catch (err) {
      console.warn("Unable to toggle flash:", err);
      setError("Flash isn't supported on this device.");
    }
  }, [flashOn]);

  const supportsBarcodeDetector = () =>
    typeof window !== "undefined" && "BarcodeDetector" in window;

  const playScanSound = useCallback((type) => {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext || null;
    if (!AudioContextClass) return;

    try {
      const audioContext = new AudioContextClass();
      const now = audioContext.currentTime;
      const patterns = {
        success: [
          { frequency: 880, start: 0, duration: 0.12 },
          { frequency: 1320, start: 0.14, duration: 0.14 },
        ],
        duplicate: [
          { frequency: 220, start: 0, duration: 0.18 },
          { frequency: 220, start: 0.2, duration: 0.18 },
        ],
        invalid: [
          { frequency: 440, start: 0, duration: 0.18 },
          { frequency: 330, start: 0.2, duration: 0.22 },
        ],
      };

      const tones = patterns[type];
      if (!tones) {
        audioContext.close();
        return;
      }

      tones.forEach(({ frequency, start, duration }) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.0001;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.exponentialRampToValueAtTime(0.18, now + start + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          now + start + duration,
        );

        oscillator.start(now + start);
        oscillator.stop(now + start + duration + 0.02);
      });

      window.setTimeout(() => {
        audioContext.close().catch(() => {});
      }, 1000);
    } catch (error) {
      console.warn("Unable to play scan sound:", error);
    }
  }, []);

  const normalizedMembers = useMemo(
    () =>
      (Array.isArray(members) ? members : []).map((member) => ({
        raw: member,
        memberId: String(member?.memberId || member?.id || "").trim(),
        qrCode: String(member?.qrCode || "").trim(),
        name: String(member?.memberName || member?.name || "Unknown member"),
        barangay: String(member?.barangay || member?.barangayName || ""),
      })),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return normalizedMembers.slice(0, 10);

    return normalizedMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(query) ||
        member.memberId.toLowerCase().includes(query) ||
        member.qrCode.toLowerCase().includes(query)
      );
    });
  }, [memberSearch, normalizedMembers]);

  // Store current state in refs to avoid dependency issues in requestAnimationFrame loop
  const stateRef = useRef({
    isScanning: false,
    isProcessing: false,
    events: [],
    selectedEventId: "",
    user: null,
  });

  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = {
      isScanning,
      isProcessing: isProcessingRef.current,
      events,
      selectedEventId,
      user,
    };
  }, [isScanning, events, selectedEventId, user]);

  const handleDetectedCode = useCallback(
    async (rawValue) => {
      let memberId = rawValue?.toString().trim();
      let qrPayload = null;

      if (memberId) {
        try {
          const parsed = JSON.parse(memberId);
          if (parsed && typeof parsed === "object") {
            qrPayload = parsed;
            memberId =
              parsed.memberId || parsed.qrCode || parsed.qrId || memberId;
          }
        } catch {
          // Not JSON, treat as plain member ID.
        }
      }

      if (!memberId) {
        return;
      }

      if (isProcessingRef.current) {
        setStatusMessage("Processing previous scan, please wait...");
        return;
      }

      if (memberId === lastValueRef.current && scanCooldownRef.current) {
        // lastValueRef is only ever set after a genuine successful scan (see
        // the success branch below), so reaching here always means: this
        // exact code was already recorded a moment ago and is still sitting
        // in front of the camera. That's not an error, so no red alert box —
        // just a calm status update, and a longer breather before the loop
        // looks again so this doesn't repeat every single frame.
        setError("");
        setStatusMessage("Already recorded — move to the next member.");
        playScanSound("duplicate");
        triggerScanFeedback("duplicate");
        pauseDetectionUntilRef.current = Date.now() + 1500;
        return;
      }

      isProcessingRef.current = true;
      setStatusMessage("QR code detected, processing...");
      setError("");

      const {
        events: currentEvents,
        selectedEventId: currentEventId,
        user: currentUser,
      } = stateRef.current;
      const activeEvent =
        currentEvents.find((event) => event.eventId === currentEventId) ||
        currentEvents[0];

      if (!activeEvent) {
        setError("Select an active event before scanning member QR codes.");
        setStatusMessage("Ready to scan");
        isProcessingRef.current = false;
        pauseDetectionUntilRef.current = Date.now() + 1500;
        playScanSound("invalid");
        triggerScanFeedback("invalid");
        return;
      }

      const scannedBy =
        currentUser?.name || currentUser?.username || "Scanner Operator";

      try {
        const result = await attendanceAPI.recordAttendance(
          memberId,
          activeEvent.eventId,
          new Date().toISOString(),
          scannedBy,
        );

        const attendance = result?.attendance || {
          memberId,
          eventId: activeEvent.eventId,
          eventName: activeEvent.eventName,
          scanTime: new Date().toISOString(),
          memberName: qrPayload?.name,
          barangay: qrPayload?.barangay,
          qrCode: qrPayload?.qrCode,
        };

        lastValueRef.current = memberId;
        if (scanCooldownRef.current) {
          clearTimeout(scanCooldownRef.current);
        }
        scanCooldownRef.current = setTimeout(() => {
          lastValueRef.current = "";
          scanCooldownRef.current = null;
        }, 4000);

        setScanResult(attendance);
        setScanHistory((prev) => [attendance, ...prev].slice(0, 5));
        setError("");
        setStatusMessage("Attendance recorded successfully.");
        playScanSound("success");
        triggerScanFeedback("success");
        refreshStats(activeEvent.eventId);

        if (onScanSuccess) {
          onScanSuccess(attendance);
        }
      } catch (err) {
        const apiMessage =
          err.response?.data?.message ||
          err.message ||
          "Unable to record attendance.";
        let message = apiMessage;
        let status = "Scan failed. Try again.";

        if (apiMessage.includes("Member not found")) {
          message = "This QR code is not registered to a member.";
          status = "Invalid member QR code.";
          playScanSound("invalid");
          triggerScanFeedback("invalid");
        } else if (apiMessage.includes("already marked present")) {
          message = "Member already marked present for this event.";
          status = "Duplicate scan prevented.";
          playScanSound("duplicate");
          triggerScanFeedback("duplicate");
        } else {
          playScanSound("invalid");
          triggerScanFeedback("invalid");
        }

        setError(message);
        setStatusMessage(status);
      } finally {
        isProcessingRef.current = false;
        // Give the operator a beat to move the code away before the loop
        // starts decoding frames again — covers success and every error
        // path here, so nothing gets re-processed while still in view.
        pauseDetectionUntilRef.current = Date.now() + 1500;
      }
    },
    [onScanSuccess, playScanSound, refreshStats, triggerScanFeedback],
  );

  const handleManualMemberAdd = useCallback(
    (member) => {
      const memberId = member?.memberId;
      if (!memberId) {
        setError("Selected member does not have a member ID.");
        playScanSound("invalid");
        return;
      }

      handleDetectedCode(memberId);
    },
    [handleDetectedCode, playScanSound],
  );

  const scanLoop = () => {
    // Schedule next frame immediately
    animationRef.current = requestAnimationFrame(scanLoop);

    if (!videoRef.current || !stateRef.current.isScanning) {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    if (Date.now() < pauseDetectionUntilRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!canvas || !video) {
      return;
    }

    // Check if video has data to read
    if (
      video.readyState !== video.HAVE_FUTURE_DATA &&
      video.readyState !== video.HAVE_ENOUGH_DATA
    ) {
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Try jsQR first (synchronous and more reliable)
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData && imageData.data) {
          const code = jsQR(imageData.data, canvas.width, canvas.height);
          if (code && code.data) {
            console.log("✓ QR Code detected:", code.data);
            handleDetectedCode(code.data);
            return;
          }
        }
      } catch (jsqrErr) {
        console.debug("jsQR scan attempt:", jsqrErr.message);
      }

      // Try BarcodeDetector API as secondary (non-blocking)
      if (supportsBarcodeDetector() && detectorRef.current) {
        detectorRef.current
          .detect(canvas)
          .then((barcodes) => {
            if (
              barcodes &&
              barcodes.length > 0 &&
              stateRef.current.isScanning &&
              !isProcessingRef.current
            ) {
              for (const barcode of barcodes) {
                if (barcode.rawValue) {
                  console.log(
                    "✓ QR Code detected (BarcodeDetector):",
                    barcode.rawValue,
                  );
                  handleDetectedCode(barcode.rawValue);
                  break;
                }
              }
            }
          })
          .catch(() => {
            // BarcodeDetector error - ignore
          });
      }
    } catch (err) {
      console.warn("Scan loop error:", err);
    }
  };

  const startScanning = async () => {
    if (!selectedEventId || !events?.length) {
      setError(
        "No active event selected. Please select or create an active event before scanning.",
      );
      setStatusMessage("Select an active event to scan.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported by this browser.");
      return;
    }

    setError("");
    setStatusMessage("Requesting camera access...");

    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      } catch {
        setError("Camera access denied. Please allow camera permissions.");
        setStatusMessage("Ready to scan");
        setIsScanning(false);
        return;
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      videoRef.current.style.display = "block";
      videoRef.current.style.visibility = "visible";
      streamRef.current = stream;

      const track = stream.getVideoTracks?.()[0];
      const capabilities = track?.getCapabilities?.();
      setFlashSupported(Boolean(capabilities?.torch));
      setFlashOn(false);

      const setupVideo = () => {
        return new Promise((resolve) => {
          const checkReady = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              // readyState >= 2 means HAVE_CURRENT_DATA
              // Update stateRef BEFORE calling scanLoop to avoid timing issues
              stateRef.current.isScanning = true;
              setIsScanning(true);
              if (typeof onStatusChange === "function") onStatusChange(true);
              setStatusMessage("Scanning for QR codes...");
              // Now start the scan loop with isScanning already true in stateRef
              scanLoop();
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      };

      try {
        videoRef.current.play().catch(() => {
          // Autoplay might be blocked, continue anyway
        });
        await setupVideo();
      } catch (err) {
        console.error("Error setting up video:", err);
      }
    }

    if (supportsBarcodeDetector()) {
      try {
        detectorRef.current = new window.BarcodeDetector({
          formats: ["qr_code"],
        });
      } catch (err) {
        console.warn("BarcodeDetector not available:", err);
        detectorRef.current = null;
      }
    } else {
      detectorRef.current = null;
      setStatusMessage(
        "Scanning with software fallback; align the QR code in view.",
      );
    }
  };

  const recentScansDisplay = scanHistory.map((record, index) => ({
    id: index + 1,
    memberName: record.memberName || record.name || "Unknown member",
    memberId: record.memberId || "",
    time: record.scanTime ? formatTime(record.scanTime) : "Now",
    barangay: record.barangay || "N/A",
  }));

  const selectedEvent =
    events.find((event) => event.eventId === selectedEventId) ||
    events[0] ||
    null;

  const totalMembers = eventStats?.totalMembers ?? 0;
  const presentCount = eventStats?.presentCount ?? 0;
  const pendingCount = Math.max(totalMembers - presentCount, 0);
  const presentPct =
    totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;
  const hasStatsData = totalMembers > 0;

  const summaryData = [
    { key: "present", label: "Present", value: presentCount, color: "#2D7A3E" },
    { key: "pending", label: "Pending", value: pendingCount, color: "#f59e0b" },
  ];
  const chartConfig = {
    present: { label: "Present", color: "#2D7A3E" },
    pending: { label: "Pending", color: "#f59e0b" },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Scan Member QR Code
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Point your phone's camera at a member's QR code to record
            attendance.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${
            hasActiveEvent
              ? "bg-green-50 text-coop-green border-green-200"
              : "bg-amber-50 text-amber-600 border-amber-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${hasActiveEvent ? "bg-coop-green" : "bg-amber-500"}`}
          />
          {statusMessage}
        </span>
      </div>

      {/* Active Event */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-coop-green" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {selectedEvent ? "Active Event" : "No Active Event"}
              </p>
              {selectedEvent ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {selectedEvent.eventName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {[
                      selectedEvent.eventDate
                        ? formatDate(selectedEvent.eventDate)
                        : "",
                      selectedEvent.eventTime || "",
                      selectedEvent.location || "",
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-500">
                  Select an event to start scanning
                </p>
              )}
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowEventMenu((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:border-coop-green hover:text-coop-green transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Change Event
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showEventMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showEventMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowEventMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                  {events.length > 0 ? (
                    events.map((event) => (
                      <button
                        key={event.eventId}
                        type="button"
                        onClick={() => {
                          setSelectedEventId(event.eventId);
                          setShowEventMenu(false);
                          setError("");
                          setStatusMessage("Ready to scan");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          event.eventId === selectedEventId
                            ? "bg-green-50 text-coop-green font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {event.eventName}
                        {event.eventDate
                          ? ` • ${formatDate(event.eventDate)}`
                          : ""}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-xs text-slate-400">
                      No active events
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner + stats - primary focus */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-100 p-4 sm:p-5 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-coop-green" />
                Scanner
              </CardTitle>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleFlash}
                  disabled={!isScanning || !flashSupported}
                  title={
                    !isScanning
                      ? "Start scanning to use flash"
                      : !flashSupported
                        ? "Flash isn't supported on this device"
                        : undefined
                  }
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    flashOn
                      ? "text-coop-green"
                      : "text-slate-500 hover:text-coop-green"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Flash
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelp((prev) => !prev)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                    showHelp
                      ? "text-coop-green"
                      : "text-slate-500 hover:text-coop-green"
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Help
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
              {showHelp && (
                <div className="relative rounded-lg border border-green-200 bg-green-50 p-4">
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    aria-label="Close help"
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-xs font-bold text-coop-darkGreen mb-2">
                    How to scan
                  </p>
                  <ol className="space-y-1.5 text-xs text-slate-600 list-decimal list-inside">
                    <li>Tap "Start Scanning" to turn on the camera.</li>
                    <li>Point the camera at the member's QR code.</li>
                    <li>
                      Wait for the automatic confirmation — no need to tap
                      anything else.
                    </li>
                  </ol>
                </div>
              )}

              {/* Camera viewport */}
              <div className="mx-auto w-full max-w-sm">
                <div className="aspect-square bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {!isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white/80">
                        <QrCode className="w-14 h-14 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-semibold">Camera ready</p>
                        <p className="text-xs opacity-60 mt-1">
                          Point at a member's QR code within the frame
                        </p>
                      </div>
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/70 rounded-xl relative overflow-hidden">
                        <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-2 border-l-2 border-coop-green rounded-tl-lg"></div>
                        <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-2 border-r-2 border-coop-green rounded-tr-lg"></div>
                        <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-2 border-l-2 border-coop-green rounded-bl-lg"></div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-2 border-r-2 border-coop-green rounded-br-lg"></div>

                        {/* Sweeping scan line — plays while actively
                            searching, pauses during the result flash below */}
                        {!scanFeedback && (
                          <Motion.div
                            className="absolute left-1 right-1 h-1 rounded-full bg-linear-to-r from-transparent via-coop-green to-transparent"
                            style={{ boxShadow: "0 0 8px 2px rgba(45,122,62,0.7)" }}
                            animate={{ y: [8, 176, 8] }}
                            transition={{
                              duration: 2.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Result flash — brief colored pulse + icon the instant a
                      code finishes processing (success / duplicate / invalid) */}
                  <AnimatePresence>
                    {scanFeedback && (
                      <Motion.div
                        key={scanFeedback}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                          scanFeedback === "success"
                            ? "bg-coop-green/25"
                            : scanFeedback === "duplicate"
                              ? "bg-amber-500/25"
                              : "bg-red-600/25"
                        }`}
                      >
                        <Motion.div
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 18 }}
                          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                            scanFeedback === "success"
                              ? "bg-coop-green"
                              : scanFeedback === "duplicate"
                                ? "bg-amber-500"
                                : "bg-red-600"
                          }`}
                        >
                          {scanFeedback === "success" ? (
                            <CheckCircle2 className="w-11 h-11 text-white" />
                          ) : scanFeedback === "duplicate" ? (
                            <Clock className="w-11 h-11 text-white" />
                          ) : (
                            <XCircle className="w-11 h-11 text-white" />
                          )}
                        </Motion.div>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Start / Stop */}
              {!isScanning ? (
                <Button
                  onClick={startScanning}
                  disabled={!selectedEventId}
                  className={`w-full rounded-lg font-semibold py-3.5 text-base flex items-center justify-center gap-2 shadow-sm transition-colors ${
                    selectedEventId
                      ? "bg-coop-green hover:bg-coop-darkGreen text-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Camera className="w-5 h-5" />
                  Start Scanning
                </Button>
              ) : (
                <Button
                  onClick={stopScanning}
                  className="w-full rounded-lg font-semibold py-3.5 text-base border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                >
                  Stop Scanning
                </Button>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5">
                <Info className="w-4 h-4 text-coop-green shrink-0" />
                <p className="text-xs text-coop-darkGreen font-medium">
                  Hold the phone steady — attendance is recorded
                  automatically once the code is detected.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Success */}
              {scanResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-coop-green" />
                    <p className="text-sm font-bold text-coop-darkGreen">
                      Attendance recorded
                    </p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Member</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {scanResult.memberName || scanResult.memberId}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Event</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {scanResult.eventName}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Time</span>
                      <span className="font-medium text-slate-700 text-right">
                        {scanResult.scanTime || scanResult.timestamp
                          ? formatDateTime(
                              scanResult.scanTime || scanResult.timestamp,
                            )
                          : "Recorded"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <MetricTile
              icon={Users}
              value={totalMembers}
              label="Total Members"
              tone="slate"
            />
            <MetricTile
              icon={CheckCircle2}
              value={presentCount}
              label="Present"
              tone="green"
            />
            <MetricTile
              icon={Clock}
              value={pendingCount}
              label="Pending"
              tone="amber"
            />
          </div>
        </div>

        {/* Recent Scans + Session Summary */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white h-fit">
            <CardHeader className="border-b border-slate-100 p-5 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-coop-green" />
                  Recent Scans
                </CardTitle>
                <p className="text-slate-400 text-xs mt-1">This session</p>
              </div>
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className="border border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                >
                  View All
                </button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {recentScansDisplay.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {recentScansDisplay.map((scan) => {
                    const avatar = getAvatarColor(scan.memberName);
                    return (
                      <div key={scan.id} className="flex items-center gap-3 p-4">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${avatar.bg} ${avatar.text}`}
                        >
                          {getInitials(scan.memberName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {scan.memberName}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {scan.memberId
                              ? `Member ID: ${scan.memberId}`
                              : scan.barangay}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs text-slate-400">
                            {scan.time}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-coop-green border border-green-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Scanned
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                  <Clock className="w-7 h-7 text-slate-300" />
                  <p className="text-sm font-medium">No scans yet</p>
                  <p className="text-xs">Scanned members will appear here</p>
                </div>
              )}
            </CardContent>
            {onViewAll && recentScansDisplay.length > 0 && (
              <div className="p-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={onViewAll}
                  className="text-xs font-semibold text-coop-green hover:text-coop-darkGreen"
                >
                  View all recent scans
                </button>
              </div>
            )}
          </Card>

          {/* Session Summary */}
          <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-100 p-5">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-coop-green" />
                Session Summary
              </CardTitle>
              <p className="text-slate-400 text-xs mt-1">
                Live attendance for this event
              </p>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 shrink-0">
                  <ChartContainer
                    config={chartConfig}
                    className="w-full h-full aspect-square"
                  >
                    <PieChart>
                      <Pie
                        data={
                          hasStatsData
                            ? summaryData
                            : [{ key: "empty", label: "No data", value: 1 }]
                        }
                        dataKey="value"
                        nameKey="label"
                        innerRadius={38}
                        outerRadius={54}
                        stroke="none"
                      >
                        {(hasStatsData
                          ? summaryData
                          : [{ key: "empty", color: "#e2e8f0" }]
                        ).map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-slate-900">
                      {hasStatsData ? `${presentPct}%` : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2.5">
                  {summaryData.map((entry) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between text-sm gap-2"
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate">{entry.label}</span>
                      </span>
                      <span className="text-slate-400 font-medium shrink-0">
                        {entry.value}
                        {hasStatsData
                          ? ` (${Math.round((entry.value / totalMembers) * 100)}%)`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {statsLoading
                    ? "Updating…"
                    : lastStatsUpdate
                      ? `Last updated: ${formatTime(lastStatsUpdate)}`
                      : "Not yet updated"}
                </p>
                <button
                  type="button"
                  onClick={() => setAutoRefresh((prev) => !prev)}
                  aria-pressed={autoRefresh}
                  aria-label="Toggle auto-refresh"
                  title="Auto-refresh"
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                    autoRefresh ? "bg-coop-green" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      autoRefresh ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual lookup - secondary, collapsed by default so scanning stays the focus */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setShowManualLookup((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-coop-green" />
            <div>
              <p className="text-sm font-bold text-slate-900">
                Can't scan? Search manually
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                Find a member by name or ID instead
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${showManualLookup ? "rotate-180" : ""}`}
          />
        </button>

        {showManualLookup && (
          <CardContent className="p-5 pt-0 space-y-4 border-t border-slate-100">
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by member name or ID..."
              className="rounded-lg border-slate-200"
            />

            {memberLoadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {memberLoadError}
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {loadingMembers ? (
                <div className="rounded-lg bg-slate-50 p-5 text-center text-sm font-medium text-slate-500">
                  Loading members...
                </div>
              ) : filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <div
                    key={member.memberId || member.qrCode || member.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:border-coop-green hover:bg-green-50/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ID: {member.memberId || "N/A"}
                        {member.barangay ? ` • ${member.barangay}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleManualMemberAdd(member)}
                      disabled={!selectedEventId}
                      className="shrink-0 rounded-lg bg-coop-green hover:bg-coop-darkGreen text-white text-xs font-semibold px-3 py-2"
                    >
                      Add
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-lg bg-slate-50 p-5 text-center text-sm font-medium text-slate-500">
                  {memberSearch.trim()
                    ? "No matching members found."
                    : "Start typing to search members."}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
