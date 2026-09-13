import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverFile = path.join(root, 'server/modules/courses/lesson-q-and-a.ts');
const clientFile = path.join(root, 'client/src/App.tsx');

for (const file of [serverFile, clientFile]) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Required file not found: ${file}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(serverFile, `${serverFile}.before-qa80-${stamp}`);
fs.copyFileSync(clientFile, `${clientFile}.before-qa80-${stamp}`);

let server = fs.readFileSync(serverFile, 'utf8');
let client = fs.readFileSync(clientFile, 'utf8');

const originalServer = server;
const originalClient = client;

// Q&A visibility/start threshold only: 80% watched.
// This intentionally does NOT change lesson completion (100%), next-video unlock,
// daily 3-video rules, 75% quiz pass rule, or 50% retake rule.
server = server.replaceAll('gte(lessonProgress.progressPercent, 100)', 'gte(lessonProgress.progressPercent, 80)');
server = server.replace('Complete this video lesson before opening its Q & A.', 'Watch at least 80% of this video lesson before opening its Q & A.');

// Update student-facing Q&A wording.
client = client.replace(
  'ඔබ අවසන් කළ පාඩම්වල දැනුම පරීක්ෂා කරන්න. සෑම පිළිතුරක්ම පළමු වරට තෝරාගත් පසු lock වේ.',
  'Video පාඩම අවම 80%ක් නැරඹූ පසු එහි Q & A විවෘත වේ. සෑම පිළිතුරක්ම පළමු වරට තෝරාගත් පසු lock වේ.'
);
client = client.replace(
  'Lesson එක 100% අවසන් කළ පසු එහි quiz මෙහි පෙන්වයි.',
  'Lesson video එක අවම 80%ක් නැරඹූ පසු එහි Q & A මෙහි පෙන්වයි.'
);
client = client.replace(
  '<h3>අවසන් කළ පාඩමක් තෝරන්න</h3><p>එම video පාඩමට අදාළ සිංහල ප්‍රශ්න මෙහි විවෘත වේ.</p>',
  '<h3>80%ක් හෝ වැඩි නැරඹූ පාඩමක් තෝරන්න</h3><p>එම video පාඩමට අදාළ සිංහල ප්‍රශ්න මෙහි විවෘත වේ.</p>'
);
client = client.replace('aria-label="Completed lesson quizzes"', 'aria-label="80 percent watched lesson quizzes"');

if (server === originalServer) {
  console.error('❌ Server Q&A threshold pattern was not found. No server change made.');
  process.exit(1);
}

fs.writeFileSync(serverFile, server);
fs.writeFileSync(clientFile, client);

console.log('✅ Q&A 80% unlock update applied successfully.');
console.log('✅ Q&A catalog + Q&A opening/start access: 80% watched.');
console.log('✅ Lesson completion remains 100%.');
console.log('✅ Next-video unlock remains dependent on full lesson completion + existing quiz pass rule.');
console.log('✅ Existing 50% rewatch retake rule remains unchanged.');
console.log(`✅ Backups created with suffix .before-qa80-${stamp}`);
