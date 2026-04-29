-- ============================================================
-- PHASE 9 — FULL TOURNAMENT ADMIN + BONUS SCORING
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ACTUAL KNOCKOUT RESULTS
-- Stores the admin-entered winner for each KO slot.
-- round: r32 | r16 | qf | sf | final
-- slot:  M73-M88 (r32), R16_1-R16_8, QF_1-QF_4, SF_1, SF_2, FINAL
-- winner_name: team name string (same as teams.name for easy lookup)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actual_knockout_results (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  round       text        NOT NULL,
  slot        text        NOT NULL,
  winner_name text,                   -- null = not yet determined
  home_team   text,                   -- who played
  away_team   text,
  entered_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round, slot)
);

ALTER TABLE actual_knockout_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read actual_knockout_results"
  ON actual_knockout_results FOR SELECT USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_akr_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS akr_updated_at ON actual_knockout_results;
CREATE TRIGGER akr_updated_at
  BEFORE UPDATE ON actual_knockout_results
  FOR EACH ROW EXECUTE FUNCTION update_akr_updated_at();

-- ─────────────────────────────────────────────
-- 2. ACTUAL BONUS ANSWERS
-- One row per tournament, updated by admin.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actual_bonus_answers (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  golden_boot_player  text,
  most_yellow_cards_team text,
  most_red_cards_team    text,
  most_clean_sheets_team text,
  entered_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE actual_bonus_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read actual_bonus_answers"
  ON actual_bonus_answers FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION update_aba_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aba_updated_at ON actual_bonus_answers;
CREATE TRIGGER aba_updated_at
  BEFORE UPDATE ON actual_bonus_answers
  FOR EACH ROW EXECUTE FUNCTION update_aba_updated_at();

-- ─────────────────────────────────────────────
-- 3. KNOCKOUT_SCORES
-- One row per (user, round, slot) once scored.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knockout_scores (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round      text        NOT NULL,
  slot       text        NOT NULL,
  points     int         NOT NULL DEFAULT 0,
  correct    boolean     NOT NULL DEFAULT false,
  scored_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, round, slot)
);

CREATE INDEX IF NOT EXISTS ko_scores_user_idx ON knockout_scores(user_id);
ALTER TABLE knockout_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read knockout_scores"
  ON knockout_scores FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- 4. BONUS_SCORES
-- One row per user once bonus answers are entered.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bonus_scores (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  golden_boot_points    int         NOT NULL DEFAULT 0,
  yellow_cards_points   int         NOT NULL DEFAULT 0,
  red_cards_points      int         NOT NULL DEFAULT 0,
  clean_sheets_points   int         NOT NULL DEFAULT 0,
  total_bonus_points    int         NOT NULL DEFAULT 0,
  scored_at             timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bonus_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bonus_scores"
  ON bonus_scores FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- 5. Rebuild leaderboard view to include all point types
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id            AS user_id,
  u.username,
  u.created_at    AS registered_at,
  COALESCE(s.match_points,    0)                                  AS match_points,
  COALESCE(s.group_points,    0)                                  AS group_points,
  COALESCE(s.knockout_points, 0)                                  AS knockout_points,
  COALESCE(s.bonus_points,    0)                                  AS bonus_points,
  COALESCE(s.match_points, 0)
    + COALESCE(s.knockout_points, 0)
    + COALESCE(s.bonus_points, 0)                                 AS total_points,
  COALESCE(s.exact_scores,    0)                                  AS exact_scores,
  s.submitted_at,
  s.updated_at,
  RANK() OVER (
    ORDER BY
      (COALESCE(s.match_points,0) + COALESCE(s.knockout_points,0) + COALESCE(s.bonus_points,0)) DESC,
      COALESCE(s.exact_scores, 0) DESC,
      u.created_at ASC
  ) AS rank
FROM users u
LEFT JOIN scores s ON s.user_id = u.id
WHERE u.paid = true
ORDER BY rank;

-- ─────────────────────────────────────────────
-- 6. Verify
-- ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM actual_knockout_results) AS ko_results,
  (SELECT COUNT(*) FROM actual_bonus_answers)    AS bonus_answers,
  (SELECT COUNT(*) FROM knockout_scores)         AS ko_scores,
  (SELECT COUNT(*) FROM bonus_scores)            AS bonus_scores_rows;
