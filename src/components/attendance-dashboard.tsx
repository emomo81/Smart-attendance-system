"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LogSource = "photo" | "video" | "webcam";
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
const SAMPLE_IMAGE = "/images/classroom-sample.jpg";
const SAMPLE_INTERVAL_MS = 2_000;
const MAX_VIDEO_SAMPLES = 60;
const MAX_FRAME_WIDTH = 1280;
const MODE_LABELS: Record<LogSource, string> = { photo: "Photo", video: "Video", webcam: "Webcam" };
const METHOD_LABELS: Record<DetectionMethod, string> = { haar: "Haar cascade", roboflow: "Roboflow" };

type IconName =
  | "grid"
  | "camera"
  | "clock"
  | "settings"
  | "upload"
  | "play"
  | "stop"
  | "download"
  | "scan"
  | "shield"
  | "chevron"
  | "check"
  | "users"
  | "spark"
  | "arrow"
  | "close";

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
    case "grid":
      return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></svg>;
    case "camera":
      return <svg {...common}><path d="M4 7.5h3l1.5-2h7l1.5 2h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" /><circle cx="12" cy="13.25" r="3.35" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.75" /><path d="M12 7v5.25l3.5 2" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.3a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.3a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.3a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 15V3.5" /><path d="m7.75 7.75 4.25-4.25 4.25 4.25" /><path d="M4 14.5v4A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-4" /></svg>;
    case "play":
      return <svg {...common}><path d="m8 5.25 11 6.75-11 6.75V5.25Z" fill="currentColor" stroke="none" /></svg>;
    case "stop":
      return <svg {...common}><rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" stroke="none" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3.5v11" /><path d="m7.75 10.25 4.25 4.25 4.25-4.25" /><path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1" /></svg>;
    case "scan":
      return <svg {...common}><path d="M8 3.5H5.75A2.25 2.25 0 0 0 3.5 5.75V8" /><path d="M16 3.5h2.25a2.25 2.25 0 0 1 2.25 2.25V8" /><path d="M20.5 16v2.25a2.25 2.25 0 0 1-2.25 2.25H16" /><path d="M8 20.5H5.75a2.25 2.25 0 0 1-2.25-2.25V16" /><path d="M7.5 10h9M7.5 14h9" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 21s7-3.3 7-9.25V5.5L12 3 5 5.5v6.25C5 17.7 12 21 12 21Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m8 10 4 4 4-4" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12.5 4.25 4.25L19 7" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M16 4.4a3.5 3.5 0 0 1 0 6.8M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /><path d="m19 16 .75 2.25L22 19l-2.25.75L19 22l-.75-2.25L16 19l2.25-.75L19 16Z" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5-5.5 5.5" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
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

function formatLogDate(record: AttendanceRecord) {
  const date = new Date(`${record.date}T${record.time}Z`);
  if (Number.isNaN(date.getTime())) return `${record.date} · ${record.time}`;
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${isToday ? "Today" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)} · ${time}`;
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
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("A video frame could not be captured."))), "image/jpeg", 0.85);
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

export default function AttendanceDashboard() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [mode, setMode] = useState<LogSource>("photo");
  const [method, setMethod] = useState<DetectionMethod>("haar");
  const [minNeighbors, setMinNeighbors] = useState(5);
  const [autoLog, setAutoLog] = useState(true);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ready" | "offline">("checking");
  const [roboflowConfigured, setRoboflowConfigured] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [isSample, setIsSample] = useState(true);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number; peak: number } | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const [greeting, setGreeting] = useState("Hello");

  const webcamRef = useRef<HTMLVideoElement>(null);
  const videoFileRef = useRef<HTMLVideoElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestInFlightRef = useRef(false);
  const cancelVideoRef = useRef(false);
  const videoUrlRef = useRef<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  // Keep the latest settings readable from the webcam interval without restarting it.
  const settingsRef = useRef({ method, minNeighbors, autoLog });
  useEffect(() => {
    settingsRef.current = { method, minNeighbors, autoLog };
  }, [method, minNeighbors, autoLog]);

  const showNotice = useCallback((message: string, tone: "success" | "error" = "success") => {
    setNotice({ message, tone });
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4_200);
  }, []);

  const detect = useCallback(async (image: Blob, source: LogSource): Promise<DetectionResult> => {
    const { method: currentMethod, minNeighbors: neighbors, autoLog: shouldLog } = settingsRef.current;
    const form = new FormData();
    form.append("image", image, "frame.jpg");
    form.append("method", currentMethod);
    form.append("source", source);
    form.append("min_neighbors", String(neighbors));
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

  const scanPhoto = useCallback(
    async (image: Blob) => {
      setIsBusy(true);
      setCameraError("");
      try {
        const detection = await detect(image, "photo");
        const count = detection.face_count;
        showNotice(`${count} ${count === 1 ? "face" : "faces"} counted with ${METHOD_LABELS[detection.method]}${detection.record ? " · logged to CSV" : ""}`);
      } catch (error) {
        const message = getErrorMessage(error);
        setCameraError(message);
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
    setCameraError("");
    setVideoProgress(null);
  }, []);

  useEffect(() => {
    const now = new Date();
    setTodayLabel(new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now));
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

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
    const video = webcamRef.current;
    if (!cameraStream || !video) return;

    video.srcObject = cameraStream;
    void video.play().catch((error: unknown) => {
      setCameraError(getErrorMessage(error));
      stopCamera();
    });

    // Sample one frame every 2 seconds (not every frame) to save Roboflow credits and server time.
    const interval = window.setInterval(async () => {
      const canvas = frameCanvasRef.current;
      if (!canvas || requestInFlightRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      requestInFlightRef.current = true;
      try {
        await detect(await captureFrame(video, canvas), "webcam");
        setCameraError("");
      } catch (error) {
        setCameraError(getErrorMessage(error));
      } finally {
        requestInFlightRef.current = false;
      }
    }, SAMPLE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      if (video.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraStream, detect, stopCamera]);

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
      cancelVideoRef.current = true;
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const switchMode = useCallback(
    (next: LogSource) => {
      if (next === mode) return;
      stopCamera();
      stopVideo();
      clearStage();
      setMode(next);
    },
    [clearStage, mode, stopCamera, stopVideo],
  );

  const handleCamera = useCallback(async () => {
    if (cameraStream) {
      stopCamera();
      showNotice("Webcam session ended.");
      return;
    }
    clearStage();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access needs a secure (https) browser connection.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setSourceName("Webcam");
      setIsSample(false);
      setCameraStream(stream);
      showNotice("Webcam connected · one frame is analysed every 2 seconds.");
    } catch (error) {
      const message = getErrorMessage(error);
      setCameraError(message);
      showNotice(message, "error");
    }
  }, [cameraStream, clearStage, showNotice, stopCamera]);

  const handlePhotoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setIsSample(false);
      setSourceName(file.name);
      setPhotoBlob(file);
      setPhotoUrl(URL.createObjectURL(file));
      void scanPhoto(file);
    },
    [clearStage, scanPhoto, showNotice],
  );

  const handleSampleScan = useCallback(async () => {
    clearStage();
    setIsSample(true);
    setSourceName("");
    setPhotoUrl(null);
    try {
      const response = await fetch(SAMPLE_IMAGE);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      setPhotoBlob(blob);
      await scanPhoto(blob);
    } catch {
      showNotice("The sample classroom image could not be loaded.", "error");
    }
  }, [clearStage, scanPhoto, showNotice]);

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
      setIsSample(false);
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
        showNotice(
          cancelVideoRef.current
            ? "Video scan stopped."
            : `Video scanned · ${times.length} frames · peak ${peak} ${peak === 1 ? "face" : "faces"}`,
        );
      } catch (error) {
        const message = getErrorMessage(error);
        setCameraError(message);
        showNotice(message, "error");
      } finally {
        setIsBusy(false);
      }
    },
    [clearStage, detect, showNotice],
  );

  const engineLabel =
    backendStatus === "checking" ? "Connecting to server" : backendStatus === "offline" ? "Server offline" : METHOD_LABELS[method];
  const currentLabel = sourceName || (isSample ? "Sample classroom" : MODE_LABELS[mode]);
  const isLive = cameraStream !== null || (videoProgress !== null && isBusy);
  const showPrompt = !result && !cameraStream && !isBusy;
  const csvUrl = `${API_URL}/logs`;

  return (
    <div className="attendance-app" id="overview">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Rollcall home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">rollcall<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-switcher">
          <div className="workspace-icon">C</div>
          <div className="workspace-copy"><span>WORKSPACE</span><strong>Classroom 204</strong></div>
          <Icon name="chevron" size={16} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-link is-current" href="#overview"><Icon name="grid" /><span>Overview</span><span className="nav-dot" /></a>
          <a className="nav-link" href="#detector"><Icon name="camera" /><span>Face detection</span></a>
          <a className="nav-link" href="#activity"><Icon name="clock" /><span>Activity log</span><span className="nav-count">{records.length > 99 ? "99+" : records.length}</span></a>
        </nav>

        <div className="nav-label nav-label-spaced">MANAGE</div>
        <nav className="side-nav" aria-label="Settings navigation">
          <a className="nav-link" href="#settings"><Icon name="settings" /><span>Detection settings</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-mini"><div className="privacy-icon"><Icon name="shield" size={17} /></div><div><strong>Privacy first</strong><span>Faces are counted, never identified.</span></div></div>
          <div className="user-profile"><div className="user-avatar">AD</div><div className="user-copy"><strong>Alex Davis</strong><span>Instructor</span></div><button className="profile-more" type="button" aria-label="Profile options"><span /><span /><span /></button></div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <div className="breadcrumb"><span>Classroom 204</span><span className="breadcrumb-slash">/</span><span>Overview</span></div>
            <h1>{greeting}, Alex <span className="wave">✳</span></h1>
            <p>Here’s what’s happening in your classroom today.</p>
          </div>
          <div className="topbar-actions">
            <div className="date-chip"><span className="date-icon"><Icon name="clock" size={16} /></span><span>{todayLabel || "Today"}</span></div>
            <button className="avatar-button" type="button" aria-label="Instructor profile">AD</button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-strip" aria-label="Privacy note">
            <div className="welcome-icon"><Icon name="spark" size={18} /></div>
            <div><strong>Attendance, made thoughtfully.</strong><span>Count faces in the room—no names, profiles, or identity matching.</span></div>
            <a href="#method">How it works <Icon name="arrow" size={15} /></a>
          </section>

          <div className="section-heading">
            <div><span className="eyebrow">YOUR CLASSROOM</span><h2>Today at a glance</h2></div>
            <div className="cohort-pill"><span className="cohort-dot" />G1 <span className="cohort-divider">·</span> Smart Attendance System</div>
          </div>

          <section className="dashboard-grid" aria-label="Attendance dashboard">
            <article className="preview-card panel-card" id="detector">
              <div className="card-heading preview-heading">
                <div><span className="eyebrow">CAPTURE</span><h3>Classroom preview</h3></div>
                <div className={`feed-status ${isLive ? "feed-status-live" : ""}`}><span className="status-light" />{isLive ? "LIVE" : "READY"}</div>
              </div>

              <div className="mode-tabs" role="tablist" aria-label="Capture source">
                {(Object.keys(MODE_LABELS) as LogSource[]).map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={mode === key} className={`mode-tab ${mode === key ? "is-active" : ""}`} onClick={() => switchMode(key)}>
                    <Icon name={key === "photo" ? "upload" : key === "video" ? "play" : "camera"} size={14} />{MODE_LABELS[key]}
                  </button>
                ))}
              </div>

              <div className="preview-stage">
                {result ? (
                  <img className="preview-media preview-media-contain" src={result.image} alt={`Detection result: ${result.face_count} faces boxed and numbered`} />
                ) : mode === "photo" ? (
                  <img className="preview-media" src={photoUrl ?? SAMPLE_IMAGE} alt={photoUrl ? `Uploaded classroom image: ${sourceName}` : "Sample classroom image for demonstrating face counts"} />
                ) : null}
                {cameraStream && (
                  <video ref={webcamRef} className={result ? "webcam-pip" : "preview-media"} autoPlay muted playsInline aria-label="Live webcam feed" />
                )}
                <div className="preview-vignette" />
                <div className="stage-meta stage-meta-left"><span className="stage-rec-dot" />{cameraStream ? "WEBCAM · LIVE" : mode === "video" ? "VIDEO SCAN" : isSample ? "SAMPLE FRAME" : "PHOTO SCAN"}</div>
                <div className="stage-meta stage-meta-right"><Icon name="scan" size={14} />{method === "haar" ? "HAAR CASCADE" : "ROBOFLOW"}</div>
                {showPrompt && (
                  <div className="sample-prompt">
                    <span className="sample-prompt-icon"><Icon name="scan" size={18} /></span>
                    <strong>{mode === "photo" ? (isSample ? "Your classroom, at a glance" : "Ready to scan this photo") : mode === "video" ? "Upload a classroom video" : "Start the webcam"}</strong>
                    <span>{mode === "photo" ? "Try the sample or upload a photo to begin" : "One frame is analysed every 2 seconds"}</span>
                  </div>
                )}
                {isBusy && <div className="stage-loading"><span className="loading-ring" />{videoProgress ? `Frame ${videoProgress.done} of ${videoProgress.total}…` : "Detecting faces…"}</div>}
                {cameraStream && <div className="live-caption"><span className="live-caption-dot" />Sampling one frame every 2 seconds</div>}
              </div>

              <div className="preview-info-row">
                <div className="source-details"><div className="source-thumbnail"><Icon name={mode === "webcam" ? "camera" : "users"} size={16} /></div><div><strong>{currentLabel}</strong><span>{videoProgress ? `Peak ${videoProgress.peak} ${videoProgress.peak === 1 ? "face" : "faces"} across ${videoProgress.done} sampled frames` : "Face count only · no identity matching"}</span></div></div>
                <div className="engine-tag"><span className={`engine-dot ${backendStatus === "ready" ? "engine-dot-ready" : ""}`} />{engineLabel}</div>
              </div>

              <div className="preview-actions">
                {mode === "photo" && (
                  <>
                    <label className="button-primary upload-label">
                      <Icon name="upload" size={17} />Upload photo
                      <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isBusy} aria-label="Upload a classroom photo" />
                    </label>
                    <button className="button-secondary" type="button" onClick={() => photoBlob && void scanPhoto(photoBlob)} disabled={isBusy || !photoBlob}>
                      <Icon name="scan" size={16} />Scan again
                    </button>
                    <button className="button-text" type="button" onClick={() => void handleSampleScan()} disabled={isBusy}>
                      <Icon name="spark" size={16} />Try sample
                    </button>
                  </>
                )}
                {mode === "video" && (
                  isBusy ? (
                    <button className="button-primary button-stop" type="button" onClick={stopVideo}><Icon name="stop" size={17} />Stop video scan</button>
                  ) : (
                    <label className="button-primary upload-label">
                      <Icon name="upload" size={17} />Upload video
                      <input type="file" accept="video/*" onChange={(event) => void handleVideoChange(event)} aria-label="Upload a classroom video" />
                    </label>
                  )
                )}
                {mode === "webcam" && (
                  <button className={`button-primary ${cameraStream ? "button-stop" : ""}`} type="button" onClick={() => void handleCamera()}>
                    <Icon name={cameraStream ? "stop" : "camera"} size={17} />{cameraStream ? "Stop webcam" : "Start webcam"}
                  </button>
                )}
              </div>

              {cameraError && <div className="inline-error" role="alert"><span>!</span>{cameraError}</div>}
            </article>

            <div className="right-column">
              <article className="count-card">
                <div className="count-card-top"><span className="count-eyebrow">CURRENT FRAME</span><span className={`count-live-tag ${isLive ? "count-live-active" : ""}`}><span />{isLive ? "LIVE" : result ? "SCANNED" : "STANDBY"}</span></div>
                <div className="count-value-row"><strong className="count-value">{result ? String(result.face_count).padStart(2, "0") : "—"}</strong><span className="count-description">{result?.face_count === 1 ? "face" : "faces"}<br />detected</span></div>
                <div className="count-divider" />
                <div className="count-card-bottom"><span><span className="count-mini-icon"><Icon name="users" size={15} /></span>People in view</span><span className="count-source">{result ? `${MODE_LABELS[result.source]} · ${METHOD_LABELS[result.method]}` : "Waiting for a scan"}</span></div>
                <div className="count-art" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
              </article>

              <article className="snapshot-card panel-card">
                <div className="snapshot-icon"><Icon name="clock" size={18} /></div>
                <div className="snapshot-copy"><span className="eyebrow">LOGGED ROWS</span><strong>{records.length}</strong><span>{records.length === 1 ? "CSV entry" : "CSV entries"}</span></div>
                <div className="snapshot-trend"><span className="snapshot-bar snapshot-bar-one" /><span className="snapshot-bar snapshot-bar-two" /><span className="snapshot-bar snapshot-bar-three" /><span className="snapshot-bar snapshot-bar-four" /><span className="snapshot-bar snapshot-bar-five" /></div>
              </article>

              <article className="settings-card panel-card" id="settings">
                <div className="settings-title"><div><span className="eyebrow">DETECTION SETTINGS</span><h3>Fine-tune your scan</h3></div><span className="settings-icon"><Icon name="settings" size={16} /></span></div>
                <div className="neighbor-row"><label htmlFor="method">Detection method</label></div>
                <select id="method" className="method-select" value={method} onChange={(event) => setMethod(event.target.value as DetectionMethod)} disabled={isBusy}>
                  <option value="haar">Haar cascade (OpenCV)</option>
                  <option value="roboflow">Roboflow (face-detection-bj0ij/1)</option>
                </select>
                {method === "roboflow" && !roboflowConfigured && backendStatus === "ready" && (
                  <p className="method-warning">The server has no Roboflow key set, so Roboflow scans will fail.</p>
                )}
                {method === "haar" ? (
                  <>
                    <div className="neighbor-row"><label htmlFor="neighbors">Minimum neighbors</label><span className="neighbor-value">{minNeighbors}</span></div>
                    <input
                      id="neighbors"
                      className="neighbor-slider"
                      type="range"
                      min="3"
                      max="9"
                      step="1"
                      value={minNeighbors}
                      onChange={(event) => setMinNeighbors(Number(event.target.value))}
                      style={{ "--slider-progress": `${((minNeighbors - 3) / 6) * 100}%` } as React.CSSProperties}
                      aria-valuetext={`${minNeighbors} minimum neighbors`}
                    />
                    <div className="slider-scale"><span>More detections</span><span>Fewer false positives</span></div>
                    <div className="setting-foot"><span>Scale factor <strong>1.1</strong></span><span className="default-pill">{minNeighbors === 5 ? "ASSIGNMENT DEFAULT" : "CUSTOM"}</span></div>
                  </>
                ) : (
                  <div className="setting-foot"><span>Confidence <strong>40%</strong></span><span className="default-pill">HOSTED MODEL</span></div>
                )}
              </article>
            </div>
          </section>

          <section className="logging-bar" aria-label="CSV logging">
            <div className="logging-symbol"><Icon name="scan" size={19} /></div>
            <div className="logging-copy"><strong>Log every scan to CSV</strong><span>Each scan appends date, time, source, method and face count on the server.</span></div>
            <span className="logging-source">{MODE_LABELS[mode].toUpperCase()} · {method.toUpperCase()}</span>
            <label className="button-log log-toggle">
              <input type="checkbox" checked={autoLog} onChange={(event) => setAutoLog(event.target.checked)} />
              {autoLog ? "Logging on" : "Logging off"}
            </label>
          </section>

          <section className="activity-section" id="activity">
            <div className="activity-heading"><div><span className="eyebrow">YOUR RECORDS</span><h2>Recent activity</h2></div><div className="activity-tools"><span className="activity-count">{records.length} {records.length === 1 ? "entry" : "entries"}</span><a className="export-button" href={csvUrl} download="attendance_log.csv"><Icon name="download" size={16} />Download CSV</a></div></div>
            <div className="activity-table-wrap panel-card">
              <table className="activity-table">
                <thead><tr><th>RECORDED AT</th><th>FACE COUNT</th><th>SOURCE</th><th>METHOD</th></tr></thead>
                <tbody>
                  {recordsLoading ? (
                    <tr><td className="table-empty" colSpan={4}><span className="small-spinner" />Loading attendance history…</td></tr>
                  ) : records.length > 0 ? (
                    records.slice(0, 6).map((record, index) => {
                      const count = Number(record.face_count);
                      return (
                        <tr key={`${record.date}-${record.time}-${index}`}>
                          <td><span className="table-date-icon"><Icon name="clock" size={14} /></span><span className="table-date">{formatLogDate(record)}</span></td>
                          <td><span className="face-count-pill"><Icon name="users" size={14} />{count} {count === 1 ? "face" : "faces"}</span></td>
                          <td><span className="source-pill"><span className="source-pill-dot" />{MODE_LABELS[record.source] ?? record.source}</span></td>
                          <td><span className="saved-status"><Icon name="check" size={13} />{METHOD_LABELS[record.method] ?? record.method}</span></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td className="table-empty" colSpan={4}><span className="empty-clock"><Icon name="clock" size={18} /></span><strong>{recordsError ? "History is taking a break" : "No rows just yet"}</strong><span>{recordsError || "Run a scan with logging on to add your first CSV row."}</span></td></tr>
                  )}
                </tbody>
              </table>
              {records.length > 6 && <div className="table-footer">Showing the latest 6 of {records.length} rows</div>}
            </div>
          </section>

          <section className="method-note" id="method" aria-label="Detection method">
            <div className="method-note-icon"><Icon name="shield" size={17} /></div>
            <div><strong>What this tool does—and doesn’t do</strong><span>Haar cascade (OpenCV) or a hosted Roboflow face model counts visible faces. It does not identify people or make attendance decisions, and images are not stored. Check difficult lighting and angled views before relying on a count.</span></div>
            <div className="method-spec">{method === "haar" ? <><span>GRAYSCALE</span><span>·</span><span>1.1 SCALE FACTOR</span><span>·</span><span>{minNeighbors} NEIGHBORS</span></> : <><span>ROBOFLOW</span><span>·</span><span>CONFIDENCE 40%</span></>}</div>
          </section>

          <footer className="page-footer"><span>Made for learning, not surveillance.</span><span>Rollcall <span>·</span> G1 Smart Attendance System</span></footer>
        </div>
      </main>

      <canvas ref={frameCanvasRef} className="processing-canvas" aria-hidden="true" />
      <video ref={videoFileRef} className="processing-canvas" muted playsInline preload="auto" aria-hidden="true" />
      {notice && <div className={`toast toast-${notice.tone}`} role="status"><span className="toast-icon"><Icon name={notice.tone === "success" ? "check" : "close"} size={16} /></span><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" size={15} /></button></div>}
    </div>
  );
}
