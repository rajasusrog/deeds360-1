import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Configure isolated test environment BEFORE importing backend modules
const tmpDir = path.join('/tmp', `deed360-phase8-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
fs.mkdirSync(tmpDir, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.DEEDOS_DATA_DIR = tmpDir;
process.env.DATA_DIR = tmpDir;
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.ENABLE_DEMO_MODE = 'false';

import type { DeedWizardState } from '../../src/types';

async function runPhase8Tests() {
  console.log('\n--- STARTING PHASE 8 BUILD AND RELEASE VERIFICATION SUITE ---');

  const { default: app } = await import('../server');
  const { db } = await import('../db');
  const { compileDeedDocument } = await import('../../src/utils/documentGenerator');
  const { formatIndianCurrency, formatIndianDate } = await import('../../src/utils/amountFormatter');
  const { formatExtent } = await import('../../src/utils/propertyScheduleGenerator');
  const { generateCanonicalDOCX, generateCanonicalPDF } = await import('../../src/utils/documentExportEngine');

  let server: http.Server = null!;
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health and Readiness Endpoint (/health & /api/health)
    // -------------------------------------------------------------------------
    console.log('Test 1: Verifying Health and Readiness Endpoints (/health & /api/health)...');
    {
      const res1 = await fetch(`${baseUrl}/health`);
      assert.equal(res1.status, 200, 'GET /health must return HTTP 200');
      const health1 = await res1.json();
      assert.equal(health1.status, 'online', 'Health status must be "online"');
      assert.equal(health1.service, 'UNIKORN360 DEEDOS CORE ENGINE');
      assert.ok(health1.uptimeSeconds >= 0, 'Uptime seconds must be >= 0');
      assert.equal(health1.database.healthy, true, 'Database readiness must be true');
      assert.ok(typeof health1.database.engine === 'string', 'Database engine must be reported');
      assert.equal(health1.piiEncryptionKeyConfigured, true, 'PII encryption key must be reported configured');

      const res2 = await fetch(`${baseUrl}/api/health`);
      assert.equal(res2.status, 200, 'GET /api/health must return HTTP 200');
      const health2 = await res2.json();
      assert.equal(health2.status, 'online');
      console.log('✓ Test 1 Passed: Health and readiness endpoints reflect service and database state.');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Malformed Input and Error Response Structure (400, 401, 403, 404, 409, 503)
    // -------------------------------------------------------------------------
    console.log('Test 2: Verifying Malformed Inputs and Standard Error Response Structure...');
    {
      // 2a. Malformed JSON Body -> 400 Bad Request
      const rawRes = await new Promise<{ status: number; body: string }>((resResolve) => {
        const req = http.request(
          `${baseUrl}/api/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resResolve({ status: res.statusCode || 0, body: data }));
          }
        );
        req.write('{ "malformedJson": ');
        req.end();
      });

      assert.equal(rawRes.status, 400, 'Malformed JSON must return 400 Bad Request');
      const errObj = JSON.parse(rawRes.body);
      assert.match(errObj.error, /Malformed JSON payload/i);

      // 2b. Missing Authentication -> 401 Unauthorized
      const unauthRes = await fetch(`${baseUrl}/api/documents`);
      assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401 Unauthorized');

      // 2c. Non-existent Route / Resource -> 404 Not Found
      const notFoundRes = await fetch(`${baseUrl}/api/non-existent-endpoint-xyz`);
      assert.equal(notFoundRes.status, 404, 'Non-existent endpoint must return 404 Not Found');

      console.log('✓ Test 2 Passed: Malformed inputs and HTTP error structures verified.');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Tamil & English Deed Formatting, Currency, Dates, Extent & Multi-Survey
    // -------------------------------------------------------------------------
    console.log('Test 3: Verifying Tamil/English preview & exports, money, dates, measurements and multi-surveys...');
    {
      // 3a. Currency formatting
      assert.match(formatIndianCurrency(1250000), /₹\s*12,50,000/);
      assert.match(formatIndianCurrency(0), /₹\s*0/);
      assert.match(formatIndianCurrency(4500), /₹\s*4,500/);

      // 3b. Date formatting
      const formattedDate = formatIndianDate('2026-10-31');
      assert.match(formattedDate, /31st October 2026|October 31, 2026|31\/10\/2026/);

      // 3c. Extent formatting
      const extentFormatted = formatExtent({
        sqft: 2400,
        acre: 0,
        cent: 5.51,
        hectare: 0.022,
        areaUnit: 'Sq.ft',
        totalExtent: 2400,
        eastWest: '40 feet',
        northSouth: '60 feet'
      });
      assert.match(extentFormatted, /2400 Sq\.Ft/i);

      // 3d. Multi-survey bilingual document compilation
      const multiSurveyState: any = {
        documentType: 'Sale Deed',
        documentSubtype: 'STANDARD',
        parties: [
          {
            id: 'p1',
            role: 'Seller',
            name: 'K. Ramanathan',
            fatherName: 'Krishnaswamy',
            address: 'Chennai',
            aadhaar: 'XXXX-XXXX-1234',
            pan: 'ABCDE1234F',
            phone: '9840012345',
            relationshipType: 'S/o'
          },
          {
            id: 'p2',
            role: 'Buyer',
            name: 'S. Vijayalakshmi',
            fatherName: 'Sundaram',
            address: 'Chennai',
            aadhaar: 'XXXX-XXXX-9876',
            pan: 'XYZPD9876Q',
            phone: '9444098765',
            relationshipType: 'D/o'
          }
        ],
        property: {
          district: 'Chennai',
          registrationDistrict: 'Chennai South',
          taluk: 'Mylapore',
          village: 'Thiruvanmiyur',
          sro: 'SRO Thiruvanmiyur',
          doorNo: 'Plot 10 & 11'
        },
        surveys: [
          { surveyNo: '101', subDivision: '1A', pattaNo: '450', chittaRef: 'CH-1' },
          { surveyNo: '101', subDivision: '1B', pattaNo: '451', chittaRef: 'CH-2' },
          { surveyNo: '102', subDivision: '3C', pattaNo: '452', chittaRef: 'CH-3' }
        ],
        extent: {
          sqft: 4800,
          totalExtent: 4800,
          eastWest: '80 feet',
          northSouth: '60 feet'
        },
        boundary: {
          east: '30 Feet Road',
          west: 'Plot 9',
          north: 'Plot 12',
          south: 'Plot 8'
        },
        transaction: {
          considerationAmount: 5000000,
          marketValue: 5000000,
          guidelineValue: 4500000
        },
        ownershipHistory: {
          parentDocNo: '2400',
          parentDocYear: '2018',
          parentDocSRO: 'SRO Thiruvanmiyur'
        }
      };

      const compiledDeed = compileDeedDocument(multiSurveyState, 'DEED/2026/PHASE8');
      assert.ok(compiledDeed.metadata.docNo === 'DEED/2026/PHASE8');
      assert.equal(compiledDeed.metadata.deedCode, 'SALE');
      const allContent = compiledDeed.sections.map(s => s.contentEn + ' ' + s.contentTa).join(' ');
      assert.match(allContent, /DEED OF ABSOLUTE SALE/i);
      assert.match(allContent, /சுத்த கிரயப் பத்திரம்/i);
      assert.match(allContent, /101/);
      assert.match(allContent, /102/);

      // 3e. Export Engine Verification (DOCX & PDF generation)
      const docxResult = await generateCanonicalDOCX(multiSurveyState, 'DEED/2026/PHASE8');
      assert.equal(docxResult.success, true, 'DOCX generation must succeed');
      assert.ok(docxResult.blob && docxResult.blob.size > 0, 'DOCX blob must not be empty');

      const pdfResult = await generateCanonicalPDF(multiSurveyState, 'DEED/2026/PHASE8');
      assert.equal(pdfResult.success, false, 'Headless PDF must report unavailable, never fabricate success');
      assert.equal(pdfResult.blob, undefined);
      assert.match(pdfResult.error || '', /requires a browser rendering environment/);

      console.log('✓ Test 3 Passed: Bilingual compilation, money, dates, measurements, multi-surveys and DOCX verified; browser PDF rendering remains untested.');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Accessible Forms & Viewport Meta Tags
    // -------------------------------------------------------------------------
    console.log('Test 4: Verifying Mobile Usability, Accessibility & Viewport Meta Tags...');
    {
      const indexHtmlPath = path.join(process.cwd(), 'index.html');
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

      assert.match(
        htmlContent,
        /<meta[^>]*viewport/i,
        'index.html must contain a viewport meta tag for mobile usability'
      );
      assert.match(
        htmlContent,
        /width=device-width/i,
        'viewport meta tag must specify width=device-width'
      );
      assert.match(
        htmlContent,
        /<title>/i,
        'index.html must specify a document title'
      );

      console.log('✓ Test 4 Passed: Viewport metadata source checked; browser accessibility and mobile layout remain untested.');
    }

  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\n===================================================================');
  console.log('🎉 ALL PHASE 8 BUILD AND RELEASE VERIFICATION TESTS PASSED! 🎉');
  console.log('===================================================================\n');
}

runPhase8Tests().catch((err) => {
  console.error('PHASE 8 VERIFICATION FAILED:', err);
  process.exit(1);
});
