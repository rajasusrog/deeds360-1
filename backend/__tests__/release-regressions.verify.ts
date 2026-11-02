import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCompleteSaleState } from './saleFixture';
import { matchesDocumentSearch } from '../../src/utils/documentSearch';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.START_STANDALONE_BACKEND = 'false';
process.env.DEEDOS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-release-'));
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
const { default: app, setTokenVerifierForTesting } = await import('../server');
const { db } = await import('../db');
const actors: Record<string, any> = {};
for (const token of ['writer-a', 'writer-b']) {
  actors[token] = await db.createUser({ id: crypto.randomUUID(), name: token, email: `${token}@example.invalid`, phone: '', organization: 'Synthetic test', role: 'Document Writer', permissions: ['view_own_deeds'], status: 'Approved', passwordHash: '', createdAt: new Date().toISOString() });
}
setTokenVerifierForTesting(async token => {
  const actor = actors[token];
  return actor ? { id: actor.id, email: actor.email, rawEmail: actor.email } : null;
});
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const port = (server.address() as any).port;
async function request(token: string, route: string, method = 'GET', body?: any) {
 const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
 const data = await response.json();
 return { response, data };
}
try {
 const state = buildCompleteSaleState();
 state.parties[0].name = 'Searchable Seller';
 const created = await request('writer-a', '/api/documents', 'POST', { docType: 'SALE', state });
 assert.equal(created.response.status, 201, JSON.stringify(created.data));
 const doc = created.data.document;
 assert.ok(doc?.id);
 for (const query of ['Searchable Seller', state.surveys[0].surveyNo, state.surveys[0].subDivision]) {
  const result = await request('writer-a', `/api/documents?q=${encodeURIComponent(query)}`);
  assert.equal(result.response.status, 200);
  assert.ok(result.data.some((row: any) => row.id === doc.id), query);
  assert.equal(matchesDocumentSearch(doc, query), true);
 }
 assert.equal(matchesDocumentSearch({ state: { parties: [{ pan: 'ABCDE1234F' }] } }, 'ABCDE1234F'), false);
 const forbidden = await request('writer-b', `/api/documents/${doc.id}`);
 assert.equal(forbidden.response.status, 403);
 const exported = await request('writer-a', `/api/documents/${doc.id}/export`);
 assert.equal(exported.response.status, 200, JSON.stringify(exported.data));
 const sections = exported.data.compiledSections;
 assert.ok(sections?.length);
 const html = sections.map((s: any) => s.contentEn).join('\n');
 assert.match(html, /<(?:div|p|strong)\b/, 'Node export must retain safe HTML markup, not escape every tag');
 assert.doesNotMatch(html, /&lt;(?:div|p|strong)\b/);
 const crossUserExport = await request('writer-b', `/api/documents/${doc.id}/export`);
 assert.equal(crossUserExport.response.status, 403);
 const read = await request('writer-a', `/api/documents/${doc.id}`);
 const latest = read.data.document || read.data;
 const editedState = { ...state, ownershipHistory: { ...state.ownershipHistory, historyNarrative: 'A new saved narrative.' } };
 const updated = await request('writer-a', `/api/documents/${doc.id}`, 'PUT', { expectedRevision: latest.revision, state: editedState });
 assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
 const reloaded = await request('writer-a', `/api/documents/${doc.id}`);
 assert.equal((reloaded.data.document || reloaded.data).state.ownershipHistory.historyNarrative, 'A new saved narrative.');
 const { generateCanonicalPDF } = await import('../../src/utils/documentExportEngine');
 const headless = await generateCanonicalPDF(state, doc.docNo);
 assert.equal(headless.success, false);
 assert.equal(headless.blob, undefined);
 assert.match(headless.error || '', /browser rendering/);
 console.log('Release regressions PASS: shared party/survey search; isolation; authorized export; initialized server sanitizer; save/reload; no placeholder PDF success.');
} finally {
 await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
 fs.rmSync(process.env.DEEDOS_DATA_DIR!, { recursive: true, force: true });
}
