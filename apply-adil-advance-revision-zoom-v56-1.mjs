import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_ADVANCE_REVISION_ZOOM_V56_1";
const v56Marker = "ADIL_ADVANCE_REVISION_ZOOM_V56";
const payload = path.join(root, "__adil_advance_revision_zoom_v56_1_payload");

const schemaPath = path.join(root, "db", "schema.ts");
const adminRoutesPath = path.join(root, "server", "modules", "revision", "routes.ts");
const studentRoutesPath = path.join(root, "server", "modules", "revision", "student-routes.ts");
const adminUiPath = path.join(root, "client", "src", "RevisionAdminManager.tsx");
const studentUiPath = path.join(root, "client", "src", "StudentRevisionCenter.tsx");
const adminCssPath = path.join(root, "client", "src", "revision-admin.css");
const studentCssPath = path.join(root, "client", "src", "student-revision.css");
const migrationSource = path.join(payload, "db", "migrations", "0028_advance_revision_zoom_status.sql");

function fail(message) {
  console.error(`\n❌ v56.1 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
function countOf(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = source.indexOf(needle, pos)) !== -1) {
    count += 1;
    pos += needle.length;
  }
  return count;
}
function replaceOnce(source, oldText, newText, label) {
  const count = countOf(source, oldText);
  if (count !== 1) fail(`${label} patch point expected once but found ${count}. No source files were changed.`);
  return source.replace(oldText, newText);
}
function backupFile(file, backupDir) {
  const relative = path.relative(root, file).replaceAll(path.sep, "__");
  const target = path.join(backupDir, `${relative}.before-v56-1`);
  if (!fs.existsSync(target)) fs.copyFileSync(file, target);
}

for (const file of [schemaPath, adminRoutesPath, studentRoutesPath, adminUiPath, studentUiPath, adminCssPath, studentCssPath, migrationSource]) mustExist(file);

let schema = fs.readFileSync(schemaPath, "utf8");
let adminRoutes = fs.readFileSync(adminRoutesPath, "utf8");
let studentRoutes = fs.readFileSync(studentRoutesPath, "utf8");
let adminUi = fs.readFileSync(adminUiPath, "utf8");
let studentUi = fs.readFileSync(studentUiPath, "utf8");
let adminCss = fs.readFileSync(adminCssPath, "utf8");
let studentCss = fs.readFileSync(studentCssPath, "utf8");

for (const [label, text] of [
  ["db/schema.ts", schema],
  ["admin revision routes", adminRoutes],
  ["student revision routes", studentRoutes],
  ["RevisionAdminManager.tsx", adminUi],
  ["StudentRevisionCenter.tsx", studentUi],
  ["revision-admin.css", adminCss],
  ["student-revision.css", studentCss]
]) {
  if (!text.includes(v56Marker)) fail(`${label} does not contain v56. Install v56 first.`);
}

const alreadyApplied = [schema, adminRoutes, studentRoutes, adminUi, studentUi, adminCss, studentCss].every((text) => text.includes(marker));
if (alreadyApplied) {
  const migrationTarget = path.join(root, "db", "migrations", "0028_advance_revision_zoom_status.sql");
  if (!fs.existsSync(migrationTarget)) fs.copyFileSync(migrationSource, migrationTarget);
  console.log("✅ v56.1 is already present. Source files were not changed again.");
  process.exit(0);
}
for (const [label, text] of [
  ["db/schema.ts", schema],
  ["admin revision routes", adminRoutes],
  ["student revision routes", studentRoutes],
  ["RevisionAdminManager.tsx", adminUi],
  ["StudentRevisionCenter.tsx", studentUi],
  ["revision-admin.css", adminCss],
  ["student-revision.css", studentCss]
]) {
  if (text.includes(marker)) fail(`${label} contains a partial v56.1 marker. Restore from backup before retrying.`);
}

const backupDir = path.join(root, "backup", "advance-revision-zoom-v56-1");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [schemaPath, adminRoutesPath, studentRoutesPath, adminUiPath, studentUiPath, adminCssPath, studentCssPath]) backupFile(file, backupDir);

// 1) DB schema source: duration controls automatic class expiry. Existing rows default to 120 minutes.
schema = replaceOnce(
  schema,
  `  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),\n  isPublished: boolean("is_published").default(false).notNull(),`,
  `  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),\n  durationMinutes: integer("duration_minutes").default(120).notNull(), // ${marker}\n  isPublished: boolean("is_published").default(false).notNull(),`,
  "Zoom schema duration"
);

// 2) Admin API accepts duration without changing any existing Revision video rules.
adminRoutes = replaceOnce(
  adminRoutes,
  `  scheduledAt: z.string().datetime().nullable().optional(),\n  isPublished: z.boolean().default(false)\n});`,
  `  scheduledAt: z.string().datetime().nullable().optional(),\n  durationMinutes: z.coerce.number().int().min(15).max(1440).default(120), // ${marker}\n  isPublished: z.boolean().default(false)\n});`,
  "Zoom create duration validation"
);
adminRoutes = replaceOnce(
  adminRoutes,
  `  scheduledAt: z.string().datetime().nullable().optional(),\n  isPublished: z.boolean().optional()\n}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");`,
  `  scheduledAt: z.string().datetime().nullable().optional(),\n  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(), // ${marker}\n  isPublished: z.boolean().optional()\n}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");`,
  "Zoom update duration validation"
);
adminRoutes = replaceOnce(
  adminRoutes,
  `      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,\n      isPublished: input.isPublished`,
  `      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,\n      durationMinutes: input.durationMinutes, // ${marker}\n      isPublished: input.isPublished`,
  "Zoom create duration insert"
);
adminRoutes = replaceOnce(
  adminRoutes,
  `      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),\n      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),`,
  `      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),\n      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}), // ${marker}\n      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),`,
  "Zoom update duration field"
);

// 3) Student API calculates Upcoming/LIVE and removes ended links server-side.
studentRoutes = replaceOnce(
  studentRoutes,
  `        description: revisionZoomSessions.description,\n        scheduledAt: revisionZoomSessions.scheduledAt`,
  `        description: revisionZoomSessions.description,\n        scheduledAt: revisionZoomSessions.scheduledAt,\n        durationMinutes: revisionZoomSessions.durationMinutes // ${marker}`,
  "Student Zoom select duration"
);
studentRoutes = replaceOnce(
  studentRoutes,
  `    response.json({ unlocked: true, sessions });`,
  `    const now = Date.now();\n    const activeSessions = sessions.flatMap((session) => {\n      const startMs = session.scheduledAt ? new Date(session.scheduledAt).getTime() : null;\n      const durationMinutes = Math.max(15, Number(session.durationMinutes || 120));\n      const endMs = startMs === null ? null : startMs + durationMinutes * 60_000;\n      if (endMs !== null && now > endMs) return []; // ${marker}: ended links are not exposed to students.\n      const status = startMs === null || now >= startMs ? "LIVE" : "UPCOMING";\n      return [{\n        ...session,\n        durationMinutes,\n        status,\n        endsAt: endMs === null ? null : new Date(endMs).toISOString()\n      }];\n    });\n    response.json({ unlocked: true, sessions: activeSessions });`,
  "Student Zoom active status filter"
);

// 4) Admin UI: duration field + clear timing status.
adminUi = replaceOnce(
  adminUi,
  `  scheduledAt: string | null;\n  isPublished: boolean;`,
  `  scheduledAt: string | null;\n  durationMinutes: number; // ${marker}\n  isPublished: boolean;`,
  "Admin Zoom session type"
);
adminUi = replaceOnce(
  adminUi,
  `  scheduledAt: string;\n  description: string;`,
  `  scheduledAt: string;\n  durationMinutes: string; // ${marker}\n  description: string;`,
  "Admin Zoom form type"
);
adminUi = replaceOnce(
  adminUi,
  `  scheduledAt: "",\n  description: "",`,
  `  scheduledAt: "",\n  durationMinutes: "120", // ${marker}\n  description: "",`,
  "Admin Zoom form default"
);
adminUi = replaceOnce(
  adminUi,
  `function zoomDateTimeLabel(value: string | null) {\n  if (!value) return "Time not set";\n  try {\n    return new Intl.DateTimeFormat("en-LK", {\n      timeZone: "Asia/Colombo",\n      dateStyle: "medium",\n      timeStyle: "short"\n    }).format(new Date(value));\n  } catch {\n    return "Time not set";\n  }\n}`,
  `function zoomDateTimeLabel(value: string | null) {\n  if (!value) return "Time not set";\n  try {\n    return new Intl.DateTimeFormat("en-LK", {\n      timeZone: "Asia/Colombo",\n      dateStyle: "medium",\n      timeStyle: "short"\n    }).format(new Date(value));\n  } catch {\n    return "Time not set";\n  }\n}\n\n// ${marker}\nfunction zoomTimingStatus(session: Pick<RevisionZoomSession, "scheduledAt" | "durationMinutes">): "UPCOMING" | "LIVE" | "ENDED" {\n  if (!session.scheduledAt) return "LIVE";\n  const start = new Date(session.scheduledAt).getTime();\n  const end = start + Math.max(15, Number(session.durationMinutes || 120)) * 60_000;\n  const now = Date.now();\n  if (now < start) return "UPCOMING";\n  if (now <= end) return "LIVE";\n  return "ENDED";\n}`,
  "Admin Zoom timing helper"
);
adminUi = replaceOnce(
  adminUi,
  `      scheduledAt: zoomDateTimeLocal(session.scheduledAt),\n      description: session.description ?? "",`,
  `      scheduledAt: zoomDateTimeLocal(session.scheduledAt),\n      durationMinutes: String(session.durationMinutes ?? 120), // ${marker}\n      description: session.description ?? "",`,
  "Admin Zoom edit duration"
);
adminUi = replaceOnce(
  adminUi,
  `        scheduledAt: zoomForm.scheduledAt ? new Date(zoomForm.scheduledAt).toISOString() : null,\n        description: zoomForm.description.trim() || null,`,
  `        scheduledAt: zoomForm.scheduledAt ? new Date(zoomForm.scheduledAt).toISOString() : null,\n        durationMinutes: Math.max(15, Math.min(1440, Number(zoomForm.durationMinutes || 120))), // ${marker}\n        description: zoomForm.description.trim() || null,`,
  "Admin Zoom save duration"
);
adminUi = replaceOnce(
  adminUi,
  `<span className="revision-zoom-count">{zoomSessions.filter((item) => item.isPublished).length} LIVE LINK{zoomSessions.filter((item) => item.isPublished).length === 1 ? "" : "S"}</span>`,
  `<span className="revision-zoom-count">{zoomSessions.filter((item) => item.isPublished && zoomTimingStatus(item) !== "ENDED").length} ACTIVE LINK{zoomSessions.filter((item) => item.isPublished && zoomTimingStatus(item) !== "ENDED").length === 1 ? "" : "S"}</span>`,
  "Admin Zoom active count"
);
adminUi = replaceOnce(
  adminUi,
  `<label>Date & time (optional)<input type="datetime-local" value={zoomForm.scheduledAt} onChange={(event) => setZoomForm({ ...zoomForm, scheduledAt: event.target.value })} /></label>\n            <label className="wide">Zoom meeting link`,
  `<label>Date & time (optional)<input type="datetime-local" value={zoomForm.scheduledAt} onChange={(event) => setZoomForm({ ...zoomForm, scheduledAt: event.target.value })} /></label>\n            <label>Duration (minutes)<input type="number" min="15" max="1440" step="5" value={zoomForm.durationMinutes} onChange={(event) => setZoomForm({ ...zoomForm, durationMinutes: event.target.value })} required /></label>\n            <label className="wide">Zoom meeting link`,
  "Admin Zoom duration input"
);
adminUi = replaceOnce(
  adminUi,
  `<div className="revision-video-title-row"><strong>{session.title}</strong><span className={session.isPublished ? "revision-badge published" : "revision-badge draft"}>{session.isPublished ? "PUBLISHED" : "DRAFT"}</span></div>\n                <span>{zoomDateTimeLabel(session.scheduledAt)}</span>`,
  `<div className="revision-video-title-row"><strong>{session.title}</strong><span className={\`revision-zoom-status \${zoomTimingStatus(session).toLowerCase()}\`}>{zoomTimingStatus(session)}</span><span className={session.isPublished ? "revision-badge published" : "revision-badge draft"}>{session.isPublished ? "PUBLISHED" : "DRAFT"}</span></div>\n                <span>{zoomDateTimeLabel(session.scheduledAt)} • {session.durationMinutes || 120} min</span>`,
  "Admin Zoom timing badge"
);

// 5) Student UI: explicit Upcoming/LIVE state; ended sessions never arrive from the API.
studentUi = replaceOnce(
  studentUi,
  `  scheduledAt: string | null;\n};`,
  `  scheduledAt: string | null;\n  durationMinutes: number; // ${marker}\n  status: "UPCOMING" | "LIVE";\n  endsAt: string | null;\n};`,
  "Student Zoom type status"
);
studentUi = replaceOnce(
  studentUi,
  `<span>{zoomSessions.length ? "LIVE ACCESS" : "NO ACTIVE LINK"}</span>`,
  `<span>{zoomSessions.some((session) => session.status === "LIVE") ? "LIVE NOW" : zoomSessions.length ? "UPCOMING" : "NO ACTIVE LINK"}</span>`,
  "Student Zoom section status"
);
studentUi = replaceOnce(
  studentUi,
  `<div><span className="revision-live-pill">ZOOM LIVE</span><h4>{session.title}</h4><strong>{zoomScheduleLabel(session.scheduledAt)}</strong>{session.description && <p>{session.description}</p>}</div>\n          <a className="button button-primary" href={session.zoomUrl} target="_blank" rel="noopener noreferrer">Join Zoom Live</a>`,
  `<div><span className={\`revision-live-pill \${session.status.toLowerCase()}\`}>{session.status === "LIVE" ? "LIVE NOW" : "UPCOMING"}</span><h4>{session.title}</h4><strong>{zoomScheduleLabel(session.scheduledAt)} • {session.durationMinutes || 120} min</strong>{session.description && <p>{session.description}</p>}</div>\n          <a className="button button-primary" href={session.zoomUrl} target="_blank" rel="noopener noreferrer">{session.status === "LIVE" ? "Join Zoom Live" : "Open Zoom Meeting"}</a>`,
  "Student Zoom status card"
);
studentUi = replaceOnce(
  studentUi,
  `Admin publish කරන next live class link එක මෙතන automatically පෙන්වයි.`,
  `Admin publish කරන next live class link එක මෙතන automatically පෙන්වයි. End වුණු scheduled class links automatically hide වෙනවා.`,
  "Student Zoom auto-expiry note"
);

// 6) Minimal styling additions only for v56.1 status states.
adminCss = replaceOnce(
  adminCss,
  `.revision-zoom-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem;`,
  `.revision-zoom-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.85rem;`,
  "Admin Zoom 3-column form"
);
adminCss += `\n\n/* ${marker} — Zoom timing status */\n.revision-zoom-status{padding:.2rem .45rem;border-radius:999px;font-size:.62rem;font-weight:900;letter-spacing:.08em}.revision-zoom-status.upcoming{color:#75c9ff;background:rgba(66,184,255,.1);border:1px solid rgba(66,184,255,.2)}.revision-zoom-status.live{color:#ff8c99;background:rgba(255,71,87,.12);border:1px solid rgba(255,71,87,.24)}.revision-zoom-status.ended{color:#94a3b8;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16)}\n`;
studentCss += `\n\n/* ${marker} — Zoom Upcoming/LIVE pills */\n.revision-live-pill.upcoming{color:#75c9ff;background:rgba(66,184,255,.1);border-color:rgba(66,184,255,.22)}.revision-live-pill.live{color:#ff8c99;background:rgba(255,71,87,.12);border-color:rgba(255,71,87,.24)}\n`;

// Write only after every patch point validated above.
fs.writeFileSync(schemaPath, schema);
fs.writeFileSync(adminRoutesPath, adminRoutes);
fs.writeFileSync(studentRoutesPath, studentRoutes);
fs.writeFileSync(adminUiPath, adminUi);
fs.writeFileSync(studentUiPath, studentUi);
fs.writeFileSync(adminCssPath, adminCss);
fs.writeFileSync(studentCssPath, studentCss);

const migrationTarget = path.join(root, "db", "migrations", "0028_advance_revision_zoom_status.sql");
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.copyFileSync(migrationSource, migrationTarget);

console.log("✓ revision_zoom_sessions now stores duration_minutes (default 120)");
console.log("✓ Admin can set class duration and sees UPCOMING / LIVE / ENDED");
console.log("✓ Student API automatically removes ended scheduled Zoom links");
console.log("✓ Students see clear UPCOMING / LIVE state with Asia/Colombo schedule");
console.log("✓ Existing Revision video rules and progress logic were not changed");
console.log("\n✅ ADIL ACADEMY Advance Revision Zoom Live v56.1 source update applied.");
