import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import "./cco-setup-guide.css";

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

export default function CcoTrainingVideosWorkspace({
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
    const response = await fetch("/api/admin/cco-setup-guide/videos");
    const data = await response.json().catch(() => ({ videos: [] })) as { videos?: AdminVideo[]; message?: string };
    if (!response.ok) throw new Error(data.message ?? "CCO training videos load failed.");
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
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/admin/cco-setup-guide/videos/${editingId}` : "/api/admin/cco-setup-guide/videos", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          videoProvider: form.videoProvider,
          videoId: form.videoId.trim(),
          isPublished: form.isPublished
        })
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Video save failed.");
      setMessage(editingId ? "CCO training video updated." : "CCO training video added.");
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video save failed.");
    } finally {
      setWorking(false);
    }
  }

  async function togglePublish(video: AdminVideo) {
    setWorking(true); setMessage("");
    const response = await fetch(`/api/admin/cco-setup-guide/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !video.isPublished })
    });
    const data = await response.json().catch(() => ({})) as { message?: string };
    setMessage(response.ok ? (video.isPublished ? "Video moved to Draft." : "Video Published.") : data.message ?? "Publish status update failed.");
    if (response.ok) await load();
    setWorking(false);
  }

  async function move(video: AdminVideo, direction: "UP" | "DOWN") {
    setWorking(true); setMessage("");
    const response = await fetch(`/api/admin/cco-setup-guide/videos/${video.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction })
    });
    const data = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) setMessage(data.message ?? "Video reorder failed.");
    else await load();
    setWorking(false);
  }

  async function remove(video: AdminVideo) {
    if (!window.confirm(`Delete CCO training video: ${video.title}?`)) return;
    setWorking(true); setMessage("");
    const response = await fetch(`/api/admin/cco-setup-guide/videos/${video.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "Video delete failed.");
    } else {
      if (editingId === video.id) resetForm();
      if (previewId === video.id) setPreviewId("");
      setMessage("CCO training video deleted.");
      await load();
    }
    setWorking(false);
  }

  const preview = videos.find((video) => video.id === previewId) ?? null;
  const errorMessage = /failed|not found|error/i.test(message);

  return (
    <div className="cco-training-admin">
      <section className="dash-card workspace-card cco-training-editor">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">CCO SETUP GUIDE</span>
            <h2>CCO Training Videos</h2>
            <p>Consultantsට CCO account එක open සහ setup කරගන්න step-by-step videos manage කරන්න.</p>
          </div>
        </div>

        {message && <p className={errorMessage ? "form-error" : "form-success"}>{message}</p>}

        <form className="cco-training-form" onSubmit={save}>
          <label>Video title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Create Your CCO Main Account" required /></label>
          <label>Video provider<select value={form.videoProvider} onChange={(event) => setForm({ ...form, videoProvider: event.target.value as "youtube" | "vimeo" })}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option></select></label>
          <label className="wide">YouTube / Vimeo URL or Video ID<input value={form.videoId} onChange={(event) => setForm({ ...form, videoId: event.target.value })} placeholder="https://youtu.be/... or Video ID" required /></label>
          <label className="wide">Short description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="මෙම step එකෙන් consultantට කරන්න ඕන දේ..." /></label>
          <label className="cco-training-publish"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /> Publish immediately</label>
          <div className="cco-training-form-actions">
            <button className="button button-primary" disabled={working}>{working ? "Saving..." : editingId ? "Save Changes" : "+ Add New Video"}</button>
            {editingId && <button type="button" className="button button-ghost" onClick={resetForm}>Cancel Edit</button>}
          </div>
        </form>
      </section>

      <section className="dash-card workspace-card">
        <div className="workspace-heading">
          <div><span className="eyebrow">STEP ORDER</span><h2>Setup Guide Video List</h2><p>Published videos විතරක් public CCO Setup Guide එකේ පෙන්වයි.</p></div>
          <span className="cco-training-count">{videos.length} Videos</span>
        </div>

        {loading && <p>Loading CCO training videos...</p>}
        {!loading && !videos.length && <div className="workspace-note"><strong>Videos තවම add කර නැහැ.</strong><p>ඉහළ form එකෙන් පළමු CCO Setup Guide video එක add කරන්න.</p></div>}

        <div className="cco-training-list">
          {videos.map((video, index) => (
            <article key={video.id}>
              <span className="cco-training-step">{String(index + 1).padStart(2, "0")}</span>
              <div className="cco-training-item-copy">
                <div><strong>{video.title}</strong><span className={video.isPublished ? "status-badge success" : "status-badge"}>{video.isPublished ? "Published" : "Draft"}</span></div>
                <p>{video.description || "No description"}</p>
                <small>{video.videoProvider} · {video.videoId}</small>
              </div>
              <div className="cco-training-actions">
                <button type="button" disabled={working || index === 0} onClick={() => void move(video, "UP")}>↑</button>
                <button type="button" disabled={working || index === videos.length - 1} onClick={() => void move(video, "DOWN")}>↓</button>
                <button type="button" onClick={() => setPreviewId(previewId === video.id ? "" : video.id)}>{previewId === video.id ? "Close Preview" : "Preview"}</button>
                <button type="button" onClick={() => edit(video)}>Edit</button>
                <button type="button" disabled={working} onClick={() => void togglePublish(video)}>{video.isPublished ? "Unpublish" : "Publish"}</button>
                <button type="button" className="danger" disabled={working} onClick={() => void remove(video)}>Delete</button>
              </div>
            </article>
          ))}
        </div>

        {preview && (
          <div className="cco-training-preview">
            <div><span className="eyebrow">ADMIN PREVIEW</span><h3>{preview.title}</h3></div>
            <VideoPlayer key={preview.id} provider={preview.videoProvider} rawValue={preview.videoId} title={preview.title} watermark="ADIL ACADEMY • ADMIN PREVIEW" />
          </div>
        )}
      </section>
    </div>
  );
}
