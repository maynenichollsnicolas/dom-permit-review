-- ============================================================
-- Migration 003: Escalation system for architect–DOM chat loop
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS escalations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id          UUID NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  zone                  TEXT NOT NULL,
  parameter_tags        TEXT[] DEFAULT '{}',
  -- Architect's original question
  architect_question    TEXT NOT NULL,
  -- What Claude tried before escalating (shown to DOM for context)
  ai_attempted_answer   TEXT,
  ai_escalation_reason  TEXT,
  -- DOM's authoritative answer
  dom_answer            TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'answered')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  answered_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS escalations_expedient_id_idx
  ON escalations (expedient_id);

CREATE INDEX IF NOT EXISTS escalations_zone_status_idx
  ON escalations (zone, status);
