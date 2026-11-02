import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  isPostgres,
  initDatabase,
  query,
  execute,
  withTransaction,
  disablePostgres,
  validateDatabaseMode,
} from './dbClient.js';
import {
  encryptGCM,
  decryptGCM,
  getDeterministicHash,
  maskPIIInText,
  preserveProtectedValuesOnSave,
  preserveClientProtectedValues,
} from './pii.js';
import { loadMigrationDefinitions, AppliedMigrationRecord } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PersistenceError extends Error {
  public readonly statusCode: number = 500;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export class ConcurrencyConflictError extends Error {
  public readonly statusCode: number = 409;
  public readonly currentRecord?: any;
  public readonly currentRevision?: number;
  constructor(
    message: string = 'Conflict: Record was modified by another operation (revision mismatch). Reload and retry.',
    currentRecord?: any,
    currentRevision?: number
  ) {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.currentRecord = currentRecord;
    this.currentRevision = currentRevision;
  }
}

export class FinalizedRecordLockedError extends Error {
  public readonly statusCode: number = 409;
  constructor(
    message: string = 'REGISTRY LOCK: Finalized documents are immutable and cannot be edited or deleted directly.'
  ) {
    super(message);
    this.name = 'FinalizedRecordLockedError';
  }
}

export class DuplicateRecordError extends Error {
  public readonly statusCode: number = 409;
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRecordError';
  }
}

export class RecordNotFoundError extends Error {
  public readonly statusCode: number = 404;
  constructor(message: string) {
    super(message);
    this.name = 'RecordNotFoundError';
  }
}

export function generateRecordUuid(): string {
  return crypto.randomUUID();
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const getDataDir = () => {
  const dir = process.env.DEEDOS_DATA_DIR || path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Optional test hook to simulate disk / persistence failure and verify transactional rollback
let simulatedWriteFailureReason: string | null = null;
export function setSimulatedWriteFailure(reason: string | null) {
  simulatedWriteFailureReason = reason;
}

// In-process async mutex to serialize local JSON transactions and prevent race clobbering
let storageLockPromise: Promise<void> = Promise.resolve();
async function withStorageLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = storageLockPromise;
  let release!: () => void;
  storageLockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// Strict JSON reader/writer helpers — never swallow errors
const readJsonFile = <T>(fileName: string, defaultVal: T): T => {
  const filePath = path.join(getDataDir(), fileName);
  if (!fs.existsSync(filePath)) {
    return JSON.parse(JSON.stringify(defaultVal)) as T;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err: any) {
    throw new PersistenceError(
      `Failed to read or parse persistence file ${fileName}: ${err?.message || String(err)}`,
      err
    );
  }
};

const writeJsonFile = <T>(fileName: string, data: T): void => {
  if (simulatedWriteFailureReason) {
    throw new PersistenceError(`Persistence write failed: ${simulatedWriteFailureReason}`);
  }
  const dir = getDataDir();
  const filePath = path.join(dir, fileName);
  const tempPath = path.join(dir, `.${fileName}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  try {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // ignore temp cleanup error
    }
    throw new PersistenceError(
      `Failed to write persistence file ${fileName}: ${err?.message || String(err)}`,
      err
    );
  }
};

// Database Schema Interfaces
export interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  permissions: string[];
  status: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted';
  passwordHash: string;
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  mustResetPassword?: boolean;
  deleted?: boolean;
  isDeleted?: boolean;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  permissions: string[];
  status: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted';
  createdAt: string;
  revision: number;
  mustResetPassword?: boolean;
}

export function toSafeUser(user: DbUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    organization: user.organization || 'Independent',
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : ['view_own_deeds'],
    status: user.status,
    createdAt: user.createdAt,
    revision: Number(user.revision) >= 1 ? Number(user.revision) : 1,
    ...(user.mustResetPassword !== undefined ? { mustResetPassword: Boolean(user.mustResetPassword) } : {}),
  };
}

export interface DbClient {
  id: string;
  name: string;
  fatherName: string;
  dob: string;
  age: number;
  occupation: string;
  pan: string;
  aadhaar: string;
  panHash?: string;
  aadhaarHash?: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  assignedToUserId?: string;
  assignedTo?: string;
  revision?: number;
}

export interface DbAuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  role: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface DbDocument {
  id: string;
  docNo: string;
  docType: string;
  subType: string;
  partiesCount: number;
  propertyAddress: string;
  consideration: number;
  status: string;
  writer: string;
  progress: number;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  createdByUserId?: string;
  createdByEmail?: string;
  assignedToUserId?: string;
  assignedTo?: string;
  revision?: number;
  version?: number;
  revisionHistory?: any[];
  state: any; // Full DeedWizardState
}

// Initial default user data if db is completely blank (no plaintext passwords or hashes logged or exposed)
const DEFAULT_USERS: DbUser[] = [
  {
    id: 'usr-104200',
    name: 'V. Sridhar',
    email: 'writer.sridhar@gmail.com',
    phone: '9840123456',
    organization: 'Thiruvanmiyur Doc Writers Association',
    role: 'Document Writer',
    permissions: ['view_own_deeds'],
    status: 'Approved',
    passwordHash: '',
    revision: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-104201',
    name: 'Admin Muthu',
    email: 'admin.muthu@tnreginet.gov.in',
    phone: '9444012345',
    organization: 'TN Registration Department',
    role: 'Admin',
    permissions: ['*'],
    status: 'Approved',
    passwordHash: '',
    revision: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-104202',
    name: 'Auditor Vasan',
    email: 'auditor.vasan@gmail.com',
    phone: '9844567890',
    organization: 'Internal Audit Cell',
    role: 'Auditor',
    permissions: ['audit_logs', 'view_all_deeds', 'canViewRawPII'],
    status: 'Approved',
    passwordHash: '',
    revision: 1,
    createdAt: new Date().toISOString(),
    mustResetPassword: true,
  },
];

/**
 * Generates a server-controlled unique document reference (`DEED/YYYY/NNNNNN`)
 * guaranteed not to collide with any existing document's `docNo`.
 */
export function allocateUniqueDocNoFromList(
  existingDocs: Array<{ docNo?: string }>,
  year: number = new Date().getFullYear()
): string {
  const existingSet = new Set(
    existingDocs.map((d) => (d.docNo || '').trim().toUpperCase()).filter(Boolean)
  );
  let maxSeq = 1000;
  const prefix = `DEED/${year}/`;
  for (const doc of existingDocs) {
    const raw = (doc.docNo || '').trim().toUpperCase();
    if (raw.startsWith(prefix)) {
      const rest = raw.slice(prefix.length);
      const match = rest.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  let candidateSeq = maxSeq + 1;
  let candidate = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
  while (existingSet.has(candidate.toUpperCase())) {
    candidateSeq += 1;
    candidate = `${prefix}${String(candidateSeq).padStart(4, '0')}`;
  }
  return candidate;
}

function decryptParties(parties: any[]) {
  if (!parties || !Array.isArray(parties)) return parties;
  return parties.map((p: any) => ({
    ...p,
    pan: p.pan ? decryptGCM(p.pan) : p.pan,
    aadhaar: p.aadhaar ? decryptGCM(p.aadhaar) : p.aadhaar,
  }));
}

function encryptParties(parties: any[]) {
  if (!parties || !Array.isArray(parties)) return parties;
  return parties.map((p: any) => ({
    ...p,
    pan: p.pan ? encryptGCM(p.pan) : p.pan,
    aadhaar: p.aadhaar ? encryptGCM(p.aadhaar) : p.aadhaar,
  }));
}

function mapPgRowToClient(r: any): DbClient {
  return {
    id: r.id,
    name: r.name,
    fatherName: r.father_name,
    dob: r.dob,
    age: Number(r.age),
    occupation: r.occupation,
    pan: decryptGCM(r.pan),
    aadhaar: decryptGCM(r.aadhaar),
    panHash: r.pan_hash || getDeterministicHash(r.pan),
    aadhaarHash: r.aadhaar_hash || getDeterministicHash(r.aadhaar),
    address: r.address,
    phone: r.phone,
    email: r.email,
    createdAt: r.created_at,
    updatedAt: r.updated_at || undefined,
    createdBy: r.created_by || r.created_by_email || undefined,
    createdByUserId: r.created_by_user_id || undefined,
    createdByEmail: r.created_by_email || r.created_by || undefined,
    assignedToUserId: r.assigned_to_user_id || undefined,
    assignedTo: r.assigned_to || undefined,
    revision: Number(r.revision) >= 1 ? Number(r.revision) : 1,
  };
}

function mapJsonRecordToClient(c: any): DbClient {
  const decryptedPan = decryptGCM(c.pan);
  const decryptedAadhaar = decryptGCM(c.aadhaar);
  return {
    ...c,
    pan: decryptedPan,
    aadhaar: decryptedAadhaar,
    panHash: c.panHash || c.pan_hash || getDeterministicHash(decryptedPan),
    aadhaarHash: c.aadhaarHash || c.aadhaar_hash || getDeterministicHash(decryptedAadhaar),
    createdBy: c.createdBy || c.created_by || c.createdByEmail || c.created_by_email || undefined,
    createdByUserId: c.createdByUserId || c.created_by_user_id || undefined,
    createdByEmail: c.createdByEmail || c.created_by_email || c.createdBy || c.created_by || undefined,
    assignedToUserId: c.assignedToUserId || c.assigned_to_user_id || undefined,
    assignedTo: c.assignedTo || c.assigned_to || undefined,
    revision: Number(c.revision) >= 1 ? Number(c.revision) : 1,
  };
}

function serializeClientForDisk(c: DbClient): any {
  return {
    ...c,
    pan: encryptGCM(c.pan),
    aadhaar: encryptGCM(c.aadhaar),
    panHash: getDeterministicHash(c.pan),
    aadhaarHash: getDeterministicHash(c.aadhaar),
    pan_hash: getDeterministicHash(c.pan),
    aadhaar_hash: getDeterministicHash(c.aadhaar),
    createdBy: c.createdBy || c.createdByEmail || undefined,
    createdByUserId: c.createdByUserId || undefined,
    createdByEmail: c.createdByEmail || c.createdBy || undefined,
    assignedToUserId: c.assignedToUserId || undefined,
    assignedTo: c.assignedTo || undefined,
    revision: Number(c.revision) >= 1 ? Number(c.revision) : 1,
  };
}

function mapPgRowToDocument(r: any): DbDocument {
  const state = typeof r.state === 'string' ? JSON.parse(r.state) : r.state || {};
  if (state && Array.isArray(state.parties)) {
    state.parties = decryptParties(state.parties);
  }
  if (state && Array.isArray(state.revisionHistory)) {
    state.revisionHistory = state.revisionHistory.map((item: any) => {
      if (item?.state && Array.isArray(item.state.parties)) {
        return {
          ...item,
          state: {
            ...item.state,
            parties: decryptParties(item.state.parties),
          },
        };
      }
      return item;
    });
  }
  const rev = Number(r.revision) >= 1 ? Number(r.revision) : Number(state?.revision) >= 1 ? Number(state.revision) : 1;
  const ver = Number(r.version) >= 1 ? Number(r.version) : Number(state?.version) >= 1 ? Number(state.version) : 1;
  const revHistory = Array.isArray(r.revisionHistory)
    ? r.revisionHistory
    : Array.isArray(state?.revisionHistory)
      ? state.revisionHistory
      : [];
  state.revision = rev;
  state.version = ver;
  state.revisionHistory = revHistory;
  return {
    id: r.id,
    docNo: r.doc_no,
    docType: r.doc_type,
    subType: r.sub_type,
    partiesCount: r.parties_count,
    propertyAddress: r.property_address,
    consideration: r.consideration,
    status: r.status,
    writer: r.writer,
    progress: r.progress,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
    createdBy: r.created_by || r.created_by_email || state?.createdByEmail || '',
    createdByUserId: r.created_by_user_id || state?.createdByUserId || undefined,
    createdByEmail: r.created_by_email || r.created_by || state?.createdByEmail || undefined,
    assignedToUserId: r.assigned_to_user_id || state?.assignedToUserId || undefined,
    assignedTo: r.assigned_to || state?.assignedTo || undefined,
    revision: rev,
    version: ver,
    revisionHistory: revHistory,
    state,
  };
}

function mapJsonRecordToDocument(d: any): DbDocument {
  const clonedDoc = JSON.parse(JSON.stringify(d));
  if (clonedDoc.state && Array.isArray(clonedDoc.state.parties)) {
    clonedDoc.state.parties = decryptParties(clonedDoc.state.parties);
  }
  if (clonedDoc.state && Array.isArray(clonedDoc.state.revisionHistory)) {
    clonedDoc.state.revisionHistory = clonedDoc.state.revisionHistory.map((item: any) => {
      if (item?.state && Array.isArray(item.state.parties)) {
        return {
          ...item,
          state: {
            ...item.state,
            parties: decryptParties(item.state.parties),
          },
        };
      }
      return item;
    });
  }
  if (Array.isArray(clonedDoc.revisionHistory)) {
    clonedDoc.revisionHistory = clonedDoc.revisionHistory.map((item: any) => {
      if (item?.state && Array.isArray(item.state.parties)) {
        return {
          ...item,
          state: {
            ...item.state,
            parties: decryptParties(item.state.parties),
          },
        };
      }
      return item;
    });
  }
  const rev =
    Number(clonedDoc.revision) >= 1
      ? Number(clonedDoc.revision)
      : Number(clonedDoc.state?.revision) >= 1
      ? Number(clonedDoc.state.revision)
      : 1;
  const ver =
    Number(clonedDoc.version) >= 1
      ? Number(clonedDoc.version)
      : Number(clonedDoc.state?.version) >= 1
      ? Number(clonedDoc.state.version)
      : 1;
  const revHistory = Array.isArray(clonedDoc.revisionHistory)
    ? clonedDoc.revisionHistory
    : Array.isArray(clonedDoc.state?.revisionHistory)
      ? clonedDoc.state.revisionHistory
      : [];
  if (clonedDoc.state && typeof clonedDoc.state === 'object') {
    clonedDoc.state.revision = rev;
    clonedDoc.state.version = ver;
    clonedDoc.state.revisionHistory = revHistory;
  }
  return {
    ...clonedDoc,
    createdBy: clonedDoc.createdBy || clonedDoc.createdByEmail || clonedDoc.state?.createdByEmail || '',
    createdByUserId: clonedDoc.createdByUserId || clonedDoc.state?.createdByUserId || undefined,
    createdByEmail:
      clonedDoc.createdByEmail || clonedDoc.createdBy || clonedDoc.state?.createdByEmail || undefined,
    assignedToUserId: clonedDoc.assignedToUserId || clonedDoc.state?.assignedToUserId || undefined,
    assignedTo: clonedDoc.assignedTo || clonedDoc.state?.assignedTo || undefined,
    revision: rev,
    version: ver,
    revisionHistory: revHistory,
  };
}

function serializeDocumentForDisk(d: DbDocument): DbDocument {
  const cloned = JSON.parse(JSON.stringify(d));
  const rev = Number(cloned.revision) >= 1 ? Number(cloned.revision) : 1;
  const ver =
    Number(cloned.version) >= 1
      ? Number(cloned.version)
      : Number(cloned.state?.version) >= 1
      ? Number(cloned.state.version)
      : 1;
  const revHistory = Array.isArray(cloned.revisionHistory)
    ? cloned.revisionHistory
    : Array.isArray(cloned.state?.revisionHistory)
      ? cloned.state.revisionHistory
      : [];
  const encryptedHistory = revHistory.map((item: any) => {
    if (item?.state && Array.isArray(item.state.parties)) {
      return {
        ...item,
        state: {
          ...item.state,
          parties: encryptParties(item.state.parties),
        },
      };
    }
    return item;
  });

  cloned.revision = rev;
  cloned.version = ver;
  cloned.revisionHistory = encryptedHistory;
  if (cloned.state && typeof cloned.state === 'object') {
    cloned.state.revision = rev;
    cloned.state.version = ver;
    cloned.state.revisionHistory = encryptedHistory;
    if (Array.isArray(cloned.state.parties)) {
      cloned.state.parties = encryptParties(cloned.state.parties);
    }
  }
  return cloned;
}

/**
 * Runs local JSON schema & data migrations (fresh or upgrade) and records
 * applied versions in `schema_migrations.json`.
 */
export async function runLocalDataMigrations(customDataDir?: string): Promise<{
  applied: string[];
  skipped: string[];
  appliedMigrations: AppliedMigrationRecord[];
}> {
  return withStorageLock(() => {
    const prevDataDir = process.env.DEEDOS_DATA_DIR;
    if (customDataDir) {
      process.env.DEEDOS_DATA_DIR = customDataDir;
    }

    try {
      const definitions = loadMigrationDefinitions();
      const existingMigrations = readJsonFile<AppliedMigrationRecord[]>('schema_migrations.json', []);
      const existingMap = new Map<string, AppliedMigrationRecord>();
      for (const rec of existingMigrations) {
        existingMap.set(rec.version, rec);
      }

      const applied: string[] = [];
      const skipped: string[] = [];

      // Snapshot existing files for rollback if migration fails
      const usersSnapshot = fs.existsSync(path.join(getDataDir(), 'users.json'))
        ? readJsonFile<any[]>('users.json', DEFAULT_USERS)
        : null;
      const clientsSnapshot = fs.existsSync(path.join(getDataDir(), 'clients.json'))
        ? readJsonFile<any[]>('clients.json', [])
        : null;
      const docsSnapshot = fs.existsSync(path.join(getDataDir(), 'documents.json'))
        ? readJsonFile<any[]>('documents.json', [])
        : null;

      try {
        for (const def of definitions) {
          const prev = existingMap.get(def.version);
          if (prev) {
            if (prev.checksum !== def.checksum) {
              throw new PersistenceError(
                `Local migration checksum mismatch for version ${def.version} (${def.fileName})`
              );
            }
            skipped.push(def.version);
            continue;
          }
          applied.push(def.version);
          existingMigrations.push({
            version: def.version,
            name: def.name,
            checksum: def.checksum,
            appliedAt: new Date().toISOString(),
          });
        }

        const emailToUserId = new Map<string, string>();
        if (fs.existsSync(path.join(getDataDir(), 'users.json'))) {
          const allUsers = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
          let mutated = false;
          for (const u of allUsers) {
            if (!u.id) {
              u.id = generateRecordUuid();
              mutated = true;
            }
            if (!u.revision || u.revision < 1) {
              u.revision = 1;
              mutated = true;
            }
            if (u.email && u.id) {
              emailToUserId.set(u.email.toLowerCase(), u.id);
            }
          }
          if (mutated) {
            writeJsonFile('users.json', allUsers);
          }
        }

        if (fs.existsSync(path.join(getDataDir(), 'clients.json'))) {
          const allClients = readJsonFile<any[]>('clients.json', []);
          let mutated = false;
          for (const c of allClients) {
            if (!c.id) {
              c.id = generateRecordUuid();
              mutated = true;
            }
            if (!c.revision || c.revision < 1) {
              c.revision = 1;
              mutated = true;
            }
            if (!c.createdByEmail && c.createdBy) {
              c.createdByEmail = c.createdBy;
              mutated = true;
            }
            const lookupEmail = (c.createdByEmail || c.createdBy || '').toLowerCase();
            if (!c.createdByUserId && lookupEmail && emailToUserId.has(lookupEmail)) {
              c.createdByUserId = emailToUserId.get(lookupEmail);
              mutated = true;
            }
            if (c.pan && !c.pan.startsWith('v1:')) {
              c.pan = encryptGCM(c.pan);
              mutated = true;
            }
            if (c.aadhaar && !c.aadhaar.startsWith('v1:')) {
              c.aadhaar = encryptGCM(c.aadhaar);
              mutated = true;
            }
            if (!c.panHash && c.pan) {
              c.panHash = getDeterministicHash(c.pan);
              c.pan_hash = c.panHash;
              mutated = true;
            }
            if (!c.aadhaarHash && c.aadhaar) {
              c.aadhaarHash = getDeterministicHash(c.aadhaar);
              c.aadhaar_hash = c.aadhaarHash;
              mutated = true;
            }
          }
          if (mutated) {
            writeJsonFile('clients.json', allClients);
          }
        }

        if (fs.existsSync(path.join(getDataDir(), 'documents.json'))) {
          const allDocs = readJsonFile<any[]>('documents.json', []);
          let mutated = false;
          for (const d of allDocs) {
            if (!d.id) {
              d.id = generateRecordUuid();
              mutated = true;
            }
            if (!d.docNo) {
              d.docNo = allocateUniqueDocNoFromList(allDocs);
              mutated = true;
            }
            if (!d.revision || d.revision < 1) {
              d.revision = 1;
              if (d.state && typeof d.state === 'object') {
                d.state.revision = 1;
              }
              mutated = true;
            }
            if (!d.createdByEmail && d.createdBy) {
              d.createdByEmail = d.createdBy;
              mutated = true;
            }
            const lookupEmail = (d.createdByEmail || d.createdBy || '').toLowerCase();
            if (!d.createdByUserId && lookupEmail && emailToUserId.has(lookupEmail)) {
              d.createdByUserId = emailToUserId.get(lookupEmail);
              if (d.state && typeof d.state === 'object') {
                d.state.createdByUserId = d.createdByUserId;
              }
              mutated = true;
            }
            if (d.state && Array.isArray(d.state.parties)) {
              for (const p of d.state.parties) {
                if (p.pan && !p.pan.startsWith('v1:')) {
                  p.pan = encryptGCM(p.pan);
                  mutated = true;
                }
                if (p.aadhaar && !p.aadhaar.startsWith('v1:')) {
                  p.aadhaar = encryptGCM(p.aadhaar);
                  mutated = true;
                }
              }
            }
          }
          if (mutated) {
            writeJsonFile('documents.json', allDocs);
          }
        }

        if (applied.length > 0) {
          writeJsonFile('schema_migrations.json', existingMigrations);
        }

        return { applied, skipped, appliedMigrations: existingMigrations };
      } catch (err) {
        // Roll back snapshots on migration failure
        try {
          if (usersSnapshot !== null) writeJsonFile('users.json', usersSnapshot);
          if (clientsSnapshot !== null) writeJsonFile('clients.json', clientsSnapshot);
          if (docsSnapshot !== null) writeJsonFile('documents.json', docsSnapshot);
        } catch {
          // ignore rollback error if simulated write failure is active
        }
        throw err;
      }
    } finally {
      if (customDataDir) {
        if (prevDataDir === undefined) {
          delete process.env.DEEDOS_DATA_DIR;
        } else {
          process.env.DEEDOS_DATA_DIR = prevDataDir;
        }
      }
    }
  });
}

// One-time self-healing data migration on startup
export async function migrateAndBootstrap(env: NodeJS.ProcessEnv = process.env) {
  validateDatabaseMode(env);

  if (!isPostgres) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: PostgreSQL is required in production. Silent fallback to local JSON storage is prohibited.'
      );
    }
    await runLocalDataMigrations();
    return;
  }

  try {
    await initDatabase();

    // 1. Migrate Users if table is empty
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const count = Number(userCount[0]?.count || 0);
    if (count === 0) {
      const legacyUsers = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
      await withTransaction(async (client) => {
        for (const u of legacyUsers) {
          await client.execute(
            `
            INSERT INTO users (id, name, email, phone, organization, role, permissions, status, password_hash, created_at, revision, must_reset_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
          `,
            [
              u.id || generateRecordUuid(),
              u.name,
              u.email,
              u.phone || '',
              u.organization || '',
              u.role,
              JSON.stringify(u.permissions || ['view_own_deeds']),
              u.status,
              u.passwordHash || '',
              u.createdAt || new Date().toISOString(),
              Number(u.revision) >= 1 ? Number(u.revision) : 1,
              Boolean(u.mustResetPassword),
            ]
          );
        }
      });
    }

    // 2. Migrate Clients if table is empty
    const clientCount = await query('SELECT COUNT(*) as count FROM clients');
    const cCount = Number(clientCount[0]?.count || 0);
    if (cCount === 0) {
      const legacyClients = readJsonFile<DbClient[]>('clients.json', []);
      if (legacyClients && legacyClients.length > 0) {
        await withTransaction(async (client) => {
          for (const c of legacyClients) {
            await client.execute(
              `
              INSERT INTO clients (
                id, name, father_name, dob, age, occupation, pan, aadhaar, pan_hash, aadhaar_hash,
                address, phone, email, created_at, created_by, created_by_user_id, created_by_email,
                assigned_to_user_id, assigned_to, revision
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
              ON CONFLICT (id) DO NOTHING
            `,
              [
                c.id || generateRecordUuid(),
                c.name,
                c.fatherName,
                c.dob,
                c.age,
                c.occupation,
                encryptGCM(c.pan),
                encryptGCM(c.aadhaar),
                getDeterministicHash(c.pan),
                getDeterministicHash(c.aadhaar),
                c.address,
                c.phone,
                c.email,
                c.createdAt,
                c.createdBy || c.createdByEmail || null,
                c.createdByUserId || null,
                c.createdByEmail || c.createdBy || null,
                c.assignedToUserId || null,
                c.assignedTo || null,
                Number(c.revision) >= 1 ? Number(c.revision) : 1,
              ]
            );
          }
        });
      }
    }

    // 3. Migrate Documents if table is empty
    const docCount = await query('SELECT COUNT(*) as count FROM documents');
    const dCount = Number(docCount[0]?.count || 0);
    if (dCount === 0) {
      const legacyDocs = readJsonFile<DbDocument[]>('documents.json', []);
      if (legacyDocs && legacyDocs.length > 0) {
        await withTransaction(async (client) => {
          for (const doc of legacyDocs) {
            const surveyNo = doc.state?.surveys?.[0]?.surveyNo || doc.state?.survey?.surveyNo || null;
            const subDivision = doc.state?.surveys?.[0]?.subDivision || doc.state?.survey?.subDivision || null;
            const village = doc.state?.property?.village || null;
            const rev = Number(doc.revision) >= 1 ? Number(doc.revision) : 1;

            const clonedState = JSON.parse(JSON.stringify(doc.state || {}));
            clonedState.revision = rev;
            if (Array.isArray(clonedState.parties)) {
              clonedState.parties = encryptParties(clonedState.parties);
            }

            await client.execute(
              `
              INSERT INTO documents (
                id, doc_no, doc_type, sub_type, parties_count, property_address,
                consideration, status, writer, progress, created_at, modified_at, created_by,
                created_by_user_id, created_by_email, assigned_to_user_id, assigned_to, state,
                survey_no, sub_division, village, revision
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
              ON CONFLICT (id) DO NOTHING
            `,
              [
                doc.id || generateRecordUuid(),
                doc.docNo,
                doc.docType,
                doc.subType,
                doc.partiesCount,
                doc.propertyAddress,
                doc.consideration,
                doc.status,
                doc.writer,
                doc.progress,
                doc.createdAt,
                doc.modifiedAt,
                doc.createdBy,
                doc.createdByUserId || clonedState?.createdByUserId || null,
                doc.createdByEmail || doc.createdBy || clonedState?.createdByEmail || null,
                doc.assignedToUserId || clonedState?.assignedToUserId || null,
                doc.assignedTo || clonedState?.assignedTo || null,
                JSON.stringify(clonedState),
                surveyNo,
                subDivision || '',
                village,
                rev,
              ]
            );
          }
        });
      }
    }

    await runLocalDataMigrations();
  } catch (err) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `FATAL DATABASE ERROR: PostgreSQL migration/bootstrap failed in production; silent fallback to JSON storage is prohibited: ${(err as Error)?.message || String(err)}`
      );
    }
    console.warn(
      'PostgreSQL connection/bootstrapping failed in non-production mode. Falling back to Local JSON storage:',
      err
    );
    disablePostgres(env);
    await runLocalDataMigrations();
  }
}

// Unified Repository Interface with Per-Record Operations & Optimistic Concurrency
export const db = {
  getStorageInfo: () => ({
    isPostgres,
    engine: isPostgres ? 'postgresql' : 'local_json'
  }),
  // =========================================================================
  // USERS (Per-Record + List)
  // =========================================================================
  getUsers: async (): Promise<DbUser[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM users ORDER BY created_at DESC');
      return rows.map((r) => ({
        ...r,
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions || [],
        passwordHash: r.password_hash,
        createdAt: r.created_at,
        updatedAt: r.updated_at || undefined,
        revision: Number(r.revision) >= 1 ? Number(r.revision) : 1,
        mustResetPassword: r.must_reset_password,
      }));
    }
    const list = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
    return list.map((u) => ({
      ...u,
      revision: Number(u.revision) >= 1 ? Number(u.revision) : 1,
    }));
  },

  getUserById: async (id: string): Promise<DbUser | null> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
      if (!rows.length) return null;
      const r = rows[0];
      return {
        ...r,
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions || [],
        passwordHash: r.password_hash,
        createdAt: r.created_at,
        updatedAt: r.updated_at || undefined,
        revision: Number(r.revision) >= 1 ? Number(r.revision) : 1,
        mustResetPassword: r.must_reset_password,
      };
    }
    const users = await db.getUsers();
    return users.find((u) => u.id === id) || null;
  },

  getUserByEmail: async (email: string): Promise<DbUser | null> => {
    const normalized = email.trim().toLowerCase();
    if (isPostgres) {
      const rows = await query('SELECT * FROM users WHERE lower(email) = $1 LIMIT 1', [normalized]);
      if (!rows.length) return null;
      const r = rows[0];
      return {
        ...r,
        permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions || [],
        passwordHash: r.password_hash,
        createdAt: r.created_at,
        updatedAt: r.updated_at || undefined,
        revision: Number(r.revision) >= 1 ? Number(r.revision) : 1,
        mustResetPassword: r.must_reset_password,
      };
    }
    const users = await db.getUsers();
    return users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  createUser: async (user: Omit<DbUser, 'id' | 'revision'> & { id?: string }): Promise<DbUser> => {
    const recordId = user.id && user.id.trim() ? user.id.trim() : generateRecordUuid();
    const now = new Date().toISOString();
    const newUser: DbUser = {
      ...user,
      id: recordId,
      createdAt: user.createdAt || now,
      updatedAt: now,
      revision: 1,
    };

    if (isPostgres) {
      const existing = await query('SELECT id FROM users WHERE id = $1 OR lower(email) = $2 LIMIT 1', [
        newUser.id,
        newUser.email.toLowerCase(),
      ]);
      if (existing.length > 0) {
        throw new DuplicateRecordError('Conflict: User with this ID or email already exists.');
      }
      await execute(
        `
        INSERT INTO users (id, name, email, phone, organization, role, permissions, status, password_hash, created_at, updated_at, revision, must_reset_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12)
      `,
        [
          newUser.id,
          newUser.name,
          newUser.email,
          newUser.phone || '',
          newUser.organization || '',
          newUser.role,
          JSON.stringify(newUser.permissions || ['view_own_deeds']),
          newUser.status,
          newUser.passwordHash || '',
          newUser.createdAt,
          newUser.updatedAt,
          Boolean(newUser.mustResetPassword),
        ]
      );
      return newUser;
    }

    return withStorageLock(() => {
      const users = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
      if (users.some((u) => u.id === newUser.id || u.email.toLowerCase() === newUser.email.toLowerCase())) {
        throw new DuplicateRecordError('Conflict: User with this ID or email already exists.');
      }
      const nextUsers = [...users, newUser];
      writeJsonFile('users.json', nextUsers);
      return newUser;
    });
  },

  updateUser: async (
    id: string,
    updater: Partial<DbUser> | ((existing: DbUser) => DbUser),
    expectedRevision?: number
  ): Promise<DbUser> => {
    if (isPostgres) {
      return withTransaction(async (tx) => {
        const rows = await tx.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
        if (!rows.length) {
          throw new RecordNotFoundError('User not found.');
        }
        const r = rows[0];
        const existing: DbUser = {
          ...r,
          permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions || [],
          passwordHash: r.password_hash,
          createdAt: r.created_at,
          updatedAt: r.updated_at || undefined,
          revision: Number(r.revision) >= 1 ? Number(r.revision) : 1,
          mustResetPassword: r.must_reset_password,
        };

        if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
          throw new ConcurrencyConflictError(
            `Conflict: User ${id} revision mismatch (expected ${expectedRevision}, actual ${existing.revision}).`
          );
        }

        const merged = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
        const nextRevision = (existing.revision || 1) + 1;
        const updatedUser: DbUser = {
          ...merged,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          revision: nextRevision,
        };

        const res = await tx.execute(
          `
          UPDATE users SET
            name = $1,
            email = $2,
            phone = $3,
            organization = $4,
            role = $5,
            permissions = $6,
            status = $7,
            password_hash = $8,
            must_reset_password = $9,
            updated_at = $10,
            revision = $11
          WHERE id = $12 AND revision = $13
        `,
          [
            updatedUser.name,
            updatedUser.email,
            updatedUser.phone || '',
            updatedUser.organization || '',
            updatedUser.role,
            JSON.stringify(updatedUser.permissions || ['view_own_deeds']),
            updatedUser.status,
            updatedUser.passwordHash || '',
            Boolean(updatedUser.mustResetPassword),
            updatedUser.updatedAt,
            nextRevision,
            existing.id,
            existing.revision,
          ]
        );
        if (res.rowCount === 0) {
          throw new ConcurrencyConflictError('Conflict: User record was modified concurrently.');
        }
        return updatedUser;
      });
    }

    return withStorageLock(() => {
      const users = readJsonFile<DbUser[]>('users.json', DEFAULT_USERS);
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) {
        throw new RecordNotFoundError('User not found.');
      }
      const existing: DbUser = {
        ...users[index],
        revision: Number(users[index].revision) >= 1 ? Number(users[index].revision) : 1,
      };
      if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
        throw new ConcurrencyConflictError(
          `Conflict: User ${id} revision mismatch (expected ${expectedRevision}, actual ${existing.revision}).`
        );
      }
      const merged = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      const updatedUser: DbUser = {
        ...merged,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        revision: (existing.revision || 1) + 1,
      };
      const nextUsers = [...users];
      nextUsers[index] = updatedUser;
      writeJsonFile('users.json', nextUsers);
      return updatedUser;
    });
  },

  saveUsers: async (users: DbUser[]): Promise<void> => {
    const normalized = users.map((u) => ({
      ...u,
      id: u.id || generateRecordUuid(),
      revision: Number(u.revision) >= 1 ? Number(u.revision) : 1,
    }));
    if (isPostgres) {
      await withTransaction(async (client) => {
        for (const u of normalized) {
          await client.execute(
            `
            INSERT INTO users (id, name, email, phone, organization, role, permissions, status, password_hash, created_at, revision, must_reset_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              organization = EXCLUDED.organization,
              role = EXCLUDED.role,
              permissions = EXCLUDED.permissions,
              status = EXCLUDED.status,
              password_hash = EXCLUDED.password_hash,
              revision = EXCLUDED.revision,
              must_reset_password = EXCLUDED.must_reset_password
          `,
            [
              u.id,
              u.name,
              u.email,
              u.phone,
              u.organization,
              u.role,
              JSON.stringify(u.permissions),
              u.status,
              u.passwordHash,
              u.createdAt,
              u.revision,
              u.mustResetPassword || false,
            ]
          );
        }
      });
    } else {
      await withStorageLock(() => {
        writeJsonFile('users.json', normalized);
      });
    }
  },

  // =========================================================================
  // CLIENTS (Per-Record + List)
  // =========================================================================
  getClients: async (): Promise<DbClient[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM clients ORDER BY created_at DESC');
      const uniqueClients: DbClient[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (r.id && !seen.has(r.id)) {
          seen.add(r.id);
          uniqueClients.push(mapPgRowToClient(r));
        }
      }
      return uniqueClients;
    }
    const allClients = readJsonFile<any[]>('clients.json', []);
    const uniqueClients: DbClient[] = [];
    const seen = new Set<string>();
    for (const c of allClients) {
      if (c && c.id && !seen.has(c.id)) {
        seen.add(c.id);
        uniqueClients.push(mapJsonRecordToClient(c));
      }
    }
    return uniqueClients;
  },

  getClientById: async (id: string): Promise<DbClient | null> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM clients WHERE id = $1 LIMIT 1', [id]);
      if (!rows.length) return null;
      return mapPgRowToClient(rows[0]);
    }
    const allClients = readJsonFile<any[]>('clients.json', []);
    const matched = allClients.find((c) => c && c.id === id);
    return matched ? mapJsonRecordToClient(matched) : null;
  },

  createClient: async (
    clientData: Omit<DbClient, 'id' | 'revision'> & { id?: string }
  ): Promise<DbClient> => {
    const recordId = clientData.id && clientData.id.trim() ? clientData.id.trim() : generateRecordUuid();
    const now = new Date().toISOString();
    const panHash = getDeterministicHash(clientData.pan || '');
    const aadhaarHash = getDeterministicHash(clientData.aadhaar || '');

    const newClient: DbClient = {
      ...clientData,
      id: recordId,
      panHash: panHash || undefined,
      aadhaarHash: aadhaarHash || undefined,
      createdAt: clientData.createdAt || now,
      updatedAt: now,
      revision: 1,
    };

    if (isPostgres) {
      return withTransaction(async (tx) => {
        const existing = await tx.query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [newClient.id]);
        if (existing.length > 0) {
          throw new DuplicateRecordError(
            'Conflict: A client with this ID already exists. POST /api/clients is create-only; use PUT /api/clients/:id to update.'
          );
        }

        if (panHash || aadhaarHash) {
          const dupRows = await tx.query(
            `
            SELECT id FROM clients
            WHERE created_by_user_id = $1
              AND ((pan_hash IS NOT NULL AND pan_hash <> '' AND pan_hash = $2)
                OR (aadhaar_hash IS NOT NULL AND aadhaar_hash <> '' AND aadhaar_hash = $3))
            LIMIT 1
          `,
            [newClient.createdByUserId || '', panHash || '__none__', aadhaarHash || '__none__']
          );
          if (dupRows.length > 0) {
            throw new Error(
              'Duplicate client profile detected in your workspace. A client with this Aadhaar or PAN already exists.'
            );
          }
        }

        await tx.execute(
          `
          INSERT INTO clients (
            id, name, father_name, dob, age, occupation, pan, aadhaar, pan_hash, aadhaar_hash,
            address, phone, email, created_at, updated_at, created_by, created_by_user_id, created_by_email,
            assigned_to_user_id, assigned_to, revision
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 1)
        `,
          [
            newClient.id,
            newClient.name,
            newClient.fatherName,
            newClient.dob,
            newClient.age,
            newClient.occupation,
            encryptGCM(newClient.pan),
            encryptGCM(newClient.aadhaar),
            panHash || null,
            aadhaarHash || null,
            newClient.address,
            newClient.phone,
            newClient.email,
            newClient.createdAt,
            newClient.updatedAt,
            newClient.createdBy || newClient.createdByEmail || null,
            newClient.createdByUserId || null,
            newClient.createdByEmail || newClient.createdBy || null,
            newClient.assignedToUserId || null,
            newClient.assignedTo || null,
          ]
        );
        return newClient;
      });
    }

    return withStorageLock(() => {
      const rawClients = readJsonFile<any[]>('clients.json', []);
      if (rawClients.some((c) => c && c.id === newClient.id)) {
        throw new DuplicateRecordError(
          'Conflict: A client with this ID already exists. POST /api/clients is create-only; use PUT /api/clients/:id to update.'
        );
      }

      if (panHash || aadhaarHash) {
        const duplicateInWorkspace = rawClients.some((c) => {
          if (!c) return false;
          const mapped = mapJsonRecordToClient(c);
          const sameOwner =
            (newClient.createdByUserId && mapped.createdByUserId === newClient.createdByUserId) ||
            (!mapped.createdByUserId &&
              newClient.createdByEmail &&
              (mapped.createdByEmail || mapped.createdBy || '').toLowerCase() ===
                newClient.createdByEmail.toLowerCase());
          if (!sameOwner) return false;
          const cPanHash = mapped.panHash || getDeterministicHash(mapped.pan);
          const cAadhaarHash = mapped.aadhaarHash || getDeterministicHash(mapped.aadhaar);
          return Boolean((panHash && cPanHash === panHash) || (aadhaarHash && cAadhaarHash === aadhaarHash));
        });
        if (duplicateInWorkspace) {
          throw new Error(
            'Duplicate client profile detected in your workspace. A client with this Aadhaar or PAN already exists.'
          );
        }
      }

      const nextRaw = [serializeClientForDisk(newClient), ...rawClients];
      writeJsonFile('clients.json', nextRaw);
      return newClient;
    });
  },

  updateClient: async (
    id: string,
    updater: Partial<DbClient> | ((existing: DbClient) => DbClient),
    expectedRevision?: number
  ): Promise<DbClient> => {
    if (isPostgres) {
      return withTransaction(async (tx) => {
        const rows = await tx.query('SELECT * FROM clients WHERE id = $1 FOR UPDATE', [id]);
        if (!rows.length) {
          throw new RecordNotFoundError('Client not found.');
        }
        const existing = mapPgRowToClient(rows[0]);
        if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
          throw new ConcurrencyConflictError(
            `Conflict: Client ${id} has been modified by another request (expected revision ${expectedRevision}, current revision ${existing.revision}).`
          );
        }

        const rawCandidate = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
        const candidate = preserveClientProtectedValues(rawCandidate, existing);
        const nextRevision = (existing.revision || 1) + 1;
        const panHash = getDeterministicHash(candidate.pan || '');
        const aadhaarHash = getDeterministicHash(candidate.aadhaar || '');

        if (panHash || aadhaarHash) {
          const dupRows = await tx.query(
            `
            SELECT id FROM clients
            WHERE id <> $1
              AND created_by_user_id = $2
              AND ((pan_hash IS NOT NULL AND pan_hash <> '' AND pan_hash = $3)
                OR (aadhaar_hash IS NOT NULL AND aadhaar_hash <> '' AND aadhaar_hash = $4))
            LIMIT 1
          `,
            [existing.id, existing.createdByUserId || '', panHash || '__none__', aadhaarHash || '__none__']
          );
          if (dupRows.length > 0) {
            throw new Error(
              'Duplicate client profile detected in workspace. A client with this Aadhaar or PAN already exists.'
            );
          }
        }

        const updatedClient: DbClient = {
          ...candidate,
          id: existing.id,
          panHash: panHash || existing.panHash,
          aadhaarHash: aadhaarHash || existing.aadhaarHash,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          createdBy: existing.createdBy,
          createdByUserId: existing.createdByUserId,
          createdByEmail: existing.createdByEmail,
          revision: nextRevision,
        };

        const res = await tx.execute(
          `
          UPDATE clients SET
            name = $1,
            father_name = $2,
            dob = $3,
            age = $4,
            occupation = $5,
            pan = $6,
            aadhaar = $7,
            pan_hash = $8,
            aadhaar_hash = $9,
            address = $10,
            phone = $11,
            email = $12,
            updated_at = $13,
            assigned_to_user_id = $14,
            assigned_to = $15,
            revision = $16
          WHERE id = $17 AND revision = $18
        `,
          [
            updatedClient.name,
            updatedClient.fatherName,
            updatedClient.dob,
            updatedClient.age,
            updatedClient.occupation,
            encryptGCM(updatedClient.pan),
            encryptGCM(updatedClient.aadhaar),
            updatedClient.panHash || null,
            updatedClient.aadhaarHash || null,
            updatedClient.address,
            updatedClient.phone,
            updatedClient.email,
            updatedClient.updatedAt,
            updatedClient.assignedToUserId || null,
            updatedClient.assignedTo || null,
            nextRevision,
            existing.id,
            existing.revision,
          ]
        );
        if (res.rowCount === 0) {
          throw new ConcurrencyConflictError('Conflict: Client record was modified concurrently.');
        }
        return updatedClient;
      });
    }

    return withStorageLock(() => {
      const rawClients = readJsonFile<any[]>('clients.json', []);
      const idx = rawClients.findIndex((c) => c && c.id === id);
      if (idx === -1) {
        throw new RecordNotFoundError('Client not found.');
      }
      const existing = mapJsonRecordToClient(rawClients[idx]);
      if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
        throw new ConcurrencyConflictError(
          `Conflict: Client ${id} has been modified by another request (expected revision ${expectedRevision}, current revision ${existing.revision}).`
        );
      }

      const rawCandidate = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      const candidate = preserveClientProtectedValues(rawCandidate, existing);
      const panHash = getDeterministicHash(candidate.pan || '');
      const aadhaarHash = getDeterministicHash(candidate.aadhaar || '');

      if (panHash || aadhaarHash) {
        const duplicateInWorkspace = rawClients.some((c, i) => {
          if (!c || i === idx) return false;
          const mapped = mapJsonRecordToClient(c);
          const sameOwner =
            (existing.createdByUserId && mapped.createdByUserId === existing.createdByUserId) ||
            (!mapped.createdByUserId &&
              existing.createdByEmail &&
              (mapped.createdByEmail || mapped.createdBy || '').toLowerCase() ===
                existing.createdByEmail.toLowerCase());
          if (!sameOwner) return false;
          const cPanHash = mapped.panHash || getDeterministicHash(mapped.pan);
          const cAadhaarHash = mapped.aadhaarHash || getDeterministicHash(mapped.aadhaar);
          return Boolean((panHash && cPanHash === panHash) || (aadhaarHash && cAadhaarHash === aadhaarHash));
        });
        if (duplicateInWorkspace) {
          throw new Error(
            'Duplicate client profile detected in workspace. A client with this Aadhaar or PAN already exists.'
          );
        }
      }

      const updatedClient: DbClient = {
        ...candidate,
        id: existing.id,
        panHash: panHash || existing.panHash,
        aadhaarHash: aadhaarHash || existing.aadhaarHash,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        createdBy: existing.createdBy,
        createdByUserId: existing.createdByUserId,
        createdByEmail: existing.createdByEmail,
        revision: (existing.revision || 1) + 1,
      };

      const nextRaw = [...rawClients];
      nextRaw[idx] = serializeClientForDisk(updatedClient);
      writeJsonFile('clients.json', nextRaw);
      return updatedClient;
    });
  },

  deleteClient: async (id: string, expectedRevision?: number): Promise<DbClient> => {
    if (isPostgres) {
      return withTransaction(async (tx) => {
        const rows = await tx.query('SELECT * FROM clients WHERE id = $1 FOR UPDATE', [id]);
        if (!rows.length) {
          throw new RecordNotFoundError('Client not found.');
        }
        const existing = mapPgRowToClient(rows[0]);
        if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
          throw new ConcurrencyConflictError(
            `Conflict: Client ${id} revision mismatch on delete (expected ${expectedRevision}, current ${existing.revision}).`
          );
        }
        await tx.execute('DELETE FROM clients WHERE id = $1', [id]);
        return existing;
      });
    }

    return withStorageLock(() => {
      const rawClients = readJsonFile<any[]>('clients.json', []);
      const idx = rawClients.findIndex((c) => c && c.id === id);
      if (idx === -1) {
        throw new RecordNotFoundError('Client not found.');
      }
      const existing = mapJsonRecordToClient(rawClients[idx]);
      if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
        throw new ConcurrencyConflictError(
          `Conflict: Client ${id} revision mismatch on delete (expected ${expectedRevision}, current ${existing.revision}).`
        );
      }
      const nextRaw = rawClients.filter((c) => c && c.id !== id);
      writeJsonFile('clients.json', nextRaw);
      return existing;
    });
  },

  saveClients: async (clients: DbClient[]): Promise<void> => {
    const seen = new Set<string>();
    const uniqueClients = clients
      .filter((c) => {
        if (c && c.id && !seen.has(c.id)) {
          seen.add(c.id);
          return true;
        }
        return false;
      })
      .map((c) => ({
        ...c,
        revision: Number(c.revision) >= 1 ? Number(c.revision) : 1,
      }));

    if (isPostgres) {
      await withTransaction(async (client) => {
        if (uniqueClients.length === 0) {
          await client.execute('DELETE FROM clients');
          return;
        }
        for (const c of uniqueClients) {
          await client.execute(
            `
            INSERT INTO clients (
              id, name, father_name, dob, age, occupation, pan, aadhaar, pan_hash, aadhaar_hash,
              address, phone, email, created_at, created_by, created_by_user_id, created_by_email,
              assigned_to_user_id, assigned_to, revision
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              father_name = EXCLUDED.father_name,
              dob = EXCLUDED.dob,
              age = EXCLUDED.age,
              occupation = EXCLUDED.occupation,
              pan = EXCLUDED.pan,
              aadhaar = EXCLUDED.aadhaar,
              pan_hash = EXCLUDED.pan_hash,
              aadhaar_hash = EXCLUDED.aadhaar_hash,
              address = EXCLUDED.address,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              created_by = COALESCE(clients.created_by, EXCLUDED.created_by),
              created_by_user_id = COALESCE(clients.created_by_user_id, EXCLUDED.created_by_user_id),
              created_by_email = COALESCE(clients.created_by_email, EXCLUDED.created_by_email),
              assigned_to_user_id = EXCLUDED.assigned_to_user_id,
              assigned_to = EXCLUDED.assigned_to,
              revision = EXCLUDED.revision
          `,
            [
              c.id,
              c.name,
              c.fatherName,
              c.dob,
              c.age,
              c.occupation,
              encryptGCM(c.pan),
              encryptGCM(c.aadhaar),
              getDeterministicHash(c.pan),
              getDeterministicHash(c.aadhaar),
              c.address,
              c.phone,
              c.email,
              c.createdAt,
              c.createdBy || c.createdByEmail || null,
              c.createdByUserId || null,
              c.createdByEmail || c.createdBy || null,
              c.assignedToUserId || null,
              c.assignedTo || null,
              c.revision,
            ]
          );
        }
      });
    } else {
      await withStorageLock(() => {
        const encryptedClients = uniqueClients.map(serializeClientForDisk);
        writeJsonFile('clients.json', encryptedClients);
      });
    }
  },

  // =========================================================================
  // AUDIT LOGS (Append-Only Per-Record + List)
  // =========================================================================
  getAuditLogs: async (): Promise<DbAuditLog[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
      return rows.map((r) => ({
        ...r,
        userEmail: r.user_email,
        ipAddress: r.ip_address,
      }));
    }
    return readJsonFile<DbAuditLog[]>('audit_logs.json', []);
  },

  addAuditLog: async (log: Omit<DbAuditLog, 'id' | 'timestamp'>): Promise<DbAuditLog> => {
    const maskedDetails = maskPIIInText(log.details);
    const newLog: DbAuditLog = {
      id: generateRecordUuid(),
      timestamp: new Date().toISOString(),
      ...log,
      details: maskedDetails,
    };
    if (isPostgres) {
      await execute(
        `
        INSERT INTO audit_logs (id, timestamp, user_email, role, action, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          newLog.id,
          newLog.timestamp,
          newLog.userEmail,
          newLog.role,
          newLog.action,
          newLog.details,
          newLog.ipAddress,
        ]
      );
      return newLog;
    }

    return withStorageLock(() => {
      const logs = readJsonFile<DbAuditLog[]>('audit_logs.json', []);
      const nextLogs = [newLog, ...logs];
      writeJsonFile('audit_logs.json', nextLogs);
      return newLog;
    });
  },

  // =========================================================================
  // DOCUMENTS (Per-Record + List + Optimistic Concurrency + Unique DocNo)
  // =========================================================================
  getDocuments: async (): Promise<DbDocument[]> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM documents ORDER BY modified_at DESC');
      const uniqueDocs: DbDocument[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (r.id && !seen.has(r.id)) {
          seen.add(r.id);
          uniqueDocs.push(mapPgRowToDocument(r));
        }
      }
      return uniqueDocs;
    }
    const allDocs = readJsonFile<any[]>('documents.json', []);
    const uniqueDocs: DbDocument[] = [];
    const seen = new Set<string>();
    for (const d of allDocs) {
      if (d && d.id && !seen.has(d.id)) {
        seen.add(d.id);
        uniqueDocs.push(mapJsonRecordToDocument(d));
      }
    }
    return uniqueDocs;
  },

  getDocumentById: async (id: string): Promise<DbDocument | null> => {
    if (isPostgres) {
      const rows = await query('SELECT * FROM documents WHERE id = $1 LIMIT 1', [id]);
      if (!rows.length) return null;
      return mapPgRowToDocument(rows[0]);
    }
    const allDocs = readJsonFile<any[]>('documents.json', []);
    const matched = allDocs.find((d) => d && d.id === id);
    return matched ? mapJsonRecordToDocument(matched) : null;
  },

  allocateUniqueDocNo: async (year: number = new Date().getFullYear()): Promise<string> => {
    if (isPostgres) {
      const seqRows = await query(`SELECT nextval('deed_doc_no_seq') as seq`);
      const seq = Number(seqRows[0]?.seq || 1001);
      return `DEED/${year}/${String(seq).padStart(4, '0')}`;
    }
    const rawDocs = readJsonFile<any[]>('documents.json', []);
    return allocateUniqueDocNoFromList(rawDocs, year);
  },

  createDocument: async (
    docData: Omit<DbDocument, 'id' | 'docNo' | 'revision'> & {
      id?: string;
      docNo?: string;
      forceServerDocNo?: boolean;
    }
  ): Promise<DbDocument> => {
    const recordId = docData.id && docData.id.trim() ? docData.id.trim() : generateRecordUuid();
    const now = new Date().toISOString();

    if (isPostgres) {
      return withTransaction(async (tx) => {
        const existingId = await tx.query('SELECT id FROM documents WHERE id = $1 LIMIT 1', [recordId]);
        if (existingId.length > 0) {
          throw new DuplicateRecordError(
            'Conflict: A document with this ID already exists. POST /api/documents is create-only; use PUT /api/documents/:id to update an existing document.'
          );
        }

        let resolvedDocNo =
          !docData.forceServerDocNo && docData.docNo && docData.docNo.trim()
            ? docData.docNo.trim()
            : '';
        if (!resolvedDocNo) {
          const seqRows = await tx.query(`SELECT nextval('deed_doc_no_seq') as seq`);
          const seq = Number(seqRows[0]?.seq || 1001);
          resolvedDocNo = `DEED/${new Date().getFullYear()}/${String(seq).padStart(4, '0')}`;
        }

        const existingDocNo = await tx.query('SELECT id FROM documents WHERE lower(doc_no) = $1 LIMIT 1', [
          resolvedDocNo.toLowerCase(),
        ]);
        if (existingDocNo.length > 0) {
          throw new DuplicateRecordError(
            `Conflict: Document reference number '${resolvedDocNo}' is already assigned to another record.`
          );
        }

        const surveyNo = docData.state?.surveys?.[0]?.surveyNo || docData.state?.survey?.surveyNo || null;
        const subDivision = docData.state?.surveys?.[0]?.subDivision || docData.state?.survey?.subDivision || null;
        const village = docData.state?.property?.village || null;

        const stateForUser = JSON.parse(JSON.stringify(docData.state || {}));
        const ver = Number(docData.version || stateForUser.version) >= 1 ? Number(docData.version || stateForUser.version) : 1;
        const revHistory = Array.isArray(docData.revisionHistory)
          ? docData.revisionHistory
          : Array.isArray(stateForUser.revisionHistory)
            ? stateForUser.revisionHistory
            : [];
        stateForUser.revision = 1;
        stateForUser.version = ver;
        stateForUser.revisionHistory = revHistory;
        stateForUser.docNumber = resolvedDocNo;

        const newDoc: DbDocument = {
          ...docData,
          id: recordId,
          docNo: resolvedDocNo,
          createdAt: docData.createdAt || now,
          modifiedAt: docData.modifiedAt || now,
          revision: 1,
          version: ver,
          revisionHistory: revHistory,
          state: stateForUser,
        };

        const diskDoc = serializeDocumentForDisk(newDoc);

        await tx.execute(
          `
          INSERT INTO documents (
            id, doc_no, doc_type, sub_type, parties_count, property_address,
            consideration, status, writer, progress, created_at, modified_at, created_by,
            created_by_user_id, created_by_email, assigned_to_user_id, assigned_to, state,
            survey_no, sub_division, village, revision
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 1)
        `,
          [
            diskDoc.id,
            diskDoc.docNo,
            diskDoc.docType,
            diskDoc.subType,
            diskDoc.partiesCount,
            diskDoc.propertyAddress,
            diskDoc.consideration,
            diskDoc.status,
            diskDoc.writer,
            diskDoc.progress,
            diskDoc.createdAt,
            diskDoc.modifiedAt,
            diskDoc.createdBy,
            diskDoc.createdByUserId || null,
            diskDoc.createdByEmail || diskDoc.createdBy || null,
            diskDoc.assignedToUserId || null,
            diskDoc.assignedTo || null,
            JSON.stringify(diskDoc.state),
            surveyNo,
            subDivision || '',
            village,
          ]
        );

        return newDoc;
      });
    }

    return withStorageLock(() => {
      const rawDocs = readJsonFile<any[]>('documents.json', []);
      if (rawDocs.some((d) => d && d.id === recordId)) {
        throw new DuplicateRecordError(
          'Conflict: A document with this ID already exists. POST /api/documents is create-only; use PUT /api/documents/:id to update an existing document.'
        );
      }

      const requestedDocNo =
        !docData.forceServerDocNo && docData.docNo && docData.docNo.trim()
          ? docData.docNo.trim()
          : '';
      const resolvedDocNo = requestedDocNo || allocateUniqueDocNoFromList(rawDocs);

      if (
        rawDocs.some(
          (d) => d && typeof d.docNo === 'string' && d.docNo.trim().toLowerCase() === resolvedDocNo.toLowerCase()
        )
      ) {
        throw new DuplicateRecordError(
          `Conflict: Document reference number '${resolvedDocNo}' is already assigned to another record.`
        );
      }

      const stateForUser = JSON.parse(JSON.stringify(docData.state || {}));
      const ver = Number(docData.version || stateForUser.version) >= 1 ? Number(docData.version || stateForUser.version) : 1;
      const revHistory = Array.isArray(docData.revisionHistory)
        ? docData.revisionHistory
        : Array.isArray(stateForUser.revisionHistory)
          ? stateForUser.revisionHistory
          : [];
      stateForUser.revision = 1;
      stateForUser.version = ver;
      stateForUser.revisionHistory = revHistory;
      if (!stateForUser.docNumber) {
        stateForUser.docNumber = resolvedDocNo;
      }

      const newDoc: DbDocument = {
        ...docData,
        id: recordId,
        docNo: resolvedDocNo,
        createdAt: docData.createdAt || now,
        modifiedAt: docData.modifiedAt || now,
        revision: 1,
        version: ver,
        revisionHistory: revHistory,
        state: stateForUser,
      };

      const nextRaw = [serializeDocumentForDisk(newDoc), ...rawDocs];
      writeJsonFile('documents.json', nextRaw);
      return newDoc;
    });
  },

  updateDocument: async (
    id: string,
    updater: Partial<DbDocument> | ((existing: DbDocument) => DbDocument),
    expectedRevision?: number
  ): Promise<DbDocument> => {
    if (isPostgres) {
      return withTransaction(async (tx) => {
        const rows = await tx.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
        if (!rows.length) {
          throw new RecordNotFoundError('Document draft not found.');
        }
        const existing = mapPgRowToDocument(rows[0]);
        if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
          throw new ConcurrencyConflictError(
            `Conflict: Document ${id} has been modified by another transaction (expected revision ${expectedRevision}, current revision ${existing.revision}).`,
            existing,
            existing.revision
          );
        }

        const rawCandidate = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
        const candidate = {
          ...rawCandidate,
          state: preserveProtectedValuesOnSave(rawCandidate.state, existing.state),
        };
        const nextRevision = (existing.revision || 1) + 1;
        const resolvedDocNo = candidate.docNo && candidate.docNo.trim() ? candidate.docNo.trim() : existing.docNo;

        if (resolvedDocNo !== existing.docNo) {
          const dupDocNo = await tx.query(
            'SELECT id FROM documents WHERE lower(doc_no) = $1 AND id <> $2 LIMIT 1',
            [resolvedDocNo.toLowerCase(), existing.id]
          );
          if (dupDocNo.length > 0) {
            throw new DuplicateRecordError(
              `Conflict: Document reference '${resolvedDocNo}' is already used by another document.`
            );
          }
        }

        const surveyNo = candidate.state?.surveys?.[0]?.surveyNo || candidate.state?.survey?.surveyNo || null;
        const subDivision = candidate.state?.surveys?.[0]?.subDivision || candidate.state?.survey?.subDivision || null;
        const village = candidate.state?.property?.village || null;

        const stateForUser = JSON.parse(JSON.stringify(candidate.state || existing.state || {}));
        const ver =
          Number(candidate.version || stateForUser.version || existing.version) >= 1
            ? Number(candidate.version || stateForUser.version || existing.version)
            : 1;
        const revHistory = Array.isArray(candidate.revisionHistory)
          ? candidate.revisionHistory
          : Array.isArray(stateForUser.revisionHistory)
            ? stateForUser.revisionHistory
            : Array.isArray(existing.revisionHistory)
              ? existing.revisionHistory
              : [];
        stateForUser.revision = nextRevision;
        stateForUser.version = ver;
        stateForUser.revisionHistory = revHistory;
        stateForUser.docNumber = resolvedDocNo;

        const updatedDoc: DbDocument = {
          ...candidate,
          id: existing.id,
          docNo: resolvedDocNo,
          createdAt: existing.createdAt,
          modifiedAt: new Date().toISOString(),
          revision: nextRevision,
          version: ver,
          revisionHistory: revHistory,
          state: stateForUser,
        };

        const diskDoc = serializeDocumentForDisk(updatedDoc);

        const res = await tx.execute(
          `
          UPDATE documents SET
            doc_no = $1,
            doc_type = $2,
            sub_type = $3,
            parties_count = $4,
            property_address = $5,
            consideration = $6,
            status = $7,
            writer = $8,
            progress = $9,
            modified_at = $10,
            assigned_to_user_id = $11,
            assigned_to = $12,
            state = $13,
            survey_no = $14,
            sub_division = $15,
            village = $16,
            revision = $17
          WHERE id = $18 AND revision = $19
        `,
          [
            diskDoc.docNo,
            diskDoc.docType,
            diskDoc.subType,
            diskDoc.partiesCount,
            diskDoc.propertyAddress,
            diskDoc.consideration,
            diskDoc.status,
            diskDoc.writer,
            diskDoc.progress,
            diskDoc.modifiedAt,
            diskDoc.assignedToUserId || null,
            diskDoc.assignedTo || null,
            JSON.stringify(diskDoc.state),
            surveyNo,
            subDivision || '',
            village,
            nextRevision,
            existing.id,
            existing.revision,
          ]
        );
        if (res.rowCount === 0) {
          throw new ConcurrencyConflictError(
            'Conflict: Document record was modified concurrently.',
            existing,
            existing.revision
          );
        }

        return updatedDoc;
      });
    }

    return withStorageLock(() => {
      const rawDocs = readJsonFile<any[]>('documents.json', []);
      const idx = rawDocs.findIndex((d) => d && d.id === id);
      if (idx === -1) {
        throw new RecordNotFoundError('Document draft not found.');
      }

      const existing = mapJsonRecordToDocument(rawDocs[idx]);
      if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
        throw new ConcurrencyConflictError(
          `Conflict: Document ${id} has been modified by another transaction (expected revision ${expectedRevision}, current revision ${existing.revision}).`,
          existing,
          existing.revision
        );
      }

      const rawCandidate = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      const candidate = {
        ...rawCandidate,
        state: preserveProtectedValuesOnSave(rawCandidate.state, existing.state),
      };
      const nextRevision = (existing.revision || 1) + 1;
      const resolvedDocNo = candidate.docNo && candidate.docNo.trim() ? candidate.docNo.trim() : existing.docNo;

      if (resolvedDocNo !== existing.docNo) {
        const dupDoc = rawDocs.some(
          (d, i) =>
            d &&
            i !== idx &&
            d.id !== existing.id &&
            typeof d.docNo === 'string' &&
            d.docNo.trim().toLowerCase() === resolvedDocNo.toLowerCase()
        );
        if (dupDoc) {
          throw new DuplicateRecordError(
            `Conflict: Document reference '${resolvedDocNo}' is already used by another document.`
          );
        }
      }

      const stateForUser = JSON.parse(JSON.stringify(candidate.state || existing.state || {}));
      const ver =
        Number(candidate.version || stateForUser.version || existing.version) >= 1
          ? Number(candidate.version || stateForUser.version || existing.version)
          : 1;
      const revHistory = Array.isArray(candidate.revisionHistory)
        ? candidate.revisionHistory
        : Array.isArray(stateForUser.revisionHistory)
          ? stateForUser.revisionHistory
          : Array.isArray(existing.revisionHistory)
            ? existing.revisionHistory
            : [];
      stateForUser.revision = nextRevision;
      stateForUser.version = ver;
      stateForUser.revisionHistory = revHistory;
      stateForUser.docNumber = resolvedDocNo;

      const updatedDoc: DbDocument = {
        ...candidate,
        id: existing.id,
        docNo: resolvedDocNo,
        createdAt: existing.createdAt,
        modifiedAt: new Date().toISOString(),
        revision: nextRevision,
        version: ver,
        revisionHistory: revHistory,
        state: stateForUser,
      };

      const nextRaw = [...rawDocs];
      nextRaw[idx] = serializeDocumentForDisk(updatedDoc);
      writeJsonFile('documents.json', nextRaw);
      return updatedDoc;
    });
  },

  deleteDocument: async (id: string, expectedRevision?: number): Promise<DbDocument> => {
    if (isPostgres) {
      return withTransaction(async (tx) => {
        const rows = await tx.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
        if (!rows.length) {
          throw new RecordNotFoundError('Document not found.');
        }
        const existing = mapPgRowToDocument(rows[0]);
        if (existing.status === 'Finalized' || existing.status === 'Exported') {
          throw new FinalizedRecordLockedError(
            'REGISTRY LOCK: Finalized documents are immutable and cannot be deleted.'
          );
        }
        if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
          throw new ConcurrencyConflictError(
            `Conflict: Document ${id} revision mismatch on delete (expected ${expectedRevision}, current ${existing.revision}).`,
            existing,
            existing.revision
          );
        }
        await tx.execute('DELETE FROM documents WHERE id = $1', [id]);
        return existing;
      });
    }

    return withStorageLock(() => {
      const rawDocs = readJsonFile<any[]>('documents.json', []);
      const idx = rawDocs.findIndex((d) => d && d.id === id);
      if (idx === -1) {
        throw new RecordNotFoundError('Document not found.');
      }
      const existing = mapJsonRecordToDocument(rawDocs[idx]);
      if (existing.status === 'Finalized' || existing.status === 'Exported') {
        throw new FinalizedRecordLockedError(
          'REGISTRY LOCK: Finalized documents are immutable and cannot be deleted.'
        );
      }
      if (expectedRevision !== undefined && Number(expectedRevision) !== existing.revision) {
        throw new ConcurrencyConflictError(
          `Conflict: Document ${id} revision mismatch on delete (expected ${expectedRevision}, current ${existing.revision}).`,
          existing,
          existing.revision
        );
      }
      const nextRaw = rawDocs.filter((d) => d && d.id !== id);
      writeJsonFile('documents.json', nextRaw);
      return existing;
    });
  },

  saveDocuments: async (docs: DbDocument[]): Promise<void> => {
    const seen = new Set<string>();
    const uniqueDocs = docs
      .filter((d) => {
        if (d && d.id && !seen.has(d.id)) {
          seen.add(d.id);
          return true;
        }
        return false;
      })
      .map((d) => ({
        ...d,
        revision: Number(d.revision) >= 1 ? Number(d.revision) : 1,
      }));

    const preparedDocs = uniqueDocs.map(serializeDocumentForDisk);

    if (isPostgres) {
      await withTransaction(async (client) => {
        if (preparedDocs.length === 0) {
          await client.execute('DELETE FROM documents');
          return;
        }
        for (const doc of preparedDocs) {
          const surveyNo = doc.state?.surveys?.[0]?.surveyNo || doc.state?.survey?.surveyNo || null;
          const subDivision = doc.state?.surveys?.[0]?.subDivision || doc.state?.survey?.subDivision || null;
          const village = doc.state?.property?.village || null;

          await client.execute(
            `
            INSERT INTO documents (
              id, doc_no, doc_type, sub_type, parties_count, property_address,
              consideration, status, writer, progress, created_at, modified_at, created_by,
              created_by_user_id, created_by_email, assigned_to_user_id, assigned_to, state,
              survey_no, sub_division, village, revision
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            ON CONFLICT (id) DO UPDATE SET
              doc_no = EXCLUDED.doc_no,
              doc_type = EXCLUDED.doc_type,
              sub_type = EXCLUDED.sub_type,
              parties_count = EXCLUDED.parties_count,
              property_address = EXCLUDED.property_address,
              consideration = EXCLUDED.consideration,
              status = EXCLUDED.status,
              writer = EXCLUDED.writer,
              progress = EXCLUDED.progress,
              modified_at = EXCLUDED.modified_at,
              created_by = COALESCE(documents.created_by, EXCLUDED.created_by),
              created_by_user_id = COALESCE(documents.created_by_user_id, EXCLUDED.created_by_user_id),
              created_by_email = COALESCE(documents.created_by_email, EXCLUDED.created_by_email),
              assigned_to_user_id = EXCLUDED.assigned_to_user_id,
              assigned_to = EXCLUDED.assigned_to,
              state = EXCLUDED.state,
              survey_no = EXCLUDED.survey_no,
              sub_division = EXCLUDED.sub_division,
              village = EXCLUDED.village,
              revision = EXCLUDED.revision
          `,
            [
              doc.id,
              doc.docNo,
              doc.docType,
              doc.subType,
              doc.partiesCount,
              doc.propertyAddress,
              doc.consideration,
              doc.status,
              doc.writer,
              doc.progress,
              doc.createdAt,
              doc.modifiedAt,
              doc.createdBy,
              doc.createdByUserId || doc.state?.createdByUserId || null,
              doc.createdByEmail || doc.createdBy || doc.state?.createdByEmail || null,
              doc.assignedToUserId || doc.state?.assignedToUserId || null,
              doc.assignedTo || doc.state?.assignedTo || null,
              JSON.stringify(doc.state),
              surveyNo,
              subDivision || '',
              village,
              doc.revision || 1,
            ]
          );
        }
      });
    } else {
      await withStorageLock(() => {
        writeJsonFile('documents.json', preparedDocs);
      });
    }
  },
};

// ----------------------------------------------------------------------------
// MASTER DATA ENGINE FOR UNIKORN360 DEEDOS
// ----------------------------------------------------------------------------

export const MASTER_DATA_ENGINE = {
  documentTypes: [
    { id: 'dt1', code: 'SALE', nameEn: 'Sale Deed', nameTa: 'கிரயப் பத்திரம்', description: 'Absolute conveyance of immovable property title', templateAvailable: true },
    { id: 'dt2', code: 'SETTLEMENT', nameEn: 'Settlement Deed', nameTa: 'செட்டில்மெண்ட் பத்திரம்', description: 'Transfer of property among family/relatives', templateAvailable: true },
    { id: 'dt3', code: 'GIFT', nameEn: 'Gift Deed', nameTa: 'தான பத்திரம்', description: 'Voluntary transfer of property without monetary consideration', templateAvailable: true },
    { id: 'dt4', code: 'PARTITION', nameEn: 'Partition Deed', nameTa: 'பாகப்பிரிவினை பத்திரம்', description: 'Division of co-owned property among co-sharers', templateAvailable: true },
    { id: 'dt5', code: 'RELEASE', nameEn: 'Release Deed', nameTa: 'விடுதலைப் பத்திரம்', description: 'Relinquishment of rights over joint property', templateAvailable: false },
    { id: 'dt6', code: 'LEASE', nameEn: 'Lease Deed', nameTa: 'குத்தகை / வாடகை பத்திரம்', description: 'Transfer of right to enjoy property for fixed term', templateAvailable: true },
    { id: 'dt7', code: 'MORTGAGE', nameEn: 'Mortgage Deed', nameTa: 'அடமானப் பத்திரம்', description: 'Transfer of interest in property as security for loan', templateAvailable: true },
    { id: 'dt8', code: 'POA', nameEn: 'Power of Attorney', nameTa: 'பொது அதிகாரப் பத்திரம்', description: 'Appointment of agent to manage property', templateAvailable: true },
    { id: 'dt9', code: 'RECTIFICATION', nameEn: 'Rectification Deed', nameTa: 'பிழை திருத்தல் பத்திரம்', description: 'Correction of clerical/typographical errors in prior deed', templateAvailable: false },
    { id: 'dt10', code: 'CANCELLATION', nameEn: 'Cancellation Deed', nameTa: 'ரத்துப் பத்திரம்', description: 'Revocation or cancellation of a previously executed instrument', templateAvailable: false },
    { id: 'dt11', code: 'TRUST', nameEn: 'Trust Deed', nameTa: 'அறக்கட்டளை பத்திரம்', description: 'Creation of public/private trust', templateAvailable: false },
    { id: 'dt12', code: 'PARTNERSHIP', nameEn: 'Partnership Deed', nameTa: 'கூட்டாண்மை ஒப்பந்தப் பத்திரம்', description: 'Formation of a partnership firm', templateAvailable: false },
    { id: 'dt13', code: 'WILL', nameEn: 'Will', nameTa: 'உயில் சாசனம்', description: 'Testamentary disposition of property', templateAvailable: false }
  ],
  documentSubtypes: [
    { id: 'dst1', code: 'SALE_METRO', nameEn: 'Sale in Corporation / Metro Area', nameTa: 'மாநகராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst2', code: 'SALE_MUNI', nameEn: 'Sale in Municipality Area', nameTa: 'நகராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst3', code: 'SALE_RURAL', nameEn: 'Sale in Village Panchayat Area', nameTa: 'ஊராட்சி எல்லைக்குள் கிரயம்', extra: { docTypeCode: 'SALE' } },
    { id: 'dst4', code: 'SETTLE_FAMILY', nameEn: 'Family Settlement Deed', nameTa: 'குடும்ப உறுப்பினர்களுக்குள் செட்டில்மெண்ட்', extra: { docTypeCode: 'SETTLEMENT' } },
    { id: 'dst5', code: 'GIFT_NON_FAMILY', nameEn: 'Non-Family Gift Deed', nameTa: 'குடும்பம் அல்லாதவருக்கு கொடை', extra: { docTypeCode: 'GIFT' } },
    { id: 'dst6', code: 'LEASE_COMMERCIAL', nameEn: 'Commercial Property Lease', nameTa: 'வணிக பயன்பாட்டு குத்தகை', extra: { docTypeCode: 'LEASE' } },
    { id: 'dst7', code: 'MORTGAGE_SIMPLE', nameEn: 'Simple Mortgage without Possession', nameTa: 'சுவாதீனமில்லா எளிய அடமானம்', extra: { docTypeCode: 'MORTGAGE' } }
  ],
  partyRoles: [
    { id: 'pr1', code: 'SELLER', nameEn: 'Vendor / Seller', nameTa: 'விற்பனையாளர் / கிரயதாரர்', category: 'Transferor' },
    { id: 'pr2', code: 'BUYER', nameEn: 'Vendee / Purchaser', nameTa: 'வாங்குபவர்', category: 'Transferee' },
    { id: 'pr3', code: 'SETTLOR', nameEn: 'Settlor', nameTa: 'செட்டில்மெண்ட் செய்பவர்', category: 'Transferor' },
    { id: 'pr4', code: 'SETTLEE', nameEn: 'Settlee', nameTa: 'செட்டில்மெண்ட் பெறுபவர்', category: 'Transferee' },
    { id: 'pr5', code: 'DONOR', nameEn: 'Donor', nameTa: 'கொடையாளர்', category: 'Transferor' },
    { id: 'pr6', code: 'DONEE', nameEn: 'Donee', nameTa: 'கொடை பெறுபவர்', category: 'Transferee' },
    { id: 'pr7', code: 'LESSOR', nameEn: 'Lessor / Landlord', nameTa: 'சொத்து உரிமையாளர் / குத்தகை தருபவர்', category: 'Transferor' },
    { id: 'pr8', code: 'LESSEE', nameEn: 'Lessee / Tenant', nameTa: 'குத்தகைதாரர் / வாடகைதாரர்', category: 'Transferee' },
    { id: 'pr9', code: 'MORTGAGOR', nameEn: 'Mortgagor', nameTa: 'அடமானம் வைப்பவர்', category: 'Transferor' },
    { id: 'pr10', code: 'MORTGAGEE', nameEn: 'Mortgagee / Lender', nameTa: 'அடமானம் பெறுபவர் / கடன் தருபவர்', category: 'Transferee' },
    { id: 'pr11', code: 'POA_AGENT', nameEn: 'Power Agent', nameTa: 'பொது அதிகார முகவர்', category: 'Neutral' },
    { id: 'pr12', code: 'WITNESS', nameEn: 'Witness', nameTa: 'சாட்சி', category: 'Witness' }
  ],
  occupationMaster: [
    { id: 'oc1', code: 'AGRI', nameEn: 'Agriculture / Farming', nameTa: 'விவசாயம்' },
    { id: 'oc2', code: 'BIZ', nameEn: 'Business / Enterprise Owner', nameTa: 'தொழில் / வணிகம்' },
    { id: 'oc3', code: 'PVT', nameEn: 'Private Sector Employee', nameTa: 'தனியார் நிறுவன வேலை' },
    { id: 'oc4', code: 'GOVT', nameEn: 'Government Service Officer', nameTa: 'அரசுப் பணி' },
    { id: 'oc5', code: 'PROF', nameEn: 'Professional (Lawyer/Doctor/Eng)', nameTa: 'தொழில்முறை வல்லுநர்' },
    { id: 'oc6', code: 'HOMEMAKER', nameEn: 'Homemaker', nameTa: 'இல்லத்தரசி' },
    { id: 'oc7', code: 'RETIRED', nameEn: 'Retired Employee / Pensioner', nameTa: 'ஓய்வு பெற்றவர்' }
  ],
  relationshipMaster: [
    { id: 'rm1', code: 'S_O', nameEn: 'Son of', nameTa: 'மகன்' },
    { id: 'rm2', code: 'D_O', nameEn: 'Daughter of', nameTa: 'மகள்' },
    { id: 'rm3', code: 'W_O', nameEn: 'Wife of', nameTa: 'மனைவி' },
    { id: 'rm4', code: 'H_O', nameEn: 'Husband of', nameTa: 'கணவர்' },
    { id: 'rm5', code: 'C_O', nameEn: 'Care of', nameTa: 'பாதுகாவலர்' }
  ],
  districtMaster: [
    { id: 'd3', code: 'CHN', nameEn: 'Chennai', nameTa: 'சென்னை', registrationDistrict: 'Chennai South' },
    { id: 'd2', code: 'CGL', nameEn: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', registrationDistrict: 'Chengalpattu' },
    { id: 'd10', code: 'KCP', nameEn: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', registrationDistrict: 'Kanchipuram' },
    { id: 'd4', code: 'CBE', nameEn: 'Coimbatore', nameTa: 'கோயம்புத்தூர்', registrationDistrict: 'Coimbatore' },
    { id: 'd14', code: 'MDU', nameEn: 'Madurai', nameTa: 'மதுரை', registrationDistrict: 'Madurai' },
    { id: 'd29', code: 'TRY', nameEn: 'Tiruchirappalli', nameTa: 'திருச்சிராப்பள்ளி', registrationDistrict: 'Tiruchirappalli' },
    { id: 'd23', code: 'SLM', nameEn: 'Salem', nameTa: 'சேலம்', registrationDistrict: 'Salem' },
    { id: 'd36', code: 'VEL', nameEn: 'Vellore', nameTa: 'வேலூர்', registrationDistrict: 'Vellore' }
  ],
  talukMaster: [
    { id: 't1', code: 'MYL', nameEn: 'Mylapore', nameTa: 'மயிலாப்பூர்', extra: { districtCode: 'CHN' } },
    { id: 't2', code: 'SHO', nameEn: 'Sholinganallur', nameTa: 'சோழிங்கநல்லூர்', extra: { districtCode: 'CHN' } },
    { id: 't3', code: 'VEL_T', nameEn: 'Velachery', nameTa: 'வேளச்சேரி', extra: { districtCode: 'CHN' } },
    { id: 't4', code: 'CGL_T', nameEn: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', extra: { districtCode: 'CGL' } },
    { id: 't5', code: 'KCP_T', nameEn: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', extra: { districtCode: 'KCP' } },
    { id: 't6', code: 'CBE_S', nameEn: 'Coimbatore South', nameTa: 'தெற்கு கோயம்புத்தூர்', extra: { districtCode: 'CBE' } }
  ],
  villageMaster: [
    { id: 'v1', code: 'THIRU', nameEn: 'Thiruvanmiyur', nameTa: 'திருவான்மியூர்', extra: { talukCode: 'SHO' } },
    { id: 'v2', code: 'VEL_V', nameEn: 'Velachery Village', nameTa: 'வேளச்சேரி கிராமம்', extra: { talukCode: 'VEL_T' } },
    { id: 'v3', code: 'MYL_V', nameEn: 'Mylapore Town', nameTa: 'மயிலாப்பூர் நகரம்', extra: { talukCode: 'MYL' } },
    { id: 'v4', code: 'PER', nameEn: 'Perungudi', nameTa: 'பெருங்குடி', extra: { talukCode: 'SHO' } },
    { id: 'v5', code: 'KCP_TOWN', nameEn: 'Kanchipuram Town', nameTa: 'காஞ்சிபுரம் டவுன்', extra: { talukCode: 'KCP_T' } }
  ],
  sroMaster: [
    { id: 's1', code: 'SRO_MYL', nameEn: 'Mylapore SRO', nameTa: 'மயிலாப்பூர் சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1042' } },
    { id: 's2', code: 'SRO_VEL', nameEn: 'Velachery SRO', nameTa: 'வேளச்சேரி சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1043' } },
    { id: 's3', code: 'SRO_J1_S', nameEn: 'Joint I Chennai South SRO', nameTa: 'இணை I தென் சென்னை சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CHN', sroCode: '1001' } },
    { id: 's4', code: 'SRO_KCP', nameEn: 'Kanchipuram Joint SRO', nameTa: 'காஞ்சிபுரம் இணை சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'KCP', sroCode: '2010' } },
    { id: 's5', code: 'SRO_CGL', nameEn: 'Chengalpattu Joint I SRO', nameTa: 'செங்கல்பட்டு இணை I சார்பதிவாளர் அலுவலகம்', extra: { districtCode: 'CGL', sroCode: '3015' } }
  ],
  propertyTypeMaster: [
    { id: 'pt1', code: 'RES_PLOT', nameEn: 'Residential House Site / Plot', nameTa: 'மனை / குடியிருப்பு மனை', category: 'Land' },
    { id: 'pt2', code: 'AGRI_NANJAI', nameEn: 'Agricultural Wet Land (Nanjai)', nameTa: 'விவசாய நஞ்சை நிலம்', category: 'Agricultural' },
    { id: 'pt3', code: 'AGRI_PUNJAI', nameEn: 'Agricultural Dry Land (Punjai)', nameTa: 'விவசாய புஞ்சை நிலம்', category: 'Agricultural' },
    { id: 'pt4', code: 'COMM_PLOT', nameEn: 'Commercial Vacant Land', nameTa: 'வணிக காலி மனை', category: 'Land' },
    { id: 'pt5', code: 'FLAT_APT', nameEn: 'Flat / Residential Apartment Unit', nameTa: 'அடுக்குமாடி குடியிருப்பு', category: 'Flat' },
    { id: 'pt6', code: 'COMM_BLDG', nameEn: 'Commercial Building / Shop', nameTa: 'வணிகக் கட்டிடம் / கடை', category: 'Building' }
  ],
  clauseLibrary: [
    {
      id: 'cl1',
      code: 'CLAUSE_TITLE_GUARANTEE',
      title: 'Title Guarantee & Clear Encumbrance Covenant',
      category: 'Standard',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor hereby covenants that the Scheduled Property is free from all encumbrances, mortgages, liens, lis pendens, and legal attachments whatsoever, and that the Vendor possesses absolute title.',
      contentTa: 'விற்பனையாளர் இதன் மூலம் உறுதி அளிப்பது என்னவென்றால், அட்டவணைச் சொத்தில் எந்தவிதமான வில்லங்கமோ, கடன்களோ, அடமானமோ, அல்லது நீதிமன்ற ஜப்தியோ இல்லை.'
    },
    {
      id: 'cl2',
      code: 'CLAUSE_LEGAL_HEIR_INDEMNITY',
      title: 'Legal Heir Claims Indemnity Clause',
      category: 'Indemnity',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor hereby indemnifies the Purchaser against any future inheritance or legal heir claims that may be raised by minor or undisclosed legal heirs regarding the Scheduled Property.',
      contentTa: 'விற்பனையாளர் இதன் மூலம் உறுதி அளிப்பதாவது, இச்சொத்தின் மீது மைனர் அல்லது வெளிப்படுத்தப்படாத வாரிசுகளால் எதிர்காலத்தில் ஏதேனும் உரிமை கோரல் எழுந்தால், அதற்கு விற்பனையாளரே பொறுப்பேற்று நஷ்டஈடு வழங்குவார்.'
    },
    {
      id: 'cl3',
      code: 'CLAUSE_POSSESSION_DELIVERY',
      title: 'Delivery of Peaceful Physical Possession',
      category: 'Possession',
      isMandatory: true,
      isActive: true,
      contentEn: 'The Vendor confirms having delivered full, peaceful, and vacant physical possession of the Scheduled Property along with original parent title documents to the Purchaser.',
      contentTa: 'விற்பனையாளர் அட்டவணைச் சொத்தின் அமைதியான, பூரண சுயா தீன சுவாதீனத்தையும் அசல் தாய் பத்திரங்களையும் வாங்குபவரிடம் ஒப்படைத்து விட்டார்.'
    },
    {
      id: 'cl4',
      code: 'CLAUSE_STAMP_DUTY_UNDERVALUATION',
      title: 'Section 47A Stamp Duty Undertaking',
      category: 'Compliance',
      isMandatory: false,
      isActive: true,
      contentEn: 'In the event of any order passed under Section 47A of the Indian Stamp Act for under-valuation, the parties undertake to comply with the statutory directive within prescribed timelines.',
      contentTa: 'இந்திய முத்திரைச் சட்டப் பிரிவு 47A இன் கீழ் ஏதேனும் முத்திரைத்தாள் கூடுதல் கட்டண உத்தரவு பிறப்பிக்கப்பட்டால், சட்டப்படி அதற்குரிய தொகையை செலுத்த ஒப்புக்கொள்கிறார்கள்.'
    }
  ]
};

export function getMasterDataEngine(category?: string) {
  if (!category) {
    return MASTER_DATA_ENGINE;
  }

  const key = category.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof typeof MASTER_DATA_ENGINE;
  if (MASTER_DATA_ENGINE[key]) {
    return MASTER_DATA_ENGINE[key];
  }

  const map: Record<string, keyof typeof MASTER_DATA_ENGINE> = {
    'document-types': 'documentTypes',
    'document-subtypes': 'documentSubtypes',
    'party-roles': 'partyRoles',
    'occupations': 'occupationMaster',
    'relationships': 'relationshipMaster',
    'districts': 'districtMaster',
    'taluks': 'talukMaster',
    'villages': 'villageMaster',
    'sros': 'sroMaster',
    'property-types': 'propertyTypeMaster',
    'clauses': 'clauseLibrary'
  };

  const matchedKey = map[category.toLowerCase()];
  if (matchedKey && MASTER_DATA_ENGINE[matchedKey]) {
    return MASTER_DATA_ENGINE[matchedKey];
  }

  return MASTER_DATA_ENGINE;
}
