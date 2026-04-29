import { useState, useEffect } from 'react'
import styles from './KnockoutBreakdown.module.css'

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final']

const STATUS_META = {
  correct:   { label: 'Correct',   cls: 'correct',   icon: '✓' },
  incorrect: { label: 'Incorrect', cls: 'incorrect',  icon: '✗' },
  pending:   { label: 'Pending',   cls: 'pending',    icon: '…' },
  no_pick:   { label: 'No pick',   cls: 'noPick',     icon: '–' },
}

function SummaryCard({ value, label, cls }) {
  return (
    <div className={`${styles.card} ${styles[cls] || ''}`}>
      <span className={styles.cardNum}>{value}</span>
      <span className={styles.cardLabel}>{label}</span>
    </div>
  )
}

function BreakdownRow({ row }) {
  const meta    = STATUS_META[row.status] || STATUS_META.pending
  const hasPick = row.user_pick !== null && row.user_pick !== undefined

  return (
    <div className={`${styles.row} ${styles[`row_${meta.cls}`]}`}>
      {/* Match info */}
      <div className={styles.rowMatch}>
        <span className={styles.rowSlot}>{row.slot}</span>
        <span className={styles.rowMatchup}>
          {row.home_team} <span className={styles.rowVs}>vs</span> {row.away_team}
        </span>
      </div>

      {/* User pick */}
      <div className={styles.rowPick}>
        <span className={styles.rowPickLabel}>Your pick</span>
        <span className={`${styles.rowPickValue} ${!hasPick ? styles.rowPickNone : ''}`}>
          {hasPick ? row.user_pick : '—'}
        </span>
      </div>

      {/* Actual winner */}
      <div className={styles.rowActual}>
        <span className={styles.rowPickLabel}>Actual winner</span>
        <span className={styles.rowActualValue}>{row.actual_winner || '—'}</span>
      </div>

      {/* Result */}
      <div className={styles.rowResult}>
        <span className={`${styles.rowIcon} ${styles[`icon_${meta.cls}`]}`}>
          {meta.icon}
        </span>
        <span className={`${styles.rowPts} ${styles[`pts_${meta.cls}`]}`}>
          {row.status === 'correct'
            ? `+${row.points} pts`
            : row.status === 'incorrect'
            ? '0 pts'
            : row.status === 'pending'
            ? `+${row.pts_possible} possible`
            : '—'}
        </span>
      </div>
    </div>
  )
}

export default function KnockoutBreakdown({ userId }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState(true) // collapsible

  useEffect(() => {
    if (!userId) return
    fetch(`http://localhost:3001/api/user-ko-breakdown?user_id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Don't render at all if no scored KO results yet
  if (loading || !data || data.breakdown.length === 0) return null

  const { breakdown, summary } = data

  // Group rows by round
  const byRound = {}
  for (const row of breakdown) {
    if (!byRound[row.round]) byRound[row.round] = []
    byRound[row.round].push(row)
  }

  return (
    <div className={styles.container}>
      {/* Header — collapsible */}
      <button className={styles.header} onClick={() => setOpen(o => !o)}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Knockout Points Breakdown</span>
          <span className={styles.headerSub}>{summary.total} results entered</span>
        </div>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryRow}>
            <SummaryCard value={summary.koPoints}  label="KO Points"      cls="cardTotal"     />
            <SummaryCard value={summary.correct}   label="Correct picks"  cls="cardCorrect"   />
            <SummaryCard value={summary.pending}   label="Pending"        cls="cardPending"   />
            <SummaryCard value={summary.incorrect} label="Missed picks"   cls="cardIncorrect" />
          </div>

          {/* Per-round breakdown */}
          <div className={styles.rounds}>
            {ROUND_ORDER.filter(r => byRound[r]).map(round => (
              <div key={round} className={styles.roundBlock}>
                <div className={styles.roundHeader}>
                  <span className={styles.roundLabel}>
                    {byRound[round][0]?.round_label || round}
                  </span>
                  <span className={styles.roundSummary}>
                    {byRound[round].filter(r => r.status === 'correct').length}/{byRound[round].length} correct
                    {' · '}
                    +{byRound[round].reduce((s, r) => s + r.points, 0)} pts
                  </span>
                </div>
                {byRound[round].map(row => (
                  <BreakdownRow key={`${row.round}|${row.slot}`} row={row} />
                ))}
              </div>
            ))}
          </div>

          <p className={styles.note}>
            Points are awarded when admin confirms actual tournament results.
          </p>
        </>
      )}
    </div>
  )
}
