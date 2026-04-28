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

    // Upsert into scores table
    const { error: upsertErr } = await serviceClient
      .from('scores')
      .upsert(
        {
          user_id:      userId,
          match_points: matchPoints,
          total_points: matchPoints, // knockout/bonus added later; for now match only
          exact_scores: exactScores,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertErr) {
      console.error(`[scoring] Failed to upsert score for user ${userId}:`, upsertErr.message)
    } else {
      console.log(`[scoring] ✓ user ${userId}: ${matchPoints} pts, ${exactScores} exact`)
    }
  }
}
