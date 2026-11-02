import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Configure isolated test environment BEFORE importing backend modules
const tmpDir = path.join('/tmp', `deed360-phase4-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
fs.mkdirSync(tmpDir, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tmpDir;
process.env.DATA_DIR = tmpDir;
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

import {
  CANONICAL_DEED_TYPES,
  SUPPORTED_DEED_TYPES,
  UNSUPPORTED_DEED_TYPES,
  CanonicalDeedCode,
  SupportedDeedCode,
  TemplateUnavailableError,
  resolveDeedType,
  normalizeDeedCode,
  isDeedTemplateAvailable,
  getDefaultPartiesForDeedType,
  partitionPartiesForDeedType,
  validateDeedStateByType
} from '../../src/utils/deedTypes';
import {
  compileDeedDocument,
  tryCompileDeedDocument
} from '../../src/utils/documentGenerator';
import {
  generateCanonicalDOCX,
  generateCanonicalPDF
} from '../../src/utils/documentExportEngine';
import { runAiValidation } from '../../src/utils/aiValidator';
import { verifyOwnershipChain, verifyFinancials } from '../../src/utils/verificationService';
import { DeedWizardState } from '../../src/types';

function buildValidStateForType(docType: string): any {
  const def = resolveDeedType(docType);
  const grantorRole = def?.grantorRole || 'Seller';
  const granteeRole = def?.granteeRole || 'Buyer';
  const requiresMonetary = def ? def.requiresMonetaryConsideration : true;

  const base: any = {
    documentType: docType,
    documentSubtype: 'STANDARD',
    parties: [
      {
        id: 'p1',
        role: grantorRole,
        name: 'M. Selvakumar',
        fatherName: 'Muthuswamy Mudaliar',
        dob: '1975-04-12',
        age: 51,
        occupation: 'Private Service',
        aadhaar: 'XXXX-XXXX-5678',
        pan: 'ABCPS1234F',
        phone: '9840123456',
        email: 'selvakumar@example.com',
        address: 'No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041',
        relationshipType: 'S/o'
      },
      {
        id: 'p2',
        role: granteeRole,
        name: 'R. Rajeshwari',
        fatherName: 'Ramachandran Iyer',
        dob: '1982-11-23',
        age: 43,
        occupation: 'Business',
        aadhaar: 'XXXX-XXXX-8765',
        pan: 'ABZPR9876Q',
        phone: '9444012345',
        email: 'rajeshwari@example.com',
        address: 'Old No. 12, New No. 28, Mylapore, Chennai - 600004',
        relationshipType: 'D/o'
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai South',
      taluk: 'Mylapore',
      village: 'Thiruvanmiyur',
      ward: 'Ward 180',
      block: 'Block 12',
      propertyType: docType === 'LEASE' ? 'Commercial Building' : 'Residential Plot / Land',
      sro: 'SRO Thiruvanmiyur',
      doorNo: 'Plot No. 14'
    },
    survey: {
      surveyNo: '245',
      subDivision: '2B',
      pattaNo: '8812',
      tslrNo: 'TS-99',
      chittaRef: 'CH-2025-8812'
    },
    surveys: [
      {
        surveyNo: '245',
        subDivision: '2B',
        pattaNo: '8812',
        tslrNo: 'TS-99',
        chittaRef: 'CH-2025-8812'
      }
    ],
    extent: {
      sqft: 2400,
      acre: 0,
      cent: 5.5,
      hectare: 0.022,
      areaUnit: 'Sq.ft',
      totalExtent: 2400,
      eastWest: '40 feet',
      northSouth: '60 feet',
      builtUpArea: 1200,
      uds: 600
    },
    boundary: {
      east: '30 Feet Layout Road',
      west: 'Plot No. 13 belonging to K. Sundar',
      north: 'Plot No. 15 belonging to S. Mani',
      south: '20 Feet Common Passage'
    },
    ownershipHistory: {
      parentDocType: 'Sale Deed',
      parentDocNo: '1420',
      parentDocYear: '2015',
      parentDocSRO: 'SRO Thiruvanmiyur',
      parentDocDate: '2015-06-15',
      priorOwners: 'M. Selvakumar',
      historyNarrative: 'Originally acquired by M. Selvakumar under registered Sale Deed Doc No. 1420/2015 at SRO Thiruvanmiyur.'
    },
    transaction: {
      marketValue: 6000000,
      guidelineValue: 5500000,
      considerationAmount: requiresMonetary ? (docType === 'LEASE' ? 45000 : 6000000) : 0,
      advancePaid: requiresMonetary ? (docType === 'LEASE' ? 250000 : 1000000) : 0,
      balancePaid: requiresMonetary ? (docType === 'LEASE' ? 0 : 5000000) : 0,
      paymentMode: 'NEFT/RTGS',
      paymentRefNo: requiresMonetary ? 'UTR20260628991122' : '',
      paymentDate: '2026-06-28',
      bankName: 'State Bank of India',
      stampDuty: 420000,
      registrationFee: 240000,
      ecReference: 'EC/2026/99481',
      ecDate: '2026-06-20',
      propertyTaxReceipt: 'PT-2026-4419'
    },
    witnesses: [
      {
        id: 'w1',
        name: 'V. Karthik',
        fatherName: 'Venkatesan',
        age: 39,
        aadhaar: 'XXXX-XXXX-3344',
        idProof: 'XXXX-XXXX-3344',
        address: 'No. 10, Lattice Bridge Road, Adyar, Chennai - 600020',
        phone: '9840998877',
        occupation: 'Engineer'
      },
      {
        id: 'w2',
        name: 'S. Ramesh',
        fatherName: 'Subramanian',
        age: 44,
        aadhaar: 'XXXX-XXXX-7788',
        idProof: 'XXXX-XXXX-7788',
        address: 'No. 22, Sardar Patel Road, Guindy, Chennai - 600032',
        phone: '9840556677',
        occupation: 'Accountant'
      }
    ],
    selectedClauses: ['marketable_title', 'encumbrance_clear', 'possession_delivery', 'indemnity_clause']
  };
  return base;
}

async function requestJson(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: { token?: string; body?: unknown } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runPhase4Verification() {
  console.log('=== PHASE 4: DEED TYPE CORRECTNESS VERIFICATION ===\n');
  let passed = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Canonical Deed Type Registry completeness (all 13 selectable types)
  // ---------------------------------------------------------------------------
  {
    const expectedAll13: CanonicalDeedCode[] = [
      'SALE',
      'SETTLEMENT',
      'GIFT',
      'PARTITION',
      'RELEASE',
      'LEASE',
      'MORTGAGE',
      'POA',
      'RECTIFICATION',
      'CANCELLATION',
      'TRUST',
      'PARTNERSHIP',
      'WILL'
    ];
    const expectedSupported7: SupportedDeedCode[] = [
      'SALE',
      'SETTLEMENT',
      'GIFT',
      'PARTITION',
      'LEASE',
      'MORTGAGE',
      'POA'
    ];
    const expectedUnsupported6: CanonicalDeedCode[] = [
      'RELEASE',
      'RECTIFICATION',
      'CANCELLATION',
      'TRUST',
      'PARTNERSHIP',
      'WILL'
    ];

    assert.equal(CANONICAL_DEED_TYPES.length, 13, 'Must define all 13 selectable deed types');
    assert.deepEqual(
      CANONICAL_DEED_TYPES.map(d => d.code),
      expectedAll13,
      'Canonical deed type codes must match the 13 selectable types in order'
    );
    assert.deepEqual(
      SUPPORTED_DEED_TYPES.map(d => d.code),
      expectedSupported7,
      'Supported deed types must be exactly the 7 implemented templates'
    );
    assert.deepEqual(
      UNSUPPORTED_DEED_TYPES.map(d => d.code),
      expectedUnsupported6,
      'Unsupported deed types must be RELEASE, RECTIFICATION, CANCELLATION, TRUST, PARTNERSHIP, WILL'
    );

    // Verify SETTLEMENT and legacy SETTLE both resolve to canonical SETTLEMENT
    assert.equal(normalizeDeedCode('SETTLEMENT'), 'SETTLEMENT');
    assert.equal(normalizeDeedCode('SETTLE'), 'SETTLEMENT');
    assert.equal(normalizeDeedCode('Family Settlement Deed'), 'SETTLEMENT');
    assert.equal(isDeedTemplateAvailable('SETTLEMENT'), true);
    assert.equal(isDeedTemplateAvailable('SETTLE'), true);

    console.log('PASS [1/6]: Canonical deed type registry defines all 13 types (7 supported, 6 unsupported) and resolves SETTLEMENT / SETTLE.');
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: All 7 Supported Deed Types (+ SETTLE alias) produce their intended template & roles
  // ---------------------------------------------------------------------------
  {
    const expectedMatrix: Array<{
      inputCode: string;
      canonicalCode: SupportedDeedCode;
      expectedHeaderEn: string;
      expectedHeaderTa: string;
      expectedGrantorHeading: string;
      expectedGranteeHeading: string;
      expectedBodyTerm: string;
    }> = [
      {
        inputCode: 'SALE',
        canonicalCode: 'SALE',
        expectedHeaderEn: 'DEED OF ABSOLUTE SALE',
        expectedHeaderTa: 'சுத்த கிரயப் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the VENDOR',
        expectedGranteeHeading: 'hereinafter called the PURCHASER',
        expectedBodyTerm: 'agreement of sale between the parties'
      },
      {
        inputCode: 'SETTLEMENT',
        canonicalCode: 'SETTLEMENT',
        expectedHeaderEn: 'DEED OF FAMILY SETTLEMENT',
        expectedHeaderTa: 'குடும்ப செட்டில்மென்ட் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the SETTLOR',
        expectedGranteeHeading: 'hereinafter called the SETTLEE',
        expectedBodyTerm: 'natural love and affection'
      },
      {
        inputCode: 'SETTLE', // legacy alias check
        canonicalCode: 'SETTLEMENT',
        expectedHeaderEn: 'DEED OF FAMILY SETTLEMENT',
        expectedHeaderTa: 'குடும்ப செட்டில்மென்ட் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the SETTLOR',
        expectedGranteeHeading: 'hereinafter called the SETTLEE',
        expectedBodyTerm: 'natural love and affection'
      },
      {
        inputCode: 'GIFT',
        canonicalCode: 'GIFT',
        expectedHeaderEn: 'DEED OF GIFT',
        expectedHeaderTa: 'தானப் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the DONOR',
        expectedGranteeHeading: 'hereinafter called the DONEE',
        expectedBodyTerm: 'voluntary Gift the Scheduled Property unto the DONEE'
      },
      {
        inputCode: 'PARTITION',
        canonicalCode: 'PARTITION',
        expectedHeaderEn: 'DEED OF PARTITION',
        expectedHeaderTa: 'பாகப்பிரிவினை பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the FIRST PARTY (CO-OWNER)',
        expectedGranteeHeading: 'hereinafter called the SECOND PARTY (CO-OWNER)',
        expectedBodyTerm: 'partitioned between the FIRST PARTY (CO-OWNER) and the SECOND PARTY (CO-OWNER)'
      },
      {
        inputCode: 'LEASE',
        canonicalCode: 'LEASE',
        expectedHeaderEn: 'DEED OF LEASE',
        expectedHeaderTa: 'வாடகை / குத்தகைப் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the LESSOR (LANDLORD)',
        expectedGranteeHeading: 'hereinafter called the LESSEE (TENANT)',
        expectedBodyTerm: 'Declared Monthly Lease Rent'
      },
      {
        inputCode: 'MORTGAGE',
        canonicalCode: 'MORTGAGE',
        expectedHeaderEn: 'DEED OF SIMPLE MORTGAGE',
        expectedHeaderTa: 'அடமானப் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the MORTGAGOR (BORROWER)',
        expectedGranteeHeading: 'hereinafter called the MORTGAGEE (LENDER)',
        expectedBodyTerm: 'Declared Loan Principal Amount'
      },
      {
        inputCode: 'POA',
        canonicalCode: 'POA',
        expectedHeaderEn: 'GENERAL POWER OF ATTORNEY',
        expectedHeaderTa: 'பொது அதிகாரப் பத்திரம்',
        expectedGrantorHeading: 'hereinafter called the PRINCIPAL (EXECUTANT)',
        expectedGranteeHeading: 'hereinafter called the POWER AGENT (ATTORNEY)',
        expectedBodyTerm: 'nominates the POWER AGENT to do the following acts'
      }
    ];

    for (const tc of expectedMatrix) {
      const state = buildValidStateForType(tc.inputCode);
      const compiled = compileDeedDocument(state);
      const sections = compiled.sections;
      assert.equal(compiled.metadata.deedCode, tc.canonicalCode);
      assert.ok(sections.length >= 4, `${tc.inputCode} must compile at least 4 sections`);

      const headerSection = sections.find(s => s.id === 'title' || s.id === 'header') || sections[0];
      assert.ok(headerSection, `${tc.inputCode} must have a header section`);
      assert.ok(
        headerSection.contentEn.includes(tc.expectedHeaderEn),
        `${tc.inputCode} header contentEn must include "${tc.expectedHeaderEn}", got: "${headerSection.contentEn}"`
      );
      assert.ok(
        headerSection.contentTa.includes(tc.expectedHeaderTa),
        `${tc.inputCode} header contentTa must include "${tc.expectedHeaderTa}", got: "${headerSection.contentTa}"`
      );

      // Ensure non-Sale deeds never fall back to Sale Deed header
      if (tc.canonicalCode !== 'SALE') {
        assert.ok(
          !headerSection.contentEn.includes('DEED OF ABSOLUTE SALE'),
          `${tc.inputCode} must NOT fall back to Sale Deed`
        );
      }

      const fullEn = sections.map(s => `${s.titleEn || ''}\n${s.contentEn}`).join('\n');
      const fullTa = sections.map(s => `${s.titleTa || ''}\n${s.contentTa}`).join('\n');

      assert.ok(
        fullEn.includes(tc.expectedGrantorHeading),
        `${tc.inputCode} must format grantor heading "${tc.expectedGrantorHeading}"`
      );
      assert.ok(
        fullEn.includes(tc.expectedGranteeHeading),
        `${tc.inputCode} must format grantee heading "${tc.expectedGranteeHeading}"`
      );
      assert.ok(
        fullEn.includes(tc.expectedBodyTerm),
        `${tc.inputCode} must include body term "${tc.expectedBodyTerm}"`
      );

      // Ensure non-Sale deeds never include Tamil Sale Deed reference ("இக்கிரயப் பத்திரத்தில்")
      if (tc.canonicalCode !== 'SALE') {
        assert.ok(
          !fullTa.includes('இக்கிரயப் பத்திரத்தில்'),
          `${tc.inputCode} Tamil output must not contain Sale Deed reference`
        );
      }

      // Verify state validation passes for valid state of this supported deed type
      const validationErrors = validateDeedStateByType(state);
      assert.equal(
        validationErrors.length,
        0,
        `${tc.inputCode} valid state should pass validateDeedStateByType, got errors: ${validationErrors.join('; ')}`
      );
    }

    console.log('PASS [2/6]: All 7 supported deed types (+ SETTLE alias) compile their distinct templates, roles, and transaction terminology.');
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: All 6 Unsupported Deed Types (+ unknown/empty) are explicitly blocked with "Template unavailable"
  // ---------------------------------------------------------------------------
  {
    const unsupportedCodes: string[] = [
      'RELEASE',
      'RECTIFICATION',
      'CANCELLATION',
      'TRUST',
      'PARTNERSHIP',
      'WILL',
      'UNKNOWN_DEED_CODE',
      ''
    ];

    for (const code of unsupportedCodes) {
      assert.equal(
        isDeedTemplateAvailable(code),
        false,
        `isDeedTemplateAvailable("${code}") must be false`
      );

      const state = buildValidStateForType(code);

      // 1. compileDeedDocument must throw TemplateUnavailableError with "Template unavailable"
      let compileError: unknown = null;
      try {
        compileDeedDocument(state);
      } catch (err) {
        compileError = err;
      }
      assert.ok(
        compileError instanceof TemplateUnavailableError,
        `compileDeedDocument("${code}") must throw TemplateUnavailableError`
      );
      assert.match(
        (compileError as Error).message,
        /Template unavailable/i,
        `compileDeedDocument("${code}") error must state "Template unavailable"`
      );

      // 2. tryCompileDeedDocument must return deed: null and error with "Template unavailable"
      const safeResult = tryCompileDeedDocument(state);
      assert.equal(safeResult.deed, null, `tryCompileDeedDocument("${code}") must return deed: null`);
      assert.match(safeResult.error || '', /Template unavailable/i);

      // 3. generateCanonicalDOCX must return { success: false, error: '...Template unavailable...' }
      const docxRes = await generateCanonicalDOCX(state, 'DEED/2026/TEST');
      assert.equal(
        docxRes.success,
        false,
        `generateCanonicalDOCX("${code}") must return success: false`
      );
      assert.match(
        docxRes.error || '',
        /Template unavailable/i,
        `generateCanonicalDOCX("${code}") error must state "Template unavailable"`
      );

      // 4. generateCanonicalPDF must return { success: false, error: '...Template unavailable...' }
      const pdfRes = await generateCanonicalPDF(state, 'DEED/2026/TEST');
      assert.equal(
        pdfRes.success,
        false,
        `generateCanonicalPDF("${code}") must return success: false`
      );
      assert.match(
        pdfRes.error || '',
        /Template unavailable/i,
        `generateCanonicalPDF("${code}") error must state "Template unavailable"`
      );

      // 5. validateDeedStateByType, runAiValidation, verifyOwnershipChain, verifyFinancials must flag "Template unavailable"
      const stateValidationErrors = validateDeedStateByType(state);
      assert.ok(stateValidationErrors.length > 0, `validateDeedStateByType("${code}") must return errors`);
      assert.ok(stateValidationErrors.some(e => /Template unavailable/i.test(e)));

      const aiResult = runAiValidation(state);
      assert.ok(
        aiResult.warnings.some(w => w.severity === 'error' && /Template unavailable/i.test(w.message)),
        `runAiValidation("${code}") must include a critical error warning with "Template unavailable"`
      );

      const chainResult = verifyOwnershipChain(state);
      assert.equal(chainResult.passed, false);
      assert.ok(chainResult.alerts.some(a => /Template unavailable/i.test(a.message)));

      const finResult = verifyFinancials(state);
      assert.equal(finResult.passed, false);
      assert.ok(finResult.alerts.some(a => /Template unavailable/i.test(a.message)));
    }

    console.log('PASS [3/6]: All 6 unsupported selectable types (RELEASE, RECTIFICATION, CANCELLATION, TRUST, PARTNERSHIP, WILL) and unknown types are blocked with "Template unavailable".');
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Deed-Specific Party & Consideration Validation Rules
  // ---------------------------------------------------------------------------
  {
    // Gift Deed with monetary consideration > 0 must fail validation
    const invalidGift = buildValidStateForType('GIFT');
    invalidGift.transaction.considerationAmount = 500000;
    const giftValidationErrors = validateDeedStateByType(invalidGift);
    assert.ok(giftValidationErrors.length > 0, 'Gift Deed with monetary consideration > 0 must be invalid');
    assert.ok(giftValidationErrors.some(e => /without monetary consideration/i.test(e)));

    // Settlement Deed with monetary consideration > 0 must fail validation
    const invalidSettlement = buildValidStateForType('SETTLEMENT');
    invalidSettlement.transaction.considerationAmount = 250000;
    const settlementValidationErrors = validateDeedStateByType(invalidSettlement);
    assert.ok(settlementValidationErrors.length > 0, 'Settlement Deed with monetary consideration > 0 must be invalid');

    // POA with monetary consideration > 0 must fail validation
    const invalidPoa = buildValidStateForType('POA');
    invalidPoa.transaction.considerationAmount = 100000;
    const poaValidationErrors = validateDeedStateByType(invalidPoa);
    assert.ok(poaValidationErrors.length > 0, 'POA with monetary consideration > 0 must be invalid');

    // Sale Deed with 0 consideration must fail validation
    const invalidSale = buildValidStateForType('SALE');
    invalidSale.transaction.considerationAmount = 0;
    const saleValidationErrors = validateDeedStateByType(invalidSale);
    assert.ok(saleValidationErrors.length > 0, 'Sale Deed with 0 consideration must be invalid');

    // Lease Deed with wrong roles (e.g. Donor/Donee instead of Lessor/Lessee) must fail validation
    const wrongRoleLease = buildValidStateForType('LEASE');
    wrongRoleLease.parties[0].role = 'Donor';
    wrongRoleLease.parties[1].role = 'Donee';
    const leaseValidationErrors = validateDeedStateByType(wrongRoleLease);
    assert.ok(leaseValidationErrors.length > 0, 'Lease Deed without Lessor/Lessee must fail role validation');

    console.log('PASS [4/6]: Deed-specific party roles and consideration rules are enforced for each supported type.');
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Removal of unsupported assertions (30-year clean title, fake e-stamp, registration claims)
  // ---------------------------------------------------------------------------
  {
    for (const supported of SUPPORTED_DEED_TYPES) {
      const state = buildValidStateForType(supported.code);
      state.selectedClauses = []; // Test base template without optional clauses
      const compiled = compileDeedDocument(state);
      const sections = compiled.sections;
      const combinedText = sections.map(s => `${s.titleEn || ''}\n${s.contentEn}\n${s.titleTa || ''}\n${s.contentTa}`).join('\n');

      assert.ok(
        !combinedText.includes('past 30 years'),
        `${supported.code} base template must not assert unverified 30-year clean title`
      );
      assert.ok(
        !combinedText.includes('IN-TN202684920184X'),
        `${supported.code} template must not include fake government e-stamp certificate numbers`
      );
      assert.ok(
        !combinedText.includes('Section 89B'),
        `${supported.code} template must not assert official SRO registration seal`
      );
    }

    console.log('PASS [5/6]: Unsupported factual assertions of 30-year clean title, fake e-stamps, and SRO registration seals are absent.');
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Backend API enforcement (POST /api/documents, PUT /api/documents/:id, GET /api/documents/:id/export, /api/verification/cross-check)
  // ---------------------------------------------------------------------------
  {
    const { default: app, setTokenVerifierForTesting } = await import('../server');
    const { db, migrateAndBootstrap } = await import('../db');

    await migrateAndBootstrap();

    const writerUser = await db.createUser({
      id: crypto.randomUUID(),
      name: 'Phase4 Writer',
      email: 'writer.phase4@example.com',
      phone: '9840100200',
      organization: 'Deed360 Test Chambers',
      role: 'Document Writer',
      permissions: ['view_own_deeds', 'create_deeds', 'edit_own_deeds'],
      passwordHash: '',
      status: 'Approved',
      createdAt: new Date().toISOString()
    });

    setTokenVerifierForTesting(async (token: string) => {
      if (token === 'valid-writer-token') {
        return {
          id: writerUser.id,
          email: writerUser.email,
          rawEmail: writerUser.email,
          name: writerUser.name
        };
      }
      return null;
    });

    const server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // 6a. POST /api/documents with each of the 6 unsupported types must fail with 400 and TEMPLATE_UNAVAILABLE
      for (const unsupported of UNSUPPORTED_DEED_TYPES) {
        const createRes = await requestJson(baseUrl, 'POST', '/api/documents', {
          token: 'valid-writer-token',
          body: {
            docType: unsupported.nameEn,
            state: buildValidStateForType(unsupported.code)
          }
        });
        assert.equal(
          createRes.status,
          400,
          `POST /api/documents with unsupported type ${unsupported.code} must return 400`
        );
        assert.equal(createRes.data.code, 'TEMPLATE_UNAVAILABLE');
        assert.match(createRes.data.error, /Template unavailable/i);
      }

      // 6b. POST /api/documents with SETTLEMENT (and SETTLE) succeeds and exports DEED OF FAMILY SETTLEMENT
      const settleCreateRes = await requestJson(baseUrl, 'POST', '/api/documents', {
        token: 'valid-writer-token',
        body: {
          docType: 'Settlement Deed',
          subType: 'SETTLE_FAMILY',
          state: buildValidStateForType('SETTLEMENT')
        }
      });
      assert.equal(settleCreateRes.status, 201, 'POST /api/documents for SETTLEMENT must succeed with 201');
      const settleDocId = settleCreateRes.data.document.id;
      assert.equal(settleCreateRes.data.document.state.documentType, 'SETTLEMENT');

      const settleExportRes = await requestJson(baseUrl, 'GET', `/api/documents/${settleDocId}/export`, {
        token: 'valid-writer-token'
      });
      assert.equal(settleExportRes.status, 200, 'GET /api/documents/:id/export for SETTLEMENT must succeed');
      assert.equal(settleExportRes.data.canonicalDeedCode, 'SETTLEMENT');
      assert.ok(
        settleExportRes.data.compiledSections[0].contentEn.includes('DEED OF FAMILY SETTLEMENT'),
        'Exported SETTLEMENT deed must compile DEED OF FAMILY SETTLEMENT'
      );

      // 6c. PUT /api/documents/:id attempting to change a valid draft to an unsupported type (e.g. WILL) must fail with 400
      const updateUnsupportedRes = await requestJson(baseUrl, 'PUT', `/api/documents/${settleDocId}`, {
        token: 'valid-writer-token',
        body: {
          docType: 'Will',
          state: buildValidStateForType('WILL')
        }
      });
      assert.equal(updateUnsupportedRes.status, 400, 'PUT /api/documents/:id with WILL must return 400');
      assert.equal(updateUnsupportedRes.data.code, 'TEMPLATE_UNAVAILABLE');

      // 6d. Finalizing a draft and checking /api/verification/cross-check must NOT claim government registration
      const finalizeRes = await requestJson(baseUrl, 'PUT', `/api/documents/${settleDocId}`, {
        token: 'valid-writer-token',
        body: {
          status: 'Finalized',
          state: buildValidStateForType('SETTLEMENT')
        }
      });
      assert.equal(finalizeRes.status, 200, 'Finalizing supported SETTLEMENT draft must succeed');

      const crossCheckRes = await requestJson(
        baseUrl,
        'GET',
        '/api/verification/cross-check?surveyNo=245&subDivision=2B&village=Thiruvanmiyur&currentDocId=other-doc-id',
        { token: 'valid-writer-token' }
      );
      assert.equal(crossCheckRes.status, 200);
      assert.equal(crossCheckRes.data.hasConflict, true);
      assert.equal(crossCheckRes.data.alerts[0].type, 'DUPLICATE_FINALIZED_DRAFT');
      assert.ok(
        crossCheckRes.data.alerts[0].message.includes('does not constitute government registration'),
        'Cross-check alert must clarify that app finalization does not constitute government registration'
      );
      assert.ok(
        !crossCheckRes.data.alerts[0].message.includes('legally FINALIZED & registered'),
        'Cross-check alert must not claim finalized drafts are legally registered'
      );
    } finally {
      (server as any).closeAllConnections?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
      setTokenVerifierForTesting(null);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    console.log('PASS [6/6]: Backend API enforces canonical deed types on create/update/export and never treats app finalization as government registration.');
    passed++;
  }

  console.log(`\n=== PHASE 4 VERIFICATION SUMMARY: ${passed}/6 TEST GROUPS PASSED ===`);
}

runPhase4Verification()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('PHASE 4 VERIFICATION FAILED:', err);
    process.exit(1);
  });

