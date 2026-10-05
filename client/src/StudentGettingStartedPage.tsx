import { useEffect, useState, type ComponentType } from "react";
import { ArrowRight, ChevronRight, GraduationCap, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import "./student-training-videos.css";

type TrainingVideo = {
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

export default function StudentGettingStartedPage({
  PublicHeader,
  VideoPlayer
}: {
  PublicHeader: ComponentType;
  VideoPlayer: ComponentType<VideoPlayerProps>;
}) {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/public/student-training/videos")
      .then(async (response) => {
        const data = await response.json().catch(() => ({ videos: [] })) as {
          videos?: TrainingVideo[];
          message?: string;
        };
        if (!response.ok) throw new Error(data.message ?? "Student training videos load failed.");
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
    <div className="student-training-public">
      <PublicHeader />
      <main className="section-shell student-training-shell">
        <section className="student-training-hero">
          <span className="pill"><GraduationCap /> STUDENT ONBOARDING</span>
          <h1>Student Getting Started Guide</h1>
          <p>
            Adil Academy course එකට register වීම, Pay ID / payment process එක complete කිරීම,
            account එක activate කිරීම සහ course access කිරීම step-by-step videos වලින් බලන්න.
          </p>
          <Link className="button button-ghost" to="/login">
            Continue to Application / Login <ArrowRight />
          </Link>
        </section>

        {loading && (
          <section className="student-training-empty">
            <strong>Training videos loading...</strong>
          </section>
        )}

        {!loading && error && (
          <section className="student-training-empty">
            <strong>{error}</strong>
            <p>පසුව නැවත උත්සාහ කරන්න.</p>
            <Link className="button button-primary" to="/login">Continue to Application</Link>
          </section>
        )}

        {!loading && !error && !videos.length && (
          <section className="student-training-empty">
            <PlayCircle />
            <h2>Getting Started videos coming soon</h2>
            <p>Admin විසින් Student Training videos publish කළ පසු මෙහි පෙන්වයි.</p>
            <Link className="button button-primary" to="/login">
              Continue to Application <ArrowRight />
            </Link>
          </section>
        )}

        {!loading && !error && selected && (
          <div className="student-training-layout">
            <aside className="student-training-steps">
              <div className="student-training-step-header">
                <span>GETTING STARTED</span>
                <strong>{videos.length} Videos</strong>
              </div>

              {videos.map((video, index) => (
                <button
                  type="button"
                  key={video.id}
                  className={selected.id === video.id ? "active" : ""}
                  onClick={() => setSelectedId(video.id)}
                >
                  <span className="student-training-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="student-training-step-copy">
                    <small>STEP {String(index + 1).padStart(2, "0")}</small>
                    <strong>{video.title}</strong>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </aside>

            <section className="student-training-viewer">
              <div className="student-training-viewer-heading">
                <div>
                  <span className="eyebrow">STEP {String(selectedIndex + 1).padStart(2, "0")}</span>
                  <h2>{selected.title}</h2>
                </div>
                <span>{selectedIndex + 1} / {videos.length}</span>
              </div>

              <VideoPlayer
                key={selected.id}
                provider={selected.videoProvider}
                rawValue={selected.videoId}
                title={selected.title}
                watermark="ADIL ACADEMY • GETTING STARTED"
              />

              {selected.description && <p className="student-training-description">{selected.description}</p>}

              <div className="student-training-navigation">
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedId(videos[selectedIndex - 1]?.id ?? selected.id)}
                >
                  Previous Step
                </button>

                {selectedIndex < videos.length - 1 ? (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setSelectedId(videos[selectedIndex + 1]?.id ?? selected.id)}
                  >
                    Next Step <ArrowRight />
                  </button>
                ) : (
                  <Link className="button button-primary" to="/login">
                    Continue to Application <ArrowRight />
                  </Link>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
