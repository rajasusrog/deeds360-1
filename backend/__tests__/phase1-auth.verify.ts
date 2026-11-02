import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

// 1. Configure disposable test environment BEFORE importing backend modules
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deedos-phase1-test-'));
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tempDataDir;
const TEST_SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret-for-phase1-verification-only-32bytes';
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

async function runPhase1Verification() {
  console.log(`[Phase 1 Verification] Using disposable data directory: ${tempDataDir}`);
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
    // Test 1: Missing token returns 401 across protected endpoints
    await runTest('1. Missing token rejected with 401', async () => {
      const r1 = await request(baseUrl, 'GET', '/api/documents');
      const r2 = await request(baseUrl, 'GET', '/api/clients');
      const r3 = await request(baseUrl, 'GET', '/api/auth/users');
      const r4 = await request(baseUrl, 'POST', '/api/auth/sync-profile', { body: { full_name: 'Anon' } });
      const r5 = await request(baseUrl, 'GET', '/api/auth/me');
      const r6 = await request(baseUrl, 'POST', '/api/audit/log-action', { body: { action: 'TEST' } });
      assert(
        r1.status === 401 && r2.status === 401 && r3.status === 401 && r4.status === 401 && r5.status === 401 && r6.status === 401,
        `Expected all 401, got ${[r1.status, r2.status, r3.status, r4.status, r5.status, r6.status].join(', ')}`
      );
      return `All protected endpoints returned 401 (${[r1.status, r2.status, r3.status, r4.status, r5.status, r6.status].join('/')})`;
    });

    // Test 2: Malformed, invalid signature, and expired tokens return 401
    await runTest('2. Invalid, malformed, and expired tokens rejected with 401', async () => {
      const malformedRes = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: 'Bearer not-a-jwt-token' },
      });
      const wrongSecretToken = signHs256Jwt(
        { sub: 'usr-1', email: 'clearfile360@gmail.com' },
        'wrong-secret-key',
        3600
      );
      const wrongSigRes = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${wrongSecretToken}` },
      });
      const expiredToken = signHs256Jwt(
        { sub: 'usr-1', email: 'clearfile360@gmail.com' },
        TEST_SUPABASE_JWT_SECRET,
        -60
      );
      const expiredRes = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert(
        malformedRes.status === 401 && wrongSigRes.status === 401 && expiredRes.status === 401,
        `Expected 401/401/401, got ${malformedRes.status}/${wrongSigRes.status}/${expiredRes.status}`
      );
      return `Malformed=${malformedRes.status}, WrongSignature=${wrongSigRes.status}, Expired=${expiredRes.status}`;
    });

    // Test 3: Forged x-user-id, x-user-email, x-user-role headers rejected without token
    await runTest('3. Forged identity/role headers without valid token rejected with 401', async () => {
      const forgedRes = await request(baseUrl, 'GET', '/api/auth/users', {
        headers: {
          'x-user-id': 'usr-1',
          'x-user-email': 'clearfile360@gmail.com',
          'x-user-role': 'Super Admin',
        },
      });
      assert(forgedRes.status === 401, `Expected 401, got ${forgedRes.status}`);
      return `Forged headers without Bearer token returned ${forgedRes.status}`;
    });

    // Test 4: Legacy /api/auth/login and /api/auth/register disabled (410 Gone)
    await runTest('4. Legacy /api/auth/login and /api/auth/register disabled with 410', async () => {
      const loginRes = await request(baseUrl, 'POST', '/api/auth/login', {
        body: { email: 'clearfile360@gmail.com', password: 'password123' },
      });
      const regRes = await request(baseUrl, 'POST', '/api/auth/register', {
        body: { email: 'attacker@example.com', password: 'password123', role: 'Super Admin' },
      });
      assert(loginRes.status === 410 && regRes.status === 410, `Expected 410/410, got ${loginRes.status}/${regRes.status}`);
      return `POST /api/auth/login=${loginRes.status}, POST /api/auth/register=${regRes.status}`;
    });

    // Test 5: New non-allowlisted user syncing profile gets Client + Pending Approval, and is blocked (403) until approved
    const ordinaryUserToken = signHs256Jwt({
      sub: 'sb-ordinary-user-101',
      email: 'writer.candidate@example.com',
      user_metadata: {
        full_name: 'Candidate Writer',
        role: 'Super Admin', // Attempted metadata privilege injection
      },
    });

    await runTest('5. New user defaults to Client + Pending Approval (ignoring user_metadata.role) and is blocked while Pending', async () => {
      const syncRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: {
          full_name: 'Candidate Writer',
          organization: 'Mylapore Chamber',
        },
      });
      assert(syncRes.status === 200, `Expected 200 on initial safe sync, got ${syncRes.status}`);
      assert(syncRes.body?.user?.role === 'Client', `Expected role 'Client', got '${syncRes.body?.user?.role}'`);
      assert(syncRes.body?.user?.status === 'Pending Approval', `Expected status 'Pending Approval', got '${syncRes.body?.user?.status}'`);
      assert(!('passwordHash' in syncRes.body.user), 'passwordHash leaked in sync-profile response');

      // Now attempt to access protected API while still Pending Approval
      const docsRes = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
      });
      const meRes = await request(baseUrl, 'GET', '/api/auth/me', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
      });
      assert(docsRes.status === 403 && meRes.status === 403, `Expected 403/403 for Pending user, got ${docsRes.status}/${meRes.status}`);
      return `Synced role=${syncRes.body.user.role}, status=${syncRes.body.user.status}; API access while pending returned ${docsRes.status}/${meRes.status}`;
    });

    // Test 6: Attempted self-promotion and identity spoofing via /api/auth/sync-profile rejected with 403
    await runTest('6. Attempted self-promotion (role, status, permissions) & ID/email mismatch on /api/auth/sync-profile rejected with 403', async () => {
      const rolePromoteRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { full_name: 'Candidate Writer', role: 'Super Admin' },
      });
      const statusPromoteRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { full_name: 'Candidate Writer', status: 'Approved' },
      });
      const permPromoteRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { full_name: 'Candidate Writer', permissions: ['*'] },
      });
      const spoofEmailRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { email: 'clearfile360@gmail.com', full_name: 'Spoofed Admin' },
      });
      const spoofIdRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { id: 'usr-1', full_name: 'Spoofed ID' },
      });

      assert(
        rolePromoteRes.status === 403 &&
          statusPromoteRes.status === 403 &&
          permPromoteRes.status === 403 &&
          spoofEmailRes.status === 403 &&
          spoofIdRes.status === 403,
        `Expected all 403, got ${[
          rolePromoteRes.status,
          statusPromoteRes.status,
          permPromoteRes.status,
          spoofEmailRes.status,
          spoofIdRes.status,
        ].join('/')}`
      );
      return `RolePromote=${rolePromoteRes.status}, StatusPromote=${statusPromoteRes.status}, PermPromote=${permPromoteRes.status}, EmailSpoof=${spoofEmailRes.status}, IdSpoof=${spoofIdRes.status}`;
    });

    // Test 7: Legitimate Super Admin login, approving ordinary user, and assigning Document Writer role
    const superAdminToken = signHs256Jwt({
      sub: 'usr-1',
      email: 'clearfile360@gmail.com',
    });

    await runTest('7. Legitimate Super Admin login, user approval, and role assignment succeed with safe user objects', async () => {
      const syncAdminRes = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { full_name: 'ClearFile360 Super Admin' },
      });
      assert(syncAdminRes.status === 200 && syncAdminRes.body?.user?.role === 'Super Admin', `Super Admin sync failed: ${syncAdminRes.status}`);

      const meRes = await request(baseUrl, 'GET', '/api/auth/me', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(meRes.status === 200 && meRes.body?.user?.role === 'Super Admin', `Super Admin /api/auth/me failed: ${meRes.status}`);
      assert(!('passwordHash' in meRes.body.user), 'passwordHash leaked in /api/auth/me');

      // Approve the pending user
      const approveRes = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/status', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { status: 'Approved' },
      });
      assert(approveRes.status === 200 && approveRes.body?.user?.status === 'Approved', `Approve failed: ${approveRes.status}`);

      // Assign Document Writer role
      const roleRes = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/role', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'Document Writer' },
      });
      assert(roleRes.status === 200 && roleRes.body?.user?.role === 'Document Writer', `Role update failed: ${roleRes.status}`);
      assert(!('passwordHash' in roleRes.body.user), 'passwordHash leaked in role update response');

      // Verify all users in GET /api/auth/users are safe objects without passwordHash
      const listRes = await request(baseUrl, 'GET', '/api/auth/users', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(listRes.status === 200 && Array.isArray(listRes.body), `GET /api/auth/users failed: ${listRes.status}`);
      const leakedHash = listRes.body.some((u: any) => 'passwordHash' in u);
      assert(!leakedHash, 'passwordHash leaked in GET /api/auth/users');

      return `Super Admin verified, approved user sb-ordinary-user-101 as Document Writer, 0 passwordHash leaks across ${listRes.body.length} user records`;
    });

    // Test 8: Approved ordinary user can access own resources, but is blocked (403) from admin endpoints even with forged headers & user_metadata.role='Super Admin'
    await runTest('8. Approved ordinary user login works; admin endpoints return 403 even with forged headers and user_metadata.role', async () => {
      const meRes = await request(baseUrl, 'GET', '/api/auth/me', {
        headers: {
          Authorization: `Bearer ${ordinaryUserToken}`,
          'x-user-email': 'clearfile360@gmail.com',
          'x-user-role': 'Super Admin',
        },
      });
      assert(meRes.status === 200, `Expected 200 on /api/auth/me for approved user, got ${meRes.status}`);
      assert(meRes.body?.user?.role === 'Document Writer', `Expected role 'Document Writer', got '${meRes.body?.user?.role}'`);

      // Attempt to list users (Admin/Super Admin/Auditor only)
      const usersRes = await request(baseUrl, 'GET', '/api/auth/users', {
        headers: {
          Authorization: `Bearer ${ordinaryUserToken}`,
          'x-user-email': 'clearfile360@gmail.com',
          'x-user-role': 'Super Admin',
        },
      });

      // Attempt to self-promote via admin role endpoint
      const selfRoleRes = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/role', {
        headers: {
          Authorization: `Bearer ${ordinaryUserToken}`,
          'x-user-role': 'Super Admin',
        },
        body: { role: 'Super Admin' },
      });

      // Attempt to change status via admin status endpoint
      const statusRes = await request(baseUrl, 'PUT', '/api/auth/users/usr-1/status', {
        headers: {
          Authorization: `Bearer ${ordinaryUserToken}`,
          'x-user-role': 'Super Admin',
        },
        body: { status: 'Suspended' },
      });

      assert(
        usersRes.status === 403 && selfRoleRes.status === 403 && statusRes.status === 403,
        `Expected 403/403/403, got ${usersRes.status}/${selfRoleRes.status}/${statusRes.status}`
      );
      return `Approved user /api/auth/me=200 (role=${meRes.body.user.role}); admin endpoints returned ${usersRes.status}/${selfRoleRes.status}/${statusRes.status}`;
    });

    // Test 9: Suspended and Deleted accounts are consistently blocked (403) across API and sync-profile
    await runTest('9. Suspended and Deleted accounts blocked with 403 across all endpoints', async () => {
      // Super Admin suspends sb-ordinary-user-101
      const suspendRes = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/status', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { status: 'Suspended' },
      });
      assert(suspendRes.status === 200, `Expected 200 suspending user, got ${suspendRes.status}`);

      const suspDocs = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
      });
      const suspSync = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { full_name: 'Suspended User' },
      });
      assert(suspDocs.status === 403 && suspSync.status === 403, `Expected 403/403 for Suspended user, got ${suspDocs.status}/${suspSync.status}`);

      // Super Admin marks sb-ordinary-user-101 as Deleted
      const deleteRes = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/status', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { status: 'Deleted' },
      });
      assert(deleteRes.status === 200, `Expected 200 deleting user, got ${deleteRes.status}`);

      const delDocs = await request(baseUrl, 'GET', '/api/documents', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
      });
      const delSync = await request(baseUrl, 'POST', '/api/auth/sync-profile', {
        headers: { Authorization: `Bearer ${ordinaryUserToken}` },
        body: { full_name: 'Deleted User' },
      });
      assert(delDocs.status === 403 && delSync.status === 403, `Expected 403/403 for Deleted user, got ${delDocs.status}/${delSync.status}`);

      return `Suspended(GET /api/documents=${suspDocs.status}, POST /api/auth/sync-profile=${suspSync.status}); Deleted(GET /api/documents=${delDocs.status}, POST /api/auth/sync-profile=${delSync.status})`;
    });

    // Test 10: Non-Super Admin (e.g. Admin role) cannot assign privileged roles (Super Admin, Admin, Auditor)
    await runTest('10. Privileged role assignment restricted strictly to Super Admin', async () => {
      // Create an approved Admin user in disposable DB
      const existingUsers = await db.getUsers();
      await db.saveUsers([
        ...existingUsers,
        {
          id: 'sb-admin-202',
          name: 'Dept Admin',
          email: 'dept.admin@example.com',
          phone: '9840000202',
          organization: 'Mylapore Registry',
          role: 'Admin',
          permissions: ['view_users'],
          passwordHash: '',
          status: 'Approved',
          createdAt: new Date().toISOString(),
        },
      ]);
      const adminToken = signHs256Jwt({
        sub: 'sb-admin-202',
        email: 'dept.admin@example.com',
      });

      const promoteToSuperAdmin = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/role', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { role: 'Super Admin' },
      });
      const promoteToAuditor = await request(baseUrl, 'PUT', '/api/auth/users/sb-ordinary-user-101/role', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { role: 'Auditor' },
      });
      assert(
        promoteToSuperAdmin.status === 403 && promoteToAuditor.status === 403,
        `Expected 403/403 when Admin assigns Super Admin or Auditor, got ${promoteToSuperAdmin.status}/${promoteToAuditor.status}`
      );
      return `Admin assigning Super Admin=${promoteToSuperAdmin.status}, assigning Auditor=${promoteToAuditor.status}`;
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\n[Phase 1 Verification Summary] ${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runPhase1Verification().catch((err) => {
  console.error('Verification runner crashed:', err);
  process.exit(1);
});
