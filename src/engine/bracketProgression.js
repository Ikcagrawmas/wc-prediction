// bracketProgression.js
// Pure functions. Takes knockoutPicks and cascades winners round by round.
// R32 winners feed R16, R16 winners feed QF, QF → SF, SF → Final.
//
// Round keys:  r32 | r16 | qf | sf | final
// Slot keys:   M73–M88 (R32), R16_1–R16_8, QF_1–QF_4, SF_1–SF_2, FINAL

// ─── STRUCTURE DEFINITIONS ───────────────────────────────────────────────────

export const R16_PAIRINGS = [
  { slot: 'R16_1', homeFrom: { round: 'r32', slot: 'M73' }, awayFrom: { round: 'r32', slot: 'M74' } },
  { slot: 'R16_2', homeFrom: { round: 'r32', slot: 'M75' }, awayFrom: { round: 'r32', slot: 'M76' } },
  { slot: 'R16_3', homeFrom: { round: 'r32', slot: 'M77' }, awayFrom: { round: 'r32', slot: 'M78' } },
  { slot: 'R16_4', homeFrom: { round: 'r32', slot: 'M79' }, awayFrom: { round: 'r32', slot: 'M80' } },
  { slot: 'R16_5', homeFrom: { round: 'r32', slot: 'M81' }, awayFrom: { round: 'r32', slot: 'M82' } },
  { slot: 'R16_6', homeFrom: { round: 'r32', slot: 'M83' }, awayFrom: { round: 'r32', slot: 'M84' } },
  { slot: 'R16_7', homeFrom: { round: 'r32', slot: 'M85' }, awayFrom: { round: 'r32', slot: 'M86' } },
  { slot: 'R16_8', homeFrom: { round: 'r32', slot: 'M87' }, awayFrom: { round: 'r32', slot: 'M88' } },
]

export const QF_PAIRINGS = [
  { slot: 'QF_1', homeFrom: { round: 'r16', slot: 'R16_1' }, awayFrom: { round: 'r16', slot: 'R16_2' } },
  { slot: 'QF_2', homeFrom: { round: 'r16', slot: 'R16_3' }, awayFrom: { round: 'r16', slot: 'R16_4' } },
  { slot: 'QF_3', homeFrom: { round: 'r16', slot: 'R16_5' }, awayFrom: { round: 'r16', slot: 'R16_6' } },
  { slot: 'QF_4', homeFrom: { round: 'r16', slot: 'R16_7' }, awayFrom: { round: 'r16', slot: 'R16_8' } },
]

export const SF_PAIRINGS = [
  { slot: 'SF_1', homeFrom: { round: 'qf', slot: 'QF_1' }, awayFrom: { round: 'qf', slot: 'QF_2' } },
  { slot: 'SF_2', homeFrom: { round: 'qf', slot: 'QF_3' }, awayFrom: { round: 'qf', slot: 'QF_4' } },
]

export const FINAL_PAIRING = {
  slot: 'FINAL',
  homeFrom: { round: 'sf', slot: 'SF_1' },
  awayFrom: { round: 'sf', slot: 'SF_2' },
}

export const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final']

export const ROUND_LABELS = {
  r32:      'Round of 32',
  r16:      'Round of 16',
  qf:       'Quarterfinals',
  sf:       'Semifinals',
  final:    'Final',
  champion: 'Champion',
}

// ─── DEPENDENCY MAP ───────────────────────────────────────────────────────────
// For each slot, which downstream slot does it feed into?
// Used to cascade-clear picks when a parent pick is removed.
// Format: "round|slot" → "childRound|childSlot"

const PARENT_TO_CHILD = {}

for (const p of R16_PAIRINGS) {
  PARENT_TO_CHILD[`r32|${p.homeFrom.slot}`] = `r16|${p.slot}`
  PARENT_TO_CHILD[`r32|${p.awayFrom.slot}`] = `r16|${p.slot}`
}
for (const p of QF_PAIRINGS) {
  PARENT_TO_CHILD[`r16|${p.homeFrom.slot}`] = `qf|${p.slot}`
  PARENT_TO_CHILD[`r16|${p.awayFrom.slot}`] = `qf|${p.slot}`
}
for (const p of SF_PAIRINGS) {
  PARENT_TO_CHILD[`qf|${p.homeFrom.slot}`] = `sf|${p.slot}`
  PARENT_TO_CHILD[`qf|${p.awayFrom.slot}`] = `sf|${p.slot}`
}
PARENT_TO_CHILD[`sf|${FINAL_PAIRING.homeFrom.slot}`] = `final|${FINAL_PAIRING.slot}`
PARENT_TO_CHILD[`sf|${FINAL_PAIRING.awayFrom.slot}`] = `final|${FINAL_PAIRING.slot}`

// ─── CASCADE CLEAR ────────────────────────────────────────────────────────────

/**
 * When a pick is cleared (set to null), walk the dependency chain downward
 * and null-out any downstream slot whose stored pick matched the team that
 * was propagated from the cleared slot.
 *
 * Works by tracing: cleared slot → child slot → grandchild → ... until
 * the chain ends or a downstream slot no longer carries the invalidated team.
 *
 * @param {Object} picks     - current knockoutPicks map (not mutated)
 * @param {string} round     - round of the slot being cleared, e.g. "r32"
 * @param {string} slot      - slot being cleared, e.g. "M73"
 * @returns {Object}         - new picks map with all affected downstreams nulled
 */
export function cascadeClearPicks(picks, round, slot) {
  const next = { ...picks }
  const cleared = picks[`${round}|${slot}`] // the team that was picked here

  // Nothing was picked here — nothing to cascade
  if (!cleared) return next

  // Null out the slot itself
  next[`${round}|${slot}`] = null

  // Walk downstream: keep clearing as long as the child slot holds the same team
  let currentKey = `${round}|${slot}`
  while (true) {
    const childKey = PARENT_TO_CHILD[currentKey]
    if (!childKey) break // end of chain

    const childPick = next[childKey]
    if (!childPick || childPick !== cleared) break // child picked a different team — stop

    // Child carries the same team that was just cleared — null it out too
    next[childKey] = null
    currentKey = childKey
  }

  return next
}

// ─── BRACKET GENERATOR ───────────────────────────────────────────────────────

/**
 * Given the R32 matchups and all knockout picks, produce a fully resolved
 * bracket display through to champion.
 */
export function generateFullBracket(roundOf32, knockoutPicks) {
  const picks = knockoutPicks || {}

  const getPick    = (round, slot) => picks[`${round}|${slot}`] || null
  const resolveTeam = (round, slot) => getPick(round, slot) || null

  // R32 — teams come from group stage engine, picks are user selections
  const r32Resolved = roundOf32.map(m => ({
    slot: m.slot,
    home_team: m.home_team,
    away_team: m.away_team,
    picked: getPick('r32', m.slot),
  }))

  // R16 — teams are the R32 winners the user picked
  const r16Resolved = R16_PAIRINGS.map(p => {
    const home = resolveTeam('r32', p.homeFrom.slot)
    const away = resolveTeam('r32', p.awayFrom.slot)
    return {
      slot: p.slot,
      home_team: home || 'TBD',
      away_team: away || 'TBD',
      homeFrom: p.homeFrom,
      awayFrom: p.awayFrom,
      picked: getPick('r16', p.slot),
    }
  })

  // QF
  const qfResolved = QF_PAIRINGS.map(p => {
    const home = resolveTeam('r16', p.homeFrom.slot)
    const away = resolveTeam('r16', p.awayFrom.slot)
    return {
      slot: p.slot,
      home_team: home || 'TBD',
      away_team: away || 'TBD',
      homeFrom: p.homeFrom,
      awayFrom: p.awayFrom,
      picked: getPick('qf', p.slot),
    }
  })

  // SF
  const sfResolved = SF_PAIRINGS.map(p => {
    const home = resolveTeam('qf', p.homeFrom.slot)
    const away = resolveTeam('qf', p.awayFrom.slot)
    return {
      slot: p.slot,
      home_team: home || 'TBD',
      away_team: away || 'TBD',
      homeFrom: p.homeFrom,
      awayFrom: p.awayFrom,
      picked: getPick('sf', p.slot),
    }
  })

  // Final
  const finalMatch = {
    slot: FINAL_PAIRING.slot,
    home_team: resolveTeam('sf', FINAL_PAIRING.homeFrom.slot) || 'TBD',
    away_team: resolveTeam('sf', FINAL_PAIRING.awayFrom.slot) || 'TBD',
    picked: getPick('final', FINAL_PAIRING.slot),
  }

  // Champion — purely the Final pick, nothing else
  const champion = finalMatch.picked || null

  return {
    r32:     r32Resolved,
    r16:     r16Resolved,
    qf:      qfResolved,
    sf:      sfResolved,
    final:   [finalMatch],
    champion,
  }
}

// ─── PICK COUNTER ─────────────────────────────────────────────────────────────

/**
 * Count EXPLICIT user selections across all knockout rounds.
 * Max: 16 (r32) + 8 (r16) + 4 (qf) + 2 (sf) + 1 (final) = 31
 * Only non-empty strings in valid rounds count. Nulls, undefineds, and
 * auto-generated team names never enter knockoutPicks, so they never count.
 */
export const VALID_KO_ROUNDS = new Set(['r32', 'r16', 'qf', 'sf', 'final'])

export function countBracketPicks(knockoutPicks) {
  if (!knockoutPicks) return 0
  let count = 0
  for (const [key, val] of Object.entries(knockoutPicks)) {
    const [round] = key.split('|')
    if (VALID_KO_ROUNDS.has(round) && typeof val === 'string' && val.length > 0) {
      count++
    }
  }
  return count
}
