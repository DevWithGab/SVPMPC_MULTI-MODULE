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
import "./QRScanner.css";

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
  const [manualReasonMember, setManualReasonMember] = useState(null);
  const [manualReason, setManualReason] = useState("");
  const [showManualReasonModal, setShowManualReasonModal] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  /* Brief on-camera flash shown right after a code is processed —
  null | 'success' | 'duplicate' | 'invalid'. Mirrors the playScanSound
  outcomes so the visual and audio feedback always agree.*/
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
  /* May temporary cooldown ang scanner para maiwasan ang paulit-ulit na 
  pag-detect at pag-process ng parehong QR code habang nakikita pa ito ng camera.*/
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
        /*Ang lastValueRef ay nase-set lang kapag successful ang scan. 
        // Kaya kapag umabot dito, ibig sabihin ay na-scan na ang parehong 
        // QR code kamakailan at nakikita pa rin ito ng camera. Hindi ito 
        // error, kaya status update lang ang ipapakita sa halip na red alert, 
        // at maghihintay muna nang mas matagal bago muling mag-scan para 
        maiwasan ang paulit-ulit na detection.*/
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
        (event) => event.eventId === currentEventId && event.status === "active",
      );

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
        /* Give the operator a beat to move the code away before the loop
        starts decoding frames again — covers success and every error
        path here, so nothing gets re-processed while still in view.*/
        pauseDetectionUntilRef.current = Date.now() + 1500;
      }
    },
    [onScanSuccess, playScanSound, triggerScanFeedback],
  );

  /*Manually adding a member (no camera involved) always requires a typed
  reason and is recorded with entrySource: 'manual' — the server's
  existing audit logging on every recordAttendance call then captures it
  with this operator's name, timestamp, and reason.*/
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
    if (!selectedEventId || !events?.length) {
      setError(
        "Select an active event before scanning.",
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
        "Ready for the next QR code.",
      );
    }
  };

  const recentScansDisplay = scanHistory.filter(record => record.eventId === selectedEventId).map((record, index) => ({
    id: index + 1,
    memberName: record.memberName || record.name || "Unknown member",
    memberId: record.memberId || "",
    time: record.scanTime ? formatTime(record.scanTime) : "Now",
    barangay: record.barangay || "N/A",
  }));

  const selectedEvent = events.find(
    (event) => event.eventId === selectedEventId && event.status === "active",
  );

  return (
    <div className="operator-qr-scanner">
      <header className="oqs-header">
        <h1>Scan attendance</h1>
        <p>Select the event, then scan each member's QR code.</p>
      </header>
      <section className="oqs-event" aria-label="Scanning event">
        <div className="oqs-event-field">
          <label htmlFor="oqs-event">Event</label>
          <select
            id="oqs-event"
            value={selectedEventId}
            disabled={isScanning || !hasActiveEvent}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setScanResult(null);
              setError("");
              lastValueRef.current = "";
            }}
          >
            {!hasActiveEvent && <option value="">No active events</option>}
            {events.map(event => (
              <option key={event.eventId} value={event.eventId}>{event.eventName}</option>
            ))}
          </select>
          {selectedEvent && (
            <p>{[
              selectedEvent.eventDate ? formatDate(selectedEvent.eventDate) : "",
              selectedEvent.location,
            ].filter(Boolean).join(" / ")}</p>
          )}
        </div>
        <span className={`oqs-camera-status ${isScanning ? "is-live" : ""}`}>
          <span aria-hidden="true" />{isScanning ? "Camera on" : "Camera off"}
        </span>
      </section>
      {!hasActiveEvent && (
        <div className="oqs-notice" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <p>No active event is available. Ask an administrator to activate the event before scanning.</p>
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
            {/* Keep the result visible beside the camera on narrow screens.
                The full result below provides the live announcement. */}
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
                className={`oqs-button ${isScanning ? "oqs-button-stop" : "oqs-button-primary"}`}
                onClick={isScanning ? stopScanning : startScanning}
                disabled={!selectedEvent}
              >
                {isScanning ? <Square size={16} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
                {isScanning ? "Stop camera" : "Start camera"}
              </button>
              {isScanning && flashSupported && (
                <button type="button" className="oqs-button oqs-button-secondary" onClick={toggleFlash} aria-pressed={flashOn}>
                  <Zap size={16} aria-hidden="true" />Flash {flashOn ? "on" : "off"}
                </button>
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

      {/* Manual add requires a reason before it's recorded — kept out of
          the main flow so camera scanning stays the fast, default path. */}
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
          <div>
            <label
              htmlFor="oqs-manual-reason"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
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
          </div>

          <div className="flex gap-3 pt-1">
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
          </div>
        </div>
      </Modal>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
