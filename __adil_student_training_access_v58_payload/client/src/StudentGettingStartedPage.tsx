import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowRight, ChevronRight, GraduationCap, LockKeyhole, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import "./student-training-videos.css";

type TrainingVideo = {
  id: string;
  title: string;
  description: string | null;
  videoProvider: string;
  videoId: string | null;
  position: number;
  accessType: "FREE" | "PAID";
  isLocked: boolean;
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
  const [memberAccess, setMemberAccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // First try authenticated student access. If the user is not logged in / not enrolled,
        // safely fall back to the public catalog where PAID video links are removed server-side.
        const memberResponse = await fetch("/api/student/student-training/videos");
        if (memberResponse.ok) {
          const data = await memberResponse.json() as { videos?: TrainingVideo[]; accessGranted?: boolean };
          if (!active) return;
          const items = data.videos ?? [];
          setMemberAccess(Boolean(data.accessGranted));
          setVideos(items);
          setSelectedId((current) => current || items[0]?.id || "");
          return;
        }

        if (![401, 403].includes(memberResponse.status)) {
          const data = await memberResponse.json().catch(() => ({})) as { message?: string };
          throw new Error(data.message ?? "Student training videos load failed.");
        }

        const publicResponse = await fetch("/api/public/student-training/videos");
        const publicData = await publicResponse.json().catch(() => ({ videos: [] })) as {
          videos?: TrainingVideo[];
          message?: string;
        };
        if (!publicResponse.ok) throw new Error(publicData.message ?? "Student training videos load failed.");
        if (!active) return;
        const items = publicData.videos ?? [];
        setMemberAccess(false);
        setVideos(items);
        const firstPlayable = items.find((item) => !item.isLocked) ?? items[0];
        setSelectedId((current) => current || firstPlayable?.id || "");
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Student training videos load failed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const selected = videos.find((video) => video.id === selectedId) ?? videos[0] ?? null;
  const selectedIndex = selected ? videos.findIndex((video) => video.id === selected.id) : -1;
  const freeCount = useMemo(() => videos.filter((video) => video.accessType === "FREE").length, [videos]);
  const paidCount = useMemo(() => videos.filter((video) => video.accessType === "PAID").length, [videos]);

  return (
    <div className="student-training-public">
      <PublicHeader />
      <main className="section-shell student-training-shell">
        <section className="student-training-hero">
          <span className="pill"><GraduationCap /> STUDENT TRAINING</span>
          <h1>Student Getting Started Guide</h1>
          <p>
            FREE videos account එකක් නැතිවම බලන්න පුළුවන්. PAID Training videos course account එක
            activate වූ පසු Student account එකෙන් login වුණාම automatically unlock වේ.
          </p>
          <div className="student-training-hero-meta">
            <span>{freeCount} FREE</span>
            <span>{paidCount} PAID</span>
            {memberAccess && <span className="is-unlocked">STUDENT ACCESS ACTIVE</span>}
          </div>
          {!memberAccess && (
            <Link className="button button-ghost" to="/login">
              Register / Login <ArrowRight />
            </Link>
          )}
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
            <Link className="button button-primary" to="/login">Continue to Login</Link>
          </section>
        )}

        {!loading && !error && !videos.length && (
          <section className="student-training-empty">
            <PlayCircle />
            <h2>Training videos coming soon</h2>
            <p>Admin විසින් Student Training videos publish කළ පසු මෙහි පෙන්වයි.</p>
          </section>
        )}

        {!loading && !error && selected && (
          <div className="student-training-layout">
            <aside className="student-training-steps">
              <div className="student-training-step-header">
                <span>TRAINING LIST</span>
                <strong>{videos.length} Videos</strong>
              </div>

              {videos.map((video, index) => (
                <button
                  type="button"
                  key={video.id}
                  className={`${selected.id === video.id ? "active" : ""} ${video.isLocked ? "locked" : ""}`.trim()}
                  onClick={() => setSelectedId(video.id)}
                >
                  <span className="student-training-step-number">
                    {video.isLocked ? <LockKeyhole /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="student-training-step-copy">
                    <small>{video.accessType === "FREE" ? "FREE VIDEO" : memberAccess ? "PAID • UNLOCKED" : "PAID • LOCKED"}</small>
                    <strong>{video.title}</strong>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </aside>

            <section className="student-training-viewer">
              <div className="student-training-viewer-heading">
                <div>
                  <span className={`student-training-access-badge ${selected.accessType.toLowerCase()}`}>
                    {selected.accessType === "FREE" ? "FREE TRAINING" : selected.isLocked ? "PAID • LOCKED" : "PAID • UNLOCKED"}
                  </span>
                  <h2>{selected.title}</h2>
                </div>
                <span>{selectedIndex + 1} / {videos.length}</span>
              </div>

              {selected.isLocked || !selected.videoId ? (
                <div className="student-training-locked-card">
                  <LockKeyhole />
                  <span className="eyebrow">PUBLISHED • LOCKED</span>
                  <h3>Course account activate කළ පසු මේ video එක unlock වේ</h3>
                  <p>
                    මේ PAID Training video එක public page එකේ title/description විතරක් පෙන්වයි.
                    Video link එක public API එකෙන් expose කරන්නේ නැහැ. Course account එක activate කරලා
                    Student account එකෙන් login වුණාම automatically unlock වේ.
                  </p>
                  <Link className="button button-primary" to="/login">
                    Register / Login to Unlock <ArrowRight />
                  </Link>
                </div>
              ) : (
                <VideoPlayer
                  key={selected.id}
                  provider={selected.videoProvider}
                  rawValue={selected.videoId}
                  title={selected.title}
                  watermark={selected.accessType === "FREE"
                    ? "ADIL ACADEMY • FREE TRAINING"
                    : "ADIL ACADEMY • STUDENT TRAINING"}
                />
              )}

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
                ) : !memberAccess ? (
                  <Link className="button button-primary" to="/login">
                    Register / Login <ArrowRight />
                  </Link>
                ) : (
                  <span className="student-training-complete">Training list complete ✓</span>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
