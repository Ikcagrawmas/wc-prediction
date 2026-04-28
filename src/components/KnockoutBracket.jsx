import { ROUND_LABELS } from '../engine/bracketProgression'
import styles from './KnockoutBracket.module.css'

// ─── SINGLE MATCH CARD ────────────────────────────────────────────────────────
function MatchCard({ round, slot, home_team, away_team, picked, onPick, isLocked, compact }) {
  const homeIsTbd = !home_team || home_team === 'TBD'
  const awayIsTbd = !away_team || away_team === 'TBD'
  const bothKnown = !homeIsTbd && !awayIsTbd

  // A slot is "ready" when both teams are resolved from prior picks
  const canPick = bothKnown && !isLocked

  function pick(team) {
    if (!canPick) return
    // Toggle off if re-clicking the same pick
    onPick(round, slot, picked === team ? null : team)
  }

  return (
    <div className={`${styles.matchCard} ${compact ? styles.compact : ''} ${picked ? styles.hasPick : ''}`}>
      <button
        className={`${styles.teamBtn} ${picked === home_team && !homeIsTbd ? styles.picked : ''} ${homeIsTbd ? styles.tbd : ''}`}
        onClick={() => pick(home_team)}
        disabled={!canPick}
        title={homeIsTbd ? 'Pick prior round winners first' : home_team}
      >
        <span className={styles.teamLabel}>{homeIsTbd ? 'TBD' : home_team}</span>
        {picked === home_team && !homeIsTbd && <span className={styles.tick}>✓</span>}
      </button>

      <div className={styles.divider}>
        <span className={styles.vsText}>vs</span>
      </div>

      <button
        className={`${styles.teamBtn} ${picked === away_team && !awayIsTbd ? styles.picked : ''} ${awayIsTbd ? styles.tbd : ''}`}
        onClick={() => pick(away_team)}
        disabled={!canPick}
        title={awayIsTbd ? 'Pick prior round winners first' : away_team}
      >
        <span className={styles.teamLabel}>{awayIsTbd ? 'TBD' : away_team}</span>
        {picked === away_team && !awayIsTbd && <span className={styles.tick}>✓</span>}
      </button>

      {!bothKnown && (
        <div className={styles.tbdOverlay}>Pick previous round winners first</div>
      )}
    </div>
  )
}

// ─── ROUND SECTION ────────────────────────────────────────────────────────────
function RoundSection({ roundKey, label, matches, knockoutPicks, onPick, isLocked, cols }) {
  const pickedCount = matches.filter(m => knockoutPicks[`${roundKey}|${m.slot}`]).length
  const readyCount  = matches.filter(m =>
    m.home_team !== 'TBD' && m.away_team !== 'TBD'
  ).length

  return (
    <div className={styles.roundSection}>
      <div className={styles.roundHeader}>
        <h3 className={styles.roundLabel}>{label}</h3>
        <div className={styles.roundMeta}>
          <span className={`${styles.roundPct} ${pickedCount === matches.length ? styles.roundComplete : ''}`}>
            {pickedCount}/{matches.length} picked
          </span>
          {readyCount < matches.length && (
            <span className={styles.roundLocked}>
              {matches.length - readyCount} awaiting prior round
            </span>
          )}
        </div>
      </div>

      <div className={styles.matchGrid} style={{ '--cols': cols || Math.min(matches.length, 4) }}>
        {matches.map(m => (
          <MatchCard
            key={m.slot}
            round={roundKey}
            slot={m.slot}
            home_team={m.home_team}
            away_team={m.away_team}
            picked={knockoutPicks[`${roundKey}|${m.slot}`] || null}
            onPick={onPick}
            isLocked={isLocked}
            compact={matches.length > 4}
          />
        ))}
      </div>
    </div>
  )
}

// ─── CHAMPION BANNER ──────────────────────────────────────────────────────────
function ChampionBanner({ champion, finalMatch, knockoutPicks, onPick, isLocked }) {
  const finalPick = knockoutPicks['final|FINAL'] || null
  const hasChampion = !!finalPick

  return (
    <div className={styles.championSection}>
      <div className={styles.championHeader}>
        <div className={styles.trophyEmoji}>🏆</div>
        <h3 className={styles.championTitle}>CHAMPION</h3>
        <p className={styles.championSub}>
          {hasChampion
            ? 'Your predicted World Cup champion'
            : 'Pick the Final winner to crown your champion'}
        </p>
      </div>

      {hasChampion ? (
        <div className={styles.championCard}>
          <div className={styles.championName}>{finalPick}</div>
          <div className={styles.championBadge}>2026 FIFA World Cup Champion</div>
          {!isLocked && (
            <button
              className={styles.changeBtn}
              onClick={() => onPick('final', 'FINAL', null)}
            >
              Change pick
            </button>
          )}
        </div>
      ) : (
        <div className={styles.championEmpty}>
          <div className={styles.championEmptyIcon}>?</div>
          <p className={styles.championEmptyText}>
            {finalMatch?.home_team === 'TBD'
              ? 'Complete all rounds to reveal the Final'
              : `${finalMatch?.home_team || 'TBD'} vs ${finalMatch?.away_team || 'TBD'} — pick the winner above`}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function KnockoutBracket({ bracket, knockoutPicks, onPick, isLocked }) {
  if (!bracket) return null

  const { r32, r16, qf, sf, final: finalMatches } = bracket
  const finalMatch = finalMatches?.[0]

  return (
    <div className={styles.bracketRoot}>
      <RoundSection
        roundKey="r32"
        label={ROUND_LABELS.r32}
        matches={r32}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
        cols={4}
      />

      <div className={styles.roundDivider} />

      <RoundSection
        roundKey="r16"
        label={ROUND_LABELS.r16}
        matches={r16}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
        cols={4}
      />

      <div className={styles.roundDivider} />

      <RoundSection
        roundKey="qf"
        label={ROUND_LABELS.qf}
        matches={qf}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
        cols={4}
      />

      <div className={styles.roundDivider} />

      <RoundSection
        roundKey="sf"
        label={ROUND_LABELS.sf}
        matches={sf}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
        cols={2}
      />

      <div className={styles.roundDivider} />

      <RoundSection
        roundKey="final"
        label={ROUND_LABELS.final}
        matches={finalMatches}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
        cols={1}
      />

      <div className={styles.roundDivider} />

      <ChampionBanner
        finalMatch={finalMatch}
        knockoutPicks={knockoutPicks}
        onPick={onPick}
        isLocked={isLocked}
      />
    </div>
  )
}
