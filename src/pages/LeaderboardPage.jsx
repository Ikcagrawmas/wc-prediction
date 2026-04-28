import { useState, useEffect } from 'react'
import styles from './LeaderboardPage.module.css'

const MEDAL = ['🥇', '🥈', '🥉']

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function PrizeCard({ pool }) {
  if (!pool) return null
  return (
    <div className={styles.prizeCard}>
      <div className={styles.prizeHeader}>
        <span className={styles.prizeEyebrow}>LIVE PRIZE POOL</span>
        <span className={styles.prizeLive}><span className={styles.liveDot} />LIVE</span>
      </div>
      <div className={styles.prizeRows}>
        <div className={styles.prizeRow}>
          <span className={styles.prizeLabel}>Paid Entries</span>
          <span className={styles.prizeValue}>{pool.paidUsers}</span>
        </div>
        <div className={styles.prizeRow}>
          <span className={styles.prizeLabel}>Gross Pool</span>
          <span className={styles.prizeValue}>{formatCurrency(pool.totalPot)}</span>
        </div>
        <div className={styles.prizeRow}>
          <span className={styles.prizeLabel}>Host Fee (10%)</span>
          <span className={styles.prizeValue}>{formatCurrency(pool.hostFee)}</span>
        </div>
        <div className={`${styles.prizeRow} ${styles.prizeTotal}`}>
          <span className={styles.prizeLabel}>Prize Pool</span>
          <span className={styles.prizeValue}>{formatCurrency(pool.prizePool)}</span>
        </div>
        <div className={`${styles.prizeRow} ${styles.prizePayOut}`}>
          <span className={styles.prizeLabel}>🥇 1st Place</span>
          <span className={`${styles.prizeValue} ${styles.prizeGold}`}>{formatCurrency(pool.first)}</span>
        </div>
        <div className={styles.prizeRow}>
          <span className={styles.prizeLabel}>🥈 2nd Place</span>
          <span className={styles.prizeValue}>{formatCurrency(pool.second)}</span>
        </div>
        <div className={styles.prizeRow}>
          <span className={styles.prizeLabel}>🥉 3rd Place</span>
          <span className={styles.prizeValue}>{formatCurrency(pool.third)}</span>
        </div>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [pool, setPool]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadData() {
    try {
      const [lbRes, ppRes] = await Promise.all([
        fetch('http://localhost:3001/api/leaderboard'),
        fetch('http://localhost:3001/api/prize-pool'),
      ])

      const lbData = await lbRes.json()
      const ppData = await ppRes.json()

      if (lbData.leaderboard) setLeaderboard(lbData.leaderboard)
      if (!ppData.error) setPool(ppData)
      setLastUpdated(new Date())
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30_000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const hasScores = leaderboard.some(r => r.total_points > 0)

  return (
    <div className={styles.page}>
      <div className={styles.headerSection}>
        <div className={styles.headerInner}>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>WARGACKI PERFORMANCE · 2026</p>
            <h1 className={styles.title}>Leaderboard</h1>
            <p className={styles.sub}>
              {hasScores
                ? 'Live standings based on completed matches.'
                : 'Standings will update as match results are entered.'}
            </p>
            {lastUpdated && (
              <p className={styles.updated}>
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className={styles.navLinks}>
            <a href="/wc/predictions" className={styles.navLink}>My Predictions →</a>
            <a href="/wc" className={styles.navLink}>← Home</a>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Prize Pool */}
        <PrizeCard pool={pool} />

        {/* Leaderboard Table */}
        <div className={styles.tableSection}>
          {loading && <div className={styles.loading}><div className={styles.spinner} />Loading…</div>}
          {error && <p className={styles.error}>⚠ {error}</p>}

          {!loading && !error && leaderboard.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No paid entries yet</p>
              <p className={styles.emptySub}>The leaderboard will populate once entries come in.</p>
            </div>
          )}

          {leaderboard.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={`${styles.th} ${styles.left}`}>Player</th>
                    <th className={styles.th} title="Total Points">Total</th>
                    <th className={`${styles.th} ${styles.hide}`} title="Points earned from completed match predictions">Points (Matches)</th>
                    <th className={`${styles.th} ${styles.hide}`} title="Exact Scores (5 pts each)">Exact⚡</th>
                    <th className={`${styles.th} ${styles.hide}`} title="Knockout Points">KO</th>
                    <th className={`${styles.th} ${styles.hide}`} title="Bonus Points">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, idx) => {
                    const isTop3 = row.rank <= 3
                    const medal  = MEDAL[row.rank - 1] || null
                    const showDivider = idx === 2 && leaderboard.length > 3
                    return (
                      <>
                      <tr
                        key={row.user_id}
                        className={[
                          styles.tr,
                          isTop3 ? styles.topThree : '',
                          row.rank === 1 ? styles.rank1 : '',
                          row.rank === 2 ? styles.rank2 : '',
                          row.rank === 3 ? styles.rank3 : '',
                        ].join(' ')}
                      >
                        <td className={styles.td}>
                          <span className={styles.rank}>
                            {medal || row.rank}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.left}`}>
                          <span className={styles.username}>{row.username || '(unknown)'}</span>
                          {row.exact_scores > 0 && (
                            <span className={styles.exactBadge} title="Exact score predictions">
                              ⚡{row.exact_scores}
                            </span>
                          )}
                        </td>
                        <td className={styles.td}>
                          <span
                            className={`${styles.totalPts} ${isTop3 ? styles.topPts : ''}`}
                            title={`${row.total_points} pts total\n${row.exact_scores} exact scores (⚡) · ${row.match_points} match pts`}
                          >
                            {row.total_points}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.hide}`}>{row.match_points}</td>
                        <td className={`${styles.td} ${styles.hide}`}>{row.exact_scores}</td>
                        <td className={`${styles.td} ${styles.hide}`}>{row.knockout_points}</td>
                        <td className={`${styles.td} ${styles.hide}`}>{row.bonus_points}</td>
                      </tr>
                      {showDivider && (
                        <tr key={`div-${row.user_id}`} className={styles.top3Divider}>
                          <td colSpan={7} className={styles.top3DividerCell}>
                            <span className={styles.top3DividerLabel}>▲ Prize positions · Rest of field ▼</span>
                          </td>
                        </tr>
                      )}
                      </>
                    )
                  })}
                </tbody>
              </table>

              {!hasScores && (
                <div className={styles.noScoresNote}>
                  All players are at 0 points — scores will update as match results are entered.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tiebreaker explanation */}
        <div className={styles.tiebreaker}>
          <p className={styles.tiebreakerLabel}>Tiebreaker order</p>
          <p className={styles.tiebreakerText}>
            Total points → Exact scores → Earliest submission time
          </p>
        </div>
      </div>
    </div>
  )
}
