import fs from "node:fs";

const checks = [
  ["client/src/StudentGettingStartedPage.tsx", "Register / Login to Unlock"],
  ["client/src/StudentGettingStartedPage.tsx", "/api/student/student-training/videos"],
  ["client/src/student-training-videos.css", "ADIL_STUDENT_TRAINING_REGISTRATION_LOCK_V58"],
  ["server/modules/student-training/routes.ts", "/student/student-training/videos"],
  ["server/modules/student-training/routes.ts", "videoProvider: studentTrainingVideos.videoProvider"]
];

for (const [file, marker] of checks) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(marker)) {
    throw new Error(`v58 verification failed: ${marker} missing from ${file}`);
  }
}

const routes = fs.readFileSync("server/modules/student-training/routes.ts", "utf8");
const publicBlockStart = routes.indexOf('studentTrainingRouter.get("/public/student-training/videos"');
const protectedBlockStart = routes.indexOf('studentTrainingRouter.get("/student/student-training/videos"');
if (publicBlockStart < 0 || protectedBlockStart < 0) throw new Error("v58 route verification failed.");
const publicBlock = routes.slice(publicBlockStart, protectedBlockStart);
if (publicBlock.includes("videoId:") || publicBlock.includes("videoProvider:")) {
  throw new Error("v58 security verification failed: public route still exposes playback data.");
}

console.log("✅ v58 verification passed: published metadata public, playback data protected after registration/login.");
