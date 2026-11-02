import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { UserAccount, UserRole, UserProfile, AuditLogRecord } from '../types';

// Environment variable retrieval with safe fallback
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://mock-placeholder.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key-placeholder';

export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL && 
  env.VITE_SUPABASE_ANON_KEY &&
  env.VITE_SUPABASE_URL !== 'https://mock-placeholder.supabase.co'
);

// Explicit Super Admin account allowlist (no substring matching)
export const SUPER_ADMIN_EMAILS: string[] = [
  'clearfile360@gmail.com',
  'raj.asusrog@gmail.com'
];

// Centralized Supabase client instance
// (VITE_SUPABASE_ANON_KEY only - SERVICE_ROLE_KEY is strictly backend-only)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'deedos360_supabase_auth_token'
  }
});

/**
 * Initiate Supabase Google OAuth Flow
 */
export async function signInWithGoogleOAuth() {
  if (!isSupabaseConfigured) {
    throw new Error('Authentication is unavailable: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error('Supabase Google OAuth error:', error);
    throw error;
  }

  return data;
}

/**
 * Sign out current Supabase user
 */
export async function signOutSupabase() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase signOut caught error:', err);
  }
}

/**
 * Get active session safely
 */
export async function getActiveSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) {
    return null;
  }
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Error retrieving Supabase session:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.warn('getActiveSession exception:', err);
    return null;
  }
}

function normalizeAccountStatus(
  rawStatus: string | undefined,
  isSuperAdmin: boolean
): 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted' {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'suspended') return 'Suspended';
  if (s === 'deleted') return 'Deleted';
  if (s === 'pending' || s === 'pending approval') return 'Pending Approval';
  if (s === 'active' || s === 'approved') return 'Approved';
  return isSuperAdmin ? 'Approved' : 'Pending Approval';
}

function toProfileStatus(
  rawStatus: string | undefined
): 'active' | 'suspended' | 'pending' | 'deleted' {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s === 'suspended') return 'suspended';
  if (s === 'deleted') return 'deleted';
  if (s === 'pending' || s === 'pending approval') return 'pending';
  return 'active';
}

/**
 * Maps a Supabase Auth User object to canonical DeedOS360 UserAccount.
 * Never trusts user_metadata.role; relies strictly on server-controlled profile records.
 */
export function mapSupabaseUserToUserAccount(
  sbUser: User, 
  customProfile?: Partial<UserProfile | UserAccount> | null
): UserAccount {
  const cp = customProfile as any;
  const email = (sbUser.email || '').trim().toLowerCase();
  const rawEmail = sbUser.email || '';
  const name = cp?.full_name || 
               cp?.name || 
               sbUser.user_metadata?.full_name || 
               sbUser.user_metadata?.name || 
               (rawEmail ? rawEmail.split('@')[0] : 'User');
  const photo = cp?.avatar_url || 
                cp?.photo || 
                sbUser.user_metadata?.avatar_url || 
                sbUser.user_metadata?.picture || 
                '';

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);

  const assignedRole: UserRole = cp?.role
    ? (cp.role as UserRole)
    : (isSuperAdmin ? 'Super Admin' : 'Client');

  const assignedStatus = normalizeAccountStatus(cp?.status, isSuperAdmin);

  return {
    id: sbUser.id,
    uid: sbUser.id,
    name,
    email: rawEmail,
    photo,
    phone: cp?.phone || sbUser.phone || '',
    organization: cp?.organization || 'Independent Workspace',
    role: assignedRole,
    status: assignedStatus,
    createdAt: cp?.created_at || cp?.createdAt || sbUser.created_at || new Date().toISOString()
  };
}

/**
 * Production Auth Sync:
 * Synchronizes non-privileged profile attributes using the verified Bearer token.
 * Role, permissions, and approval status are strictly resolved by the server.
 */
export async function upsertUserProfileToSupabase(
  sbUser: User,
  extra?: { organization?: string; documentCount?: number }
): Promise<UserProfile | null> {
  const session = await getActiveSession();
  if (!session?.access_token) {
    return null;
  }

  const now = new Date().toISOString();
  const name = sbUser.user_metadata?.full_name || 
               sbUser.user_metadata?.name || 
               (sbUser.email ? sbUser.email.split('@')[0] : 'User');
  const avatar = sbUser.user_metadata?.avatar_url || 
                 sbUser.user_metadata?.picture || 
                 '';

  const safeSyncBody: Record<string, any> = {
    full_name: name,
    avatar_url: avatar,
    ...(extra?.organization ? { organization: extra.organization } : {}),
    ...(extra?.documentCount !== undefined ? { document_count: extra.documentCount } : {})
  };

  // Primary authoritative sync with protected backend endpoint
  try {
    const res = await fetch('/api/auth/sync-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(safeSyncBody)
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.user) {
        const u = data.user;
        return {
          id: u.id,
          full_name: u.full_name || u.name || name,
          email: u.email || sbUser.email || '',
          avatar_url: u.avatar_url || u.photo || avatar,
          role: (u.role as UserRole) || 'Client',
          organization: u.organization || 'Independent Workspace',
          status: toProfileStatus(u.status),
          created_at: u.created_at || u.createdAt || sbUser.created_at || now,
          last_login: u.last_login || u.lastLogin || now,
          last_activity: u.last_activity || u.lastActivity || now,
          document_count: typeof u.document_count === 'number' ? u.document_count : (extra?.documentCount || 0)
        };
      }
    } else if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const msg = String(errData?.error || '').toLowerCase();
      if (msg.includes('suspended') || msg.includes('deleted')) {
        return {
          id: sbUser.id,
          full_name: name,
          email: sbUser.email || '',
          avatar_url: avatar,
          role: 'Client',
          organization: extra?.organization || 'Independent Workspace',
          status: msg.includes('deleted') ? 'deleted' : 'suspended',
          created_at: sbUser.created_at || now,
          last_login: now,
          last_activity: now,
          document_count: extra?.documentCount || 0
        };
      }
    }
  } catch (e) {
    console.warn('Backend /api/auth/sync-profile error:', e);
  }

  // Read-only query from Supabase user_profiles if available (never self-assign role or status)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (data && !error) {
        await supabase
          .from('user_profiles')
          .update({
            full_name: data.full_name || name,
            avatar_url: data.avatar_url || avatar,
            last_login: now,
            last_activity: now,
            ...(extra?.documentCount !== undefined ? { document_count: extra.documentCount } : {})
          })
          .eq('id', sbUser.id);
        return data as UserProfile;
      }
    } catch (err) {
      console.warn('Supabase user_profiles read notice:', err);
    }
  }

  return null;
}

/**
 * Fetch all registered users from backend /api/auth/users or public.user_profiles
 */
export async function fetchUserProfilesFromSupabase(): Promise<UserProfile[]> {
  // Query authoritative backend /api/auth/users first
  try {
    const session = await getActiveSession();
    if (session?.access_token) {
      const res = await fetch('/api/auth/users', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((u: any) => ({
            id: u.id,
            full_name: u.full_name || u.name || u.email?.split('@')[0] || 'User',
            email: u.email,
            avatar_url: u.avatar_url || u.photo || '',
            role: u.role || 'Client',
            organization: u.organization || 'Independent Workspace',
            status: toProfileStatus(u.status),
            created_at: u.created_at || u.createdAt || new Date().toISOString(),
            last_login: u.last_login || u.lastLogin || new Date().toISOString(),
            last_activity: u.last_activity || u.lastActivity || new Date().toISOString(),
            document_count: u.document_count || u.documentCount || 0
          }));
        }
      }
    }
  } catch (e) {
    console.warn('Backend users query notice:', e);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as UserProfile[];
      }
    } catch (err) {
      console.warn('Supabase fetchUserProfiles query notice:', err);
    }
  }

  return [];
}

/**
 * Super Admin Action: Update User Role with Audit Log
 */
export async function updateUserProfileRoleInSupabase(
  targetUserId: string,
  newRole: UserRole,
  actorId: string,
  actorEmail?: string,
  oldRole?: string
): Promise<boolean> {
  const session = await getActiveSession();
  if (!session?.access_token) {
    throw new Error('Authentication required: No active session token.');
  }

  const res = await fetch(`/api/auth/users/${targetUserId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ role: newRole })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Role update failed with status ${res.status}`);
  }

  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_profiles')
        .update({ role: newRole, last_activity: now })
        .eq('id', targetUserId);
    } catch (err) {
      console.warn('Supabase update role notice:', err);
    }
  }

  await recordAuditLogInSupabase({
    actor_id: actorId || actorEmail || 'super_admin',
    action: 'CHANGE_ROLE',
    target_user_id: targetUserId,
    timestamp: now,
    metadata: {
      old_role: oldRole,
      new_role: newRole,
      actor_email: actorEmail
    }
  });

  return true;
}

/**
 * Super Admin Action: Update User Status (Suspend/Activate) with Audit Log
 */
export async function updateUserProfileStatusInSupabase(
  targetUserId: string,
  newStatus: 'active' | 'suspended' | 'pending' | 'deleted' | 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted',
  actorId: string,
  actorEmail?: string,
  oldStatus?: string
): Promise<boolean> {
  const session = await getActiveSession();
  if (!session?.access_token) {
    throw new Error('Authentication required: No active session token.');
  }

  const canonicalProfileStatus = toProfileStatus(newStatus);
  const backendStatus =
    canonicalProfileStatus === 'suspended' ? 'Suspended' :
    canonicalProfileStatus === 'deleted' ? 'Deleted' :
    canonicalProfileStatus === 'pending' ? 'Pending Approval' : 'Approved';

  const res = await fetch(`/api/auth/users/${targetUserId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ status: backendStatus })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Status update failed with status ${res.status}`);
  }

  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_profiles')
        .update({ status: canonicalProfileStatus, last_activity: now })
        .eq('id', targetUserId);
    } catch (err) {
      console.warn('Supabase update status notice:', err);
    }
  }

  const actionName = canonicalProfileStatus === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER';
  await recordAuditLogInSupabase({
    actor_id: actorId || actorEmail || 'super_admin',
    action: actionName,
    target_user_id: targetUserId,
    timestamp: now,
    metadata: {
      old_status: oldStatus,
      new_status: canonicalProfileStatus,
      actor_email: actorEmail
    }
  });

  return true;
}

/**
 * Super Admin Audit Log Creator:
 * Records entry in audit_logs: actor_id, action, target_user_id, timestamp, metadata
 */
export async function recordAuditLogInSupabase(entry: {
  actor_id: string;
  action: string;
  target_user_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  const session = await getActiveSession();
  if (!session?.access_token) {
    return false;
  }

  const payload = {
    actor_id: entry.actor_id,
    action: entry.action,
    target_user_id: entry.target_user_id || null,
    timestamp: entry.timestamp || new Date().toISOString(),
    metadata: entry.metadata || {}
  };

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('audit_logs')
        .insert(payload);
    } catch (err) {
      console.warn('Supabase audit_logs insert notice:', err);
    }
  }

  try {
    const res = await fetch('/api/audit/log-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Helper to retrieve role of current user
 */
export function getCurrentUserRole(user: UserAccount | null): UserRole {
  return user?.role || 'Client';
}

