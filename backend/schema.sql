-- ==========================================
-- UNIKORN360 DEEDOS — PostgreSQL Schema Spec
-- Enterprise Legal-Tech SaaS for Tamil Nadu Registry
-- ==========================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Permissions
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT
);

-- Table 3: Role_Permissions (Join Table)
CREATE TABLE role_permissions (
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Table 4: Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id),
    license_no VARCHAR(100), -- For certified Document Writers & Lawyers
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: Clients (Layer 4 Client Management)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    age INT NOT NULL,
    occupation VARCHAR(100),
    pan VARCHAR(10),
    aadhaar VARCHAR(14), -- Format: 1234-5678-9012
    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_by_user_id VARCHAR(255),
    created_by_email VARCHAR(255),
    assigned_to_user_id VARCHAR(255),
    assigned_to VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: Document Types (Master Data)
CREATE TABLE document_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ta VARCHAR(255) NOT NULL, -- Tamil Translation
    description TEXT
);

-- Table 7: Documents (Drafts & Deeds)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_no VARCHAR(100) UNIQUE, -- DEED/YYYY/SEQUENCE
    document_type_id INT REFERENCES document_types(id) NOT NULL,
    subtype_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Pending Review', 'Completed', 'Rejected'
    writer_id UUID REFERENCES users(id),
    created_by_user_id VARCHAR(255),
    created_by_email VARCHAR(255),
    assigned_to_user_id VARCHAR(255),
    assigned_to VARCHAR(255),
    total_consideration NUMERIC(15, 2) DEFAULT 0.00,
    market_value NUMERIC(15, 2) DEFAULT 0.00,
    guideline_value NUMERIC(15, 2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    payment_ref_no VARCHAR(100),
    payment_date DATE,
    bank_name VARCHAR(255),
    tamil_template_used BOOLEAN DEFAULT TRUE,
    english_template_used BOOLEAN DEFAULT TRUE,
    raw_document_en TEXT, -- Generated English Text
    raw_document_ta TEXT, -- Generated Tamil Text
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 8: Parties (Step 2 - Seller/Buyer details)
CREATE TABLE parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- Can link to a reusable client profile
    role VARCHAR(50) NOT NULL, -- 'Seller', 'Buyer', 'Donor', 'Donee'
    name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    age INT NOT NULL,
    occupation VARCHAR(100),
    aadhaar VARCHAR(14) NOT NULL,
    pan VARCHAR(10),
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    sequence_order INT DEFAULT 1 -- Order in the list of parties
);

-- Master Table 1: DistrictMaster
CREATE TABLE district_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    legacy_parent_district VARCHAR(150),
    reorganized_date DATE
);

-- Master Table 2: RegistrationDistrictMaster
CREATE TABLE registration_district_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL
);

-- Master Table 3: TalukMaster
CREATE TABLE taluk_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    district_id INT REFERENCES district_master(id) ON DELETE CASCADE
);

-- Master Table 4: VillageMaster
CREATE TABLE village_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    taluk_id INT REFERENCES taluk_master(id) ON DELETE CASCADE
);

-- Master Table 5: SROMaster
CREATE TABLE sro_master (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    registration_district_id INT REFERENCES registration_district_master(id) ON DELETE CASCADE
);

-- Table 9: Properties (Step 3 - Regional Jurisdictions)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    district VARCHAR(100) NOT NULL,
    registration_district VARCHAR(100) NOT NULL,
    taluk VARCHAR(100) NOT NULL,
    village VARCHAR(100) NOT NULL,
    ward VARCHAR(100),
    block VARCHAR(100),
    property_type VARCHAR(100) NOT NULL, -- Residential, Agricultural, Commercial
    sro_office VARCHAR(150) NOT NULL
);

-- Table 10: Survey Records (Step 4 - Tamil Nadu Specific Survey Spec)
CREATE TABLE survey_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    survey_no VARCHAR(50) NOT NULL,
    sub_division VARCHAR(50) NOT NULL,
    patta_no VARCHAR(50) NOT NULL,
    tslr_no VARCHAR(50), -- Town Survey Land Record (urban areas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 11: Boundaries (Step 6 - Four boundaries)
CREATE TABLE boundaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    east_boundary TEXT NOT NULL,
    west_boundary TEXT NOT NULL,
    north_boundary TEXT NOT NULL,
    south_boundary TEXT NOT NULL
);

-- Table 12: Witnesses (Step 9 - Minimum 2)
CREATE TABLE witnesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    aadhaar VARCHAR(14) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL
);

-- Table 13: Clauses
CREATE TABLE clauses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Standard, Indemnity, etc.
    content_en TEXT NOT NULL,
    content_ta TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table 14: Document Selected Clauses
CREATE TABLE document_clauses (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    clause_id INT REFERENCES clauses(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, clause_id)
);

-- Table 15: Templates
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL, -- 'sale_deed_v1', 'gift_deed_v1'
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'SALE', 'GIFT', 'PARTITION'
    content_en_template TEXT,
    content_ta_template TEXT
);

-- Table 16: Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID, -- NULL if system action
    user_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45) NOT NULL
);

-- Table 17: Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================================
-- FUTURE REGISTRY INTELLIGENCE & AI EXTENSION TABLES (Layer 8)
-- ==========================================================

-- Future Table 1: AI Validations
CREATE TABLE ai_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    validation_run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    passed BOOLEAN DEFAULT TRUE,
    missing_fields JSONB, -- Stores array of warning objects
    warnings JSONB,       -- List of issues found by AI rules
    recommendations TEXT
);

-- Future Table 2: Fraud Scores
CREATE TABLE fraud_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    fraud_score_pct INT NOT NULL, -- Percentage (0-100)
    double_registration_flag BOOLEAN DEFAULT FALSE,
    guideline_deviation_pct NUMERIC(5,2),
    flagged_alerts TEXT[], -- Array of warning strings (e.g., {"Survey pending litigation"})
    scrutinized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Future Table 3: OCR Results (Scanning parent documents)
CREATE TABLE ocr_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    scanned_file_name VARCHAR(255) NOT NULL,
    ocr_confidence NUMERIC(5,2),
    extracted_text TEXT,
    extracted_metadata JSONB, -- Extracted buyers, sellers, survey numbers
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Future Table 4: Registry Sync (Tamil Nadu Star 2.0 Integration)
CREATE TABLE registry_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    star_token VARCHAR(255), -- STAR 2.0 reference token
    sync_status VARCHAR(50) NOT NULL, -- 'Pending', 'Synced', 'Failed'
    sync_response JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- INDEXES & PERFORMANCE OPTIMIZATIONS
-- ==========================================
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_parties_document ON parties(document_id);
CREATE INDEX idx_properties_sro ON properties(sro_office);
CREATE INDEX idx_survey_records_nos ON survey_records(survey_no, sub_division);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- ==========================================================
-- SUPABASE PUBLIC.USER_PROFILES SCHEMA & RLS POLICIES
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'Client',
    permissions JSONB NOT NULL DEFAULT '["view_own_deeds"]'::jsonb,
    organization TEXT DEFAULT 'Tamil Nadu STAR 2.0 Registration Dept',
    status TEXT NOT NULL DEFAULT 'pending',
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    document_count INTEGER DEFAULT 0
);

-- Non-Recursive SECURITY DEFINER Helpers (prevents recursive RLS evaluation on public.user_profiles)
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
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND lower(up.status) IN ('active', 'approved')
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
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'Super Admin' AND lower(up.status) IN ('active', 'approved')
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
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('Super Admin', 'Admin') AND lower(up.status) IN ('active', 'approved')
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
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'Auditor' AND lower(up.status) IN ('active', 'approved')
  );
$$;

-- Trigger preventing self-promotion and authorization field modification by ordinary users
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

-- Enable & Force Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

-- 1. Users can read own profile
CREATE POLICY "Users can read own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- 2. Admin and Auditor can read all profiles (non-recursive via SECURITY DEFINER helper)
CREATE POLICY "Admin and Auditor can read all profiles"
    ON public.user_profiles FOR SELECT
    USING (public.is_approved_admin() OR public.is_approved_auditor());

-- 3. Users can insert own profile with non-privileged defaults only
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

-- 4. Users can update own non-privileged profile attributes only (non-recursive)
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id AND public.is_approved_user())
    WITH CHECK (
      auth.uid() = id
      AND role = public.current_user_role()
      AND lower(status) = public.current_user_status()
    );

-- 5. Super Admin can update all profiles
CREATE POLICY "Super Admin can update all profiles"
    ON public.user_profiles FOR UPDATE
    USING (public.is_approved_super_admin())
    WITH CHECK (public.is_approved_super_admin());

-- 6. Admin can update non-privileged profiles only
CREATE POLICY "Admin can update non-privileged profiles"
    ON public.user_profiles FOR UPDATE
    USING (public.is_approved_admin() AND role NOT IN ('Super Admin', 'Admin', 'Auditor'))
    WITH CHECK (public.is_approved_admin() AND role NOT IN ('Super Admin', 'Admin', 'Auditor'));

-- Explicit Table and Column-Level Grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON public.user_profiles FROM authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT INSERT (id, full_name, email, avatar_url, organization) ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, organization, last_login, last_activity) ON public.user_profiles TO authenticated;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created ON public.user_profiles(created_at DESC);


