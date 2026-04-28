-- ============================================================
-- PHASE 3.5 — BONUS PREDICTIONS TABLE
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS bonus_predictions (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  golden_boot_player      text,
  most_yellow_cards_team  text,
  most_red_cards_team     text,
  most_clean_sheets_team  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)           -- one row per user, enforces upsert conflict target
);

CREATE INDEX IF NOT EXISTS bonus_predictions_user_idx ON bonus_predictions(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bonus_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bonus_predictions_updated_at ON bonus_predictions;
CREATE TRIGGER bonus_predictions_updated_at
  BEFORE UPDATE ON bonus_predictions
  FOR EACH ROW EXECUTE FUNCTION update_bonus_predictions_updated_at();

-- RLS
ALTER TABLE bonus_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert bonus predictions"
  ON bonus_predictions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update bonus predictions"
  ON bonus_predictions FOR UPDATE USING (true);

CREATE POLICY "Anyone can read bonus predictions"
  ON bonus_predictions FOR SELECT USING (true);

-- Verify
SELECT 'bonus_predictions table ready' AS status;
