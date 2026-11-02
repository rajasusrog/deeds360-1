import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runSqlMigrations } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function isLocalPostgresUrl(connectionString?: string): boolean {
  if (!connectionString) return false;
  try {
    const parsed = new URL(connectionString);
    const host = (parsed.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    const lower = connectionString.toLowerCase();
    return lower.includes('@localhost') || lower.includes('@127.0.0.1') || lower.includes('host=localhost');
  }
}

/**
 * Builds PostgreSQL TLS configuration.
 * Remote PostgreSQL connections strictly verify TLS certificates (rejectUnauthorized: true).
 * Never disables certificate verification for remote hosts.
 */
export function buildPostgresSslConfig(
  connectionString?: string,
  env: NodeJS.ProcessEnv = process.env
): false | { rejectUnauthorized: true; ca?: string } {
  const isLocal = isLocalPostgresUrl(connectionString);
  const sslMode = (env.PGSSLMODE || '').trim().toLowerCase();

  if (
    env.PGSSLREJECTUNAUTHORIZED === '0' ||
    env.PGSSLREJECTUNAUTHORIZED?.toLowerCase() === 'false' ||
    sslMode === 'no-verify' ||
    (connectionString && connectionString.toLowerCase().includes('sslmode=no-verify'))
  ) {
    throw new Error(
      'SECURITY VIOLATION: Disabling PostgreSQL TLS certificate verification (rejectUnauthorized: false / sslmode=no-verify) is prohibited.'
    );
  }

  if (isLocal && sslMode !== 'require' && sslMode !== 'verify-ca' && sslMode !== 'verify-full') {
    return false;
  }

  let ca: string | undefined;
  if (env.DATABASE_SSL_CA && env.DATABASE_SSL_CA.trim()) {
    ca = env.DATABASE_SSL_CA.trim();
  } else if (env.PGSSLROOTCERT && fs.existsSync(env.PGSSLROOTCERT)) {
    ca = fs.readFileSync(env.PGSSLROOTCERT, 'utf-8');
  }

  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
  };
}

/**
 * Validates database configuration for the current environment.
 * In production (NODE_ENV === 'production'), requires a valid PostgreSQL DATABASE_URL
 * and prohibits silent fallback to local JSON storage.
 */
export function validateDatabaseMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const dbUrl = (env?.DATABASE_URL || '').trim();
  let host = '';
  try {
    if (dbUrl) {
      const parsed = new URL(dbUrl);
      host = (parsed.hostname || '').toLowerCase();
    }
  } catch {
    // String matching fallback
  }

  const isInvalidPlaceholderHost =
    !dbUrl ||
    host === 'base' ||
    host === 'none' ||
    dbUrl.includes('@base:') ||
    dbUrl.includes('://base') ||
    dbUrl.includes('//@base');

  const hasValidPgUrl = Boolean(dbUrl && !isInvalidPlaceholderHost);

  if (env?.NODE_ENV === 'production' && !hasValidPgUrl) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: A valid PostgreSQL DATABASE_URL is required in production. Silent fallback to JSON storage is prohibited.'
    );
  }

  return hasValidPgUrl;
}

export let isPostgres = validateDatabaseMode(process.env);
let pgPool: pg.Pool | null = null;

export function disablePostgres(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL DATABASE ERROR: PostgreSQL connection failed in production. Silent fallback to JSON storage is prohibited.'
    );
  }
  isPostgres = false;
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
}

if (isPostgres) {
  try {
    const sslConfig = buildPostgresSslConfig(process.env.DATABASE_URL, process.env);
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      ssl: sslConfig,
    });
    pgPool.on('error', (err) => {
      console.error('PostgreSQL pool background error:', err?.message || err);
      if (process.env.NODE_ENV !== 'production') {
        disablePostgres(process.env);
      }
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    console.warn('Failed to initialize PostgreSQL pool in non-production mode, falling back to JSON storage:', err);
    disablePostgres(process.env);
  }
} else {
  console.log('Using JSON storage local fallback (non-production mode)...');
}

// Helper to query PostgreSQL database
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return res.rows;
  }
  throw new Error('Database client not initialized in PostgreSQL mode.');
}

// Helper to execute SQL commands in PostgreSQL
export async function execute(sql: string, params: any[] = []): Promise<{ rowCount: number }> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return { rowCount: res.rowCount || 0 };
  }
  throw new Error('Database client not initialized in PostgreSQL mode.');
}

// Helper for ACID Transactions
export async function withTransaction<T>(
  callback: (client: { query: typeof query; execute: typeof execute }) => Promise<T>
): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const tQuery = async (sql: string, params: any[] = []) => {
        const res = await client.query(sql, params);
        return res.rows;
      };
      const tExecute = async (sql: string, params: any[] = []) => {
        const res = await client.query(sql, params);
        return { rowCount: res.rowCount || 0 };
      };
      const result = await callback({ query: tQuery, execute: tExecute });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error('ACID transactions helper is only available in PostgreSQL mode.');
}

// Initialize tables and run versioned migrations on startup
export async function initDatabase() {
  if (!pgPool) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: PostgreSQL pool is not initialized in production.');
    }
    return;
  }

  console.log('Running versioned PostgreSQL migrations...');
  const migrationResult = await runSqlMigrations({
    query,
    execute,
    withTransaction,
  });
  console.log(
    `PostgreSQL migrations completed (applied: [${migrationResult.applied.join(', ')}], skipped: [${migrationResult.skipped.join(', ')}]).`
  );
}
