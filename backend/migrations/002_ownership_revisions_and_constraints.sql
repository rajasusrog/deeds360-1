-- ============================================================================
-- MIGRATION 002: Ownership Isolation, Optimistic Concurrency Revisions & Indexes
-- Safely upgrades pre-existing tables with ownership, assignment, and revision columns
-- ============================================================================

-- 1. Upgrade users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at VARCHAR(50);
UPDATE users SET revision = 1 WHERE revision IS NULL OR revision < 1;

-- 2. Upgrade clients table
ALTER TABLE clients ALTER COLUMN pan TYPE VARCHAR(255);
ALTER TABLE clients ALTER COLUMN aadhaar TYPE VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pan_hash VARCHAR(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
UPDATE clients SET revision = 1 WHERE revision IS NULL OR revision < 1;

-- 3. Upgrade documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS survey_no VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sub_division VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
UPDATE documents SET revision = 1 WHERE revision IS NULL OR revision < 1;

-- 4. Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by_user_id ON documents(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_assigned_to_user_id ON documents(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_survey ON documents(survey_no, sub_division, village);
CREATE INDEX IF NOT EXISTS idx_clients_created_by_user_id ON clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to_user_id ON clients(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_pan_hash ON clients(pan_hash);
CREATE INDEX IF NOT EXISTS idx_clients_aadhaar_hash ON clients(aadhaar_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_finalized_survey
  ON documents(survey_no, sub_division, village)
  WHERE status = 'Finalized';
