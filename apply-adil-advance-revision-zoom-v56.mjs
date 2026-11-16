import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const marker = "ADIL_ADVANCE_REVISION_ZOOM_V56";
const payload = path.join(root, "__adil_advance_revision_zoom_v56_payload");

const schemaPath = path.join(root, "db", "schema.ts");
const adminRoutesPath = path.join(root, "server", "modules", "revision", "routes.ts");
const studentRoutesPath = path.join(root, "server", "modules", "revision", "student-routes.ts");
const adminUiPath = path.join(root, "client", "src", "RevisionAdminManager.tsx");
const studentUiPath = path.join(root, "client", "src", "StudentRevisionCenter.tsx");
const adminCssPath = path.join(root, "client", "src", "revision-admin.css");
const studentCssPath = path.join(root, "client", "src", "student-revision.css");
const migrationSource = path.join(payload, "db", "migrations", "0027_advance_revision_zoom_live.sql");
const schemaBlockPath = path.join(payload, "schema-block.txt");

function fail(message) {
  console.error(`\n❌ v56 stopped safely: ${message}\n`);
  process.exit(1);
}
function mustExist(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found.`);
}
function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) fail(`${label} patch point not found. No source files were changed.`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) {
    fail(`${label} patch point is ambiguous. No source files were changed.`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}
function backupFile(file, backupDir) {
  const relative = path.relative(root, file).replaceAll(path.sep, "__");
  const target = path.join(backupDir, `${relative}.before-v56`);
  if (!fs.existsSync(target)) fs.copyFileSync(file, target);
}

for (const file of [schemaPath, adminRoutesPath, studentRoutesPath, adminUiPath, studentUiPath, adminCssPath, studentCssPath, migrationSource, schemaBlockPath]) mustExist(file);

let schema = fs.readFileSync(schemaPath, "utf8");
let adminRoutes = fs.readFileSync(adminRoutesPath, "utf8");
let studentRoutes = fs.readFileSync(studentRoutesPath, "utf8");
let adminUi = fs.readFileSync(adminUiPath, "utf8");
let studentUi = fs.readFileSync(studentUiPath, "utf8");
let adminCss = fs.readFileSync(adminCssPath, "utf8");
let studentCss = fs.readFileSync(studentCssPath, "utf8");

if (!schema.includes("ADIL_REVISION_MANAGER_V45") || !studentUi.includes("Revision Center")) {
  fail("Existing Basic/Advanced Revision system was not detected. Apply v45/v46 first.");
}

const alreadyApplied = [schema, adminRoutes, studentRoutes, adminUi, studentUi, adminCss, studentCss].every((text) => text.includes(marker));
if (alreadyApplied) {
  const migrationTarget = path.join(root, "db", "migrations", "0027_advance_revision_zoom_live.sql");
  if (!fs.existsSync(migrationTarget)) fs.copyFileSync(migrationSource, migrationTarget);
  console.log("✅ v56 is already present. Source files were not changed again.");
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
  if (text.includes(marker)) fail(`${label} contains a partial v56 marker. Restore from backup before retrying.`);
}

const backupDir = path.join(root, "backup", "advance-revision-zoom-v56");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [schemaPath, adminRoutesPath, studentRoutesPath, adminUiPath, studentUiPath, adminCssPath, studentCssPath]) backupFile(file, backupDir);

// 1) Database schema definition (source only; migration is copied separately).
schema += fs.readFileSync(schemaBlockPath, "utf8");

// 2) Admin API: only Revision Manager is extended.
adminRoutes = replaceOnce(
  adminRoutes,
  `  revisionSeries,\n  revisionVideos\n} from "../../../db/schema";`,
  `  revisionSeries,\n  revisionVideos,\n  revisionZoomSessions\n} from "../../../db/schema";`,
  "Admin revision schema import"
);

adminRoutes = replaceOnce(
  adminRoutes,
  `const seriesStatusSchema = z.object({ isComplete: z.boolean() });`,
  `const seriesStatusSchema = z.object({ isComplete: z.boolean() });\n\n// ${marker}\nconst zoomUrlSchema = z.string().trim().url().max(1500).refine((value) => {\n  try {\n    const url = new URL(value);\n    const host = url.hostname.toLowerCase();\n    return url.protocol === "https:" && (host === "zoom.us" || host.endsWith(".zoom.us"));\n  } catch {\n    return false;\n  }\n}, "Enter a valid https:// Zoom meeting link.");\nconst zoomSessionCreateSchema = z.object({\n  courseId: z.string().uuid(),\n  title: z.string().trim().min(2).max(180),\n  zoomUrl: zoomUrlSchema,\n  description: z.string().trim().max(5000).nullable().optional(),\n  scheduledAt: z.string().datetime().nullable().optional(),\n  isPublished: z.boolean().default(false)\n});\nconst zoomSessionUpdateSchema = z.object({\n  title: z.string().trim().min(2).max(180).optional(),\n  zoomUrl: zoomUrlSchema.optional(),\n  description: z.string().trim().max(5000).nullable().optional(),\n  scheduledAt: z.string().datetime().nullable().optional(),\n  isPublished: z.boolean().optional()\n}).refine((value) => Object.keys(value).length > 0, "No changes supplied.");`,
  "Admin Zoom validation"
);

adminRoutes += `\n\n// ${marker}: Admin manages direct Zoom live links for Advanced Revision.\nrevisionRouter.get(\n  "/admin/revision/zoom-sessions",\n  asyncRoute(async (request, response) => {\n    await requireRole(request, ["admin"]);\n    const input = courseQuerySchema.parse({ courseId: request.query.courseId });\n    const db = requireDatabase();\n    const sessions = await db\n      .select()\n      .from(revisionZoomSessions)\n      .where(eq(revisionZoomSessions.courseId, input.courseId))\n      .orderBy(asc(revisionZoomSessions.scheduledAt), asc(revisionZoomSessions.createdAt));\n    response.json({ sessions });\n  })\n);\n\nrevisionRouter.post(\n  "/admin/revision/zoom-sessions",\n  asyncRoute(async (request, response) => {\n    const admin = await requireRole(request, ["admin"]);\n    const input = zoomSessionCreateSchema.parse(request.body);\n    const db = requireDatabase();\n    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId)).limit(1);\n    if (!course) throw new HttpError(404, "Course not found.");\n\n    const [created] = await db.insert(revisionZoomSessions).values({\n      courseId: input.courseId,\n      title: input.title,\n      zoomUrl: input.zoomUrl,\n      description: input.description || null,\n      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,\n      isPublished: input.isPublished\n    }).returning();\n\n    await db.insert(auditLogs).values({\n      actorUserId: admin.id,\n      action: "ADVANCE_REVISION_ZOOM_CREATED",\n      entityType: "REVISION_ZOOM_SESSION",\n      entityId: created.id,\n      metadata: { courseId: input.courseId, title: input.title, isPublished: input.isPublished }\n    });\n    response.status(201).json({ session: created });\n  })\n);\n\nrevisionRouter.patch(\n  "/admin/revision/zoom-sessions/:id",\n  asyncRoute(async (request, response) => {\n    const admin = await requireRole(request, ["admin"]);\n    const input = zoomSessionUpdateSchema.parse(request.body);\n    const db = requireDatabase();\n    const sessionId = String(request.params.id);\n    const [existing] = await db.select().from(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId)).limit(1);\n    if (!existing) throw new HttpError(404, "Zoom live class not found.");\n\n    const updateValues = {\n      ...(input.title !== undefined ? { title: input.title } : {}),\n      ...(input.zoomUrl !== undefined ? { zoomUrl: input.zoomUrl } : {}),\n      ...(input.description !== undefined ? { description: input.description || null } : {}),\n      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),\n      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),\n      updatedAt: new Date()\n    };\n    const [updated] = await db.update(revisionZoomSessions).set(updateValues).where(eq(revisionZoomSessions.id, sessionId)).returning();\n\n    await db.insert(auditLogs).values({\n      actorUserId: admin.id,\n      action: "ADVANCE_REVISION_ZOOM_UPDATED",\n      entityType: "REVISION_ZOOM_SESSION",\n      entityId: sessionId,\n      metadata: { changed: Object.keys(input) }\n    });\n    response.json({ session: updated });\n  })\n);\n\nrevisionRouter.delete(\n  "/admin/revision/zoom-sessions/:id",\n  asyncRoute(async (request, response) => {\n    const admin = await requireRole(request, ["admin"]);\n    const db = requireDatabase();\n    const sessionId = String(request.params.id);\n    const [existing] = await db.select().from(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId)).limit(1);\n    if (!existing) throw new HttpError(404, "Zoom live class not found.");\n    await db.delete(revisionZoomSessions).where(eq(revisionZoomSessions.id, sessionId));\n    await db.insert(auditLogs).values({\n      actorUserId: admin.id,\n      action: "ADVANCE_REVISION_ZOOM_DELETED",\n      entityType: "REVISION_ZOOM_SESSION",\n      entityId: sessionId,\n      metadata: { courseId: existing.courseId, title: existing.title }\n    });\n    response.json({ success: true });\n  })\n);\n`;

// 3) Student API: Zoom links are returned only after Advanced Revision is unlocked.
studentRoutes = replaceOnce(
  studentRoutes,
  `  revisionVideoProgress,\n  revisionVideos\n} from "../../../db/schema";`,
  `  revisionVideoProgress,\n  revisionVideos,\n  revisionZoomSessions\n} from "../../../db/schema";`,
  "Student revision schema import"
);
studentRoutes += `\n\n// ${marker}: published Zoom links are protected by Advanced Revision access.\nrevisionStudentRouter.get(\n  "/student/revision/zoom-sessions",\n  asyncRoute(async (request, response) => {\n    const user = await requireAuthenticatedUser(request);\n    const db = requireDatabase();\n    const unlock = await ensureRevisionEligibilityState(db, user.id);\n    if (!unlock.enrollment || !unlock.access?.revisionUnlockedAt) {\n      response.json({ unlocked: false, sessions: [] });\n      return;\n    }\n    const advanced = await maybeUnlockAdvancedRevision(db, user.id, unlock.enrollment.courseId);\n    if (!advanced.access?.advancedUnlockedAt) {\n      response.json({ unlocked: false, sessions: [] });\n      return;\n    }\n    const sessions = await db\n      .select({\n        id: revisionZoomSessions.id,\n        title: revisionZoomSessions.title,\n        zoomUrl: revisionZoomSessions.zoomUrl,\n        description: revisionZoomSessions.description,\n        scheduledAt: revisionZoomSessions.scheduledAt\n      })\n      .from(revisionZoomSessions)\n      .where(and(\n        eq(revisionZoomSessions.courseId, unlock.enrollment.courseId),\n        eq(revisionZoomSessions.isPublished, true)\n      ))\n      .orderBy(asc(revisionZoomSessions.scheduledAt), asc(revisionZoomSessions.createdAt));\n    response.json({ unlocked: true, sessions });\n  })\n);\n`;

// 4) Admin UI state/types/actions.
adminUi = replaceOnce(
  adminUi,
  `type VideoForm = {\n  title: string;\n  videoProvider: "youtube" | "vimeo";\n  videoId: string;\n  durationMinutes: string;\n  content: string;\n  isPublished: boolean;\n};`,
  `type VideoForm = {\n  title: string;\n  videoProvider: "youtube" | "vimeo";\n  videoId: string;\n  durationMinutes: string;\n  content: string;\n  isPublished: boolean;\n};\n\n// ${marker}\ntype RevisionZoomSession = {\n  id: string;\n  courseId: string;\n  title: string;\n  zoomUrl: string;\n  description: string | null;\n  scheduledAt: string | null;\n  isPublished: boolean;\n  createdAt: string;\n  updatedAt: string;\n};\ntype ZoomForm = {\n  title: string;\n  zoomUrl: string;\n  scheduledAt: string;\n  description: string;\n  isPublished: boolean;\n};`,
  "Admin Zoom types"
);

adminUi = replaceOnce(
  adminUi,
  `const emptyVideoForm: VideoForm = {\n  title: "",\n  videoProvider: "youtube",\n  videoId: "",\n  durationMinutes: "",\n  content: "",\n  isPublished: false\n};`,
  `const emptyVideoForm: VideoForm = {\n  title: "",\n  videoProvider: "youtube",\n  videoId: "",\n  durationMinutes: "",\n  content: "",\n  isPublished: false\n};\n\nconst emptyZoomForm: ZoomForm = {\n  title: "",\n  zoomUrl: "",\n  scheduledAt: "",\n  description: "",\n  isPublished: false\n};\n\nfunction zoomDateTimeLocal(value: string | null) {\n  if (!value) return "";\n  const date = new Date(value);\n  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);\n  return local.toISOString().slice(0, 16);\n}\n\nfunction zoomDateTimeLabel(value: string | null) {\n  if (!value) return "Time not set";\n  try {\n    return new Intl.DateTimeFormat("en-LK", {\n      timeZone: "Asia/Colombo",\n      dateStyle: "medium",\n      timeStyle: "short"\n    }).format(new Date(value));\n  } catch {\n    return "Time not set";\n  }\n}`,
  "Admin Zoom form defaults"
);

adminUi = replaceOnce(
  adminUi,
  `  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");`,
  `  const [message, setMessage] = useState("");\n  const [error, setError] = useState("");\n  const [zoomSessions, setZoomSessions] = useState<RevisionZoomSession[]>([]); // ${marker}\n  const [zoomForm, setZoomForm] = useState<ZoomForm>(emptyZoomForm);\n  const [zoomEditingId, setZoomEditingId] = useState<string | null>(null);\n  const [zoomSaving, setZoomSaving] = useState(false);\n  const [zoomLoading, setZoomLoading] = useState(false);`,
  "Admin Zoom state"
);

adminUi = replaceOnce(
  adminUi,
  `  useEffect(() => {\n    if (selectedCourseId) void loadRevision(selectedCourseId);\n  }, [selectedCourseId]);`,
  `  useEffect(() => {\n    if (selectedCourseId) {\n      void loadRevision(selectedCourseId);\n      void loadZoomSessions(selectedCourseId);\n    }\n  }, [selectedCourseId]);`,
  "Admin course-load effect"
);

adminUi = replaceOnce(
  adminUi,
  `  function resetForm() {\n    setForm(emptyVideoForm);\n    setEditingId(null);\n  }`,
  `  async function loadZoomSessions(courseId = selectedCourseId) {\n    if (!courseId) {\n      setZoomSessions([]);\n      return;\n    }\n    setZoomLoading(true);\n    try {\n      const response = await fetch(\`/api/admin/revision/zoom-sessions?courseId=\${encodeURIComponent(courseId)}\`);\n      const body = await response.json().catch(() => ({})) as { sessions?: RevisionZoomSession[]; message?: string };\n      if (!response.ok) throw new Error(body.message ?? "Zoom live classes could not be loaded.");\n      setZoomSessions(body.sessions ?? []);\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : "Zoom live classes could not be loaded.");\n    } finally {\n      setZoomLoading(false);\n    }\n  }\n\n  function resetForm() {\n    setForm(emptyVideoForm);\n    setEditingId(null);\n  }\n\n  function resetZoomForm() {\n    setZoomForm(emptyZoomForm);\n    setZoomEditingId(null);\n  }\n\n  function beginZoomEdit(session: RevisionZoomSession) {\n    setZoomEditingId(session.id);\n    setZoomForm({\n      title: session.title,\n      zoomUrl: session.zoomUrl,\n      scheduledAt: zoomDateTimeLocal(session.scheduledAt),\n      description: session.description ?? "",\n      isPublished: session.isPublished\n    });\n    setMessage("");\n    setError("");\n  }\n\n  async function saveZoomSession(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!selectedCourseId) return;\n    setZoomSaving(true);\n    setMessage("");\n    setError("");\n    try {\n      const payload = {\n        ...(zoomEditingId ? {} : { courseId: selectedCourseId }),\n        title: zoomForm.title.trim(),\n        zoomUrl: zoomForm.zoomUrl.trim(),\n        scheduledAt: zoomForm.scheduledAt ? new Date(zoomForm.scheduledAt).toISOString() : null,\n        description: zoomForm.description.trim() || null,\n        isPublished: zoomForm.isPublished\n      };\n      const response = await fetch(\n        zoomEditingId ? \`/api/admin/revision/zoom-sessions/\${zoomEditingId}\` : "/api/admin/revision/zoom-sessions",\n        {\n          method: zoomEditingId ? "PATCH" : "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify(payload)\n        }\n      );\n      await readBody(response);\n      setMessage(zoomEditingId ? "Zoom live class updated." : "Zoom live class added to Advanced Revision.");\n      resetZoomForm();\n      await loadZoomSessions();\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : "Zoom live class save failed.");\n    } finally {\n      setZoomSaving(false);\n    }\n  }\n\n  async function toggleZoomPublished(session: RevisionZoomSession) {\n    setMessage("");\n    setError("");\n    try {\n      const response = await fetch(\`/api/admin/revision/zoom-sessions/\${session.id}\`, {\n        method: "PATCH",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ isPublished: !session.isPublished })\n      });\n      await readBody(response);\n      setMessage(session.isPublished ? "Zoom live class moved to Draft." : "Zoom live class published to Advanced Revision students.");\n      await loadZoomSessions();\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : "Zoom publish status update failed.");\n    }\n  }\n\n  async function deleteZoomSession(session: RevisionZoomSession) {\n    if (!window.confirm(\`Delete this Zoom live class permanently?\\n\\n\${session.title}\`)) return;\n    setMessage("");\n    setError("");\n    try {\n      const response = await fetch(\`/api/admin/revision/zoom-sessions/\${session.id}\`, { method: "DELETE" });\n      await readBody(response);\n      if (zoomEditingId === session.id) resetZoomForm();\n      setMessage("Zoom live class deleted.");\n      await loadZoomSessions();\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : "Zoom live class delete failed.");\n    }\n  }`,
  "Admin Zoom actions"
);


adminUi = replaceOnce(
  adminUi,
  `        <select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); resetForm(); }}>`,
  `        <select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); resetForm(); resetZoomForm(); }}>`,
  "Admin course picker reset"
);

adminUi = replaceOnce(
  adminUi,
  `            onClick={() => { setActiveLevel(level); resetForm(); setMessage(""); setError(""); }}`,
  `            onClick={() => { setActiveLevel(level); resetForm(); resetZoomForm(); setMessage(""); setError(""); }}`,
  "Admin revision level reset"
);

adminUi = replaceOnce(
  adminUi,
  `        <div className="revision-video-list">\n          {activeSeries.videos.map((video, index) => <article className={\`revision-video-row \${video.isPublished ? "published" : "draft"}\`} key={video.id}>`,
  `        <div className="revision-video-list">\n          {activeSeries.videos.map((video, index) => <article className={\`revision-video-row \${video.isPublished ? "published" : "draft"}\`} key={video.id}>`,
  "Admin video-list anchor check"
);

const adminZoomUiAnchor = `        </div>\n      </>}\n    </>}\n  </section>;`;
const adminZoomUi = `        </div>\n\n        {activeLevel === "ADVANCED" && <section className="revision-zoom-manager"> {/* ${marker} */}\n          <div className="revision-zoom-heading">\n            <div><span className="eyebrow">ADVANCED REVISION LIVE</span><h3>Zoom Live Classes</h3><p>Advanced Revision studentsට direct Zoom meeting link publish කරන්න. Video progress සහ daily limits මේකෙන් වෙනස් වෙන්නේ නැහැ.</p></div>\n            <span className="revision-zoom-count">{zoomSessions.filter((item) => item.isPublished).length} LIVE LINK{zoomSessions.filter((item) => item.isPublished).length === 1 ? "" : "S"}</span>\n          </div>\n\n          <form className="revision-zoom-form" onSubmit={saveZoomSession}>\n            <label>Live class title<input value={zoomForm.title} onChange={(event) => setZoomForm({ ...zoomForm, title: event.target.value })} placeholder="Example: Advanced Market Review — Live" required minLength={2} /></label>\n            <label>Date & time (optional)<input type="datetime-local" value={zoomForm.scheduledAt} onChange={(event) => setZoomForm({ ...zoomForm, scheduledAt: event.target.value })} /></label>\n            <label className="wide">Zoom meeting link<input type="url" value={zoomForm.zoomUrl} onChange={(event) => setZoomForm({ ...zoomForm, zoomUrl: event.target.value })} placeholder="https://us06web.zoom.us/j/..." required /></label>\n            <label className="wide">Student note<textarea value={zoomForm.description} onChange={(event) => setZoomForm({ ...zoomForm, description: event.target.value })} placeholder="Optional: class topic, preparation note, password instructions, etc." /></label>\n            <label className="revision-publish-check"><input type="checkbox" checked={zoomForm.isPublished} onChange={(event) => setZoomForm({ ...zoomForm, isPublished: event.target.checked })} /><span>Publish this Zoom link to Advanced Revision students</span></label>\n            <div className="revision-form-actions">\n              <button type="submit" className="button button-primary" disabled={zoomSaving}><Plus size={16} /> {zoomSaving ? "Saving..." : zoomEditingId ? "Save Zoom Changes" : "Add Zoom Live"}</button>\n              {zoomEditingId && <button type="button" className="button button-ghost" onClick={resetZoomForm}>Cancel Edit</button>}\n            </div>\n          </form>\n\n          <div className="revision-zoom-list">\n            {zoomLoading && <div className="workspace-note"><strong>Zoom live classes loading...</strong></div>}\n            {!zoomLoading && zoomSessions.map((session) => <article className={\`revision-zoom-row \${session.isPublished ? "published" : "draft"}\`} key={session.id}>\n              <div className="revision-zoom-main">\n                <div className="revision-video-title-row"><strong>{session.title}</strong><span className={session.isPublished ? "revision-badge published" : "revision-badge draft"}>{session.isPublished ? "PUBLISHED" : "DRAFT"}</span></div>\n                <span>{zoomDateTimeLabel(session.scheduledAt)}</span>\n                <small>{session.description || "No student note"}</small>\n              </div>\n              <div className="revision-zoom-actions">\n                <a href={session.zoomUrl} target="_blank" rel="noreferrer">Open Link</a>\n                <button type="button" onClick={() => beginZoomEdit(session)}><Edit3 size={15} /> Edit</button>\n                <button type="button" onClick={() => void toggleZoomPublished(session)}>{session.isPublished ? "Draft" : "Publish"}</button>\n                <button type="button" className="danger" onClick={() => void deleteZoomSession(session)}><Trash2 size={15} /> Delete</button>\n              </div>\n            </article>)}\n            {!zoomLoading && !zoomSessions.length && <div className="revision-zoom-empty"><Video /><strong>No Zoom live classes added yet</strong><span>Add the next Zoom link here when you schedule an Advanced Revision live session.</span></div>}\n          </div>\n        </section>}\n      </>}\n    </>}\n  </section>;`;
adminUi = replaceOnce(adminUi, adminZoomUiAnchor, adminZoomUi, "Admin Zoom UI");

// 5) Student UI state/load/card. No video progress rule is modified.
studentUi = replaceOnce(
  studentUi,
  `type RevisionDetail = {\n  video: {`,
  `// ${marker}\ntype RevisionZoomSession = {\n  id: string;\n  title: string;\n  zoomUrl: string;\n  description: string | null;\n  scheduledAt: string | null;\n};\n\ntype RevisionDetail = {\n  video: {`,
  "Student Zoom type"
);

studentUi = replaceOnce(
  studentUi,
  `function levelName(level: "BASIC" | "ADVANCED") {\n  return level === "BASIC" ? "Basic Revision" : "Advanced Revision";\n}`,
  `function levelName(level: "BASIC" | "ADVANCED") {\n  return level === "BASIC" ? "Basic Revision" : "Advanced Revision";\n}\n\nfunction zoomScheduleLabel(value: string | null) {\n  if (!value) return "Live time will be shared by Admin";\n  try {\n    return new Intl.DateTimeFormat("en-LK", {\n      timeZone: "Asia/Colombo",\n      dateStyle: "full",\n      timeStyle: "short"\n    }).format(new Date(value));\n  } catch {\n    return "Live class";\n  }\n}`,
  "Student Zoom date formatter"
);

studentUi = replaceOnce(
  studentUi,
  `  const [syncing, setSyncing] = useState(false);`,
  `  const [syncing, setSyncing] = useState(false);\n  const [zoomSessions, setZoomSessions] = useState<RevisionZoomSession[]>([]); // ${marker}\n  const [zoomLoading, setZoomLoading] = useState(false);\n  const [zoomError, setZoomError] = useState("");`,
  "Student Zoom state"
);

studentUi = replaceOnce(
  studentUi,
  `  useEffect(() => {\n    void loadOverview();\n    const timer = window.setInterval(() => void loadOverview(true), 30_000);\n    return () => window.clearInterval(timer);\n  }, []);`,
  `  useEffect(() => {\n    void loadOverview();\n    const timer = window.setInterval(() => void loadOverview(true), 30_000);\n    return () => window.clearInterval(timer);\n  }, []);\n\n  async function loadZoomSessions() {\n    if (!overview?.advancedUnlocked) {\n      setZoomSessions([]);\n      return;\n    }\n    setZoomLoading(true);\n    try {\n      const response = await fetch("/api/student/revision/zoom-sessions");\n      const body = await response.json().catch(() => ({})) as { unlocked?: boolean; sessions?: RevisionZoomSession[]; message?: string };\n      if (!response.ok) throw new Error(body.message ?? "Zoom live classes could not be loaded.");\n      setZoomSessions(body.sessions ?? []);\n      setZoomError("");\n    } catch (reason) {\n      setZoomError(reason instanceof Error ? reason.message : "Zoom live classes could not be loaded.");\n    } finally {\n      setZoomLoading(false);\n    }\n  }\n\n  useEffect(() => {\n    if (!overview?.advancedUnlocked) {\n      setZoomSessions([]);\n      setZoomError("");\n      return;\n    }\n    void loadZoomSessions();\n    const timer = window.setInterval(() => void loadZoomSessions(), 60_000);\n    return () => window.clearInterval(timer);\n  }, [overview?.advancedUnlocked, overview?.courseId]);`,
  "Student Zoom loading effect"
);

studentUi = replaceOnce(
  studentUi,
  `    {message && <div className="revision-limit-message"><Clock3 /><div><strong>{message.startsWith("Daily") ? "Daily Revision Limit Reached" : "Revision Access"}</strong><p>{message}</p></div></div>}\n    {error && <p className="form-error">{error}</p>}\n\n    <div className="revision-progress-strip">`,
  `    {message && <div className="revision-limit-message"><Clock3 /><div><strong>{message.startsWith("Daily") ? "Daily Revision Limit Reached" : "Revision Access"}</strong><p>{message}</p></div></div>}\n    {error && <p className="form-error">{error}</p>}\n\n    {selectedLevel === "ADVANCED" && overview.advancedUnlocked && <section className="revision-student-zoom"> {/* ${marker} */}\n      <div className="revision-student-zoom-heading">\n        <div><span className="eyebrow">ADVANCED REVISION LIVE</span><h3>Zoom Live Classes</h3><p>Admin publish කරන live class link එකෙන් direct Zoom meeting එකට join වෙන්න.</p></div>\n        <span>{zoomSessions.length ? "LIVE ACCESS" : "NO ACTIVE LINK"}</span>\n      </div>\n      {zoomError && <p className="form-error">{zoomError}</p>}\n      {zoomLoading && !zoomSessions.length ? <div className="revision-zoom-student-empty"><Clock3 /><strong>Checking Zoom live classes...</strong></div> : zoomSessions.length ? <div className="revision-student-zoom-list">\n        {zoomSessions.map((session) => <article className="revision-student-zoom-card" key={session.id}>\n          <div><span className="revision-live-pill">ZOOM LIVE</span><h4>{session.title}</h4><strong>{zoomScheduleLabel(session.scheduledAt)}</strong>{session.description && <p>{session.description}</p>}</div>\n          <a className="button button-primary" href={session.zoomUrl} target="_blank" rel="noopener noreferrer">Join Zoom Live</a>\n        </article>)}\n      </div> : <div className="revision-zoom-student-empty"><Clock3 /><strong>No Zoom live class is published right now.</strong><span>Admin publish කරන next live class link එක මෙතන automatically පෙන්වයි.</span></div>}\n    </section>}\n\n    <div className="revision-progress-strip">`,
  "Student Zoom UI"
);

// 6) Targeted CSS only.
adminCss += `\n\n/* ${marker} — Advanced Revision Zoom Live admin manager */\n.revision-zoom-manager{display:grid;gap:1rem;margin-top:.35rem;padding:1.1rem;border:1px solid rgba(66,184,255,.24);border-radius:20px;background:linear-gradient(145deg,rgba(45,148,255,.055),rgba(130,255,88,.025))}.revision-zoom-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.revision-zoom-heading h3{margin:.2rem 0 .25rem;font-size:1.25rem}.revision-zoom-heading p{margin:0;color:var(--muted,#94a3b8);max-width:720px;line-height:1.55}.revision-zoom-count{padding:.42rem .7rem;border-radius:999px;background:rgba(66,184,255,.09);border:1px solid rgba(66,184,255,.2);color:#75c9ff;font-size:.68rem;font-weight:900;letter-spacing:.08em;white-space:nowrap}.revision-zoom-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem;padding:1rem;border:1px solid var(--line,rgba(255,255,255,.1));border-radius:16px;background:rgba(0,0,0,.08)}.revision-zoom-form label{display:grid;gap:.45rem;color:var(--muted,#94a3b8);font-size:.84rem}.revision-zoom-form .wide,.revision-zoom-form .revision-form-actions{grid-column:1/-1}.revision-zoom-form input,.revision-zoom-form textarea{width:100%;border:1px solid var(--line,rgba(255,255,255,.12));border-radius:12px;background:var(--surface,#0b1110);color:var(--text,#f8fafc);padding:.82rem .9rem;font:inherit}.revision-zoom-form textarea{min-height:80px;resize:vertical}.revision-zoom-list{display:grid;gap:.65rem}.revision-zoom-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:center;padding:.9rem;border:1px solid var(--line,rgba(255,255,255,.1));border-radius:15px;background:var(--surface-2,rgba(255,255,255,.025))}.revision-zoom-row.published{border-color:rgba(66,184,255,.22)}.revision-zoom-main{display:grid;gap:.28rem;min-width:0}.revision-zoom-main>span,.revision-zoom-main>small{color:var(--muted,#94a3b8);font-size:.78rem}.revision-zoom-main>small{white-space:pre-wrap}.revision-zoom-actions{display:flex;flex-wrap:wrap;gap:.45rem;justify-content:flex-end}.revision-zoom-actions button,.revision-zoom-actions a{min-height:34px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.12));background:var(--surface,#0b1110);color:var(--text,#fff);padding:.42rem .65rem;font:inherit;font-size:.76rem;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem;cursor:pointer}.revision-zoom-actions a{color:#75c9ff;border-color:rgba(66,184,255,.24)}.revision-zoom-actions .danger{color:#fb7185;border-color:rgba(251,113,133,.2)}.revision-zoom-empty{min-height:130px;border:1px dashed rgba(66,184,255,.2);border-radius:15px;display:grid;place-items:center;align-content:center;text-align:center;gap:.35rem;color:var(--muted,#94a3b8);padding:1rem}.revision-zoom-empty svg{color:#75c9ff}@media(max-width:760px){.revision-zoom-heading{flex-direction:column}.revision-zoom-form{grid-template-columns:1fr}.revision-zoom-form .wide,.revision-zoom-form .revision-form-actions{grid-column:auto}.revision-zoom-row{grid-template-columns:1fr}.revision-zoom-actions{justify-content:flex-start}}\n`;

studentCss += `\n\n/* ${marker} — Advanced Revision Zoom Live student cards */\n.revision-student-zoom{display:grid;gap:.8rem;margin:0 0 1rem;padding:1rem;border:1px solid rgba(66,184,255,.24);border-radius:18px;background:linear-gradient(145deg,rgba(44,151,255,.07),rgba(130,255,88,.025))}.revision-student-zoom-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.revision-student-zoom-heading h3{margin:.18rem 0 .25rem}.revision-student-zoom-heading p{margin:0;color:var(--muted);font-size:.84rem}.revision-student-zoom-heading>span{padding:.38rem .62rem;border-radius:999px;border:1px solid rgba(66,184,255,.2);background:rgba(66,184,255,.08);color:#75c9ff;font-size:.66rem;font-weight:900;letter-spacing:.08em;white-space:nowrap}.revision-student-zoom-list{display:grid;gap:.65rem}.revision-student-zoom-card{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:1rem;border:1px solid rgba(66,184,255,.18);border-radius:15px;background:rgba(0,0,0,.1)}.revision-student-zoom-card>div{display:grid;gap:.28rem}.revision-student-zoom-card h4{margin:0;font-size:1.02rem}.revision-student-zoom-card strong{font-size:.8rem;color:#9fdcff}.revision-student-zoom-card p{margin:.15rem 0 0;white-space:pre-wrap;color:var(--muted);font-size:.8rem;line-height:1.55}.revision-live-pill{width:max-content;padding:.2rem .45rem;border-radius:999px;background:rgba(255,71,87,.12);border:1px solid rgba(255,71,87,.24);color:#ff8c99;font-size:.62rem;font-weight:900;letter-spacing:.1em}.revision-student-zoom-card>a{white-space:nowrap;text-decoration:none}.revision-zoom-student-empty{min-height:105px;display:grid;place-items:center;align-content:center;text-align:center;gap:.35rem;border:1px dashed rgba(66,184,255,.18);border-radius:14px;color:var(--muted);padding:1rem}.revision-zoom-student-empty svg{color:#75c9ff}@media(max-width:680px){.revision-student-zoom-heading,.revision-student-zoom-card{flex-direction:column;align-items:flex-start}.revision-student-zoom-card>a{width:100%;justify-content:center}}\n`;

// Write only after every patch point validated above.
fs.writeFileSync(schemaPath, schema);
fs.writeFileSync(adminRoutesPath, adminRoutes);
fs.writeFileSync(studentRoutesPath, studentRoutes);
fs.writeFileSync(adminUiPath, adminUi);
fs.writeFileSync(studentUiPath, studentUi);
fs.writeFileSync(adminCssPath, adminCss);
fs.writeFileSync(studentCssPath, studentCss);

const migrationTarget = path.join(root, "db", "migrations", "0027_advance_revision_zoom_live.sql");
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.copyFileSync(migrationSource, migrationTarget);

console.log("✓ db/schema.ts — revision_zoom_sessions definition added");
console.log("✓ server/modules/revision/routes.ts — Admin Zoom CRUD added");
console.log("✓ server/modules/revision/student-routes.ts — protected Advanced Revision Zoom feed added");
console.log("✓ client/src/RevisionAdminManager.tsx — Advanced Zoom Live Manager added");
console.log("✓ client/src/StudentRevisionCenter.tsx — Advanced Zoom Live cards added");
console.log("✓ revision CSS updated only for the new Zoom sections");
console.log("✓ db/migrations/0027_advance_revision_zoom_live.sql copied");
console.log("\n✅ ADIL ACADEMY Advance Revision Zoom Live v56 source update applied.");
console.log("Existing Basic/Advanced video rules, 80% sequential unlock, 3-video daily limit and 100% Basic completion rule were not changed.");
