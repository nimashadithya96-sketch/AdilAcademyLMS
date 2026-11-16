import { useEffect, useState } from "react";
import { Flame, Medal, Sparkles, Target, Trophy } from "lucide-react";
import "./admin-admission-heroes.css";

type AdminAdmissionHero = {
  id: string;
  name: string;
  accountNumber: string | null;
  photoUrl: string | null;
  counts: {
    daily: number;
    weekly: number;
    monthly: number;
    allTime: number;
  };
  wins: Array<"daily" | "weekly" | "monthly">;
};

type AdminAdmissionHeroesData = {
  targetWinners: AdminAdmissionHero[];
  weeklyChampions: AdminAdmissionHero[];
  monthlyChampions: AdminAdmissionHero[];
};

function HeroAvatar({ hero }: { hero: AdminAdmissionHero }) {
  if (hero.photoUrl) {
    return (
      <img
        className="admin-hero-avatar"
        src={hero.photoUrl}
        alt={`${hero.name} profile`}
      />
    );
  }

  return (
    <span className="admin-hero-avatar admin-hero-avatar-fallback">
      {hero.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
}

function rankClass(index: number) {
  if (index === 0) return "rank-gold";
  if (index === 1) return "rank-silver";
  if (index === 2) return "rank-bronze";
  return "";
}

export default function AdminAdmissionHeroesPanel() {
  const [data, setData] = useState<AdminAdmissionHeroesData | null>(null);
  const [tab, setTab] = useState<"weekly" | "monthly" | "winners">("weekly");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/admission-heroes")
      .then(async (response) => {
        if (!response.ok) throw new Error("Admission Heroes request failed.");
        return response.json() as Promise<AdminAdmissionHeroesData>;
      })
      .then(setData)
      .catch(() => setError("Admission Heroes data could not be loaded."));
  }, []);

  const list =
    tab === "weekly"
      ? data?.weeklyChampions
      : tab === "monthly"
        ? data?.monthlyChampions
        : data?.targetWinners;

  return (
    <section className="dash-card admin-admission-heroes">
      <div className="admin-heroes-heading">
        <div>
          <span className="eyebrow">CONSULTANT PERFORMANCE</span>
          <h2>Admission Heroes</h2>
          <p>
            Live ranking based on approved full-payment admissions. Use it to
            compare consultant activity, consistency and target achievement.
          </p>
        </div>
        <div className="admin-heroes-emblem">
          <Trophy />
        </div>
      </div>

      <div className="admin-heroes-tabs">
        <button
          type="button"
          className={tab === "weekly" ? "active" : ""}
          onClick={() => setTab("weekly")}
        >
          <Flame size={16} />
          Weekly Top 5
        </button>
        <button
          type="button"
          className={tab === "monthly" ? "active" : ""}
          onClick={() => setTab("monthly")}
        >
          <Medal size={16} />
          Monthly Top 10
        </button>
        <button
          type="button"
          className={tab === "winners" ? "active" : ""}
          onClick={() => setTab("winners")}
        >
          <Target size={16} />
          Target Winners
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!data && !error && (
        <div className="admin-heroes-loading">
          <Sparkles />
          Loading consultant performance...
        </div>
      )}

      {data && (
        <div className="admin-heroes-list">
          {list?.length ? (
            list.map((hero, index) => (
              <article
                key={hero.id}
                className={`admin-hero-row ${rankClass(index)}`}
              >
                <span className="admin-hero-rank">#{index + 1}</span>

                <HeroAvatar hero={hero} />

                <div className="admin-hero-person">
                  <strong>{hero.name}</strong>
                  <small>{hero.accountNumber ?? "Consultant"}</small>
                </div>

                <div className="admin-hero-mini">
                  <span>WEEK</span>
                  <strong>{hero.counts.weekly}</strong>
                </div>

                <div className="admin-hero-mini">
                  <span>MONTH</span>
                  <strong>{hero.counts.monthly}</strong>
                </div>

                <div className="admin-hero-score">
                  {tab === "winners" ? (
                    <>
                      <strong>
                        {hero.wins
                          .map(
                            (item) =>
                              item.charAt(0).toUpperCase() + item.slice(1)
                          )
                          .join(" • ")}
                      </strong>
                      <small>Target achieved</small>
                    </>
                  ) : (
                    <>
                      <strong>
                        {tab === "weekly"
                          ? hero.counts.weekly
                          : hero.counts.monthly}
                      </strong>
                      <small>admissions</small>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="admin-heroes-empty">
              <Trophy />
              <strong>No qualifying heroes yet</strong>
              <span>
                The first consultant with qualifying admissions will appear here
                automatically.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
