import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationDefinition {
  version: string;
  name: string;
  fileName: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRecord {
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface SqlMigrationExecutor {
  query: (sql: string, params?: any[]) => Promise<any[]>;
  execute: (sql: string, params?: any[]) => Promise<{ rowCount: number }>;
  withTransaction: <T>(
    fn: (tx: {
      query: (sql: string, params?: any[]) => Promise<any[]>;
      execute: (sql: string, params?: any[]) => Promise<{ rowCount: number }>;
    }) => Promise<T>
  ) => Promise<T>;
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function loadMigrationDefinitions(dir: string = MIGRATIONS_DIR): MigrationDefinition[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => {
    const fullPath = path.join(dir, fileName);
    const sql = fs.readFileSync(fullPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const base = fileName.replace(/\.sql$/i, '');
    const [versionPart, ...nameParts] = base.split('_');
    return {
      version: versionPart,
      name: nameParts.join('_') || base,
      fileName,
      sql,
      checksum,
    };
  });
}

/**
 * Runs versioned SQL migrations against a PostgreSQL executor.
 * Supports both fresh databases (0 migrations applied) and upgrade migrations
 * (where earlier migrations were already applied).
 * Rolls back the transaction if any migration statement fails.
 */
export async function runSqlMigrations(
  executor: SqlMigrationExecutor,
  migrations: MigrationDefinition[] = loadMigrationDefinitions()
): Promise<{ applied: string[]; skipped: string[] }> {
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      name TEXT NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existingRows = await executor.query(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC'
  );
  const existingMap = new Map<string, { version: string; name: string; checksum: string }>();
  for (const row of existingRows) {
    existingMap.set(String(row.version), {
      version: String(row.version),
      name: String(row.name),
      checksum: String(row.checksum),
    });
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const existing = existingMap.get(migration.version);
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `Migration checksum mismatch for version ${migration.version} (${migration.fileName}): expected ${existing.checksum}, got ${migration.checksum}`
        );
      }
      skipped.push(migration.version);
      continue;
    }

    await executor.withTransaction(async (tx) => {
      await tx.execute(migration.sql);
      await tx.execute(
        `INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, migration.checksum, new Date().toISOString()]
      );
    });

    applied.push(migration.version);
  }

  return { applied, skipped };
}

/**
 * Evaluates the user_profiles row-level security and trigger rules defined in
 * 003_rls_policies_and_grants.sql against candidate operations.
 * Used by local storage enforcement and policy verification tests.
 */
export interface UserProfileRecord {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
  permissions: string[];
  organization?: string;
  status: string;
  revision: number;
  created_at: string;
  last_login?: string;
  last_activity?: string;
  document_count?: number;
}

const ROOT_SUPER_ADMIN_EMAILS = ['clearfile360@gmail.com', 'raj.asusrog@gmail.com'];
const PRIVILEGED_ROLES = ['Super Admin', 'Admin', 'Auditor'];

export function evaluateUserProfilePolicy(params: {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  authUid: string | null;
  authEmail: string | null;
  callerProfile: UserProfileRecord | null;
  existingRow?: UserProfileRecord | null;
  incomingRow?: Partial<UserProfileRecord> | null;
}): { allowed: boolean; reason?: string; sanitizedRow?: UserProfileRecord } {
  const { operation, authUid, authEmail, callerProfile, existingRow, incomingRow } = params;
  if (!authUid || !authEmail) {
    return { allowed: false, reason: 'Unauthenticated caller denied by RLS' };
  }

  const normalizedAuthEmail = authEmail.trim().toLowerCase();
  const callerActive =
    callerProfile !== null &&
    ['active', 'approved'].includes((callerProfile.status || '').trim().toLowerCase());
  const callerRole = callerActive ? callerProfile!.role : null;
  const isSuperAdmin = callerActive && callerRole === 'Super Admin';
  const isAdmin = callerActive && (callerRole === 'Super Admin' || callerRole === 'Admin');
  const isAuditor = callerActive && callerRole === 'Auditor';

  if (operation === 'SELECT') {
    if (!existingRow) {
      return { allowed: false, reason: 'Target profile does not exist' };
    }
    if (existingRow.id === authUid || isAdmin || isAuditor) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'RLS SELECT denied: non-admin can only read own profile' };
  }

  if (operation === 'INSERT') {
    if (!incomingRow) {
      return { allowed: false, reason: 'Missing incoming row' };
    }
    if (incomingRow.id && incomingRow.id !== authUid && !isSuperAdmin) {
      return { allowed: false, reason: 'Forbidden: Profile ID must match authenticated user ID' };
    }
    const targetEmail = (incomingRow.email || normalizedAuthEmail).trim().toLowerCase();
    if (targetEmail !== normalizedAuthEmail && !isSuperAdmin) {
      return { allowed: false, reason: 'Forbidden: Profile email must match verified token email' };
    }

    const isRootAllowlisted = ROOT_SUPER_ADMIN_EMAILS.includes(targetEmail);
    const requestedRole = incomingRow.role || (isRootAllowlisted ? 'Super Admin' : 'Client');
    const requestedStatus = incomingRow.status || (isRootAllowlisted ? 'active' : 'pending');

    if (!isSuperAdmin) {
      if (isRootAllowlisted) {
        if (requestedRole !== 'Super Admin' || !['active', 'approved'].includes(requestedStatus.toLowerCase())) {
          return { allowed: false, reason: 'RLS WITH CHECK failed for allowlisted Super Admin insert' };
        }
      } else {
        if (requestedRole !== 'Client' || !['pending', 'pending approval'].includes(requestedStatus.toLowerCase())) {
          return {
            allowed: false,
            reason: 'RLS WITH CHECK failed: Ordinary users cannot insert elevated role or active status',
          };
        }
        if (
          incomingRow.permissions &&
          JSON.stringify(incomingRow.permissions) !== JSON.stringify(['view_own_deeds'])
        ) {
          return {
            allowed: false,
            reason: 'RLS WITH CHECK failed: Ordinary users cannot insert custom permissions',
          };
        }
      }
    }

    const now = new Date().toISOString();
    return {
      allowed: true,
      sanitizedRow: {
        id: incomingRow.id || authUid,
        full_name: incomingRow.full_name || targetEmail.split('@')[0],
        email: targetEmail,
        avatar_url: incomingRow.avatar_url || '',
        role: isSuperAdmin ? requestedRole : isRootAllowlisted ? 'Super Admin' : 'Client',
        permissions: isSuperAdmin
          ? incomingRow.permissions || ['*']
          : isRootAllowlisted
          ? ['*']
          : ['view_own_deeds'],
        organization: incomingRow.organization || 'Independent Workspace',
        status: isSuperAdmin ? requestedStatus : isRootAllowlisted ? 'active' : 'pending',
        revision: 1,
        created_at: now,
        last_login: now,
        last_activity: now,
        document_count: incomingRow.document_count ?? 0,
      },
    };
  }

  if (operation === 'UPDATE') {
    if (!existingRow || !incomingRow) {
      return { allowed: false, reason: 'Missing existing or incoming row for UPDATE' };
    }
    if (!callerActive) {
      return { allowed: false, reason: 'RLS USING denied: Pending/Suspended/Deleted caller cannot update profile' };
    }

    if (incomingRow.id !== undefined && incomingRow.id !== existingRow.id) {
      return { allowed: false, reason: 'Forbidden: Cannot modify immutable user profile ID' };
    }

    if (
      incomingRow.email !== undefined &&
      incomingRow.email.trim().toLowerCase() !== existingRow.email.trim().toLowerCase() &&
      !isSuperAdmin
    ) {
      return { allowed: false, reason: 'Forbidden: Cannot modify verified profile email' };
    }

    // Ordinary user updating own profile
    if (!isAdmin) {
      if (existingRow.id !== authUid) {
        return { allowed: false, reason: 'RLS USING denied: Cannot update another user profile' };
      }
      if (
        (incomingRow.role !== undefined && incomingRow.role !== existingRow.role) ||
        (incomingRow.status !== undefined && incomingRow.status !== existingRow.status) ||
        (incomingRow.permissions !== undefined &&
          JSON.stringify(incomingRow.permissions) !== JSON.stringify(existingRow.permissions)) ||
        (incomingRow.created_at !== undefined && incomingRow.created_at !== existingRow.created_at)
      ) {
        return {
          allowed: false,
          reason: 'Forbidden: Ordinary users cannot modify authorization fields (role, status, permissions)',
        };
      }
    } else if (!isSuperAdmin && callerRole === 'Admin') {
      // Admin cannot modify or assign Super Admin, Admin, or Auditor
      const nextRole = incomingRow.role ?? existingRow.role;
      if (PRIVILEGED_ROLES.includes(existingRow.role) || PRIVILEGED_ROLES.includes(nextRole)) {
        return {
          allowed: false,
          reason: 'Forbidden: Only Super Admin can assign or modify privileged roles',
        };
      }
    }

    return {
      allowed: true,
      sanitizedRow: {
        ...existingRow,
        full_name: incomingRow.full_name ?? existingRow.full_name,
        avatar_url: incomingRow.avatar_url ?? existingRow.avatar_url,
        organization: incomingRow.organization ?? existingRow.organization,
        role: isAdmin ? (incomingRow.role ?? existingRow.role) : existingRow.role,
        status: isAdmin ? (incomingRow.status ?? existingRow.status) : existingRow.status,
        permissions: isAdmin ? (incomingRow.permissions ?? existingRow.permissions) : existingRow.permissions,
        last_login: incomingRow.last_login ?? existingRow.last_login,
        last_activity: incomingRow.last_activity ?? new Date().toISOString(),
        revision: (existingRow.revision || 1) + 1,
      },
    };
  }

  if (operation === 'DELETE') {
    if (isSuperAdmin) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'RLS DELETE denied: Only Super Admin can delete profiles' };
  }

  return { allowed: false, reason: 'Unsupported operation' };
}
