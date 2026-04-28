-- Migration 004: Round 2 comparison support
-- Adds resolution tracking to observations and parameter history snapshots.

ALTER TABLE observations
  ADD COLUMN IF NOT EXISTS resolved_in_round INT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS parameter_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expedient_id    UUID        NOT NULL REFERENCES expedients(id) ON DELETE CASCADE,
  round_number    INT         NOT NULL,
  snapshot        JSONB       NOT NULL,
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (expedient_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_parameter_history_expedient
  ON parameter_history(expedient_id);
