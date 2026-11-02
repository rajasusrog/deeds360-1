-- ============================================================================
-- MIGRATION 001: Initial Core Schema
-- UNIKORN360 Deed360 — Core Operational Tables & Supabase User Profiles
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  name TEXT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  organization VARCHAR(255) NOT NULL DEFAULT 'Tamil Nadu STAR 2.0 Registration Dept',
  role VARCHAR(50) NOT NULL DEFAULT 'Client',
  permissions TEXT NOT NULL DEFAULT '["view_own_deeds"]',
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255) NOT NULL DEFAULT '',
  dob VARCHAR(50) NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 0,
  occupation VARCHAR(255) NOT NULL DEFAULT '',
  pan VARCHAR(255) NOT NULL DEFAULT '',
  aadhaar VARCHAR(255) NOT NULL DEFAULT '',
  pan_hash VARCHAR(64),
  aadhaar_hash VARCHAR(64),
  address TEXT NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50),
  created_by VARCHAR(255),
  created_by_user_id VARCHAR(255),
  created_by_email VARCHAR(255),
  assigned_to_user_id VARCHAR(255),
  assigned_to VARCHAR(255),
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doc_no VARCHAR(100) UNIQUE NOT NULL,
  doc_type VARCHAR(100) NOT NULL,
  sub_type VARCHAR(100) NOT NULL DEFAULT '',
  parties_count INTEGER NOT NULL DEFAULT 2,
  property_address TEXT NOT NULL DEFAULT '',
  consideration REAL NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  writer VARCHAR(255) NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(50) NOT NULL,
  modified_at VARCHAR(50) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_by_user_id VARCHAR(255),
  created_by_email VARCHAR(255),
  assigned_to_user_id VARCHAR(255),
  assigned_to VARCHAR(255),
  state TEXT NOT NULL,
  survey_no VARCHAR(50),
  sub_division VARCHAR(50),
  village VARCHAR(100),
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp VARCHAR(50) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  action VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(50) NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS deed_doc_no_seq START WITH 1001 INCREMENT BY 1;
