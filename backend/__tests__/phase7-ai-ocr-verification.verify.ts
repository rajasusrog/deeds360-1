import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Configure disposable isolated test environment
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-phase7-'));
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tempDir;
process.env.DATA_DIR = tempDir;
const TEST_PII_KEY = crypto.randomBytes(32).toString('hex');
process.env.PII_ENCRYPTION_KEY = TEST_PII_KEY;

import {
  validateUploadPayload,
  checkAiQuota,
  UploadValidationError,
  AiServiceError,
  QuotaExceededError,
  aiExtractDocumentData
} from '../ai.ts';

import {
  calculateTrustScore,
  UIDAIAadhaarConnector,
  NsdlPanConnector,
  TnreginetGuidelineConnector,
  ESevaiPattaConnector,
  EcRegistryConnector
} from '../../src/utils/verificationService.ts';

import { DeedWizardState } from '../../src/types/index.ts';

function buildSyntheticState(overrides: Record<string, any> = {}): any {
  const base: any = {
    documentType: 'SALE',
    documentSubType: 'SALE_METRO',
    parties: [
      {
        id: 'party-seller-7',
        role: 'Seller',
        name: 'M. Selvakumar',
        nameTa: 'செல்வகுமார்',
        fatherName: 'Muthuswamy',
        age: 52,
        pan: 'ABCPS1234F',
        aadhaar: '458912345678',
        mobile: '9840123456',
        phone: '9840123456',
        email: 'seller@example.test',
        address: 'No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041'
      },
      {
        id: 'party-buyer-7',
        role: 'Buyer',
        name: 'K. Senthil Nathan',
        nameTa: 'செந்தில் நாதன்',
        fatherName: 'Kandasamy',
        age: 41,
        pan: 'PQRSX5678K',
        aadhaar: '674321985432',
        mobile: '9840654321',
        phone: '9840654321',
        email: 'buyer@example.test',
        address: 'No. 12, Luz Church Road, Mylapore, Chennai - 600004'
      }
    ],
    witnesses: [
      {
        id: 'wit-1',
        name: 'V. Subramaniam',
        fatherName: 'Vaidyanathan',
        age: 45,
        address: 'Mylapore, Chennai',
        phone: '9884012345',
        aadhaar: '345678901234'
      },
      {
        id: 'wit-2',
        name: 'R. Ganesan',
        fatherName: 'Ramanathan',
        age: 50,
        address: 'Adyar, Chennai',
        phone: '9884099887',
        aadhaar: '891234567890'
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai South',
      taluk: 'Sholinganallur',
      village: 'Thiruvanmiyur',
      sro: 'Thiruvanmiyur',
      propertyType: 'Plot',
      marketValue: 5000000
    },
    survey: {
      surveyNo: '340',
      subDivision: '5',
      pattaNo: '123',
      tslrNo: '45'
    },
    surveys: [
      {
        id: 'surv-1',
        surveyNo: '340',
        subDivision: '5',
        pattaNo: '123',
        tslrNo: '45',
        sqft: 2400
      }
    ],
    extent: {
      totalExtent: 2400,
      areaUnit: 'Sq.ft'
    },
    boundary: {
      north: 'Plot No. 46',
      south: 'Vacant Land',
      east: 'Plot No. 44',
      west: '30 Feet Road'
    },
    ownershipHistory: {
      parentDocType: 'Parent Deed',
      priorOwners: 'Muthuswamy Mudaliar',
      parentDocNo: '1234/1998',
      parentDocYear: '1998',
      parentDocDate: '1998-05-10',
      parentDocSRO: 'Thiruvanmiyur',
      historyNarrative: 'Acquired via absolute sale deed dated 1998.'
    },
    transaction: {
      considerationAmount: 5000000,
      marketValue: 5000000,
      advancePaid: 500000,
      balancePaid: 4500000,
      paymentMode: 'Cheque',
      paymentRefNo: 'CHQ-889900',
      bankName: 'Indian Bank',
      paymentDate: '2026-03-15'
    },
    selectedClauses: ['HANDOVER_POSSESSION', 'ENCUMBRANCE_FREE']
  };

  return { ...base, ...overrides };
}

let server: http.Server;
let baseUrl = '';

function request(
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; text: string }> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (serializedBody !== undefined && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(serializedBody).toString();
    }

    const req = http.request(
      fullUrl,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            text: raw
          });
        });
      }
    );

    req.on('error', reject);
    if (serializedBody !== undefined) {
      req.write(serializedBody);
    }
    req.end();
  });
}

async function runPhase7Tests() {
  console.log('--- STARTING PHASE 7 AI, OCR & EXTERNAL VERIFICATION SUITE ---');

  const { default: app, setTokenVerifierForTesting } = await import('../server.ts');
  const { db, migrateAndBootstrap } = await import('../db.ts');

  await migrateAndBootstrap();

  // Create test user session
  const testWriter = await db.createUser({
    id: 'user-writer-phase7',
    name: 'Senior Document Writer',
    email: 'writer.phase7@unikorn360.test',
    phone: '9840100777',
    organization: 'Deed360 Chambers',
    role: 'Document Writer',
    permissions: ['view_own_deeds', 'create_deeds', 'edit_own_deeds'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  setTokenVerifierForTesting(async (token: string) => {
    if (token === 'token-writer-phase7') {
      return { id: testWriter.id, email: testWriter.email, rawEmail: testWriter.email, name: testWriter.name };
    }
    return null;
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: AI Endpoint Authentication
    // ------------------------------------------------------------------------
    console.log('Test 1: Verifying AI and Verification endpoints require authentication...');

    const aiEndpoints = [
      { method: 'POST', path: '/api/ai/extract' },
      { method: 'POST', path: '/api/ai/extract-doc' },
      { method: 'POST', path: '/api/ai/validate' },
      { method: 'POST', path: '/api/ai/recommend-clause' },
      { method: 'POST', path: '/api/ai/fraud-check' },
      { method: 'POST', path: '/api/verification/external-check' }
    ];

    for (const ep of aiEndpoints) {
      const res = await request(ep.method, ep.path, { dummy: 1 });
      assert.equal(
        res.status,
        401,
        `Unauthenticated request to ${ep.path} must return 401 Unauthorized (got ${res.status})`
      );
    }
    console.log('✓ Test 1 Passed: All AI & verification endpoints strictly require session authentication.');

    // ------------------------------------------------------------------------
    // TEST 2: Upload Size, MIME Type & Magic Bytes Content Inspection
    // ------------------------------------------------------------------------
    console.log('Test 2: Verifying upload payload size, MIME, and magic bytes inspection...');

    // 2a. Rejection of fake text masquerading as PNG base64
    const fakeTextBase64 = Buffer.from('data:image/png;base64,aGVsbG8gd29ybGQgZmFrZSB0ZXh0').toString('base64');
    assert.throws(
      () => validateUploadPayload(fakeTextBase64, 'image/png'),
      (err: any) => err instanceof UploadValidationError && err.message.includes('magic bytes'),
      'Fake text string masquerading as PNG must be rejected by magic byte inspection'
    );

    // 2b. Valid PNG magic bytes (\x89PNG\r\n\x1a\n...)
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const validPngBase64 = validPngHeader.toString('base64');
    const validatedPng = validateUploadPayload(validPngBase64, 'image/png');
    assert.equal(validatedPng.mimeType, 'image/png', 'PNG magic bytes correctly recognized');

    // 2c. Valid PDF magic bytes (%PDF-1.4)
    const validPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'utf8');
    const validPdfBase64 = validPdfHeader.toString('base64');
    const validatedPdf = validateUploadPayload(validPdfBase64, 'application/pdf');
    assert.equal(validatedPdf.mimeType, 'application/pdf', 'PDF magic bytes correctly recognized');

    // 2d. Oversized payload rejection (>10MB)
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    const oversizedBase64 = oversizedBuffer.toString('base64');
    assert.throws(
      () => validateUploadPayload(oversizedBase64, 'application/pdf'),
      (err: any) => err instanceof UploadValidationError && (err.statusCode === 413 || err.message.includes('exceeds')),
      'Payload > 10MB must be rejected as oversized'
    );

    // 2e. API endpoint validation with bad payload
    const badOcrRes = await request(
      'POST',
      '/api/ai/extract',
      { base64File: fakeTextBase64, mimeType: 'image/png' },
      { Authorization: 'Bearer token-writer-phase7' }
    );
    assert.equal(badOcrRes.status, 400, 'API endpoint must reject invalid magic bytes with 400 Bad Request');
    assert.ok(badOcrRes.body.error.includes('magic bytes'), 'Error message indicates magic bytes failure');
    console.log('✓ Test 2 Passed: Size limits, MIME types, and magic bytes content inspection enforced.');

    // ------------------------------------------------------------------------
    // TEST 3: Multi-Page Realistic Deed Scan Uploads
    // ------------------------------------------------------------------------
    console.log('Test 3: Testing realistic multi-page deed scan chunk uploads...');

    const multiPagePayload = {
      pages: [
        { pageNo: 1, base64File: validPdfBase64, mimeType: 'application/pdf' },
        { pageNo: 2, base64File: validPngBase64, mimeType: 'image/png' }
      ]
    };

    // Verify both pages pass validation
    const page1Val = validateUploadPayload(multiPagePayload.pages[0].base64File, multiPagePayload.pages[0].mimeType, 1);
    const page2Val = validateUploadPayload(multiPagePayload.pages[1].base64File, multiPagePayload.pages[1].mimeType, 2);
    assert.equal(page1Val.pageNo, 1, 'Page 1 validated');
    assert.equal(page2Val.pageNo, 2, 'Page 2 validated');
    console.log('✓ Test 3 Passed: Multi-page deed scan chunk uploads validated successfully.');

    // ------------------------------------------------------------------------
    // TEST 4: Missing API Key & Isolated Demo Mode Configuration
    // ------------------------------------------------------------------------
    console.log('Test 4: Verifying explicit rejection when GEMINI_API_KEY is missing and demo mode is disabled...');

    delete process.env.GEMINI_API_KEY;
    delete process.env.ENABLE_DEMO_MODE;
    delete process.env.ALLOW_DEMO_FALLBACK;

    // With no API key and demo mode disabled, request MUST fail with 503 / 502 (Rule 1: no mock success for failed AI)
    const noKeyRes = await request(
      'POST',
      '/api/ai/extract',
      { base64File: validPdfBase64, mimeType: 'application/pdf' },
      { Authorization: 'Bearer token-writer-phase7' }
    );
    assert.equal(noKeyRes.status, 503, 'Missing API key without explicit demo flag must return 503 Service Unavailable');
    assert.ok(noKeyRes.body.error.includes('GEMINI_API_KEY is not configured'), 'Error explains missing key');

    // When ENABLE_DEMO_MODE=true is explicitly set, request succeeds and includes explicit demo notice
    process.env.ENABLE_DEMO_MODE = 'true';
    const demoRes = await request(
      'POST',
      '/api/ai/extract',
      { base64File: validPdfBase64, mimeType: 'application/pdf' },
      { Authorization: 'Bearer token-writer-phase7' }
    );
    assert.equal(demoRes.status, 200, 'Explicit DEMO_MODE enables isolated demo extraction');
    assert.equal(demoRes.body.isDemo, true, 'Response specifies isDemo: true');
    assert.equal(demoRes.body.extractionMode, 'DEMO_MODE', 'Response specifies DEMO_MODE');
    assert.ok(demoRes.body.demoNotice.includes('Demonstration mode active'), 'Response contains demo notice');
    console.log('✓ Test 4 Passed: Missing API keys explicitly rejected; demo mode isolated behind ENABLE_DEMO_MODE flag.');

    // ------------------------------------------------------------------------
    // TEST 5: No Invented Confidence Percentages & Untrusted Input Sanitization
    // ------------------------------------------------------------------------
    console.log('Test 5: Verifying removal of invented confidence percentages and output sanitization...');

    assert.equal(demoRes.body.ocrConfidence, undefined, 'Artificial ocrConfidence score must NOT be present');
    assert.equal(demoRes.body.confidence, undefined, 'Artificial confidence score must NOT be present');

    // Untrusted input sanitization
    assert.ok(typeof demoRes.body.extractedData.seller.name === 'string', 'Extracted seller name is string');
    assert.ok(!demoRes.body.extractedData.seller.name.includes('<script>'), 'Extracted data is sanitized');
    console.log('✓ Test 5 Passed: No invented confidence percentages; extracted strings sanitized.');

    // ------------------------------------------------------------------------
    // TEST 6: No Fake Verification Claims & Explicit "Not externally verified"
    // ------------------------------------------------------------------------
    console.log('Test 6: Validating connectors and trust engine return "Not externally verified"...');

    const aadhaarConn = new UIDAIAadhaarConnector();
    const aadhaarRes = await aadhaarConn.verify('458912345678');
    assert.equal(aadhaarConn.id, 'uidai-aadhaar-gateway');
    assert.notEqual(aadhaarRes.status, 'Verified', 'Format check must NOT claim "Verified"');
    assert.equal(aadhaarRes.externalVerificationStatus, 'NOT_EXTERNALLY_VERIFIED', 'Status states NOT_EXTERNALLY_VERIFIED');

    const panConn = new NsdlPanConnector();
    const panRes = await panConn.verify('ABCPS1234F');
    assert.notEqual(panRes.status, 'Verified', 'PAN check must NOT claim "Verified"');
    assert.notEqual(panRes.taxpayerName, 'AUTOMATIC REGISTRY MATCH', 'PAN check must NOT claim "AUTOMATIC REGISTRY MATCH"');
    assert.equal(panRes.externalVerificationStatus, 'NOT_EXTERNALLY_VERIFIED', 'Status states NOT_EXTERNALLY_VERIFIED');

    const state = buildSyntheticState();
    const trustRes = calculateTrustScore(state);
    assert.equal(trustRes.externalVerification.status, 'NOT_EXTERNALLY_VERIFIED', 'Trust score external verification states NOT_EXTERNALLY_VERIFIED');
    assert.ok(trustRes.externalVerification.details.includes('No live external government API'), 'Details explain missing live connection');
    console.log('✓ Test 6 Passed: Deceptive verification claims eliminated; "Not externally verified" displayed.');

    // ------------------------------------------------------------------------
    // TEST 7: Distinct 4-Tier Verification Response Model
    // ------------------------------------------------------------------------
    console.log('Test 7: Validating 4-tier verification model structure...');

    const extCheckRes = await request(
      'POST',
      '/api/verification/external-check',
      { state },
      { Authorization: 'Bearer token-writer-phase7' }
    );

    assert.equal(extCheckRes.status, 200, '4-tier verification endpoint returns 200 OK');
    assert.ok(extCheckRes.body.inputValidation, 'Response contains tier 1: inputValidation');
    assert.ok(extCheckRes.body.internalConsistency, 'Response contains tier 2: internalConsistency');
    assert.ok(extCheckRes.body.aiObservations, 'Response contains tier 3: aiObservations');
    assert.ok(extCheckRes.body.externalVerification, 'Response contains tier 4: externalVerification');
    assert.equal(extCheckRes.body.externalVerification.status, 'NOT_EXTERNALLY_VERIFIED', 'Tier 4 states NOT_EXTERNALLY_VERIFIED');
    console.log('✓ Test 7 Passed: 4-tier verification model structure verified.');

    // ------------------------------------------------------------------------
    // TEST 8: Session-Derived Security Audit Actors
    // ------------------------------------------------------------------------
    console.log('Test 8: Verifying security audit actors are derived strictly from session (ignoring forged body headers)...');

    // Submit request with forged client identity headers/body
    await request(
      'POST',
      '/api/ai/fraud-check',
      {
        surveyNo: '340',
        subDivision: '5',
        village: 'Thiruvanmiyur',
        actorEmail: 'forged.admin@hacker.test',
        userRole: 'Super Admin'
      },
      {
        Authorization: 'Bearer token-writer-phase7',
        'x-user-email': 'forged.admin@hacker.test',
        'x-user-role': 'Super Admin'
      }
    );

    const auditLogs = await db.getAuditLogs();
    const fraudAuditLog = auditLogs.find((l: any) => l.action === 'AI_FRAUD_CHECK');
    assert.ok(fraudAuditLog, 'Audit log entry created for AI fraud check');
    assert.equal(fraudAuditLog.userEmail, testWriter.email, 'Audit log userEmail matches verified session');
    assert.equal(fraudAuditLog.role, 'Document Writer', 'Audit log role matches verified session');

    const detailsObj = JSON.parse(fraudAuditLog.details);
    assert.equal(detailsObj.actorId, testWriter.id, 'Audit details actorId derived from session');
    assert.equal(detailsObj.actorRole, 'Document Writer', 'Audit details actorRole derived from session');
    assert.notEqual(detailsObj.actorEmail, 'forged.admin@hacker.test', 'Forged email ignored in audit log');
    console.log('✓ Test 8 Passed: Security audit actors derived strictly from verified JWT session.');

    // ------------------------------------------------------------------------
    // TEST 9: Per-User Quotas & Rate Limiting
    // ------------------------------------------------------------------------
    console.log('Test 9: Verifying per-user rate limiting and quota enforcement...');

    const quotaUserId = 'quota-test-user-' + Date.now();
    let quotaExceededCaught = false;

    try {
      // Execute 31 requests (limit is 30)
      for (let i = 0; i < 31; i++) {
        checkAiQuota(quotaUserId);
      }
    } catch (err: any) {
      if (err instanceof QuotaExceededError && err.statusCode === 429) {
        quotaExceededCaught = true;
        assert.ok(err.retryAfterSeconds > 0, 'Quota error specifies retryAfterSeconds');
      }
    }

    assert.equal(quotaExceededCaught, true, 'Rate limiter must throw QuotaExceededError on 31st request');
    console.log('✓ Test 9 Passed: Per-user quotas and rate limiting enforced with HTTP 429.');

    console.log('\n===================================================================');
    console.log('🎉 ALL PHASE 7 AI, OCR & EXTERNAL VERIFICATION TESTS PASSED! 🎉');
    console.log('===================================================================\n');
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 verification suite failed:', err);
  process.exit(1);
});
