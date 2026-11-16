import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stylesPath = path.join(ROOT, "client", "src", "styles.css");

if (!fs.existsSync(stylesPath)) {
  throw new Error("client/src/styles.css not found. Run this patch from the project root.");
}

const originalStyles = fs.readFileSync(stylesPath, "utf8");
const backupPath = stylesPath + ".before-mobile-flat-layout-v34";

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(stylesPath, backupPath);
}

try {
  let styles = originalStyles;

  const marker = "ADIL_ACADEMY_MOBILE_SINGLE_ACTIVE_VIEW_V34";

  if (!styles.includes(marker)) {
    styles += `

/* ==========================================================
   ADIL_ACADEMY_MOBILE_SINGLE_ACTIVE_VIEW_V34

   Goal:
   - On Student -> My Course mobile lesson view, remove the
     "box inside box inside box" appearance.
   - Keep the actual selected lesson content prominent.
   - Keep Video / Lesson Note / Progress as readable sections.
   - Desktop is intentionally untouched.
   ========================================================== */

@media (max-width: 900px) {

  /*
   * Flatten likely outer/nested lesson workspace wrappers.
   * Selectors that do not exist are harmless.
   */
  .student-course-shell,
  .student-course-layout,
  .student-course-main,
  .student-course-content,
  .student-course-workspace,
  .student-lesson-shell,
  .student-lesson-view,
  .student-lesson-detail,
  .student-lesson-detail-card,
  .lesson-workspace,
  .lesson-detail,
  .lesson-detail-card,
  .course-workspace,
  .course-workspace-main,
  .workspace-card:has(.protected-video-shell),
  .workspace-card:has(.student-lesson-note),
  .dash-card:has(.protected-video-shell),
  .dash-card:has(.student-lesson-note) {
    border: 0 !important;
    outline: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    border-radius: 0 !important;
  }

  /*
   * Remove repeated vertical rails/edges from nested containers.
   * This specifically targets the visual issue where several
   * green borders appear side-by-side on a phone.
   */
  .student-course-shell,
  .student-course-layout,
  .student-course-main,
  .student-course-content,
  .student-course-workspace,
  .student-lesson-shell,
  .student-lesson-view,
  .student-lesson-detail,
  .student-lesson-detail-card,
  .lesson-workspace,
  .lesson-detail,
  .lesson-detail-card,
  .course-workspace,
  .course-workspace-main {
    border-left: 0 !important;
    border-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /*
   * If the lesson lives inside a generic dashboard/workspace card,
   * flatten only the card that actually contains the active lesson.
   */
  .dash-card:has(.student-lesson-note),
  .dash-card:has(.student-lesson-progress),
  .dash-card:has(.protected-video-shell),
  .workspace-card:has(.student-lesson-note),
  .workspace-card:has(.student-lesson-progress),
  .workspace-card:has(.protected-video-shell) {
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /*
   * Keep the meaningful content cards. These are intentionally
   * NOT flattened completely; the student should still clearly
   * see "Lesson Note" and progress as separate information.
   */
  .student-lesson-note {
    margin: 18px 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 18px !important;
    border: 1px solid rgba(117, 255, 84, .13) !important;
    background:
      linear-gradient(180deg, rgba(5, 17, 13, .94), rgba(5, 13, 11, .90)) !important;
    box-shadow: 0 10px 34px rgba(0,0,0,.16) !important;
  }

  .student-lesson-progress {
    margin: 16px 0 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    border-left: 0 !important;
    border-right: 0 !important;
    box-shadow: none !important;
  }

  .protected-video-shell {
    width: 100% !important;
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  /*
   * Give the active lesson one clean mobile content width.
   * Instead of multiple nested gutters, there is one small
   * consistent page gutter.
   */
  .student-lesson-note,
  .student-lesson-progress,
  .protected-video-shell {
    box-sizing: border-box !important;
  }

  /*
   * Generic duplicate wrappers immediately surrounding the
   * meaningful lesson sections are visually neutralized.
   */
  div:has(> .student-lesson-note):has(> .student-lesson-progress) {
    border-left: 0 !important;
    border-right: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  /*
   * Prevent accidental horizontal overflow caused by old theme
   * paddings/borders on nested course panels.
   */
  body,
  #root {
    overflow-x: hidden !important;
  }
}

/*
 * Very narrow phones: slightly tighter card corners/spacing.
 */
@media (max-width: 430px) {
  .student-lesson-note {
    margin: 14px 0 !important;
    border-radius: 16px !important;
  }

  .student-lesson-progress {
    margin-top: 14px !important;
  }
}

/* END ADIL_ACADEMY_MOBILE_SINGLE_ACTIVE_VIEW_V34 */
`;
  }

  fs.writeFileSync(stylesPath, styles, "utf8");

  console.log("✅ V34 Mobile Single Active View / Flat Layout update applied successfully.");
  console.log("✅ Repeated nested mobile borders/background layers were flattened.");
  console.log("✅ Video, Lesson Note and Progress remain as the meaningful visible content sections.");
  console.log("✅ Desktop layout was not intentionally changed.");
  console.log("✅ Video controls, Resume, Q&A, Daily Limit, progress logic and Admin rules were not changed.");
  console.log(`✅ Backup: ${path.relative(ROOT, backupPath)}`);
} catch (error) {
  fs.writeFileSync(stylesPath, originalStyles, "utf8");
  console.error("❌ V34 patch stopped and restored the original styles.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}