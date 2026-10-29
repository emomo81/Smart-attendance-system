"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LogSource = "photo" | "video" | "webcam";
type CaptureMode = "photo" | "capture" | "video" | "webcam";
type DetectionMethod = "haar" | "roboflow";
type AttendanceRecord = {
  date: string;
  time: string;
  source: LogSource;
  method: DetectionMethod;
  face_count: string | number;
};
type DetectionResult = {
  face_count: number;
  image: string;
  method: DetectionMethod;
  source: LogSource;
  record: AttendanceRecord | null;
};

// Only the backend URL is public. The Roboflow key stays on the backend.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/+$/, "");
const SAMPLE_IMAGE = "/images/classroom-f3r03.jpg";
const SAMPLE_INTERVAL_MS = 2_000;
const MAX_VIDEO_SAMPLES = 60;
const MAX_FRAME_WIDTH = 1280;
// Roboflow confidence in percent; the backend clamps to the same 10–90 range.
const DEFAULT_CONFIDENCE = 40;
const MIN_CONFIDENCE = 10;
const MAX_CONFIDENCE = 90;
const DEFAULT_CLASS_SIZE = 50;
const CLASS_SIZE_KEY = "rollcall.classSize";
const CLASSROOM = "F3R/03";
const FLOOR = "3rd Floor";
const USER_NAME = "Group1";
const USER_INITIALS = "G1";
const COURSE = "Data Science";
const YEAR = "Year 4";
const UNIVERSITY = "Kigali Independent University ULK";
const SOURCE_LABELS: Record<LogSource, string> = { photo: "Photo", video: "Video", webcam: "Webcam" };
const MODE_LABELS: Record<CaptureMode, string> = { photo: "Upload photo", capture: "Capture", video: "Video", webcam: "Live webcam" };
const METHOD_LABELS: Record<DetectionMethod, string> = { haar: "Haar cascade", roboflow: "Roboflow" };
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type IconName =
  | "home" | "board" | "scan" | "clock" | "settings" | "sliders" | "search" | "bell" | "calendar"
  | "users" | "chart" | "user" | "eye" | "play" | "stop" | "upload" | "camera" | "aperture"
  | "refresh" | "image" | "video" | "download" | "check" | "close" | "arrow" | "chevron" | "menu" | "shield";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3.5 10.5 12 3.75l8.5 6.75V19a1.5 1.5 0 0 1-1.5 1.5h-4.25v-6h-5.5v6H5A1.5 1.5 0 0 1 3.5 19v-8.5Z" /></svg>;
    case "board":
      return <svg {...common}><rect x="3.5" y="4" width="17" height="12" rx="1.8" /><path d="M8 20h8M12 16v4M7.5 8.5h5M7.5 11.5h8" /></svg>;
    case "scan":
      return <svg {...common}><path d="M8 3.5H5.75A2.25 2.25 0 0 0 3.5 5.75V8M16 3.5h2.25a2.25 2.25 0 0 1 2.25 2.25V8M20.5 16v2.25a2.25 2.25 0 0 1-2.25 2.25H16M8 20.5H5.75a2.25 2.25 0 0 1-2.25-2.25V16" /><circle cx="12" cy="10.5" r="2.5" /><path d="M8 16.5a4.5 4.5 0 0 1 8 0" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.75" /><path d="M12 7v5.25l3.5 2" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.3a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.3a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.3a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></svg>;
    case "sliders":
      return <svg {...common}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
    case "bell":
      return <svg {...common}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3.75" y="5" width="16.5" height="15.25" rx="2" /><path d="M3.75 9.75h16.5M8 3.5v3M16 3.5v3" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M16 4.4a3.5 3.5 0 0 1 0 6.8M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></svg>;
    case "chart":
      return <svg {...common}><circle cx="12" cy="12" r="8.75" /><path d="M12 3.25V12l6.2 6.2" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="3.75" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.75" /></svg>;
    case "play":
      return <svg {...common}><path d="m8 5.25 11 6.75-11 6.75V5.25Z" /></svg>;
    case "stop":
      return <svg {...common}><rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" stroke="none" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 15V3.5" /><path d="m7.75 7.75 4.25-4.25 4.25 4.25" /><path d="M4 14.5v4A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-4" /></svg>;
    case "camera":
      return <svg {...common}><path d="M4 7.5h3l1.5-2h7l1.5 2h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" /><circle cx="12" cy="13.25" r="3.35" /></svg>;
    case "aperture":
      return <svg {...common}><circle cx="12" cy="12" r="8.75" /><circle cx="12" cy="12" r="3.25" /><path d="M12 3.25v5.5M20.1 9.1l-4.9 2.3M17.4 19.2l-3.1-4.5M6.6 19.2l3.1-4.5M3.9 9.1l4.9 2.3" /></svg>;
    case "refresh":
      return <svg {...common}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></svg>;
    case "image":
      return <svg {...common}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="9.5" r="1.75" /><path d="m20.5 16-5-5-8.5 8.5" /></svg>;
    case "video":
      return <svg {...common}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10.5 5-3v9l-5-3" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3.5v11" /><path d="m7.75 10.25 4.25 4.25 4.25-4.25" /><path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12.5 4.25 4.25L19 7" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5-5.5 5.5" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m8 10 4 4 4-4" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 21s7-3.3 7-9.25V5.5L12 3 5 5.5v6.25C5 17.7 12 21 12 21Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera permission was denied. Allow camera access in your browser, or upload a classroom photo instead.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found. Connect a camera or upload a classroom photo instead.";
    }
  }
  if (error instanceof TypeError) {
    return `The detection server at ${API_URL} could not be reached. It may be waking up — try again in a moment.`;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

// CSV rows are written in UTC by the backend.
function recordDate(record: AttendanceRecord) {
  return new Date(`${record.date}T${record.time}Z`);
}

function timeAgo(date: Date, now: Date | null) {
  if (Number.isNaN(date.getTime())) return "";
  if (!now) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && date.toDateString() === now.toDateString()) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function faces(count: number) {
  return `${count} ${count === 1 ? "face" : "faces"}`;
}

// Draws the current video frame to a canvas (capped at MAX_FRAME_WIDTH) and returns it as a JPEG.
function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob> {
  const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("This browser cannot capture video frames."));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("A video frame could not be captured."))), "image/jpeg", 0.9);
  });
}

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("This video could not be read. Try an MP4 or WebM file.")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function AttendanceDashboard() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [mode, setMode] = useState<CaptureMode>("capture");
  const [method, setMethod] = useState<DetectionMethod>("haar");
  const [minNeighbors, setMinNeighbors] = useState(5);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [classSize, setClassSize] = useState(DEFAULT_CLASS_SIZE);
  const [autoLog, setAutoLog] = useState(true);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ready" | "offline">("checking");
  const [roboflowConfigured, setRoboflowConfigured] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [lastScan, setLastScan] = useState<{ blob: Blob; source: LogSource; label: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number; peak: number } | null>(null);
  const [stageError, setStageError] = useState("");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const webcamRef = useRef<HTMLVideoElement>(null);
  const videoFileRef = useRef<HTMLVideoElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestInFlightRef = useRef(false);
  const cancelVideoRef = useRef(false);
  const videoUrlRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  // Keep the latest settings readable from the webcam interval without restarting it.
  const settingsRef = useRef({ method, minNeighbors, confidence, autoLog });
  useEffect(() => {
    settingsRef.current = { method, minNeighbors, confidence, autoLog };
  }, [method, minNeighbors, confidence, autoLog]);

  const showNotice = useCallback((message: string, tone: "success" | "error" = "success") => {
    setNotice({ message, tone });
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4_200);
  }, []);

  const detect = useCallback(async (image: Blob, source: LogSource): Promise<DetectionResult> => {
    const { method: currentMethod, minNeighbors: neighbors, confidence: minConfidence, autoLog: shouldLog } = settingsRef.current;
    const form = new FormData();
    form.append("image", image, "frame.jpg");
    form.append("method", currentMethod);
    form.append("source", source);
    form.append("min_neighbors", String(neighbors));
    form.append("confidence", String(minConfidence / 100));
    form.append("log", String(shouldLog));
    const response = await fetch(`${API_URL}/detect`, { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as Partial<DetectionResult> & { error?: string };
    if (!response.ok || typeof data.face_count !== "number") {
      throw new Error(data.error ?? `Detection failed (HTTP ${response.status}).`);
    }
    const detection = data as DetectionResult;
    setResult(detection);
    setBackendStatus("ready");
    if (detection.record) setRecords((previous) => [detection.record!, ...previous].slice(0, 100));
    return detection;
  }, []);

  const scanStill = useCallback(
    async (image: Blob, label: string) => {
      setIsBusy(true);
      setStageError("");
      try {
        const detection = await detect(image, "photo");
        setLastScan({ blob: image, source: "photo", label });
        showNotice(`${faces(detection.face_count)} counted with ${METHOD_LABELS[detection.method]}${detection.record ? " · logged to CSV" : ""}`);
      } catch (error) {
        const message = getErrorMessage(error);
        setStageError(message);
        showNotice(message, "error");
      } finally {
        setIsBusy(false);
      }
    },
    [detect, showNotice],
  );

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const stopVideo = useCallback(() => {
    cancelVideoRef.current = true;
  }, []);

  const clearStage = useCallback(() => {
    setResult(null);
    setStageError("");
    setVideoProgress(null);
  }, []);

  const openCamera = useCallback(async () => {
    clearStage();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access needs a secure (https) browser connection.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      setStageError(message);
      showNotice(message, "error");
      return false;
    }
  }, [clearStage, showNotice]);

  // Clock for the greeting, date chip and "x min ago" labels. Set from a timer so the
  // server-rendered HTML and the first client render match.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = Number(window.localStorage.getItem(CLASS_SIZE_KEY));
        if (Number.isInteger(saved) && saved > 0) setClassSize(saved);
      } catch {
        // Storage can be blocked (private mode); the default class size is fine.
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const health = await fetch(`${API_URL}/health`, { cache: "no-store" });
        const healthData = (await health.json()) as { ok?: boolean; roboflow_configured?: boolean };
        if (!cancelled) {
          setBackendStatus(healthData.ok ? "ready" : "offline");
          setRoboflowConfigured(Boolean(healthData.roboflow_configured));
        }
        const response = await fetch(`${API_URL}/logs?format=json`, { cache: "no-store" });
        if (!response.ok) throw new Error("Attendance history is unavailable right now.");
        const data = (await response.json()) as { records: AttendanceRecord[] };
        if (!cancelled) {
          setRecords(data.records);
          setRecordsError("");
        }
      } catch (error) {
        if (!cancelled) {
          setBackendStatus("offline");
          setRecordsError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Attach the camera stream to the on-screen <video> (used by both Capture and Live webcam).
  useEffect(() => {
    const video = webcamRef.current;
    if (!cameraStream || !video) return;
    video.srcObject = cameraStream;
    void video.play().catch((error: unknown) => {
      setStageError(getErrorMessage(error));
      stopCamera();
    });
    return () => {
      if (video.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraStream, stopCamera]);

  // Live webcam only: sample one frame every 2 seconds (not every frame) to save Roboflow credits.
  useEffect(() => {
    const video = webcamRef.current;
    if (!cameraStream || !video || mode !== "webcam") return;
    const interval = window.setInterval(async () => {
      const canvas = frameCanvasRef.current;
      if (!canvas || requestInFlightRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      requestInFlightRef.current = true;
      try {
        await detect(await captureFrame(video, canvas), "webcam");
        setStageError("");
      } catch (error) {
        setStageError(getErrorMessage(error));
      } finally {
        requestInFlightRef.current = false;
      }
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [cameraStream, detect, mode]);

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  useEffect(() => {
    return () => {
      cancelVideoRef.current = true;
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const switchMode = useCallback(
    (next: CaptureMode) => {
      if (next === mode) return;
      stopCamera();
      stopVideo();
      clearStage();
      setMode(next);
    },
    [clearStage, mode, stopCamera, stopVideo],
  );

  const startAttendance = useCallback(() => {
    setNavOpen(false);
    if (mode !== "capture") switchMode("capture");
    scrollToId("detector");
    if (!cameraStream || mode !== "capture") void openCamera();
  }, [cameraStream, mode, openCamera, switchMode]);

  const takePicture = useCallback(async () => {
    const video = webcamRef.current;
    const canvas = frameCanvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      showNotice("The camera is still starting — try again in a second.", "error");
      return;
    }
    try {
      const blob = await captureFrame(video, canvas);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 380);
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setSourceName("Captured photo");
      stopCamera();
      await scanStill(blob, "Captured photo");
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }, [scanStill, showNotice, stopCamera]);

  const retake = useCallback(() => {
    setCapturedBlob(null);
    setCapturedUrl(null);
    void openCamera();
  }, [openCamera]);

  const handleWebcam = useCallback(async () => {
    if (cameraStream) {
      stopCamera();
      showNotice("Webcam session ended.");
      return;
    }
    if (await openCamera()) {
      setSourceName("Live webcam");
      showNotice("Webcam connected · one frame is analysed every 2 seconds.");
    }
  }, [cameraStream, openCamera, showNotice, stopCamera]);

  const handleImageFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, target: "photo" | "capture") => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showNotice("Choose an image file to scan.", "error");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        showNotice("That image is too large. Choose a file under 25 MB.", "error");
        return;
      }
      clearStage();
      const label = target === "capture" ? "Captured photo" : file.name;
      setSourceName(label);
      if (target === "capture") {
        stopCamera();
        setCapturedBlob(file);
        setCapturedUrl(URL.createObjectURL(file));
      } else {
        setPhotoBlob(file);
        setPhotoUrl(URL.createObjectURL(file));
      }
      void scanStill(file, label);
    },
    [clearStage, scanStill, showNotice, stopCamera],
  );

  const handleSampleScan = useCallback(async () => {
    if (mode !== "photo") switchMode("photo");
    clearStage();
    setSourceName("Sample classroom");
    setPhotoUrl(null);
    try {
      const response = await fetch(SAMPLE_IMAGE);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      setPhotoBlob(blob);
      await scanStill(blob, "Sample classroom");
    } catch {
      showNotice("The sample classroom image could not be loaded.", "error");
    }
  }, [clearStage, mode, scanStill, showNotice, switchMode]);

  const scanAgain = useCallback(() => {
    if (isBusy) return;
    if (lastScan) {
      scrollToId("detector");
      void scanStill(lastScan.blob, lastScan.label);
    } else {
      showNotice("Nothing to re-run yet — capture or upload a photo first.", "error");
    }
  }, [isBusy, lastScan, scanStill, showNotice]);

  const handleVideoChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const video = videoFileRef.current;
      const canvas = frameCanvasRef.current;
      if (!file || !video || !canvas) return;
      if (!file.type.startsWith("video/")) {
        showNotice("Choose a video file to scan.", "error");
        return;
      }

      clearStage();
      setSourceName(file.name);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = URL.createObjectURL(file);
      cancelVideoRef.current = false;
      setIsBusy(true);
      try {
        video.src = videoUrlRef.current;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("This video could not be opened. Try an MP4 or WebM file."));
        });
        // One sample every 2 seconds of footage, capped so a long clip can't burn through credits.
        const times: number[] = [];
        for (let t = 0; t < video.duration && times.length < MAX_VIDEO_SAMPLES; t += SAMPLE_INTERVAL_MS / 1000) {
          times.push(Math.min(t + 0.05, Math.max(0, video.duration - 0.05)));
        }
        let peak = 0;
        setVideoProgress({ done: 0, total: times.length, peak });
        for (const [index, time] of times.entries()) {
          if (cancelVideoRef.current) break;
          await seekTo(video, time);
          const detection = await detect(await captureFrame(video, canvas), "video");
          peak = Math.max(peak, detection.face_count);
          setVideoProgress({ done: index + 1, total: times.length, peak });
        }
        showNotice(cancelVideoRef.current ? "Video scan stopped." : `Video scanned · ${times.length} frames · peak ${faces(peak)}`);
      } catch (error) {
        const message = getErrorMessage(error);
        setStageError(message);
        showNotice(message, "error");
      } finally {
        setIsBusy(false);
      }
    },
    [clearStage, detect, showNotice],
  );

  const updateClassSize = useCallback((value: number) => {
    const size = Math.max(1, Math.min(500, Math.round(value) || 1));
    setClassSize(size);
    try {
      window.localStorage.setItem(CLASS_SIZE_KEY, String(size));
    } catch {
      // Not persisted; it still applies for this visit.
    }
  }, []);

  // ---- Derived numbers for the overview cards (all from real scans, nothing invented) ----
  const todayRecords = useMemo(
    () => (now ? records.filter((record) => recordDate(record).toDateString() === now.toDateString()) : []),
    [now, records],
  );
  const presentCount = result ? result.face_count : todayRecords.length > 0 ? Number(todayRecords[0].face_count) : 0;
  const attendanceRate = classSize > 0 ? Math.min(100, Math.round((presentCount / classSize) * 100)) : 0;
  const absentCount = Math.max(0, classSize - presentCount);
  const week = useMemo(() => {
    const peaks = Array<number | null>(7).fill(null);
    if (!now) return peaks;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (const record of records) {
      const date = recordDate(record);
      const dayIndex = Math.floor((date.getTime() - monday.getTime()) / 86_400_000);
      if (dayIndex >= 0 && dayIndex < 7) peaks[dayIndex] = Math.max(peaks[dayIndex] ?? 0, Number(record.face_count));
    }
    return peaks;
  }, [now, records]);
  const weekMax = Math.max(classSize, ...week.map((value) => value ?? 0), 1);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [CLASSROOM, SOURCE_LABELS[record.source], METHOD_LABELS[record.method], faces(Number(record.face_count)), record.date]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);
  const visibleActivity = showAllActivity ? filteredRecords.slice(0, 30) : filteredRecords.slice(0, 5);

  const hour = now?.getHours() ?? 9;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = now ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now) : "Today";
  const isLive = cameraStream !== null || (videoProgress !== null && isBusy);
  const csvUrl = `${API_URL}/logs`;
  const ringCircumference = 2 * Math.PI * 64;
  const statusText = backendStatus === "checking" ? "Connecting" : backendStatus === "offline" ? "Server offline" : "Server online";

  const stagePrompt: Record<CaptureMode, { title: string; body: string }> = {
    photo: { title: "Upload a classroom photo", body: "Or try the sample image to see how counting works" },
    capture: { title: "Capture a picture and scan it", body: "Open the camera, frame the class, then take the picture" },
    video: { title: "Upload a classroom video", body: "One frame is analysed every 2 seconds of footage" },
    webcam: { title: "Start the live webcam", body: "One frame is analysed every 2 seconds" },
  };
  const showPrompt = !result && !cameraStream && !isBusy && !(mode === "photo" && photoUrl) && !(mode === "capture" && capturedUrl);

  return (
    <div className={`rc-app ${navOpen ? "nav-open" : ""}`} id="overview">
      <aside className="rc-sidebar" aria-label="Sidebar">
        <a className="rc-brand" href="#overview" onClick={() => setNavOpen(false)}>
          <span className="rc-brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span className="rc-brand-copy"><strong>Rollcall.</strong><span>Smart Attendance System</span></span>
        </a>

        <nav className="rc-nav" aria-label="Main navigation">
          <a className="rc-nav-link is-current" href="#overview" onClick={() => setNavOpen(false)}><Icon name="home" /><span>Overview</span></a>
          <a className="rc-nav-link" href="#classroom" onClick={() => setNavOpen(false)}><Icon name="board" /><span>My Classrooms</span></a>
          <a className="rc-nav-link" href="#detector" onClick={() => setNavOpen(false)}><Icon name="scan" /><span>Face Detection</span></a>
          <a className="rc-nav-link" href="#activity" onClick={() => setNavOpen(false)}><Icon name="clock" /><span>Activity Log</span><span className="rc-nav-count">{records.length > 99 ? "99+" : records.length}</span></a>
        </nav>

        <div className="rc-nav-label">MANAGE</div>
        <nav className="rc-nav" aria-label="Settings navigation">
          <a className="rc-nav-link" href="#settings" onClick={() => setNavOpen(false)}><Icon name="sliders" /><span>Detection Settings</span></a>
          <a className="rc-nav-link" href="#class-settings" onClick={() => setNavOpen(false)}><Icon name="settings" /><span>Settings</span></a>
        </nav>

        <div className="rc-sidebar-bottom">
          <div className="rc-privacy"><Icon name="shield" size={16} /><span>Faces are counted, never identified.</span></div>
          <div className="rc-user"><span className="rc-user-avatar">{USER_INITIALS}</span><span className="rc-user-copy"><strong>{USER_NAME}</strong><span>{COURSE} · {YEAR}</span></span><Icon name="chevron" size={16} /></div>
          <p className="rc-tagline">Better attendance.<br />Brighter futures.</p>
        </div>
      </aside>
      <button className="rc-scrim" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} tabIndex={navOpen ? 0 : -1} />

      <div className="rc-main">
        <header className="rc-topbar">
          <button className="rc-menu-button" type="button" aria-label="Open menu" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>
          <label className="rc-search">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search activity by source, method or count…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search activity"
            />
            <span className="rc-kbd"><kbd>Ctrl</kbd><kbd>K</kbd></span>
          </label>
          <div className="rc-topbar-actions">
            <button className="rc-icon-button" type="button" aria-label={statusText} title={statusText}>
              <Icon name="bell" size={19} />
              <span className={`rc-status-dot rc-status-${backendStatus}`} />
            </button>
            <div className="rc-date-chip"><Icon name="calendar" size={16} /><span>{todayLabel}</span></div>
            <button className="rc-avatar" type="button" aria-label={`${USER_NAME} profile`}><span>{USER_INITIALS}</span><Icon name="chevron" size={14} /></button>
          </div>
        </header>

        <div className="rc-content">
          <div className="rc-primary">
            <section className="rc-greeting">
              <div><h1>{greeting}, {USER_NAME}</h1><p>Here’s what’s happening in your classroom at {UNIVERSITY} today.</p></div>
            </section>

            <section className="rc-stats" aria-label="Today’s numbers">
              <article className="rc-stat rc-stat-green">
                <span className="rc-stat-icon"><Icon name="board" size={20} /></span>
                <div><span>Total Classes</span><strong>1</strong><small>Active classroom</small></div>
              </article>
              <article className="rc-stat rc-stat-blue">
                <span className="rc-stat-icon"><Icon name="users" size={20} /></span>
                <div><span>Students Present</span><strong>{presentCount}</strong><small>Faces in the latest scan</small></div>
              </article>
              <article className="rc-stat rc-stat-purple">
                <span className="rc-stat-icon"><Icon name="chart" size={20} /></span>
                <div><span>Attendance Rate</span><strong>{attendanceRate}%</strong><small>Of {classSize} enrolled</small></div>
              </article>
              <blockquote className="rc-quote">“Small steps in attendance make big progress in learning.”<span /></blockquote>
            </section>

            <section className="rc-hero" id="classroom" aria-label={CLASSROOM}>
              <div className="rc-hero-top">
                <span className="rc-pill-active"><span />ACTIVE</span>
                <span className="rc-hero-name">{FLOOR}</span>
                <span className="rc-hero-today"><Icon name="calendar" size={15} />Today</span>
              </div>
              <h2>Classroom {CLASSROOM}</h2>
              <p>{COURSE} <span>•</span> {YEAR}</p>
              <p className="rc-hero-university">{UNIVERSITY}</p>
              <div className="rc-hero-chips">
                <span><Icon name="users" size={15} />{classSize} Students</span>
                <span><Icon name="user" size={15} />1 Instructor</span>
                <span><Icon name="scan" size={15} />Face Detection</span>
              </div>
              <div className="rc-hero-actions">
                <button className="rc-btn rc-btn-green" type="button" onClick={startAttendance}><Icon name="play" size={17} />Start Attendance</button>
                <button className="rc-btn rc-btn-ghost" type="button" onClick={() => scrollToId("activity")}><Icon name="eye" size={17} />View Details</button>
                <button className="rc-btn rc-btn-ghost" type="button" onClick={() => scrollToId("settings")}><Icon name="settings" size={17} />Settings</button>
              </div>
            </section>

            <section className="rc-card rc-detector" id="detector" aria-label="Face detection">
              <div className="rc-card-head">
                <div><h3>Face Detection</h3><p>{METHOD_LABELS[method]} · {method === "haar" ? `${minNeighbors} neighbors` : `${confidence}% confidence`}</p></div>
                <span className={`rc-live-tag ${isLive ? "is-live" : ""}`}><span />{isLive ? "LIVE" : result ? "SCANNED" : "READY"}</span>
              </div>

              <div className="rc-tabs" role="tablist" aria-label="Capture source">
                {(Object.keys(MODE_LABELS) as CaptureMode[]).map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={mode === key} className={`rc-tab ${mode === key ? "is-active" : ""}`} onClick={() => switchMode(key)}>
                    <Icon name={key === "photo" ? "upload" : key === "capture" ? "aperture" : key === "video" ? "video" : "camera"} size={15} />{MODE_LABELS[key]}
                  </button>
                ))}
              </div>

              <div className="rc-stage">
                {result ? (
                  <img className="rc-stage-media is-contain" src={result.image} alt={`Detection result: ${faces(result.face_count)} boxed and numbered`} />
                ) : mode === "photo" ? (
                  <img className="rc-stage-media" src={photoUrl ?? SAMPLE_IMAGE} alt={photoUrl ? `Uploaded classroom image: ${sourceName}` : "Sample classroom image"} />
                ) : mode === "capture" && capturedUrl && !cameraStream ? (
                  <img className="rc-stage-media is-contain" src={capturedUrl} alt="Captured classroom picture" />
                ) : null}
                {cameraStream && (
                  <video ref={webcamRef} className={result && mode === "webcam" ? "rc-pip" : "rc-stage-media"} autoPlay muted playsInline aria-label="Live camera feed" />
                )}
                {mode === "capture" && cameraStream && <div className="rc-viewfinder" aria-hidden="true"><span /><span /><span /><span /></div>}
                {flash && <div className="rc-flash" aria-hidden="true" />}
                {result && <div className="rc-count-badge"><Icon name="users" size={15} />{faces(result.face_count)}</div>}
                {showPrompt && (
                  <div className="rc-prompt">
                    <span><Icon name={mode === "capture" ? "aperture" : mode === "video" ? "video" : mode === "webcam" ? "camera" : "image"} size={22} /></span>
                    <strong>{stagePrompt[mode].title}</strong>
                    <small>{stagePrompt[mode].body}</small>
                  </div>
                )}
                {isBusy && <div className="rc-loading"><span className="rc-ring" />{videoProgress ? `Frame ${videoProgress.done} of ${videoProgress.total}…` : "Detecting faces…"}</div>}
                {cameraStream && mode === "webcam" && <div className="rc-live-caption"><span />Sampling one frame every 2 seconds</div>}
              </div>

              <div className="rc-stage-info">
                <span><strong>{sourceName || (mode === "photo" ? "Sample classroom" : MODE_LABELS[mode])}</strong>{videoProgress ? ` · peak ${faces(videoProgress.peak)} across ${videoProgress.done} frames` : " · face count only, no identity matching"}</span>
                <span className={`rc-server rc-server-${backendStatus}`}><span />{statusText}</span>
              </div>

              <div className="rc-stage-actions">
                {mode === "photo" && (
                  <>
                    <label className="rc-btn rc-btn-primary rc-file">
                      <Icon name="upload" size={17} />Upload photo
                      <input type="file" accept="image/*" onChange={(event) => handleImageFile(event, "photo")} disabled={isBusy} aria-label="Upload a classroom photo" />
                    </label>
                    <button className="rc-btn rc-btn-outline" type="button" onClick={() => photoBlob && void scanStill(photoBlob, sourceName || "Photo")} disabled={isBusy || !photoBlob}><Icon name="refresh" size={16} />Scan again</button>
                    <button className="rc-btn rc-btn-text" type="button" onClick={() => void handleSampleScan()} disabled={isBusy}><Icon name="image" size={16} />Try sample</button>
                  </>
                )}
                {mode === "capture" && (
                  cameraStream ? (
                    <>
                      <button className="rc-btn rc-btn-primary rc-shutter" type="button" onClick={() => void takePicture()} disabled={isBusy}><Icon name="aperture" size={18} />Take picture &amp; scan</button>
                      <button className="rc-btn rc-btn-outline" type="button" onClick={stopCamera}><Icon name="close" size={16} />Close camera</button>
                    </>
                  ) : (
                    <>
                      <button className="rc-btn rc-btn-primary" type="button" onClick={() => (capturedUrl ? retake() : void openCamera())} disabled={isBusy}>
                        <Icon name="camera" size={17} />{capturedUrl ? "Retake picture" : "Open camera"}
                      </button>
                      {capturedBlob && (
                        <button className="rc-btn rc-btn-outline" type="button" onClick={() => void scanStill(capturedBlob, "Captured photo")} disabled={isBusy}><Icon name="refresh" size={16} />Scan again</button>
                      )}
                      {/* On phones this opens the native camera app directly. */}
                      <label className="rc-btn rc-btn-text rc-file">
                        <Icon name="image" size={16} />Use camera app
                        <input type="file" accept="image/*" capture="environment" onChange={(event) => handleImageFile(event, "capture")} disabled={isBusy} aria-label="Take a picture with the device camera app" />
                      </label>
                    </>
                  )
                )}
                {mode === "video" && (
                  isBusy ? (
                    <button className="rc-btn rc-btn-primary rc-btn-stop" type="button" onClick={stopVideo}><Icon name="stop" size={16} />Stop video scan</button>
                  ) : (
                    <label className="rc-btn rc-btn-primary rc-file">
                      <Icon name="upload" size={17} />Upload video
                      <input type="file" accept="video/*" onChange={(event) => void handleVideoChange(event)} aria-label="Upload a classroom video" />
                    </label>
                  )
                )}
                {mode === "webcam" && (
                  <button className={`rc-btn rc-btn-primary ${cameraStream ? "rc-btn-stop" : ""}`} type="button" onClick={() => void handleWebcam()}>
                    <Icon name={cameraStream ? "stop" : "camera"} size={17} />{cameraStream ? "Stop webcam" : "Start webcam"}
                  </button>
                )}
              </div>

              {stageError && <div className="rc-error" role="alert"><span>!</span>{stageError}</div>}
            </section>

            <section className="rc-card rc-activity" id="activity" aria-label="Recent activity">
              <div className="rc-card-head">
                <div className="rc-card-title"><Icon name="clock" size={20} /><h3>Recent Activity</h3></div>
                <button className="rc-link" type="button" onClick={() => setShowAllActivity((value) => !value)}>{showAllActivity ? "Show less" : "View all"}</button>
              </div>
              {recordsLoading ? (
                <div className="rc-empty"><span className="rc-ring rc-ring-dark" />Loading attendance history…</div>
              ) : visibleActivity.length > 0 ? (
                <ul className="rc-activity-list">
                  {visibleActivity.map((record, index) => {
                    const count = Number(record.face_count);
                    return (
                      <li key={`${record.date}-${record.time}-${index}`}>
                        <span className={`rc-activity-icon rc-tone-${record.source}`}><Icon name={record.source === "photo" ? "image" : record.source === "video" ? "video" : "camera"} size={18} /></span>
                        <div className="rc-activity-copy">
                          <strong>{count > 0 ? "Attendance scan completed" : "Scan completed · no faces found"}</strong>
                          <span>{CLASSROOM} • {faces(count)} detected • {METHOD_LABELS[record.method] ?? record.method}</span>
                        </div>
                        <span className="rc-activity-time">{timeAgo(recordDate(record), now)}</span>
                        <span className={`rc-badge rc-tone-${record.source}`}><Icon name={count > 0 ? "check" : "close"} size={13} />{SOURCE_LABELS[record.source] ?? record.source}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rc-empty">
                  <strong>{recordsError ? "History is taking a break" : search ? "No matching activity" : "No scans yet"}</strong>
                  <span>{recordsError || (search ? `Nothing matches “${search}”.` : "Capture or upload a photo with logging on to add your first row.")}</span>
                </div>
              )}
              {showAllActivity && filteredRecords.length > 30 && <div className="rc-table-foot">Showing the latest 30 of {filteredRecords.length} rows · download the CSV for everything</div>}
            </section>
          </div>

          <aside className="rc-secondary" aria-label="Overview panels">
            <section className="rc-overview" aria-label="Attendance overview">
              <div className="rc-overview-head"><h3>Attendance Overview</h3><span className="rc-overview-range">This Week</span></div>
              <div className="rc-overview-body">
                <div className="rc-ring-chart" role="img" aria-label={`${attendanceRate}% attendance rate`}>
                  <svg viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="64" className="rc-ring-track" />
                    <circle cx="80" cy="80" r="64" className="rc-ring-value" strokeDasharray={ringCircumference} strokeDashoffset={ringCircumference * (1 - attendanceRate / 100)} />
                  </svg>
                  <div><strong>{attendanceRate}%</strong><span>Attendance Rate</span></div>
                </div>
                <ul className="rc-legend">
                  <li><span className="rc-dot rc-dot-green" />Present<strong>{presentCount}</strong></li>
                  <li><span className="rc-dot rc-dot-red" />Absent<strong>{absentCount}</strong></li>
                  <li><span className="rc-dot rc-dot-amber" />Scans today<strong>{todayRecords.length}</strong></li>
                  <li><span className="rc-dot rc-dot-white" />Total<strong>{classSize}</strong></li>
                </ul>
              </div>
              <div className="rc-week" aria-label="Peak faces counted per day this week">
                {WEEK_DAYS.map((day, index) => {
                  const value = week[index];
                  return (
                    <div className="rc-week-day" key={day}>
                      <div className="rc-week-bar"><span style={{ height: value ? `${Math.max(6, (value / weekMax) * 100)}%` : "0%" }} title={value !== null ? `${day}: peak ${faces(value)}` : `${day}: no scans`} /></div>
                      <span className="rc-week-dot" data-has={value !== null} />
                      <small>{day}</small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rc-card rc-quick" aria-label="Quick actions">
              <h3>Quick Actions</h3>
              <div className="rc-quick-grid">
                <button type="button" className="rc-quick-item rc-tone-green" onClick={startAttendance}><span><Icon name="aperture" size={19} /></span><div><strong>Capture &amp; Scan</strong><small>Take a picture now</small></div><Icon name="arrow" size={16} /></button>
                <button type="button" className="rc-quick-item rc-tone-blue" onClick={scanAgain} disabled={isBusy}><span><Icon name="refresh" size={19} /></span><div><strong>Scan Again</strong><small>Re-run last scan</small></div><Icon name="arrow" size={16} /></button>
                <label className="rc-quick-item rc-tone-purple rc-file">
                  <span><Icon name="upload" size={19} /></span><div><strong>Upload Photo</strong><small>Add classroom photo</small></div><Icon name="arrow" size={16} />
                  <input type="file" accept="image/*" disabled={isBusy} aria-label="Upload a classroom photo" onChange={(event) => { if (mode !== "photo") switchMode("photo"); scrollToId("detector"); handleImageFile(event, "photo"); }} />
                </label>
                <button type="button" className="rc-quick-item rc-tone-grey" onClick={() => scrollToId("settings")}><span><Icon name="sliders" size={19} /></span><div><strong>Detection Settings</strong><small>Adjust parameters</small></div><Icon name="arrow" size={16} /></button>
              </div>
            </section>

            <section className="rc-card rc-settings" id="settings" aria-label="Detection settings">
              <div className="rc-card-head"><div><h3>Detection Settings</h3><p>Fine-tune how faces are counted</p></div></div>
              <label className="rc-field-label" htmlFor="method">Detection method</label>
              <select id="method" className="rc-select" value={method} onChange={(event) => setMethod(event.target.value as DetectionMethod)} disabled={isBusy}>
                <option value="haar">Haar cascade (OpenCV)</option>
                <option value="roboflow">Roboflow (face-detection-bj0ij/1)</option>
              </select>
              {method === "roboflow" && !roboflowConfigured && backendStatus === "ready" && (
                <p className="rc-warning">The server has no Roboflow key set, so Roboflow scans will fail.</p>
              )}
              {method === "haar" ? (
                <>
                  <div className="rc-field-row"><label htmlFor="neighbors">Minimum neighbors</label><span>{minNeighbors}</span></div>
                  <input
                    id="neighbors"
                    className="rc-slider"
                    type="range"
                    min="3"
                    max="9"
                    step="1"
                    value={minNeighbors}
                    onChange={(event) => setMinNeighbors(Number(event.target.value))}
                    style={{ "--slider-progress": `${((minNeighbors - 3) / 6) * 100}%` } as React.CSSProperties}
                    aria-valuetext={`${minNeighbors} minimum neighbors`}
                  />
                  <div className="rc-slider-scale"><span>More detections</span><span>Fewer false positives</span></div>
                  <div className="rc-setting-foot"><span>Scale factor <strong>1.1</strong></span><span className="rc-mini-pill">{minNeighbors === 5 ? "DEFAULT" : "CUSTOM"}</span></div>
                </>
              ) : (
                <>
                  <div className="rc-field-row"><label htmlFor="confidence">Confidence threshold</label><span>{confidence}%</span></div>
                  <input
                    id="confidence"
                    className="rc-slider"
                    type="range"
                    min={MIN_CONFIDENCE}
                    max={MAX_CONFIDENCE}
                    step="5"
                    value={confidence}
                    onChange={(event) => setConfidence(Number(event.target.value))}
                    style={{ "--slider-progress": `${((confidence - MIN_CONFIDENCE) / (MAX_CONFIDENCE - MIN_CONFIDENCE)) * 100}%` } as React.CSSProperties}
                    aria-valuetext={`${confidence} percent confidence`}
                  />
                  <div className="rc-slider-scale"><span>More detections</span><span>Fewer false positives</span></div>
                  <div className="rc-setting-foot"><span>Hosted model <strong>bj0ij/1</strong></span><span className="rc-mini-pill">{confidence === DEFAULT_CONFIDENCE ? "DEFAULT" : "CUSTOM"}</span></div>
                </>
              )}

              <div className="rc-divider" id="class-settings" />
              <div className="rc-field-row"><label htmlFor="class-size">Enrolled students</label></div>
              <input id="class-size" className="rc-number" type="number" min={1} max={500} value={classSize} onChange={(event) => updateClassSize(Number(event.target.value))} />
              <p className="rc-hint">Used for the attendance rate and absent count.</p>
              <label className="rc-toggle">
                <input type="checkbox" checked={autoLog} onChange={(event) => setAutoLog(event.target.checked)} />
                <span className="rc-toggle-track"><span /></span>
                <span><strong>Log every scan to CSV</strong><small>Date, time, source, method and face count</small></span>
              </label>
            </section>

            <section className="rc-card rc-scanlog" aria-label="Recent scan log">
              <div className="rc-card-head"><h3>Recent Scan Log</h3><a className="rc-link" href={csvUrl} download="attendance_log.csv"><Icon name="download" size={15} />CSV</a></div>
              {records.length > 0 ? (
                <ul>
                  {records.slice(0, 4).map((record, index) => {
                    const count = Number(record.face_count);
                    return (
                      <li key={`${record.date}-${record.time}-log-${index}`}>
                        <span className={`rc-dot ${count > 0 ? "rc-dot-green" : "rc-dot-grey"}`} />
                        <div><strong>{CLASSROOM}</strong><small>{count > 0 ? `${faces(count)} detected` : "No faces detected"} · {SOURCE_LABELS[record.source] ?? record.source}</small></div>
                        <span>{timeAgo(recordDate(record), now)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rc-hint">No rows in the CSV yet.</p>
              )}
            </section>
          </aside>
        </div>

        <footer className="rc-footer"><span>Made for learning, not surveillance. Faces are counted, never identified.</span><span>Rollcall · G1 Smart Attendance System</span></footer>
      </div>

      <canvas ref={frameCanvasRef} className="rc-hidden" aria-hidden="true" />
      <video ref={videoFileRef} className="rc-hidden" muted playsInline preload="auto" aria-hidden="true" />
      {notice && <div className={`rc-toast rc-toast-${notice.tone}`} role="status"><span className="rc-toast-icon"><Icon name={notice.tone === "success" ? "check" : "close"} size={15} /></span><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" size={14} /></button></div>}
    </div>
  );
}
