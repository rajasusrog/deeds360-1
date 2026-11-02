import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Configure disposable isolated test environment before importing app/db
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-phase6-'));
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tempDir;
process.env.DATA_DIR = tempDir;
const TEST_PII_KEY = crypto.randomBytes(32).toString('hex');
process.env.PII_ENCRYPTION_KEY = TEST_PII_KEY;



import type { DeedWizardState } from '../../src/types';

function buildSyntheticState(overrides: Record<string, any> = {}): any {
  const base: any = {
    documentType: 'SALE',
    documentSubType: 'SALE_METRO',
    parties: [
      {
        id: 'party-seller-xss',
        role: 'Seller',
        name: 'Ramasamy <script>window.__marker=1</script> Mudaliar',
        NameTa: 'ராமசாமி <img src=x onerror=window.__marker=2> முதலியார்',
        relationType: 'S/o',
        relationName: 'Kandasamy <b onmouseover=alert(1)>Test</b>',
        fatherName: 'Kandasamy <b onmouseover=alert(1)>Test</b>',
        age: 58,
        pan: 'ABCDE1234F',
        aadhaar: '542198763421',
        mobile: '9840123456',
        phone: '9840123456',
        email: 'seller@example.test',
        address: 'No. 14, <iframe src="javascript:alert(1)"></iframe> North Mada Street',
        sharePercentage: '100%'
      },
      {
        id: 'party-buyer-clean',
        role: 'Buyer',
        name: 'Lakshmi Narayanan',
        NameTa: 'லட்சுமி நாராயணன்',
        relationType: 'S/o',
        relationName: 'Sundaram',
        fatherName: 'Sundaram',
        age: 42,
        pan: 'PQRSX5678K',
        aadhaar: '674321985432',
        mobile: '9840654321',
        phone: '9840654321',
        email: 'buyer@example.test',
        address: 'No. 28, Luz Church Road, Mylapore',
        sharePercentage: '100%'
      }
    ],
    witnesses: [
      {
        id: 'wit-1',
        name: 'V. Subramaniam <svg onload=alert(1)>',
        fatherName: 'Vaidyanathan',
        address: 'Mylapore, Chennai',
        phone: '9884012345',
        aadhaar: '345678901234'
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai Central',
      taluk: 'Mylapore',
      village: 'Mylapore <script>alert(2)</script>',
      sro: 'Mylapore',
      guidelineValue: 8000,
      guidelineUnit: 'SQFT',
      propertyType: 'Residential Plot',
      marketValue: 5000000
    },
    survey: {
      surveyNo: '104/2B',
      subDivision: '2B'
    },
    surveys: [
      {
        id: 'surv-1',
        surveyNo: '104/2B',
        extent: '2400',
        extentUnit: 'SQFT'
      }
    ],
    extent: {
      totalExtent: '2400',
      unit: 'SQFT'
    },
    boundary: {
      north: 'Road <script>bad()</script>',
      south: 'Plot No. 15',
      east: 'Plot No. 12',
      west: 'Road'
    },
    ownershipHistory: {
      priorOwners: 'Narayanan & Sons <img src=x onerror=bad()>',
      parentDocNo: '1234/1998',
      parentDocYear: '1998',
      parentDocSRO: 'Mylapore',
      historyNarrative: 'Acquired via absolute sale deed dated 1998. Contact 9840123456 or seller@example.test for verification.'
    },
    transaction: {
      considerationAmount: 5000000,
      marketValue: 5000000,
      advancePaid: 500000,
      balanceAmount: 4500000,
      paymentMode: 'Cheque',
      paymentRefNo: 'CHQ-889900',
      bankName: 'Indian Bank <script>',
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

async function runPhase6Tests() {
  console.log('--- STARTING PHASE 6 PRIVACY & HTML SAFETY VERIFICATION SUITE ---');

  const piiModule = await import('../pii.ts');
  const {
    PII_INVENTORY,
    encryptGCM,
    decryptGCM,
    isValidCiphertext,
    isMaskedValue,
    maskAadhaar,
    maskPAN,
    maskPhone,
    maskEmail,
    maskPIIInText,
    preserveProtectedValuesOnSave,
    preserveClientProtectedValues,
    serializeDocument,
    serializeOcrData
  } = piiModule;

  const serverSanitizerModule = await import('../serverSanitizer.ts');
  const { sanitizeServerHtml: sanitizeHtml } = serverSanitizerModule;

  const htmlSanitizerModule = await import('../../src/utils/htmlSanitizer.ts');
  const { escapeHtml, setCustomSanitizer } = htmlSanitizerModule;
  const createDOMPurifyModule = await import('dompurify');
  const createDOMPurify = (createDOMPurifyModule as any).default || createDOMPurifyModule;
  const { JSDOM } = await import('jsdom');
  const serverPurifier = createDOMPurify(new JSDOM('').window as any);
  setCustomSanitizer(serverPurifier);

  const docGenModule = await import('../../src/utils/documentGenerator.ts');
  const { tryCompileDeedDocument } = docGenModule;

  const docExportModule = await import('../../src/utils/documentExportEngine.ts');
  const { generateCanonicalPDF, generateCanonicalDOCX } = docExportModule;

  const { default: app, setTokenVerifierForTesting } = await import('../server.ts');
  const { db, migrateAndBootstrap } = await import('../db.ts');

  await migrateAndBootstrap();

  // Seed test users: Super Admin, Auditor, Document Writer, Client
  const superAdmin = await db.createUser({
    id: 'user-superadmin-6',
    name: 'Super Admin Officer',
    email: 'superadmin@unikorn360.test',
    phone: '9840100001',
    organization: 'UNIKORN360 Headquarters',
    role: 'Super Admin',
    permissions: ['all'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  const auditor = await db.createUser({
    id: 'user-auditor-6',
    name: 'Compliance Auditor',
    email: 'auditor@unikorn360.test',
    phone: '9840100002',
    organization: 'TN Registration Audit Wing',
    role: 'Auditor',
    permissions: ['view_all_deeds', 'audit_access', 'canViewRawPII'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  const lawyer = await db.createUser({
    id: 'user-lawyer-6',
    name: 'Advocate Ramanathan',
    email: 'lawyer@chambers.test',
    phone: '9840100003',
    organization: 'Madras High Court Chambers',
    role: 'Document Writer',
    permissions: ['view_own_deeds', 'create_deeds', 'edit_own_deeds'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  const clientUser = await db.createUser({
    id: 'user-client-6',
    name: 'Lakshmi Narayanan',
    email: 'buyer@example.test',
    phone: '9840654321',
    organization: 'Public Client',
    role: 'Client',
    permissions: ['view_own_deeds'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  setTokenVerifierForTesting(async (token: string) => {
    if (token === 'token-superadmin') {
      return { id: superAdmin.id, email: superAdmin.email, rawEmail: superAdmin.email, name: superAdmin.name };
    }
    if (token === 'token-auditor') {
      return { id: auditor.id, email: auditor.email, rawEmail: auditor.email, name: auditor.name };
    }
    if (token === 'token-lawyer') {
      return { id: lawyer.id, email: lawyer.email, rawEmail: lawyer.email, name: lawyer.name };
    }
    if (token === 'token-client') {
      return { id: clientUser.id, email: clientUser.email, rawEmail: clientUser.email, name: clientUser.name };
    }
    return null;
  });

  // Setup dev server on ephemeral port
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
    // TEST 1: PII Inventory Specification Check
    // ------------------------------------------------------------------------
    console.log('Test 1: Validating formal PII Inventory and Inventory Endpoint...');
    assert.ok(PII_INVENTORY.parties.includes('aadhaar'), 'PII Inventory must include party aadhaar');
    assert.ok(PII_INVENTORY.parties.includes('pan'), 'PII Inventory must include party pan');
    assert.ok(PII_INVENTORY.parties.includes('phone'), 'PII Inventory must include party phone');
    assert.ok(PII_INVENTORY.witnesses.includes('aadhaar'), 'PII Inventory must include witness aadhaar');
    assert.ok(PII_INVENTORY.narrativeFields.some((f) => f.includes('parentDocNo')), 'PII Inventory must include narrative fields');
    assert.ok(PII_INVENTORY.ocrOutput.some((f) => f.includes('aadhaar')), 'PII Inventory must include OCR output');
    assert.ok(PII_INVENTORY.logs.some((f) => f.includes('auditLog')), 'PII Inventory must include audit logs');

    const invRes = await request(
      'GET',
      '/api/privacy/pii-inventory',
      undefined,
      { Authorization: 'Bearer token-superadmin' }
    );
    assert.equal(invRes.status, 200, 'PII inventory endpoint must return 200 OK');
    assert.ok(invRes.body.inventory.parties, 'API must return party inventory');
    assert.ok(invRes.body.inventory.witnesses, 'API must return witness inventory');
    assert.ok(invRes.body.rules.some((r: string) => r.includes('AES-256-GCM')), 'Rules must declare AES-256-GCM');
    console.log('✓ Test 1 Passed: PII Inventory is comprehensive and exposed via protected API.');

    // ------------------------------------------------------------------------
    // TEST 2: Ciphertext Integrity & Authentication (Rejecting Fake v1: Strings)
    // ------------------------------------------------------------------------
    console.log('Test 2: Verifying isValidCiphertext against bogus and authentic ciphertexts...');

    // Rule: Do not accept a value as valid ciphertext merely because it starts with "v1:"
    assert.equal(isValidCiphertext('v1:'), false, 'Bare v1: must be rejected');
    assert.equal(isValidCiphertext('v1:fake'), false, 'v1:fake must be rejected');
    assert.equal(isValidCiphertext('v1:abcdef'), false, 'Short bogus string must be rejected');
    assert.equal(isValidCiphertext('v1:nothex:tag:data'), false, 'Non-hex components must be rejected');
    // Incorrect IV length (must be 24 hex chars for 12-byte IV)
    assert.equal(isValidCiphertext('v1:1234:0123456789abcdef0123456789abcdef:beef'), false, 'Invalid IV length must be rejected');
    // Incorrect tag length (must be 32 hex chars for 16-byte tag)
    assert.equal(isValidCiphertext('v1:0123456789abcdef01234567:badtag:beef'), false, 'Invalid tag length must be rejected');
    // Odd ciphertext length
    assert.equal(isValidCiphertext('v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:f'), false, 'Odd hex length must be rejected');

    // Real encrypted value
    const plaintextSecret = '542198763421';
    const genuineCiphertext = encryptGCM(plaintextSecret);
    assert.ok(genuineCiphertext.startsWith('v1:'), 'GCM output starts with v1:');
    assert.equal(isValidCiphertext(genuineCiphertext), true, 'Genuine GCM ciphertext must pass isValidCiphertext');
    assert.equal(decryptGCM(genuineCiphertext), plaintextSecret, 'Genuine ciphertext must decrypt correctly');

    // Tampered authentic ciphertext: modify one byte of data or tag
    const parts = genuineCiphertext.split(':');
    const corruptedTag = parts[0] + ':' + parts[1] + ':' + 'ffffffffffffffffffffffffffffffff' + ':' + parts[3];
    assert.equal(isValidCiphertext(corruptedTag), false, 'Corrupted authentication tag must fail isValidCiphertext');
    assert.equal(decryptGCM(corruptedTag), '[DECRYPTION_ERROR]', 'Corrupted tag must return [DECRYPTION_ERROR]');
    console.log('✓ Test 2 Passed: Bogus "v1:" strings rejected, authentic ciphertexts authenticated.');

    // ------------------------------------------------------------------------
    // TEST 3: Preventing Masked Response Values from Overwriting Protected Original Values
    // ------------------------------------------------------------------------
    console.log('Test 3: Testing preservation of protected values across client and document saves...');

    // 3a. Client preservation
    const originalClientPayload = {
      name: 'Dr. S. Sundaram',
      email: 'sundaram@clinic.test',
      phone: '9840123456',
      aadhaar: '542198763421',
      pan: 'ABCDE1234F',
      address: 'Mylapore, Chennai'
    };
    const createdClient = await db.createClient({
      ...originalClientPayload,
      fatherName: 'Sundaram',
      dob: '1970-01-01',
      age: 56,
      occupation: 'Doctor',
      createdAt: new Date().toISOString(),
      createdByUserId: lawyer.id,
      createdByEmail: lawyer.email
    });
    assert.ok(createdClient.id, 'Client record created');

    // Read the raw file directly from disk to verify encryption at rest
    const clientsOnDisk = JSON.parse(fs.readFileSync(path.join(tempDir, 'clients.json'), 'utf8'));
    const diskClient = clientsOnDisk.find((c: any) => c.id === createdClient.id);
    assert.ok(diskClient.aadhaar.startsWith('v1:'), 'Aadhaar must be encrypted in storage at rest');
    assert.ok(diskClient.pan.startsWith('v1:'), 'PAN must be encrypted in storage at rest');
    assert.ok(isValidCiphertext(diskClient.aadhaar), 'Aadhaar must be valid ciphertext');

    // Simulate client update where browser UI returns masked values
    const maskedClientUpdate = {
      name: 'Dr. S. Sundaram, MD', // legal name change
      email: 'sundaram@clinic.test',
      phone: 'XXXXXX3456', // masked
      aadhaar: 'XXXXXXXX3421', // masked
      pan: 'XXXXX1234F', // masked
      address: 'Mylapore, Chennai - 600004'
    };

    const updatedClient = await db.updateClient(createdClient.id, maskedClientUpdate, createdClient.revision);
    assert.equal(updatedClient.name, 'Dr. S. Sundaram, MD', 'Non-sensitive updates must be applied');

    // Verify on disk that the ciphertext was preserved
    const clientsOnDiskAfter = JSON.parse(fs.readFileSync(path.join(tempDir, 'clients.json'), 'utf8'));
    const diskClientAfter = clientsOnDiskAfter.find((c: any) => c.id === createdClient.id);
    assert.ok(isValidCiphertext(diskClientAfter.aadhaar), 'Stored aadhaar on disk must remain valid ciphertext');
    assert.ok(isValidCiphertext(diskClientAfter.pan), 'Stored pan on disk must remain valid ciphertext');
    assert.equal(decryptGCM(diskClientAfter.aadhaar), '542198763421', 'Decrypted aadhaar must equal original plaintext');
    assert.equal(decryptGCM(diskClientAfter.pan), 'ABCDE1234F', 'Decrypted PAN must equal original plaintext');

    // 3b. Document draft party preservation
    const docState = buildSyntheticState();
    const createdDoc = await db.createDocument({
      docType: 'SALE',
      subType: 'SALE_METRO',
      state: docState,
      writer: lawyer.name,
      createdBy: lawyer.email,
      createdByUserId: lawyer.id,
      createdByEmail: lawyer.email,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      partiesCount: 2,
      propertyAddress: 'Chennai',
      consideration: 5000000,
      progress: 100,
      status: 'Draft'
    });

    // In storage on disk, parties' sensitive fields are encrypted
    const docsOnDisk = JSON.parse(fs.readFileSync(path.join(tempDir, 'documents.json'), 'utf8'));
    const diskDoc = docsOnDisk.find((d: any) => d.id === createdDoc.id);
    assert.ok(isValidCiphertext(diskDoc.state.parties[0].aadhaar!), 'Seller aadhaar must be encrypted at rest');
    assert.ok(isValidCiphertext(diskDoc.state.parties[0].pan!), 'Seller pan must be encrypted at rest');

    // Simulate an auditor/reviewer loading the document (which returns masked values) and saving changes
    const mutatedState = JSON.parse(JSON.stringify(docState));
    mutatedState.parties[0].aadhaar = 'XXXXXXXX3421';
    mutatedState.parties[0].pan = 'XXXXX1234F';
    mutatedState.parties[0].phone = 'XXXXXX3456';
    mutatedState.parties[0].mobile = 'XXXXXX3456';
    mutatedState.parties[0].address = 'Updated Address No. 16, North Mada Street';

    const updatedDoc = await db.updateDocument(createdDoc.id, {
      state: mutatedState,
      status: 'draft'
    }, createdDoc.revision);

    assert.ok(updatedDoc, 'Document must be updated');
    // Validate that original ciphertext was preserved on disk
    const docsOnDiskAfter = JSON.parse(fs.readFileSync(path.join(tempDir, 'documents.json'), 'utf8'));
    const diskDocAfter = docsOnDiskAfter.find((d: any) => d.id === createdDoc.id);
    assert.ok(isValidCiphertext(diskDocAfter.state.parties[0].aadhaar!), 'Preserved aadhaar on disk must remain ciphertext');
    assert.equal(decryptGCM(diskDocAfter.state.parties[0].aadhaar!), '542198763421', 'Preserved aadhaar must match original');
    assert.equal(decryptGCM(diskDocAfter.state.parties[0].pan!), 'ABCDE1234F', 'Preserved pan must match original');
    const reloadedParties = updatedDoc.state.parties;
    assert.equal(reloadedParties[0].address, 'Updated Address No. 16, North Mada Street', 'Address update must succeed');
    console.log('✓ Test 3 Passed: Masked values prevented from corrupting original encrypted records.');

    // ------------------------------------------------------------------------
    // TEST 4: Role-Appropriate Disclosure and Sensitive Access Auditing
    // ------------------------------------------------------------------------
    console.log('Test 4: Verifying role-appropriate disclosure and audit log creation...');

    // 4a. Serialize document for Client role (should only disclose client's own details)
    const clientActor = {
      id: clientUser.id,
      email: clientUser.email,
      role: 'client'
    };
    const clientView = serializeDocument(updatedDoc, clientActor);
    const sellerParty = clientView.state.parties.find((p: any) => p.role === 'Seller');
    const buyerParty = clientView.state.parties.find((p: any) => p.role === 'Buyer');
    assert.equal(sellerParty.aadhaar, 'XXXXXXXX3421', 'Other party aadhaar must be masked for client');
    assert.equal(sellerParty.pan, 'XXXXX1234F', 'Other party PAN must be masked for client');
    assert.equal(sellerParty.phone, 'XXXXXX3456', 'Other party phone must be masked for client');
    assert.equal(buyerParty.aadhaar, '674321985432', 'Own party aadhaar is disclosed to client');

    // 4b. Serialize document for Auditor role (all parties and witnesses masked unless elevated)
    const auditorActor = {
      id: auditor.id,
      email: auditor.email,
      role: 'auditor'
    };
    const auditorMaskedView = serializeDocument(updatedDoc, auditorActor);
    assert.equal(auditorMaskedView.state.parties[0].aadhaar, 'XXXXXXXX3421', 'Auditor must receive masked aadhaar');
    assert.equal(auditorMaskedView.state.parties[0].pan, 'XXXXX1234F', 'Auditor must receive masked PAN');
    assert.equal(auditorMaskedView.state.witnesses[0].aadhaar, 'XXXXXXXX1234', 'Witness aadhaar must be masked');
    assert.ok(auditorMaskedView.state.witnesses[0].phone.startsWith('XXXXXX'), 'Witness phone must be masked');

    // Check narrative masking in text
    assert.ok(
      auditorMaskedView.state.ownershipHistory.historyNarrative.includes('XXXXXX3456'),
      'Phone in narrative history must be masked for auditor'
    );
    assert.ok(
      auditorMaskedView.state.ownershipHistory.historyNarrative.includes('s***r@example.test'),
      'Email in narrative history must be masked for auditor'
    );

    // 4c. Elevated Auditor View & Raw Access Audit Logging via API
    const elevatedRes = await request(
      'GET',
      `/api/documents/${updatedDoc.id}?elevated=true`,
      undefined,
      { Authorization: 'Bearer token-auditor' }
    );
    assert.equal(elevatedRes.status, 200, 'Elevated doc view returns 200 OK');
    assert.equal(elevatedRes.body.document.state.parties[0].aadhaar, '542198763421', 'Elevated auditor receives raw PII');

    // Verify audit log entry structure in database
    const auditLogs = await db.getAuditLogs();
    const piiAuditEntry = auditLogs.find((l: any) => l.action === 'RAW_PII_ACCESS');
    assert.ok(piiAuditEntry, 'Audit log entry must exist for raw PII access');
    const parsedDetails = JSON.parse(piiAuditEntry.details);
    assert.equal(piiAuditEntry.userEmail, auditor.email, 'Audit log root userEmail must record actor email');
    assert.ok(
      parsedDetails.actorEmail.includes('@unikorn360.test') && parsedDetails.actorEmail.includes('***'),
      'Audit log details actor email is safely masked to protect PII in logs'
    );
    assert.equal(parsedDetails.actorRole, 'Auditor', 'Audit log must record actor role');
    assert.ok(parsedDetails.serverTimestamp, 'Audit log must record authoritative server timestamp');
    console.log('✓ Test 4 Passed: Role-appropriate disclosure and audit trails verified.');

    // ------------------------------------------------------------------------
    // TEST 5: HTML Injection / XSS Prevention with Harmless Synthetic Markers
    // ------------------------------------------------------------------------
    console.log('Test 5: Verifying HTML escaping and sanitization with synthetic XSS markers...');

    // 5a. Unit escaping tests
    const injectionStr = '<script>window.__xss=1</script><img src="x" onerror="window.__xss=2">';
    const escapedStr = escapeHtml(injectionStr);
    assert.ok(!escapedStr.includes('<script>'), 'escapeHtml must escape <');
    assert.ok(escapedStr.includes('&lt;script&gt;'), 'escapeHtml must convert < to &lt;');
    assert.ok(!escapedStr.includes('"'), 'escapeHtml must escape double quotes');

    // 5b. DOMPurify sanitizeHtml test
    const sanitizedHtml = sanitizeHtml(`
      <div class="legal-box" style="color: black;">
        <p>Legitimate text</p>
        <script>window.__maliciousCode = true;</script>
        <img src="valid.jpg" onerror="window.__exploit=true">
        <a href="javascript:void(0)" onclick="attack()">Click</a>
      </div>
    `);
    assert.ok(sanitizedHtml.includes('Legitimate text'), 'Legitimate content must be preserved');
    assert.ok(!sanitizedHtml.includes('<script>'), 'Scripts must be stripped');
    assert.ok(!sanitizedHtml.includes('window.__maliciousCode'), 'Script body must be stripped');
    assert.ok(!sanitizedHtml.includes('onerror'), 'Event handlers must be stripped');
    assert.ok(!sanitizedHtml.includes('onclick'), 'onclick handlers must be stripped');
    assert.ok(!sanitizedHtml.includes('javascript:'), 'javascript: URLs must be stripped');

    // 5c. Full Deed Compilation Sanitization Test
    const xssState = buildSyntheticState();
    const compileResult = tryCompileDeedDocument(xssState);
    assert.equal(compileResult.error, null, 'Compilation must have no error for complete state');
    assert.ok(compileResult.deed, 'Compilation must return deed object');

    // Verify all generated sections are safe
    for (const section of compileResult.deed.sections) {
      assert.ok(!section.contentEn.includes('<script>'), `Section ${section.id} contentEn contains active script tag`);
      assert.ok(!section.contentTa.includes('<script>'), `Section ${section.id} contentTa contains active script tag`);
      assert.ok(!section.contentEn.includes('<img'), `Section ${section.id} contentEn contains active img tag`);
      assert.ok(!section.contentTa.includes('<img'), `Section ${section.id} contentTa contains active img tag`);
      assert.ok(!section.contentEn.includes('<iframe'), `Section ${section.id} contentEn contains active iframe tag`);
      assert.ok(!section.contentTa.includes('<iframe'), `Section ${section.id} contentTa contains active iframe tag`);
    }

    // 5d. Export engines safety check
    const pdfResult = await generateCanonicalPDF(xssState, 'DEED/2026/0001');
    assert.equal(pdfResult.success, false, 'PDF is unavailable without browser rendering');
    assert.equal(pdfResult.blob, undefined);
    assert.match(pdfResult.error || '', /requires a browser rendering environment/);

    const docxResult = await generateCanonicalDOCX(xssState, 'DEED/2026/0001');
    assert.equal(docxResult.success, true, 'Canonical DOCX export returns success');
    assert.ok(docxResult.blob instanceof Blob, 'Canonical DOCX export returns valid Blob');
    assert.ok(docxResult.blob.size > 0, 'Canonical DOCX has non-zero byte size');
    console.log('✓ Test 5 Passed: Synthetic XSS markers removed and DOCX generated; browser PDF rendering not exercised.');

    // ------------------------------------------------------------------------
    // TEST 6: AI OCR Processing & Fake Success Rejection
    // ------------------------------------------------------------------------
    console.log('Test 6: Validating OCR error handling (Rule 1: no mock success for failed OCR)...');

    // Request with missing base64File must be rejected with 400 Bad Request
    const badOcrRes = await request(
      'POST',
      '/api/ai/extract-doc',
      { mimeType: 'image/jpeg' },
      { Authorization: 'Bearer token-lawyer' }
    );
    assert.equal(badOcrRes.status, 400, 'OCR endpoint without file data must return 400');
    assert.ok(badOcrRes.body.error, 'OCR must return error message without input file');

    // Test serializeOcrData masking
    const rawOcrExtracted = {
      parties: [
        {
          name: 'Narayanan',
          aadhaar: '542198763421',
          pan: 'ABCDE1234F',
          phone: '9840123456'
        }
      ],
      rawText: 'Party Narayanan Aadhaar 542198763421 PAN ABCDE1234F Mobile 9840123456'
    };

    const maskedOcr = serializeOcrData(rawOcrExtracted, { role: 'writer', email: 'writer@test.com' });
    assert.equal(maskedOcr.parties[0].aadhaar, 'XXXXXXXX3421', 'OCR aadhaar must be masked');
    assert.equal(maskedOcr.parties[0].pan, 'XXXXX1234F', 'OCR PAN must be masked');
    assert.ok(maskedOcr.rawText.includes('XXXXXXXX3421'), 'Raw OCR text aadhaar must be masked');
    assert.ok(maskedOcr.rawText.includes('XXXXX1234F'), 'Raw OCR text PAN must be masked');
    console.log('✓ Test 6 Passed: OCR strictly rejects invalid input and serializes PII safely.');

    console.log('\n===================================================================');
    console.log('🎉 ALL PHASE 6 PRIVACY & HTML SAFETY TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('===================================================================\n');
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Clean up temporary test directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 verification suite failed:', err);
  process.exit(1);
});
