import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  ShieldCheck, 
  Activity, 
  Users, 
  CheckCircle,
  FileCode2,
  Lock,
  Cpu,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  History,
  Trash2,
  LockKeyhole,
  CheckCircle2,
  KeyRound,
  XCircle,
  UserPlus,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  FileText,
  SlidersHorizontal,
  UserX,
  Sparkles
} from 'lucide-react';
import SQLViewer from '../components/SQLViewer';
import { useApp } from '../context/AppContext';
import { UserRole, UserProfile } from '../types';
import { supabase, fetchUserProfilesFromSupabase, SUPER_ADMIN_EMAILS } from '../lib/supabase';

export default function AdminPanel() {
  const { 
    currentUser,
    usersList, 
    userProfiles,
    refreshUserProfiles,
    refreshUsersList,
    updateUserRole, 
    updateUserStatus, 
    auditLogs,
    refreshAuditLogs,
    syncDatabase
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audits' | 'schema' | 'api' | 'services'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Elevated reviewer states
  const [sessionStatus, setSessionStatus] = useState<{ active: boolean; reasonCode?: string; expiresAt?: string; minutesRemaining?: number } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionSuccess, setSessionSuccess] = useState('');

  // Initial fetch of user profiles on mount
  useEffect(() => {
    handleRefreshDirectory();
  }, []);

  const handleRefreshDirectory = async () => {
    setIsRefreshing(true);
    try {
      await refreshUserProfiles();
      await refreshUsersList();
      await refreshAuditLogs();
    } catch (e) {
      console.warn("Failed to refresh directory:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getAuthHeaders = async () => {
    let token = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {}

    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const checkSessionStatus = async () => {
    if (currentUser?.role !== 'Auditor') return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/elevate/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setSessionStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch elevated review status:', e);
    }
  };

  const handleElevate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError('');
    setSessionSuccess('');
    if (!reasonInput.trim()) {
      setSessionError('Mandatory reason code is required.');
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/elevate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reasonCode: reasonInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setSessionError(data.error || 'Failed to activate elevated review session.');
      } else {
        setSessionSuccess('Elevated review session successfully activated! RAW PII values are now unlocked for 15 minutes.');
        setReasonInput('');
        await checkSessionStatus();
        await syncDatabase();
      }
    } catch (err: any) {
      setSessionError(err.message || 'Network error.');
    }
  };

  const handleDemote = async () => {
    setSessionError('');
    setSessionSuccess('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/demote', {
        method: 'POST',
        headers
      });
      if (res.ok) {
        setSessionSuccess('Elevated session terminated. PII returned to standard masked mode.');
        await checkSessionStatus();
        await syncDatabase();
      } else {
        setSessionError('Failed to terminate session.');
      }
    } catch (err: any) {
      setSessionError(err.message || 'Network error.');
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Auditor') {
      checkSessionStatus();
      const interval = setInterval(checkSessionStatus, 15000); // Check every 15 seconds
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Handle Role Change
  const handleRoleChange = async (userId: string, newRole: UserRole, userName: string) => {
    try {
      await updateUserRole(userId, newRole);
      setActionFeedback({
        message: `Successfully updated role for ${userName} to "${newRole}".`,
        type: 'success'
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({
        message: `Failed to update role: ${err.message || 'Unknown error'}`,
        type: 'error'
      });
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Handle Status Toggle (Activate / Suspend)
  const handleStatusToggle = async (userId: string, currentStatus: string, userName: string) => {
    const isCurrentlySuspended = currentStatus.toLowerCase() === 'suspended';
    const nextStatus = isCurrentlySuspended ? 'active' : 'suspended';
    
    if (!isCurrentlySuspended) {
      const confirmed = window.confirm(`Are you sure you want to suspend access for ${userName}? They will be blocked from generating or editing deeds.`);
      if (!confirmed) return;
    }

    try {
      await updateUserStatus(userId, nextStatus as any);
      setActionFeedback({
        message: `User ${userName} is now ${nextStatus === 'active' ? 'Activated' : 'Suspended'}.`,
        type: 'success'
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({
        message: `Failed to update status: ${err.message || 'Unknown error'}`,
        type: 'error'
      });
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Check if current user role has access to admin functions
  const isAuthorized = currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || currentUser?.role === 'Auditor';

  // Merge live userProfiles with usersList to ensure maximum coverage
  const displayProfiles: UserProfile[] = (() => {
    if (userProfiles && userProfiles.length > 0) {
      return userProfiles;
    }
    // Fallback mapping from usersList if userProfiles is loading
    return usersList.map(u => ({
      id: u.id || u.uid || 'user-default',
      full_name: u.name || u.email?.split('@')[0] || 'Registered User',
      email: u.email,
      avatar_url: u.photo || '',
      role: u.role || 'Document Writer',
      organization: u.organization || 'Independent Workspace',
      status: (u.status === 'Suspended' ? 'suspended' : 'active') as any,
      created_at: u.createdAt || new Date().toISOString(),
      last_login: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      document_count: 0
    }));
  })();

  // Filter users based on search, role, and status
  const filteredUsers = displayProfiles.filter(u => {
    const matchesSearch = 
      (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'active' && u.status.toLowerCase() !== 'suspended') ||
      (statusFilter === 'suspended' && u.status.toLowerCase() === 'suspended');

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Calculate statistics
  const totalUsers = displayProfiles.length;
  const activeUsersCount = displayProfiles.filter(u => u.status?.toLowerCase() !== 'suspended').length;
  const suspendedUsersCount = displayProfiles.filter(u => u.status?.toLowerCase() === 'suspended').length;
  const totalDocsCount = displayProfiles.reduce((acc, u) => acc + (u.document_count || 0), 0);

  // Filter audit logs based on search
  const filteredLogs = auditLogs.filter(l => 
    (l.userEmail || l.user || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    (l.message || l.details || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
    (l.type || l.action || '').toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  const rawPostgresSQL = `-- ==========================================
-- UNIKORN360 DEEDOS — Supabase & PostgreSQL DDL Schema Spec
-- Enterprise Legal-Tech SaaS for Tamil Nadu Registry
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table 1: Supabase User Profiles (IAM Directory)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'Client',
    permissions JSONB NOT NULL DEFAULT '["view_own_deeds"]'::jsonb,
    organization TEXT DEFAULT 'Independent Workspace',
    status TEXT NOT NULL DEFAULT 'pending',
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    document_count INTEGER DEFAULT 0
);

-- Non-Recursive SECURITY DEFINER Helpers
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT up.role FROM public.user_profiles up
  WHERE up.id = auth.uid() AND lower(up.status) IN ('active', 'approved') LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lower(up.status) FROM public.user_profiles up WHERE up.id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'Super Admin' AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('Super Admin', 'Admin') AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_auditor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'Auditor' AND lower(up.status) IN ('active', 'approved')
  );
$$;

-- Row Level Security (RLS) Policies (Non-Recursive)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admin and Auditor can read all profiles"
    ON public.user_profiles FOR SELECT
    USING (public.is_approved_admin() OR public.is_approved_auditor());

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id AND public.is_approved_user())
    WITH CHECK (
      auth.uid() = id
      AND role = public.current_user_role()
      AND lower(status) = public.current_user_status()
    );

CREATE POLICY "Super Admin can update all profiles"
    ON public.user_profiles FOR UPDATE
    USING (public.is_approved_super_admin())
    WITH CHECK (public.is_approved_super_admin());

-- Explicit Table & Column-Level Privilege Grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON public.user_profiles FROM authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT INSERT (id, full_name, email, avatar_url, organization) ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, organization, last_login, last_activity) ON public.user_profiles TO authenticated;

-- Table 2: Documents (Step 1-11 Wizard with Optimistic Concurrency Revision)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_no VARCHAR(100) UNIQUE NOT NULL,
    doc_type VARCHAR(100) NOT NULL,
    sub_type VARCHAR(100),
    parties_count INT DEFAULT 2,
    property_address TEXT,
    consideration NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    writer TEXT,
    progress INT DEFAULT 0,
    created_by TEXT NOT NULL,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_by_email VARCHAR(255) NOT NULL,
    assigned_to_user_id VARCHAR(255),
    assigned_to VARCHAR(255),
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    state JSONB NOT NULL
);`;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-800">
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-full text-rose-500 mb-4 animate-bounce">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">IAM Authorization Violation</h3>
        <p className="text-xs text-slate-500 max-w-md mt-2 leading-relaxed">
          The requested administrative module is strictly restricted to <strong className="text-slate-800">Super Admin, Admin, and Internal Auditor</strong> roles. Your current role lacks appropriate security clearance.
        </p>
      </div>
    );
  }

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Never';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#c49a36] text-white rounded-lg shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Admin & Database Control Center</h3>
              <p className="text-xs text-slate-500">Workspace users, permissions and application audit records</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshDirectory}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh user directory'}</span>
          </button>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/80 text-[11px] font-bold text-emerald-800 shadow-sm">
            <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
            <span>RLS Active: public.user_profiles</span>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionFeedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 shadow-sm transition-all ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{actionFeedback.message}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs text-slate-500 font-bold shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'users' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>IAM User Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono font-bold">
            {totalUsers}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('audits')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'audits' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Security SIEM Audit Logs</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono font-bold">
            {auditLogs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('schema')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'schema' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Database administration</span>
        </button>
        <button
          onClick={() => setActiveSubTab('api')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'api' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Terminal className="h-4 w-4" />
          <span>API Controllers Spec</span>
        </button>
        <button
          onClick={() => setActiveSubTab('services')}
          className={`pb-3 border-b-2 px-1 transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'services' ? 'border-emerald-600 text-emerald-700 font-extrabold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Cpu className="h-4 w-4" />
          <span>Deed360 Microservices</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="space-y-4">
        
        {/* USERS / IAM DIRECTORY */}
        {activeSubTab === 'users' && (
          <div className="space-y-4">
            
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs text-left">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Registered</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h4 className="text-2xl font-black text-slate-900">{totalUsers}</h4>
                  <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md border border-slate-100">
                    <Users className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Account directory</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs text-left">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Operators</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h4 className="text-2xl font-black text-emerald-600">{activeUsersCount}</h4>
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-[10px] text-emerald-600/80 mt-1">Licensed to draft & sign</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs text-left">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suspended Profiles</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h4 className={`text-2xl font-black ${suspendedUsersCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {suspendedUsersCount}
                  </h4>
                  <span className="p-1.5 bg-rose-50 text-rose-600 rounded-md border border-rose-100">
                    <UserX className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Access revoked by Admin</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs text-left">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Deeds Drafted</p>
                <div className="flex items-baseline justify-between mt-1">
                  <h4 className="text-2xl font-black text-indigo-600">{totalDocsCount}</h4>
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                    <FileText className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Live document count tally</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 text-left flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by operator name, email, organization, or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <span>Role:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="ALL">All Roles ({displayProfiles.length})</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Document Writer">Document Writer</option>
                    <option value="Lawyer">Lawyer</option>
                    <option value="Broker">Broker</option>
                    <option value="Client">Client</option>
                    <option value="Auditor">Auditor</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="suspended">Suspended Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live User Profiles Directory Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-left">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                      <th className="p-3.5">Registered Operator</th>
                      <th className="p-3.5">Office / Organization</th>
                      <th className="p-3.5">Workspace role</th>
                      <th className="p-3.5">Documents</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Last Active / Login</th>
                      <th className="p-3.5 text-right">Admin Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="h-8 w-8 text-slate-300 stroke-1" />
                            <p className="font-semibold text-slate-600">No users found matching query</p>
                            <p className="text-[11px] text-slate-400">Try adjusting your search criteria or role filters.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
                        const isSuspended = user.status.toLowerCase() === 'suspended';
                        const initials = user.full_name
                          ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          : user.email.slice(0, 2).toUpperCase();

                        return (
                          <tr key={user.id} className="hover:bg-slate-50/60 transition group">
                            {/* Operator Identity */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                {user.avatar_url ? (
                                  <img 
                                    src={user.avatar_url} 
                                    alt={user.full_name} 
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" 
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                    {initials}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-slate-900 text-xs">{user.full_name}</p>
                                    {isSuperAdminEmail && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        <span>ROOT</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{user.email}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">UID: {user.id.slice(0, 13)}...</p>
                                </div>
                              </div>
                            </td>

                            {/* Organization */}
                            <td className="p-3.5 text-slate-600">
                              <span className="text-xs font-semibold text-slate-700 block">{user.organization || 'Deed360 Registry'}</span>
                              <span className="text-[10px] text-slate-400">Joined: {formatTimestamp(user.created_at)}</span>
                            </td>

                            {/* Role Dropdown */}
                            <td className="p-3.5">
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole, user.full_name)}
                                className={`border rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none cursor-pointer ${
                                  user.role === 'Super Admin' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                                  user.role === 'Admin' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                                  user.role === 'Document Writer' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                  user.role === 'Lawyer' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                                  user.role === 'Auditor' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                  'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <option value="Super Admin">Super Admin</option>
                                <option value="Admin">Admin</option>
                                <option value="Document Writer">Document Writer</option>
                                <option value="Lawyer">Lawyer</option>
                                <option value="Broker">Broker</option>
                                <option value="Client">Client</option>
                                <option value="Auditor">Auditor</option>
                              </select>
                            </td>

                            {/* Document Count */}
                            <td className="p-3.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                <FileText className="h-3 w-3 text-slate-500" />
                                <span>{user.document_count || 0}</span>
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isSuspended 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                {isSuspended ? 'Suspended' : 'Active'}
                              </span>
                            </td>

                            {/* Last Activity / Login */}
                            <td className="p-3.5 text-slate-500">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span>{formatTimestamp(user.last_activity || user.last_login)}</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Login: {formatTimestamp(user.last_login)}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isSuspended ? (
                                  <button
                                    onClick={() => handleStatusToggle(user.id, user.status, user.full_name)}
                                    className="px-3 py-1.5 bg-[#c49a36] hover:bg-[#b58a2b] text-white font-bold rounded-lg text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Activate</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleStatusToggle(user.id, user.status, user.full_name)}
                                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 font-bold rounded-lg text-[11px] transition border border-rose-200 shadow-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <UserX className="h-3 w-3" />
                                    <span>Suspend</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY SIEM AUDIT LOGS */}
        {activeSubTab === 'audits' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4 text-left shadow-xl">
            {currentUser?.role === 'Auditor' && (
              <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-5 mb-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
                  <div>
                    <h5 className="text-xs uppercase font-extrabold tracking-wider text-teal-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Auditor Elevated PII Review Control Centre</span>
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Deed360 zero-trust protocol. Auditor raw decryption requires explicit server privilege verification, mandatory justification, and immutable transaction logging. Sessions expire in 15 minutes.
                    </p>
                  </div>
                  <div>
                    {sessionStatus?.active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span>
                        ELEVATED SESSION ACTIVE ({sessionStatus.minutesRemaining}m left)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                        PII VALUES MASKED
                      </span>
                    )}
                  </div>
                </div>

                {sessionError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{sessionError}</span>
                  </div>
                )}

                {sessionSuccess && (
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{sessionSuccess}</span>
                  </div>
                )}

                {sessionStatus?.active ? (
                  <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-400">Current Elevated Session Authorization Reason Code:</p>
                      <p className="text-xs font-mono font-bold text-slate-200 bg-slate-950 px-2 py-1 rounded border border-slate-850 inline-block">
                        {sessionStatus.reasonCode}
                      </p>
                      <p className="text-[10px] text-slate-500">Decryption window terminates on {sessionStatus.expiresAt ? new Date(sessionStatus.expiresAt).toLocaleTimeString() : 'N/A'}</p>
                    </div>
                    <div>
                      <button
                        onClick={handleDemote}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition duration-150 flex items-center gap-1.5 shadow-lg shadow-rose-950/20"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Revoke Elevated Decryption</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleElevate} className="flex flex-col sm:flex-row items-end gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-850">
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <span>Mandatory Justification Reason Code</span>
                        <span className="text-rose-400 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter official audit reference code or regulatory purpose justification..."
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-teal-950/20"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Request Elevated Access</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <LockKeyhole className="h-4.5 w-4.5 text-teal-400" />
                  <span>Deed360 Security Information & Event Log (SIEM)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Chronological immutable ledger of security assertions, permission changes, and audit records.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter logs by operator or event..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="p-2 border border-slate-800 rounded-lg text-xs w-64 bg-slate-950 text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[500px] space-y-2 pr-1 font-mono text-[11px] text-slate-300">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No security events found matching the current search parameters.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const logType = log.type || log.action || 'system';
                  const logMessage = log.message || log.details || 'System event recorded';
                  const isFailure = logType.includes('failed') || logType.includes('suspend') || logType.includes('violation');
                  return (
                    <div key={log.id} className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isFailure ? 'bg-rose-950/20 border-rose-900/30 text-rose-200' : 'bg-slate-950 border-slate-850 text-slate-300'
                    }`}>
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            isFailure ? 'bg-rose-500 animate-pulse' : 'bg-teal-500'
                          }`} />
                          <span className={`font-bold uppercase text-[9px] tracking-wider px-1.5 py-0.2 rounded ${
                            isFailure ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                          }`}>{logType}</span>
                          <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="font-semibold text-xs leading-normal">{logMessage}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Browser fingerprint: {log.browser || 'Chrome'} • Device: {log.device || 'Desktop'} • IP: {log.ip || log.ipAddress || '157.45.109.112'}</p>
                      </div>
                      <span className="text-[10px] text-teal-400 font-bold shrink-0">{log.userEmail || log.user || 'system'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* POSTGRESQL SCHEMA & RLS */}
        {activeSubTab === 'schema' && (
          <SQLViewer sqlContent={rawPostgresSQL} />
        )}

        {/* API CONTROLLERS */}
        {activeSubTab === 'api' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden text-left p-6 space-y-6">
            <div className="flex items-center gap-2 text-teal-400 border-b border-slate-800 pb-3">
              <FileCode2 className="h-4.5 w-4.5" />
              <h4 className="text-sm font-bold text-white">Express API Routing & Supabase Dual-Sync Controllers</h4>
            </div>

            <p className="text-xs text-slate-400 leading-normal">
              Below is the backend routing schema matching `/backend/server.ts` handles:
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/auth/sync-profile</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Dual-syncs user profile records between Supabase auth.users, public.user_profiles, and the local backend database on every authenticated session.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/audit/log-action</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Appends tamper-evident audit records (actor ID, action, target user ID, metadata) to both Supabase public.audit_logs and local persistent database.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/extract</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Processes uploaded binary files through Gemini-3.5-flash vision OCR to extract structured buyers, sellers, and survey variables to pre-fill the form.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/validate</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Evaluates deed draft states against Tamil Nadu SRO compliance rulesets (witnesses counts, Section 47A under-valuation protections).
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-850">
                <p className="text-teal-400 font-bold mb-1">POST /api/ai/fraud-check</p>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Scans Deed360 Prohibited Lands register (Section 22-A of Registration Act) to block double registrations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MICROSERVICES */}
        {activeSubTab === 'services' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-left space-y-4">
            <h4 className="text-sm font-bold text-slate-800">Integration Adapters for Deed360</h4>
            <p className="text-xs text-slate-500 leading-normal">
              These modular microservices handle secure integrations with the Deed360 registry ecosystem:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Service 1:</span>
                <h5 className="text-slate-800 font-extrabold">Patta/Chitta API Synchronizer</h5>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Queries revenue databases (Anyal/E-Service) to verify if the survey numbers match the patta records before drafting is finalized.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Service 2:</span>
                <h5 className="text-slate-800 font-extrabold">FMB Sketch OCR & Land Boundary Verifier</h5>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Scans FMB (Field Measurement Book) drawings to double-check dimensions (East, West, North, South) matching the written deed boundaries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

