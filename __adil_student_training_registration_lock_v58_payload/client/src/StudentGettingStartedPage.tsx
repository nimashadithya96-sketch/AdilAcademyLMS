import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, GraduationCap, LockKeyhole, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import "./student-training-videos.css";

type PublicTrainingVideo = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

type UnlockedTrainingVideo = PublicTrainingVideo & {
  videoProvider: string;
  videoId: string;
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
  const [videos, setVideos] = useState<PublicTrainingVideo[]>([]);
  const [unlockedVideos, setUnlockedVideos] = useState<UnlockedTrainingVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessState, setAccessState] = useState<"CHECKING" | "LOCKED" | "UNLOCKED">("CHECKING");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const publicResponse = await fetch("/api/public/student-training/videos");
        const publicData = await publicResponse.json().catch(() => ({ videos: [] })) as {
          videos?: PublicTrainingVideo[];
          message?: string;
        };
        if (!publicResponse.ok) {
          throw new Error(publicData.message ?? "Student training videos load failed.");
        }
        if (!active) return;

        const items = publicData.videos ?? [];
        setVideos(items);
        setSelectedId((current) => current || items[0]?.id || "");

        const accessResponse = await fetch("/api/student/student-training/videos");
        if (accessResponse.ok) {
          const accessData = await accessResponse.json().catch(() => ({ videos: [] })) as {
            videos?: UnlockedTrainingVideo[];
          };
          if (!active) return;
          setUnlockedVideos(accessData.videos ?? []);
          setAccessState("UNLOCKED");
        } else if (accessResponse.status === 401 || accessResponse.status === 403) {
          if (active) setAccessState("LOCKED");
        } else {
          // Keep the public catalog usable even if the authenticated access check has a temporary problem.
          if (active) setAccessState("LOCKED");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Student training videos load failed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const unlockedById = useMemo(
    () => new Map(unlockedVideos.map((video) => [video.id, video])),
    [unlockedVideos]
  );

  const selected = videos.find((video) => video.id === selectedId) ?? videos[0] ?? null;
  const selectedIndex = selected ? videos.findIndex((video) => video.id === selected.id) : -1;
  const selectedUnlocked = selected ? unlockedById.get(selected.id) ?? null : null;
  const isUnlocked = accessState === "UNLOCKED" && Boolean(selectedUnlocked);

  return (
    <div className="student-training-public">
      <PublicHeader />
      <main className="section-shell student-training-shell">
        <section className="student-training-hero">
          <span className="pill"><GraduationCap /> STUDENT ONBOARDING</span>
          <h1>Student Getting Started Guide</h1>
          <p>
            Published Training videos list එක මෙහි බලන්න. Video playback unlock වන්නේ
            Adil Academy account එක register කර login වූ පසුයි.
          </p>
          <Link className="button button-ghost" to="/login">
            Register / Login to Unlock <ArrowRight />
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
          <>
            <section className={`student-training-access-banner ${accessState === "UNLOCKED" ? "unlocked" : "locked"}`}>
              {accessState === "UNLOCKED" ? <CheckCircle2 /> : <LockKeyhole />}
              <div>
                <strong>{accessState === "UNLOCKED" ? "Training Videos Unlocked" : "Published Videos — Registration Required"}</strong>
                <p>
                  {accessState === "UNLOCKED"
                    ? "ඔබේ registered account එක හඳුනාගත් නිසා published Student Training videos play කරන්න පුළුවන්."
                    : "Video titles සහ descriptions දැකගන්න පුළුවන්. Video play කරන්න account එක register කර login වෙන්න."}
                </p>
              </div>
              {accessState !== "UNLOCKED" && (
                <Link className="button button-primary" to="/login">Register / Login</Link>
              )}
            </section>

            <div className="student-training-layout">
              <aside className="student-training-steps">
                <div className="student-training-step-header">
                  <span>PUBLISHED TRAINING</span>
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
                      <small>STEP {String(index + 1).padStart(2, "0")} · PUBLISHED</small>
                      <strong>{video.title}</strong>
                    </span>
                    {accessState === "UNLOCKED" ? <PlayCircle /> : <LockKeyhole />}
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

                {isUnlocked && selectedUnlocked ? (
                  <VideoPlayer
                    key={selected.id}
                    provider={selectedUnlocked.videoProvider}
                    rawValue={selectedUnlocked.videoId}
                    title={selected.title}
                    watermark="ADIL ACADEMY • REGISTERED STUDENT TRAINING"
                  />
                ) : (
                  <div className="student-training-lock-card">
                    <LockKeyhole />
                    <span className="eyebrow">PUBLISHED • LOCKED</span>
                    <h3>Register කළ පසු මෙම video එක unlock වේ</h3>
                    <p>
                      මෙම video එක publish කරලා තියෙනවා. Security සඳහා video link එක publicව expose කරන්නේ නැහැ.
                      Existing registered account එකකින් login වුණාම automatically unlock වේ.
                    </p>
                    <Link className="button button-primary" to="/login">
                      Register / Login to Unlock <ArrowRight />
                    </Link>
                  </div>
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
                  ) : accessState === "UNLOCKED" ? (
                    <Link className="button button-primary" to="/login">
                      Continue to Student Portal <ArrowRight />
                    </Link>
                  ) : (
                    <Link className="button button-primary" to="/login">
                      Register to Unlock <ArrowRight />
                    </Link>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
