-- ============================================================
-- PHASE 4 — RLS policies for server-side webhook access
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- The webhook uses the Supabase SERVICE ROLE KEY which bypasses RLS entirely.
-- These policies are for the anon key (frontend reads).
-- If you're using the service key on the server, no additional SQL is needed
-- for the webhook itself.

-- Ensure anon key can read its own user row by user_id (needed for check-access)
-- Already covered by Phase 1's open SELECT policy.
-- This is a reminder only — no SQL change needed if Phase 1 was applied.

-- Verify current paid user count (run to confirm prize pool is working)
SELECT
  COUNT(*) FILTER (WHERE paid = true)  AS paid_users,
  COUNT(*) FILTER (WHERE paid = false) AS unpaid_users,
  COUNT(*)                              AS total_users
FROM users;

-- Verify stripe_session_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('paid', 'stripe_session_id');
-- Expected: 2 rows

-- ─────────────────────────────────────────────────────────────────────
-- How to get your Supabase service role key:
-- Dashboard → Settings → API → "service_role" key (keep SECRET, server only)
-- Add it to .env as: SUPABASE_SERVICE_KEY=eyJhbGci...
-- ─────────────────────────────────────────────────────────────────────
