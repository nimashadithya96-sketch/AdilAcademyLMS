import { useEffect, useState, type ComponentType } from "react";
import { ArrowRight, ChevronRight, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import "./cco-setup-guide.css";

type SetupVideo = {
  id: string;
  title: string;
  description: string | null;
  videoProvider: string;
  videoId: string;
  position: number;
};

type VideoPlayerProps = {
  provider: string | null | undefined;
  rawValue: string | null | undefined;
  title: string;
  watermark?: string;
};

export default function CcoSetupGuidePage({
  PublicHeader,
  VideoPlayer
}: {
  PublicHeader: ComponentType;
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [videos, setVideos] = useState<SetupVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/public/cco-setup-guide/videos")
      .then(async (response) => {
        const data = await response.json().catch(() => ({ videos: [] })) as {
          videos?: SetupVideo[];
          message?: string;
        };
        if (!response.ok) throw new Error(data.message ?? "CCO Setup Guide load failed.");
        if (!active) return;
        const items = data.videos ?? [];
        setVideos(items);
        setSelectedId((current) => current || items[0]?.id || "");
      })
      .catch((loadError: Error) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selected = videos.find((video) => video.id === selectedId) ?? videos[0] ?? null;
  const selectedIndex = selected ? videos.findIndex((video) => video.id === selected.id) : -1;

  return (
    <div className="cco-main-public cco-setup-guide-public">
      <PublicHeader />
      <main className="section-shell">
        <div className="cco-guide-hero">
          <Link className="cco-guide-back" to="/cco-main">← CCO Main Access</Link>
          <span className="pill"><GraduationCap /> CONSULTANT SETUP TRAINING</span>
          <h1>CCO Setup Guide</h1>
          <p>CCO account එක open කිරීමේ සිට setup කිරීම දක්වා Admin publish කරන videos step-by-step follow කරන්න.</p>
        </div>

        {loading && <section className="cco-guide-empty"><strong>CCO Setup Guide loading...</strong></section>}
        {!loading && error && <section className="cco-guide-empty"><strong>{error}</strong><p>පසුව නැවත උත්සාහ කරන්න.</p></section>}
        {!loading && !error && !videos.length && (
          <section className="cco-guide-empty">
            <GraduationCap />
            <h2>Training videos coming soon</h2>
            <p>Admin විසින් CCO Setup Guide videos publish කළ පසු මෙහි පෙන්වයි.</p>
          </section>
        )}

        {!loading && !error && selected && (
          <div className="cco-guide-layout">
            <aside className="cco-guide-step-list">
              <div className="cco-guide-step-heading"><span>SETUP ROADMAP</span><strong>{videos.length} Videos</strong></div>
              {videos.map((video, index) => (
                <button type="button" key={video.id} className={selected.id === video.id ? "active" : ""} onClick={() => setSelectedId(video.id)}>
                  <span className="cco-guide-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="cco-guide-step-copy"><small>STEP {String(index + 1).padStart(2, "0")}</small><strong>{video.title}</strong></span>
                  <ChevronRight />
                </button>
              ))}
            </aside>

            <section className="cco-guide-viewer">
              <div className="cco-guide-viewer-heading">
                <div><span className="eyebrow">STEP {String(selectedIndex + 1).padStart(2, "0")}</span><h2>{selected.title}</h2></div>
                <span>{selectedIndex + 1} / {videos.length}</span>
              </div>
              <VideoPlayer key={selected.id} provider={selected.videoProvider} rawValue={selected.videoId} title={selected.title} watermark="ADIL ACADEMY • CCO SETUP GUIDE" />
              {selected.description && <p className="cco-guide-description">{selected.description}</p>}
              <div className="cco-guide-navigation">
                <button type="button" className="button button-ghost" disabled={selectedIndex <= 0} onClick={() => setSelectedId(videos[selectedIndex - 1]?.id ?? selected.id)}>Previous Step</button>
                <button type="button" className="button button-primary" disabled={selectedIndex >= videos.length - 1} onClick={() => setSelectedId(videos[selectedIndex + 1]?.id ?? selected.id)}>Next Step <ArrowRight /></button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
