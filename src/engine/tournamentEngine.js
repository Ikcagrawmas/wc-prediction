// ============================================================
// TOURNAMENT ENGINE — FIFA World Cup 2026
// Pure functions. No side effects. No UI dependencies.
// All functions work on plain JS objects.
// ============================================================

import { GROUP_STAGE_MATCHES, ROUND_OF_32_BRACKET } from './tournamentData.js'

// ─── TYPES (JSDoc) ───────────────────────────────────────────────────────────
/**
 * @typedef {Object} TeamStanding
 * @property {string}  team          - Team name
 * @property {string}  group         - Group name (e.g. "Group A")
 * @property {number}  seed_position - Pot position used as final tiebreaker
 * @property {number}  played
 * @property {number}  wins
 * @property {number}  draws
 * @property {number}  losses
 * @property {number}  goals_for
 * @property {number}  goals_against
 * @property {number}  goal_difference
 * @property {number}  points
 * @property {number}  rank          - 1-4 within group
 */

/**
 * @typedef {Object} PredictedScore
 * @property {string}  home_team
 * @property {string}  away_team
 * @property {number}  predicted_home_score
 * @property {number}  predicted_away_score
 */

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Compare two standings entries using FIFA group-stage tiebreaker rules.
 * Returns negative if a > b (a ranks higher).
 * Rules: points → GD → GF → seed_position (lower = better)
 */
function compareStandings(a, b) {
  if (b.points !== a.points) return b.points - a.points
  if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
  if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
  return a.seed_position - b.seed_position // lower seed = better (1 > 2 > 3 > 4)
}

/**
 * Compare two third-place standings using FIFA third-place ranking rules.
 * Same criteria as group tiebreaker.
 */
function compareThirdPlace(a, b) {
  return compareStandings(a, b)
}

// ─── CORE ENGINE FUNCTIONS ───────────────────────────────────────────────────

/**
 * Calculate standings for all teams in a single group, given a set of
 * predicted (or actual) scores for that group's matches.
 *
 * @param {string} groupName   - e.g. "Group A"
 * @param {TeamInfo[]} teams   - array of { name, group, seed_position }
 * @param {PredictedScore[]} predictions - all user predictions (filtered internally)
 * @returns {TeamStanding[]}   sorted by rank (1st → 4th)
 */
export function calculateGroupStandings(groupName, teams, predictions) {
  // Init standings map
  const standings = {}
  for (const team of teams) {
    standings[team.name] = {
      team: team.name,
      group: groupName,
      seed_position: team.seed_position,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    }
  }

  // Get all group matches
  const groupMatches = GROUP_STAGE_MATCHES.filter(m => m.group === groupName)

  // Build prediction lookup: "homeTeam|awayTeam" → { home_score, away_score }
  const predMap = {}
  for (const pred of predictions) {
    const key = `${pred.home_team}|${pred.away_team}`
    predMap[key] = {
      home_score: pred.predicted_home_score,
      away_score: pred.predicted_away_score,
    }
  }

  // Process each match
  for (const match of groupMatches) {
    const key = `${match.home_team}|${match.away_team}`
    const pred = predMap[key]
    if (!pred) continue // no prediction for this match — skip

    const homeGoals = pred.home_score
    const awayGoals = pred.away_score

    const homeStanding = standings[match.home_team]
    const awayStanding = standings[match.away_team]
    if (!homeStanding || !awayStanding) continue

    homeStanding.played++
    awayStanding.played++
    homeStanding.goals_for += homeGoals
    homeStanding.goals_against += awayGoals
    awayStanding.goals_for += awayGoals
    awayStanding.goals_against += homeGoals

    if (homeGoals > awayGoals) {
      homeStanding.wins++
      homeStanding.points += 3
      awayStanding.losses++
    } else if (homeGoals < awayGoals) {
      awayStanding.wins++
      awayStanding.points += 3
      homeStanding.losses++
    } else {
      homeStanding.draws++
      awayStanding.draws++
      homeStanding.points += 1
      awayStanding.points += 1
    }

    homeStanding.goal_difference = homeStanding.goals_for - homeStanding.goals_against
    awayStanding.goal_difference = awayStanding.goals_for - awayStanding.goals_against
  }

  // Sort and assign ranks
  const sorted = Object.values(standings).sort(compareStandings)
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }))
}

/**
 * Calculate standings for ALL 12 groups at once.
 *
 * @param {Object} teamsByGroup   - { "Group A": [{ name, group, seed_position }, ...], ... }
 * @param {PredictedScore[]} predictions
 * @returns {Object}              - { "Group A": TeamStanding[], "Group B": ..., ... }
 */
export function calculateAllGroupStandings(teamsByGroup, predictions) {
  const result = {}
  for (const [groupName, teams] of Object.entries(teamsByGroup)) {
    result[groupName] = calculateGroupStandings(groupName, teams, predictions)
  }
  return result
}

/**
 * From all 12 group standings, select the best 8 third-place teams
 * that advance to the Round of 32.
 *
 * @param {Object} allGroupStandings - output of calculateAllGroupStandings
 * @returns {TeamStanding[]} top 8 third-place teams, sorted (best first)
 */
export function calculateBestThirdPlaceTeams(allGroupStandings) {
  const thirdPlaceTeams = []

  for (const standings of Object.values(allGroupStandings)) {
    // rank 3 = index 2
    const third = standings.find(s => s.rank === 3)
    if (third) thirdPlaceTeams.push(third)
  }

  // Sort by FIFA third-place ranking criteria
  thirdPlaceTeams.sort(compareThirdPlace)

  return thirdPlaceTeams.slice(0, 8)
}

/**
 * Given a user's predicted group results, generate their full Round of 32 bracket.
 * Each user gets a unique bracket based on their specific predictions.
 *
 * @param {Object} allGroupStandings  - output of calculateAllGroupStandings
 * @param {TeamStanding[]} best8Third - output of calculateBestThirdPlaceTeams
 * @returns {Array} Round of 32 matchups with resolved team names
 */
export function generateRoundOf32(allGroupStandings, best8Third) {
  // Extract winners, runners-up, and third-place qualifiers by group
  const winners = {}    // { "A": "Mexico", "B": "Canada", ... }
  const runnersUp = {}  // { "A": "South Korea", ... }

  for (const [groupName, standings] of Object.entries(allGroupStandings)) {
    const letter = groupName.replace('Group ', '')
    const first  = standings.find(s => s.rank === 1)
    const second = standings.find(s => s.rank === 2)
    if (first)  winners[letter]   = first.team
    if (second) runnersUp[letter] = second.team
  }

  // Build a set of which groups produced qualifying third-place teams
  const qualifyingThirdGroups = new Set(best8Third.map(t => t.group.replace('Group ', '')))

  // For each bracket slot that involves a "best 3rd" team, resolve which
  // specific third-place team fills it based on the official FIFA rule:
  // The 3rd-place teams are assigned to bracket slots based on which groups
  // they came from. The exact assignment table is published by FIFA after
  // the group stage. For prediction purposes we assign by rank order.
  const thirdPlaceQueue = [...best8Third] // ordered best → worst

  // FIFA assigns 3rd-place teams to bracket slots in a predefined order
  // based on which group combinations advance. For the prediction engine,
  // we use the order of assignment from the official schedule:
  // Slots that need a 3rd-place team (ordered by match number):
  // M74: best 3rd from A/B/C/D/F  → first qualifying 3rd from those groups
  // M77: best 3rd from C/D/F/G/H
  // M79: best 3rd from C/E/F/H/I
  // M80: best 3rd from E/H/I/J/K
  // M81: best 3rd from B/E/F/I/J
  // M82: best 3rd from A/E/H/I/J
  // M85: best 3rd from E/F/G/I/J
  // M87: best 3rd from D/E/I/J/L

  const THIRD_SLOT_ELIGIBLE = {
    M74: ['A','B','C','D','F'],
    M77: ['C','D','F','G','H'],
    M79: ['C','E','F','H','I'],
    M80: ['E','H','I','J','K'],
    M81: ['B','E','F','I','J'],
    M82: ['A','E','H','I','J'],
    M85: ['E','F','G','I','J'],
    M87: ['D','E','I','J','L'],
  }

  // Assign third-place teams to slots greedily (best available that's eligible)
  const assigned = {}
  const usedThird = new Set()

  for (const [slot, eligibleGroups] of Object.entries(THIRD_SLOT_ELIGIBLE)) {
    // Find best unassigned 3rd-place team from an eligible group
    const match = thirdPlaceQueue.find(
      t => !usedThird.has(t.team) && eligibleGroups.includes(t.group.replace('Group ', ''))
    )
    if (match) {
      assigned[slot] = match.team
      usedThird.add(match.team)
    } else {
      // Fallback: use next best unassigned 3rd-place team
      const fallback = thirdPlaceQueue.find(t => !usedThird.has(t.team))
      assigned[slot] = fallback ? fallback.team : 'TBD'
      if (fallback) usedThird.add(fallback.team)
    }
  }

  // Build the bracket
  const bracket = ROUND_OF_32_BRACKET.map(bracketMatch => {
    const { slot, match_number, desc, kickoff_utc, venue, city } = bracketMatch

    let homeTeam = 'TBD'
    let awayTeam = 'TBD'

    switch (slot) {
      case 'M73':
        homeTeam = runnersUp['A'] || 'TBD'
        awayTeam = runnersUp['B'] || 'TBD'
        break
      case 'M74':
        homeTeam = winners['E'] || 'TBD'
        awayTeam = assigned['M74'] || 'TBD'
        break
      case 'M75':
        homeTeam = winners['F'] || 'TBD'
        awayTeam = runnersUp['C'] || 'TBD'
        break
      case 'M76':
        homeTeam = winners['C'] || 'TBD'
        awayTeam = runnersUp['F'] || 'TBD'
        break
      case 'M77':
        homeTeam = winners['I'] || 'TBD'
        awayTeam = assigned['M77'] || 'TBD'
        break
      case 'M78':
        homeTeam = runnersUp['E'] || 'TBD'
        awayTeam = runnersUp['I'] || 'TBD'
        break
      case 'M79':
        homeTeam = winners['A'] || 'TBD'
        awayTeam = assigned['M79'] || 'TBD'
        break
      case 'M80':
        homeTeam = winners['L'] || 'TBD'
        awayTeam = assigned['M80'] || 'TBD'
        break
      case 'M81':
        homeTeam = winners['D'] || 'TBD'
        awayTeam = assigned['M81'] || 'TBD'
        break
      case 'M82':
        homeTeam = winners['G'] || 'TBD'
        awayTeam = assigned['M82'] || 'TBD'
        break
      case 'M83':
        homeTeam = runnersUp['K'] || 'TBD'
        awayTeam = runnersUp['L'] || 'TBD'
        break
      case 'M84':
        homeTeam = winners['H'] || 'TBD'
        awayTeam = runnersUp['J'] || 'TBD'
        break
      case 'M85':
        homeTeam = winners['B'] || 'TBD'
        awayTeam = assigned['M85'] || 'TBD'
        break
      case 'M86':
        homeTeam = winners['J'] || 'TBD'
        awayTeam = runnersUp['H'] || 'TBD'
        break
      case 'M87':
        homeTeam = winners['K'] || 'TBD'
        awayTeam = assigned['M87'] || 'TBD'
        break
      case 'M88':
        homeTeam = runnersUp['D'] || 'TBD'
        awayTeam = runnersUp['G'] || 'TBD'
        break
      default:
        break
    }

    return {
      match_number,
      slot,
      stage: 'r32',
      home_team: homeTeam,
      away_team: awayTeam,
      desc,
      kickoff_utc,
      venue,
      city,
    }
  })

  return bracket
}

/**
 * Master function: given a set of user predictions, compute the complete
 * tournament state for that user.
 *
 * @param {Object} teamsByGroup   - { "Group A": [TeamInfo], ... }
 * @param {PredictedScore[]} predictions
 * @returns {Object} {
 *   allGroupStandings,   // all 12 groups' sorted standings
 *   advancingTeams,      // { winners, runnersUp, bestThird }
 *   roundOf32,           // 16 bracket matchups
 * }
 */
export function generateUserTournamentState(teamsByGroup, predictions) {
  const allGroupStandings = calculateAllGroupStandings(teamsByGroup, predictions)
  const best8Third = calculateBestThirdPlaceTeams(allGroupStandings)
  const roundOf32 = generateRoundOf32(allGroupStandings, best8Third)

  // Collect advancing teams
  const winners = {}
  const runnersUp = {}
  for (const [groupName, standings] of Object.entries(allGroupStandings)) {
    const letter = groupName.replace('Group ', '')
    winners[letter]   = standings.find(s => s.rank === 1)?.team
    runnersUp[letter] = standings.find(s => s.rank === 2)?.team
  }

  return {
    allGroupStandings,
    advancingTeams: {
      winners,
      runnersUp,
      bestThird: best8Third,
    },
    roundOf32,
  }
}

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────

/**
 * Verify a Round of 32 bracket has exactly 32 unique teams.
 * @param {Array} roundOf32
 * @returns {{ valid: boolean, teams: string[], count: number, duplicates: string[] }}
 */
export function validateRoundOf32(roundOf32) {
  const teams = []
  for (const match of roundOf32) {
    teams.push(match.home_team, match.away_team)
  }
  const unique = [...new Set(teams.filter(t => t !== 'TBD'))]
  const duplicates = teams.filter((t, i) => t !== 'TBD' && teams.indexOf(t) !== i)
  return {
    valid: unique.length === 32 && duplicates.length === 0,
    teams: unique,
    count: unique.length,
    duplicates: [...new Set(duplicates)],
  }
}
