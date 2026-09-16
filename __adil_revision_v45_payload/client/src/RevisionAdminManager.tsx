import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, Edit3, LockKeyhole, Plus, RefreshCcw, Trash2, Video } from "lucide-react";
import "./revision-admin.css";

type RevisionLevel = "BASIC" | "ADVANCED";

type RevisionCourse = {
  id: string;
  title: string;
  isPublished: boolean;
  thumbnailUrl: string | null;
};

type RevisionVideo = {
  id: string;
  seriesId: string;
  title: string;
  videoProvider: string | null;
  videoId: string | null;
  content: string | null;
  durationSeconds: number;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type RevisionSeries = {
  id: string;
  courseId: string;
  level: RevisionLevel;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  videoCount: number;
  publishedCount: number;
  videos: RevisionVideo[];
};

type RevisionData = {
  course: { id: string; title: string };
  series: RevisionSeries[];
};

type VideoForm = {
  title: string;
  videoProvider: "youtube" | "vimeo";
  videoId: string;
  durationMinutes: string;
  content: string;
  isPublished: boolean;
};

const emptyVideoForm: VideoForm = {
  title: "",
  videoProvider: "youtube",
  videoId: "",
  durationMinutes: "",
  content: "",
  isPublished: false
};

async function readBody(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? `Request failed (HTTP ${response.status}).`);
  return body;
}

function durationLabel(seconds: number) {
  if (!seconds) return "Duration not set";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} min`;
}

export default function RevisionAdminManager() {
  const [courses, setCourses] = useState<RevisionCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [activeLevel, setActiveLevel] = useState<RevisionLevel>("BASIC");
  const [data, setData] = useState<RevisionData | null>(null);
  const [form, setForm] = useState<VideoForm>(emptyVideoForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeSeries = useMemo(
    () => data?.series.find((item) => item.level === activeLevel) ?? null,
    [data, activeLevel]
  );

  async function loadCourses() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/revision/courses");
      const body = await response.json().catch(() => ({})) as { courses?: RevisionCourse[]; message?: string };
      if (!response.ok) throw new Error(body.message ?? "Revision courses could not be loaded.");
      const items = body.courses ?? [];
      setCourses(items);
      setSelectedCourseId((current) => current || items[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revision courses could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRevision(courseId = selectedCourseId) {
    if (!courseId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/revision?courseId=${encodeURIComponent(courseId)}`);
      const body = await response.json().catch(() => ({})) as RevisionData & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Revision Manager data could not be loaded.");
      setData(body);
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : "Revision Manager data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) void loadRevision(selectedCourseId);
  }, [selectedCourseId]);

  function resetForm() {
    setForm(emptyVideoForm);
    setEditingId(null);
  }

  function beginEdit(video: RevisionVideo) {
    setEditingId(video.id);
    setForm({
      title: video.title,
      videoProvider: video.videoProvider === "vimeo" ? "vimeo" : "youtube",
      videoId: video.videoId ?? "",
      durationMinutes: video.durationSeconds ? String(Math.ceil(video.durationSeconds / 60)) : "",
      content: video.content ?? "",
      isPublished: video.isPublished
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId || !activeSeries) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        ...(editingId ? {} : { courseId: selectedCourseId, level: activeLevel }),
        title: form.title,
        videoProvider: form.videoProvider,
        videoId: form.videoId.trim() || null,
        durationSeconds: Math.max(0, Math.round(Number(form.durationMinutes || 0) * 60)),
        content: form.content.trim() || null,
        isPublished: form.isPublished
      };
      const response = await fetch(
        editingId ? `/api/admin/revision/videos/${editingId}` : "/api/admin/revision/videos",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      await readBody(response);
      setMessage(editingId ? "Revision video updated successfully." : "Revision video added successfully.");
      resetForm();
      await loadRevision();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revision video save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(video: RevisionVideo) {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/revision/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !video.isPublished })
      });
      await readBody(response);
      setMessage(video.isPublished ? "Video moved to Draft." : "Video published.");
      await loadRevision();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publish status update failed.");
    }
  }

  async function moveVideo(video: RevisionVideo, direction: "UP" | "DOWN") {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/revision/videos/${video.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction })
      });
      await readBody(response);
      await loadRevision();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Video reorder failed.");
    }
  }

  async function deleteVideo(video: RevisionVideo) {
    if (!window.confirm(`Delete this revision video permanently?\n\n${video.title}`)) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/revision/videos/${video.id}`, { method: "DELETE" });
      await readBody(response);
      setMessage("Revision video permanently deleted.");
      if (editingId === video.id) resetForm();
      await loadRevision();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revision video delete failed.");
    }
  }

  async function changeSeriesStatus(isComplete: boolean) {
    if (!activeSeries) return;
    const levelName = activeLevel === "BASIC" ? "Basic Revision" : "Advanced Revision";
    const confirmation = isComplete
      ? `Mark ${levelName} as Complete?\n\nAll videos must be published and have a valid Video URL or Video ID. Once completed, reopen the series before editing it again.`
      : `Reopen ${levelName}?\n\nThis will allow the Admin to add, edit, delete and reorder videos again.`;
    if (!window.confirm(confirmation)) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/revision/series/${activeSeries.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isComplete })
      });
      await readBody(response);
      setMessage(isComplete ? `${levelName} marked Complete.` : `${levelName} reopened for editing.`);
      resetForm();
      await loadRevision();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Series status update failed.");
    }
  }

  if (loading && !courses.length) {
    return <section className="dash-card workspace-card revision-admin-loading"><h3>Revision Manager loading...</h3></section>;
  }

  return <section className="dash-card workspace-card revision-admin-manager">
    <div className="workspace-heading revision-admin-heading">
      <div>
        <span className="eyebrow">REVISION CONTENT CONTROL</span>
        <h2>Revision Manager</h2>
        <p>Basic Revision සහ Advanced Revision videos normal Course Manager එකෙන් වෙනම manage කරන්න.</p>
      </div>
      <div className="revision-admin-heading-icon"><BookOpen /></div>
    </div>

    {error && <p className="form-error">{error}</p>}
    {message && <p className="form-success">{message}</p>}

    <div className="revision-course-picker">
      <label>
        <span>SELECT COURSE</span>
        <select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); resetForm(); }}>
          {courses.map((course) => <option value={course.id} key={course.id}>{course.title}{course.isPublished ? "" : " — Draft Course"}</option>)}
        </select>
      </label>
      <div className="revision-course-current">
        <small>MANAGING</small>
        <strong>{data?.course.title ?? "Select a course"}</strong>
        <span>{courses.find((course) => course.id === selectedCourseId)?.isPublished ? "Course Published" : "Course Draft"}</span>
      </div>
    </div>

    {!courses.length && <div className="workspace-note"><strong>No courses found.</strong><p>Create a course first, then return to Revision Manager.</p></div>}

    {data && <>
      <div className="revision-level-tabs" role="tablist" aria-label="Revision level">
        {(["BASIC", "ADVANCED"] as RevisionLevel[]).map((level) => {
          const item = data.series.find((series) => series.level === level);
          return <button
            type="button"
            role="tab"
            aria-selected={activeLevel === level}
            className={activeLevel === level ? "active" : ""}
            key={level}
            onClick={() => { setActiveLevel(level); resetForm(); setMessage(""); setError(""); }}
          >
            <span>{level === "BASIC" ? "Basic Revision" : "Advanced Revision"}</span>
            <small>{item?.publishedCount ?? 0}/{item?.videoCount ?? 0} published</small>
          </button>;
        })}
      </div>

      {activeSeries && <>
        <div className={`revision-series-status ${activeSeries.isComplete ? "complete" : "open"}`}>
          <div className="revision-series-status-icon">{activeSeries.isComplete ? <Check /> : <RefreshCcw />}</div>
          <div>
            <span>{activeLevel === "BASIC" ? "BASIC REVISION SERIES" : "ADVANCED REVISION SERIES"}</span>
            <h3>{activeSeries.isComplete ? "Series Complete" : "Series In Progress"}</h3>
            <p>{activeSeries.isComplete
              ? "This series is locked from editing. Reopen it before changing videos."
              : "Record and add videos one by one. Mark Complete only after the full revision series is ready."}</p>
          </div>
          <button
            type="button"
            className={activeSeries.isComplete ? "button button-ghost" : "button button-primary"}
            onClick={() => void changeSeriesStatus(!activeSeries.isComplete)}
          >
            {activeSeries.isComplete ? <><RefreshCcw size={16} /> Reopen Series</> : <><Check size={16} /> Mark Series Complete</>}
          </button>
        </div>

        {!activeSeries.isComplete && <form className="revision-video-form" onSubmit={saveVideo}>
          <div className="revision-video-form-title">
            <span className="revision-form-icon"><Video /></span>
            <div><span className="eyebrow">{editingId ? "EDIT REVISION VIDEO" : "ADD REVISION VIDEO"}</span><h3>{editingId ? "Update video details" : `Add to ${activeLevel === "BASIC" ? "Basic" : "Advanced"} Revision`}</h3></div>
          </div>
          <label>Video title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required minLength={2} placeholder="Example: Market Structure Revision 01" /></label>
          <label>Video provider<select value={form.videoProvider} onChange={(event) => setForm({ ...form, videoProvider: event.target.value as "youtube" | "vimeo" })}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option></select></label>
          <label className="wide">Video URL or Video ID<input value={form.videoId} onChange={(event) => setForm({ ...form, videoId: event.target.value })} placeholder="You can add this later while the series is In Progress" /></label>
          <label>Duration (minutes)<input type="number" min="0" step="1" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} placeholder="Example: 15" /></label>
          <label className="revision-publish-check"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /><span>Publish this video to the Revision system</span></label>
          <label className="wide">Revision notes<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Optional notes for this revision video" /></label>
          <div className="revision-form-actions">
            <button type="submit" className="button button-primary" disabled={saving}><Plus size={16} /> {saving ? "Saving..." : editingId ? "Save Changes" : "Add Revision Video"}</button>
            {editingId && <button type="button" className="button button-ghost" onClick={resetForm}>Cancel Edit</button>}
          </div>
        </form>}

        <div className="revision-video-list-heading">
          <div><span className="eyebrow">VIDEO ORDER</span><h3>{activeLevel === "BASIC" ? "Basic Revision Videos" : "Advanced Revision Videos"}</h3></div>
          <span>{activeSeries.videoCount} video{activeSeries.videoCount === 1 ? "" : "s"}</span>
        </div>

        <div className="revision-video-list">
          {activeSeries.videos.map((video, index) => <article className={`revision-video-row ${video.isPublished ? "published" : "draft"}`} key={video.id}>
            <div className="revision-video-number">{String(video.position).padStart(2, "0")}</div>
            <div className="revision-video-main">
              <div className="revision-video-title-row"><strong>{video.title}</strong><span className={video.isPublished ? "revision-badge published" : "revision-badge draft"}>{video.isPublished ? "PUBLISHED" : "DRAFT"}</span></div>
              <small>{video.videoId ? `${video.videoProvider ?? "youtube"}: ${video.videoId}` : "Video URL / ID not added yet"}</small>
              <span>{durationLabel(video.durationSeconds)}{video.content ? " • Notes added" : ""}</span>
            </div>
            <div className="revision-video-actions">
              <button type="button" title="Move up" disabled={activeSeries.isComplete || index === 0} onClick={() => void moveVideo(video, "UP")}><ArrowUp /></button>
              <button type="button" title="Move down" disabled={activeSeries.isComplete || index === activeSeries.videos.length - 1} onClick={() => void moveVideo(video, "DOWN")}><ArrowDown /></button>
              <button type="button" title="Edit" disabled={activeSeries.isComplete} onClick={() => beginEdit(video)}><Edit3 /></button>
              <button type="button" className="revision-publish-button" disabled={activeSeries.isComplete} onClick={() => void togglePublished(video)}>{video.isPublished ? "Draft" : "Publish"}</button>
              <button type="button" className="danger" title="Delete" disabled={activeSeries.isComplete} onClick={() => void deleteVideo(video)}><Trash2 /></button>
            </div>
          </article>)}
          {!activeSeries.videos.length && <div className="revision-empty-state"><LockKeyhole /><h3>No {activeLevel === "BASIC" ? "Basic" : "Advanced"} Revision videos yet</h3><p>You can build the system now and add recorded videos one by one later.</p></div>}
        </div>
      </>}
    </>}
  </section>;
}
