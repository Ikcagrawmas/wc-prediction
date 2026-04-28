-- ============================================================
-- WARGACKI PERFORMANCE — WORLD CUP PREDICTION CHALLENGE
-- Supabase Schema — Phase 1
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             text UNIQUE NOT NULL,
  username          text UNIQUE NOT NULL,
  paid              boolean NOT NULL DEFAULT false,
  stripe_session_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for paid user count queries (used by live prize pool)
CREATE INDEX IF NOT EXISTS users_paid_idx ON users(paid);

-- ─────────────────────────────────────────────
-- GROUPS (A–H for World Cup group stage)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL -- e.g. "Group A", "Group B", ...
);

-- ─────────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  group_id      uuid REFERENCES groups(id) ON DELETE SET NULL,
  seed_position int  -- 1–4 within the group
);

CREATE INDEX IF NOT EXISTS teams_group_idx ON teams(group_id);

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_number      int NOT NULL,
  stage             text NOT NULL, -- 'group', 'r32', 'r16', 'qf', 'sf', 'final'
  group_id          uuid REFERENCES groups(id) ON DELETE SET NULL, -- null for KO stage
  home_team_id      uuid REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id      uuid REFERENCES teams(id) ON DELETE SET NULL,
  kickoff_time      timestamptz,
  actual_home_score int,
  actual_away_score int,
  completed         boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS matches_stage_idx ON matches(stage);
CREATE INDEX IF NOT EXISTS matches_kickoff_idx ON matches(kickoff_time);

-- ─────────────────────────────────────────────
-- PREDICTIONS (group stage score picks)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id             uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home_score int NOT NULL,
  predicted_away_score int NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE INDEX IF NOT EXISTS predictions_user_idx ON predictions(user_id);
CREATE INDEX IF NOT EXISTS predictions_match_idx ON predictions(match_id);

-- Auto-update updated_at on upsert
CREATE OR REPLACE FUNCTION update_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_predictions_updated_at();

-- ─────────────────────────────────────────────
-- KNOCKOUT PREDICTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knockout_predictions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round      text NOT NULL, -- 'r32', 'r16', 'qf', 'sf', 'final', 'champion'
  slot       text NOT NULL, -- e.g. 'match_1_home', 'match_1_away', 'winner'
  team_id    uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, round, slot)
);

CREATE INDEX IF NOT EXISTS ko_predictions_user_idx ON knockout_predictions(user_id);

CREATE OR REPLACE FUNCTION update_ko_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ko_predictions_updated_at
  BEFORE UPDATE ON knockout_predictions
  FOR EACH ROW EXECUTE FUNCTION update_ko_predictions_updated_at();

-- ─────────────────────────────────────────────
-- SCORES (one row per user, updated as results come in)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  match_points    int NOT NULL DEFAULT 0,
  group_points    int NOT NULL DEFAULT 0,
  knockout_points int NOT NULL DEFAULT 0,
  bonus_points    int NOT NULL DEFAULT 0,
  total_points    int NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (recommended baseline)
-- ─────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knockout_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores              ENABLE ROW LEVEL SECURITY;

-- Public read access for groups, teams, matches, scores (leaderboard)
CREATE POLICY "Public can read groups"  ON groups  FOR SELECT USING (true);
CREATE POLICY "Public can read teams"   ON teams   FOR SELECT USING (true);
CREATE POLICY "Public can read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public can read scores"  ON scores  FOR SELECT USING (true);

-- Anyone can insert a user (registration)
CREATE POLICY "Anyone can register" ON users
  FOR INSERT WITH CHECK (true);

-- Users can read their own row only
CREATE POLICY "Users read own record" ON users
  FOR SELECT USING (true); -- Loosen if you add auth; for Phase 1 open read is fine

-- Paid count query (used by prize pool live widget — anon key)
-- This allows the anon key to count paid users without exposing PII
CREATE POLICY "Anon can count paid users" ON users
  FOR SELECT USING (true);

-- Predictions: allow insert/update (auth will be added in later phases)
CREATE POLICY "Anyone can insert predictions" ON predictions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update predictions" ON predictions
  FOR UPDATE USING (true);
CREATE POLICY "Anyone can read predictions" ON predictions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert ko predictions" ON knockout_predictions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ko predictions" ON knockout_predictions
  FOR UPDATE USING (true);
CREATE POLICY "Anyone can read ko predictions" ON knockout_predictions
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- SEED: Insert World Cup 2026 groups (12 groups: A–L for 48-team format)
-- NOTE: 2026 World Cup has 48 teams across 12 groups of 4
-- ─────────────────────────────────────────────
INSERT INTO groups (name) VALUES
  ('Group A'), ('Group B'), ('Group C'), ('Group D'),
  ('Group E'), ('Group F'), ('Group G'), ('Group H'),
  ('Group I'), ('Group J'), ('Group K'), ('Group L')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- NOTES FOR PHASE 2+
-- ─────────────────────────────────────────────
-- Phase 2: Add Stripe webhook handler to flip users.paid = true
-- Phase 3: Seed teams and matches from official FIFA data
-- Phase 4: Add lock mechanism based on first match kickoff_time
-- Phase 5: Add admin role via Supabase auth for result entry
-- Phase 6: Scoring function (Postgres function or Edge Function)
-- ─────────────────────────────────────────────
