/**
 * PHASE 3 VERIFICATION SUITE — DATABASE POLICIES AND STORAGE
 *
 * Tests and verifies:
 * 1. Fresh migrations (SQL migration runner + local data migration runner)
 * 2. Upgrade migrations, checksum verification, and transactional rollback on failed migration
 * 3. Non-recursive user_profiles RLS policies, column-level grants, ownership policies, and Firebase hardening
 * 4. UUID record IDs and server-controlled unique document references (docNo)
 * 5. Per-record CRUD operations and optimistic concurrency control (revision / 409 Conflict)
 * 6. Persistence failure propagation (no swallowed file-write errors) and rollback on failed writes
 * 7. Production guardrails: PII encryption key enforcement, PostgreSQL TLS certificate verification, and no silent PostgreSQL-to-JSON fallback
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

// Configure disposable test environment BEFORE importing backend modules
process.env.NODE_ENV = 'test';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-phase3-verify-'));
process.env.DEEDOS_DATA_DIR = tempDir;

const { default: app, setTokenVerifierForTesting } = await import('../server');
const {
  db,
  isValidUuid,
  setSimulatedWriteFailure,
  runLocalDataMigrations
} = await import('../db');
const {
  loadMigrationDefinitions,
  runSqlMigrations,
  evaluateUserProfilePolicy
} = await import('../migrations');
const {
  buildPostgresSslConfig,
  validateDatabaseMode,
  disablePostgres,
  isPostgres
} = await import('../dbClient');
const {
  resolvePiiEncryptionKey,
  DEV_FALLBACK_PII_KEY
} = await import('../pii');
const { isFirebaseRetired } = await import('../../src/utils/firebase');

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const badge = passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] ${name}: ${details}`);
}

// Synthetic identities for Phase 3 testing
const WRITER_A = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'writer.a.phase3@synthetic.test',
  rawEmail: 'writer.a.phase3@synthetic.test',
  name: 'Synthetic Writer A'
};

const WRITER_B = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'writer.b.phase3@synthetic.test',
  rawEmail: 'writer.b.phase3@synthetic.test',
  name: 'Synthetic Writer B'
};

const SUPER_ADMIN = {
  id: '99999999-9999-4999-8999-999999999999',
  email: 'clearfile360@gmail.com',
  rawEmail: 'clearfile360@gmail.com',
  name: 'Synthetic Super Admin'
};

const tokenMap = new Map<string, typeof WRITER_A>([
  ['token-phase3-writer-a', WRITER_A],
  ['token-phase3-writer-b', WRITER_B],
  ['token-phase3-super-admin', SUPER_ADMIN]
]);

setTokenVerifierForTesting(async (token: string) => {
  return tokenMap.get(token) || null;
});

// Seed synthetic users in disposable storage
await db.createUser({
  id: WRITER_A.id,
  name: WRITER_A.name,
  email: WRITER_A.email,
  phone: '9000011111',
  organization: 'Synthetic Registry Office A',
  role: 'Document Writer',
  permissions: ['view_own_deeds'],
  status: 'Approved',
  passwordHash: '',
  createdAt: new Date().toISOString()
});

await db.createUser({
  id: WRITER_B.id,
  name: WRITER_B.name,
  email: WRITER_B.email,
  phone: '9000022222',
  organization: 'Synthetic Registry Office B',
  role: 'Document Writer',
  permissions: ['view_own_deeds'],
  status: 'Approved',
  passwordHash: '',
  createdAt: new Date().toISOString()
});

await db.createUser({
  id: SUPER_ADMIN.id,
  name: SUPER_ADMIN.name,
  email: SUPER_ADMIN.email,
  phone: '9000099999',
  organization: 'TN Registration Directorate',
  role: 'Super Admin',
  permissions: ['*'],
  status: 'Approved',
  passwordHash: '',
  createdAt: new Date().toISOString()
});

const server = app.listen(0);
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
const baseUrl = `http://127.0.0.1:${port}`;

async function apiRequest(
  method: string,
  endpoint: string,
  options: {
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/**
 * In-memory transactional SQL executor for testing runSqlMigrations (fresh, upgrade, and rollback)
 */
function createMockSqlExecutor(options?: { failOnVersion?: string; preSeededMigrations?: Array<{ version: string; name: string; checksum: string; applied_at: string }> }) {
  let committedMigrations = [...(options?.preSeededMigrations || [])];
  let workingMigrations = [...committedMigrations];
  let inTransaction = false;
  const executedStatements: string[] = [];
  let rollbackCount = 0;

  const runSql = async (sqlText: string, params?: any[]) => {
    const normalized = sqlText.trim();
    executedStatements.push(normalized);

    if (normalized === 'BEGIN') {
      inTransaction = true;
      workingMigrations = [...committedMigrations];
      return [];
    }
    if (normalized === 'COMMIT') {
      if (inTransaction) {
        committedMigrations = [...workingMigrations];
        inTransaction = false;
      }
      return [];
    }
    if (normalized === 'ROLLBACK') {
      if (inTransaction) {
        workingMigrations = [...committedMigrations];
        inTransaction = false;
        rollbackCount += 1;
      }
      return [];
    }
    if (normalized.startsWith('SELECT version, name, checksum')) {
      return [...committedMigrations];
    }
    if (normalized.startsWith('INSERT INTO schema_migrations')) {
      const [version, name, checksum] = params || [];
      if (options?.failOnVersion && version === options.failOnVersion) {
        throw new Error(`Simulated SQL failure in migration ${options.failOnVersion}`);
      }
      workingMigrations.push({
        version,
        name,
        checksum,
        applied_at: new Date().toISOString()
      });
      return [];
    }

    // Check if this statement belongs to a migration that should simulate failure
    if (
      options?.failOnVersion &&
      (normalized.includes(`Migration: ${options.failOnVersion}`) ||
        normalized.includes(`Migration ${options.failOnVersion}`))
    ) {
      throw new Error(`Simulated SQL failure in migration ${options.failOnVersion}`);
    }

    return [];
  };

  const executor = {
    getCommittedMigrations: () => [...committedMigrations],
    getExecutedStatements: () => [...executedStatements],
    getRollbackCount: () => rollbackCount,
    async execute(sqlText: string, params?: any[]) {
      await runSql(sqlText, params);
    },
    async query(sqlText: string, params?: any[]) {
      return await runSql(sqlText, params);
    },
    async withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      await runSql('BEGIN');
      try {
        const res = await fn(executor);
        await runSql('COMMIT');
        return res;
      } catch (err) {
        await runSql('ROLLBACK');
        throw err;
      }
    }
  };

  return executor;
}

try {
  // =========================================================================
  // TEST 1: Fresh Migrations (SQL + Local Data Store)
  // =========================================================================
  {
    const definitions = loadMigrationDefinitions();
    const mockSql = createMockSqlExecutor();
    const firstRun = await runSqlMigrations(mockSql as any);
    const secondRun = await runSqlMigrations(mockSql as any);

    const freshLocalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-fresh-mig-'));
    const localMigState = await runLocalDataMigrations(freshLocalDir);
    fs.rmSync(freshLocalDir, { recursive: true, force: true });

    const passed =
      definitions.length === 3 &&
      firstRun.applied.length === 3 &&
      firstRun.skipped.length === 0 &&
      secondRun.applied.length === 0 &&
      secondRun.skipped.length === 3 &&
      localMigState.appliedMigrations.length === 3 &&
      localMigState.appliedMigrations[0].version === '001' &&
      localMigState.appliedMigrations[1].version === '002' &&
      localMigState.appliedMigrations[2].version === '003';

    record(
      '1. Fresh migrations (SQL + data store) & idempotency',
      passed,
      `Definitions=${definitions.length}, SQL 1st run applied=${firstRun.applied.join(',')}, SQL 2nd run skipped=${secondRun.skipped.join(',')}, Local migrations=${localMigState.appliedMigrations.map(m => m.version).join(',')}`
    );
  }

  // =========================================================================
  // TEST 2: Upgrade Migrations, Checksum Verification & Rollback on Failed Migration
  // =========================================================================
  {
    const definitions = loadMigrationDefinitions();
    const mig001 = definitions[0];

    // 2a. Upgrade SQL migration from v001 -> v003
    const upgradeSqlExec = createMockSqlExecutor({
      preSeededMigrations: [
        {
          version: mig001.version,
          name: mig001.name,
          checksum: mig001.checksum,
          applied_at: new Date().toISOString()
        }
      ]
    });
    const upgradeSqlResult = await runSqlMigrations(upgradeSqlExec as any);

    // 2b. Rollback on failed SQL migration (simulate failure in 003)
    const failingSqlExec = createMockSqlExecutor({
      preSeededMigrations: [
        {
          version: mig001.version,
          name: mig001.name,
          checksum: mig001.checksum,
          applied_at: new Date().toISOString()
        }
      ],
      failOnVersion: '003'
    });
    let sqlFailedAsExpected = false;
    try {
      await runSqlMigrations(failingSqlExec as any);
    } catch {
      sqlFailedAsExpected = true;
    }
    const committedAfterFailure = failingSqlExec.getCommittedMigrations();

    // 2c. Tampered checksum detection
    const tamperedSqlExec = createMockSqlExecutor({
      preSeededMigrations: [
        {
          version: mig001.version,
          name: mig001.name,
          checksum: 'tampered_checksum_0000',
          applied_at: new Date().toISOString()
        }
      ]
    });
    let checksumTamperDetected = false;
    try {
      await runSqlMigrations(tamperedSqlExec as any);
    } catch (err: any) {
      checksumTamperDetected = String(err?.message || '').includes('checksum mismatch');
    }

    // 2d. Upgrade legacy v1 local data (without revision, without createdByUserId, with plaintext PAN/Aadhaar)
    const upgradeLocalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-upgrade-mig-'));
    fs.writeFileSync(
      path.join(upgradeLocalDir, 'users.json'),
      JSON.stringify([
        {
          id: WRITER_A.id,
          name: 'Legacy Writer A',
          email: WRITER_A.email,
          role: 'Document Writer',
          status: 'Approved',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    fs.writeFileSync(
      path.join(upgradeLocalDir, 'clients.json'),
      JSON.stringify([
        {
          id: 'legacy-client-1',
          name: 'Legacy Client',
          pan: 'ABCDE1234F',
          aadhaar: '123456789012',
          createdBy: WRITER_A.email,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    fs.writeFileSync(
      path.join(upgradeLocalDir, 'documents.json'),
      JSON.stringify([
        {
          id: 'legacy-doc-1',
          docNo: 'DEED/2026/1050',
          docType: 'Sale Deed',
          createdBy: WRITER_A.email,
          state: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          modifiedAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );

    const upgradedState = await runLocalDataMigrations(upgradeLocalDir);
    const upgradedUsers = JSON.parse(fs.readFileSync(path.join(upgradeLocalDir, 'users.json'), 'utf8'));
    const upgradedClients = JSON.parse(fs.readFileSync(path.join(upgradeLocalDir, 'clients.json'), 'utf8'));
    const upgradedDocs = JSON.parse(fs.readFileSync(path.join(upgradeLocalDir, 'documents.json'), 'utf8'));
    fs.rmSync(upgradeLocalDir, { recursive: true, force: true });

    const passed =
      upgradeSqlResult.applied.join(',') === '002,003' &&
      upgradeSqlResult.skipped.join(',') === '001' &&
      sqlFailedAsExpected &&
      failingSqlExec.getRollbackCount() === 1 &&
      committedAfterFailure.map(m => m.version).join(',') === '001,002' &&
      checksumTamperDetected &&
      upgradedState.applied.length === 3 &&
      upgradedUsers[0].revision === 1 &&
      upgradedClients[0].revision === 1 &&
      upgradedClients[0].createdByUserId === WRITER_A.id &&
      String(upgradedClients[0].pan).startsWith('v1:') &&
      String(upgradedClients[0].aadhaar).startsWith('v1:') &&
      upgradedDocs[0].revision === 1 &&
      upgradedDocs[0].createdByUserId === WRITER_A.id;

    record(
      '2. Upgrade migrations, checksum verification & rollback on failed migration',
      passed,
      `Upgrade applied=[${upgradeSqlResult.applied.join(',')}], Rollbacks=${failingSqlExec.getRollbackCount()}, TamperDetected=${checksumTamperDetected}, UpgradedClientRev=${upgradedClients[0]?.revision}, EncryptedPAN=${String(upgradedClients[0]?.pan).startsWith('v1:')}`
    );
  }

  // =========================================================================
  // TEST 3: Database Policies, Grants, Non-Recursive user_profiles & Firebase Hardening
  // =========================================================================
  {
    const mig003Sql = fs.readFileSync(
      path.join(process.cwd(), 'backend/migrations/003_rls_policies_and_grants.sql'),
      'utf8'
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'backend/schema.sql'), 'utf8');
    const firestoreRules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

    // Verify no recursive SELECT FROM public.user_profiles inside CREATE POLICY ... ON public.user_profiles
    const policyBlocks = mig003Sql.split(/CREATE POLICY/i).slice(1);
    const userProfilePolicies = policyBlocks.filter(b => /ON\s+public\.user_profiles/i.test(b));
    const hasRecursiveUserProfilePolicy = userProfilePolicies.some(b =>
      /FROM\s+public\.user_profiles/i.test(b)
    );

    const hasSecurityDefinerHelpers =
      mig003Sql.includes('CREATE OR REPLACE FUNCTION public.current_user_role()') &&
      mig003Sql.includes('SECURITY DEFINER') &&
      mig003Sql.includes('SET search_path = public, pg_temp') &&
      schemaSql.includes('CREATE OR REPLACE FUNCTION public.current_user_role()');

    const hasColumnLevelGrants =
      mig003Sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;') &&
      mig003Sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon') &&
      mig003Sql.includes('GRANT INSERT (id, full_name, email, avatar_url, organization) ON public.user_profiles TO authenticated') &&
      mig003Sql.includes('GRANT UPDATE (full_name, avatar_url, organization, last_login, last_activity) ON public.user_profiles TO authenticated');

    // Evaluate user_profiles policy + trigger rules across scenarios
    const writerAProfile = {
      id: WRITER_A.id,
      full_name: 'Old Name',
      email: WRITER_A.email,
      role: 'Document Writer',
      permissions: ['view_own_deeds'],
      status: 'active',
      revision: 1,
      created_at: new Date().toISOString()
    };

    const superAdminProfile = {
      id: SUPER_ADMIN.id,
      full_name: SUPER_ADMIN.name,
      email: SUPER_ADMIN.email,
      role: 'Super Admin',
      permissions: ['*'],
      status: 'active',
      revision: 1,
      created_at: new Date().toISOString()
    };

    const ordinarySelfUpdateSafe = evaluateUserProfilePolicy({
      operation: 'UPDATE',
      authUid: WRITER_A.id,
      authEmail: WRITER_A.email,
      callerProfile: writerAProfile,
      existingRow: writerAProfile,
      incomingRow: {
        id: WRITER_A.id,
        email: WRITER_A.email,
        role: 'Document Writer',
        status: 'active',
        permissions: ['view_own_deeds'],
        full_name: 'New Safe Name'
      }
    });

    const ordinarySelfPromoteRole = evaluateUserProfilePolicy({
      operation: 'UPDATE',
      authUid: WRITER_A.id,
      authEmail: WRITER_A.email,
      callerProfile: writerAProfile,
      existingRow: writerAProfile,
      incomingRow: {
        id: WRITER_A.id,
        email: WRITER_A.email,
        role: 'Super Admin',
        status: 'active',
        permissions: ['*']
      }
    });

    const pendingClientProfile = {
      id: WRITER_A.id,
      full_name: WRITER_A.name,
      email: WRITER_A.email,
      role: 'Client',
      permissions: ['view_own_deeds'],
      status: 'pending',
      revision: 1,
      created_at: new Date().toISOString()
    };

    const ordinarySelfApproveStatus = evaluateUserProfilePolicy({
      operation: 'UPDATE',
      authUid: WRITER_A.id,
      authEmail: WRITER_A.email,
      callerProfile: pendingClientProfile,
      existingRow: pendingClientProfile,
      incomingRow: {
        id: WRITER_A.id,
        email: WRITER_A.email,
        role: 'Client',
        status: 'active'
      }
    });

    const superAdminPromoteRole = evaluateUserProfilePolicy({
      operation: 'UPDATE',
      authUid: SUPER_ADMIN.id,
      authEmail: SUPER_ADMIN.email,
      callerProfile: superAdminProfile,
      existingRow: writerAProfile,
      incomingRow: {
        id: WRITER_A.id,
        email: WRITER_A.email,
        role: 'Admin',
        status: 'active'
      }
    });

    // Check Firestore rules hardening
    const hasGlobalSignedInDeedAccess =
      /match\s+\/documents\/\{documentId\}[\s\S]*?allow\s+(read|write|create|update|delete)\s*:\s*if\s+isSignedIn\(\)\s*;/i.test(
        firestoreRules
      );
    const hasAdminSubstringCheck =
      /email\.matches\(.*admin.*\)/i.test(firestoreRules) ||
      /email\.includes\(\s*['"]admin['"]\s*\)/i.test(firestoreRules);
    const hasFirestoreRevisionCheck =
      firestoreRules.includes('incoming().revision == existing().revision + 1');

    const firebaseRetired = isFirebaseRetired();

    const passed =
      userProfilePolicies.length >= 4 &&
      !hasRecursiveUserProfilePolicy &&
      hasSecurityDefinerHelpers &&
      hasColumnLevelGrants &&
      ordinarySelfUpdateSafe.allowed === true &&
      ordinarySelfPromoteRole.allowed === false &&
      ordinarySelfApproveStatus.allowed === false &&
      superAdminPromoteRole.allowed === true &&
      !hasGlobalSignedInDeedAccess &&
      !hasAdminSubstringCheck &&
      hasFirestoreRevisionCheck &&
      firebaseRetired;

    record(
      '3. Non-recursive user_profiles RLS, column grants, trigger checks & Firebase hardening',
      passed,
      `RecursivePolicy=${hasRecursiveUserProfilePolicy}, SecDefiner=${hasSecurityDefinerHelpers}, ColGrants=${hasColumnLevelGrants}, SelfPromoteAllowed=${ordinarySelfPromoteRole.allowed}, GlobalFirestoreDeeds=${hasGlobalSignedInDeedAccess}, FirebaseRetired=${firebaseRetired}`
    );
  }

  // =========================================================================
  // TEST 4: UUID Record IDs & Server-Controlled Unique Document References (docNo)
  // =========================================================================
  let doc1Id = '';
  let doc1No = '';
  let client1Id = '';
  {
    const createDoc1 = await apiRequest('POST', '/api/documents', {
      token: 'token-phase3-writer-a',
      body: {
        docType: 'Sale Deed',
        subType: 'Sale in Metro Area',
        propertyAddress: 'Plot 10, Anna Nagar, Chennai',
        consideration: 5500000,
        state: {
          documentType: 'SALE',
          parties: [{ id: 'p1', name: 'Seller One', role: 'Seller' }]
        }
      }
    });

    const createDoc2 = await apiRequest('POST', '/api/documents', {
      token: 'token-phase3-writer-a',
      body: {
        docType: 'Gift Settlement Deed',
        subType: 'Gift to Family Member',
        propertyAddress: 'Plot 11, Anna Nagar, Chennai',
        consideration: 2500000,
        state: {
          documentType: 'GIFT',
          parties: [{ id: 'p1', name: 'Donor One', role: 'Donor' }]
        }
      }
    });

    doc1Id = createDoc1.body?.document?.id || '';
    doc1No = createDoc1.body?.document?.docNo || '';
    const doc2Id = createDoc2.body?.document?.id || '';
    const doc2No = createDoc2.body?.document?.docNo || '';

    // Attempt to create a document with a duplicate docNo -> must fail with 409 Conflict
    const dupDocNoAttempt = await apiRequest('POST', '/api/documents', {
      token: 'token-phase3-writer-a',
      body: {
        docNo: doc1No,
        docType: 'Sale Deed',
        propertyAddress: 'Duplicate DocNo Plot'
      }
    });

    // Create client without ID -> must receive UUID v4
    const createClient1 = await apiRequest('POST', '/api/clients', {
      token: 'token-phase3-writer-a',
      body: {
        name: 'Phase 3 Client Alpha',
        fatherName: 'Father Alpha',
        age: 40,
        pan: 'PHTHR1234A',
        aadhaar: '444455556666',
        phone: '9840012345',
        email: 'client.alpha@synthetic.test',
        address: 'No. 1, Gandhi Road, Chennai'
      }
    });
    client1Id = createClient1.body?.client?.id || '';

    const docNoPattern = /^DEED\/\d{4}\/\d{4,}$/;
    const passed =
      createDoc1.status === 201 &&
      createDoc2.status === 201 &&
      isValidUuid(doc1Id) &&
      isValidUuid(doc2Id) &&
      doc1Id !== doc2Id &&
      docNoPattern.test(doc1No) &&
      docNoPattern.test(doc2No) &&
      doc1No !== doc2No &&
      dupDocNoAttempt.status === 409 &&
      createClient1.status === 201 &&
      isValidUuid(client1Id);

    record(
      '4. UUID record IDs & server-controlled unique document references (docNo)',
      passed,
      `doc1Id=${doc1Id} (UUID=${isValidUuid(doc1Id)}), doc1No=${doc1No}, doc2No=${doc2No}, dupDocNoStatus=${dupDocNoAttempt.status}, client1Id=${client1Id} (UUID=${isValidUuid(client1Id)})`
    );
  }

  // =========================================================================
  // TEST 5: Per-Record Operations & Optimistic Concurrency Control (revision)
  // =========================================================================
  {
    // Both Editor 1 and Editor 2 load doc1 at revision 1
    const getInitial = await apiRequest('GET', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a'
    });
    const initialRev = getInitial.body?.document?.revision;

    // Editor 1 updates doc1 with revision: 1 -> succeeds and increments revision to 2
    const editor1Update = await apiRequest('PUT', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a',
      body: {
        revision: initialRev,
        propertyAddress: 'Plot 10-A, Updated by Editor 1',
        progress: 45,
        docNo: 'DEED/2099/9999' // Attempt to tamper with server-controlled docNo -> must be ignored
      }
    });
    const newRevAfterEditor1 = editor1Update.body?.document?.revision;
    const preservedDocNo = editor1Update.body?.document?.docNo;

    // Editor 2 submits stale update with revision: 1 -> must fail with 409 Conflict
    const editor2StaleBodyUpdate = await apiRequest('PUT', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a',
      body: {
        revision: initialRev,
        propertyAddress: 'Plot 10-B, Stale Overwrite by Editor 2',
        progress: 90
      }
    });

    // Editor 2 also tries stale If-Match header -> must fail with 409 Conflict
    const editor2StaleHeaderUpdate = await apiRequest('PUT', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a',
      headers: { 'If-Match': `"${initialRev}"` },
      body: {
        propertyAddress: 'Plot 10-C, Stale If-Match Overwrite'
      }
    });

    // Verify Editor 1's update is still intact on the server
    const verifyDoc = await apiRequest('GET', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a'
    });

    // Test optimistic concurrency on Client update as well
    const clientUpdate1 = await apiRequest('PUT', `/api/clients/${client1Id}`, {
      token: 'token-phase3-writer-a',
      body: {
        revision: 1,
        address: 'Updated Client Address Rev 2'
      }
    });
    const clientStaleUpdate = await apiRequest('PUT', `/api/clients/${client1Id}`, {
      token: 'token-phase3-writer-a',
      body: {
        revision: 1,
        address: 'Stale Client Address Overwrite'
      }
    });

    const passed =
      initialRev === 1 &&
      editor1Update.status === 200 &&
      newRevAfterEditor1 === 2 &&
      preservedDocNo === doc1No &&
      editor2StaleBodyUpdate.status === 409 &&
      editor2StaleHeaderUpdate.status === 409 &&
      verifyDoc.body?.document?.propertyAddress === 'Plot 10-A, Updated by Editor 1' &&
      verifyDoc.body?.document?.revision === 2 &&
      clientUpdate1.status === 200 &&
      clientUpdate1.body?.client?.revision === 2 &&
      clientStaleUpdate.status === 409;

    record(
      '5. Per-record operations & optimistic concurrency control (revision / 409 Conflict)',
      passed,
      `initialRev=${initialRev}, editor1Status=${editor1Update.status} (rev=${newRevAfterEditor1}), staleBodyStatus=${editor2StaleBodyUpdate.status}, staleIfMatchStatus=${editor2StaleHeaderUpdate.status}, clientStaleStatus=${clientStaleUpdate.status}`
    );
  }

  // =========================================================================
  // TEST 6: Persistence Failure Propagation & Rollback on Failed Writes
  // =========================================================================
  {
    // Capture state before simulated disk write failure
    const beforeDoc = await db.getDocumentById(doc1Id);
    const beforeDocCount = (await db.getDocuments()).length;
    const beforeClientCount = (await db.getClients()).length;

    // Enable simulated storage write failure
    setSimulatedWriteFailure('Simulated disk I/O full error');

    const failedCreateDoc = await apiRequest('POST', '/api/documents', {
      token: 'token-phase3-writer-a',
      body: {
        docType: 'Sale Deed',
        propertyAddress: 'Should Not Persist'
      }
    });

    const failedUpdateDoc = await apiRequest('PUT', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a',
      body: {
        revision: beforeDoc?.revision,
        propertyAddress: 'Should Rollback On Write Failure'
      }
    });

    const failedDeleteDoc = await apiRequest('DELETE', `/api/documents/${doc1Id}`, {
      token: 'token-phase3-writer-a'
    });

    const failedCreateClient = await apiRequest('POST', '/api/clients', {
      token: 'token-phase3-writer-a',
      body: {
        name: 'Should Not Persist Client',
        phone: '9999900000'
      }
    });

    // Clear simulated write failure
    setSimulatedWriteFailure(null);

    // Verify state after failed writes is completely unchanged
    const afterDoc = await db.getDocumentById(doc1Id);
    const afterDocCount = (await db.getDocuments()).length;
    const afterClientCount = (await db.getClients()).length;

    const passed =
      failedCreateDoc.status === 500 &&
      failedUpdateDoc.status === 500 &&
      failedDeleteDoc.status === 500 &&
      failedCreateClient.status === 500 &&
      afterDocCount === beforeDocCount &&
      afterClientCount === beforeClientCount &&
      afterDoc?.propertyAddress === beforeDoc?.propertyAddress &&
      afterDoc?.revision === beforeDoc?.revision;

    record(
      '6. Persistence failure propagation & rollback on failed writes',
      passed,
      `failedStatuses=[${failedCreateDoc.status},${failedUpdateDoc.status},${failedDeleteDoc.status},${failedCreateClient.status}], docCountBefore=${beforeDocCount}/After=${afterDocCount}, docRevBefore=${beforeDoc?.revision}/After=${afterDoc?.revision}`
    );
  }

  // =========================================================================
  // TEST 7: Production Guardrails (PII Key, Remote TLS Verification, No Silent JSON Fallback)
  // =========================================================================
  {
    // 7a. Production PII encryption key requirement
    let missingPiiKeyBlocked = false;
    try {
      resolvePiiEncryptionKey({ NODE_ENV: 'production', PII_ENCRYPTION_KEY: '' });
    } catch {
      missingPiiKeyBlocked = true;
    }

    let defaultFallbackPiiKeyBlocked = false;
    try {
      resolvePiiEncryptionKey({ NODE_ENV: 'production', PII_ENCRYPTION_KEY: DEV_FALLBACK_PII_KEY });
    } catch {
      defaultFallbackPiiKeyBlocked = true;
    }

    const validProdKey = resolvePiiEncryptionKey({
      NODE_ENV: 'production',
      PII_ENCRYPTION_KEY: 'prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e'
    });

    // 7b. Remote PostgreSQL TLS certificate verification
    const remoteSslConfig = buildPostgresSslConfig(
      'postgresql://deeduser:secret@db.unikorn360.example.com:5432/deed360',
      { NODE_ENV: 'production' }
    );
    const localSslConfig = buildPostgresSslConfig(
      'postgresql://postgres:postgres@localhost:5432/deed360',
      { NODE_ENV: 'development' }
    );

    let insecureSslRejectUnauthorizedBlocked = false;
    try {
      buildPostgresSslConfig('postgresql://deeduser:secret@db.unikorn360.example.com:5432/deed360', {
        NODE_ENV: 'production',
        PGSSLREJECTUNAUTHORIZED: 'false'
      });
    } catch {
      insecureSslRejectUnauthorizedBlocked = true;
    }

    let insecureSslModeNoVerifyBlocked = false;
    try {
      buildPostgresSslConfig(
        'postgresql://deeduser:secret@db.unikorn360.example.com:5432/deed360?sslmode=no-verify',
        { NODE_ENV: 'production' }
      );
    } catch {
      insecureSslModeNoVerifyBlocked = true;
    }

    // 7c. Prevent silent PostgreSQL-to-JSON fallback in production
    let missingProdDbUrlBlocked = false;
    try {
      validateDatabaseMode({ NODE_ENV: 'production', DATABASE_URL: '' });
    } catch {
      missingProdDbUrlBlocked = true;
    }

    let prodFallbackBlocked = false;
    try {
      disablePostgres({ NODE_ENV: 'production' });
    } catch {
      prodFallbackBlocked = true;
    }

    const passed =
      missingPiiKeyBlocked &&
      defaultFallbackPiiKeyBlocked &&
      validProdKey.length >= 32 &&
      remoteSslConfig !== false &&
      remoteSslConfig.rejectUnauthorized === true &&
      localSslConfig === false &&
      insecureSslRejectUnauthorizedBlocked &&
      insecureSslModeNoVerifyBlocked &&
      missingProdDbUrlBlocked &&
      prodFallbackBlocked &&
      isPostgres === false;

    record(
      '7. Production guardrails (PII key, remote PostgreSQL TLS verification, no silent JSON fallback)',
      passed,
      `MissingPiiBlocked=${missingPiiKeyBlocked}, DefaultPiiBlocked=${defaultFallbackPiiKeyBlocked}, RemoteTLSRejectUnauthorized=${remoteSslConfig !== false ? remoteSslConfig.rejectUnauthorized : 'false'}, NoVerifyBlocked=${insecureSslModeNoVerifyBlocked}, ProdJsonFallbackBlocked=${prodFallbackBlocked}`
    );
  }
} finally {
  server.close();
  setTokenVerifierForTesting(null);
  setSimulatedWriteFailure(null);
  fs.rmSync(tempDir, { recursive: true, force: true });
}

const passedCount = results.filter(r => r.passed).length;
console.log(`\nPhase 3 Verification Summary: ${passedCount}/${results.length} checks passed.`);

if (passedCount !== results.length) {
  process.exit(1);
}
