-- ============================================================
-- Migration: Deduplication for multi-source data
-- Prevents duplicates when Withings → Apple Health → App
-- ============================================================

-- 1. weight_logs: allow 'apple_health' as a source
ALTER TABLE weight_logs DROP CONSTRAINT IF EXISTS weight_logs_source_check;
ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_source_check
  CHECK (source IN ('withings', 'apple_health', 'manual', 'trendweight'));

-- Add external_id for HealthKit sample UUIDs (allows dedup by source sample)
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Note: weight dedup is handled in application logic (lib/trendAnalysis.ts
-- deduplicateWeightLogs function) because fuzzy time-window matching
-- can't be expressed as an immutable index on timestamptz.

-- 2. workouts: allow 'apple_health' as a source
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_source_check;
ALTER TABLE workouts ADD CONSTRAINT workouts_source_check
  CHECK (source IN ('precor', 'apple_health', 'manual'));

-- Add external_id for HealthKit workout UUIDs
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique constraint: no two synced workouts with same external_id from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_external_dedup
  ON workouts (source, external_id)
  WHERE external_id IS NOT NULL;

-- 3. daily_summaries: add source tracking so we know which system provided the data
ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Ensure daily_summaries date is unique (already has UNIQUE on date, this is just safety)

-- 4. Create a source_priority table for resolving conflicts
-- Lower number = higher priority (Withings is authoritative for weight)
CREATE TABLE IF NOT EXISTS source_priority (
  data_type TEXT NOT NULL,
  source TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  PRIMARY KEY (data_type, source)
);

INSERT INTO source_priority (data_type, source, priority) VALUES
  ('weight', 'withings', 10),
  ('weight', 'apple_health', 20),
  ('weight', 'manual', 30),
  ('workout', 'manual', 10),
  ('workout', 'apple_health', 20),
  ('steps', 'apple_health', 10),
  ('calories', 'apple_health', 10)
ON CONFLICT DO NOTHING;
