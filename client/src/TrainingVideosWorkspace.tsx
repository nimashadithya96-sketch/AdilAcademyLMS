import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import CcoTrainingVideosWorkspace from "./CcoTrainingVideosWorkspace";
import "./student-training-videos.css";

type AccessType = "FREE" | "PAID";

type AdminVideo = {
  id: string;
  title: string;
  description: string | null;
  videoProvider: string;
  videoId: string;
  position: number;
  accessType: AccessType;
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

function makeEmptyForm(accessType: AccessType) {
  return {
    title: "",
    description: "",
    videoProvider: "youtube" as "youtube" | "vimeo",
    videoId: "",
    accessType,
    isPublished: false
  };
}

function StudentTrainingVideosManager({
  VideoPlayer
}: {
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [category, setCategory] = useState<AccessType>("FREE");
  const [form, setForm] = useState(makeEmptyForm("FREE"));
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
    setVideos((data.videos ?? []).map((video) => ({ ...video, accessType: video.accessType ?? "FREE" })));
  }

  useEffect(() => {
    load().catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  const visibleVideos = useMemo(
    () => videos.filter((video) => video.accessType === category),
    [videos, category]
  );

  function switchCategory(next: AccessType) {
    setCategory(next);
    setPreviewId("");
    if (!editingId) setForm(makeEmptyForm(next));
  }

  function resetForm(nextCategory: AccessType = category) {
    setEditingId("");
    setForm(makeEmptyForm(nextCategory));
  }

  function edit(video: AdminVideo) {
    setCategory(video.accessType);
    setEditingId(video.id);
    setForm({
      title: video.title,
      description: video.description ?? "",
      videoProvider: video.videoProvider === "vimeo" ? "vimeo" : "youtube",
      videoId: video.videoId,
      accessType: video.accessType,
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
            accessType: form.accessType,
            isPublished: form.isPublished
          })
        }
      );
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Student training video save failed.");
      setMessage(editingId ? "Student training video updated." : `${form.accessType} Student Training video added.`);
      const savedCategory = form.accessType;
      setCategory(savedCategory);
      resetForm(savedCategory);
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
    if (!window.confirm(`Delete ${video.accessType} Student Training video: ${video.title}?`)) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/student-training/videos/${video.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? "Video delete failed.");
      }
      if (editingId === video.id) resetForm(video.accessType);
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
  const freeCount = videos.filter((video) => video.accessType === "FREE").length;
  const paidCount = videos.filter((video) => video.accessType === "PAID").length;

  return (
    <div className="student-training-admin">
      <section className="dash-card workspace-card student-training-access-manager">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">STUDENT TRAINING ACCESS</span>
            <h2>Free / Paid Training Videos</h2>
            <p>
              FREE = public page එකෙන් account එකක් නැතිවම play කළ හැක. PAID = public page එකේ locked ලෙස පෙනෙන අතර
              active course account එකකින් login වූ පසු unlock වේ.
            </p>
          </div>
        </div>

        <div className="student-training-access-tabs" role="tablist" aria-label="Free and paid student training videos">
          <button type="button" className={category === "FREE" ? "active free" : ""} onClick={() => switchCategory("FREE")}>
            FREE Videos <span>{freeCount}</span>
          </button>
          <button type="button" className={category === "PAID" ? "active paid" : ""} onClick={() => switchCategory("PAID")}>
            PAID Videos <span>{paidCount}</span>
          </button>
        </div>
      </section>

      <section className="dash-card workspace-card">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">{category} STUDENT TRAINING</span>
            <h2>{editingId ? "Edit Training Video" : `Add ${category} Training Video`}</h2>
            <p>
              {category === "FREE"
                ? "මෙහි publish කරන videos public Student Getting Started page එකෙන් direct play කළ හැක."
                : "මෙහි publish කරන videos public page එකේ locked ලෙස පෙන්වයි; active student account එකකින් login වුණාම play කළ හැක."}
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
              placeholder="e.g. How to Buy Your Course"
              required
            />
          </label>

          <label>
            Access type
            <select
              value={form.accessType}
              onChange={(event) => {
                const accessType = event.target.value as AccessType;
                setForm({ ...form, accessType });
                setCategory(accessType);
              }}
            >
              <option value="FREE">FREE — Public can watch</option>
              <option value="PAID">PAID — Student account unlock</option>
            </select>
          </label>

          <label>
            Video provider
            <select
              value={form.videoProvider}
              onChange={(event) => setForm({ ...form, videoProvider: event.target.value as "youtube" | "vimeo" })}
            >
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
            </select>
          </label>

          <label>
            Publish status
            <select
              value={form.isPublished ? "PUBLISHED" : "DRAFT"}
              onChange={(event) => setForm({ ...form, isPublished: event.target.value === "PUBLISHED" })}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
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
              placeholder="මෙම training video එකේ studentට කියලා දෙන දේ..."
            />
          </label>

          <div className="student-training-form-actions">
            <button className="button button-primary" disabled={working}>
              {working ? "Saving..." : editingId ? "Save Changes" : `+ Add ${category} Video`}
            </button>
            {editingId && (
              <button type="button" className="button button-ghost" onClick={() => resetForm(category)}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="dash-card workspace-card">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">{category} VIDEO LIST</span>
            <h2>{category === "FREE" ? "Public Free Training Videos" : "Student Account Paid Training Videos"}</h2>
            <p>
              {category === "FREE"
                ? "Published FREE videos public page එකෙන් play වෙයි."
                : "Published PAID videos public page එකේ locked ලෙස පෙනේ; enrolled student login එකෙන් unlock වෙයි."}
            </p>
          </div>
          <span className="student-training-count">{visibleVideos.length} Videos</span>
        </div>

        {loading && <p>Loading Student Training videos...</p>}
        {!loading && !visibleVideos.length && (
          <div className="workspace-note">
            <strong>{category} videos තවම add කර නැහැ.</strong>
            <p>ඉහළ form එකෙන් පළමු {category} Training video එක add කරන්න.</p>
          </div>
        )}

        <div className="student-training-list">
          {visibleVideos.map((video, index) => (
            <article key={video.id}>
              <span className="student-training-admin-step">{String(index + 1).padStart(2, "0")}</span>

              <div className="student-training-item-copy">
                <div>
                  <strong>{video.title}</strong>
                  <span className={`student-training-access-badge ${video.accessType.toLowerCase()}`}>{video.accessType}</span>
                  <span className={video.isPublished ? "status-badge success" : "status-badge"}>
                    {video.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                <p>{video.description || "No description"}</p>
                <small>{video.videoProvider} · {video.videoId}</small>
              </div>

              <div className="student-training-actions">
                <button type="button" disabled={working || index === 0} onClick={() => void move(video, "UP")}>↑</button>
                <button type="button" disabled={working || index === visibleVideos.length - 1} onClick={() => void move(video, "DOWN")}>↓</button>
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
              <span className={`student-training-access-badge ${preview.accessType.toLowerCase()}`}>{preview.accessType} ADMIN PREVIEW</span>
              <h3>{preview.title}</h3>
            </div>
            <VideoPlayer
              key={preview.id}
              provider={preview.videoProvider}
              rawValue={preview.videoId}
              title={preview.title}
              watermark={`ADIL ACADEMY • ${preview.accessType} TRAINING PREVIEW`}
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
          <p>Student FREE/PAID training videos සහ CCO setup videos එකම තැනකින් වෙන වෙනම manage කරන්න.</p>
        </div>
        <div className="training-videos-tabs" role="tablist" aria-label="Training video groups">
          <button type="button" className={tab === "STUDENT" ? "active" : ""} onClick={() => setTab("STUDENT")}>
            Student Training
          </button>
          <button type="button" className={tab === "CCO" ? "active" : ""} onClick={() => setTab("CCO")}>
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
