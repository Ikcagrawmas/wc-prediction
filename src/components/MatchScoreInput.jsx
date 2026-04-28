import styles from './MatchScoreInput.module.css'
import { matchKey } from '../hooks/usePredictions'

// Map scoring_reason → human label and color tier
const REASON_META = {
  exact_score:             { label: 'Exact score',                tier: 'gold' },
  correct_result_same_gd:  { label: 'Correct result + goal diff', tier: 'green' },
  correct_result_diff_gd:  { label: 'Correct result',             tier: 'yellow' },
  one_score_correct:       { label: 'One score correct',          tier: 'gray' },
  wrong_result:            { label: 'Wrong result',               tier: 'red' },
}

export default function MatchScoreInput({ match, scores, onUpdate, isLocked, resultData }) {
  // resultData: { actual_home, actual_away, points, reason } | null
  const key   = matchKey(match)
  const score = scores[key] || { home: '', away: '' }

  const kickoffDate = new Date(match.kickoff_utc)
  const dateStr = kickoffDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const timeStr = kickoffDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  })

  const hasPred   = score.home !== '' && score.away !== ''
  const homeWins  = hasPred && Number(score.home) > Number(score.away)
  const awayWins  = hasPred && Number(score.away) > Number(score.home)
  const isDraw    = hasPred && Number(score.home) === Number(score.away)
  const isCompleted = !!resultData

  function handleInput(side, e) {
    if (isLocked) return
    const val = e.target.value.replace(/[^0-9]/g, '')
    onUpdate(key, side, val === '' ? '' : Math.min(99, parseInt(val, 10)))
  }

  const meta  = resultData ? REASON_META[resultData.reason] : null
  const tier  = meta?.tier || 'gray'
  const pts   = resultData?.points ?? null

  return (
    <div className={`${styles.row} ${hasPred ? styles.filled : ''} ${isCompleted ? styles.completed : ''}`}>

      {/* Match number */}
      <div className={styles.matchNum}>
        <span className={styles.mNum}>{match.match_number}</span>
      </div>

      {/* Home team */}
      <div className={`${styles.teamName} ${styles.home} ${homeWins ? styles.winner : ''}`}>
        {match.home_team}
      </div>

      {/* Score block — prediction inputs OR completed overlay */}
      <div className={styles.scoreBlock}>
        {isCompleted ? (
          /* ── COMPLETED: show both prediction and actual ── */
          <div className={styles.completedScores}>
            <div className={styles.predRow}>
              <span className={styles.predLabel}>Your pick</span>
              <span className={styles.predScore}>
                {hasPred ? `${score.home} – ${score.away}` : '–'}
              </span>
            </div>
            <div className={styles.actualRow}>
              <span className={styles.actualLabel}>Result</span>
              <span className={styles.actualScore}>
                {resultData.actual_home} – {resultData.actual_away}
              </span>
            </div>
          </div>
        ) : (
          /* ── OPEN: editable inputs ── */
          <>
            <input
              type="number" min="0" max="99" inputMode="numeric" pattern="[0-9]*"
              className={`${styles.scoreInput} ${isLocked ? styles.locked : ''} ${homeWins ? styles.winInput : ''}`}
              value={score.home}
              onChange={e => handleInput('home', e)}
              onFocus={e => e.target.select()}
              disabled={isLocked}
              placeholder="–"
            />
            <span className={`${styles.vs} ${isDraw ? styles.drawVs : ''}`}>–</span>
            <input
              type="number" min="0" max="99" inputMode="numeric" pattern="[0-9]*"
              className={`${styles.scoreInput} ${isLocked ? styles.locked : ''} ${awayWins ? styles.winInput : ''}`}
              value={score.away}
              onChange={e => handleInput('away', e)}
              onFocus={e => e.target.select()}
              disabled={isLocked}
              placeholder="–"
            />
          </>
        )}
      </div>

      {/* Away team */}
      <div className={`${styles.teamName} ${styles.away} ${awayWins ? styles.winner : ''}`}>
        {match.away_team}
      </div>

      {/* Right column: points badge OR kickoff meta */}
      <div className={styles.rightCol}>
        {isCompleted && pts !== null ? (
          <div className={`${styles.ptsBadge} ${styles[`pts_${tier}`]}`}>
            <span className={styles.ptsNum}>{pts > 0 ? `+${pts}` : '0'}</span>
            <span className={styles.ptsLabel}>{meta?.label || ''}</span>
          </div>
        ) : (
          <div className={styles.meta}>
            <span className={styles.metaDate}>{dateStr}</span>
            <span className={styles.metaTime}>{timeStr} ET</span>
            <span className={styles.metaVenue}>{match.city}</span>
          </div>
        )}
      </div>
    </div>
  )
}
