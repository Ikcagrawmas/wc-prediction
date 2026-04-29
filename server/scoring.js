// server/scoring.js
// Pure scoring functions for group stage match predictions.
// Called by the admin result-save route after each match is completed.

/**
 * Score a single group-stage prediction against the actual result.
 *
 * Rules (as defined in Phase 3.5 / ScoringGuide):
 *   5 pts — exact score
 *   4 pts — correct result AND same goal difference
 *   3 pts — correct result, different goal difference
 *   1 pt  — one team's score correct (regardless of result)
 *   0 pts — everything else
 *
 * @param {number} predHome  - predicted home score
 * @param {number} predAway  - predicted away score
 * @param {number} actHome   - actual home score
 * @param {number} actAway   - actual away score
 * @returns {{ points: number, reason: string }}
 */
export function scoreGroupPrediction(predHome, predAway, actHome, actAway) {
  const pH = Number(predHome)
  const pA = Number(predAway)
  const aH = Number(actHome)
  const aA = Number(actAway)

  // Exact score
  if (pH === aH && pA === aA) {
    return { points: 5, reason: 'exact_score' }
  }

  const predResult = Math.sign(pH - pA) // 1=home, -1=away, 0=draw
  const actResult  = Math.sign(aH - aA)

  // Correct result (W/D/L direction)
  if (predResult === actResult) {
    const predGD = pH - pA
    const actGD  = aH - aA
    if (predGD === actGD) {
      return { points: 4, reason: 'correct_result_same_gd' }
    }
    return { points: 3, reason: 'correct_result_diff_gd' }
  }

  // One team's score correct
  if (pH === aH || pA === aA) {
    return { points: 1, reason: 'one_score_correct' }
  }

  return { points: 0, reason: 'wrong_result' }
}

/**
 * Score all predictions for a completed match and return rows to upsert.
 *
 * @param {Object[]} predictions  - rows from predictions table for this match
 *   Each: { id, user_id, match_id, predicted_home_score, predicted_away_score }
 * @param {number}   actualHome
 * @param {number}   actualAway
 * @returns {Object[]} - rows to upsert into prediction_scores
 *   Each: { user_id, match_id, prediction_id, points, scoring_reason, scored_at }
 */
export function scoreMatchPredictions(predictions, actualHome, actualAway) {
  const now = new Date().toISOString()
  return predictions.map(pred => {
    const { points, reason } = scoreGroupPrediction(
      pred.predicted_home_score,
      pred.predicted_away_score,
      actualHome,
      actualAway,
    )
    return {
      user_id:        pred.user_id,
      match_id:       pred.match_id,
      prediction_id:  pred.id,
      points,
      scoring_reason: reason,
      scored_at:      now,
    }
  })
}

/**
 * After upserting prediction_scores, rebuild each user's aggregate score row.
 * Reads ALL prediction_scores for each affected user and recomputes from scratch.
 * This is safe to call multiple times (idempotent).
 *
 * @param {string[]}  userIds      - users whose scores need rebuilding
 * @param {Object}    serviceClient - Supabase service role client
 */
export async function rebuildUserScores(userIds, serviceClient) {
  if (!userIds.length) return

  for (const userId of userIds) {
    // Sum all prediction_scores for this user
    const { data: scoreRows, error } = await serviceClient
      .from('prediction_scores')
      .select('points, scoring_reason')
      .eq('user_id', userId)

    if (error) {
      console.error(`[scoring] Failed to fetch scores for user ${userId}:`, error.message)
      continue
    }

    const matchPoints = scoreRows.reduce((sum, r) => sum + (r.points || 0), 0)
    const exactScores = scoreRows.filter(r => r.scoring_reason === 'exact_score').length

    // Also read existing knockout and bonus points so we don't zero them out
    const { data: existing } = await serviceClient
      .from('scores').select('knockout_points, bonus_points').eq('user_id', userId).single()

    const koPts    = existing?.knockout_points || 0
    const bonusPts = existing?.bonus_points    || 0

    const { error: upsertErr } = await serviceClient
      .from('scores')
      .upsert(
        {
          user_id:         userId,
          match_points:    matchPoints,
          knockout_points: koPts,
          bonus_points:    bonusPts,
          total_points:    matchPoints + koPts + bonusPts,
          exact_scores:    exactScores,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertErr) {
      console.error(`[scoring] Failed to upsert score for user ${userId}:`, upsertErr.message)
    } else {
      console.log(`[scoring] ✓ user ${userId}: ${matchPoints} match + ${koPts} KO + ${bonusPts} bonus = ${matchPoints+koPts+bonusPts} total`)
    }
  }
}

// ─── KNOCKOUT SCORING ─────────────────────────────────────────────────────────

// Points per round for correct advancing team pick
export const KO_POINTS = {
  r32:   3,
  r16:   5,   // note: no separate R16 entry — winner of R32 scored when they reach R16
  qf:    5,
  sf:    8,
  final: 15,
}

/**
 * Score all user knockout_predictions for a specific round+slot against
 * the actual winner. Returns upsert rows for knockout_scores table.
 *
 * @param {string}   round        e.g. 'r32'
 * @param {string}   slot         e.g. 'M73'
 * @param {string}   actualWinner team name
 * @param {Object}   serviceClient
 * @returns {Object} { scoredRows, userIds }
 */
export async function scoreKnockoutSlot(round, slot, actualWinner, serviceClient) {
  if (!actualWinner) return { scoredRows: [], userIds: [] }

  // Fetch all user picks for this round+slot
  const { data: picks, error } = await serviceClient
    .from('knockout_predictions')
    .select('user_id, team_id')
    .eq('round', round)
    .eq('slot', slot)

  if (error) {
    console.error(`[scoring/ko] fetch picks error:`, error.message)
    return { scoredRows: [], userIds: [] }
  }

  // Need team names for picks (stored as team_id)
  const teamIds = [...new Set((picks || []).map(p => p.team_id).filter(Boolean))]
  let teamNameById = {}
  if (teamIds.length) {
    const { data: teams } = await serviceClient
      .from('teams').select('id, name').in('id', teamIds)
    for (const t of (teams || [])) teamNameById[t.id] = t.name
  }

  const pts = KO_POINTS[round] || 0
  const now = new Date().toISOString()

  const scoredRows = (picks || []).map(pick => {
    const pickedTeam = teamNameById[pick.team_id] || null
    const correct    = pickedTeam === actualWinner
    return {
      user_id:  pick.user_id,
      round,
      slot,
      points:   correct ? pts : 0,
      correct,
      scored_at: now,
    }
  })

  const userIds = [...new Set(scoredRows.map(r => r.user_id))]
  return { scoredRows, userIds }
}

/**
 * After scoring a knockout slot, rebuild knockout_points in scores table
 * for all affected users by summing their knockout_scores rows.
 */
export async function rebuildKnockoutPoints(userIds, serviceClient) {
  if (!userIds.length) return

  for (const userId of userIds) {
    const { data: rows } = await serviceClient
      .from('knockout_scores')
      .select('points')
      .eq('user_id', userId)

    const knockoutPoints = (rows || []).reduce((s, r) => s + (r.points || 0), 0)

    // Upsert adding knockout_points, keeping match_points unchanged
    const { data: existing } = await serviceClient
      .from('scores').select('match_points, bonus_points, exact_scores').eq('user_id', userId).single()

    const matchPts  = existing?.match_points  || 0
    const bonusPts  = existing?.bonus_points  || 0
    const exactScrs = existing?.exact_scores  || 0

    await serviceClient.from('scores').upsert({
      user_id:         userId,
      match_points:    matchPts,
      knockout_points: knockoutPoints,
      bonus_points:    bonusPts,
      total_points:    matchPts + knockoutPoints + bonusPts,
      exact_scores:    exactScrs,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })

    console.log(`[scoring/ko] ✓ user ${userId}: ${knockoutPoints} KO pts`)
  }
}

// ─── BONUS SCORING ────────────────────────────────────────────────────────────

const BONUS_POINTS_EACH = 10

/**
 * Score all users' bonus_predictions against actual answers.
 * @param {Object} actual   { golden_boot_player, most_yellow_cards_team, most_red_cards_team, most_clean_sheets_team }
 * @param {Object} serviceClient
 */
export async function scoreBonusPredictions(actual, serviceClient) {
  // Fetch all user bonus predictions
  const { data: preds, error } = await serviceClient
    .from('bonus_predictions')
    .select('user_id, golden_boot_player, most_yellow_cards_team, most_red_cards_team, most_clean_sheets_team')

  if (error) { console.error('[scoring/bonus] fetch error:', error.message); return 0 }

  const now = new Date().toISOString()
  const bonusRows = []
  const userIds   = []

  for (const p of (preds || [])) {
    const gb   = actual.golden_boot_player       && p.golden_boot_player?.toLowerCase().trim()       === actual.golden_boot_player.toLowerCase().trim()       ? BONUS_POINTS_EACH : 0
    const yc   = actual.most_yellow_cards_team   && p.most_yellow_cards_team                         === actual.most_yellow_cards_team                         ? BONUS_POINTS_EACH : 0
    const rc   = actual.most_red_cards_team      && p.most_red_cards_team                            === actual.most_red_cards_team                            ? BONUS_POINTS_EACH : 0
    const cs   = actual.most_clean_sheets_team   && p.most_clean_sheets_team                         === actual.most_clean_sheets_team                         ? BONUS_POINTS_EACH : 0
    const total = gb + yc + rc + cs

    bonusRows.push({
      user_id:              p.user_id,
      golden_boot_points:   gb,
      yellow_cards_points:  yc,
      red_cards_points:     rc,
      clean_sheets_points:  cs,
      total_bonus_points:   total,
      scored_at:            now,
      updated_at:           now,
    })
    userIds.push(p.user_id)
  }

  if (bonusRows.length) {
    const { error: upsertErr } = await serviceClient
      .from('bonus_scores')
      .upsert(bonusRows, { onConflict: 'user_id' })
    if (upsertErr) console.error('[scoring/bonus] upsert error:', upsertErr.message)
  }

  // Rebuild total scores for all affected users
  for (const userId of userIds) {
    const { data: bs } = await serviceClient.from('bonus_scores').select('total_bonus_points').eq('user_id', userId).single()
    const { data: existing } = await serviceClient.from('scores').select('match_points, knockout_points, exact_scores').eq('user_id', userId).single()

    const matchPts    = existing?.match_points    || 0
    const koPts       = existing?.knockout_points || 0
    const bonusPts    = bs?.total_bonus_points    || 0
    const exactScores = existing?.exact_scores    || 0

    await serviceClient.from('scores').upsert({
      user_id:         userId,
      match_points:    matchPts,
      knockout_points: koPts,
      bonus_points:    bonusPts,
      total_points:    matchPts + koPts + bonusPts,
      exact_scores:    exactScores,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  console.log(`[scoring/bonus] ✓ scored ${bonusRows.length} users`)
  return bonusRows.length
}
