/**
 * ============================================================================
 * RETIRED FIREBASE INTEGRATION STUB
 * ============================================================================
 * Firebase client-side authentication and direct Firestore client queries have
 * been retired in favor of the unified Supabase Auth + Backend PostgreSQL/API
 * architecture (`src/lib/supabase.ts` and `/api/*`).
 *
 * This module is intentionally disabled so no secondary client-side auth or
 * shadow Firestore read/write paths can execute.
 * ============================================================================
 */

import { UserAccount, UserRole } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export async function loginWithGoogle(): Promise<{ success: false; error: string }> {
  return {
    success: false,
    error: 'Legacy Firebase login is disabled. Authenticate via Supabase session only.',
  };
}

export async function getUserProfileFromFirestore(_uid: string): Promise<UserAccount | null> {
  return null;
}

export async function syncUserProfileToFirestore(_fbUser: unknown): Promise<null> {
  throw new Error('Legacy Firestore profile sync is disabled. Use /api/auth/sync-profile.');
}

export async function updateUserRoleInFirestore(_uid: string, _newRole: UserRole): Promise<never> {
  throw new Error('Legacy Firestore role update is disabled. Use PUT /api/auth/users/:id/role.');
}

export async function updateUserStatusInFirestore(
  _uid: string,
  _newStatus: 'Approved' | 'Pending Approval' | 'Suspended'
): Promise<never> {
  throw new Error('Legacy Firestore status update is disabled. Use PUT /api/auth/users/:id/status.');
}

export async function getAllUsersFromFirestore(): Promise<UserAccount[]> {
  return [];
}

export async function addAuditLogToFirestore(
  _type: string,
  _message: string,
  _userEmail: string
): Promise<void> {
  // No-op: Audit logs are persisted through authenticated backend /api/audit/log-action
}

export async function getAuditLogsFromFirestore(): Promise<any[]> {
  return [];
}

export function isFirebaseRetired(): boolean {
  return true;
}

