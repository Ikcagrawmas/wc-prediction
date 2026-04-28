-- ============================================================
-- PHASE 5 — SCORING, LEADERBOARD, ADMIN
-- Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Add missing columns to matches
-- ─────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS venue      text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ─────────────────────────────────────────────
-- 2. PREDICTION_SCORES
-- One row per (user, match) after a match is completed.
-- Stores points earned and the reason for transparency.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_scores (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  match_id       uuid        NOT NULL REFERENCES matches(id)     ON DELETE CASCADE,
  prediction_id  uuid        REFERENCES predictions(id)          ON DELETE SET NULL,
  points         int         NOT NULL DEFAULT 0,
  scoring_reason text,          -- e.g. "exact_score", "correct_result_same_gd", ...
  scored_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE INDEX IF NOT EXISTS pred_scores_user_idx  ON prediction_scores(user_id);
CREATE INDEX IF NOT EXISTS pred_scores_match_idx ON prediction_scores(match_id);

-- RLS
ALTER TABLE prediction_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read prediction_scores"
  ON prediction_scores FOR SELECT USING (true);
-- Inserts/updates done by service key on server — no anon policy needed

-- ─────────────────────────────────────────────
-- 3. Enhance SCORES table
-- ─────────────────────────────────────────────
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS exact_scores   int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at   timestamptz;

-- Allow public read (already exists, but safe to re-add)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scores' AND policyname = 'Public can read scores'
  ) THEN
    CREATE POLICY "Public can read scores" ON scores FOR SELECT USING (true);
  END IF;
END
$$;

-- ─────────────────────────────────────────────
-- 4. Leaderboard VIEW for easy querying
-- Joins scores + users, computes rank
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id           AS user_id,
  u.username,
  u.created_at   AS registered_at,
  COALESCE(s.match_points,    0) AS match_points,
  COALESCE(s.group_points,    0) AS group_points,
  COALESCE(s.knockout_points, 0) AS knockout_points,
  COALESCE(s.bonus_points,    0) AS bonus_points,
  COALESCE(s.total_points,    0) AS total_points,
  COALESCE(s.exact_scores,    0) AS exact_scores,
  s.submitted_at,
  s.updated_at,
  RANK() OVER (
    ORDER BY
      COALESCE(s.total_points, 0)  DESC,
      COALESCE(s.exact_scores, 0)  DESC,
      u.created_at                 ASC
  ) AS rank
FROM users u
LEFT JOIN scores s ON s.user_id = u.id
WHERE u.paid = true
ORDER BY rank;

-- ─────────────────────────────────────────────
-- 5. Helper function: upsert a score row for a user
-- Called by server-side scoring after each match result
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_user_score(
  p_user_id        uuid,
  p_match_points   int,
  p_exact_scores   int,
  p_submitted_at   timestamptz DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO scores (user_id, match_points, total_points, exact_scores, submitted_at, updated_at)
  VALUES (
    p_user_id,
    p_match_points,
    p_match_points,
    p_exact_scores,
    COALESCE(p_submitted_at, now()),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    match_points  = scores.match_points  + EXCLUDED.match_points,
    total_points  = scores.total_points  + EXCLUDED.match_points,
    exact_scores  = scores.exact_scores  + EXCLUDED.exact_scores,
    updated_at    = now();
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 6. Verify
-- ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM prediction_scores)  AS prediction_scores_rows,
  (SELECT COUNT(*) FROM scores)              AS scores_rows,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'matches' AND column_name = 'venue') AS matches_has_venue,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'scores' AND column_name = 'exact_scores') AS scores_has_exact_scores;
