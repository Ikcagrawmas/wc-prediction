import styles from './ScoringGuide.module.css'

// ─── DATA ────────────────────────────────────────────────────────────────────

const GROUP_MATCH_ROWS = [
  { pts: 5, label: 'Exact score' },
  { pts: 4, label: 'Correct result + same goal difference' },
  { pts: 3, label: 'Correct result, different goal difference' },
  { pts: 1, label: "One team's score correct" },
  { pts: 0, label: 'Wrong result' },
]

const STANDINGS_ROWS = [
  { pts: 3, label: 'Correct 1st place team' },
  { pts: 3, label: 'Correct 2nd place team' },
  { pts: 2, label: 'Correct advancing team, wrong top-2 position' },
  { pts: 1, label: 'Correct 3rd place team' },
  { pts: 1, label: 'Correct 4th place team' },
]

const BRACKET_ROWS = [
  { pts: 3,  label: 'Round of 32 correct advancing team' },
  { pts: 5,  label: 'Quarterfinal correct advancing team' },
  { pts: 8,  label: 'Semifinal correct advancing team' },
  { pts: 15, label: 'Correct Champion' },
]

const BONUS_ROWS = [
  { pts: 10, label: 'Golden Boot — top scorer' },
  { pts: 10, label: 'Team with most yellow cards' },
  { pts: 10, label: 'Team with most red cards' },
  { pts: 10, label: 'Team with most clean sheets' },
]

const CONFIGS = {
  groups: {
    title: 'How Group Stage Scoring Works',
    note: 'The closer your prediction is to the real result, the more points you earn.',
    rows: GROUP_MATCH_ROWS,
  },
  standings: {
    title: 'How Group Standings Scoring Works',
    note: 'Full points for exact placement. Partial credit if you predicted an advancing team but put them in the wrong top-2 spot.',
    rows: STANDINGS_ROWS,
  },
  bracket: {
    title: 'How Knockout Scoring Works',
    note: 'Points are earned for correctly predicting which teams advance — no score predictions in knockout rounds.',
    rows: BRACKET_ROWS,
  },
  bonus: {
    title: 'How Bonus Scoring Works',
    note: 'Each bonus prediction is worth 10 points. All four are scored at the end of the tournament.',
    rows: BONUS_ROWS,
  },
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function ScoringGuide({ tab }) {
  const config = CONFIGS[tab]
  if (!config) return null

  return (
    <div className={styles.guide}>
      <div className={styles.header}>
        <span className={styles.icon}>📊</span>
        <span className={styles.title}>{config.title}</span>
      </div>

      <div className={styles.rows}>
        {config.rows.map((row, i) => (
          <div key={i} className={styles.row}>
            <span className={`${styles.pts} ${row.pts >= 5 ? styles.ptsHigh : row.pts >= 3 ? styles.ptsMid : row.pts === 0 ? styles.ptsZero : ''}`}>
              {row.pts > 0 ? `+${row.pts}` : '0'}
            </span>
            <span className={styles.label}>{row.label}</span>
          </div>
        ))}
      </div>

      <p className={styles.note}>{config.note}</p>
    </div>
  )
}
