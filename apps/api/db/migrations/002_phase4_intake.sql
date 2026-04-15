-- ============================================================
-- Migration 002 — Phase 4 Intake tables + expedient updates
-- Run this in your Supabase SQL Editor AFTER 001_initial.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ARCHITECTS table (must come first — expedients FK depends on it)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS architects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,                 -- links to Supabase auth.users
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  colegio_arquitectos_number TEXT,          -- professional registration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. Add missing columns to expedients
-- ────────────────────────────────────────────────────────────

-- Allow pendiente_admision as a status (recreate constraint)
ALTER TABLE expedients DROP CONSTRAINT IF EXISTS expedients_status_check;
ALTER TABLE expedients ADD CONSTRAINT expedients_status_check
  CHECK (status IN (
    'pendiente_admision',
    'admitido',
    'en_revision',
    'observado',
    'aprobado',
    'rechazado'
  ));

-- When was the application submitted (before admission clock starts)
ALTER TABLE expedients ADD COLUMN IF NOT EXISTS
  submitted_at TIMESTAMPTZ DEFAULT NOW();

-- Link to architect profile
ALTER TABLE expedients ADD COLUMN IF NOT EXISTS
  architect_user_id UUID REFERENCES architects(id);

-- ────────────────────────────────────────────────────────────
-- 3. EXPEDIENT DOCUMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expedient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,              -- matches REQUIRED_DOCUMENTS keys
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,              -- path in Supabase Storage bucket
  ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'done', 'error')),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. ADMISIBILIDAD CHECKLIST
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admisibilidad_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  requirement TEXT NOT NULL,               -- matches REQUIRED_DOCUMENTS key
  -- AI Vision analysis
  ai_status TEXT CHECK (ai_status IN ('pending', 'met', 'unmet', 'uncertain')),
  ai_confidence TEXT CHECK (ai_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  ai_notes TEXT,
  -- Officer override
  final_status TEXT CHECK (final_status IN ('met', 'unmet')),
  officer_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (expedient_id, requirement)
);

-- ────────────────────────────────────────────────────────────
-- 5. Allow the legal deadline trigger to fire on pendiente_admision
--    (admitted_at might be null → guard in function)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_legal_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Only compute when admitted_at is set
  IF NEW.admitted_at IS NOT NULL THEN
    IF NEW.has_revisor_independiente THEN
      NEW.legal_deadline_at := NEW.admitted_at + (NEW.legal_deadline_days / 2 || ' days')::INTERVAL;
    ELSE
      NEW.legal_deadline_at := NEW.admitted_at + (NEW.legal_deadline_days || ' days')::INTERVAL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- 6. Row-Level Security (RLS) hints — enable in Supabase dashboard
--    These policies are permissive for the MVP service-key backend.
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE architects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expedient_documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admisibilidad_checklist ENABLE ROW LEVEL SECURITY;
