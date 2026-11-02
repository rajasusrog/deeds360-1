/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { escapeHtml, sanitizeHtml } from "../src/utils/htmlSanitizer";

// ==========================================
// 1. UPLOAD VALIDATION & MAGIC BYTE INSPECTION
// ==========================================

export interface ValidatedPayload {
  base64File: string;
  mimeType: string;
  buffer: Buffer;
  byteLength: number;
  pageNo?: number;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB binary payload limit
const MAX_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES * (4 / 3)) + 1000; // ~14 MB base64 string

export class UploadValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'UploadValidationError';
    this.statusCode = statusCode;
  }
}

export class AiServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 503) {
    super(message);
    this.name = 'AiServiceError';
    this.statusCode = statusCode;
  }
}

export class QuotaExceededError extends Error {
  statusCode: number;
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number = 900) {
    super(message);
    this.name = 'QuotaExceededError';
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Validates base64 upload payload by size, MIME type, and magic byte content inspection.
 * Treats uploaded documents as untrusted input.
 */
export function validateUploadPayload(
  base64File: string,
  declaredMimeType?: string,
  pageNo?: number
): ValidatedPayload {
  if (!base64File || typeof base64File !== 'string' || !base64File.trim()) {
    throw new UploadValidationError('Upload payload is empty or missing base64 file data.', 400);
  }

  // Strip data URL prefix if present
  let cleanBase64 = base64File.trim();
  let extractedMime = declaredMimeType || 'image/png';

  if (cleanBase64.startsWith('data:')) {
    const matches = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      extractedMime = matches[1];
      cleanBase64 = matches[2];
    }
  }

  if (cleanBase64.length > MAX_BASE64_LENGTH) {
    throw new UploadValidationError(
      `File size exceeds maximum allowed upload limit of 10 MB. Length: ${Math.round(cleanBase64.length / 1024 / 1024)}MB`,
      413
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch {
    throw new UploadValidationError('Invalid base64 encoding in uploaded document.', 400);
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError('Decoded file size exceeds maximum allowed limit of 10 MB.', 413);
  }

  if (buffer.length < 12) {
    throw new UploadValidationError('File content is too small or corrupted.', 400);
  }

  // Magic Bytes Content Inspection
  const hexHeader = buffer.subarray(0, 16).toString('hex').toLowerCase();
  let detectedType: string | null = null;

  // PDF: %PDF- (25 50 44 46 2d)
  if (hexHeader.startsWith('255044462d') || buffer.subarray(0, 4).toString('utf8') === '%PDF') {
    detectedType = 'application/pdf';
  }
  // PNG: 89 50 4e 47 0d 0a 1a 0a
  else if (hexHeader.startsWith('89504e470d0a1a0a')) {
    detectedType = 'image/png';
  }
  // JPEG: ff d8 ff
  else if (hexHeader.startsWith('ffd8ff')) {
    detectedType = 'image/jpeg';
  }
  // WebP: RIFF ... WEBP (52 49 46 46 ... 57 45 42 50)
  else if (hexHeader.startsWith('52494646') && buffer.subarray(8, 12).toString('utf8') === 'WEBP') {
    detectedType = 'image/webp';
  }
  // TIFF: 49 49 2a 00 or 4d 4d 00 2a
  else if (hexHeader.startsWith('49492a00') || hexHeader.startsWith('4d4d002a')) {
    detectedType = 'image/tiff';
  }

  if (!detectedType) {
    throw new UploadValidationError(
      'Invalid file content. Uploaded file magic bytes do not match a supported document or image format (PDF, PNG, JPEG, WEBP, TIFF).',
      400
    );
  }

  return {
    base64File: cleanBase64,
    mimeType: detectedType,
    buffer,
    byteLength: buffer.length,
    pageNo
  };
}

// ==========================================
// 2. PER-USER RATE LIMITING & QUOTA TRACKER
// ==========================================

interface UserQuotaBucket {
  count: number;
  resetAt: number;
}

const userQuotaBuckets = new Map<string, UserQuotaBucket>();
const AI_QUOTA_LIMIT = 30; // Max 30 requests
const AI_QUOTA_WINDOW_MS = 15 * 60 * 1000; // 15 minute sliding window

export function checkAiQuota(userId: string): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const now = Date.now();
  const effectiveUserKey = userId || 'anonymous';
  let bucket = userQuotaBuckets.get(effectiveUserKey);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + AI_QUOTA_WINDOW_MS };
    userQuotaBuckets.set(effectiveUserKey, bucket);
  }

  if (bucket.count >= AI_QUOTA_LIMIT) {
    const retrySeconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new QuotaExceededError(
      `AI request quota exceeded (${AI_QUOTA_LIMIT} calls per 15 minutes). Please wait ${retrySeconds} seconds.`,
      retrySeconds
    );
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: AI_QUOTA_LIMIT - bucket.count,
    resetTimeMs: bucket.resetAt - now
  };
}

// Helper to delay for backoff retries
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 3. GEMINI API CLIENT & BOUNDED RETRIES
// ==========================================

const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-deed360',
      }
    }
  });
};

/**
 * Executes an AI task with bounded retries (up to 2 retries, 500ms delay) and a 30s timeout.
 */
async function executeAiTaskWithRetry<T>(
  taskName: string,
  fn: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const demoAllowed =
    process.env.ENABLE_DEMO_MODE === 'true' ||
    process.env.ALLOW_DEMO_FALLBACK === 'true';

  if (!apiKey) {
    if (!demoAllowed) {
      throw new AiServiceError(
        `AI/OCR service unavailable. GEMINI_API_KEY is not configured on the server, and explicit demo fallback (ENABLE_DEMO_MODE=true) is disabled.`,
        503
      );
    }
    throw new AiServiceError('DEMO_MODE_TRIGGERED', 200);
  }

  const ai = getGeminiClient();
  let lastError: Error | null = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 30 second timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${taskName} timed out after 30 seconds.`)), 30000);
      });

      const result = await Promise.race([fn(ai), timeoutPromise]);
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Task ${taskName}] Attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
      }
    }
  }

  if (demoAllowed) {
    throw new AiServiceError('DEMO_MODE_TRIGGERED', 200);
  }

  throw new AiServiceError(
    `AI/OCR Provider Failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown provider failure.'}`,
    502
  );
}

// ==========================================
// 4. CONSISTENT VALIDATED OCR RESPONSE SCHEMA
// ==========================================

export interface OcrExtractionResult {
  success: boolean;
  extractedAt: string;
  extractionMode: 'LIVE_GEMINI' | 'DEMO_MODE';
  isDemo?: boolean;
  demoNotice?: string;
  pageCount: number;
  extractedData: {
    seller: {
      name?: string;
      fatherName?: string;
      pan?: string;
      aadhaar?: string;
      phone?: string;
      address?: string;
    };
    buyer: {
      name?: string;
      fatherName?: string;
      pan?: string;
      aadhaar?: string;
      phone?: string;
      address?: string;
    };
    property: {
      district?: string;
      taluk?: string;
      village?: string;
      surveyNo?: string;
      subDivision?: string;
      pattaNo?: string;
      sro?: string;
    };
    boundaries: {
      north?: string;
      south?: string;
      east?: string;
      west?: string;
    };
    ownershipHistory: {
      parentDocNo?: string;
      parentDocYear?: string;
      parentDocSRO?: string;
    };
    transaction: {
      considerationAmount?: number;
      marketValue?: number;
    };
  };
  rawText: string;
  warnings?: string[];
}

/**
 * AI OCR & Data Extraction Endpoint Handler
 */
export async function aiExtractDocumentData(
  payloads: Array<{ base64File: string; mimeType?: string; pageNo?: number }>,
  userId: string = 'anonymous'
): Promise<OcrExtractionResult> {
  // 1. Quota Check
  checkAiQuota(userId);

  // 2. Validate all pages/files
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new UploadValidationError('No upload payloads provided for OCR extraction.', 400);
  }

  const validatedPages = payloads.map((p, idx) =>
    validateUploadPayload(p.base64File, p.mimeType, p.pageNo || idx + 1)
  );

  const demoAllowed =
    process.env.ENABLE_DEMO_MODE === 'true' ||
    process.env.ALLOW_DEMO_FALLBACK === 'true';

  try {
    const rawResult = await executeAiTaskWithRetry('OCR_Extraction', async (ai) => {
      const inlineDataContents = validatedPages.map((p) => ({
        inlineData: {
          data: p.base64File,
          mimeType: p.mimeType
        }
      }));

      const prompt = `Perform OCR and legal document extraction on this Tamil Nadu registration deed scan.
Extract all details into a clean JSON structure conforming strictly to the requested schema.
Include all extracted text as rawText.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...inlineDataContents, prompt],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sellerName: { type: Type.STRING },
              sellerFatherName: { type: Type.STRING },
              sellerPan: { type: Type.STRING },
              sellerAadhaar: { type: Type.STRING },
              sellerPhone: { type: Type.STRING },
              sellerAddress: { type: Type.STRING },
              buyerName: { type: Type.STRING },
              buyerFatherName: { type: Type.STRING },
              buyerPan: { type: Type.STRING },
              buyerAadhaar: { type: Type.STRING },
              buyerPhone: { type: Type.STRING },
              buyerAddress: { type: Type.STRING },
              district: { type: Type.STRING },
              taluk: { type: Type.STRING },
              village: { type: Type.STRING },
              surveyNo: { type: Type.STRING },
              subDivision: { type: Type.STRING },
              pattaNo: { type: Type.STRING },
              sro: { type: Type.STRING },
              boundariesNorth: { type: Type.STRING },
              boundariesSouth: { type: Type.STRING },
              boundariesEast: { type: Type.STRING },
              boundariesWest: { type: Type.STRING },
              parentDocNo: { type: Type.STRING },
              parentDocYear: { type: Type.STRING },
              parentDocSRO: { type: Type.STRING },
              considerationAmount: { type: Type.NUMBER },
              marketValue: { type: Type.NUMBER },
              rawText: { type: Type.STRING }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return parsed;
    });

    // Process & sanitize live Gemini extraction
    return {
      success: true,
      extractedAt: new Date().toISOString(),
      extractionMode: 'LIVE_GEMINI',
      pageCount: validatedPages.length,
      extractedData: {
        seller: {
          name: escapeHtml(rawResult.sellerName || ''),
          fatherName: escapeHtml(rawResult.sellerFatherName || ''),
          pan: escapeHtml(rawResult.sellerPan || ''),
          aadhaar: escapeHtml(rawResult.sellerAadhaar || ''),
          phone: escapeHtml(rawResult.sellerPhone || ''),
          address: escapeHtml(rawResult.sellerAddress || '')
        },
        buyer: {
          name: escapeHtml(rawResult.buyerName || ''),
          fatherName: escapeHtml(rawResult.buyerFatherName || ''),
          pan: escapeHtml(rawResult.buyerPan || ''),
          aadhaar: escapeHtml(rawResult.buyerAadhaar || ''),
          phone: escapeHtml(rawResult.buyerPhone || ''),
          address: escapeHtml(rawResult.buyerAddress || '')
        },
        property: {
          district: escapeHtml(rawResult.district || ''),
          taluk: escapeHtml(rawResult.taluk || ''),
          village: escapeHtml(rawResult.village || ''),
          surveyNo: escapeHtml(rawResult.surveyNo || ''),
          subDivision: escapeHtml(rawResult.subDivision || ''),
          pattaNo: escapeHtml(rawResult.pattaNo || ''),
          sro: escapeHtml(rawResult.sro || '')
        },
        boundaries: {
          north: escapeHtml(rawResult.boundariesNorth || ''),
          south: escapeHtml(rawResult.boundariesSouth || ''),
          east: escapeHtml(rawResult.boundariesEast || ''),
          west: escapeHtml(rawResult.boundariesWest || '')
        },
        ownershipHistory: {
          parentDocNo: escapeHtml(rawResult.parentDocNo || ''),
          parentDocYear: escapeHtml(rawResult.parentDocYear || ''),
          parentDocSRO: escapeHtml(rawResult.parentDocSRO || '')
        },
        transaction: {
          considerationAmount: Number(rawResult.considerationAmount) || 0,
          marketValue: Number(rawResult.marketValue) || 0
        }
      },
      rawText: sanitizeHtml(rawResult.rawText || '')
    };
  } catch (err: any) {
    if (err?.message === 'DEMO_MODE_TRIGGERED' && demoAllowed) {
      // Isolated Demo Fallback
      return {
        success: true,
        extractedAt: new Date().toISOString(),
        extractionMode: 'DEMO_MODE',
        isDemo: true,
        demoNotice: 'Demonstration mode active (ENABLE_DEMO_MODE=true). Sample extraction generated for local prototyping.',
        pageCount: validatedPages.length,
        extractedData: {
          seller: {
            name: 'M. Selvakumar',
            fatherName: 'Muthuswamy Mudaliar',
            pan: 'ABCPS1234F',
            aadhaar: '458912345678',
            phone: '9840123456',
            address: 'No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041'
          },
          buyer: {
            name: 'K. Senthil Nathan',
            fatherName: 'Kandasamy',
            pan: 'PQRSX5678K',
            aadhaar: '674321985432',
            phone: '9840654321',
            address: 'No. 12, Luz Church Road, Mylapore, Chennai - 600004'
          },
          property: {
            district: 'Chennai',
            taluk: 'Sholinganallur',
            village: 'Thiruvanmiyur',
            surveyNo: '340',
            subDivision: '5',
            pattaNo: '1102',
            sro: 'Thiruvanmiyur'
          },
          boundaries: {
            north: 'Plot No. 46 owned by Mrs. Gomathy',
            south: 'Vacant Land owned by SRO Mylapore Society',
            east: 'Plot No. 44 owned by Mr. Raghavan',
            west: '30 Feet Public Road'
          },
          ownershipHistory: {
            parentDocNo: '1234/1998',
            parentDocYear: '1998',
            parentDocSRO: 'Thiruvanmiyur'
          },
          transaction: {
            considerationAmount: 5000000,
            marketValue: 5000000
          }
        },
        rawText: 'Scanned Deed - Survey 340/5 Thiruvanmiyur Vendor M. Selvakumar Vendee K. Senthil Nathan Consideration 50,00,000'
      };
    }
    throw err;
  }
}

// ==========================================
// 5. DEED COMPLIANCE RULE VALIDATION
// ==========================================

export async function aiValidateDeedDocument(
  deedState: any,
  userId: string = 'anonymous'
) {
  checkAiQuota(userId);

  const demoAllowed =
    process.env.ENABLE_DEMO_MODE === 'true' ||
    process.env.ALLOW_DEMO_FALLBACK === 'true';

  try {
    const result = await executeAiTaskWithRetry('Deed_Validation', async (ai) => {
      const prompt = `Analyze this Tamil Nadu registration deed state and return a list of legal compliance warnings, missing fields, or registry violations as JSON. State: ${JSON.stringify(deedState)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              passed: { type: Type.BOOLEAN },
              warnings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    field: { type: Type.STRING },
                    step: { type: Type.INTEGER },
                    severity: { type: Type.STRING },
                    message: { type: Type.STRING },
                    suggestion: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      return JSON.parse(response.text || '{}');
    });

    return {
      passed: Boolean(result.passed),
      warnings: (result.warnings || []).map((w: any) => ({
        field: escapeHtml(w.field || ''),
        step: Number(w.step) || 1,
        severity: escapeHtml(w.severity || 'warning'),
        message: escapeHtml(w.message || ''),
        suggestion: escapeHtml(w.suggestion || '')
      })),
      checkedAt: new Date().toISOString(),
      ruleEngineVersion: 'DEED360-INTERNAL-CHECKS-v1.4'
    };
  } catch (err: any) {
    if (err?.message === 'DEMO_MODE_TRIGGERED' && demoAllowed) {
      const warnings = [];
      if (!deedState?.parties || deedState.parties.length < 2) {
        warnings.push({
          field: 'parties',
          step: 2,
          severity: 'error',
          message: 'Deed requires a minimum of 2 parties: at least 1 Vendor and 1 Vendee.',
          suggestion: 'Add a Purchaser profile to step 2.'
        });
      }
      if (!deedState?.witnesses || deedState.witnesses.length < 2) {
        warnings.push({
          field: 'witnesses',
          step: 9,
          severity: 'warning',
          message: 'Tamil Nadu Registration Act requires a minimum of two signing witnesses for Sale Deeds.',
          suggestion: 'Enter details for 2 witnesses in step 9.'
        });
      }
      return {
        passed: warnings.length === 0,
        warnings,
        checkedAt: new Date().toISOString(),
        ruleEngineVersion: 'DEED360-INTERNAL-CHECKS-DEMO-v1.4',
        isDemo: true,
        demoNotice: 'Demonstration mode active. Rule checks generated via local rules engine.'
      };
    }
    throw err;
  }
}

// ==========================================
// 6. SMART CLAUSE RECOMMENDER
// ==========================================

export async function aiRecommendClauses(
  deedType: string,
  transactionDetails: any,
  userId: string = 'anonymous'
) {
  checkAiQuota(userId);

  const demoAllowed =
    process.env.ENABLE_DEMO_MODE === 'true' ||
    process.env.ALLOW_DEMO_FALLBACK === 'true';

  try {
    const result = await executeAiTaskWithRetry('Clause_Recommendation', async (ai) => {
      const prompt = `Recommend customized clauses in English and Tamil for a Tamil Nadu registration. Deed Type: ${deedType}. Details: ${JSON.stringify(transactionDetails)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedClauses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    contentEn: { type: Type.STRING },
                    contentTa: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      return JSON.parse(response.text || '{}');
    });

    return {
      recommendedClauses: (result.recommendedClauses || []).map((c: any) => ({
        id: escapeHtml(c.id || ''),
        title: escapeHtml(c.title || ''),
        category: escapeHtml(c.category || 'Standard'),
        contentEn: sanitizeHtml(c.contentEn || ''),
        contentTa: sanitizeHtml(c.contentTa || '')
      }))
    };
  } catch (err: any) {
    if (err?.message === 'DEMO_MODE_TRIGGERED' && demoAllowed) {
      return {
        recommendedClauses: [
          {
            id: 'rec_cl_1',
            title: 'Legal Heir Covenant',
            category: 'Standard',
            contentEn: 'The Vendor hereby declares that there are no minor legal heirs who have claims on the Scheduled Property.',
            contentTa: 'இச்சொத்தில் மைனர் வாரிசுகள் எவருக்கும் எவ்வித பங்கும் இல்லை என்று விற்பனையாளர் அறிவிக்கிறார்.'
          }
        ],
        isDemo: true,
        demoNotice: 'Demonstration mode active. Standard clause recommendations generated.'
      };
    }
    throw err;
  }
}

// ==========================================
// 7. REGISTRY FRAUD & CONFLICT ANALYSIS
// ==========================================

export async function aiCheckDeedFraudRisk(
  surveyNo: string,
  subDivision: string,
  village: string,
  userId: string = 'anonymous'
) {
  checkAiQuota(userId);

  const blocklistSurveys = ['89/1B', '142/3A', '55/2'];
  const litigatedSurveys = ['142/3A', '401/1C'];

  const currentSurveyRef = `${surveyNo}/${subDivision}`.trim();
  const isBlocklisted = blocklistSurveys.includes(currentSurveyRef);
  const isLitigated = litigatedSurveys.includes(currentSurveyRef);

  const alerts: string[] = [];

  if (isBlocklisted) {
    alerts.push(
      `CRITICAL: Survey No ${currentSurveyRef} in ${village} matches an internal caution rule. This is not an official registry result; review supporting records before proceeding.`
    );
  }

  if (isLitigated) {
    alerts.push(
      `WARNING: Survey No ${currentSurveyRef} has an active injunction or pending litigation recorded. Title review required.`
    );
  }

  if (village.toLowerCase() === 'velachery') {
    alerts.push(
      'NOTICE: Survey numbers in Velachery require mandatory FMB sketch verification to confirm zero waterbody/marshland encroachment (High Court Directive).'
    );
  }

  return {
    potentialConflictDetected: isBlocklisted || isLitigated,
    alerts: alerts.map(escapeHtml),
    evaluatedAt: new Date().toISOString(),
    externalVerificationStatus: 'NOT_EXTERNALLY_VERIFIED',
    externalVerificationNotice: 'Not externally verified with live government registry API.'
  };
}
