import { useState, useEffect } from 'react'
import styles from './ScoreSummaryPanel.module.css'

export default function ScoreSummaryPanel({ userId }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!userId) return
    fetch(`http://localhost:3001/api/user-stats?user_id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setStats(d) })
      .catch(() => {})
  }, [userId])

  // Only show once there are completed matches with scores
  if (!stats || stats.completedMatches === 0) return null

  const cells = [
    { label: 'Total Points',      value: stats.totalPoints,      accent: true },
    { label: 'Exact Scores',      value: stats.exactScores,      tag: '+5 pts each' },
    { label: 'Correct Results',   value: stats.correctResults,   tag: '+3–4 pts each' },
    { label: 'Partial Points',    value: stats.partialPoints,    tag: '+1 pt each' },
    { label: 'Remaining Matches', value: stats.remainingMatches, tag: 'not yet played' },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Your Score</span>
        <span className={styles.panelSub}>{stats.completedMatches} matches scored so far</span>
      </div>
      <div className={styles.cells}>
        {cells.map(cell => (
          <div key={cell.label} className={`${styles.cell} ${cell.accent ? styles.accentCell : ''}`}>
            <span className={`${styles.cellNum} ${cell.accent ? styles.accentNum : ''}`}>
              {cell.accent && cell.value > 0 ? `+${cell.value}` : cell.value}
            </span>
            <span className={styles.cellLabel}>{cell.label}</span>
            {cell.tag && <span className={styles.cellTag}>{cell.tag}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
