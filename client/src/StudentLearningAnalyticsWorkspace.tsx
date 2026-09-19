import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  Video,
  Wifi
} from "lucide-react";
import "./student-learning-analytics.css";

type SearchStudent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "student" | "consultant";
  isActive: boolean;
  accountNumber: string | null;
  accountStatus: string | null;
};

type CourseAnalytics = {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  coursePublished: boolean;
  enrollmentStatus: string;
  enrolledAt: string;
  currentStage: string;
  totals: {
    publishedVideos: number;
    watchedVideos: number;
    completedVideos: number;
    learningProgress: number;
  };
  theory: {
    total: number;
    watched: number;
    completed: number;
    percent: number;
  };
  basicRevision: {
    total: number;
    watched: number;
    completed: number;
    percent: number;
    unlocked: boolean;
    seriesComplete: boolean;
  };
  advancedRevision: {
    total: number;
    watched: number;
    completed: number;
    percent: number;
    unlocked: boolean;
    seriesComplete: boolean;
  };
  knowledge: {
    checkPercent: number | null;
    qaRequired: number;
    qaAttempted: number;
    qaPassed: number;
    passPercent: number;
  };
  lastActiveAt: string | null;
  lastVideo: null | {
    type: string;
    title: string;
    at: string;
  };
  status: {
    label: string;
    tone: "success" | "warning" | "danger" | "info";
    reason: string;
  };
};

type AnalyticsDetail = {
  refreshedAt: string;
  refreshSeconds: number;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    joinedAt: string;
    accountNumber: string | null;
    accountStatus: string | null;
  };
  summary: {
    totalCourses: number;
    publishedVideos: number;
    watchedVideos: number;
    completedVideos: number;
    learningProgress: number;
    knowledgeCheck: number | null;
    lastActiveAt: string | null;
  };
  courses: CourseAnalytics[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return date.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function progressWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function LevelCard({
  label,
  icon,
  total,
  watched,
  completed,
  value,
  unlocked = true,
  accent
}: {
  label: string;
  icon: ReactNode;
  total: number;
  watched: number;
  completed: number;
  value: number;
  unlocked?: boolean;
  accent: "gold" | "green" | "purple";
}) {
  return (
    <article className={`sla-level-card sla-level-${accent}${unlocked ? "" : " sla-level-locked"}`}>
      <div className="sla-level-head">
        <span className="sla-level-icon">{icon}</span>
        <span>
          <small>{label}</small>
          <strong>{unlocked ? `${completed} / ${total}` : "LOCKED"}</strong>
        </span>
      </div>
      <div className="sla-level-track">
        <span style={{ width: unlocked ? progressWidth(value) : "0%" }} />
      </div>
      <div className="sla-level-foot">
        <span>{unlocked ? `${value}% complete` : "Not unlocked yet"}</span>
        <span>{watched} watched</span>
      </div>
    </article>
  );
}

export default function StudentLearningAnalyticsWorkspace() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchStudent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnalyticsDetail | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const searchStudents = useCallback(async (text: string) => {
    setSearching(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/student-learning-analytics/search?q=${encodeURIComponent(text)}`
      );
      const data = (await response.json().catch(() => ({}))) as {
        students?: SearchStudent[];
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Student search failed.");
      setResults(data.students ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Student search failed.");
    } finally {
      setSearching(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (userId: string, quiet = false) => {
      if (!quiet) setLoadingDetail(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/student-learning-analytics/${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const data = (await response.json().catch(() => ({}))) as
          | AnalyticsDetail
          | { message?: string };
        if (!response.ok) {
          throw new Error(
            "message" in data && data.message
              ? data.message
              : "Student analytics could not be loaded."
          );
        }
        const analytics = data as AnalyticsDetail;
        setDetail(analytics);
        setSelectedCourseId((current) => {
          if (
            current &&
            analytics.courses.some((course) => course.courseId === current)
          ) {
            return current;
          }
          return analytics.courses[0]?.courseId ?? null;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Student analytics could not be loaded."
        );
      } finally {
        if (!quiet) setLoadingDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchStudents(query);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [query, searchStudents]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
    const timer = window.setInterval(() => {
      void loadDetail(selectedId, true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetail]);

  const selectedCourse = useMemo(
    () =>
      detail?.courses.find((course) => course.courseId === selectedCourseId) ??
      detail?.courses[0] ??
      null,
    [detail, selectedCourseId]
  );

  if (selectedId) {
    return (
      <section className="dash-card workspace-card sla-page">
        <div className="sla-detail-toolbar">
          <button
            type="button"
            className="sla-back"
            onClick={() => {
              setSelectedId(null);
              setDetail(null);
              setSelectedCourseId(null);
            }}
          >
            <ArrowLeft size={18} />
            Back to Student Search
          </button>

          <div className="sla-live">
            <Wifi size={14} />
            LIVE DATABASE • AUTO REFRESH 15s
            <button
              type="button"
              title="Refresh now"
              onClick={() => selectedId && void loadDetail(selectedId)}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        {loadingDetail && !detail ? (
          <div className="sla-loading">
            <Activity />
            Loading live learning data...
          </div>
        ) : detail ? (
          <>
            <div className="sla-student-hero">
              <div className="sla-avatar"><UserRound /></div>
              <div>
                <span className="eyebrow">STUDENT LEARNING ANALYTICS</span>
                <h2>{detail.student.name}</h2>
                <p>
                  {detail.student.accountNumber ?? "No SR/CN yet"} • {detail.student.email}
                  {detail.student.phone ? ` • ${detail.student.phone}` : ""}
                </p>
                <div className="sla-badges">
                  <span>{detail.student.role.toUpperCase()}</span>
                  <span className={detail.student.isActive ? "success" : "danger"}>
                    {detail.student.isActive ? "ACTIVE ACCOUNT" : "INACTIVE ACCOUNT"}
                  </span>
                  {detail.student.accountStatus && <span>{detail.student.accountStatus}</span>}
                </div>
              </div>

              <div className="sla-refresh-meta">
                <small>Last database refresh</small>
                <strong>{formatDateTime(detail.refreshedAt)}</strong>
              </div>
            </div>

            <div className="sla-summary-grid">
              <article>
                <Video />
                <span>Total Videos Watched</span>
                <strong>{detail.summary.watchedVideos}</strong>
                <small>of {detail.summary.publishedVideos} currently published</small>
              </article>
              <article>
                <BarChart3 />
                <span>Learning Progress</span>
                <strong>{detail.summary.learningProgress}%</strong>
                <small>{detail.summary.completedVideos} videos fully completed</small>
              </article>
              <article>
                <BrainCircuit />
                <span>Knowledge Check</span>
                <strong>{detail.summary.knowledgeCheck ?? "—"}{detail.summary.knowledgeCheck !== null ? "%" : ""}</strong>
                <small>Based on completed published Q&A</small>
              </article>
              <article>
                <Clock3 />
                <span>Last Learning Activity</span>
                <strong className="sla-date-value">{formatDateTime(detail.summary.lastActiveAt)}</strong>
                <small>Video heartbeat / completion activity</small>
              </article>
            </div>

            {detail.courses.length > 1 && (
              <div className="sla-course-tabs">
                {detail.courses.map((course) => (
                  <button
                    type="button"
                    key={course.courseId}
                    className={selectedCourse?.courseId === course.courseId ? "active" : ""}
                    onClick={() => setSelectedCourseId(course.courseId)}
                  >
                    {course.courseTitle}
                  </button>
                ))}
              </div>
            )}

            {selectedCourse ? (
              <>
                <div className="sla-course-heading">
                  <div>
                    <span className="eyebrow">CURRENT LEARNING JOURNEY</span>
                    <h3>{selectedCourse.courseTitle}</h3>
                    <p>
                      Current stage: <strong>{selectedCourse.currentStage}</strong>
                    </p>
                  </div>
                  <span className={`sla-status sla-status-${selectedCourse.status.tone}`}>
                    {selectedCourse.status.label}
                  </span>
                </div>

                <div className="sla-level-grid">
                  <LevelCard
                    label="Basic Theory"
                    icon={<BookOpen />}
                    total={selectedCourse.theory.total}
                    watched={selectedCourse.theory.watched}
                    completed={selectedCourse.theory.completed}
                    value={selectedCourse.theory.percent}
                    accent="gold"
                  />
                  <LevelCard
                    label="Basic Revision"
                    icon={<GraduationCap />}
                    total={selectedCourse.basicRevision.total}
                    watched={selectedCourse.basicRevision.watched}
                    completed={selectedCourse.basicRevision.completed}
                    value={selectedCourse.basicRevision.percent}
                    unlocked={selectedCourse.basicRevision.unlocked}
                    accent="green"
                  />
                  <LevelCard
                    label="Advanced Revision"
                    icon={<Target />}
                    total={selectedCourse.advancedRevision.total}
                    watched={selectedCourse.advancedRevision.watched}
                    completed={selectedCourse.advancedRevision.completed}
                    value={selectedCourse.advancedRevision.percent}
                    unlocked={selectedCourse.advancedRevision.unlocked}
                    accent="purple"
                  />
                </div>

                <div className="sla-info-grid">
                  <article className="sla-knowledge-card">
                    <div className="sla-card-title">
                      <BrainCircuit />
                      <div>
                        <span>KNOWLEDGE CHECK</span>
                        <h3>
                          {selectedCourse.knowledge.checkPercent ?? "—"}
                          {selectedCourse.knowledge.checkPercent !== null ? "%" : ""}
                        </h3>
                      </div>
                    </div>
                    <div className="sla-big-track">
                      <span
                        style={{
                          width: progressWidth(
                            selectedCourse.knowledge.checkPercent ?? 0
                          )
                        }}
                      />
                    </div>
                    <div className="sla-stat-row">
                      <span>Q&A required <strong>{selectedCourse.knowledge.qaRequired}</strong></span>
                      <span>Attempted <strong>{selectedCourse.knowledge.qaAttempted}</strong></span>
                      <span>Passed <strong>{selectedCourse.knowledge.qaPassed}</strong></span>
                    </div>
                    <p>
                      Knowledge Check uses the best completed score for each currently
                      published lesson Q&A. Video completion is shown separately as
                      Learning Progress.
                    </p>
                  </article>

                  <article className="sla-activity-card">
                    <div className="sla-card-title">
                      <Activity />
                      <div>
                        <span>LEARNING ACTIVITY</span>
                        <h3>{selectedCourse.status.label}</h3>
                      </div>
                    </div>
                    <p>{selectedCourse.status.reason}</p>
                    <dl>
                      <div>
                        <dt>Last active</dt>
                        <dd>{formatDateTime(selectedCourse.lastActiveAt)}</dd>
                      </div>
                      <div>
                        <dt>Last video</dt>
                        <dd>
                          {selectedCourse.lastVideo
                            ? `${selectedCourse.lastVideo.type} — ${selectedCourse.lastVideo.title}`
                            : "No watched video yet"}
                        </dd>
                      </div>
                      <div>
                        <dt>Course videos</dt>
                        <dd>
                          {selectedCourse.totals.completedVideos} completed /{" "}
                          {selectedCourse.totals.publishedVideos} published
                        </dd>
                      </div>
                    </dl>
                  </article>
                </div>

                <div className="sla-dynamic-note">
                  <ShieldCheck />
                  <div>
                    <strong>Live content totals</strong>
                    <span>
                      Theory totals come from the videos currently attached to this
                      course. Revision totals count only currently Published Basic /
                      Advanced Revision videos. Add, remove, publish or unpublish
                      content and this page recalculates automatically from the
                      database.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="sla-empty">
                <BookOpen />
                <h3>No course enrollment found</h3>
                <p>This account does not currently have course learning data.</p>
              </div>
            )}
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section className="dash-card workspace-card sla-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">LIVE STUDENT PERFORMANCE</span>
          <h2>Student Learning Analytics</h2>
          <p>
            Search by SR/CN number, student name, email or phone to view live
            Theory, Q&A, Basic Revision and Advanced Revision progress.
          </p>
        </div>
        <div className="sla-live sla-live-static">
          <Wifi size={14} />
          DATABASE DRIVEN
        </div>
      </div>

      <div className="sla-search">
        <Search />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search SR527694, CN527695, name, email or phone..."
        />
        {searching && <RefreshCw className="sla-search-spin" />}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="sla-search-list">
        <div className="sla-search-head">
          <span>STUDENT</span>
          <span>SR / CN</span>
          <span>ACCOUNT</span>
          <span>OPEN ANALYTICS</span>
        </div>

        {results.map((student) => (
          <button
            key={student.id}
            type="button"
            className="sla-search-row"
            onClick={() => setSelectedId(student.id)}
          >
            <span className="sla-search-person">
              <i><UserRound /></i>
              <b>
                {student.name}
                <small>
                  {student.email}
                  {student.phone ? ` • ${student.phone}` : ""}
                </small>
              </b>
            </span>
            <strong>{student.accountNumber ?? "Pending"}</strong>
            <span>
              <b>{student.isActive ? "Active" : "Inactive"}</b>
              <small>{student.role} • {student.accountStatus ?? "No account status"}</small>
            </span>
            <span className="sla-open">
              View Learning Profile <BarChart3 size={16} />
            </span>
          </button>
        ))}

        {!searching && !results.length && (
          <div className="sla-empty">
            <Search />
            <h3>No matching students</h3>
            <p>Try an SR/CN number, name, email address or phone number.</p>
          </div>
        )}
      </div>
    </section>
  );
}
