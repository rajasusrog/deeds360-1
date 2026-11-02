import { matchesDocumentSearch } from '../src/utils/documentSearch';
import 'dotenv/config';
import { setCustomSanitizer } from '../src/utils/htmlSanitizer';
import { sanitizeServerHtml } from './serverSanitizer';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  aiExtractDocumentData, 
  aiValidateDeedDocument, 
  aiRecommendClauses, 
  aiCheckDeedFraudRisk 
} from './ai';
import {
  db,
  DbUser,
  DbClient,
  DbDocument,
  DbAuditLog,
  SafeUser,
  toSafeUser,
  migrateAndBootstrap,
  getMasterDataEngine,
  ConcurrencyConflictError,
  FinalizedRecordLockedError,
  DuplicateRecordError,
  RecordNotFoundError,
  PersistenceError,
  generateRecordUuid
} from './db';
import {
  serializeClient,
  serializeDocument,
  serializeOcrData,
  PII_INVENTORY,
  getDeterministicHash,
  maskPIIInText,
} from './pii';
import {
  resolveDeedType,
  isDeedTemplateAvailable,
  normalizeDeedCode,
  getDeedDisplayName
} from '../src/utils/deedTypes';
import { compileDeedDocument } from '../src/utils/documentGenerator';
import {
  validateDeedRecordForServer,
  validateStatusTransition,
  extractQualifiedSurveys,
  findQualifiedSurveyConflicts
} from '../src/utils/deedValidation';
import { calculateTrustScore } from '../src/utils/verificationService';

dotenv.config();
setCustomSanitizer({ sanitize: sanitizeServerHtml });

// Initialize server-side Supabase client (using service role key or anon key securely on backend)
const serverSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serverSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholderSupabase = !serverSupabaseUrl || !serverSupabaseKey ||
  serverSupabaseUrl === 'https://mock-placeholder.supabase.co' ||
  serverSupabaseKey === 'mock-anon-key-placeholder';

let supabaseServer: SupabaseClient | null = null;
if (!isPlaceholderSupabase && serverSupabaseUrl && serverSupabaseKey) {
  try {
    supabaseServer = createClient(serverSupabaseUrl, serverSupabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('Could not initialize Supabase server client:', err);
  }
}

export interface VerifiedIdentity {
  id: string;
  email: string;
  rawEmail: string;
  name?: string;
  avatar_url?: string;
}

type TokenVerifierFn = (token: string) => Promise<VerifiedIdentity | null>;
let customTestVerifier: TokenVerifierFn | null = null;

export function setTokenVerifierForTesting(verifier: TokenVerifierFn | null) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setTokenVerifierForTesting is only permitted in test environment.');
  }
  customTestVerifier = verifier;
}

function verifyHs256Jwt(token: string, secret: string): VerifiedIdentity | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);
    if (!header || header.alg !== 'HS256') return null;

    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest();
    const actualSig = Buffer.from(signatureB64, 'base64url');
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') return null;

    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      return null;
    }
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      return null;
    }

    // Never read or return role from user_metadata or app_metadata
    return {
      id: payload.sub.trim(),
      email: payload.email.trim().toLowerCase(),
      rawEmail: payload.email.trim(),
      name: payload.user_metadata?.full_name || payload.user_metadata?.name,
      avatar_url: payload.user_metadata?.avatar_url || payload.user_metadata?.picture
    };
  } catch {
    return null;
  }
}

export async function verifySupabaseToken(token: string): Promise<VerifiedIdentity | null> {
  if (!token || typeof token !== 'string' || token.trim() !== token) {
    return null;
  }

  if (process.env.NODE_ENV === 'test' && customTestVerifier) {
    return customTestVerifier(token);
  }

  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (supabaseJwtSecret && supabaseJwtSecret.trim().length > 0) {
    const verifiedLocal = verifyHs256Jwt(token, supabaseJwtSecret);
    if (verifiedLocal) {
      return verifiedLocal;
    }
  }

  if (supabaseServer) {
    try {
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);
      if (error || !user || !user.id || !user.email) {
        return null;
      }
      // Derive identity strictly from verified token; never extract user_metadata.role
      return {
        id: user.id,
        email: user.email.trim().toLowerCase(),
        rawEmail: user.email.trim(),
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
}

export function normalizeAccountStatus(
  userOrStatus: Partial<DbUser> | string | undefined | null
): 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted' {
  if (!userOrStatus) return 'Pending Approval';
  if (typeof userOrStatus === 'object') {
    if (userOrStatus.deleted === true || userOrStatus.isDeleted === true) {
      return 'Deleted';
    }
    return normalizeAccountStatus(userOrStatus.status);
  }
  const normalized = String(userOrStatus).trim().toLowerCase();
  if (normalized === 'deleted') return 'Deleted';
  if (normalized === 'suspended') return 'Suspended';
  if (normalized === 'pending' || normalized === 'pending approval' || normalized === 'pending_approval') {
    return 'Pending Approval';
  }
  if (normalized === 'approved' || normalized === 'active') {
    return 'Approved';
  }
  return 'Pending Approval';
}

interface ElevatedSession {
  userId: string;
  userEmail: string;
  role: string;
  reasonCode: string;
  expiresAt: Date;
}

// In-memory registry for active elevated Auditor sessions
const activeElevatedSessions = new Map<string, ElevatedSession>();

// Explicit Super Admin account allowlist
const SUPER_ADMIN_EMAILS = ['clearfile360@gmail.com', 'raj.asusrog@gmail.com'];

// Help build user context for PII serialization and masking with strict session checks
const buildUserContext = async (req: Request) => {
  const dbUsers = await db.getUsers();
  const reqEmail = (req as any).user?.email || '';
  const reqId = (req as any).user?.id || '';
  const fullUser = dbUsers.find(u => 
    (reqId && u.id === reqId) ||
    (reqEmail && u.email.toLowerCase() === reqEmail.toLowerCase())
  );
  
  const role = fullUser ? fullUser.role : 'Client';
  const email = fullUser ? fullUser.email : reqEmail;
  const id = fullUser ? fullUser.id : '';
  const phone = fullUser ? fullUser.phone : '';
  
  let elevatedReview = false;
  let reasonCode = '';

  // Elevated review MUST require: authenticated Auditor role, explicit server-side permission, and mandatory reason
  if (role === 'Auditor' && email) {
    const session = activeElevatedSessions.get(email.toLowerCase());
    const queryElevated = req.query?.elevated === 'true' || req.headers?.['x-elevated-review'] === 'true';
    const canViewRawPII =
      fullUser?.permissions?.includes('canViewRawPII') ||
      fullUser?.permissions?.includes('audit_access') ||
      false;
    
    if (session && canViewRawPII && new Date() < session.expiresAt) {
      elevatedReview = true;
      reasonCode = session.reasonCode;
    } else if (queryElevated && canViewRawPII) {
      elevatedReview = true;
      reasonCode = String(req.query?.reason || 'Elevated compliance audit review');
    }
  }
  
  return { role, email, id, phone, elevatedReview, reasonCode };
};

// Audit sensitive/raw PII access securely using verified actor and server timestamp
const logRawPIIAccess = async (
  req: Request,
  recordId: string,
  reasonCode: string = 'N/A',
  accessAction: string = 'RAW_PII_ACCESS'
) => {
  const reqUser = (req as any).user;
  const userId = reqUser?.id || 'unknown';
  const role = reqUser?.role || 'Auditor';
  const reqEmail = reqUser?.email || 'authenticated_user';
  const serverTimestamp = new Date().toISOString();

  await db.addAuditLog({
    userEmail: reqEmail,
    role: role,
    action: accessAction,
    details: JSON.stringify({
      actorId: userId,
      actorEmail: reqEmail,
      actorRole: role,
      serverTimestamp,
      recordId,
      reasonCode: reasonCode || 'N/A'
    }),
    ipAddress: req.ip || '127.0.0.1'
  });
};

// Load environmental parameters
dotenv.config();

// Supabase is the only supported authentication path; local JWT_SECRET is retired.
if (process.env.NODE_ENV === 'production' && !supabaseServer && !process.env.SUPABASE_JWT_SECRET?.trim()) {
  throw new Error('Production authentication requires configured Supabase verification.');
}

// Password Complexity Policy Validation
function validatePasswordPolicy(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

// Legacy SHA-256 hash detection
function isLegacyHash(hash: string): boolean {
  if (!hash) return false;
  if (hash.startsWith('sha256_')) return true;
  if (hash.length === 64 && /^[0-9a-fA-F]+$/.test(hash)) return true;
  if (!hash.startsWith('$2')) return true;
  return false;
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001; // Backend listens on platform provided PORT or fallback 3001

// Define standard User Roles
type UserRole = 
  | 'Super Admin' 
  | 'Admin' 
  | 'Document Writer' 
  | 'Lawyer' 
  | 'Broker' 
  | 'Data Entry Operator' 
  | 'Client' 
  | 'Auditor';

// ==========================================
// LAYER 1: RBAC & PERMISSIONS ENGINE
// ==========================================

const VALID_USER_ROLES: UserRole[] = [
  'Super Admin',
  'Admin',
  'Document Writer',
  'Lawyer',
  'Broker',
  'Data Entry Operator',
  'Client',
  'Auditor'
];

const PRIVILEGED_ROLES: UserRole[] = ['Super Admin', 'Admin', 'Auditor'];

interface PermissionRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted';
    permissions: string[];
  };
  verifiedIdentity?: VerifiedIdentity;
}

// Strict Supabase Session Auth Middleware
// - Requires verified Bearer token (401 on missing, malformed, expired, or rejected token)
// - Never falls back to x-user-id, x-user-email, or x-user-role headers
// - Never authorizes using user.user_metadata.role
// - Resolves role and approval status strictly from protected server-controlled records
// - Blocks pending, suspended, and deleted accounts consistently
const authMiddleware = async (req: PermissionRequest, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed Bearer token.' });
  }

  const verified = await verifySupabaseToken(token);
  if (!verified) {
    return res.status(401).json({ error: 'Unauthorized: Invalid, expired, or rejected authentication token.' });
  }

  try {
    const dbUsers = await db.getUsers();
    const matched = dbUsers.find(
      u => u.id === verified.id || u.email.toLowerCase() === verified.email
    );

    if (!matched) {
      return res.status(403).json({
        error: 'Access Denied: User profile is not registered on the server.'
      });
    }

    const accountStatus = normalizeAccountStatus(matched);
    if (accountStatus === 'Pending Approval') {
      return res.status(403).json({
        error: 'Access Denied: Your account is pending administrator approval.'
      });
    }
    if (accountStatus === 'Suspended') {
      return res.status(403).json({
        error: 'Access Denied: Your account is suspended.'
      });
    }
    if (accountStatus === 'Deleted') {
      return res.status(403).json({
        error: 'Access Denied: Your account has been deleted.'
      });
    }

    const resolvedRole: UserRole = VALID_USER_ROLES.includes(matched.role as UserRole)
      ? (matched.role as UserRole)
      : 'Client';

    req.verifiedIdentity = verified;
    req.user = {
      id: matched.id,
      email: matched.email,
      role: resolvedRole,
      status: accountStatus,
      permissions: Array.isArray(matched.permissions) ? matched.permissions : ['view_own_deeds']
    };

    return next();
  } catch (err) {
    console.error('Authentication resolution error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

// Permission checking middleware generator
const requirePermission = (allowedRoles: UserRole[]) => {
  return (req: PermissionRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    if (req.user.status !== 'Approved') {
      return res.status(403).json({ error: `Access Denied: Account status is ${req.user.status}.` });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Role '${req.user.role}' lacks sufficient privileges. Required roles: [${allowedRoles.join(', ')}]` 
      });
    }
    next();
  };
};

// Authoritative Ownership & Assignment Helpers (Stable IDs & Verified Emails Only — Never Display Name)
function isDocumentOwner(doc: DbDocument, user: { id: string; email: string }): boolean {
  const docOwnerId = doc.createdByUserId || doc.state?.createdByUserId;
  if (docOwnerId) {
    return docOwnerId === user.id;
  }
  const docOwnerEmail = (doc.createdByEmail || doc.createdBy || doc.state?.createdByEmail || doc.state?.createdBy || '').toLowerCase();
  return Boolean(docOwnerEmail && user.email && docOwnerEmail === user.email.toLowerCase());
}

function isDocumentAssignedToUser(doc: DbDocument, user: { id: string; email: string }): boolean {
  const assignedIds = [
    doc.assignedToUserId,
    doc.assignedTo,
    doc.state?.assignedToUserId,
    doc.state?.assignedTo,
    doc.state?.brokerUserId,
    doc.state?.brokerId
  ].filter(Boolean);
  return Boolean(user.id && assignedIds.includes(user.id));
}

function isClientOwner(client: DbClient, user: { id: string; email: string }): boolean {
  if (client.createdByUserId) {
    return client.createdByUserId === user.id;
  }
  const clientOwnerEmail = (client.createdByEmail || client.createdBy || '').toLowerCase();
  return Boolean(clientOwnerEmail && user.email && clientOwnerEmail === user.email.toLowerCase());
}

function isClientAssignedToUser(client: DbClient, user: { id: string; email: string }): boolean {
  return Boolean(
    user.id &&
    (client.assignedToUserId === user.id || client.assignedTo === user.id)
  );
}

function canUserAccessDocument(
  doc: DbDocument,
  fullUser: DbUser,
  clients: DbClient[],
  method: string
): boolean {
  const role = fullUser.role as UserRole;
  if (role === 'Super Admin' || role === 'Admin') {
    return true;
  }
  if (role === 'Auditor') {
    return method === 'GET';
  }

  const isOwner = isDocumentOwner(doc, fullUser);
  const isAssigned = isDocumentAssignedToUser(doc, fullUser);

  // DELETE is restricted to the document creator (or Super Admin / Admin handled above)
  if (method === 'DELETE') {
    return isOwner;
  }

  // PUT / PATCH (updates) are restricted to the document creator or explicitly assigned user ID
  if (method === 'PUT' || method === 'PATCH') {
    return isOwner || isAssigned;
  }

  // GET (read / detail / export)
  if (isOwner || isAssigned) {
    return true;
  }

  if (role === 'Broker') {
    const brokerClientIds = new Set(
      clients
        .filter(c => isClientOwner(c, fullUser) || isClientAssignedToUser(c, fullUser))
        .map(c => c.id)
    );
    return Boolean(
      doc.state?.parties?.some((p: any) => p.clientId && brokerClientIds.has(p.clientId))
    );
  }

  if (role === 'Client') {
    return Boolean(
      doc.state?.parties?.some(
        (p: any) =>
          (p.userId && p.userId === fullUser.id) ||
          (p.clientId && p.clientId === fullUser.id)
      )
    );
  }

  return false;
}

function canUserAccessClient(
  client: DbClient,
  fullUser: DbUser,
  docs: DbDocument[],
  method: string
): boolean {
  const role = fullUser.role as UserRole;
  if (role === 'Super Admin' || role === 'Admin') {
    return true;
  }
  if (role === 'Auditor') {
    return method === 'GET';
  }

  const isOwner = isClientOwner(client, fullUser);
  const isAssigned = isClientAssignedToUser(client, fullUser);

  // DELETE is restricted to the client record creator (or Super Admin / Admin)
  if (method === 'DELETE') {
    return isOwner;
  }

  // PUT / PATCH are restricted to the client record creator or explicitly assigned user ID
  if (method === 'PUT' || method === 'PATCH') {
    return isOwner || isAssigned;
  }

  // GET (read / detail)
  if (isOwner || isAssigned) {
    return true;
  }

  if (role === 'Document Writer' || role === 'Lawyer' || role === 'Data Entry Operator') {
    const accessibleDocs = docs.filter(d => isDocumentOwner(d, fullUser) || isDocumentAssignedToUser(d, fullUser));
    return accessibleDocs.some(d =>
      d.state?.parties?.some((p: any) => p.clientId && p.clientId === client.id)
    );
  }

  if (role === 'Client') {
    return client.id === fullUser.id;
  }

  return false;
}

// Optimistic concurrency & storage error helpers
function parseExpectedRevision(req: Request): number | undefined {
  const rawBodyRev =
    req.body?.expectedRevision !== undefined
      ? req.body.expectedRevision
      : req.body?.revision !== undefined
        ? req.body.revision
        : req.body?.state === undefined && req.body?.docNo === undefined
          ? req.body?.version
          : undefined;

  if (rawBodyRev !== undefined && rawBodyRev !== null && rawBodyRev !== '') {
    const num = Number(rawBodyRev);
    if (Number.isInteger(num) && num >= 1) {
      return num;
    }
    throw new ConcurrencyConflictError(`Invalid revision format '${rawBodyRev}'. Expected a positive integer.`);
  }

  const ifMatchHeader = req.headers['if-match'];
  if (typeof ifMatchHeader === 'string' && ifMatchHeader.trim()) {
    const cleaned = ifMatchHeader.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
    const num = Number(cleaned);
    if (Number.isInteger(num) && num >= 1) {
      return num;
    }
    throw new ConcurrencyConflictError(`Invalid If-Match revision header '${ifMatchHeader}'.`);
  }

  return undefined;
}

function handleStorageError(res: Response, err: any, fallbackMessage: string, userContext?: any): Response {
  if (err instanceof ConcurrencyConflictError) {
    const serializedCurrent =
      err.currentRecord && userContext && err.currentRecord.docNo
        ? serializeDocument(err.currentRecord, userContext)
        : err.currentRecord;
    return res.status(409).json({
      error: err.message,
      code: 'VERSION_CONFLICT',
      currentRevision: err.currentRevision ?? err.currentRecord?.revision,
      ...(serializedCurrent ? { currentDocument: serializedCurrent } : {})
    });
  }
  if (err instanceof FinalizedRecordLockedError) {
    return res.status(409).json({
      error: err.message,
      code: 'FINALIZED_RECORD_LOCKED'
    });
  }
  if (err instanceof DuplicateRecordError) {
    return res.status(409).json({ error: err.message, code: 'DUPLICATE_RECORD' });
  }
  if (err instanceof RecordNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof PersistenceError) {
    return res.status(500).json({ error: err.message });
  }
  if (typeof err?.message === 'string' && err.message.startsWith('REGISTRY LOCK:')) {
    return res.status(409).json({ error: err.message, code: 'FINALIZED_RECORD_LOCKED' });
  }
  return res.status(500).json({ error: err?.message || fallbackMessage });
}

// Resource Ownership Verification Middleware
const requireResourceAccess = (resourceType: 'documents' | 'clients' | 'audits') => {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      }

      // 1. Fetch full user from database using verified identity
      const fullUser =
        (req.user.id ? await db.getUserById(req.user.id) : null) ||
        (req.user.email ? await db.getUserByEmail(req.user.email) : null);
      if (!fullUser) {
        return res.status(403).json({ error: 'Access Denied: User profile not found.' });
      }

      const accountStatus = normalizeAccountStatus(fullUser);
      if (accountStatus !== 'Approved') {
        return res.status(403).json({ error: `Access Denied: Account status is ${accountStatus}.` });
      }

      const role = fullUser.role as UserRole;
      const method = req.method.toUpperCase();

      // Super Admin and Admin have full access to everything
      if (role === 'Super Admin' || role === 'Admin') {
        return next();
      }

      // Auditor has read-only access (GET requests only)
      if (role === 'Auditor') {
        if (method === 'GET') {
          return next();
        } else {
          return res.status(403).json({ error: 'Access Denied: Auditors have read-only access.' });
        }
      }

      // 2. Fetch the resource ID from request params
      const resourceId = req.params.id;

      if (resourceType === 'audits') {
        if (method === 'GET') {
          return res.status(403).json({ error: 'Access Denied: Lacks privilege to view audits.' });
        }
        return next();
      }

      if (resourceType === 'documents') {
        if (!resourceId) {
          return next();
        }

        const doc = await db.getDocumentById(resourceId);
        if (!doc) {
          return res.status(403).json({ error: 'Access Denied: Resource not accessible or not found.' });
        }

        const clients = role === 'Broker' ? await db.getClients() : [];
        if (!canUserAccessDocument(doc, fullUser, clients, method)) {
          await db.addAuditLog({
            userEmail: fullUser.email,
            role: fullUser.role,
            action: 'UNAUTHORIZED_DOCUMENT_ACCESS_BLOCKED',
            details: `Blocked ${method} on document ${resourceId} by user ${fullUser.id}`,
            ipAddress: req.ip || '127.0.0.1'
          });
          return res.status(403).json({ error: 'Access Denied: You do not own or have assignment to this document.' });
        }

        return next();
      }

      if (resourceType === 'clients') {
        if (!resourceId) {
          return next();
        }

        const client = await db.getClientById(resourceId);
        if (!client) {
          return res.status(403).json({ error: 'Access Denied: Resource not accessible or not found.' });
        }

        const docs = (role === 'Document Writer' || role === 'Lawyer' || role === 'Data Entry Operator')
          ? await db.getDocuments()
          : [];

        if (!canUserAccessClient(client, fullUser, docs, method)) {
          await db.addAuditLog({
            userEmail: fullUser.email,
            role: fullUser.role,
            action: 'UNAUTHORIZED_CLIENT_ACCESS_BLOCKED',
            details: `Blocked ${method} on client ${resourceId} by user ${fullUser.id}`,
            ipAddress: req.ip || '127.0.0.1'
          });
          return res.status(403).json({ error: 'Access Denied: You do not own or have assignment to this client record.' });
        }

        return next();
      }

      return next();
    } catch (error) {
      console.error('Resource access validation error:', error);
      return res.status(403).json({ error: 'Access Denied: Authorization validation failed.' });
    }
  };
};

// ==========================================
// LAYER 4 & 5: REST API ENDPOINTS
// ==========================================

// --- REAL HEALTH & READINESS CHECK ---
const healthHandler = async (_req: express.Request, res: express.Response) => {
  try {
    const storageInfo = db.getStorageInfo ? db.getStorageInfo() : { isPostgres: false, engine: 'local_json' };
    let dbHealthy = true;
    let dbErrorDetails = '';
    try {
      await db.getUsers();
    } catch (err: any) {
      dbHealthy = false;
      dbErrorDetails = err?.message || String(err);
    }

    const piiConfigured = Boolean(
      process.env.PII_ENCRYPTION_KEY &&
      process.env.PII_ENCRYPTION_KEY.trim().length >= 32
    );

    const isHealthy = dbHealthy;
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json({
      status: isHealthy ? 'online' : 'degraded',
      service: 'UNIKORN360 DEEDOS CORE ENGINE',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        healthy: dbHealthy,
        engine: storageInfo.engine,
        error: dbErrorDetails || undefined
      },
      piiEncryptionKeyConfigured: piiConfigured,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'offline',
      service: 'UNIKORN360 DEEDOS CORE ENGINE',
      error: err?.message || String(err)
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// --- AUTHENTICATION ROUTER ---
// Legacy direct password login and open registration paths are safely disabled.
// All authentication is enforced through verified Supabase sessions.
app.post('/api/auth/login', (_req, res) => {
  return res.status(410).json({
    error: 'Legacy password login is disabled. Authenticate via a verified Supabase session.'
  });
});

app.post('/api/auth/register', (_req, res) => {
  return res.status(410).json({
    error: 'Legacy direct registration is disabled. Authenticate via a verified Supabase session.'
  });
});

app.get('/api/auth/me', authMiddleware, async (req: PermissionRequest, res) => {
  const matched =
    (req.user?.id ? await db.getUserById(req.user.id) : null) ||
    (req.user?.email ? await db.getUserByEmail(req.user.email) : null);
  if (!matched) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  return res.json({ user: toSafeUser(matched) });
});

app.get('/api/auth/users', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (_req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users.map(toSafeUser));
  } catch (err) {
    return handleStorageError(res, err, 'Failed to load users.');
  }
});

app.put('/api/auth/users/:id/role', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (req: PermissionRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const expectedRevision = parseExpectedRevision(req);

    if (!role || !VALID_USER_ROLES.includes(role as UserRole)) {
      return res.status(400).json({ error: `Invalid role specified. Allowed roles: ${VALID_USER_ROLES.join(', ')}` });
    }

    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Restrict privileged role assignment and modification of privileged users strictly to Super Admin
    if (PRIVILEGED_ROLES.includes(role as UserRole) || PRIVILEGED_ROLES.includes(targetUser.role as UserRole)) {
      if (req.user?.role !== 'Super Admin') {
        return res.status(403).json({ error: 'Only an authenticated Super Admin can assign or modify privileged roles (Auditor, Admin, Super Admin).' });
      }
    }

    const oldRole = targetUser.role;
    const newPermissions =
      role === 'Super Admin' ? ['*'] :
      role === 'Admin' ? ['manage_users', 'view_all_deeds', 'audit_logs'] :
      role === 'Auditor' ? ['audit_logs', 'view_all_deeds', 'canViewRawPII'] :
      ['view_own_deeds'];

    const updatedUser = await db.updateUser(
      id,
      existing => ({
        ...existing,
        role,
        permissions: newPermissions
      }),
      expectedRevision
    );

    if (PRIVILEGED_ROLES.includes(role as UserRole)) {
      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Super Admin',
        action: 'ROLE_CREATED',
        details: `ROLE_CREATED: Creator User ID: ${req.user?.id || 'unknown'}, Timestamp: ${new Date().toISOString()}, Target Email: ${updatedUser.email}, New Role: ${role}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } else {
      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Admin',
        action: 'ROLE_CHANGE',
        details: `Changed role from ${oldRole} to ${role} for user ${updatedUser.email}`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    res.json({ message: 'User role updated successfully.', user: toSafeUser(updatedUser) });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to update user role.');
  }
});

app.post('/api/auth/users/privileged', authMiddleware, requirePermission(['Super Admin']), async (req: PermissionRequest, res) => {
  try {
    const { name, email, phone, organization, role, password, passwordPlain } = req.body;
    const rawPassword = password || passwordPlain;

    if (!email || !role || !rawPassword) {
      return res.status(400).json({ error: 'Name, Email, Role, and Password are required.' });
    }

    if (!PRIVILEGED_ROLES.includes(role as UserRole)) {
      return res.status(400).json({ error: 'This route is only for creating privileged roles (Auditor, Admin, Super Admin).' });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email address already registered under another account.' });
    }

    if (!validatePasswordPolicy(rawPassword)) {
      return res.status(400).json({ 
        error: 'Password does not meet validation criteria. It must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    const finalHash = bcrypt.hashSync(rawPassword, rounds);

    const newUser: DbUser = {
      id: generateRecordUuid(),
      name: name || email.split('@')[0],
      email,
      phone: phone || '',
      organization: organization || 'TN Registration Department',
      role,
      permissions: role === 'Super Admin' ? ['*'] : role === 'Auditor' ? ['audit_logs', 'view_all_deeds', 'canViewRawPII'] : ['manage_users', 'view_all_deeds', 'audit_logs'],
      status: 'Approved',
      passwordHash: finalHash,
      createdAt: new Date().toISOString(),
      revision: 1
    };

    const createdUser = await db.createUser(newUser);

    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Super Admin',
      action: 'ROLE_CREATED',
      details: `ROLE_CREATED: Creator User ID: ${req.user?.id || 'unknown'}, Timestamp: ${new Date().toISOString()}, Target Email: ${email}, New Role: ${role}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({ message: 'Privileged user created successfully!', user: toSafeUser(createdUser) });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to create privileged user.');
  }
});

app.put('/api/auth/users/:id/status', authMiddleware, requirePermission(['Super Admin', 'Admin']), async (req: PermissionRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const expectedRevision = parseExpectedRevision(req);

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'Valid status is required.' });
    }

    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (PRIVILEGED_ROLES.includes(targetUser.role as UserRole) && req.user?.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Only an authenticated Super Admin can modify status of privileged accounts.' });
    }

    const canonicalStatus = normalizeAccountStatus(status);
    const oldStatus = targetUser.status;
    const updatedUser = await db.updateUser(
      id,
      existing => ({
        ...existing,
        status: canonicalStatus,
        deleted: canonicalStatus === 'Deleted',
        isDeleted: canonicalStatus === 'Deleted'
      }),
      expectedRevision
    );

    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Admin',
      action: 'STATUS_CHANGE',
      details: `Changed status from ${oldStatus} to ${canonicalStatus} for user ${updatedUser.email}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: 'User status updated successfully.', user: toSafeUser(updatedUser) });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to update user status.');
  }
});

// --- AUTH PROFILE SYNC ---
// Protected by verified Supabase token.
// Binds profile ID and email strictly to verified identity.
// Prevents changing role, permissions, approval status, or ownership via profile sync.
app.post('/api/auth/sync-profile', async (req: PermissionRequest, res) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing or malformed Bearer token.' });
    }

    const verified = await verifySupabaseToken(token);
    if (!verified) {
      return res.status(401).json({ error: 'Unauthorized: Invalid, expired, or rejected authentication token.' });
    }

    const { id, email, full_name, name, phone, organization, role, permissions, status, owner, createdBy, createdByUserId } = req.body || {};

    // Bind profile ID and email strictly to the verified token identity
    if (id !== undefined && String(id) !== verified.id) {
      return res.status(403).json({
        error: 'Forbidden: Profile ID must match the verified session identity.'
      });
    }

    if (email !== undefined && String(email).trim().toLowerCase() !== verified.email) {
      return res.status(403).json({
        error: 'Forbidden: Profile email must match the verified session identity.'
      });
    }

    const existingUser = (await db.getUserById(verified.id)) || (await db.getUserByEmail(verified.email));
    const isSuperAdminAllowlisted = SUPER_ADMIN_EMAILS.includes(verified.email);

    const authoritativeRole: UserRole = existingUser
      ? (VALID_USER_ROLES.includes(existingUser.role as UserRole) ? (existingUser.role as UserRole) : 'Client')
      : (isSuperAdminAllowlisted ? 'Super Admin' : 'Client');

    const authoritativeStatus = existingUser
      ? normalizeAccountStatus(existingUser)
      : (isSuperAdminAllowlisted ? 'Approved' : 'Pending Approval');

    const authoritativePermissions = existingUser && Array.isArray(existingUser.permissions)
      ? existingUser.permissions
      : (authoritativeRole === 'Super Admin' ? ['*'] : ['view_own_deeds']);

    // Reject attempted self-promotion or tampering with role, permissions, approval status, or ownership
    if (role !== undefined && role !== authoritativeRole) {
      await db.addAuditLog({
        userEmail: verified.rawEmail,
        role: authoritativeRole,
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        details: `Blocked attempt to set role '${role}' via /api/auth/sync-profile (authoritative role: '${authoritativeRole}')`,
        ipAddress: req.ip || '127.0.0.1'
      });
      return res.status(403).json({
        error: 'Forbidden: Profile synchronization cannot set or modify role.'
      });
    }

    if (permissions !== undefined) {
      await db.addAuditLog({
        userEmail: verified.rawEmail,
        role: authoritativeRole,
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        details: 'Blocked attempt to set permissions via /api/auth/sync-profile',
        ipAddress: req.ip || '127.0.0.1'
      });
      return res.status(403).json({
        error: 'Forbidden: Profile synchronization cannot set or modify permissions.'
      });
    }

    if (status !== undefined && normalizeAccountStatus(String(status)) !== authoritativeStatus) {
      await db.addAuditLog({
        userEmail: verified.rawEmail,
        role: authoritativeRole,
        action: 'STATUS_TAMPER_BLOCKED',
        details: `Blocked attempt to change status to '${status}' via /api/auth/sync-profile (authoritative status: '${authoritativeStatus}')`,
        ipAddress: req.ip || '127.0.0.1'
      });
      return res.status(403).json({
        error: 'Forbidden: Profile synchronization cannot set or modify approval status.'
      });
    }

    if (owner !== undefined || createdBy !== undefined || createdByUserId !== undefined) {
      return res.status(403).json({
        error: 'Forbidden: Profile synchronization cannot modify ownership fields.'
      });
    }

    // Block suspended and deleted accounts consistently
    if (authoritativeStatus === 'Suspended') {
      return res.status(403).json({ error: 'Access Denied: Your account is suspended.' });
    }
    if (authoritativeStatus === 'Deleted') {
      return res.status(403).json({ error: 'Access Denied: Your account has been deleted.' });
    }

    const resolvedName =
      (typeof full_name === 'string' && full_name.trim()) ||
      (typeof name === 'string' && name.trim()) ||
      existingUser?.name ||
      verified.name ||
      verified.rawEmail.split('@')[0];

    const resolvedOrg =
      (typeof organization === 'string' && organization.trim()) ||
      existingUser?.organization ||
      'Independent Workspace';

    const resolvedPhone =
      typeof phone === 'string' ? phone.trim() : (existingUser?.phone || '');

    let savedUser: DbUser;
    if (existingUser) {
      savedUser = await db.updateUser(existingUser.id, current => ({
        ...current,
        name: resolvedName,
        email: current.email || verified.rawEmail,
        phone: resolvedPhone,
        organization: resolvedOrg,
        role: authoritativeRole,
        permissions: authoritativePermissions,
        status: authoritativeStatus
      }));
    } else {
      savedUser = await db.createUser({
        id: verified.id,
        name: resolvedName,
        email: verified.rawEmail,
        phone: resolvedPhone,
        organization: resolvedOrg,
        role: authoritativeRole,
        permissions: authoritativePermissions,
        status: authoritativeStatus,
        passwordHash: '',
        createdAt: new Date().toISOString()
      });
    }

    res.json({
      message: 'Profile synced successfully.',
      user: toSafeUser(savedUser)
    });
  } catch (err: any) {
    console.error('Error syncing profile:', err);
    return handleStorageError(res, err, 'Failed to sync profile.');
  }
});

// --- AUDIT LOG ACTION ---
app.post('/api/audit/log-action', authMiddleware, async (req: PermissionRequest, res) => {
  try {
    const { action, target_user_id, timestamp, metadata } = req.body;
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'Action is required.' });
    }

    await db.addAuditLog({
      userEmail: req.user!.email,
      role: req.user!.role,
      action: action,
      details: JSON.stringify({
        actor_id: req.user!.id,
        actor_email: req.user!.email,
        target_user_id,
        timestamp: timestamp || new Date().toISOString(),
        ...(metadata && typeof metadata === 'object' ? metadata : {})
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: 'Audit log recorded.' });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to record audit log.');
  }
});

// --- CLIENTS ROUTER ---
const handleListClients = async (req: PermissionRequest, res: Response) => {
  try {
    const clients = await db.getClients();
    const fullUser =
      (req.user?.id ? await db.getUserById(req.user.id) : null) ||
      (req.user?.email ? await db.getUserByEmail(req.user.email) : null);

    if (!fullUser) {
      return res.status(403).json({ error: 'Access Denied: User profile not found.' });
    }

    const role = fullUser.role as UserRole;
    const docs = (role === 'Document Writer' || role === 'Lawyer' || role === 'Data Entry Operator')
      ? await db.getDocuments()
      : [];

    let filteredClients = clients.filter(c => canUserAccessClient(c, fullUser, docs, 'GET'));

    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (q) {
      filteredClients = filteredClients.filter(
        c =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q)
      );
    }

    const userContext = await buildUserContext(req);
    const serializedClients = filteredClients.map(c => serializeClient(c, userContext));

    if (userContext.role === 'Auditor' && userContext.elevatedReview) {
      for (const c of filteredClients) {
        await logRawPIIAccess(req, c.id, userContext.reasonCode || 'N/A');
      }
    }

    res.json({
      message: 'Clients retrieved successfully',
      clients: serializedClients
    });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to list clients.');
  }
};

app.get(
  ['/api/clients', '/api/clients/search'],
  authMiddleware,
  requirePermission(['Super Admin', 'Admin', 'Auditor', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Broker', 'Client']),
  handleListClients
);

app.post(
  '/api/clients',
  authMiddleware,
  requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Broker', 'Client']),
  async (req: PermissionRequest, res) => {
    try {
      const newClientData = req.body || {};
      const requestedId = typeof newClientData.id === 'string' && newClientData.id.trim()
        ? newClientData.id.trim()
        : generateRecordUuid();

      // POST /api/clients is create-only: reject existing client ID
      const existingById = await db.getClientById(requestedId);
      if (existingById) {
        return res.status(409).json({
          error: 'Conflict: A client with this ID already exists. POST /api/clients is create-only; use PUT /api/clients/:id to update.'
        });
      }

      const creatorUserId = req.user!.id;
      const creatorEmail = req.user!.email;

      // Scope duplicate PAN/Aadhaar check to the caller's own client records
      const newPanHash = getDeterministicHash(newClientData.pan || '');
      const newAadhaarHash = getDeterministicHash(newClientData.aadhaar || '');

      if (newPanHash || newAadhaarHash) {
        const clients = await db.getClients();
        const ownClients = clients.filter(c => isClientOwner(c, { id: creatorUserId, email: creatorEmail }));
        const isDuplicate = ownClients.some(c => {
          const cPanHash = c.panHash || getDeterministicHash(c.pan);
          const cAadhaarHash = c.aadhaarHash || getDeterministicHash(c.aadhaar);
          return (newPanHash && cPanHash === newPanHash) || (newAadhaarHash && cAadhaarHash === newAadhaarHash);
        });

        if (isDuplicate) {
          return res.status(400).json({
            error: 'Duplicate client profile detected in your workspace. A client with this Aadhaar or PAN already exists.'
          });
        }
      }

      const assignedToUserId =
        typeof newClientData.assignedToUserId === 'string' && newClientData.assignedToUserId.trim()
          ? newClientData.assignedToUserId.trim()
          : undefined;
      const assignedTo =
        typeof newClientData.assignedTo === 'string' && newClientData.assignedTo.trim()
          ? newClientData.assignedTo.trim()
          : assignedToUserId;

      const createdClient = await db.createClient({
        id: requestedId,
        name: newClientData.name || '',
        fatherName: newClientData.fatherName || '',
        dob: newClientData.dob || '',
        age: Number(newClientData.age) || 0,
        occupation: newClientData.occupation || '',
        pan: newClientData.pan || '',
        aadhaar: newClientData.aadhaar || '',
        panHash: newPanHash || undefined,
        aadhaarHash: newAadhaarHash || undefined,
        address: newClientData.address || '',
        phone: newClientData.phone || '',
        email: newClientData.email || '',
        createdAt: new Date().toISOString(),
        createdBy: creatorEmail,
        createdByUserId: creatorUserId,
        createdByEmail: creatorEmail,
        assignedToUserId,
        assignedTo
      });

      await db.addAuditLog({
        userEmail: creatorEmail,
        role: req.user!.role,
        action: 'CREATE_CLIENT',
        details: `Client profile created for ${createdClient.name} (${createdClient.phone}) by ${creatorUserId}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      const userContext = await buildUserContext(req);
      const serializedClient = serializeClient(createdClient, userContext);

      res.status(201).json({
        message: 'Client profile persisted to database successfully.',
        client: serializedClient
      });
    } catch (err) {
      return handleStorageError(res, err, 'Failed to create client.');
    }
  }
);

// GET /api/clients/:id
app.get('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), async (req, res) => {
  try {
    const { id } = req.params;
    const client = await db.getClientById(id);
    if (!client) {
      return res.status(403).json({ error: 'Access Denied: Client not found.' });
    }

    const userContext = await buildUserContext(req);
    const serializedClient = serializeClient(client, userContext);

    if (userContext.role === 'Auditor' && userContext.elevatedReview) {
      await logRawPIIAccess(req, client.id, userContext.reasonCode || 'N/A');
    }

    res.json({
      message: 'Client retrieved successfully',
      client: serializedClient
    });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to retrieve client.');
  }
});

// PUT & PATCH /api/clients/:id
const handleUpdateClient = async (req: PermissionRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updatedData = req.body || {};
    const expectedRevision = parseExpectedRevision(req);

    const existingClient = await db.getClientById(id);
    if (!existingClient) {
      return res.status(403).json({ error: 'Access Denied: Client not found.' });
    }

    const isAdminCaller = req.user?.role === 'Super Admin' || req.user?.role === 'Admin';
    const isCreator = isClientOwner(existingClient, req.user!);

    if (!isAdminCaller) {
      if (
        (updatedData.createdByUserId !== undefined && updatedData.createdByUserId !== existingClient.createdByUserId) ||
        (updatedData.createdByEmail !== undefined &&
          String(updatedData.createdByEmail).toLowerCase() !== (existingClient.createdByEmail || existingClient.createdBy || '').toLowerCase()) ||
        (updatedData.createdBy !== undefined &&
          String(updatedData.createdBy).toLowerCase() !== (existingClient.createdBy || existingClient.createdByEmail || '').toLowerCase())
      ) {
        return res.status(403).json({ error: 'Forbidden: Cannot change client record ownership.' });
      }
    }

    const newPan = updatedData.pan ?? existingClient.pan;
    const newAadhaar = updatedData.aadhaar ?? existingClient.aadhaar;
    const newPanHash = getDeterministicHash(newPan);
    const newAadhaarHash = getDeterministicHash(newAadhaar);

    if (newPanHash || newAadhaarHash) {
      const clients = await db.getClients();
      const ownerId = existingClient.createdByUserId || req.user!.id;
      const ownerEmail = existingClient.createdByEmail || existingClient.createdBy || req.user!.email;
      const sameWorkspaceClients = clients.filter(
        c => c.id !== id && isClientOwner(c, { id: ownerId, email: ownerEmail })
      );
      const isDuplicate = sameWorkspaceClients.some(c => {
        const cPanHash = c.panHash || getDeterministicHash(c.pan);
        const cAadhaarHash = c.aadhaarHash || getDeterministicHash(c.aadhaar);
        return (newPanHash && cPanHash === newPanHash) || (newAadhaarHash && cAadhaarHash === newAadhaarHash);
      });

      if (isDuplicate) {
        return res.status(400).json({
          error: 'Duplicate client profile detected in workspace. A client with this Aadhaar or PAN already exists.'
        });
      }
    }

    const canChangeAssignment = isAdminCaller || isCreator;

    const updatedClient = await db.updateClient(
      id,
      current => {
        const resolvedAssignedToUserId = canChangeAssignment
          ? (updatedData.assignedToUserId ?? current.assignedToUserId)
          : current.assignedToUserId;
        const resolvedAssignedTo = canChangeAssignment
          ? (updatedData.assignedTo ?? resolvedAssignedToUserId ?? current.assignedTo)
          : current.assignedTo;

        return {
          ...current,
          id: current.id,
          name: updatedData.name ?? current.name,
          fatherName: updatedData.fatherName ?? current.fatherName,
          dob: updatedData.dob ?? current.dob,
          age: updatedData.age !== undefined ? Number(updatedData.age) : current.age,
          occupation: updatedData.occupation ?? current.occupation,
          pan: newPan,
          aadhaar: newAadhaar,
          panHash: newPanHash || current.panHash,
          aadhaarHash: newAadhaarHash || current.aadhaarHash,
          address: updatedData.address ?? current.address,
          phone: updatedData.phone ?? current.phone,
          email: updatedData.email ?? current.email,
          createdAt: current.createdAt,
          createdBy: current.createdBy || current.createdByEmail || req.user!.email,
          createdByUserId: current.createdByUserId || req.user!.id,
          createdByEmail: current.createdByEmail || current.createdBy || req.user!.email,
          assignedToUserId: resolvedAssignedToUserId,
          assignedTo: resolvedAssignedTo
        };
      },
      expectedRevision
    );

    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Client',
      action: 'UPDATE_CLIENT',
      details: `Updated client profile: ${updatedClient.name} (${updatedClient.id}) [rev ${updatedClient.revision}]`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const userContext = await buildUserContext(req);
    const serializedClient = serializeClient(updatedClient, userContext);

    res.json({
      message: 'Client updated successfully',
      client: serializedClient
    });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to update client.');
  }
};

app.put('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), handleUpdateClient);
app.patch('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), handleUpdateClient);

app.delete('/api/clients/:id', authMiddleware, requireResourceAccess('clients'), async (req: PermissionRequest, res) => {
  try {
    const { id } = req.params;
    const expectedRevision = parseExpectedRevision(req);
    const deletedClient = await db.deleteClient(id, expectedRevision);

    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Document Writer',
      action: 'DELETE_CLIENT',
      details: `Deleted client profile: ${deletedClient.name} (${deletedClient.id})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: 'Client deleted successfully.' });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to delete client.');
  }
});

// --- DOCUMENTS ROUTER ---
const handleListDocuments = async (req: PermissionRequest, res: Response) => {
  try {
    const docs = await db.getDocuments();
    const fullUser =
      (req.user?.id ? await db.getUserById(req.user.id) : null) ||
      (req.user?.email ? await db.getUserByEmail(req.user.email) : null);

    if (!fullUser) {
      return res.status(403).json({ error: 'Access Denied: User profile not found.' });
    }

    const role = fullUser.role as UserRole;
    const clients = role === 'Broker' ? await db.getClients() : [];

    let filteredDocs = docs.filter(d => canUserAccessDocument(d, fullUser, clients, 'GET'));

    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    if (statusFilter && statusFilter !== 'All') {
      filteredDocs = filteredDocs.filter(d => d.status === statusFilter);
    }
    if (q) {
      filteredDocs = filteredDocs.filter(d => matchesDocumentSearch(d, q));
    }

    const userContext = await buildUserContext(req);
    const serializedDocs = filteredDocs.map(d => serializeDocument(d, userContext));

    if (userContext.role === 'Auditor' && userContext.elevatedReview) {
      const allClients = await db.getClients();
      for (const doc of filteredDocs) {
        if (doc.state && Array.isArray(doc.state.parties)) {
          for (const p of doc.state.parties) {
            const matchedClient = allClients.find(
              c =>
                (p.id && c.id === p.id) ||
                (p.aadhaar && c.aadhaar === p.aadhaar) ||
                (p.pan && c.pan === p.pan) ||
                (p.email && c.email?.toLowerCase() === p.email?.toLowerCase())
            );
            if (matchedClient) {
              await logRawPIIAccess(req, matchedClient.id, userContext.reasonCode || 'N/A');
            } else {
              await logRawPIIAccess(req, p.id || 'unknown', userContext.reasonCode || 'N/A');
            }
          }
        }
      }
    }

    res.json(serializedDocs);
  } catch (err) {
    return handleStorageError(res, err, 'Failed to list documents.');
  }
};

app.get(['/api/documents', '/api/documents/search'], authMiddleware, handleListDocuments);

app.get('/api/documents/:id', authMiddleware, requireResourceAccess('documents'), async (req, res) => {
  try {
    const doc = await db.getDocumentById(req.params.id);
    if (!doc) {
      return res.status(403).json({ error: 'Access Denied: Document not accessible or not found.' });
    }

    const userContext = await buildUserContext(req);
    const serializedDoc = serializeDocument(doc, userContext);

    if (userContext.role === 'Auditor' && userContext.elevatedReview) {
      const clients = await db.getClients();
      if (doc.state && Array.isArray(doc.state.parties)) {
        for (const p of doc.state.parties) {
          const matchedClient = clients.find(
            c =>
              (p.id && c.id === p.id) ||
              (p.aadhaar && c.aadhaar === p.aadhaar) ||
              (p.pan && c.pan === p.pan) ||
              (p.email && c.email?.toLowerCase() === p.email?.toLowerCase())
          );
          if (matchedClient) {
            await logRawPIIAccess(req, matchedClient.id, userContext.reasonCode || 'N/A');
          } else {
            await logRawPIIAccess(req, p.id || 'unknown', userContext.reasonCode || 'N/A');
          }
        }
      }
    }

    res.json({
      message: 'Document retrieved successfully',
      document: serializedDoc
    });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to retrieve document.');
  }
});

app.get('/api/documents/:id/export', authMiddleware, requireResourceAccess('documents'), async (req: PermissionRequest, res: Response) => {
  try {
    const doc = await db.getDocumentById(req.params.id);
    if (!doc) {
      return res.status(403).json({ error: 'Access Denied: Document not accessible or not found.' });
    }

    const rawDeedType = doc.state?.documentType || doc.docType;
    if (!isDeedTemplateAvailable(rawDeedType)) {
      return res.status(400).json({
        error: `Template unavailable for document type "${rawDeedType || 'Unknown'}". Generation and export are blocked.`,
        code: 'TEMPLATE_UNAVAILABLE'
      });
    }

    const userContext = await buildUserContext(req);
    const serializedDoc = serializeDocument(doc, userContext);
    const canonicalCode = normalizeDeedCode(rawDeedType)!;
    const rawStateObj = serializedDoc.state && typeof serializedDoc.state === 'object' ? serializedDoc.state : {};
    const compilableState = {
      ...rawStateObj,
      documentType: canonicalCode,
      documentSubtype: rawStateObj.documentSubtype || doc.subType || '',
      parties: Array.isArray(rawStateObj.parties) ? rawStateObj.parties : [],
      property: {
        district: '',
        registrationDistrict: '',
        taluk: '',
        village: '',
        ward: '',
        block: '',
        propertyType: 'Plot',
        sro: '',
        ...(rawStateObj.property || {})
      },
      survey: {
        surveyNo: '',
        subDivision: '',
        pattaNo: '',
        tslrNo: '',
        ...(rawStateObj.survey || {})
      },
      extent: {
        sqft: 0,
        acre: 0,
        cent: 0,
        hectare: 0,
        areaUnit: 'Sq.ft',
        eastWest: '',
        northSouth: '',
        totalExtent: 0,
        ...(rawStateObj.extent || {})
      },
      boundary: {
        north: '',
        south: '',
        east: '',
        west: '',
        ...(rawStateObj.boundary || {})
      },
      ownershipHistory: {
        parentDocType: 'Parent Deed',
        parentDocNo: '',
        parentDocYear: '',
        parentDocSRO: '',
        parentDocDate: '',
        priorOwners: '',
        historyNarrative: '',
        ...(rawStateObj.ownershipHistory || {})
      },
      transaction: {
        guidelineValue: 0,
        marketValue: doc.consideration || 0,
        considerationAmount: doc.consideration || 0,
        advancePaid: 0,
        balancePaid: 0,
        paymentMode: 'NEFT/RTGS',
        paymentDate: '',
        bankName: '',
        paymentRefNo: '',
        ...(rawStateObj.transaction || {})
      },
      witnesses:
        Array.isArray(rawStateObj.witnesses) && rawStateObj.witnesses.length >= 2
          ? rawStateObj.witnesses
          : [
              { id: 'w-1', name: '', fatherName: '', age: 30, address: '', aadhaar: '', phone: '' },
              { id: 'w-2', name: '', fatherName: '', age: 30, address: '', aadhaar: '', phone: '' }
            ],
      selectedClauses: Array.isArray(rawStateObj.selectedClauses) ? rawStateObj.selectedClauses : []
    };
    const compiledDeed = compileDeedDocument(compilableState as any, doc.docNo);

    await db.addAuditLog({
      userEmail: req.user?.email || 'System',
      role: req.user?.role || 'Document Writer',
      action: 'EXPORT_DOCUMENT',
      details: `Exported document ${doc.docNo} (${doc.id}) [${canonicalCode}]`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      message: 'Document export authorized.',
      canonicalDeedCode: canonicalCode,
      document: serializedDoc,
      compiledDeed,
      compiledSections: compiledDeed?.sections || [],
      exportedAt: new Date().toISOString()
    });
  } catch (err) {
    return handleStorageError(res, err, 'Failed to export document.');
  }
});

// POST /api/documents — Strictly Create-Only (Rejects any existing document ID or duplicate docNo)
app.post(
  '/api/documents',
  authMiddleware,
  requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Client', 'Broker']),
  async (req: PermissionRequest, res) => {
    try {
      const newDraftData = req.body || {};

      const rawDeedType = newDraftData.state?.documentType || newDraftData.docType || 'SALE';
      if (!isDeedTemplateAvailable(rawDeedType)) {
        return res.status(400).json({
          error: `Template unavailable for document type "${rawDeedType}". Generation and export are blocked.`,
          code: 'TEMPLATE_UNAVAILABLE'
        });
      }
      const canonicalCode = normalizeDeedCode(rawDeedType)!;

      const targetStatus = newDraftData.status || 'Draft';
      const statusCheck = validateStatusTransition(undefined, targetStatus);
      if (!statusCheck.valid) {
        return res.status(400).json({
          error: statusCheck.error,
          code: statusCheck.code || 'INVALID_STATUS_TRANSITION'
        });
      }

      const serverValidation = validateDeedRecordForServer(
        { ...newDraftData, docType: canonicalCode, state: newDraftData.state },
        targetStatus
      );
      if (!serverValidation.valid) {
        return res.status(400).json({
          error: serverValidation.errors.join(' '),
          errors: serverValidation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const targetId =
        typeof newDraftData.id === 'string' && newDraftData.id.trim()
          ? newDraftData.id.trim()
          : generateRecordUuid();

      const existingDoc = await db.getDocumentById(targetId);
      if (existingDoc) {
        await db.addAuditLog({
          userEmail: req.user!.email,
          role: req.user!.role,
          action: 'DOCUMENT_CREATE_REJECTED_EXISTING_ID',
          details: `Rejected POST /api/documents with existing ID ${targetId} by user ${req.user!.id}`,
          ipAddress: req.ip || '127.0.0.1'
        });
        return res.status(409).json({
          error: 'Conflict: A document with this ID already exists. POST /api/documents is create-only; use PUT /api/documents/:id to update an existing document.'
        });
      }

      // Bind document ownership strictly to verified server identity
      const creatorUserId = req.user!.id;
      const creatorEmail = req.user!.email;
      const assignedToUserId =
        typeof newDraftData.assignedToUserId === 'string' && newDraftData.assignedToUserId.trim()
          ? newDraftData.assignedToUserId.trim()
          : undefined;
      const assignedTo =
        typeof newDraftData.assignedTo === 'string' && newDraftData.assignedTo.trim()
          ? newDraftData.assignedTo.trim()
          : assignedToUserId;

      const rawState = newDraftData.state && typeof newDraftData.state === 'object' ? newDraftData.state : {};
      const boundState = {
        ...rawState,
        documentType: canonicalCode,
        version: 1,
        revisionHistory: Array.isArray(rawState.revisionHistory) ? rawState.revisionHistory : [],
        createdByUserId: creatorUserId,
        createdByEmail: creatorEmail,
        createdBy: creatorEmail,
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(assignedTo ? { assignedTo } : {})
      };

      const requestedDocNo =
        typeof newDraftData.docNo === 'string' && newDraftData.docNo.trim()
          ? newDraftData.docNo.trim()
          : '';

      const createdDraft = await db.createDocument({
        id: targetId,
        docNo: requestedDocNo,
        docType: getDeedDisplayName(canonicalCode),
        subType: newDraftData.subType || 'Sale in Metro Area',
        partiesCount: newDraftData.partiesCount || 2,
        propertyAddress: newDraftData.propertyAddress || 'No Address Specified Yet',
        consideration: newDraftData.consideration || 0,
        status: targetStatus,
        writer: newDraftData.writer || `Drafted by ${creatorEmail}`,
        progress: newDraftData.progress || 0,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        createdBy: creatorEmail,
        createdByUserId: creatorUserId,
        createdByEmail: creatorEmail,
        assignedToUserId,
        assignedTo,
        version: 1,
        revisionHistory: boundState.revisionHistory,
        state: boundState
      });

      await db.addAuditLog({
        userEmail: creatorEmail,
        role: req.user!.role,
        action: 'CREATE_DOCUMENT_DRAFT',
        details: `Draft created: ${createdDraft.docNo} (${createdDraft.docType}) by ${creatorUserId} [rev ${createdDraft.revision}]`,
        ipAddress: req.ip || '127.0.0.1'
      });

      const userContext = await buildUserContext(req);
      const serializedDoc = serializeDocument(createdDraft, userContext);

      res.status(201).json({
        message: 'Deed draft state persisted successfully.',
        document: serializedDoc
      });
    } catch (err) {
      const userContext = await buildUserContext(req).catch(() => undefined);
      return handleStorageError(res, err, 'Failed to save document to database.', userContext);
    }
  }
);

const handleUpdateDocument = async (req: PermissionRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updatedData = req.body || {};
    const expectedRevision = parseExpectedRevision(req);

    const existingDoc = await db.getDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: 'Document draft not found.' });
    }

    const isCreateRevision = Boolean(
      updatedData.createRevision === true || updatedData.action === 'CREATE_REVISION'
    );

    if (
      isCreateRevision &&
      existingDoc.status !== 'Finalized' &&
      existingDoc.status !== 'Exported'
    ) {
      return res.status(400).json({
        error: 'Only Finalized or Exported documents can create a formal correction revision.',
        code: 'INVALID_REVISION_REQUEST'
      });
    }

    const targetStatus = isCreateRevision
      ? 'Draft'
      : (updatedData.status ?? existingDoc.status);

    // Check if ordinary update attempts to modify a Finalized or Exported record
    let isContentModifiedOnFinalized = false;
    if (
      (existingDoc.status === 'Finalized' || existingDoc.status === 'Exported') &&
      !isCreateRevision
    ) {
      if (existingDoc.status === 'Finalized' && targetStatus === 'Exported') {
        if (
          (updatedData.propertyAddress !== undefined &&
            updatedData.propertyAddress !== existingDoc.propertyAddress) ||
          (updatedData.consideration !== undefined &&
            Number(updatedData.consideration) !== Number(existingDoc.consideration)) ||
          (updatedData.docType !== undefined && updatedData.docType !== existingDoc.docType) ||
          (updatedData.state !== undefined &&
            JSON.stringify(updatedData.state) !== JSON.stringify(existingDoc.state))
        ) {
          isContentModifiedOnFinalized = true;
        }
      } else {
        isContentModifiedOnFinalized = true;
      }
    }

    const transitionCheck = validateStatusTransition(existingDoc.status, targetStatus, {
      createRevision: isCreateRevision,
      isContentModified: isContentModifiedOnFinalized
    });
    if (!transitionCheck.valid) {
      const statusCode = transitionCheck.code === 'FINALIZED_RECORD_LOCKED' ? 409 : 400;
      return res.status(statusCode).json({
        error: transitionCheck.error,
        code: transitionCheck.code || 'INVALID_STATUS_TRANSITION'
      });
    }

    const candidateDeedType =
      updatedData.state?.documentType ??
      updatedData.docType ??
      existingDoc.state?.documentType ??
      existingDoc.docType;

    if (
      updatedData.state?.documentType !== undefined ||
      updatedData.docType !== undefined ||
      ['Finalized', 'Generated', 'Exported', 'Approved'].includes(targetStatus)
    ) {
      if (!isDeedTemplateAvailable(candidateDeedType)) {
        return res.status(400).json({
          error: `Template unavailable for document type "${candidateDeedType || 'Unknown'}". Generation, export, and finalization are blocked.`,
          code: 'TEMPLATE_UNAVAILABLE'
        });
      }
    }

    const isAdminCaller = req.user?.role === 'Super Admin' || req.user?.role === 'Admin';
    const isCreator = isDocumentOwner(existingDoc, req.user!);

    if (!isAdminCaller) {
      if (
        (updatedData.createdByUserId !== undefined && updatedData.createdByUserId !== existingDoc.createdByUserId) ||
        (updatedData.createdByEmail !== undefined &&
          String(updatedData.createdByEmail).toLowerCase() !== (existingDoc.createdByEmail || existingDoc.createdBy || '').toLowerCase()) ||
        (updatedData.createdBy !== undefined &&
          String(updatedData.createdBy).toLowerCase() !== (existingDoc.createdBy || existingDoc.createdByEmail || '').toLowerCase())
      ) {
        return res.status(403).json({ error: 'Forbidden: Cannot change document ownership.' });
      }
    }

    const canChangeAssignment = isAdminCaller || isCreator;
    const previousStatus = existingDoc.status;
    const resolvedCanonicalCode = normalizeDeedCode(candidateDeedType);

    // Prepare candidate state for server-side validation and survey conflict checks
    const candidateStateForValidation =
      updatedData.state !== undefined
        ? {
            ...(existingDoc.state || {}),
            ...updatedData.state,
            ...(resolvedCanonicalCode ? { documentType: resolvedCanonicalCode } : {}),
            ...(updatedData.conflictReviewAcknowledged !== undefined
              ? { conflictReviewAcknowledged: Boolean(updatedData.conflictReviewAcknowledged) }
              : {}),
            ...(updatedData.conflictReviewNotes !== undefined
              ? { conflictReviewNotes: String(updatedData.conflictReviewNotes) }
              : {})
          }
        : {
            ...(existingDoc.state || {}),
            ...(updatedData.conflictReviewAcknowledged !== undefined
              ? { conflictReviewAcknowledged: Boolean(updatedData.conflictReviewAcknowledged) }
              : {}),
            ...(updatedData.conflictReviewNotes !== undefined
              ? { conflictReviewNotes: String(updatedData.conflictReviewNotes) }
              : {})
          };

    if (!isCreateRevision) {
      const serverValidation = validateDeedRecordForServer(
        {
          ...existingDoc,
          ...updatedData,
          docType: resolvedCanonicalCode || candidateDeedType,
          state: candidateStateForValidation
        },
        targetStatus
      );
      if (!serverValidation.valid) {
        return res.status(400).json({
          error: serverValidation.errors.join(' '),
          errors: serverValidation.errors,
          code: 'VALIDATION_FAILED'
        });
      }
    }

    // Multi-row qualified survey conflict check on Finalization (Reviewed Transaction-History Logic)
    if (targetStatus === 'Finalized' && existingDoc.status !== 'Finalized') {
      const allDocs = await db.getDocuments();
      const conflictAnalysis = findQualifiedSurveyConflicts(
        candidateStateForValidation,
        existingDoc.id,
        allDocs
      );

      if (conflictAnalysis.hasUnreviewedConflicts) {
        const firstUnreviewed = conflictAnalysis.conflicts.find(c => c.requiresReview);
        return res.status(409).json({
          error:
            firstUnreviewed?.message ||
            'Possible survey conflict detected with a prior finalized deed. Review transaction history or link Parent Document Number before finalizing.',
          code: 'SURVEY_CONFLICT_REQUIRES_REVIEW',
          requiresReview: true,
          conflicts: conflictAnalysis.conflicts
        });
      }
    }

    const updatedDoc = await db.updateDocument(
      id,
      current => {
        const authoritativeCreatorUserId = current.createdByUserId || current.state?.createdByUserId || req.user!.id;
        const authoritativeCreatorEmail =
          current.createdByEmail || current.createdBy || current.state?.createdByEmail || req.user!.email;

        const resolvedAssignedToUserId = canChangeAssignment
          ? (updatedData.assignedToUserId ?? current.assignedToUserId)
          : current.assignedToUserId;
        const resolvedAssignedTo = canChangeAssignment
          ? (updatedData.assignedTo ?? resolvedAssignedToUserId ?? current.assignedTo)
          : current.assignedTo;

        const currentVersion =
          Number(current.version || current.state?.version) >= 1
            ? Number(current.version || current.state?.version)
            : 1;
        const currentRevHistory = Array.isArray(current.revisionHistory)
          ? current.revisionHistory
          : Array.isArray(current.state?.revisionHistory)
            ? current.state.revisionHistory
            : [];

        let nextVersion = currentVersion;
        let nextRevHistory = [...currentRevHistory];
        let nextDocNo = current.docNo;

        if (isCreateRevision) {
          const snapshotState = JSON.parse(JSON.stringify(current.state || {}));
          delete snapshotState.revisionHistory;
          nextRevHistory = [
            ...currentRevHistory,
            {
              docNo: current.docNo,
              status: current.status,
              modifiedAt: current.modifiedAt,
              version: currentVersion,
              revision: current.revision || 1,
              notes:
                typeof updatedData.revisionNotes === 'string' && updatedData.revisionNotes.trim()
                  ? updatedData.revisionNotes.trim()
                  : `Snapshot of ${current.status} v${currentVersion} before revision`,
              state: snapshotState
            }
          ];
          nextVersion = currentVersion + 1;
          const baseDocNo = current.docNo.split('-v')[0];
          nextDocNo = `${baseDocNo}-v${nextVersion}`;
        }

        const mergedState = updatedData.state !== undefined
          ? {
              ...(current.state || {}),
              ...updatedData.state,
              ...(resolvedCanonicalCode ? { documentType: resolvedCanonicalCode } : {}),
              ...(updatedData.conflictReviewAcknowledged !== undefined
                ? { conflictReviewAcknowledged: Boolean(updatedData.conflictReviewAcknowledged) }
                : {}),
              ...(updatedData.conflictReviewNotes !== undefined
                ? { conflictReviewNotes: String(updatedData.conflictReviewNotes) }
                : {}),
              version: nextVersion,
              revisionHistory: nextRevHistory,
              docNumber: nextDocNo,
              createdByUserId: authoritativeCreatorUserId,
              createdByEmail: authoritativeCreatorEmail,
              createdBy: authoritativeCreatorEmail,
              assignedToUserId: resolvedAssignedToUserId,
              assignedTo: resolvedAssignedTo
            }
          : {
              ...(current.state || {}),
              ...(updatedData.conflictReviewAcknowledged !== undefined
                ? { conflictReviewAcknowledged: Boolean(updatedData.conflictReviewAcknowledged) }
                : {}),
              ...(updatedData.conflictReviewNotes !== undefined
                ? { conflictReviewNotes: String(updatedData.conflictReviewNotes) }
                : {}),
              version: nextVersion,
              revisionHistory: nextRevHistory,
              docNumber: nextDocNo
            };

        return {
          ...current,
          id: current.id,
          // Keep server-controlled document reference immutable except when server creates a formal revision
          docNo: nextDocNo,
          docType: resolvedCanonicalCode ? getDeedDisplayName(resolvedCanonicalCode) : (updatedData.docType ?? current.docType),
          subType: updatedData.subType ?? current.subType,
          partiesCount: updatedData.partiesCount ?? current.partiesCount,
          propertyAddress: updatedData.propertyAddress ?? current.propertyAddress,
          consideration: updatedData.consideration ?? current.consideration,
          status: targetStatus,
          progress: updatedData.progress ?? current.progress,
          writer: updatedData.writer ?? current.writer,
          version: nextVersion,
          revisionHistory: nextRevHistory,
          state: mergedState,
          createdAt: current.createdAt,
          createdBy: authoritativeCreatorEmail,
          createdByUserId: authoritativeCreatorUserId,
          createdByEmail: authoritativeCreatorEmail,
          assignedToUserId: resolvedAssignedToUserId,
          assignedTo: resolvedAssignedTo,
          modifiedAt: new Date().toISOString()
        };
      },
      expectedRevision
    );

    if (isCreateRevision) {
      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Document Writer',
        action: 'CREATE_DOCUMENT_REVISION',
        details: `Created revision v${updatedDoc.version} (${updatedDoc.docNo}) from finalized deed ${existingDoc.docNo} [rev ${updatedDoc.revision}]`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } else if (targetStatus && targetStatus !== previousStatus) {
      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Document Writer',
        action: `DOCUMENT_STATUS_${String(targetStatus).toUpperCase()}`,
        details: `Document ${updatedDoc.docNo} status changed from ${previousStatus} to ${targetStatus} [rev ${updatedDoc.revision}]`,
        ipAddress: req.ip || '127.0.0.1'
      });
    } else {
      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Document Writer',
        action: 'UPDATE_DOCUMENT_DRAFT',
        details: `Autosaved/saved draft ${updatedDoc.docNo} (Progress: ${updatedDoc.progress}%, rev ${updatedDoc.revision})`,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    const userContext = await buildUserContext(req);
    const serializedDoc = serializeDocument(updatedDoc, userContext);

    res.json({
      message: isCreateRevision
        ? `Revision v${updatedDoc.version} created with preserved revision history.`
        : 'Deed state updated successfully.',
      document: serializedDoc
    });
  } catch (err) {
    const userContext = await buildUserContext(req).catch(() => undefined);
    return handleStorageError(res, err, 'Failed to persist document.', userContext);
  }
};

app.put('/api/documents/:id', authMiddleware, requireResourceAccess('documents'), handleUpdateDocument);
app.patch('/api/documents/:id', authMiddleware, requireResourceAccess('documents'), handleUpdateDocument);

app.post(
  '/api/documents/:id/revisions',
  authMiddleware,
  requireResourceAccess('documents'),
  async (req: PermissionRequest, res: Response) => {
    req.body = {
      ...(req.body || {}),
      createRevision: true,
      status: 'Draft'
    };
    return handleUpdateDocument(req, res);
  }
);

app.delete(
  '/api/documents/:id',
  authMiddleware,
  requirePermission(['Super Admin', 'Admin', 'Document Writer', 'Lawyer', 'Data Entry Operator', 'Client', 'Broker']),
  requireResourceAccess('documents'),
  async (req: PermissionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const expectedRevision = parseExpectedRevision(req);
      const deletedDoc = await db.deleteDocument(id, expectedRevision);

      await db.addAuditLog({
        userEmail: req.user?.email || 'System',
        role: req.user?.role || 'Document Writer',
        action: 'DELETE_DOCUMENT_DRAFT',
        details: `Permanently deleted draft ${deletedDoc.docNo}`,
        ipAddress: req.ip || '127.0.0.1'
      });

      res.json({ message: 'Document draft deleted successfully.', success: true });
    } catch (err) {
      const userContext = await buildUserContext(req).catch(() => undefined);
      return handleStorageError(res, err, 'Failed to delete document.', userContext);
    }
  }
);

// --- AUDIT LOGS ROUTER ---
app.get('/api/audit-logs', authMiddleware, requirePermission(['Super Admin', 'Admin', 'Auditor']), requireResourceAccess('audits'), async (req: PermissionRequest, res: Response) => {
  res.json(await db.getAuditLogs());
});

app.post('/api/audit-logs', authMiddleware, async (req: PermissionRequest, res: Response) => {
  const { action, details } = req.body;
  const log = await db.addAuditLog({
    userEmail: req.user?.email || 'System',
    role: req.user?.role || 'Client',
    action: action || 'CUSTOM_ACTION',
    details: details || '',
    ipAddress: req.ip || '127.0.0.1'
  });
  res.status(201).json(log);
});

// --- CROSS-DOCUMENT GEOGRAPHIC VALIDATION & TRANSACTION-HISTORY CONFLICT REVIEW ---
const handleSurveyCrossCheck = async (req: PermissionRequest, res: Response) => {
  const docs = await db.getDocuments();
  const dbUsers = await db.getUsers();
  const fullUser = dbUsers.find(
    u => u.id === req.user?.id || u.email.toLowerCase() === req.user?.email?.toLowerCase()
  );
  if (!fullUser) {
    return res.status(403).json({ error: 'Access Denied: User profile not found.' });
  }

  const isPost = req.method === 'POST';
  const queryOrBody = isPost ? (req.body || {}) : (req.query || {});
  const currentDocId = String(queryOrBody.currentDocId || '').trim() || undefined;

  let candidateState: any = null;

  if (isPost && queryOrBody.state && typeof queryOrBody.state === 'object') {
    candidateState = queryOrBody.state;
  } else {
    const surveyNo = String(queryOrBody.surveyNo || '').trim();
    const subDivision = String(queryOrBody.subDivision || '').trim();
    const village = String(queryOrBody.village || '').trim();
    const taluk = String(queryOrBody.taluk || '').trim();
    const district = String(queryOrBody.district || '').trim();
    const sro = String(queryOrBody.sro || '').trim();
    const registrationDistrict = String(queryOrBody.registrationDistrict || '').trim();
    const parentDocNo = String(queryOrBody.parentDocNo || '').trim();
    const conflictReviewAcknowledged =
      queryOrBody.conflictReviewAcknowledged === true ||
      queryOrBody.conflictReviewAcknowledged === 'true';

    let parsedSurveys: any[] = [];
    if (typeof queryOrBody.surveys === 'string' && queryOrBody.surveys.trim()) {
      try {
        const parsed = JSON.parse(queryOrBody.surveys);
        if (Array.isArray(parsed)) parsedSurveys = parsed;
      } catch {
        // ignore invalid JSON
      }
    } else if (Array.isArray(queryOrBody.surveys)) {
      parsedSurveys = queryOrBody.surveys;
    }

    if (parsedSurveys.length === 0 && (!surveyNo || !village)) {
      return res.status(400).json({ error: 'Parameters surveyNo and village (or surveys list) are required.' });
    }

    const surveyRows =
      parsedSurveys.length > 0
        ? parsedSurveys
        : [{ surveyNo, subDivision }];

    candidateState = {
      property: {
        village,
        taluk,
        district,
        sro,
        registrationDistrict
      },
      survey: surveyRows[0] || { surveyNo, subDivision },
      surveys: surveyRows,
      ownershipHistory: {
        parentDocNo
      },
      conflictReviewAcknowledged
    };
  }

  const checkedSurveys = extractQualifiedSurveys(candidateState);
  if (checkedSurveys.length === 0) {
    return res.status(400).json({ error: 'Parameters surveyNo and village are required.' });
  }

  const clients = fullUser.role === 'Broker' ? await db.getClients() : [];
  // Only check drafts within the user's authorized workspace so other users' private draft IDs/docNos are never leaked
  const accessibleDocs = docs.filter(d => canUserAccessDocument(d, fullUser, clients, 'GET'));

  const analysis = findQualifiedSurveyConflicts(candidateState, currentDocId, accessibleDocs);

  const alerts = analysis.conflicts.map(c => {
    if (c.type === 'POSSIBLE_CONFLICT_REQUIRES_REVIEW') {
      return {
        type: 'DUPLICATE_FINALIZED_DRAFT',
        category: 'POSSIBLE_CONFLICT_REQUIRES_REVIEW',
        severity: c.requiresReview ? ('High' as const) : ('Low' as const),
        requiresReview: c.requiresReview,
        linkedInParentHistory: c.linkedInParentHistory,
        reviewAcknowledged: c.reviewAcknowledged,
        docId: c.docId,
        docNo: c.docNo,
        surveyRowIndex: c.surveyRowIndex,
        surveyNo: c.surveyNo,
        subDivision: c.subDivision,
        village: c.village,
        taluk: c.taluk,
        district: c.district,
        sro: c.sro,
        qualifiedKey: c.qualifiedKey,
        message: `${c.message} Note: App finalization locks the draft for execution and does not constitute government registration at the Sub-Registrar Office.`
      };
    }
    return {
      type: 'DUPLICATE_ACTIVE_DRAFT',
      category: 'CONCURRENT_DRAFT_WARNING',
      severity: 'Medium' as const,
      requiresReview: false,
      linkedInParentHistory: c.linkedInParentHistory,
      reviewAcknowledged: c.reviewAcknowledged,
      docId: c.docId,
      docNo: c.docNo,
      surveyRowIndex: c.surveyRowIndex,
      surveyNo: c.surveyNo,
      subDivision: c.subDivision,
      village: c.village,
      taluk: c.taluk,
      district: c.district,
      sro: c.sro,
      qualifiedKey: c.qualifiedKey,
      message: `COMPLIANCE NOTE: ${c.message}`
    };
  });

  const primarySurvey = checkedSurveys[0];

  return res.json({
    surveyNo: primarySurvey?.surveyNo || queryOrBody.surveyNo,
    subDivision: primarySurvey?.subDivision || queryOrBody.subDivision,
    village: primarySurvey?.village || queryOrBody.village,
    taluk: primarySurvey?.taluk || queryOrBody.taluk || '',
    district: primarySurvey?.district || queryOrBody.district || '',
    sro: primarySurvey?.sro || queryOrBody.sro || '',
    checkedSurveys: analysis.checkedSurveys,
    hasConflict: alerts.length > 0,
    conflict: alerts.length > 0,
    requiresReview: analysis.hasUnreviewedConflicts,
    conflicts: analysis.conflicts,
    message: alerts[0]?.message || null,
    alerts
  });
};

app.get('/api/verification/cross-check', authMiddleware, handleSurveyCrossCheck);
app.post('/api/verification/cross-check', authMiddleware, handleSurveyCrossCheck);

// ==========================================
// PRIVACY & PII INVENTORY ENDPOINT
// ==========================================
app.get('/api/privacy/pii-inventory', authMiddleware, (req, res) => {
  res.json({
    success: true,
    inventory: PII_INVENTORY,
    rules: [
      'Strict server-side AES-256-GCM encryption for stored PII',
      'Role-appropriate disclosure (Super Admin, elevated Auditor, Client own-data)',
      'Preservation of protected ciphertext on save/update',
      'Plain-text escaping and DOMPurify sanitization in templates and preview/print/export'
    ]
  });
});

// ==========================================
// MASTER DATA ENGINE ENDPOINTS
// ==========================================

app.get(['/api/master-data', '/api/master-data/all'], (req, res) => {
  res.json({ success: true, masterData: getMasterDataEngine() });
});

app.get('/api/master-data/:category', (req, res) => {
  const category = req.params.category;
  const data = getMasterDataEngine(category);
  res.json({ success: true, category, data });
});

// ==========================================
// LAYER 8: AI & VERIFICATION SERVICE LAYER
// ==========================================

// 1. OCR Extract (/ai/extract, /api/ai/extract & /api/ai/extract-doc)
const handleAiExtract = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
    }

    const { base64File, mimeType, pages } = req.body || {};

    let payloadList: Array<{ base64File: string; mimeType?: string; pageNo?: number }> = [];

    if (Array.isArray(pages) && pages.length > 0) {
      payloadList = pages.map((p: any, idx: number) => ({
        base64File: p.base64File || p.data || '',
        mimeType: p.mimeType || p.type || mimeType || 'image/png',
        pageNo: Number(p.pageNo) || idx + 1
      }));
    } else if (base64File) {
      payloadList = [{ base64File, mimeType, pageNo: 1 }];
    } else {
      return res.status(400).json({
        error: 'File upload data (base64File or pages array) is required for OCR extraction.'
      });
    }

    const result = await aiExtractDocumentData(payloadList, actor.id);
    const userContext = await buildUserContext(req);
    const disclosedResult = serializeOcrData(result, userContext);

    // Security Audit Event derived strictly from verified session actor
    await db.addAuditLog({
      userEmail: actor.email,
      role: actor.role,
      action: 'AI_OCR_EXTRACTION',
      details: JSON.stringify({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        pageCount: payloadList.length,
        extractionMode: result.extractionMode,
        serverTimestamp: new Date().toISOString()
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(disclosedResult);
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error?.message || 'AI Extraction Failed.',
      ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {})
    });
  }
};

app.post('/ai/extract', authMiddleware, handleAiExtract);
app.post('/api/ai/extract', authMiddleware, handleAiExtract);
app.post('/api/ai/extract-doc', authMiddleware, handleAiExtract);

// 2. Compliance check (/ai/validate & /api/ai/validate)
const handleAiValidate = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
    }

    const deedState = req.body || {};
    const result = await aiValidateDeedDocument(deedState, actor.id);

    await db.addAuditLog({
      userEmail: actor.email,
      role: actor.role,
      action: 'AI_DEED_VALIDATION',
      details: JSON.stringify({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        passed: result.passed,
        warningCount: result.warnings?.length || 0,
        serverTimestamp: new Date().toISOString()
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(result);
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error?.message || 'AI Deed Validation Failed.',
      ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {})
    });
  }
};

app.post('/ai/validate', authMiddleware, handleAiValidate);
app.post('/api/ai/validate', authMiddleware, handleAiValidate);

// 3. Clause recommender (/ai/recommend-clause & /api/ai/recommend-clause)
const handleAiRecommendClause = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
    }

    const { deedType, transactionDetails } = req.body || {};
    const result = await aiRecommendClauses(deedType || 'Sale Deed', transactionDetails, actor.id);

    await db.addAuditLog({
      userEmail: actor.email,
      role: actor.role,
      action: 'AI_CLAUSE_RECOMMENDATION',
      details: JSON.stringify({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        deedType: deedType || 'Sale Deed',
        recommendedCount: result.recommendedClauses?.length || 0,
        serverTimestamp: new Date().toISOString()
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(result);
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error?.message || 'AI Clause Recommendation Failed.',
      ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {})
    });
  }
};

app.post('/ai/recommend-clause', authMiddleware, handleAiRecommendClause);
app.post('/api/ai/recommend-clause', authMiddleware, handleAiRecommendClause);

// 4. Registry fraud analyzer (/ai/fraud-check & /api/ai/fraud-check)
const handleAiFraudCheck = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
    }

    const { surveyNo, subDivision, village } = req.body || {};
    const result = await aiCheckDeedFraudRisk(
      surveyNo || '340',
      subDivision || '5A',
      village || 'Thiruvanmiyur',
      actor.id
    );

    await db.addAuditLog({
      userEmail: actor.email,
      role: actor.role,
      action: 'AI_FRAUD_CHECK',
      details: JSON.stringify({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        surveyNo,
        subDivision,
        village,
        serverTimestamp: new Date().toISOString()
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(result);
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error?.message || 'AI Fraud Check Failed.',
      ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {})
    });
  }
};

app.post('/ai/fraud-check', authMiddleware, handleAiFraudCheck);
app.post('/api/ai/fraud-check', authMiddleware, handleAiFraudCheck);

// 5. Unified 4-Tier Verification Evidence Endpoint (/api/verification/external-check)
app.post('/api/verification/external-check', authMiddleware, async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
    }

    const deedState = req.body?.state || req.body || {};
    const result = calculateTrustScore(deedState);

    await db.addAuditLog({
      userEmail: actor.email,
      role: actor.role,
      action: 'EXTERNAL_VERIFICATION_CHECK',
      details: JSON.stringify({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        trustBand: result.trustBand,
        externalVerificationStatus: result.externalVerification.status,
        serverTimestamp: new Date().toISOString()
      }),
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Verification calculation failed.' });
  }
});

// --- ELEVATED REVIEW SESSION MANAGEMENT ---

// Start an elevated Auditor review session
app.post('/api/audit/elevate', authMiddleware, async (req, res) => {
  try {
    const dbUsers = await db.getUsers();
    const reqEmail = (req as any).user?.email;
    if (!reqEmail) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    
    const fullUser = dbUsers.find(u => u.email.toLowerCase() === reqEmail.toLowerCase());
    if (!fullUser) {
      return res.status(403).json({ error: 'Access Denied: User profile not found.' });
    }
    
    // 1. Authenticated Auditor role check
    if (fullUser.role !== 'Auditor') {
      return res.status(403).json({ error: 'Access Denied: Only users with the Auditor role can request elevated PII review.' });
    }
    
    // 2. Explicit server-side permission flag check
    const canViewRawPII = fullUser.permissions?.includes('canViewRawPII') || false;
    if (!canViewRawPII) {
      return res.status(403).json({ error: 'Access Denied: Your profile lacks the explicit server-side permission flag (canViewRawPII).' });
    }
    
    // 3. Mandatory reason code validation
    const { reasonCode } = req.body;
    if (!reasonCode || typeof reasonCode !== 'string' || reasonCode.trim().length === 0) {
      return res.status(400).json({ error: 'Mandatory reason code is required to initiate elevated review.' });
    }
    
    // 4. Session window (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    activeElevatedSessions.set(reqEmail.toLowerCase(), {
      userId: fullUser.id,
      userEmail: reqEmail.toLowerCase(),
      role: 'Auditor',
      reasonCode: reasonCode.trim(),
      expiresAt
    });
    
    // 5. Immutable SIEM audit log entry
    await db.addAuditLog({
      userEmail: reqEmail,
      role: 'Auditor',
      action: 'ELEVATED_PII_SESSION_START',
      details: `Auditor initiated elevated PII review session. Reason: ${reasonCode.trim()}. Expires in 15 minutes.`,
      ipAddress: req.ip || '127.0.0.1'
    });
    
    res.json({
      message: 'Elevated review session successfully activated.',
      expiresAt: expiresAt.toISOString(),
      sessionWindowMinutes: 15
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to activate elevated session.' });
  }
});

// Check status of elevated review session
app.get('/api/audit/elevate/status', authMiddleware, async (req, res) => {
  const reqEmail = (req as any).user?.email;
  if (!reqEmail) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  
  const session = activeElevatedSessions.get(reqEmail.toLowerCase());
  if (session && new Date() < session.expiresAt) {
    const minutesRemaining = Math.max(0, Math.round((session.expiresAt.getTime() - Date.now()) / 1000 / 60));
    return res.json({
      active: true,
      reasonCode: session.reasonCode,
      expiresAt: session.expiresAt.toISOString(),
      minutesRemaining
    });
  }
  
  res.json({ active: false });
});

// Terminate elevated review session (demote)
app.post('/api/audit/demote', authMiddleware, async (req, res) => {
  const reqEmail = (req as any).user?.email;
  if (reqEmail) {
    activeElevatedSessions.delete(reqEmail.toLowerCase());
    await db.addAuditLog({
      userEmail: reqEmail,
      role: 'Auditor',
      action: 'ELEVATED_PII_SESSION_END',
      details: 'Auditor terminated elevated PII review session.',
      ipAddress: req.ip || '127.0.0.1'
    });
  }
  res.json({ message: 'Elevated review session terminated.' });
});

// Global Error Handling Middleware for Malformed JSON and Uncaught Express Errors
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload in request body.' });
  }
  if (err) {
    console.error('Unhandled Server Error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  }
  next();
});

// Bootstrap database tables and migrate legacy JSON data on startup
try {
  await migrateAndBootstrap();
  console.log('Database bootstrapping completed successfully.');
} catch (err) {
  console.error('Database bootstrapping failed:', err);
  if (process.env.NODE_ENV === 'production') throw err;
}

// Start standalone backend server only when explicitly requested
if (process.env.START_STANDALONE_BACKEND === 'true' && process.env.NODE_ENV !== 'test') {
  const standaloneServer = app.listen(PORT, () => {
    console.log(`UNIKORN360 Core Backend Persistent server running on port ${PORT}`);
  });
  standaloneServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`Backend standalone server error on port ${PORT}:`, err.message);
  });
}

export default app;

