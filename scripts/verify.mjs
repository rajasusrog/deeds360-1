import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
let failures = 0;
for (let phase = 1; phase <= 8; phase++) {
 const file = readdirSync('backend/__tests__').find(name => name.startsWith(`phase${phase}-`));
 const result = spawnSync(process.execPath, ['--import', 'tsx', `backend/__tests__/${file}`], {
  stdio: 'inherit', timeout: 60000, env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', START_STANDALONE_BACKEND: 'false', GEMINI_API_KEY: '' }
 });
 console.log(`SUITE_RESULT phase=${phase} exit=${result.status}`);
 if (result.error || result.status !== 0) failures++;
}
const extra = spawnSync(process.execPath, ['--import', 'tsx', 'backend/__tests__/release-regressions.verify.ts'], { stdio: 'inherit', timeout: 60000, env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', START_STANDALONE_BACKEND: 'false', GEMINI_API_KEY: '' } });
if (extra.error || extra.status !== 0) failures++;
console.log(`SUITE_RESULT release-regressions exit=${extra.status}`);
process.exitCode = failures ? 1 : 0;
