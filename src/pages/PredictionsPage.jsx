import { useMemo, useState, useEffect } from 'react'
import { TEAMS, GROUP_STAGE_MATCHES, GROUPS } from '../engine/tournamentData'
import {
  calculateAllGroupStandings,
  calculateBestThirdPlaceTeams,
  generateRoundOf32,
} from '../engine/tournamentEngine'
import { generateFullBracket, countBracketPicks } from '../engine/bracketProgression'
import { usePredictions, useIsLocked, matchKey } from '../hooks/usePredictions'
import { useBonusPredictions } from '../hooks/useBonusPredictions'
import { useSession } from '../hooks/useSession'
import { useNavigate } from 'react-router-dom'
import SaveStatusBar from '../components/SaveStatusBar'
import MatchScoreInput from '../components/MatchScoreInput'
import GroupStandingsTable from '../components/GroupStandingsTable'
import KnockoutBracket from '../components/KnockoutBracket'
import BonusPredictions from '../components/BonusPredictions'
import ScoringGuide from '../components/ScoringGuide'
import PaymentBanner from '../components/PaymentBanner'
import ScoreSummaryPanel from '../components/ScoreSummaryPanel'
import styles from './PredictionsPage.module.css'

const GROUP_NAMES = GROUPS.map(g => g.name)

const TEAMS_BY_GROUP = GROUP_NAMES.reduce((acc, g) => {
  acc[g] = TEAMS.filter(t => t.group === g)
  return acc
}, {})

const MATCHES_BY_GROUP = GROUP_NAMES.reduce((acc, g) => {
  acc[g] = GROUP_STAGE_MATCHES.filter(m => m.group === g)
  return acc
}, {})

const MAX_BRACKET_PICKS = 31 // 16+8+4+2+1

export default function PredictionsPage() {
  const isLocked = useIsLocked()
  const [activeTab, setActiveTab]     = useState('groups')
  const [activeGroup, setActiveGroup] = useState('Group A')

  const navigate = useNavigate()
  const { user, status: userStatus } = useSession()
  const userId    = user?.userId || null
  const isPreview = userStatus === 'preview'   // logged in but unpaid
  const isPaid    = userStatus === 'authed'    // logged in and paid

  // Only redirect if there is NO session at all (unauthed)
  useEffect(() => {
    if (userStatus === 'unauthed') {
      navigate('/wc', { replace: true })
    }
  }, [userStatus, navigate])

  const { scores, knockoutPicks, loadStatus, saveStatus, updateScore, updateKnockoutPick } =
    usePredictions(userId, isPaid)

  const { bonus, bonusLoadStatus, bonusSaveStatus, updateBonus } =
    useBonusPredictions(userId)

  // ── ENGINE (live) ──────────────────────────────────────────────────────────
  const predictions = useMemo(() => {
    const out = []
    for (const m of GROUP_STAGE_MATCHES) {
      const s = scores[matchKey(m)]
      if (s && s.home !== '' && s.away !== '') {
        out.push({
          home_team: m.home_team, away_team: m.away_team,
          predicted_home_score: Number(s.home), predicted_away_score: Number(s.away),
        })
      }
    }
    return out
  }, [scores])

  const allGroupStandings = useMemo(
    () => calculateAllGroupStandings(TEAMS_BY_GROUP, predictions), [predictions])

  const best8Third = useMemo(
    () => calculateBestThirdPlaceTeams(allGroupStandings), [allGroupStandings])

  const roundOf32 = useMemo(
    () => generateRoundOf32(allGroupStandings, best8Third), [allGroupStandings, best8Third])

  const fullBracket = useMemo(
    () => generateFullBracket(roundOf32, knockoutPicks), [roundOf32, knockoutPicks])

  // ── SCORE BREAKDOWN (completed matches) ─────────────────────────────────
  const [scoreBreakdown, setScoreBreakdown] = useState({})

  useEffect(() => {
    if (!userId) return
    fetch(`http://localhost:3001/api/user-score-breakdown?user_id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.breakdown) {
          const map = {}
          for (const row of d.breakdown) {
            if (row.actual_home !== null) {
              map[row.match_id] = {
                _home:       row.home_team,
                _away:       row.away_team,
                actual_home: row.actual_home,
                actual_away: row.actual_away,
                points:      row.points,
                reason:      row.reason,
              }
            }
          }
          setScoreBreakdown(map)
        }
      })
      .catch(() => {})
  }, [userId])

  // ── COUNTS ────────────────────────────────────────────────────────────────
  const filledCount   = useMemo(() => Object.values(scores).filter(s => s.home !== '' && s.away !== '').length, [scores])
  const pct           = Math.round((filledCount / GROUP_STAGE_MATCHES.length) * 100)
  const bracketPicks  = useMemo(() => countBracketPicks(knockoutPicks), [knockoutPicks])
  const bonusFilled   = useMemo(() =>
    [bonus.golden_boot_player, bonus.most_yellow_cards_team, bonus.most_red_cards_team, bonus.most_clean_sheets_team].filter(Boolean).length,
    [bonus])

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (userStatus === 'loading') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Verifying access…</p>
      </div>
    )
  }
  // unauthed — useEffect handles redirect
  if (userStatus === 'unauthed') return null
  if (loadStatus === 'loading') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading your predictions…</p>
      </div>
    )
  }
  if (loadStatus === 'error') return <div className={styles.errorScreen}><p>⚠ Could not load predictions.</p></div>

  const globalSave = [saveStatus, bonusSaveStatus].includes('saving') ? 'saving'
    : [saveStatus, bonusSaveStatus].includes('unsaved') ? 'unsaved'
    : [saveStatus, bonusSaveStatus].includes('error') ? 'error'
    : 'saved'

  const tabs = [
    { key: 'groups',    label: 'Group Stage',   count: `${filledCount}/${GROUP_STAGE_MATCHES.length}`, done: filledCount === GROUP_STAGE_MATCHES.length },
    { key: 'standings', label: 'Standings',      count: null, done: false },
    { key: 'bracket',   label: 'Full Bracket',   count: `${bracketPicks}/${MAX_BRACKET_PICKS}`, done: bracketPicks === MAX_BRACKET_PICKS },
    { key: 'bonus',     label: 'Bonus Picks',    count: `${bonusFilled}/4`, done: bonusFilled === 4 },
  ]

  return (
    <div className={styles.page}>
      {isPreview && <PaymentBanner user={user} />}
      {!isPreview && <SaveStatusBar status={globalSave} isLocked={isLocked || isPreview} />}

      {/* HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.eyebrow}>WARGACKI PERFORMANCE · 2026</p>
            <h1 className={styles.pageTitle}>Your Predictions</h1>
            <p className={styles.pageSubtitle}>Predict every group stage score. Your bracket generates automatically.</p>
          </div>
          <div className={styles.progressBlock}>
            <div className={styles.progressRing}>
              <svg viewBox="0 0 60 60" className={styles.progressSvg}>
                <circle cx="30" cy="30" r="24" className={styles.progressBg} />
                <circle cx="30" cy="30" r="24" className={styles.progressFill}
                  strokeDasharray={`${pct * 1.508} 150.8`}
                  strokeDashoffset="0" transform="rotate(-90 30 30)" />
              </svg>
              <span className={styles.progressPct}>{pct}%</span>
            </div>
            <div className={styles.progressText}>
              <span className={styles.progressNum}>{filledCount}/{GROUP_STAGE_MATCHES.length}</span>
              <span className={styles.progressLabel}>group matches</span>
              <span className={styles.progressKO}>{bracketPicks}/{MAX_BRACKET_PICKS} bracket picks</span>
              <span className={styles.progressBonus}>{bonusFilled}/4 bonus picks</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className={styles.tabBar}>
        <div className={styles.tabInner}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.count && (
                <span className={`${styles.tabCount} ${tab.done ? styles.tabCountDone : ''}`}>
                  {tab.done ? '✓' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* GROUP STAGE */}
      {activeTab === 'groups' && (
        <div className={styles.content}>
          <ScoringGuide tab="groups" />
          <ScoreSummaryPanel userId={userId} />
          <div className={styles.groupNav}>
            {GROUP_NAMES.map(g => {
              const letter = g.replace('Group ', '')
              const filled = MATCHES_BY_GROUP[g].filter(m => { const s = scores[matchKey(m)]; return s && s.home !== '' && s.away !== '' }).length
              const done = filled === 6
              return (
                <button key={g}
                  className={`${styles.groupBtn} ${activeGroup === g ? styles.activeGroup : ''} ${done ? styles.groupDone : ''}`}
                  onClick={() => setActiveGroup(g)}>
                  <span className={styles.groupLetter}>{letter}</span>
                  {done && <span className={styles.groupCheck}>✓</span>}
                </button>
              )
            })}
          </div>

          <div className={styles.matchCard}>
            <div className={styles.matchCardHeader}>
              <div className={styles.matchCardTitle}>{activeGroup}</div>
              <div className={styles.matchCardTeams}>{TEAMS_BY_GROUP[activeGroup].map(t => t.name).join(' · ')}</div>
            </div>
            <div className={styles.matchList}>
              <div className={styles.matchColHeaders}>
                <span /><span className={styles.colHome}>Home</span>
                <span className={styles.colScore}>Score</span><span className={styles.colAway}>Away</span>
                <span className={styles.colMeta}>Kickoff (ET)</span>
              </div>
              {MATCHES_BY_GROUP[activeGroup].map(match => {
                // Find resultData by matching home+away team names in breakdown
                const resultEntry = Object.values(scoreBreakdown).find(
                  r => r._home === match.home_team && r._away === match.away_team
                )
                return (
                  <MatchScoreInput
                    key={matchKey(match)}
                    match={match}
                    scores={scores}
                    onUpdate={updateScore}
                    isLocked={isLocked || isPreview}
                    resultData={resultEntry || null}
                  />
                )
              })}
            </div>
            <div className={styles.inlineStandings}>
              <div className={styles.inlineStandingsLabel}>Live Standings</div>
              <GroupStandingsTable groupName={activeGroup} standings={allGroupStandings[activeGroup] || []} bestThirdTeams={best8Third} />
            </div>
          </div>
        </div>
      )}

      {/* STANDINGS */}
      {activeTab === 'standings' && (
        <div className={styles.content}>
          <ScoringGuide tab="standings" />
          <div className={styles.standingsIntro}><p>Standings update instantly. Green = advancing. 🔄 = best third-place qualifier.</p></div>
          <div className={styles.standingsGrid}>
            {GROUP_NAMES.map(g => (
              <GroupStandingsTable key={g} groupName={g} standings={allGroupStandings[g] || []} bestThirdTeams={best8Third} />
            ))}
          </div>
          {best8Third.length > 0 && (
            <div className={styles.thirdPlaceSection}>
              <h3 className={styles.thirdPlaceTitle}>Best 8 Third-Place Teams Advancing</h3>
              <div className={styles.thirdPlaceGrid}>
                {best8Third.map((t, i) => (
                  <div key={t.team} className={styles.thirdPlaceCard}>
                    <span className={styles.thirdPlaceRank}>{i + 1}</span>
                    <span className={styles.thirdPlaceTeam}>{t.team}</span>
                    <span className={styles.thirdPlaceGroup}>{t.group.replace('Group ', 'Grp ')}</span>
                    <span className={styles.thirdPlacePts}>{t.points}pts</span>
                    <span className={styles.thirdPlaceGd}>{t.goal_difference >= 0 ? `+${t.goal_difference}` : t.goal_difference} GD</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BRACKET */}
      {activeTab === 'bracket' && (
        <div className={styles.content}>
          <ScoringGuide tab="bracket" />
          <div className={styles.bracketIntro}>
            <div className={styles.bracketIntroText}>
              <h2 className={styles.bracketIntroTitle}>Full Tournament Bracket</h2>
              <p>
                Flows from your group predictions through all 5 knockout rounds.
                Each round unlocks as you complete the one before.
                {filledCount < GROUP_STAGE_MATCHES.length && (
                  <span className={styles.bracketWarning}> {GROUP_STAGE_MATCHES.length - filledCount} group matches still need scores.</span>
                )}
              </p>
            </div>
            <div className={styles.bracketStats}>
              <span className={styles.bracketStatNum}>{bracketPicks}</span>
              <span className={styles.bracketStatLabel}>of {MAX_BRACKET_PICKS} picks made</span>
              {bracketPicks === MAX_BRACKET_PICKS && <span className={styles.bracketComplete}>Complete ✓</span>}
            </div>
          </div>
          <KnockoutBracket bracket={fullBracket} knockoutPicks={knockoutPicks} onPick={updateKnockoutPick} isLocked={isLocked || isPreview} />
        </div>
      )}

      {/* BONUS */}
      {activeTab === 'bonus' && (
        <div className={styles.content}>
          <ScoringGuide tab="bonus" />
          <BonusPredictions bonus={bonus} onUpdate={updateBonus} isLocked={isLocked || isPreview} saveStatus={bonusSaveStatus} />
        </div>
      )}
    </div>
  )
}
