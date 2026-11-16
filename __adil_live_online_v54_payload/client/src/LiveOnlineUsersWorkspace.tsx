import { useEffect, useMemo, useState } from "react";
import { Search, Users, UserCheck } from "lucide-react";
import "./live-online-users.css";

type OnlineRole = "student" | "consultant";
type OnlineUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: OnlineRole;
  accountNumber: string | null;
  currentModule: string | null;
  portalMode: string | null;
  onlineSinceAt: string;
  lastSeenAt: string;
};

type OnlineResponse = {
  users: OnlineUser[];
  summary: { total: number; students: number; consultants: number };
  serverTime: string;
  onlineWindowSeconds: number;
};

function relativeSeconds(date: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 8) return "Live now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function sessionDuration(date: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "< 1 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function areaLabel(user: OnlineUser) {
  const module = user.currentModule || "Overview";
  if (user.role === "student") return `Student Portal · ${module}`;
  if (user.portalMode === "learning") return `Learning Portal · ${module}`;
  return `Consultant Portal · ${module}`;
}

export default function LiveOnlineUsersWorkspace() {
  const [data, setData] = useState<OnlineResponse | null>(null);
  const [filter, setFilter] = useState<"all" | OnlineRole>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/presence/online");
      const body = await response.json().catch(() => null) as OnlineResponse | { message?: string } | null;
      if (!response.ok) throw new Error((body as { message?: string } | null)?.message || "Live online data load failed.");
      setData(body as OnlineResponse);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Live online data load failed.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(true), 8_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, []);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      if (filter !== "all" && user.role !== filter) return false;
      if (!q) return true;
      return [user.name, user.email, user.phone, user.accountNumber, user.currentModule]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [data, filter, query]);

  return (
    <div className="live-online-admin">
      <section className="dash-card live-online-hero">
        <div>
          <span className="eyebrow">REAL-TIME PRESENCE</span>
          <h2>Live Online</h2>
          <p>දැනට Adil Academy portal එක activeව භාවිත කරන Students සහ Consultants liveව බලන්න.</p>
        </div>
        <div className="live-online-pulse"><i /> LIVE</div>
      </section>

      <div className="live-online-metrics">
        <article onClick={() => setFilter("all")} className={filter === "all" ? "active" : ""}>
          <span className="live-online-metric-icon"><Users /></span><small>Total Online</small><strong>{data?.summary.total ?? 0}</strong><p>Students + Consultants</p>
        </article>
        <article onClick={() => setFilter("student")} className={filter === "student" ? "active" : ""}>
          <span className="live-online-metric-icon"><Users /></span><small>Students Online</small><strong>{data?.summary.students ?? 0}</strong><p>Active Student Portal users</p>
        </article>
        <article onClick={() => setFilter("consultant")} className={filter === "consultant" ? "active" : ""}>
          <span className="live-online-metric-icon"><UserCheck /></span><small>Consultants Online</small><strong>{data?.summary.consultants ?? 0}</strong><p>Active Consultant accounts</p>
        </article>
      </div>

      <section className="dash-card workspace-card live-online-list-card">
        <div className="live-online-toolbar">
          <div>
            <span className="eyebrow">ONLINE DIRECTORY</span>
            <h2>{filter === "all" ? "Everyone Online" : filter === "student" ? "Students Online" : "Consultants Online"}</h2>
          </div>
          <label className="live-online-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name / SR / CN / email" /></label>
        </div>

        <div className="live-online-filter-row">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <span>{data?.summary.total ?? 0}</span></button>
          <button className={filter === "student" ? "active" : ""} onClick={() => setFilter("student")}>Students <span>{data?.summary.students ?? 0}</span></button>
          <button className={filter === "consultant" ? "active" : ""} onClick={() => setFilter("consultant")}>Consultants <span>{data?.summary.consultants ?? 0}</span></button>
          <button className="refresh" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh Now"}</button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && !data && <div className="live-online-empty"><span className="live-online-loader" /><strong>Checking who is online...</strong></div>}
        {!loading && !error && visibleUsers.length === 0 && <div className="live-online-empty"><Users /><strong>No users online right now.</strong><p>Active users will appear here automatically.</p></div>}

        <div className="live-online-grid">
          {visibleUsers.map((user) => (
            <article className="live-online-user" key={user.id}>
              <div className="live-online-avatar"><span>{user.name.slice(0, 2).toUpperCase()}</span><i /></div>
              <div className="live-online-user-main">
                <div className="live-online-user-title"><strong>{user.name}</strong><span className={`role ${user.role}`}>{user.role === "student" ? "STUDENT" : "CONSULTANT"}</span></div>
                <p>{user.accountNumber || "No SR/CN"} · {areaLabel(user)}</p>
                <small>{user.email}</small>
              </div>
              <div className="live-online-user-meta">
                <strong>{relativeSeconds(user.lastSeenAt, now)}</strong>
                <span>Online {sessionDuration(user.onlineSinceAt, now)}</span>
              </div>
            </article>
          ))}
        </div>

        <p className="live-online-footnote">Online status = visible browser activity received within the last {data?.onlineWindowSeconds ?? 70} seconds. List refreshes automatically every 8 seconds.</p>
      </section>
    </div>
  );
}
