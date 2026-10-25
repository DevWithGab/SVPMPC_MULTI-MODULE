import { Button as ActionButton } from '../../ui/button';
import { Select, Textarea } from '../../ui/input';
import { PageHeader, FormField, ModalActions } from '../../ui/workspace';
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  QrCode, Camera, CheckCircle2, AlertCircle, Clock, Search,
  ChevronDown, Zap, XCircle, Loader2, Square,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import { attendanceAPI, eventAPI, memberAPI } from "../../../services/api";
import jsQR from "jsqr";
import { formatDate, formatTime } from "../../../utils/date";
import { canScanEvent } from "../../../utils/scannerSchedule";
import { loadDashboardRecords } from "../../../utils/attendanceDashboard";
import "./QRScanner.css";

const EMPTY_EVENTS = [];

export default function QRScanner({
  user,
  onScanSuccess,
  events: initialEvents = EMPTY_EVENTS,
  onStatusChange,
  onViewAll,
}) {
  const [events, setEvents] = useState(initialEvents);
  const [now, setNow] = useState(Date.now);
  const [eventNotice, setEventNotice] = useState("");
  const [isStartingCamera, setIsStartingCamera] = useState(false);
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
  const [manualReasonMember, setManualReasonMember] = useState(null);
  const [manualReason, setManualReason] = useState("");
  const [showManualReasonModal, setShowManualReasonModal] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  /* Brief on-camera flash na ipinapakita kaagad pagkatapos ma-process ang
  code - null | 'success' | 'duplicate' | 'invalid'. Sumusunod ito sa
  outcomes ng playScanSound para laging tugma ang visual at audio feedback. */
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
  const cameraSessionRef = useRef(0);
  const cameraStartingRef = useRef(false);
  const eventsRequestRef = useRef(false);
  const mountedRef = useRef(false);
  /* May temporary cooldown ang scanner para maiwasan ang paulit-ulit na 
  pag-detect at pag-process ng parehong QR code habang nakikita pa ito ng camera.*/
  const pauseDetectionUntilRef = useRef(0);

  const activeEvents = useMemo(
    () => events.filter(event => canScanEvent(event, now)),
    [events, now],
  );
  const hasActiveEvent = activeEvents.length > 0;

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    if (!isScanning && !isStartingCamera) {
      setStatusMessage(
        hasActiveEvent ? "Ready to scan" : "Scanner is on standby.",
      );
    }
  }, [hasActiveEvent, isScanning, isStartingCamera]);

  const fetchActiveEvents = useCallback(async () => {
    if (eventsRequestRef.current) return;
    eventsRequestRef.current = true;
    try {
      const allEvents = await loadDashboardRecords(eventAPI.getEvents, 'events');
      if (mountedRef.current) setEvents(allEvents);
    } catch (err) {
      console.error("Error fetching active events:", err);
    } finally {
      eventsRequestRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = () => {
      setNow(Date.now());
      fetchActiveEvents();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    /* Hinahandle ng local clock yung known start/end boundaries kaya hindi na
    kailangan maghintay ng polling. Yung polling naman ang kukuha ng
    approvals, cancellations, at edits. */
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(onVisible, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(clock);
      clearInterval(poll);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchActiveEvents]);

  useEffect(() => {
    if (!showManualLookup) return;
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
  }, [showManualLookup]);

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
    // Cancel pending camera permission/video startup as well as active scanning.
    cameraSessionRef.current += 1;
    cameraStartingRef.current = false;
    setIsStartingCamera(false);
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
    events: [],
    selectedEventId: "",
    user: null,
  });

  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = {
      isScanning,
      events,
      selectedEventId,
      user,
    };
  }, [isScanning, events, selectedEventId, user]);

  useEffect(() => {
    if (activeEvents.some(event => event.eventId === selectedEventId)) return;
    /* Ang bukas na manual-entry confirmation ay kabilang pa rin sa lumang
    event - isara ito muna bago pumili ng ibang event para hindi na ito
    ma-record sa ibang event. */
    if (selectedEventId) {
      setShowManualReasonModal(false);
      setManualReasonMember(null);
      setManualReason("");
      setScanResult(null);
    }
    /* Ang bukas na manual-entry confirmation ay kabilang pa rin sa lumang
    event - isara ito muna bago pumili ng ibang event para hindi na ito
    ma-record sa ibang event. */
    if (selectedEventId) {
      setShowManualReasonModal(false);
      setManualReasonMember(null);
      setManualReason("");
      setScanResult(null);
    }
    if (isScanning || cameraStartingRef.current || streamRef.current) {
      stopScanning();
      setEventNotice("The selected event is no longer active. The camera has been stopped.");
      setScanResult(null);
      setError("");
    }
    setSelectedEventId(activeEvents[0]?.eventId || "");
  }, [activeEvents, selectedEventId, isScanning, stopScanning]);

  const handleDetectedCode = useCallback(
    async (rawValue, recordOptions = {}) => {
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
        /* Ang lastValueRef ay nase-set lang kapag successful ang scan. Kaya
        kapag umabot dito, ibig sabihin ay na-scan na ang parehong QR code
        kamakailan at nakikita pa rin ito ng camera. Hindi ito error, kaya
        status update lang ang ipapakita sa halip na red alert, at
        maghihintay muna nang mas matagal bago muling mag-scan para
        maiwasan ang paulit-ulit na detection. */
        setError("");
        setStatusMessage("Already recorded — move to the next member.");
        playScanSound("duplicate");
        triggerScanFeedback("duplicate");
        pauseDetectionUntilRef.current = Date.now() + 1500;
        return;
      }

      isProcessingRef.current = true;
      setScanResult(null);
      setStatusMessage("Recording attendance...");
      setError("");

      const {
        events: currentEvents,
        selectedEventId: currentEventId,
        user: currentUser,
      } = stateRef.current;
      const activeEvent = currentEvents.find(
        (event) => event.eventId === currentEventId && canScanEvent(event),
      );

      if (!activeEvent) {
        stopScanning();
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
          {
            ...recordOptions,
            qrId: recordOptions.entrySource === 'manual'
              ? undefined
              : qrPayload?.qrId ?? qrPayload?.qrCode,
          },
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

        if (stateRef.current.selectedEventId !== activeEvent.eventId ||
            !canScanEvent(stateRef.current.events.find(event => event.eventId === activeEvent.eventId))) {
          /* Minsan natatapos ng API ang valid na pre-deadline scan kahit
          na-stop na ang camera. I-keep ang record nito pero hindi na dapat
          buhayin ulit ang lumang session. */
          setScanHistory(prev => [attendance, ...prev].slice(0, 5));
          onScanSuccess?.(attendance);
          return;
        }

        if (stateRef.current.selectedEventId !== activeEvent.eventId ||
            !canScanEvent(stateRef.current.events.find(event => event.eventId === activeEvent.eventId))) {
          /* Minsan natatapos ng API ang valid na pre-deadline scan kahit
          na-stop na ang camera. I-keep ang record nito pero hindi na dapat
          buhayin ulit ang lumang session. */
          setScanHistory(prev => [attendance, ...prev].slice(0, 5));
          onScanSuccess?.(attendance);
          return;
        }

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

        if (apiMessage.includes("Attendance can only be recorded while the event is active")) {
          stopScanning();
          setEventNotice("The selected event is no longer active. The camera has been stopped.");
          fetchActiveEvents();
        }

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
        /* Bigyan muna ng saglit ang operator para ialis ang code bago
        magsimula ulit mag-decode ng frames ang loop - sakop nito yung
        success at lahat ng error path dito, kaya walang ma-re-process
        ulit habang nakikita pa. */
        pauseDetectionUntilRef.current = Date.now() + 1500;
      }
    },
    [onScanSuccess, playScanSound, triggerScanFeedback, stopScanning, fetchActiveEvents],
  );

  /* Kapag nag-manually add ng member (walang camera), required talaga na
  mag-type ng reason, at ire-record ito na may entrySource: 'manual' - yung
  existing audit logging ng server sa bawat recordAttendance call ang
  kukuha nito, kasama ang pangalan ng operator, timestamp, at reason. */
  const handleManualMemberAdd = useCallback(
    (member) => {
      const memberId = member?.memberId;
      if (!memberId) {
        setError("Selected member does not have a passbook number.");
        playScanSound("invalid");
        return;
      }

      setManualReasonMember(member);
      setManualReason("");
      setShowManualReasonModal(true);
    },
    [playScanSound],
  );

  const confirmManualAttendance = useCallback(async () => {
    const memberId = manualReasonMember?.memberId;
    if (!memberId || !manualReason.trim()) return;

    setSubmittingManual(true);
    await handleDetectedCode(memberId, {
      entrySource: "manual",
      justification: manualReason.trim(),
    });
    setSubmittingManual(false);
    setShowManualReasonModal(false);
    setManualReasonMember(null);
    setManualReason("");
  }, [manualReasonMember, manualReason, handleDetectedCode]);

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

    // Check if video has data to read before attempting to draw it to the canvas
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
    if (cameraStartingRef.current || isScanning) return;
    const event = events.find(item => item.eventId === selectedEventId && canScanEvent(item));
    if (!event) {
      setError("Select an active event before scanning.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported by this browser.");
      return;
    }

    const session = ++cameraSessionRef.current;
    cameraStartingRef.current = true;
    setIsStartingCamera(true);
    setError("");
    setEventNotice("");
    setStatusMessage("Requesting camera access...");
    const stillValid = () => mountedRef.current && session === cameraSessionRef.current &&
      stateRef.current.selectedEventId === event.eventId &&
      canScanEvent(stateRef.current.events.find(item => item.eventId === event.eventId));
    let stream;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        if (!stillValid()) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      /* Posibleng magrant ng permission kahit tapos na ang event, nag-cancel
      na ang operator, o na-unmount na ang tab. Kailanman hindi dapat
      i-attach o pabayaan tumakbo ang late stream na ito. */
      if (!stillValid() || !videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      setFlashSupported(Boolean(track?.getCapabilities?.()?.torch));
      setFlashOn(false);

      detectorRef.current = null;
      if (supportsBarcodeDetector()) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          // jsQR remains available when native detection is unsupported.
        }
      }

      const requestedAt = Date.now();
      const ready = await new Promise(resolve => {
        const checkReady = () => {
          if (!stillValid() || videoRef.current !== video) return resolve(false);
          if (video.readyState >= 2) return resolve(true);
          if (Date.now() - requestedAt >= 10000) return resolve(false);
          setTimeout(checkReady, 100);
        };
        checkReady();
      });
      if (!ready || !stillValid()) {
        stream.getTracks().forEach(item => item.stop());
        if (session === cameraSessionRef.current) {
          stopScanning();
          if (canScanEvent(event)) setError("The camera could not start. Please try again.");
        }
        return;
      }
      stateRef.current.isScanning = true;
      setIsScanning(true);
      setStatusMessage("Ready for the next QR code.");
      onStatusChange?.(true);
      scanLoop();
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (session === cameraSessionRef.current) {
        stopScanning();
        setError("Camera access denied. Please allow camera permissions.");
      }
    } finally {
      if (session === cameraSessionRef.current) {
        cameraStartingRef.current = false;
        setIsStartingCamera(false);
      }
    }
  };

  const recentScansDisplay = scanHistory.filter(record => record.eventId === selectedEventId).map((record, index) => ({
    id: index + 1,
    memberName: record.memberName || record.name || "Unknown member",
    memberId: record.memberId || "",
    time: record.scanTime ? formatTime(record.scanTime) : "Now",
    barangay: record.barangay || "N/A",
  }));

  const selectedEvent = activeEvents.find(event => event.eventId === selectedEventId);

  return (
    <div className="operator-qr-scanner">
      <PageHeader className="oqs-header">
        <h1>Scan attendance</h1>
        <p>Select the event, then scan each member's QR code.</p>
      </PageHeader>
      <section className="oqs-event" aria-label="Scanning event">
        <FormField className="oqs-event-field">
          <label htmlFor="oqs-event">Event</label>
          <Select
            id="oqs-event"
            value={selectedEventId}
            disabled={isScanning || isStartingCamera || !hasActiveEvent}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setScanResult(null);
              setError("");
              setEventNotice("");
              lastValueRef.current = "";
            }}
          >
            {!hasActiveEvent && <option value="">No active events</option>}
            {activeEvents.map(event => (
              <option key={event.eventId} value={event.eventId}>{event.eventName}</option>
            ))}
          </Select>
          {selectedEvent && (
            <p>{[
              selectedEvent.eventDate ? formatDate(selectedEvent.eventDate) : "",
              selectedEvent.location,
            ].filter(Boolean).join(" / ")}</p>
          )}
        </FormField>
        <span className={`oqs-camera-status ${isScanning ? "is-live" : ""}`}>
          <span aria-hidden="true" />{isScanning ? "Camera on" : "Camera off"}
        </span>
      </section>
      {(!hasActiveEvent || eventNotice) && (
        <div className="oqs-notice" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <p>{eventNotice || "No active event is available. Approved events become available automatically at their scheduled start time."}</p>
        </div>
      )}
      <div className="oqs-workspace">
        <section className="oqs-camera-panel" aria-label="QR camera scanner">
          <div className={`oqs-viewport ${scanFeedback ? `oqs-feedback-${scanFeedback}` : ""}`}>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
            {!isScanning ? (
              <div className="oqs-camera-empty">
                <QrCode size={48} strokeWidth={1.25} aria-hidden="true" />
                <h2>Ready when you are</h2>
                <p>Start the camera to scan a member's QR code.</p>
              </div>
            ) : (
              <div className="oqs-viewfinder" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            )}
            {isScanning && scanFeedback && (
              <div className="oqs-feedback" aria-hidden="true">
                {scanFeedback === "success" ? <CheckCircle2 size={52} />
                  : scanFeedback === "duplicate" ? <Clock size={52} /> : <XCircle size={52} />}
              </div>
            )}
            {/* Nakikita dito yung result sa tabi ng camera sa narrow screens.
                Yung full result sa baba ang nagbibigay ng live announcement. */}
            {(error || scanResult) && (
              <div className={`oqs-mobile-result ${error ? "has-error" : ""}`} aria-hidden="true">
                {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                <div>
                  <strong>{error ? "Attendance not recorded" : scanResult.memberName || scanResult.name || scanResult.memberId}</strong>
                  <span>{error || `Recorded · Passbook No. ${scanResult.memberId}`}</span>
                </div>
              </div>
            )}
          </div>
          <div className="oqs-camera-controls">
            <div className="oqs-camera-buttons">
              <button
                type="button"
                className={`oqs-button ${isScanning || isStartingCamera ? "oqs-button-stop" : "oqs-button-primary"}`}
                onClick={isScanning || isStartingCamera ? stopScanning : startScanning}
                disabled={!selectedEvent && !isScanning && !isStartingCamera}
              >
                {isScanning ? <Square size={16} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
                {isStartingCamera ? "Cancel camera" : isScanning ? "Stop camera" : "Start camera"}
              </button>
              {isScanning && flashSupported && (
                <ActionButton variant="outline" type="button" className="oqs-button oqs-button-secondary" onClick={toggleFlash} aria-pressed={flashOn}>
                  <Zap size={16} aria-hidden="true" />Flash {flashOn ? "on" : "off"}
                </ActionButton>
              )}
            </div>
            <p className="oqs-scan-status" role="status" aria-live="polite">{statusMessage}</p>
            <p className="oqs-camera-hint">Keep the code inside the frame. Attendance saves automatically.</p>
          </div>
        </section>
        <aside className="oqs-results" aria-label="Scan results">
          <section className={`oqs-result ${error ? "has-error" : scanResult ? "has-success" : ""}`} aria-labelledby="oqs-result-title">
            <h2 id="oqs-result-title">Latest result</h2>
            {error ? (
              <div className="oqs-result-body" role="alert">
                <AlertCircle size={24} aria-hidden="true" />
                <h3>Attendance not recorded</h3>
                <p>{error}</p>
              </div>
            ) : scanResult ? (
              <div className="oqs-result-body" role="status">
                <CheckCircle2 size={26} aria-hidden="true" />
                <p className="oqs-result-label">Attendance recorded</p>
                <h3>{scanResult.memberName || scanResult.name || scanResult.memberId}</h3>
                <p>Passbook No. {scanResult.memberId}</p>
                <p>{scanResult.scanTime || scanResult.timestamp
                  ? formatTime(scanResult.scanTime || scanResult.timestamp) : "Just now"}</p>
                <span className="oqs-next-member">Ready for the next member.</span>
              </div>
            ) : (
              <div className="oqs-result-body oqs-result-empty">
                <CheckCircle2 size={26} strokeWidth={1.5} aria-hidden="true" />
                <h3>Waiting for a scan</h3>
                <p>The member's name and confirmation will appear here.</p>
              </div>
            )}
          </section>
          <section className="oqs-recent" aria-labelledby="oqs-recent-title">
            <div className="oqs-section-heading">
              <h2 id="oqs-recent-title">Recent scans</h2>
              {onViewAll && <button type="button" onClick={onViewAll}>View attendance</button>}
            </div>
            {recentScansDisplay.length ? (
              <ol>
                {recentScansDisplay.map(scan => (
                  <li key={scan.id}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <div>
                      <strong>{scan.memberName}</strong>
                      <span>Passbook No. {scan.memberId}</span>
                    </div>
                    <time>{scan.time}</time>
                  </li>
                ))}
              </ol>
            ) : <p className="oqs-recent-empty">No scans in this session yet.</p>}
          </section>
        </aside>
      </div>

      {/* Manual lookup - secondary, collapsed by default so scanning stays the focus */}
      <section className="oqs-manual">
        <button
          type="button"
          onClick={() => setShowManualLookup((prev) => !prev)}
          aria-expanded={showManualLookup}
          aria-controls="oqs-manual-lookup"
          className="w-full flex items-center justify-between gap-3 p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-coop-green" />
            <div>
              <p className="text-sm font-bold text-slate-900">
                Can't scan a QR code?
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                Use manual entry with a recorded reason.
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${showManualLookup ? "rotate-180" : ""}`}
          />
        </button>

        {showManualLookup && (
          <div
            id="oqs-manual-lookup"
            className="p-5 pt-0 space-y-4 border-t border-slate-100"
          >
            <Input
              aria-label="Search members by name or passbook number"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by member name or Passbook No."
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
                        Passbook No.: {member.memberId || "N/A"}
                        {member.barangay ? ` • ${member.barangay}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleManualMemberAdd(member)}
                      disabled={!selectedEvent}
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
          </div>
        )}
      </section>

      {/* Required ang reason bago ma-record ang manual add - nilagay ito
          sa labas ng main flow para ang camera scanning ang mananatiling
          mabilis, default na path. */}
      <Modal
        isOpen={showManualReasonModal}
        onClose={() => !submittingManual && setShowManualReasonModal(false)}
        title="Confirm Manual Attendance"
        className="max-w-sm"
      >
        {manualReasonMember && (
          <div className="mb-5 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-base font-bold text-slate-900">
                  {manualReasonMember.name}
                </p>
                <p className="text-sm text-slate-500">
                  Passbook No.: {manualReasonMember.memberId}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <FormField>
            <label
              htmlFor="oqs-manual-reason"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="oqs-manual-reason"
              maxLength={1000}
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Why can't this member be scanned? (e.g., QR won't scan, phone unavailable, damaged code)"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              This reason will be logged for audit purposes, along with your
              name and the time.
            </p>
          </FormField>

          <ModalActions className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={submittingManual}
              onClick={() => setShowManualReasonModal(false)}
              className="flex-1 border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!manualReason.trim() || submittingManual}
              onClick={confirmManualAttendance}
              className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingManual ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                  Recording...
                </>
              ) : (
                "Confirm Attendance"
              )}
            </Button>
          </ModalActions>
        </div>
      </Modal>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
