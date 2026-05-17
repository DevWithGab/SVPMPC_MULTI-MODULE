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
  Scan,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { attendanceAPI, eventAPI, memberAPI } from "../../../services/api";
import jsQR from "jsqr";
import { formatDate, formatTime, formatDateTime } from "../../../utils/date";

export default function QRScanner({
  user,
  onScanSuccess,
  events: initialEvents = [],
  onStatusChange,
}) {
  const [events, setEvents] = useState(initialEvents);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready to scan");
  const [lastScan, setLastScan] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(
    initialEvents[0]?.eventId || "",
  );
  const [scanHistory, setScanHistory] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const detectorRef = useRef(null);
  const lastValueRef = useRef("");
  const isProcessingRef = useRef(false);
  const scanCooldownRef = useRef(null);

  const activeEventCount = Array.isArray(events)
    ? events.filter((event) => event?.status === "active").length
    : 0;
  const hasActiveEvent = activeEventCount > 0;
  const scannerStatusLabel = hasActiveEvent ? "Ready" : "Standby";
  const scannerStatusMessage = hasActiveEvent
    ? "Active event detected. Scanner is ready to record attendance."
    : "No active event available. Scanner is on standby.";

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

  const stopScanning = useCallback(() => {
    // Stop the animation frame loop first
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Update stateRef immediately
    stateRef.current.isScanning = false;

    if (scanCooldownRef.current) {
      clearTimeout(scanCooldownRef.current);
      scanCooldownRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setStatusMessage("Ready to scan");
    if (typeof onStatusChange === "function") onStatusChange(false);
  }, [onStatusChange]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

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
        setError(
          "Repeated scan blocked. Move the camera away and try another code.",
        );
        setStatusMessage("Duplicate scan prevented.");
        playScanSound("duplicate");
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
        playScanSound("invalid");
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
        setLastScan(attendance);
        setScanHistory((prev) => [attendance, ...prev].slice(0, 5));
        setError("");
        setStatusMessage("Attendance recorded successfully.");
        playScanSound("success");

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
        } else if (apiMessage.includes("already marked present")) {
          message = "Member already marked present for this event.";
          status = "Duplicate scan prevented.";
          playScanSound("duplicate");
        } else {
          playScanSound("invalid");
        }

        setError(message);
        setStatusMessage(status);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onScanSuccess, playScanSound],
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

  const recentScansDisplay = scanHistory.length
    ? scanHistory.map((record, index) => ({
        id: index + 1,
        memberName: record.memberName || record.name || "Unknown member",
        qrCode: record.qrCode || record.memberId || "N/A",
        date: record.scanTime ? formatDate(record.scanTime) : "Now",
        time: record.scanTime ? formatTime(record.scanTime) : "Now",
        barangay: record.barangay || "N/A",
      }))
    : [
        {
          id: 1,
          memberName: "No scans yet",
          qrCode: "Waiting for a scan",
          date: "",
          time: "",
          barangay: "",
        },
      ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-950 tracking-tight leading-tight">QR Scanner</h2>
          <p className="text-slate-500 text-xs font-extrabold uppercase tracking-widest mt-2">Scan member QR codes to record attendance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-3 border border-slate-200 shadow-sm">
            <p className="text-xs uppercase tracking-widest font-extrabold text-slate-600 mb-1">Status</p>
            <p className={`text-sm font-black ${hasActiveEvent ? 'text-emerald-700' : 'text-amber-700'}`}>{statusMessage}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Scanner Section */}
        <div className="lg:col-span-2 space-y-8">
          {/* Scanner Card */}
          <div className="border border-slate-200/60 bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <QrCode className="w-6 h-6 text-emerald-600" />
                    Scanner Interface
                  </h3>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mt-1">Point your camera at the member QR code</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              {/* Event Selection */}
              <div>
                <label className="block text-sm font-extrabold text-slate-700 mb-3 uppercase tracking-widest">Select Active Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setError("");
                    setStatusMessage("Ready to scan");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-slate-900 font-semibold shadow-sm focus:bg-white focus:border-emerald-300 focus:ring-emerald-100/20 focus:ring-2 transition-all"
                >
                  {events?.length > 0 ? (
                    events.map((event) => (
                      <option key={event.eventId} value={event.eventId}>
                        {event.eventName}{" "}
                        {event.eventDate
                          ? `(${formatDate(event.eventDate)})`
                          : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">No active events</option>
                  )}
                </select>
              </div>

              {/* Scanner Display */}
              <div className="relative">
                <div className="aspect-square max-w-md mx-auto bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl border-2 border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {!isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                      <div className="text-center text-white">
                        <QrCode className="w-20 h-20 mx-auto mb-4 opacity-30" />
                        <p className="text-xl font-black mb-2">Camera Ready</p>
                        <p className="text-sm opacity-60">Tap start to begin scanning</p>
                      </div>
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 border-4 border-emerald-400 rounded-3xl relative shadow-2xl">
                        <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-emerald-300 rounded-tl-2xl"></div>
                        <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-emerald-300 rounded-tr-2xl"></div>
                        <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-emerald-300 rounded-bl-2xl"></div>
                        <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-emerald-300 rounded-br-2xl"></div>
                        <div className="absolute inset-x-6 top-1/2 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                {!isScanning ? (
                  <Button
                    onClick={startScanning}
                    disabled={!selectedEventId}
                    className={`flex-1 sm:flex-none rounded-2xl font-black px-8 py-4 transition-all duration-300 flex items-center justify-center gap-2 text-white shadow-lg ${
                      selectedEventId
                        ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:shadow-emerald-300/50 hover:scale-105 cursor-pointer"
                        : "bg-slate-300 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    className="flex-1 sm:flex-none rounded-2xl font-black px-8 py-4 border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition-all duration-300"
                  >
                    Stop Scanning
                  </Button>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-5 bg-red-50/80 border border-red-200 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 font-bold text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {scanResult && (
                <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl animate-in slide-in-from-top">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <h3 className="text-lg font-black text-emerald-900">Attendance Recorded!</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-700">Member ID:</span>
                      <span className="text-slate-900 font-black">{scanResult.memberId}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-700">Event:</span>
                      <span className="text-slate-900 font-black">{scanResult.eventName}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-700">Time:</span>
                      <span className="text-slate-900 font-semibold">
                        {scanResult.scanTime || scanResult.timestamp
                          ? formatDateTime(scanResult.scanTime || scanResult.timestamp)
                          : "Recorded"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Member Lookup */}
          <div className="border border-slate-200/60 bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Search className="w-6 h-6 text-blue-600" />
                Manual Member Lookup
              </h3>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mt-1">Search by name or ID and add manually</p>
            </div>
            <div className="p-8 space-y-4">
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by member name, ID, or QR code..."
                className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-300 font-semibold"
              />

              {memberLoadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
                  {memberLoadError}
                </div>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loadingMembers ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                    Loading members...
                  </div>
                ) : filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <div
                      key={member.memberId || member.qrCode || member.name}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-900">{member.name}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-2">ID: {member.memberId || "N/A"}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-1">Brgy: {member.barangay || "N/A"}</p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleManualMemberAdd(member)}
                          className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 shadow-sm hover:shadow-md transition-all"
                          disabled={!selectedEventId}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                    {memberSearch.trim()
                      ? "No matching members found."
                      : "Start typing to search members."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Status & Recent Scans */}
        <div className="space-y-6">
          {/* Scanner Status */}
          <div className="border border-slate-200/60 bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                Status
              </h3>
            </div>
            <div className="p-6 text-center space-y-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${hasActiveEvent ? "bg-emerald-100" : "bg-amber-100"}`}>
                <Scan className={`w-8 h-8 ${hasActiveEvent ? "text-emerald-600" : "text-amber-600"}`} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 mb-2">{scannerStatusLabel}</h4>
                <Badge className={`px-4 py-2 rounded-full font-black text-xs ${hasActiveEvent ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                  {hasActiveEvent ? "Ready" : "Standby"}
                </Badge>
              </div>
              {lastScan && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Last Scan</p>
                  <p className="text-sm font-bold text-slate-900">{lastScan.eventName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {lastScan.scanTime || lastScan.timestamp
                      ? formatDateTime(lastScan.scanTime || lastScan.timestamp)
                      : "Now"}
                  </p>
                </div>
              )}
              {!lastScan && (
                <p className="mt-4 text-xs text-slate-500 font-semibold">{scannerStatusMessage}</p>
              )}
            </div>
          </div>

          {/* Recent Scans */}
          <div className="border border-slate-200/60 bg-white rounded-3xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Recent Scans
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {recentScansDisplay.map((scan, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50/60 transition-colors duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-black text-slate-900 truncate">{scan.memberName}</p>
                      <p className="text-xs font-semibold text-slate-500">ID: {scan.qrCode}</p>
                      <p className="text-xs font-semibold text-slate-500">Brgy: {scan.barangay}</p>
                      {scan.date || scan.time ? (
                        <p className="text-xs text-slate-500 font-semibold pt-1">{scan.date} {scan.time ? `• ${scan.time}` : ""}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How to Scan Guide */}
          <div className="border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 rounded-3xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Quick Guide</h3>
            </div>
            <div className="p-6 space-y-4">
              {[
                { step: 1, text: "Tap 'Start Scanning' to activate camera" },
                { step: 2, text: "Point camera at the member QR code" },
                { step: 3, text: "Wait for automatic detection and confirmation" }
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-black text-emerald-700">{item.step}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 leading-snug">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
