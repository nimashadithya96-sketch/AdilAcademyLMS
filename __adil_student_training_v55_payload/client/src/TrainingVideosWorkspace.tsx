import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import CcoTrainingVideosWorkspace from "./CcoTrainingVideosWorkspace";
import "./student-training-videos.css";

type AdminVideo = {
  id: string;
  title: string;
  description: string | null;
  videoProvider: string;
  videoId: string;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type VideoPlayerProps = {
  provider: string | null | undefined;
  rawValue: string | null | undefined;
  title: string;
  watermark?: string;
};

const emptyForm = {
  title: "",
  description: "",
  videoProvider: "youtube" as "youtube" | "vimeo",
  videoId: "",
  isPublished: false
};

function StudentTrainingVideosManager({
  VideoPlayer
}: {
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/student-training/videos");
    const data = await response.json().catch(() => ({ videos: [] })) as {
      videos?: AdminVideo[];
      message?: string;
    };
    if (!response.ok) throw new Error(data.message ?? "Student training videos load failed.");
    setVideos(data.videos ?? []);
  }

  useEffect(() => {
    load().catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setEditingId("");
    setForm({ ...emptyForm });
  }

  function edit(video: AdminVideo) {
    setEditingId(video.id);
    setForm({
      title: video.title,
      description: video.description ?? "",
      videoProvider: video.videoProvider === "vimeo" ? "vimeo" : "youtube",
      videoId: video.videoId,
      isPublished: video.isPublished
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/student-training/videos/${editingId}` : "/api/admin/student-training/videos",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim() || null,
            videoProvider: form.videoProvider,
            videoId: form.videoId.trim(),
            isPublished: form.isPublished
          })
        }
      );
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Student training video save failed.");
      setMessage(editingId ? "Student training video updated." : "Student training video added.");
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student training video save failed.");
    } finally {
      setWorking(false);
    }
  }

  async function togglePublish(video: AdminVideo) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/student-training/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !video.isPublished })
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Publish status update failed.");
      setMessage(video.isPublished ? "Student video moved to Draft." : "Student video Published.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publish status update failed.");
    } finally {
      setWorking(false);
    }
  }

  async function move(video: AdminVideo, direction: "UP" | "DOWN") {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/student-training/videos/${video.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction })
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Video reorder failed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video reorder failed.");
    } finally {
      setWorking(false);
    }
  }

  async function remove(video: AdminVideo) {
    if (!window.confirm(`Delete Student Training video: ${video.title}?`)) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/student-training/videos/${video.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? "Video delete failed.");
      }
      if (editingId === video.id) resetForm();
      if (previewId === video.id) setPreviewId("");
      setMessage("Student training video deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video delete failed.");
    } finally {
      setWorking(false);
    }
  }

  const preview = videos.find((video) => video.id === previewId) ?? null;
  const errorMessage = /failed|not found|error/i.test(message);

  return (
    <div className="student-training-admin">
      <section className="dash-card workspace-card">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">STUDENT GETTING STARTED</span>
            <h2>Student Training Videos</h2>
            <p>
              Studentsට registration, payment, account activation සහ course access ගැන
              step-by-step videos add කරන්න.
            </p>
          </div>
        </div>

        {message && <p className={errorMessage ? "form-error" : "form-success"}>{message}</p>}

        <form className="student-training-form" onSubmit={save}>
          <label>
            Video title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. How to Register for Your Course"
              required
            />
          </label>

          <label>
            Video provider
            <select
              value={form.videoProvider}
              onChange={(event) => setForm({
                ...form,
                videoProvider: event.target.value as "youtube" | "vimeo"
              })}
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
            </select>
          </label>

          <label className="wide">
            YouTube / Vimeo URL or Video ID
            <input
              value={form.videoId}
              onChange={(event) => setForm({ ...form, videoId: event.target.value })}
              placeholder="https://youtu.be/... or Video ID"
              required
            />
          </label>

          <label className="wide">
            Short description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="මෙම step එකෙන් studentට කරන්න ඕන දේ..."
            />
          </label>

          <label className="student-training-publish">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) => setForm({ ...form, isPublished: event.target.checked })}
            />
            Publish immediately
          </label>

          <div className="student-training-form-actions">
            <button className="button button-primary" disabled={working}>
              {working ? "Saving..." : editingId ? "Save Changes" : "+ Add New Video"}
            </button>
            {editingId && (
              <button type="button" className="button button-ghost" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="dash-card workspace-card">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">STEP ORDER</span>
            <h2>Student Getting Started Video List</h2>
            <p>Published videos විතරක් public Student Getting Started Guide එකේ පෙන්වයි.</p>
          </div>
          <span className="student-training-count">{videos.length} Videos</span>
        </div>

        {loading && <p>Loading Student Training videos...</p>}
        {!loading && !videos.length && (
          <div className="workspace-note">
            <strong>Student videos තවම add කර නැහැ.</strong>
            <p>ඉහළ form එකෙන් පළමු Getting Started video එක add කරන්න.</p>
          </div>
        )}

        <div className="student-training-list">
          {videos.map((video, index) => (
            <article key={video.id}>
              <span className="student-training-admin-step">{String(index + 1).padStart(2, "0")}</span>

              <div className="student-training-item-copy">
                <div>
                  <strong>{video.title}</strong>
                  <span className={video.isPublished ? "status-badge success" : "status-badge"}>
                    {video.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                <p>{video.description || "No description"}</p>
                <small>{video.videoProvider} · {video.videoId}</small>
              </div>

              <div className="student-training-actions">
                <button type="button" disabled={working || index === 0} onClick={() => void move(video, "UP")}>↑</button>
                <button type="button" disabled={working || index === videos.length - 1} onClick={() => void move(video, "DOWN")}>↓</button>
                <button type="button" onClick={() => setPreviewId(previewId === video.id ? "" : video.id)}>
                  {previewId === video.id ? "Close Preview" : "Preview"}
                </button>
                <button type="button" onClick={() => edit(video)}>Edit</button>
                <button type="button" disabled={working} onClick={() => void togglePublish(video)}>
                  {video.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button type="button" className="danger" disabled={working} onClick={() => void remove(video)}>Delete</button>
              </div>
            </article>
          ))}
        </div>

        {preview && (
          <div className="student-training-preview">
            <div>
              <span className="eyebrow">ADMIN PREVIEW</span>
              <h3>{preview.title}</h3>
            </div>
            <VideoPlayer
              key={preview.id}
              provider={preview.videoProvider}
              rawValue={preview.videoId}
              title={preview.title}
              watermark="ADIL ACADEMY • STUDENT TRAINING PREVIEW"
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default function TrainingVideosWorkspace({
  VideoPlayer
}: {
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [tab, setTab] = useState<"STUDENT" | "CCO">("STUDENT");

  return (
    <div className="training-videos-hub">
      <section className="dash-card workspace-card training-videos-hub-header">
        <div>
          <span className="eyebrow">ADIL ACADEMY TRAINING CENTER</span>
          <h2>Training Videos</h2>
          <p>Student onboarding videos සහ CCO setup videos එකම තැනකින් වෙන වෙනම manage කරන්න.</p>
        </div>
        <div className="training-videos-tabs" role="tablist" aria-label="Training video groups">
          <button
            type="button"
            className={tab === "STUDENT" ? "active" : ""}
            onClick={() => setTab("STUDENT")}
          >
            Student Training
          </button>
          <button
            type="button"
            className={tab === "CCO" ? "active" : ""}
            onClick={() => setTab("CCO")}
          >
            CCO Training
          </button>
        </div>
      </section>

      {tab === "STUDENT"
        ? <StudentTrainingVideosManager VideoPlayer={VideoPlayer} />
        : <CcoTrainingVideosWorkspace VideoPlayer={VideoPlayer} />}
    </div>
  );
}
