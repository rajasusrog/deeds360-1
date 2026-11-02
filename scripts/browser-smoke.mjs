import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildCompleteSaleState } from '../backend/__tests__/saleFixture.ts';

if (!process.env.CHROMIUM_EXECUTABLE_PATH) throw new Error('Set CHROMIUM_EXECUTABLE_PATH to a compatible Chrome/Chromium binary. Browser checks cannot run without it.');
const temporary = mkdtempSync(path.join(os.tmpdir(), 'deed360-browser-'));
const port = process.env.BROWSER_TEST_PORT || '3136';
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import','tsx','node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'], {
 cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: '', DEEDOS_DATA_DIR: temporary, START_STANDALONE_BACKEND: 'false' }, stdio: ['ignore','pipe','pipe']
});
let output = ''; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
let browser;
try {
 let ready = false;
 for (let i=0;i<150;i++) { try { ready = (await fetch(origin + '/api/health')).ok; if (ready) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
 assert.ok(ready, 'Test server did not start: ' + output);
 browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
 const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
 for (const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  await page.setViewportSize({width,height}); await page.goto(origin,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Continue with Google'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), name + ' overflow');
  assert.doesNotMatch(await page.locator('body').innerText(), /STAR.?2\.0|Supabase|JWT|RBAC/);
  assert.ok(await page.locator('img[src="/unikorn360-brand-20261031.svg"]').first().evaluate(img=>img.complete && img.naturalWidth>0));
  await page.evaluate(async()=> { await document.fonts.load('400 14px "Noto Sans Tamil"','தமிழ்'); await document.fonts.load('700 14px "Noto Sans Tamil"','தமிழ்'); await document.fonts.ready; });
  assert.equal(await page.evaluate(()=>document.fonts.check('400 14px "Noto Sans Tamil"','தமிழ்')),true);
  await page.screenshot({path:path.join(temporary,name+'.png'),fullPage:true});
  console.log(name + ' login: PASS (runtime, logo, font load and no overflow)');
 }
 const result = await page.evaluate(async state => {
  const { generateCanonicalPDF, generateCanonicalDOCX } = await import('/src/utils/documentExportEngine.ts');
  const pdf = await generateCanonicalPDF(state,'SYNTHETIC-SALE-TEST');
  if (!pdf.success) return { success: false, error: pdf.error };
  const bytes = new Uint8Array(await pdf.blob.arrayBuffer()); let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  const docx = await generateCanonicalDOCX(state,'SYNTHETIC-SALE-TEST');
  return {success:true,pdf:btoa(raw),docxBytes:docx.blob?.size||0};
 }, buildCompleteSaleState());
 assert.equal(result.success,true,result.error); assert.ok(result.docxBytes>1000);
 writeFileSync(path.join(temporary,'synthetic-sale.pdf'),Buffer.from(result.pdf,'base64'));
 assert.deepEqual(errors,[]);
 console.log('Browser PDF and DOCX generation: PASS. Synthetic outputs for visual inspection: ' + temporary);
 console.log('Google OAuth and authenticated browser journeys were not tested.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
