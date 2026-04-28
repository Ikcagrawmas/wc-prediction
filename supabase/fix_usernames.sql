-- ============================================================
-- USERNAME FIX — Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Show any users where username looks like an email (broken records)
SELECT id, email, username, paid
FROM users
WHERE username LIKE '%@%' OR username IS NULL
ORDER BY created_at;

-- 2. Fix: if username is null or looks like an email, set it to the
--    part before the @ sign as a temporary fix
-- YOU SHOULD REVIEW THIS OUTPUT and manually set correct usernames
-- if you know what they should be. Then run:
UPDATE users
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL OR username LIKE '%@%';

-- 3. Verify the leaderboard view returns username correctly
SELECT rank, username, total_points, exact_scores
FROM leaderboard
ORDER BY rank
LIMIT 10;

-- 4. Refresh the view definition to ensure it picks up username correctly
-- (Recreate only if the view is missing or broken)
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

-- 5. Confirm: should show username (not email) for all rows
SELECT rank, username, total_points FROM leaderboard LIMIT 5;
