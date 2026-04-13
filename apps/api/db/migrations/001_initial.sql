-- ============================================================
-- DOM Permit Review AI — Initial Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- USERS (DOM staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'revisor_tecnico',
    'jefe_departamento',
    'director_dom',
    'admisibilidad',
    'inspector',
    'recepcion_definitiva',
    'catastro'
  )),
  municipality TEXT NOT NULL DEFAULT 'Las Condes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPEDIENTS (permit applications)
-- ============================================================
CREATE TABLE IF NOT EXISTS expedients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exp_number TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  municipality TEXT NOT NULL DEFAULT 'Las Condes',
  project_type TEXT NOT NULL CHECK (project_type IN (
    'obra_nueva_residencial',
    'ampliacion_residencial'
  )),
  zone TEXT NOT NULL DEFAULT 'ZHR2',
  architect_name TEXT,
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'admitido' CHECK (status IN (
    'admitido', 'en_revision', 'observado', 'aprobado', 'rechazado'
  )),
  admitted_at TIMESTAMPTZ DEFAULT NOW(),
  legal_deadline_days INTEGER NOT NULL DEFAULT 30,
  legal_deadline_at TIMESTAMPTZ,
  current_round INTEGER NOT NULL DEFAULT 1,
  has_revisor_independiente BOOLEAN DEFAULT FALSE,
  assigned_reviewer_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-compute legal deadline on insert/update
CREATE OR REPLACE FUNCTION compute_legal_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Halve deadline if Revisor Independiente present
  IF NEW.has_revisor_independiente THEN
    NEW.legal_deadline_at := NEW.admitted_at + (NEW.legal_deadline_days / 2 || ' days')::INTERVAL;
  ELSE
    NEW.legal_deadline_at := NEW.admitted_at + (NEW.legal_deadline_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_legal_deadline
  BEFORE INSERT OR UPDATE ON expedients
  FOR EACH ROW EXECUTE FUNCTION compute_legal_deadline();

-- ============================================================
-- PROJECT PARAMETERS (CIP + architect declarations)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  -- CIP (what's allowed per zone)
  cip_number TEXT,
  cip_date DATE,
  cip_constructibilidad_max NUMERIC,
  cip_ocupacion_suelo_max NUMERIC,
  cip_altura_maxima_m NUMERIC,
  cip_densidad_max_hab_ha NUMERIC,
  cip_estacionamientos_min NUMERIC,
  cip_distanciamiento_lateral_m NUMERIC,
  cip_distanciamiento_fondo_m NUMERIC,
  cip_antejardin_m NUMERIC,
  -- Declared by architect
  declared_constructibilidad NUMERIC,
  declared_ocupacion_suelo NUMERIC,
  declared_altura_m NUMERIC,
  declared_densidad_hab_ha NUMERIC,
  declared_estacionamientos NUMERIC,
  declared_distanciamiento_lateral_m NUMERIC,
  declared_distanciamiento_fondo_m NUMERIC,
  declared_antejardin_m NUMERIC,
  declared_superficie_predio_m2 NUMERIC,
  declared_superficie_total_edificada_m2 NUMERIC,
  declared_num_unidades_vivienda INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPLIANCE CHECKS (one per review round)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed'
  )),
  ai_raw_output JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OBSERVATIONS (individual findings with full lifecycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  compliance_check_id UUID NOT NULL REFERENCES compliance_checks(id) ON DELETE CASCADE,
  round_introduced INTEGER NOT NULL,
  parameter TEXT NOT NULL,
  -- AI verdict
  ai_verdict TEXT CHECK (ai_verdict IN ('VIOLATION', 'COMPLIANT', 'NEEDS_REVIEW', 'SIN_DATOS')),
  ai_confidence TEXT CHECK (ai_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  declared_value TEXT,
  allowed_value TEXT,
  delta TEXT,
  normative_reference TEXT,
  chunk_ids TEXT[],
  ai_draft_text TEXT,
  -- Round tracking
  round_status TEXT NOT NULL DEFAULT 'NUEVA' CHECK (round_status IN (
    'NUEVA', 'PENDIENTE', 'SUBSANADA', 'REABIERTA'
  )),
  -- Reviewer actions
  reviewer_action TEXT DEFAULT 'pending' CHECK (reviewer_action IN (
    'pending', 'accepted', 'edited', 'discarded'
  )),
  reviewer_final_text TEXT,
  reviewer_discard_reason TEXT,
  reviewer_notes TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  is_manual_addition BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTAS DE OBSERVACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS actas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  acta_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  content JSONB,
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REGULATORY CHUNKS (pgvector RAG store)
-- ============================================================
CREATE TABLE IF NOT EXISTS regulatory_chunks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('OGUC', 'LGUC', 'PRC_LAS_CONDES', 'LEY_21718')),
  article TEXT,
  zone TEXT,
  parameter_types TEXT[],
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  article_reference TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS regulatory_chunks_embedding_idx
  ON regulatory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ============================================================
-- DEMO DATA — Single reviewer user for MVP
-- ============================================================
INSERT INTO users (id, email, name, role, municipality)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'revisor@lascondes.cl',
  'Ana Martínez',
  'revisor_tecnico',
  'Las Condes'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DEMO EXPEDIENT — Pre-loaded with deliberate violations
-- ============================================================
INSERT INTO expedients (
  id, exp_number, address, municipality, project_type, zone,
  architect_name, owner_name, status, admitted_at,
  legal_deadline_days, current_round,
  assigned_reviewer_id
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '2024-0847',
  'Av. Apoquindo 4521',
  'Las Condes',
  'obra_nueva_residencial',
  'ZHR2',
  'Arq. Carlos Reyes',
  'Inmobiliaria Apoquindo S.A.',
  'en_revision',
  NOW() - INTERVAL '2 days',
  30,
  1,
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (exp_number) DO NOTHING;

INSERT INTO project_parameters (
  expedient_id,
  cip_number, cip_date,
  cip_constructibilidad_max, cip_ocupacion_suelo_max,
  cip_altura_maxima_m, cip_densidad_max_hab_ha,
  cip_estacionamientos_min, cip_distanciamiento_lateral_m,
  cip_distanciamiento_fondo_m, cip_antejardin_m,
  declared_constructibilidad, declared_ocupacion_suelo,
  declared_altura_m, declared_densidad_hab_ha,
  declared_estacionamientos, declared_distanciamiento_lateral_m,
  declared_distanciamiento_fondo_m, declared_antejardin_m,
  declared_superficie_predio_m2, declared_superficie_total_edificada_m2,
  declared_num_unidades_vivienda
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  'CIP-2024-1205', '2024-01-10',
  1.80, 0.50, 15.00, 400, 1.0, 3.00, 3.00, 5.00,
  1.72, 0.61, 18.50, 312, 0.80, 3.00, 3.00, 5.00,
  1200, 2064, 24
);
