import {
  useEffect,
  useRef,
  useState,
  type ComponentType
} from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import "./student-revision.css";

type VideoPlayerProps = {
  provider: string | null | undefined;
  rawValue: string | null | undefined;
  title: string;
  watermark?: string;
  trackingEnabled?: boolean;
  initialWatchedSeconds?: number;
  initialPositionSeconds?: number;
  onDurationDetected?: (durationSeconds: number) => void;
  onWatchHeartbeat?: (elapsedSeconds: number, durationSeconds: number) => void;
  onPositionChange?: (currentTimeSeconds: number, durationSeconds: number, force?: boolean) => void;
};

type RevisionVideoView = {
  id: string;
  title: string;
  position: number;
  durationSeconds: number;
  progressPercent: number;
  watchedSeconds: number;
  resumeSeconds: number;
  locked: boolean;
  lockReason: string | null;
  lockMessage: string | null;
};

type RevisionLevelView = {
  level: "BASIC" | "ADVANCED";
  unlocked: boolean;
  seriesComplete: boolean;
  completedVideos: number;
  totalVideos: number;
  currentBatchStartPosition?: number;
  currentBatchEndPosition?: number;
  nextUnlockAt: string | null;
  limitMessage: string | null;
  videos: RevisionVideoView[];
};

type RevisionOverview = {
  courseId: string | null;
  courseTitle: string | null;
  revisionUnlocked: boolean;
  welcomePending: boolean;
  advancedUnlocked: boolean;
  advancedCongratulationsPending: boolean;
  newlyRevisionUnlocked?: boolean;
  newlyAdvancedUnlocked?: boolean;
  serverNow: string;
  eligibility: {
    eligible: boolean;
    totalLessons: number;
    completedLessons: number;
    qaRequiredLessons: number;
    qaPassedLessons: number;
    missingVideoCompletions: number;
    missingQaPasses: number;
  };
  basic: RevisionLevelView | null;
  advanced: RevisionLevelView | null;
};

type RevisionDetail = {
  video: {
    id: string;
    title: string;
    level: "BASIC" | "ADVANCED";
    courseTitle: string;
    videoProvider: string | null;
    videoId: string | null;
    content: string | null;
    durationSeconds: number;
    progressPercent: number;
    watchedSeconds: number;
    resumeSeconds: number;
  };
};

function formatWatchTime(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatUnlockTime(value: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-LK", {
      timeZone: "Asia/Colombo",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function levelName(level: "BASIC" | "ADVANCED") {
  return level === "BASIC" ? "Basic Revision" : "Advanced Revision";
}

export default function StudentRevisionCenter({
  VideoPlayer
}: {
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [overview, setOverview] = useState<RevisionOverview | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<"BASIC" | "ADVANCED">("BASIC");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const detailRef = useRef<RevisionDetail | null>(null);
  const queuedWatchSecondsRef = useRef(0);
  const syncBusyRef = useRef(false);
  const detectedDurationRef = useRef(0);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  async function loadOverview(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/student/revision");
      const data = await response.json().catch(() => ({})) as RevisionOverview & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Revision details could not be loaded.");
      setOverview(data);
      if (selectedLevel === "ADVANCED" && !data.advancedUnlocked) setSelectedLevel("BASIC");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Revision details could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => void loadOverview(true), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const level = selectedLevel === "BASIC" ? overview?.basic : overview?.advanced;

  async function openVideo(video: RevisionVideoView) {
    setMessage("");
    setError("");
    if (video.locked) {
      setMessage(video.lockMessage ?? "This revision video is locked.");
      return;
    }

    setSelectedVideoId(video.id);
    setLoadingVideo(true);
    try {
      const response = await fetch(`/api/student/revision/videos/${video.id}`);
      const data = await response.json().catch(() => ({})) as RevisionDetail & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Revision video could not be opened.");
      setDetail(data);
      detailRef.current = data;
      detectedDurationRef.current = data.video.durationSeconds;
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Revision video could not be opened.");
    } finally {
      setLoadingVideo(false);
    }
  }

  async function flushProgressQueue() {
    if (syncBusyRef.current || queuedWatchSecondsRef.current < 1) return;
    const currentDetail = detailRef.current;
    if (!currentDetail) return;

    syncBusyRef.current = true;
    setSyncing(true);
    const elapsedSeconds = Math.min(15, Math.max(1, Math.floor(queuedWatchSecondsRef.current)));
    queuedWatchSecondsRef.current -= elapsedSeconds;

    try {
      const response = await fetch("/api/student/revision/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionVideoId: currentDetail.video.id,
          elapsedSeconds,
          durationSeconds: Math.max(10, Math.round(detectedDurationRef.current || currentDetail.video.durationSeconds || 10))
        })
      });
      const data = await response.json().catch(() => ({})) as {
        message?: string;
        progress?: {
          progressPercent: number;
          watchedSeconds: number;
          resumeSeconds: number;
        };
        durationSeconds?: number;
        overview?: RevisionOverview;
      };
      if (!response.ok) throw new Error(data.message ?? "Revision progress could not be saved.");
      if (data.progress) {
        const nextDetail: RevisionDetail = {
          video: {
            ...currentDetail.video,
            progressPercent: data.progress.progressPercent,
            watchedSeconds: data.progress.watchedSeconds,
            durationSeconds: data.durationSeconds ?? currentDetail.video.durationSeconds
          }
        };
        detailRef.current = nextDetail;
        setDetail(nextDetail);
      }
      if (data.overview) setOverview(data.overview);
      else await loadOverview(true);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Revision progress could not be saved.");
    } finally {
      syncBusyRef.current = false;
      setSyncing(false);
      if (queuedWatchSecondsRef.current >= 1) {
        window.setTimeout(() => void flushProgressQueue(), 900);
      }
    }
  }

  function handleWatchHeartbeat(elapsedSeconds: number, durationSeconds: number) {
    const currentDetail = detailRef.current;
    if (!currentDetail || currentDetail.video.progressPercent >= 100) return;
    detectedDurationRef.current = durationSeconds;
    queuedWatchSecondsRef.current += elapsedSeconds;
    void flushProgressQueue();
  }

  async function handlePlaybackPosition(currentTimeSeconds: number, durationSeconds: number) {
    const currentDetail = detailRef.current;
    if (!currentDetail || durationSeconds <= 0) return;
    try {
      const response = await fetch("/api/student/revision/resume-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          revisionVideoId: currentDetail.video.id,
          currentTimeSeconds: Math.max(0, Math.floor(currentTimeSeconds)),
          durationSeconds: Math.max(0, Math.round(durationSeconds))
        })
      });
      if (response.ok) {
        const nextDetail = {
          video: {
            ...currentDetail.video,
            resumeSeconds: Math.max(0, Math.floor(currentTimeSeconds))
          }
        };
        detailRef.current = nextDetail;
        setDetail(nextDetail);
      }
    } catch {
      // Resume saving is best-effort. Watch progress remains authoritative.
    }
  }

  function handleDurationDetected(durationSeconds: number) {
    detectedDurationRef.current = durationSeconds;
    const currentDetail = detailRef.current;
    if (!currentDetail || currentDetail.video.durationSeconds === durationSeconds) return;
    const nextDetail = {
      video: { ...currentDetail.video, durationSeconds }
    };
    detailRef.current = nextDetail;
    setDetail(nextDetail);
  }

  function chooseLevel(next: "BASIC" | "ADVANCED") {
    if (next === "ADVANCED" && !overview?.advancedUnlocked) {
      setMessage("Complete every Basic Revision video before Advanced Revision unlocks.");
      return;
    }
    setSelectedLevel(next);
    setSelectedVideoId("");
    setDetail(null);
    detailRef.current = null;
    setMessage("");
    setError("");
  }

  if (loading) {
    return <section className="dash-card workspace-card revision-student-center"><div className="revision-loading"><GraduationCap /><h3>Revision Center loading...</h3></div></section>;
  }

  if (error && !overview) {
    return <section className="dash-card workspace-card revision-student-center"><div className="workspace-note"><strong>Revision Center could not be loaded.</strong><p>{error}</p></div></section>;
  }

  if (!overview?.revisionUnlocked) {
    return <section className="dash-card workspace-card revision-student-center">
      <div className="revision-locked-hero">
        <div className="revision-lock-orb"><LockKeyhole /></div>
        <span className="eyebrow">ADIL ACADEMY REVISION CENTER</span>
        <h2>Revision is Locked</h2>
        <p>Complete every My Course lesson and pass every Q&A assessment before Revision becomes available.</p>
        <div className="revision-requirement-grid">
          <div><BookOpen /><span>Course Videos</span><strong>{overview?.eligibility.completedLessons ?? 0}/{overview?.eligibility.totalLessons ?? 0} completed</strong></div>
          <div><ShieldCheck /><span>Q&A Assessments</span><strong>{overview?.eligibility.qaPassedLessons ?? 0}/{overview?.eligibility.totalLessons ?? 0} passed</strong></div>
        </div>
      </div>
    </section>;
  }

  const currentVideo = detail?.video;
  const currentLevelName = levelName(selectedLevel);

  return <section className="dash-card workspace-card revision-student-center">
    <div className="revision-center-heading">
      <div>
        <span className="eyebrow">ADIL ACADEMY REVISION CENTER</span>
        <h2>{overview.courseTitle ?? "Course Revision"}</h2>
        <p>Focused revision videos unlock sequentially. Watch at least 80% of each video to continue.</p>
      </div>
      <div className="revision-center-badge"><Sparkles /><span>REVISION ACCESS</span><strong>UNLOCKED</strong></div>
    </div>

    <div className="revision-level-switcher">
      <button type="button" className={selectedLevel === "BASIC" ? "active" : ""} onClick={() => chooseLevel("BASIC")}>
        <span><BookOpen />Basic Revision</span>
        <small>{overview.basic?.completedVideos ?? 0}/{overview.basic?.totalVideos ?? 0} completed</small>
      </button>
      <button type="button" className={`${selectedLevel === "ADVANCED" ? "active" : ""} ${!overview.advancedUnlocked ? "locked" : ""}`} onClick={() => chooseLevel("ADVANCED")}>
        <span>{overview.advancedUnlocked ? <GraduationCap /> : <LockKeyhole />}Advanced Revision</span>
        <small>{overview.advancedUnlocked ? `${overview.advanced?.completedVideos ?? 0}/${overview.advanced?.totalVideos ?? 0} completed` : "Complete Basic Revision first"}</small>
      </button>
    </div>

    {message && <div className="revision-limit-message"><Clock3 /><div><strong>{message.startsWith("Daily") ? "Daily Revision Limit Reached" : "Revision Access"}</strong><p>{message}</p></div></div>}
    {error && <p className="form-error">{error}</p>}

    <div className="revision-progress-strip">
      <div><span>{currentLevelName}</span><strong>{level?.completedVideos ?? 0}/{level?.totalVideos ?? 0} completed</strong></div>
      <div><span>Daily access</span><strong>Up to 3 videos</strong></div>
      <div><span>Unlock rule</span><strong>80% sequential</strong></div>
      {level?.nextUnlockAt && <div><span>Next release</span><strong>{formatUnlockTime(level.nextUnlockAt)}</strong></div>}
    </div>

    {!level?.videos.length ? <div className="revision-empty-state"><GraduationCap /><h3>{currentLevelName} videos are being prepared.</h3><p>Your Admin can add and publish revision videos one by one. New published videos will appear here automatically.</p></div> : <div className="revision-layout">
      <aside className="revision-video-list">
        <div className="revision-list-heading"><span>{currentLevelName.toUpperCase()}</span><strong>{level.currentBatchStartPosition ? `CURRENT SET ${level.currentBatchStartPosition}-${level.currentBatchEndPosition}` : "VIDEO LIBRARY"}</strong></div>
        {level.videos.map((video, index) => <button
          type="button"
          key={video.id}
          aria-disabled={video.locked}
          className={`${selectedVideoId === video.id ? "active" : ""} ${video.locked ? "locked" : ""} ${video.progressPercent >= 100 ? "completed" : ""}`}
          onClick={() => void openVideo(video)}
        >
          <span className="revision-video-number">{String(index + 1).padStart(2, "0")}</span>
          <span className="revision-video-copy"><strong>{video.title}</strong><small>{video.locked ? video.lockReason === "DAILY_LIMIT" ? "Daily limit reached" : "Locked" : video.progressPercent >= 100 ? "Completed" : video.progressPercent ? `${video.progressPercent}% watched` : "Ready to watch"}</small></span>
          <span className="revision-video-state">{video.locked ? <LockKeyhole /> : video.progressPercent >= 100 ? <Check /> : <ChevronRight />}</span>
        </button>)}
      </aside>

      <div className="revision-player-panel">
        {loadingVideo ? <div className="revision-player-empty"><BookOpen /><h3>Revision video loading...</h3></div> : !currentVideo ? <div className="revision-player-empty"><Play /><h3>Select an unlocked revision video</h3><p>Your progress is saved automatically while you watch.</p></div> : <>
          <div className="revision-player-heading">
            <div><span className="eyebrow">{levelName(currentVideo.level).toUpperCase()}</span><h3>{currentVideo.title}</h3><p>{currentVideo.durationSeconds ? `Video duration: ${formatWatchTime(currentVideo.durationSeconds)}` : "Duration will be detected automatically when the video starts."}</p></div>
            <span className={`status-badge ${currentVideo.progressPercent >= 100 ? "success" : "warning"}`}>{currentVideo.progressPercent >= 100 ? "COMPLETED" : `${currentVideo.progressPercent}%`}</span>
          </div>

          {currentVideo.videoId ? <VideoPlayer
            key={currentVideo.id}
            provider={currentVideo.videoProvider}
            rawValue={currentVideo.videoId}
            title={`${currentVideo.title} revision video`}
            watermark="ADIL ACADEMY • REVISION ACCESS"
            trackingEnabled={currentVideo.progressPercent < 100}
            initialWatchedSeconds={currentVideo.watchedSeconds}
            initialPositionSeconds={currentVideo.resumeSeconds}
            onDurationDetected={handleDurationDetected}
            onWatchHeartbeat={handleWatchHeartbeat}
            onPositionChange={handlePlaybackPosition}
          /> : <div className="workspace-note"><strong>Video is not available yet.</strong><p>Admin must add a valid YouTube or Vimeo video before this lesson can play.</p></div>}

          {currentVideo.content && <div className="revision-video-note"><span className="eyebrow">REVISION NOTE</span><p>{currentVideo.content}</p></div>}

          <div className="revision-watch-progress">
            <div><span>Revision progress</span><strong>{currentVideo.progressPercent}%</strong></div>
            <div className="progress-track large"><span style={{ width: `${currentVideo.progressPercent}%` }} /></div>
            <div className="revision-tracking-note"><ShieldCheck /><div><strong>{currentVideo.progressPercent >= 100 ? "Revision video completed" : currentVideo.progressPercent >= 80 ? "Next video access requirement reached" : "Watch time is tracking automatically"}</strong><span>{formatWatchTime(currentVideo.watchedSeconds)} / {currentVideo.durationSeconds ? formatWatchTime(currentVideo.durationSeconds) : "Detecting..."}{syncing ? " · Saving..." : ""}</span><small>80% unlocks the next video in the current 3-video set. 100% completion is required before Advanced Revision can unlock.</small></div></div>
          </div>
        </>}
      </div>
    </div>}
  </section>;
}
