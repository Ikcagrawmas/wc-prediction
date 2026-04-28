-- ============================================================
-- PHASE 3.5 FIX — Clean phantom knockout_predictions rows
-- Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (idempotent)
-- ============================================================

-- Remove any knockout_prediction rows where team_id is null.
-- These are "cleared" picks that were previously saved as null
-- instead of being deleted. They cause phantom pick counts.
DELETE FROM knockout_predictions WHERE team_id IS NULL;

-- Verify: no null team_id rows remain
SELECT COUNT(*) AS phantom_rows_remaining
FROM knockout_predictions
WHERE team_id IS NULL;
-- Expected: 0
