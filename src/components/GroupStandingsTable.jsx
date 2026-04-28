import styles from './GroupStandingsTable.module.css'

export default function GroupStandingsTable({ groupName, standings, bestThirdTeams }) {
  const bestThirdSet = new Set((bestThirdTeams || []).map(t => t.team))

  return (
    <div className={styles.card}>
      <div className={styles.header}>{groupName}</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>#</th>
            <th className={`${styles.th} ${styles.left}`}>Team</th>
            <th className={styles.th} title="Points">Pts</th>
            <th className={styles.th} title="Goal Difference">GD</th>
            <th className={styles.th} title="Goals For">GF</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(team => {
            const isFirst  = team.rank === 1
            const isSecond = team.rank === 2
            const isThird  = team.rank === 3
            const isQ3     = isThird && bestThirdSet.has(team.team)
            const advances = isFirst || isSecond || isQ3

            return (
              <tr
                key={team.team}
                className={`
                  ${styles.row}
                  ${isFirst  ? styles.first  : ''}
                  ${isSecond ? styles.second : ''}
                  ${isQ3     ? styles.third  : ''}
                `}
              >
                <td className={styles.td}>
                  <span className={styles.rank}>
                    {isFirst ? '①' : isSecond ? '②' : isThird ? '③' : '④'}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.left}`}>
                  <span className={`${styles.teamName} ${advances ? styles.advancing : ''}`}>
                    {team.team}
                  </span>
                  {isQ3 && <span className={styles.q3badge}>3rd ✓</span>}
                </td>
                <td className={`${styles.td} ${styles.pts}`}>{team.points}</td>
                <td className={styles.td}>
                  {team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}
                </td>
                <td className={styles.td}>{team.goals_for}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
