import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

// 1. Configure disposable test environment BEFORE importing backend modules
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deedos-phase2-test-'));
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tempDataDir;
const TEST_SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret-for-phase2-verification-only-32bytes';
process.env.SUPABASE_JWT_SECRET = TEST_SUPABASE_JWT_SECRET;

function signHs256Jwt(
  payload: Record<string, any>,
  secret: string = TEST_SUPABASE_JWT_SECRET,
  expiresInSeconds: number = 3600
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
    ...payload,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

async function request(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let parsed: any = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runPhase2Verification() {
  console.log(`[Phase 2 Verification] Using disposable data directory: ${tempDataDir}`);
  const { default: app } = await import('../server');
  const { db } = await import('../db');
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const results: Array<{ test: string; status: 'PASS' | 'FAIL'; details: string }> = [];

  const runTest = async (name: string, fn: () => Promise<string>) => {
    try {
      const details = await fn();
      results.push({ test: name, status: 'PASS', details });
      console.log(`✅ PASS: ${name} -> ${details}`);
    } catch (err: any) {
      results.push({ test: name, status: 'FAIL', details: err.message || String(err) });
      console.error(`❌ FAIL: ${name} -> ${err.message || String(err)}`);
    }
  };

  try {
    // Provision two independent synthetic Document Writers + one Auditor in disposable DB.
    // Deliberately give User A and User B the EXACT SAME display name ('R. Sundaram')
    // to prove that display-name matching (`d.writer === fullUser.name`) is dead and
    // cannot be abused by User B to access, modify, or delete User A's records.
    const existingUsers = await db.getUsers();
    await db.saveUsers([
      ...existingUsers,
      {
        id: 'usr-writer-a',
        name: 'R. Sundaram',
        email: 'writer.a@example.com',
        phone: '9840011111',
        organization: 'Chamber A',
        role: 'Document Writer',
        permissions: ['create_deed', 'edit_own_deeds', 'view_own_clients'],
        passwordHash: '',
        status: 'Approved',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-writer-b',
        name: 'R. Sundaram', // Identical display name to User A!
        email: 'writer.b@example.com',
        phone: '9840022222',
        organization: 'Chamber B',
        role: 'Document Writer',
        permissions: ['create_deed', 'edit_own_deeds', 'view_own_clients'],
        passwordHash: '',
        status: 'Approved',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-auditor-1',
        name: 'Registry Auditor',
        email: 'auditor.1@example.com',
        phone: '9840033333',
        organization: 'TN Audit',
        role: 'Auditor',
        permissions: ['read_only_audit'],
        passwordHash: '',
        status: 'Approved',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Clear any initial seeded documents/clients in disposable DB so we start with a clean workspace
    await db.saveDocuments([]);
    await db.saveClients([]);

    const tokenUserA = signHs256Jwt({
      sub: 'usr-writer-a',
      email: 'writer.a@example.com',
    });
    const tokenUserB = signHs256Jwt({
      sub: 'usr-writer-b',
      email: 'writer.b@example.com',
    });
    const tokenAuditor = signHs256Jwt({
      sub: 'usr-auditor-1',
      email: 'auditor.1@example.com',
    });

    // Test 1: Empty workspace returns empty arrays for both synthetic users
    await runTest('1. Initial authorized list endpoints return empty arrays for both User A and User B', async () => {
      const docsA = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const clientsA = await request(baseUrl, 'GET', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const docsB = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const clientsB = await request(baseUrl, 'GET', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });

      assert(docsA.status === 200 && Array.isArray(docsA.body) && docsA.body.length === 0, 'User A docs should be []');
      assert(
        clientsA.status === 200 && Array.isArray(clientsA.body?.clients) && clientsA.body.clients.length === 0,
        'User A clients should be []'
      );
      assert(docsB.status === 200 && Array.isArray(docsB.body) && docsB.body.length === 0, 'User B docs should be []');
      assert(
        clientsB.status === 200 && Array.isArray(clientsB.body?.clients) && clientsB.body.clients.length === 0,
        'User B clients should be []'
      );

      return `User A (docs=0, clients=0), User B (docs=0, clients=0)`;
    });

    // Test 2: User A and User B create their own documents and clients; creator IDs & emails are bound to verified tokens
    await runTest('2. POST /api/documents and POST /api/clients bind creator ID and email to verified token (ignoring forged body fields)', async () => {
      const createDocA = await request(baseUrl, 'POST', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: {
          id: 'doc-user-a-001',
          docNo: 'DOC-A-2026-001',
          docType: 'Sale Deed',
          subType: 'Sale in Metro Area',
          propertyAddress: '12 Luz Church Road, Mylapore, Chennai',
          consideration: 8500000,
          writer: 'R. Sundaram',
          status: 'Draft',
          // Attempt to spoof creator fields on creation:
          createdByUserId: 'usr-writer-b',
          createdByEmail: 'writer.b@example.com',
          state: {
            id: 'doc-user-a-001',
            docNumber: 'DOC-A-2026-001',
            parties: [{ id: 'client-user-a-001', name: 'S. Murugan', role: 'Seller' }],
            property: { village: 'Mylapore', sroOffice: 'Mylapore SRO' },
            survey: { surveyNo: '142', subDivision: '1A' },
          },
        },
      });
      assert(createDocA.status === 201, `Expected 201 creating doc-user-a-001, got ${createDocA.status}`);
      assert(
        createDocA.body?.document?.createdByUserId === 'usr-writer-a',
        `Expected createdByUserId='usr-writer-a', got '${createDocA.body?.document?.createdByUserId}'`
      );
      assert(
        createDocA.body?.document?.createdByEmail === 'writer.a@example.com',
        `Expected createdByEmail='writer.a@example.com', got '${createDocA.body?.document?.createdByEmail}'`
      );
      assert(
        createDocA.body?.document?.state?.createdByUserId === 'usr-writer-a',
        `Expected state.createdByUserId='usr-writer-a', got '${createDocA.body?.document?.state?.createdByUserId}'`
      );

      const createClientA = await request(baseUrl, 'POST', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: {
          id: 'client-user-a-001',
          name: 'S. Murugan',
          fatherName: 'Subramani',
          age: 48,
          phone: '9840100001',
          email: 'murugan.client@example.com',
          pan: 'ABCDE1234F',
          aadhaar: '123456789012',
          address: '12 Luz Church Road, Mylapore, Chennai',
          createdByUserId: 'usr-writer-b', // Attempted spoof
        },
      });
      assert(createClientA.status === 201, `Expected 201 creating client-user-a-001, got ${createClientA.status}`);
      assert(
        createClientA.body?.client?.createdByUserId === 'usr-writer-a',
        `Expected client createdByUserId='usr-writer-a', got '${createClientA.body?.client?.createdByUserId}'`
      );
      assert(
        createClientA.body?.client?.createdByEmail === 'writer.a@example.com',
        `Expected client createdByEmail='writer.a@example.com', got '${createClientA.body?.client?.createdByEmail}'`
      );

      // User B creates their own document & client
      const createDocB = await request(baseUrl, 'POST', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: {
          id: 'doc-user-b-001',
          docNo: 'DOC-B-2026-001',
          docType: 'Settlement Deed',
          subType: 'Family Settlement',
          propertyAddress: '45 Gandhi Nagar, Adyar, Chennai',
          writer: 'R. Sundaram',
          status: 'Draft',
          state: {
            id: 'doc-user-b-001',
            docNumber: 'DOC-B-2026-001',
            parties: [{ id: 'client-user-b-001', name: 'P. Natarajan', role: 'Settlor' }],
            property: { village: 'Adyar', sroOffice: 'Adyar SRO' },
            survey: { surveyNo: '88', subDivision: '2B' },
          },
        },
      });
      assert(createDocB.status === 201, `Expected 201 creating doc-user-b-001, got ${createDocB.status}`);

      const createClientB = await request(baseUrl, 'POST', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: {
          id: 'client-user-b-001',
          name: 'P. Natarajan',
          fatherName: 'Palanisamy',
          age: 62,
          phone: '9840200002',
          email: 'natarajan.client@example.com',
          pan: 'PQRSX6789Z',
          aadhaar: '987654321098',
          address: '45 Gandhi Nagar, Adyar, Chennai',
        },
      });
      assert(createClientB.status === 201, `Expected 201 creating client-user-b-001, got ${createClientB.status}`);

      return `User A created doc-user-a-001 & client-user-a-001 (createdByUserId=usr-writer-a); User B created doc-user-b-001 & client-user-b-001 (createdByUserId=usr-writer-b)`;
    });

    // Test 3: POST /api/documents and POST /api/clients are strictly create-only and reject existing IDs (409 Conflict)
    await runTest('3. POST /api/documents and POST /api/clients reject existing IDs with 409 Conflict (no overwrite via POST)', async () => {
      // User A tries to POST existing doc ID
      const selfPostOverwrite = await request(baseUrl, 'POST', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: {
          id: 'doc-user-a-001',
          docNo: 'DOC-A-OVERWRITTEN',
          docType: 'Sale Deed',
          propertyAddress: 'Overwritten by self POST',
        },
      });

      // User B tries to POST with User A's existing doc ID to overwrite it
      const crossUserPostOverwrite = await request(baseUrl, 'POST', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: {
          id: 'doc-user-a-001',
          docNo: 'HACKED-BY-USER-B',
          docType: 'Sale Deed',
          propertyAddress: 'Hijacked by User B via POST',
        },
      });

      // User B tries to POST with User A's existing client ID
      const crossUserClientPost = await request(baseUrl, 'POST', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: {
          id: 'client-user-a-001',
          name: 'Hijacked Client',
          phone: '9999999999',
        },
      });

      assert(
        selfPostOverwrite.status === 409 && crossUserPostOverwrite.status === 409 && crossUserClientPost.status === 409,
        `Expected 409/409/409, got ${selfPostOverwrite.status}/${crossUserPostOverwrite.status}/${crossUserClientPost.status}`
      );

      // Verify User A's document was not modified
      const checkDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(
        checkDocA.status === 200 && checkDocA.body?.document?.docNo === 'DOC-A-2026-001',
        `User A's document was altered! docNo=${checkDocA.body?.document?.docNo}`
      );

      return `Self POST existing doc=${selfPostOverwrite.status}, Cross-user POST existing doc=${crossUserPostOverwrite.status}, Cross-user POST existing client=${crossUserClientPost.status}`;
    });

    // Test 4: Strict isolation on List and Search even when User A and User B share the exact same display name ('R. Sundaram')
    await runTest('4. List & Search endpoints isolate records by stable user ID (display-name collision does not leak records)', async () => {
      const listDocsA = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const listDocsB = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const searchDocsBForA = await request(baseUrl, 'GET', '/api/documents/search?q=Mylapore', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });

      const listClientsA = await request(baseUrl, 'GET', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const listClientsB = await request(baseUrl, 'GET', '/api/clients', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const searchClientsBForA = await request(baseUrl, 'GET', '/api/clients/search?q=Murugan', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });

      assert(
        listDocsA.body.length === 1 && listDocsA.body[0].id === 'doc-user-a-001',
        `User A should only see doc-user-a-001, got ${JSON.stringify(listDocsA.body.map((d: any) => d.id))}`
      );
      assert(
        listDocsB.body.length === 1 && listDocsB.body[0].id === 'doc-user-b-001',
        `User B should only see doc-user-b-001, got ${JSON.stringify(listDocsB.body.map((d: any) => d.id))}`
      );
      assert(
        searchDocsBForA.body.length === 0,
        `User B searching for User A's property 'Mylapore' should return 0 results, got ${searchDocsBForA.body.length}`
      );
      assert(
        listClientsA.body?.clients?.length === 1 && listClientsA.body.clients[0].id === 'client-user-a-001',
        `User A should only see client-user-a-001, got ${JSON.stringify(listClientsA.body?.clients)}`
      );
      assert(
        listClientsB.body?.clients?.length === 1 && listClientsB.body.clients[0].id === 'client-user-b-001',
        `User B should only see client-user-b-001, got ${JSON.stringify(listClientsB.body?.clients)}`
      );
      assert(
        searchClientsBForA.body?.clients?.length === 0,
        `User B searching for User A's client 'Murugan' should return 0 results`
      );

      return `User A sees only [doc-user-a-001, client-user-a-001]; User B sees only [doc-user-b-001, client-user-b-001]; cross-user search returned 0 results`;
    });

    // Test 5: Cross-user Detail (GET /:id) and Export (GET /:id/export) are blocked with 403
    await runTest('5. Cross-user detail (GET /:id) and export (GET /:id/export) rejected with 403', async () => {
      const bGetDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const bExportDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001/export', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const bGetClientA = await request(baseUrl, 'GET', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });

      const aGetDocB = await request(baseUrl, 'GET', '/api/documents/doc-user-b-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const aExportDocB = await request(baseUrl, 'GET', '/api/documents/doc-user-b-001/export', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const aGetClientB = await request(baseUrl, 'GET', '/api/clients/client-user-b-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });

      // Own export works
      const aExportDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001/export', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });

      assert(
        bGetDocA.status === 403 &&
          bExportDocA.status === 403 &&
          bGetClientA.status === 403 &&
          aGetDocB.status === 403 &&
          aExportDocB.status === 403 &&
          aGetClientB.status === 403 &&
          aExportDocA.status === 200,
        `Expected 403s and 200 for own export, got ${[
          bGetDocA.status,
          bExportDocA.status,
          bGetClientA.status,
          aGetDocB.status,
          aExportDocB.status,
          aGetClientB.status,
          aExportDocA.status,
        ].join('/')}`
      );

      return `User B->A (doc=${bGetDocA.status}, export=${bExportDocA.status}, client=${bGetClientA.status}); User A->B (doc=${aGetDocB.status}, export=${aExportDocB.status}, client=${aGetClientB.status}); User A own export=${aExportDocA.status}`;
    });

    // Test 6: Cross-user PUT and PATCH on documents and clients are rejected with 403
    await runTest('6. Cross-user PUT and PATCH on documents and clients rejected with 403', async () => {
      const bPutDocA = await request(baseUrl, 'PUT', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: { propertyAddress: 'Tampered by User B via PUT' },
      });
      const bPatchDocA = await request(baseUrl, 'PATCH', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: { status: 'Approved' },
      });
      const bPutClientA = await request(baseUrl, 'PUT', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: { name: 'Tampered Client via PUT' },
      });
      const bPatchClientA = await request(baseUrl, 'PATCH', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: { phone: '0000000000' },
      });

      assert(
        bPutDocA.status === 403 && bPatchDocA.status === 403 && bPutClientA.status === 403 && bPatchClientA.status === 403,
        `Expected 403/403/403/403, got ${bPutDocA.status}/${bPatchDocA.status}/${bPutClientA.status}/${bPatchClientA.status}`
      );

      // Confirm User A's records are untouched
      const docA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const clientA = await request(baseUrl, 'GET', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(
        docA.body?.document?.propertyAddress === '12 Luz Church Road, Mylapore, Chennai',
        `User A doc propertyAddress was tampered: ${docA.body?.document?.propertyAddress}`
      );
      assert(
        clientA.body?.client?.name === 'S. Murugan',
        `User A client name was tampered: ${clientA.body?.client?.name}`
      );

      return `PUT doc=${bPutDocA.status}, PATCH doc=${bPatchDocA.status}, PUT client=${bPutClientA.status}, PATCH client=${bPatchClientA.status}`;
    });

    // Test 7: Legitimate owner PUT/PATCH preserves createdByUserId & createdByEmail and blocks ownership reassignment by non-admin
    await runTest('7. Owner PUT/PATCH preserves creator ID & email and rejects non-admin ownership reassignment', async () => {
      const aUpdateDocA = await request(baseUrl, 'PUT', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: {
          propertyAddress: '12 Luz Church Road, Mylapore, Chennai (Updated)',
          status: 'Completed',
          state: {
            id: 'doc-user-a-001',
            docNumber: 'DOC-A-2026-001',
            property: { village: 'Mylapore', sroOffice: 'Mylapore SRO' },
            survey: { surveyNo: '142', subDivision: '1A' },
            considerationValue: '9000000',
          },
        },
      });
      assert(aUpdateDocA.status === 200, `Expected 200 updating own doc, got ${aUpdateDocA.status}`);
      assert(
        aUpdateDocA.body?.document?.createdByUserId === 'usr-writer-a' &&
          aUpdateDocA.body?.document?.createdByEmail === 'writer.a@example.com' &&
          aUpdateDocA.body?.document?.state?.createdByUserId === 'usr-writer-a' &&
          aUpdateDocA.body?.document?.state?.createdByEmail === 'writer.a@example.com',
        'Creator ID or email was lost on legitimate PUT update'
      );

      // Owner attempting to change createdByUserId to another user is blocked with 403
      const aReassignDocOwner = await request(baseUrl, 'PATCH', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: { createdByUserId: 'usr-writer-b' },
      });
      const aReassignClientOwner = await request(baseUrl, 'PATCH', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
        body: { createdByUserId: 'usr-writer-b' },
      });
      assert(
        aReassignDocOwner.status === 403 && aReassignClientOwner.status === 403,
        `Expected 403/403 when non-admin attempts to reassign createdByUserId, got ${aReassignDocOwner.status}/${aReassignClientOwner.status}`
      );

      return `Owner update preserved createdByUserId='usr-writer-a' & createdByEmail='writer.a@example.com'; ownership reassignment blocked (${aReassignDocOwner.status}/${aReassignClientOwner.status})`;
    });

    // Test 8: Cross-check verification endpoint scopes draft collisions to caller's accessible workspace
    await runTest('8. GET /api/verification/cross-check does not leak another user private draft docNo', async () => {
      // User B queries cross-check for Survey 142 / 1A at village Mylapore (which is in User A's draft doc-user-a-001)
      const crossCheckByB = await request(
        baseUrl,
        'GET',
        '/api/verification/cross-check?village=Mylapore&surveyNo=142&subDivision=1A',
        {
          headers: { Authorization: `Bearer ${tokenUserB}` },
        }
      );
      assert(crossCheckByB.status === 200, `Expected 200 on cross-check, got ${crossCheckByB.status}`);
      const leakedDocNo = JSON.stringify(crossCheckByB.body).includes('DOC-A-2026-001');
      assert(!leakedDocNo, `User B cross-check leaked User A's private draft docNo DOC-A-2026-001!`);

      // Whereas User A querying cross-check for another draft on the same survey sees their own workspace alert
      const crossCheckByA = await request(
        baseUrl,
        'GET',
        '/api/verification/cross-check?village=Mylapore&surveyNo=142&subDivision=1A&currentDocId=doc-user-a-002',
        {
          headers: { Authorization: `Bearer ${tokenUserA}` },
        }
      );
      assert(
        crossCheckByA.status === 200 && JSON.stringify(crossCheckByA.body).includes('DOC-A-2026-001'),
        'User A should see their own workspace active draft collision'
      );

      return `Cross-check by User B returned status=${crossCheckByB.status} with 0 leaks of User A's draft docNo; User A sees own workspace draft collision`;
    });

    // Test 9: Auditor has read-only access (can GET list/detail, blocked with 403 on POST/PUT/PATCH/DELETE)
    await runTest('9. Auditor role can read records for audit but cannot create, update, or delete records', async () => {
      const audListDocs = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenAuditor}` },
      });
      const audGetDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenAuditor}` },
      });
      const audCreateDoc = await request(baseUrl, 'POST', '/api/documents', {
        headers: { Authorization: `Bearer ${tokenAuditor}` },
        body: { id: 'doc-auditor', docNo: 'AUD-1', docType: 'Sale Deed' },
      });
      const audUpdateDocA = await request(baseUrl, 'PUT', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenAuditor}` },
        body: { status: 'Approved' },
      });
      const audDeleteDocA = await request(baseUrl, 'DELETE', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenAuditor}` },
      });

      assert(
        audListDocs.status === 200 &&
          audGetDocA.status === 200 &&
          audCreateDoc.status === 403 &&
          audUpdateDocA.status === 403 &&
          audDeleteDocA.status === 403,
        `Expected 200/200/403/403/403 for Auditor, got ${[
          audListDocs.status,
          audGetDocA.status,
          audCreateDoc.status,
          audUpdateDocA.status,
          audDeleteDocA.status,
        ].join('/')}`
      );

      return `Auditor GET list=${audListDocs.status}, GET detail=${audGetDocA.status}, POST=${audCreateDoc.status}, PUT=${audUpdateDocA.status}, DELETE=${audDeleteDocA.status}`;
    });

    // Test 10: Cross-user DELETE is blocked with 403; owner can DELETE own records
    await runTest('10. Cross-user DELETE rejected with 403; legitimate owner can DELETE own records', async () => {
      const bDeleteDocA = await request(baseUrl, 'DELETE', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const bDeleteClientA = await request(baseUrl, 'DELETE', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert(
        bDeleteDocA.status === 403 && bDeleteClientA.status === 403,
        `Expected 403/403 on cross-user DELETE, got ${bDeleteDocA.status}/${bDeleteClientA.status}`
      );

      // Verify User A's records still exist
      const checkDocA = await request(baseUrl, 'GET', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(checkDocA.status === 200, 'User A doc should still exist after blocked cross-user DELETE');

      // Now User A deletes their own document and client
      const aDeleteDocA = await request(baseUrl, 'DELETE', '/api/documents/doc-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const aDeleteClientA = await request(baseUrl, 'DELETE', '/api/clients/client-user-a-001', {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert(
        aDeleteDocA.status === 200 && aDeleteClientA.status === 200,
        `Expected 200/200 when User A deletes own records, got ${aDeleteDocA.status}/${aDeleteClientA.status}`
      );

      return `Cross-user DELETE (doc=${bDeleteDocA.status}, client=${bDeleteClientA.status}); Owner DELETE (doc=${aDeleteDocA.status}, client=${aDeleteClientA.status})`;
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\n[Phase 2 Verification Summary] ${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runPhase2Verification().catch((err) => {
  console.error('Phase 2 verification runner crashed:', err);
  process.exit(1);
});
