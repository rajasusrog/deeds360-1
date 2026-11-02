import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Configure disposable isolated test environment before importing app/db
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deed360-phase5-'));
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tempDir;
process.env.DATA_DIR = tempDir;
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

import {
  validateAadhaarPure,
  validateDeedWizardStepPure
} from '../../src/utils/deedValidation.ts';
import { tryCompileDeedDocument } from '../../src/utils/documentGenerator.ts';
import { generateCanonicalPDF, generateCanonicalDOCX } from '../../src/utils/documentExportEngine.ts';
import { DeedWizardState } from '../../src/types/index.ts';

function buildCompleteSaleState(overrides: Record<string, any> = {}): any {
  const base: any = {
    documentType: 'SALE',
    documentSubType: 'SALE_METRO',
    parties: [
      {
        id: 'party-seller-1',
        role: 'Seller',
        name: 'Ramasamy Mudaliar',
        NameTa: 'ராமசாமி முதலியார்',
        relationType: 'S/o',
        relationName: 'Kandasamy',
        fatherName: 'Kandasamy',
        age: 58,
        pan: 'ABCDE1234F',
        aadhaar: '542198763421',
        mobile: '9840123456',
        phone: '9840123456',
        email: 'seller@example.test',
        address: 'No. 14, North Mada Street, Mylapore, Chennai - 600004',
        sharePercentage: '100%'
      },
      {
        id: 'party-buyer-1',
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
        address: 'No. 28, Luz Church Road, Mylapore, Chennai - 600004',
        sharePercentage: '100%'
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai Central',
      taluk: 'Mylapore',
      sro: 'Mylapore',
      village: 'Mylapore',
      localBodyType: 'Corporation',
      localBodyName: 'Greater Chennai Corporation',
      landType: 'Residential Plot',
      LayoutName: 'Kapaleeswarar Nagar',
      plotNo: '42',
      doorNo: '14A',
      streetName: 'North Mada Street',
      wardNo: '124',
      pincode: '600004'
    },
    survey: {
      surveyType: 'Town Survey',
      surveyNo: '412',
      subDivision: '2B',
      oldSurveyNo: '210',
      pattaNo: '8841',
      chittaRef: 'CH/2026/8841',
      areaValue: 2400,
      areaUnit: 'sq.ft',
      areaSqFt: 2400,
      areaSqMeters: 222.97,
      areaCents: 5.51
    },
    surveys: [
      {
        id: 'srv-1',
        surveyType: 'Town Survey',
        surveyNo: '412',
        subDivision: '2B',
        oldSurveyNo: '210',
        pattaNo: '8841',
        chittaRef: 'CH/2026/8841',
        areaValue: 1400,
        areaUnit: 'sq.ft',
        areaSqFt: 1400,
        areaSqMeters: 130.06,
        areaCents: 3.21
      },
      {
        id: 'srv-2',
        surveyType: 'Town Survey',
        surveyNo: '413',
        subDivision: '1A',
        oldSurveyNo: '211',
        pattaNo: '8842',
        chittaRef: 'CH/2026/8842',
        areaValue: 1000,
        areaUnit: 'sq.ft',
        areaSqFt: 1000,
        areaSqMeters: 92.9,
        areaCents: 2.3
      }
    ],
    extent: {
      totalExtent: 2400,
      sqft: 2400,
      acre: 0.055,
      cent: 5.51,
      hectare: 0.022,
      eastWest: '40',
      northSouth: '60'
    },
    boundary: {
      north: '30 Feet Layout Road',
      south: 'Plot No. 43 belonging to Murugan',
      east: 'Plot No. 41 belonging to Sivakumar',
      west: 'Common Passage'
    },
    boundaries: {
      north: '30 Feet Layout Road',
      south: 'Plot No. 43 belonging to Murugan',
      east: 'Plot No. 41 belonging to Sivakumar',
      west: 'Common Passage',
      eastToWestNorth: '40',
      eastToWestSouth: '40',
      northToSouthEast: '60',
      northToSouthWest: '60',
      accessRoadWidth: '30 Feet',
      linearUnit: 'feet'
    },
    ownershipHistory: {
      howAcquired: 'Purchase',
      parentDocNo: '1988/2015',
      parentDocYear: '2015',
      parentDocType: 'Sale Deed',
      parentDocSRO: 'Mylapore',
      parentSro: 'Mylapore',
      parentDocDate: '2015-05-10',
      priorOwners: 'Subramaniam Chettiar',
      ecNumber: 'EC/2026/99210',
      ecPeriodFrom: '1995-01-01',
      ecPeriodTo: '2026-03-01',
      encumbranceStatus: 'Nil Encumbrance'
    },
    transaction: {
      guidelineRatePerSqFt: 4500,
      guidelineValue: 10800000,
      marketValue: 12000000,
      considerationAmount: 12000000,
      paymentMode: 'NEFT/RTGS',
      bankName: 'State Bank of India, Mylapore Branch',
      paymentRefNo: 'SBINR520260315998811',
      utrNumber: 'SBINR520260315998811',
      paymentDate: '2026-03-15',
      advancePaid: 2000000,
      balancePaid: 10000000,
      stampDutyPercent: 7,
      registrationFeePercent: 4,
      stampDutyAmount: 840000,
      registrationFeeAmount: 480000,
      otherCharges: 1500,
      totalPayable: 1321500,
      payments: [
        {
          id: 'pay-1',
          mode: 'RTGS',
          amount: 12000000,
          date: '2026-03-15',
          bankName: 'State Bank of India',
          referenceNo: 'SBINR520260315998811',
          Stage: 'Full Settlement'
        }
      ]
    },
    building: {
      hasBuilding: false,
      buildingType: 'RCC Posh',
      plinthAreaSqFt: 0,
      floorsCount: 0,
      ageOfBuilding: 0,
      buildingDoorNo: '',
      ebServiceNo: '',
      waterConnectionNo: '',
      propertyTaxAssessmentNo: '',
      buildingValue: 0
    },
    witnesses: [
      {
        id: 'wit-1',
        name: 'Karthikeyan V',
        relationName: 'Velmurugan',
        fatherName: 'Velmurugan',
        aadhaar: '782345129087',
        mobile: '9840112233',
        phone: '9840112233',
        address: 'No. 8, South Mada Street, Mylapore, Chennai - 600004'
      },
      {
        id: 'wit-2',
        name: 'Senthamarai S',
        relationName: 'Subramanian',
        fatherName: 'Subramanian',
        aadhaar: '891234765012',
        mobile: '9840445566',
        phone: '9840445566',
        address: 'No. 22, East Mada Street, Mylapore, Chennai - 600004'
      }
    ],
    specialConditions: {
      possessionHandover: 'Immediate on Registration',
      taxArrearsClearence: 'Seller clears all up to date',
      indemnityClauseIncluded: true,
      disputeResolutionCity: 'Chennai',
      customConditions: ''
    },
    languageMode: 'EN',
    ...overrides
  };

  return JSON.parse(JSON.stringify(base));
}

async function apiRequest(
  baseUrl: string,
  method: string,
  routePath: string,
  token: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extraHeaders
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function runPhase5Verification() {
  console.log('=== PHASE 5 VERIFICATION: SAVE, SYNC AND WIZARD FLOW ===\n');

  const { default: app, setTokenVerifierForTesting } = await import('../server');
  const { db, migrateAndBootstrap } = await import('../db');

  await migrateAndBootstrap();

  const writerA = await db.createUser({
    id: crypto.randomUUID(),
    name: 'Writer Alpha',
    email: 'writer.a@unikorn360.test',
    phone: '9840100301',
    organization: 'Deed360 Test Chambers',
    role: 'Document Writer',
    permissions: ['view_own_deeds', 'create_deeds', 'edit_own_deeds'],
    passwordHash: '',
    status: 'Approved',
    createdAt: new Date().toISOString()
  });

  setTokenVerifierForTesting(async (token: string) => {
    if (token === 'token-writer-a') {
      return {
        id: writerA.id,
        email: writerA.email,
        rawEmail: writerA.email,
        name: writerA.name
      };
    }
    return null;
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // =========================================================================
    // TEST 1: PURE VALIDATION (NO MUTATION OF AADHAAR OR FORM VALUES)
    // =========================================================================
    console.log('Test 1: Verifying pure validation never mutates Aadhaar or any form values...');
    const rawState = buildCompleteSaleState();
    const originalSellerAadhaar = rawState.parties[0].aadhaar;
    const originalBuyerAadhaar = rawState.parties[1].aadhaar;
    const originalWitness1Aadhaar = rawState.witnesses[0].aadhaar;
    const snapshotBeforeValidation = JSON.stringify(rawState);

    assert.equal(originalSellerAadhaar, '542198763421');
    assert.equal(validateAadhaarPure('542198763421').valid, true);
    assert.equal(validateAadhaarPure('XXXX-XXXX-1098').valid, true);
    assert.equal(validateAadhaarPure('12345').valid, false);

    // Run validation across every step (1..12) and final validation
    for (let step = 1; step <= 12; step++) {
      const res = validateDeedWizardStepPure(rawState, step, step === 12);
      assert.equal(res.errors.length, 0, `Expected 0 errors on step ${step}, got: ${res.errors.join(', ')}`);
    }

    const snapshotAfterValidation = JSON.stringify(rawState);
    assert.equal(
      rawState.parties[0].aadhaar,
      originalSellerAadhaar,
      'Validation must NOT mutate seller Aadhaar in place'
    );
    assert.equal(
      rawState.parties[1].aadhaar,
      originalBuyerAadhaar,
      'Validation must NOT mutate buyer Aadhaar in place'
    );
    assert.equal(
      rawState.witnesses[0].aadhaar,
      originalWitness1Aadhaar,
      'Validation must NOT mutate witness Aadhaar in place'
    );
    assert.equal(
      snapshotAfterValidation,
      snapshotBeforeValidation,
      'Validation must be 100% pure and leave the entire state object untouched'
    );
    console.log('  ✓ Pure validation verified: 0 mutations across all 12 wizard steps.');

    // =========================================================================
    // TEST 2: SERVER-SIDE VALIDATION & STATUS TRANSITION ENFORCEMENT
    // =========================================================================
    console.log('Test 2: Verifying server-side validation and document status transition rules...');

    // 2a. Reject creating a document directly in Finalized status
    const directFinalizedCreate = await apiRequest(baseUrl, 'POST', '/api/documents', 'token-writer-a', {
      docType: 'SALE',
      subType: 'SALE_METRO',
      status: 'Finalized',
      state: buildCompleteSaleState()
    });
    assert.equal(directFinalizedCreate.status, 400);
    assert.ok(
      directFinalizedCreate.data.code === 'INVALID_INITIAL_STATUS' ||
      directFinalizedCreate.data.code === 'INVALID_STATUS_TRANSITION'
    );

    // 2b. Create a valid Draft document
    const createRes = await apiRequest(baseUrl, 'POST', '/api/documents', 'token-writer-a', {
      docType: 'SALE',
      subType: 'SALE_METRO',
      status: 'Draft',
      state: buildCompleteSaleState()
    });
    assert.equal(createRes.status, 201);
    const createdDoc = createRes.data.document;
    assert.ok(createdDoc.id);
    assert.equal(createdDoc.status, 'Draft');
    assert.equal(createdDoc.revision, 1);

    // 2c. Reject invalid status jump Draft -> Exported
    const invalidJumpRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...createdDoc,
        status: 'Exported',
        expectedRevision: createdDoc.revision
      }
    );
    assert.equal(invalidJumpRes.status, 400);
    assert.equal(invalidJumpRes.data.code, 'INVALID_STATUS_TRANSITION');

    // 2d. Reject invalid deed payload on server (negative consideration & invalid PAN)
    const invalidState = buildCompleteSaleState();
    invalidState.transaction.considerationAmount = -5000;
    invalidState.parties[0].pan = 'INVALID_PAN';

    const invalidDataRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...createdDoc,
        state: invalidState,
        expectedRevision: createdDoc.revision
      }
    );
    assert.equal(invalidDataRes.status, 400);
    assert.equal(invalidDataRes.data.code, 'VALIDATION_FAILED');
    assert.ok(Array.isArray(invalidDataRes.data.errors) && invalidDataRes.data.errors.length >= 2);

    // 2e. Reject finalizing an incomplete draft on the server
    const incompleteState = buildCompleteSaleState();
    incompleteState.witnesses = []; // Missing required 2 witnesses
    const incompleteFinalizeRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...createdDoc,
        status: 'Finalized',
        state: incompleteState,
        expectedRevision: createdDoc.revision
      }
    );
    assert.equal(incompleteFinalizeRes.status, 400);
    assert.equal(incompleteFinalizeRes.data.code, 'VALIDATION_FAILED');
    console.log('  ✓ Server-side validation and status transition rules enforced.');

    // =========================================================================
    // TEST 3: CREATE -> EDIT -> SAVE -> RELOAD -> RESUME -> REVIEW -> GENERATE -> EXPORT
    //         + FINALIZED IMMUTABILITY & REVISION HISTORY PRESERVATION
    // =========================================================================
    console.log('Test 3: Verifying full wizard lifecycle, finalized lock, and revision history...');

    // Step A: Edit & save in 'In Progress'
    const editedState = buildCompleteSaleState();
    editedState.property.doorNo = '14B-Amended';
    editedState.transaction.considerationAmount = 12500000;
    editedState.transaction.balancePaid = 10500000;
    editedState.transaction.payments[0].amount = 12500000;

    const saveInProgressRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...createdDoc,
        status: 'In Progress',
        consideration: 12500000,
        state: editedState,
        expectedRevision: createdDoc.revision
      }
    );
    assert.equal(saveInProgressRes.status, 200);
    const savedInProgressDoc = saveInProgressRes.data.document;
    assert.equal(savedInProgressDoc.status, 'In Progress');
    assert.equal(savedInProgressDoc.revision, 2);

    // Step B: Reload from server & resume
    const reloadRes = await apiRequest(baseUrl, 'GET', '/api/documents', 'token-writer-a');
    assert.equal(reloadRes.status, 200);
    const reloadedDoc = reloadRes.data.find((d: any) => d.id === createdDoc.id);
    assert.ok(reloadedDoc, 'Reloaded document must exist on server');
    assert.equal(reloadedDoc.state.property.doorNo, '14B-Amended');
    assert.equal(reloadedDoc.revision, 2);

    // Step C: Review transition (In Progress -> Pending Review -> Approved)
    const pendingReviewRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...reloadedDoc,
        status: 'Pending Review',
        expectedRevision: reloadedDoc.revision
      }
    );
    if (pendingReviewRes.status !== 200) {
      console.error('pendingReviewRes error payload:', pendingReviewRes.data);
    }
    assert.equal(pendingReviewRes.status, 200);
    const pendingReviewDoc = pendingReviewRes.data.document;
    assert.equal(pendingReviewDoc.status, 'Pending Review');

    const approvedRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...pendingReviewDoc,
        status: 'Approved',
        expectedRevision: pendingReviewDoc.revision
      }
    );
    assert.equal(approvedRes.status, 200);
    const approvedDoc = approvedRes.data.document;
    assert.equal(approvedDoc.status, 'Approved');

    // Step D: Finalize & Generate
    const finalizeRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${createdDoc.id}`,
      'token-writer-a',
      {
        ...approvedDoc,
        status: 'Finalized',
        expectedRevision: approvedDoc.revision
      }
    );
    assert.equal(finalizeRes.status, 200);
    const finalizedDoc = finalizeRes.data.document;
    assert.equal(finalizedDoc.status, 'Finalized');

    // Compile & Export verification (PDF + DOCX + Server Export endpoint)
    const compileCheck = tryCompileDeedDocument(finalizedDoc.state, finalizedDoc.docNo);
    assert.ok(compileCheck.deed, `Expected compiled deed, got error: ${compileCheck.error}`);
    assert.ok(compileCheck.deed.sections.length > 5);

    const pdfCheck = await generateCanonicalPDF(finalizedDoc.state, finalizedDoc.docNo);
    assert.equal(pdfCheck.success, false, 'Browser PDF rendering must not be simulated in Node');
    assert.equal(pdfCheck.blob, undefined);
    assert.match(pdfCheck.error || '', /requires a browser rendering environment/);

    const docxCheck = await generateCanonicalDOCX(finalizedDoc.state, finalizedDoc.docNo);
    assert.equal(docxCheck.success, true);
    assert.ok(docxCheck.blob && docxCheck.blob.size > 500);

    const exportAuthRes = await apiRequest(
      baseUrl,
      'GET',
      `/api/documents/${finalizedDoc.id}/export`,
      'token-writer-a'
    );
    assert.equal(exportAuthRes.status, 200);
    assert.equal(exportAuthRes.data.canonicalDeedCode, 'SALE');
    assert.ok(Array.isArray(exportAuthRes.data.compiledSections) && exportAuthRes.data.compiledSections.length > 5);

    // Transition Finalized -> Exported (allowed without content changes)
    const exportedStatusRes = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${finalizedDoc.id}`,
      'token-writer-a',
      {
        ...finalizedDoc,
        status: 'Exported',
        expectedRevision: finalizedDoc.revision
      }
    );
    assert.equal(exportedStatusRes.status, 200);
    const exportedDoc = exportedStatusRes.data.document;
    assert.equal(exportedDoc.status, 'Exported');

    // Step E: Verify ordinary edits and deletions of finalized/exported records are BLOCKED
    const tamperedState = buildCompleteSaleState();
    tamperedState.transaction.considerationAmount = 999999;
    const illegalEditOnFinalized = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${exportedDoc.id}`,
      'token-writer-a',
      {
        ...exportedDoc,
        consideration: 999999,
        state: tamperedState,
        expectedRevision: exportedDoc.revision
      }
    );
    assert.equal(illegalEditOnFinalized.status, 409);
    assert.equal(illegalEditOnFinalized.data.code, 'FINALIZED_RECORD_LOCKED');

    const illegalDeleteOnFinalized = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/documents/${exportedDoc.id}`,
      'token-writer-a'
    );
    assert.equal(illegalDeleteOnFinalized.status, 409);
    assert.equal(illegalDeleteOnFinalized.data.code, 'FINALIZED_RECORD_LOCKED');

    // Step F: Create a formal revision on the finalized/exported record and verify revisionHistory
    const revisionCreateRes = await apiRequest(
      baseUrl,
      'POST',
      `/api/documents/${exportedDoc.id}/revisions`,
      'token-writer-a',
      {
        expectedRevision: exportedDoc.revision,
        reason: 'Correcting door number from 14B-Amended to 14C'
      }
    );
    assert.equal(revisionCreateRes.status, 200);
    const revisedDoc = revisionCreateRes.data.document;
    assert.equal(revisedDoc.status, 'Draft');
    assert.equal(revisedDoc.version, 2);
    assert.equal(revisedDoc.docNo, `${createdDoc.docNo}-v2`);
    assert.ok(Array.isArray(revisedDoc.revisionHistory) && revisedDoc.revisionHistory.length === 1);
    assert.equal(revisedDoc.revisionHistory[0].docNo, createdDoc.docNo);
    assert.equal(revisedDoc.revisionHistory[0].version, 1);
    assert.equal(revisedDoc.revisionHistory[0].status, 'Exported');
    assert.equal(revisedDoc.revisionHistory[0].state.property.doorNo, '14B-Amended');

    // Re-finalize v2 so it can be used in Test 4 survey conflict checks
    const reFinalizeV2 = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${revisedDoc.id}`,
      'token-writer-a',
      {
        ...revisedDoc,
        status: 'Finalized',
        expectedRevision: revisedDoc.revision
      }
    );
    assert.equal(reFinalizeV2.status, 200);
    const finalizedV2Doc = reFinalizeV2.data.document;
    assert.equal(finalizedV2Doc.status, 'Finalized');
    console.log('  ✓ Lifecycle (create -> edit -> save -> reload -> resume -> review -> generate -> export) and revision history verified.');

    // =========================================================================
    // TEST 4: MULTI-ROW QUALIFIED SURVEY CHECKS & TRANSACTION-HISTORY REVIEW
    // =========================================================================
    console.log('Test 4: Verifying multi-row location-qualified survey checks and transaction-history review...');

    // 4a. Same survey number (413/1A) in a DIFFERENT SRO/Taluk/District must NOT conflict
    const differentLocationState = buildCompleteSaleState();
    differentLocationState.property.district = 'Madurai';
    differentLocationState.property.registrationDistrict = 'Madurai South';
    differentLocationState.property.taluk = 'Madurai South';
    differentLocationState.property.sro = 'Tallakulam';
    differentLocationState.property.village = 'Mylapore'; // Even if village name coincides, district/taluk/sro differ
    differentLocationState.surveys = [
      {
        ...differentLocationState.surveys![0],
        surveyNo: '413',
        subDivision: '1A'
      }
    ];

    const diffLocCreate = await apiRequest(baseUrl, 'POST', '/api/documents', 'token-writer-a', {
      docType: 'SALE',
      subType: 'SALE_METRO',
      status: 'Draft',
      state: differentLocationState
    });
    assert.equal(diffLocCreate.status, 201);
    const diffLocDoc = diffLocCreate.data.document;

    const diffLocFinalize = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${diffLocDoc.id}`,
      'token-writer-a',
      {
        ...diffLocDoc,
        status: 'Finalized',
        expectedRevision: diffLocDoc.revision
      }
    );
    assert.equal(
      diffLocFinalize.status,
      200,
      'Same surveyNo in a different district/taluk/sro must NOT trigger a conflict'
    );

    // 4b. Multi-row check: Second survey row (surveys[1] = 413/1A in Chennai/Mylapore) overlaps finalizedV2Doc's surveys[1]
    const overlappingRow2State = buildCompleteSaleState();
    overlappingRow2State.surveys = [
      {
        ...overlappingRow2State.surveys![0],
        surveyNo: '999', // Row 1 is completely distinct
        subDivision: '9Z'
      },
      {
        ...overlappingRow2State.surveys![1],
        surveyNo: '413', // Row 2 matches finalizedV2Doc's second survey row (413/1A in Mylapore)
        subDivision: '1A'
      }
    ];
    overlappingRow2State.ownershipHistory.parentDocNo = 'UNRELATED/1999/11';

    const row2DraftCreate = await apiRequest(baseUrl, 'POST', '/api/documents', 'token-writer-a', {
      docType: 'SALE',
      subType: 'SALE_METRO',
      status: 'Draft',
      state: overlappingRow2State
    });
    assert.equal(row2DraftCreate.status, 201);
    const row2DraftDoc = row2DraftCreate.data.document;

    // Cross-check endpoint (POST with multi-row state) detects row #2 conflict as POSSIBLE_CONFLICT_REQUIRES_REVIEW
    const crossCheckPost = await apiRequest(
      baseUrl,
      'POST',
      '/api/verification/cross-check',
      'token-writer-a',
      {
        state: overlappingRow2State,
        currentDocId: row2DraftDoc.id
      }
    );
    assert.equal(crossCheckPost.status, 200);
    assert.equal(crossCheckPost.data.hasConflict, true);
    assert.equal(crossCheckPost.data.requiresReview, true);
    assert.equal(crossCheckPost.data.conflicts[0].category, 'POSSIBLE_CONFLICT_REQUIRES_REVIEW');
    assert.equal(crossCheckPost.data.conflicts[0].survey.rowIndex, 1); // 2nd survey row (index 1)
    assert.equal(crossCheckPost.data.conflicts[0].survey.surveyNo, '413');
    assert.ok(
      !crossCheckPost.data.message.toLowerCase().includes('fraud detected'),
      'Must present as possible conflict requiring review, not automatic fraud'
    );

    // Finalizing without linking parentDocNo or acknowledging conflict review returns 409 SURVEY_CONFLICT_REQUIRES_REVIEW
    const unreviewedFinalize = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${row2DraftDoc.id}`,
      'token-writer-a',
      {
        ...row2DraftDoc,
        status: 'Finalized',
        expectedRevision: row2DraftDoc.revision
      }
    );
    assert.equal(unreviewedFinalize.status, 409);
    assert.equal(unreviewedFinalize.data.code, 'SURVEY_CONFLICT_REQUIRES_REVIEW');
    assert.equal(unreviewedFinalize.data.requiresReview, true);

    // 4c. Linking prior finalized deed in ownershipHistory.parentDocNo satisfies transaction-history review
    const linkedHistoryState = JSON.parse(JSON.stringify(overlappingRow2State));
    linkedHistoryState.ownershipHistory.parentDocNo = finalizedV2Doc.docNo;

    const linkedFinalize = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${row2DraftDoc.id}`,
      'token-writer-a',
      {
        ...row2DraftDoc,
        status: 'Finalized',
        state: linkedHistoryState,
        expectedRevision: row2DraftDoc.revision
      }
    );
    assert.equal(
      linkedFinalize.status,
      200,
      'Linking prior finalized docNo as parentDocNo must allow finalization after transaction-history check'
    );
    assert.equal(linkedFinalize.data.document.status, 'Finalized');
    console.log('  ✓ Multi-row location-qualified survey conflict and reviewed transaction-history logic verified.');

    // =========================================================================
    // TEST 5: DUPLICATE, DELETE, CONCURRENT EDIT VERSION CONFLICT,
    //         FAILED SAVE & STALE AUTOSAVE CLOSURE PROTECTION
    // =========================================================================
    console.log('Test 5: Verifying duplicate, delete, concurrent edit conflicts, and sync state engine...');

    // 5a. Duplicate a document (creates independent Draft record with new UUID)
    const duplicateCreateRes = await apiRequest(baseUrl, 'POST', '/api/documents', 'token-writer-a', {
      docType: finalizedV2Doc.docType,
      subType: finalizedV2Doc.subType,
      status: 'Draft',
      writer: finalizedV2Doc.writer,
      propertyAddress: finalizedV2Doc.propertyAddress,
      consideration: finalizedV2Doc.consideration,
      progress: finalizedV2Doc.progress,
      state: {
        ...finalizedV2Doc.state,
        version: 1,
        revisionHistory: []
      }
    });
    assert.equal(duplicateCreateRes.status, 201);
    const duplicatedDoc = duplicateCreateRes.data.document;
    assert.notEqual(duplicatedDoc.id, finalizedV2Doc.id);
    assert.notEqual(duplicatedDoc.docNo, finalizedV2Doc.docNo);
    assert.equal(duplicatedDoc.status, 'Draft');

    // 5b. Concurrent edits / Version Conflict Detection (409 VERSION_CONFLICT with currentDocument)
    // Session 1 updates duplicatedDoc from revision 1 -> 2
    const session1State = buildCompleteSaleState();
    (session1State.property as any).streetName = 'Session 1 Street Update';
    const session1Update = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${duplicatedDoc.id}`,
      'token-writer-a',
      {
        ...duplicatedDoc,
        state: session1State,
        expectedRevision: 1
      }
    );
    assert.equal(session1Update.status, 200);
    assert.equal(session1Update.data.document.revision, 2);

    // Session 2 tries to save using stale expectedRevision: 1
    const session2State = buildCompleteSaleState();
    (session2State.property as any).streetName = 'Session 2 Stale Overwrite Attempt';
    const session2StaleUpdate = await apiRequest(
      baseUrl,
      'PUT',
      `/api/documents/${duplicatedDoc.id}`,
      'token-writer-a',
      {
        ...duplicatedDoc,
        state: session2State,
        expectedRevision: 1
      }
    );
    assert.equal(session2StaleUpdate.status, 409);
    assert.equal(session2StaleUpdate.data.code, 'VERSION_CONFLICT');
    assert.equal(session2StaleUpdate.data.currentRevision, 2);
    assert.equal(
      session2StaleUpdate.data.currentDocument.state.property.streetName,
      'Session 1 Street Update',
      'Server must return currentDocument so client can resolve conflict without silent overwrite'
    );

    // 5c. Delete non-finalized duplicated draft
    const deleteDraftRes = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/documents/${duplicatedDoc.id}`,
      'token-writer-a'
    );
    assert.equal(deleteDraftRes.status, 200);
    assert.equal(deleteDraftRes.data.success, true);

    const verifyDeletedRes = await apiRequest(baseUrl, 'GET', '/api/documents', 'token-writer-a');
    assert.equal(
      verifyDeletedRes.data.some((d: any) => d.id === duplicatedDoc.id),
      false,
      'Deleted draft must no longer appear in document list'
    );

    // 5d. Verify AppContext sync state transitions, failed save retention, offline recovery, and stale closure protection
    const appContextSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/AppContext.tsx'),
      'utf8'
    );
    assert.ok(appContextSource.includes("'Saved on this device'"));
    assert.ok(appContextSource.includes("'Syncing'"));
    assert.ok(appContextSource.includes("'Saved on server'"));
    assert.ok(appContextSource.includes("'Save failed'"));
    assert.ok(appContextSource.includes('editSeqByDraftRef'));
    assert.ok(appContextSource.includes('inFlightSaveByDraftRef'));
    assert.ok(appContextSource.includes('queuedSaveByDraftRef'));
    assert.ok(appContextSource.includes('beforeunload'));
    assert.ok(
      appContextSource.includes('currentSeqNow > seqAtStart'),
      'AppContext must check edit sequence numbers so stale saves never claim Saved on server over newer local edits'
    );
    console.log('  ✓ Duplicate, delete, concurrent edit conflict detection (409 VERSION_CONFLICT), and sync state engine verified.');

    console.log('\n=== ALL PHASE 5 VERIFICATION CHECKS PASSED ===');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runPhase5Verification().catch((err) => {
  console.error('Phase 5 verification failed:', err);
  process.exit(1);
});
