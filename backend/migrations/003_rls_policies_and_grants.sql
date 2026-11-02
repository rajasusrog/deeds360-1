-- ============================================================================
-- MIGRATION 003: Supabase/PostgreSQL Non-Recursive RLS Policies, Triggers & Grants
-- Enforces ownership isolation, blocks self-promotion, removes recursive policy
-- lookups on user_profiles, and locks down table/column privileges.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'Client' CHECK (role IN ('Super Admin', 'Admin', 'Lawyer', 'Document Writer', 'Data Entry Operator', 'Broker', 'Client', 'Auditor')),
  permissions JSONB NOT NULL DEFAULT '["view_own_deeds"]'::jsonb,
  organization TEXT DEFAULT 'Tamil Nadu STAR 2.0 Registration Dept',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended', 'deleted', 'Approved', 'Pending Approval', 'Suspended', 'Deleted')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  document_count INTEGER DEFAULT 0
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '["view_own_deeds"]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

-- ============================================================================
-- 1. NON-RECURSIVE SECURITY DEFINER AUTH HELPERS
-- Uses SECURITY DEFINER with fixed search_path to read caller's own row by PK
-- without triggering recursive RLS evaluation on public.user_profiles.
-- Never uses email LIKE '%admin%' or substring matching.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT up.role
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND lower(up.status) IN ('active', 'approved')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lower(up.status)
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'Super Admin'
      AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('Super Admin', 'Admin')
      AND lower(up.status) IN ('active', 'approved')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_auditor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'Auditor'
      AND lower(up.status) IN ('active', 'approved')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved_auditor() FROM PUBLIC, anon;

-- ============================================================================
-- 2. TRIGGER GUARD PREVENTING SELF-PROMOTION & AUTHORIZATION FIELD TAMPERING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_user_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.revision := COALESCE(OLD.revision, 1) + 1;
    END IF;
    RETURN NEW;
  END IF;

  caller_role := public.current_user_role();

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Forbidden: Profile ID must match authenticated user ID' USING ERRCODE = '42501';
    END IF;
    IF lower(NEW.email) IS DISTINCT FROM lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
      RAISE EXCEPTION 'Forbidden: Profile email must match verified token email' USING ERRCODE = '42501';
    END IF;
    IF caller_role IS DISTINCT FROM 'Super Admin' THEN
      IF lower(NEW.email) IN ('clearfile360@gmail.com', 'raj.asusrog@gmail.com') THEN
        NEW.role := 'Super Admin';
        NEW.status := 'active';
        NEW.permissions := '["*"]'::jsonb;
      ELSE
        NEW.role := 'Client';
        NEW.status := 'pending';
        NEW.permissions := '["view_own_deeds"]'::jsonb;
      END IF;
    END IF;
    NEW.revision := 1;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Forbidden: Cannot modify immutable user profile ID' USING ERRCODE = '42501';
    END IF;
    IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) AND caller_role IS DISTINCT FROM 'Super Admin' THEN
      RAISE EXCEPTION 'Forbidden: Cannot modify verified profile email' USING ERRCODE = '42501';
    END IF;
    IF caller_role IS DISTINCT FROM 'Super Admin' AND caller_role IS DISTINCT FROM 'Admin' THEN
      IF NEW.role IS DISTINCT FROM OLD.role
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.permissions IS DISTINCT FROM OLD.permissions
         OR NEW.created_at IS DISTINCT FROM OLD.created_at
      THEN
        RAISE EXCEPTION 'Forbidden: Ordinary users cannot modify authorization fields (role, status, permissions)' USING ERRCODE = '42501';
      END IF;
    ELSIF caller_role = 'Admin' THEN
      IF (NEW.role IN ('Super Admin', 'Admin', 'Auditor') OR OLD.role IN ('Super Admin', 'Admin', 'Auditor'))
         AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status OR NEW.permissions IS DISTINCT FROM OLD.permissions)
      THEN
        RAISE EXCEPTION 'Forbidden: Only Super Admin can assign or modify privileged roles' USING ERRCODE = '42501';
      END IF;
    END IF;
    NEW.revision := COALESCE(OLD.revision, 1) + 1;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_profile_security ON public.user_profiles;
CREATE TRIGGER trg_enforce_user_profile_security
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_profile_security();

-- ============================================================================
-- 3. ROW LEVEL SECURITY POLICIES (NON-RECURSIVE, OWNERSHIP-SCOPED)
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Super Admin can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super Admin can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin and Auditor can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can update non-privileged profiles" ON public.user_profiles;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin and Auditor can read all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.is_approved_admin() OR public.is_approved_auditor());

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    AND (
      (lower(email) IN ('clearfile360@gmail.com', 'raj.asusrog@gmail.com') AND role = 'Super Admin' AND lower(status) IN ('active', 'approved'))
      OR (role = 'Client' AND lower(status) IN ('pending', 'pending approval'))
    )
  );

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

CREATE POLICY "Admin can update non-privileged profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    public.is_approved_admin()
    AND role NOT IN ('Super Admin', 'Admin', 'Auditor')
  )
  WITH CHECK (
    public.is_approved_admin()
    AND role NOT IN ('Super Admin', 'Admin', 'Auditor')
  );

-- Enable & Force RLS on documents, clients, and audit_logs
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace select documents" ON documents;
DROP POLICY IF EXISTS "Workspace insert documents" ON documents;
DROP POLICY IF EXISTS "Workspace update documents" ON documents;
DROP POLICY IF EXISTS "Workspace delete documents" ON documents;

CREATE POLICY "Workspace select documents"
  ON documents FOR SELECT
  USING (
    public.is_approved_user()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR public.is_approved_admin()
      OR public.is_approved_auditor()
    )
  );

CREATE POLICY "Workspace insert documents"
  ON documents FOR INSERT
  WITH CHECK (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND created_by_user_id = auth.uid()::text
    AND revision = 1
  );

CREATE POLICY "Workspace update documents"
  ON documents FOR UPDATE
  USING (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  )
  WITH CHECK (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  );

CREATE POLICY "Workspace delete documents"
  ON documents FOR DELETE
  USING (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  );

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace select clients" ON clients;
DROP POLICY IF EXISTS "Workspace insert clients" ON clients;
DROP POLICY IF EXISTS "Workspace update clients" ON clients;
DROP POLICY IF EXISTS "Workspace delete clients" ON clients;

CREATE POLICY "Workspace select clients"
  ON clients FOR SELECT
  USING (
    public.is_approved_user()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR id = auth.uid()::text
      OR public.is_approved_admin()
      OR public.is_approved_auditor()
    )
  );

CREATE POLICY "Workspace insert clients"
  ON clients FOR INSERT
  WITH CHECK (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND created_by_user_id = auth.uid()::text
    AND revision = 1
  );

CREATE POLICY "Workspace update clients"
  ON clients FOR UPDATE
  USING (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  )
  WITH CHECK (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR assigned_to_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  );

CREATE POLICY "Workspace delete clients"
  ON clients FOR DELETE
  USING (
    public.is_approved_user()
    AND NOT public.is_approved_auditor()
    AND (
      created_by_user_id = auth.uid()::text
      OR public.is_approved_admin()
    )
  );

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and Auditor read audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Approved users append audit_logs" ON audit_logs;

CREATE POLICY "Admin and Auditor read audit_logs"
  ON audit_logs FOR SELECT
  USING (public.is_approved_admin() OR public.is_approved_auditor());

CREATE POLICY "Approved users append audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    public.is_approved_user()
    AND lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- ============================================================================
-- 4. EXPLICIT TABLE AND COLUMN GRANTS (PRINCIPLE OF LEAST PRIVILEGE)
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON public.user_profiles FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.user_profiles TO authenticated';
    EXECUTE 'GRANT INSERT (id, full_name, email, avatar_url, organization) ON public.user_profiles TO authenticated';
    EXECUTE 'GRANT UPDATE (full_name, avatar_url, organization, last_login, last_activity) ON public.user_profiles TO authenticated';

    EXECUTE 'REVOKE ALL ON documents FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated';

    EXECUTE 'REVOKE ALL ON clients FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated';

    EXECUTE 'REVOKE ALL ON audit_logs FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON audit_logs TO authenticated';

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_user_status() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_approved_super_admin() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_approved_admin() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_approved_auditor() TO authenticated';
  END IF;
END
$$;
