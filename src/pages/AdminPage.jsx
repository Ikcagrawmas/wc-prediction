import { useState, useEffect, useCallback } from 'react'
import styles from './AdminPage.module.css'

const ADMIN_EMAIL_KEY = 'wc_admin_email'
const API = 'http://localhost:3001'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function apiHeaders(adminEmail) {
  return { 'Content-Type': 'application/json', 'x-admin-email': adminEmail }
}

function formatKickoff(utcStr) {
  if (!utcStr) return '—'
  const d = new Date(utcStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET'
}

// ─── GROUP MATCH ROW ─────────────────────────────────────────────────────────
function GroupMatchRow({ match, adminEmail, onSave }) {
  const [home, setHome] = useState(match.actual_home_score != null ? String(match.actual_home_score) : '')
  const [away, setAway] = useState(match.actual_away_score != null ? String(match.actual_away_score) : '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(match.completed || false)
  const [err,    setErr]    = useState('')

  async function handleSave() {
    if (home === '' || away === '') { setErr('Both scores required'); return }
    setSaving(true); setErr('')
    try {
      const res  = await fetch(`${API}/api/admin/result`, {
        method: 'POST', headers: apiHeaders(adminEmail),
        body: JSON.stringify({ match_id: match.id, home_score: +home, away_score: +away }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      onSave(match.id, +home, +away, data)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className={`${styles.matchRow} ${saved ? styles.rowDone : ''}`}>
      <div className={styles.rowMeta}>
        <span className={styles.rowNum}>M{match.match_number}</span>
        <span className={styles.rowDate}>{formatKickoff(match.kickoff_time)}</span>
        {match.city && <span className={styles.rowVenue}>{match.city}</span>}
        {saved && <span className={styles.doneBadge}>✓ Entered</span>}
      </div>
      <div className={styles.rowCentre}>
        <span className={`${styles.rowTeam} ${styles.rowTeamHome}`}>{match.home_team_name || '?'}</span>
        <div className={styles.rowScores}>
          <input type="number" min="0" max="99" className={`${styles.scoreBox} ${saved ? styles.scoreBoxDone : ''}`}
            value={home} onChange={e => { setHome(e.target.value.replace(/\D/,'')); setSaved(false) }}
            onFocus={e => e.target.select()} placeholder="0" />
          <span className={styles.scoreDash}>–</span>
          <input type="number" min="0" max="99" className={`${styles.scoreBox} ${saved ? styles.scoreBoxDone : ''}`}
            value={away} onChange={e => { setAway(e.target.value.replace(/\D/,'')); setSaved(false) }}
            onFocus={e => e.target.select()} placeholder="0" />
        </div>
        <span className={`${styles.rowTeam} ${styles.rowTeamAway}`}>{match.away_team_name || '?'}</span>
      </div>
      <div className={styles.rowAction}>
        <button className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
          onClick={handleSave} disabled={saving || home === '' || away === ''}>
          {saving ? '…' : saved ? '✓ Saved' : 'Save Result'}
        </button>
        {err && <span className={styles.rowErr}>{err}</span>}
      </div>
    </div>
  )
}

// ─── KNOCKOUT ROUND SECTION ──────────────────────────────────────────────────
const ROUND_LABELS_FULL = { r32:'Round of 32', r16:'Round of 16', qf:'Quarterfinals', sf:'Semifinals', final:'Final' }
const KO_POINTS = { r32:3, r16:5, qf:5, sf:8, final:15 }

// Build the bracket matchups from standings + already-entered results
function buildKOMatchups(round, standings, koResults) {
  const koBySlot = {}
  for (const r of koResults) koBySlot[`${r.round}|${r.slot}`] = r

  // Helper to get winner of a prior slot
  const getWinner = (r, s) => koBySlot[`${r}|${s}`]?.winner_name || 'TBD'

  // Helper to get 1st or 2nd from a group
  const getGroup = (letter, rank) => {
    const g = standings[`Group ${letter}`] || []
    return g.find(t => t.rank === rank)?.team || 'TBD'
  }

  // Helper to get best 8 third-place from standings
  const getThirdPlace = (standings) => {
    return Object.values(standings).map(g => g.find(t => t.rank === 3)).filter(Boolean)
      .sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf).slice(0,8).map(t => t.team)
  }
  const bestThird = getThirdPlace(standings)

  if (round === 'r32') {
    return [
      { slot:'M73',  home: getGroup('A',2), away: getGroup('B',2) },
      { slot:'M74',  home: getGroup('E',1), away: bestThird[0]||'TBD' },
      { slot:'M75',  home: getGroup('F',1), away: getGroup('C',2) },
      { slot:'M76',  home: getGroup('C',1), away: getGroup('F',2) },
      { slot:'M77',  home: getGroup('I',1), away: bestThird[1]||'TBD' },
      { slot:'M78',  home: getGroup('E',2), away: getGroup('I',2) },
      { slot:'M79',  home: getGroup('A',1), away: bestThird[2]||'TBD' },
      { slot:'M80',  home: getGroup('L',1), away: bestThird[3]||'TBD' },
      { slot:'M81',  home: getGroup('D',1), away: bestThird[4]||'TBD' },
      { slot:'M82',  home: getGroup('G',1), away: bestThird[5]||'TBD' },
      { slot:'M83',  home: getGroup('K',2), away: getGroup('L',2) },
      { slot:'M84',  home: getGroup('H',1), away: getGroup('J',2) },
      { slot:'M85',  home: getGroup('B',1), away: bestThird[6]||'TBD' },
      { slot:'M86',  home: getGroup('J',1), away: getGroup('H',2) },
      { slot:'M87',  home: getGroup('K',1), away: bestThird[7]||'TBD' },
      { slot:'M88',  home: getGroup('D',2), away: getGroup('G',2) },
    ].map(m => ({ ...m, round:'r32', existing: koBySlot[`r32|${m.slot}`] }))
  }

  if (round === 'r16') {
    return [
      { slot:'R16_1', home: getWinner('r32','M73'), away: getWinner('r32','M74') },
      { slot:'R16_2', home: getWinner('r32','M75'), away: getWinner('r32','M76') },
      { slot:'R16_3', home: getWinner('r32','M77'), away: getWinner('r32','M78') },
      { slot:'R16_4', home: getWinner('r32','M79'), away: getWinner('r32','M80') },
      { slot:'R16_5', home: getWinner('r32','M81'), away: getWinner('r32','M82') },
      { slot:'R16_6', home: getWinner('r32','M83'), away: getWinner('r32','M84') },
      { slot:'R16_7', home: getWinner('r32','M85'), away: getWinner('r32','M86') },
      { slot:'R16_8', home: getWinner('r32','M87'), away: getWinner('r32','M88') },
    ].map(m => ({ ...m, round:'r16', existing: koBySlot[`r16|${m.slot}`] }))
  }

  if (round === 'qf') {
    return [
      { slot:'QF_1', home: getWinner('r16','R16_1'), away: getWinner('r16','R16_2') },
      { slot:'QF_2', home: getWinner('r16','R16_3'), away: getWinner('r16','R16_4') },
      { slot:'QF_3', home: getWinner('r16','R16_5'), away: getWinner('r16','R16_6') },
      { slot:'QF_4', home: getWinner('r16','R16_7'), away: getWinner('r16','R16_8') },
    ].map(m => ({ ...m, round:'qf', existing: koBySlot[`qf|${m.slot}`] }))
  }

  if (round === 'sf') {
    return [
      { slot:'SF_1', home: getWinner('qf','QF_1'), away: getWinner('qf','QF_2') },
      { slot:'SF_2', home: getWinner('qf','QF_3'), away: getWinner('qf','QF_4') },
    ].map(m => ({ ...m, round:'sf', existing: koBySlot[`sf|${m.slot}`] }))
  }

  if (round === 'final') {
    return [
      { slot:'FINAL', home: getWinner('sf','SF_1'), away: getWinner('sf','SF_2'),
        round:'final', existing: koBySlot['final|FINAL'] },
    ]
  }
  return []
}

function KOMatchCard({ match, adminEmail, onSave }) {
  const { slot, round, home, away, existing } = match
  const [winner, setWinner] = useState(existing?.winner_name || '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(!!existing?.winner_name)
  const [err,    setErr]    = useState('')
  const bothKnown = home !== 'TBD' && away !== 'TBD'

  async function handleSave() {
    if (!winner) { setErr('Select a winner'); return }
    setSaving(true); setErr('')
    try {
      const res  = await fetch(`${API}/api/admin/knockout-result`, {
        method: 'POST', headers: apiHeaders(adminEmail),
        body: JSON.stringify({ round, slot, winner_name: winner, home_team: home, away_team: away }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      onSave({ round, slot, winner, data })
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className={`${styles.koCard} ${saved ? styles.koCardDone : ''} ${!bothKnown ? styles.koCardTbd : ''}`}>
      <div className={styles.koSlot}>{slot}</div>
      <div className={styles.koTeams}>
        <button
          className={`${styles.koTeamBtn} ${winner === home ? styles.koTeamPicked : ''} ${!bothKnown ? styles.koTeamTbd : ''}`}
          onClick={() => { if (bothKnown) { setWinner(home); setSaved(false) } }}
          disabled={!bothKnown || saving}
        >
          {home}
        </button>
        <span className={styles.koVs}>vs</span>
        <button
          className={`${styles.koTeamBtn} ${winner === away ? styles.koTeamPicked : ''} ${!bothKnown ? styles.koTeamTbd : ''}`}
          onClick={() => { if (bothKnown) { setWinner(away); setSaved(false) } }}
          disabled={!bothKnown || saving}
        >
          {away}
        </button>
      </div>
      {winner && (
        <div className={styles.koWinnerRow}>
          Winner: <strong>{winner}</strong>
          <span className={styles.koPts}>+{KO_POINTS[round]||0} pts</span>
        </div>
      )}
      <div className={styles.koActions}>
        <button
          className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
          onClick={handleSave} disabled={saving || !winner || !bothKnown}
        >
          {saving ? '…' : saved ? '✓ Saved & Scored' : 'Save Winner'}
        </button>
        {err && <span className={styles.rowErr}>{err}</span>}
        {!bothKnown && <span className={styles.koTbdNote}>Enter prior round results first</span>}
      </div>
      {saved && <div className={styles.koScoreInfo}>{match.data?.picks_scored || 0} users scored · {match.data?.correct_picks || 0} correct picks</div>}
    </div>
  )
}

// ─── BONUS TAB ───────────────────────────────────────────────────────────────
import { TEAMS } from '../engine/tournamentData'
const TEAM_NAMES = [...TEAMS].sort((a,b) => a.name.localeCompare(b.name)).map(t => t.name)

function BonusTab({ adminEmail }) {
  const [answers, setAnswers] = useState({ golden_boot_player:'', most_yellow_cards_team:'', most_red_cards_team:'', most_clean_sheets_team:'' })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [result, setResult] = useState(null)
  const [err,    setErr]    = useState('')

  useEffect(() => {
    fetch(`${API}/api/admin/bonus-answers`, { headers: { 'x-admin-email': adminEmail } })
      .then(r => r.json()).then(d => { if (d.answers) setAnswers({ golden_boot_player: d.answers.golden_boot_player||'', most_yellow_cards_team: d.answers.most_yellow_cards_team||'', most_red_cards_team: d.answers.most_red_cards_team||'', most_clean_sheets_team: d.answers.most_clean_sheets_team||'' }) })
      .catch(() => {})
  }, [adminEmail])

  async function handleSave() {
    setSaving(true); setErr(''); setSaved(false)
    try {
      const res  = await fetch(`${API}/api/admin/bonus-answers`, {
        method: 'POST', headers: apiHeaders(adminEmail), body: JSON.stringify(answers),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true); setResult(data)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const TeamSelect = ({ field, label, hint }) => (
    <div className={styles.bonusField}>
      <label className={styles.bonusLabel}>{label}</label>
      {hint && <p className={styles.bonusHint}>{hint}</p>}
      <select className={styles.bonusSelect} value={answers[field]} onChange={e => { setAnswers(a => ({...a,[field]:e.target.value})); setSaved(false) }}>
        <option value="">— Select team —</option>
        {TEAM_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  )

  return (
    <div className={styles.bonusTab}>
      <div className={styles.bonusIntro}>
        <h3 className={styles.bonusTitle}>Actual Bonus Answers</h3>
        <p className={styles.bonusSub}>Enter the actual tournament-wide results. Saving will immediately score all user bonus predictions (10 pts per correct answer).</p>
      </div>
      <div className={styles.bonusGrid}>
        <div className={styles.bonusField}>
          <label className={styles.bonusLabel}>⚽ Golden Boot — Top Scorer</label>
          <p className={styles.bonusHint}>Player who scored the most goals</p>
          <input type="text" className={styles.bonusInput} placeholder="e.g. Kylian Mbappé"
            value={answers.golden_boot_player} onChange={e => { setAnswers(a => ({...a,golden_boot_player:e.target.value})); setSaved(false) }} />
        </div>
        <TeamSelect field="most_yellow_cards_team" label="🟨 Most Yellow Cards" hint="Team with most yellow cards in the tournament" />
        <TeamSelect field="most_red_cards_team"    label="🟥 Most Red Cards"    hint="Team with most red cards in the tournament" />
        <TeamSelect field="most_clean_sheets_team" label="🧤 Most Clean Sheets" hint="Team with most clean sheets in the tournament" />
      </div>
      {err  && <p className={styles.errMsg}>{err}</p>}
      {saved && result && <p className={styles.successMsg}>✓ Saved and scored {result.users_scored} users</p>}
      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving & Scoring…' : 'Save Bonus Answers + Score All Users'}
      </button>
    </div>
  )
}

// ─── SCORING SUMMARY TAB ─────────────────────────────────────────────────────
function SummaryTab({ adminEmail }) {
  const [summary, setSummary] = useState(null)
  const [koBreakdown, setKoBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/scoring-summary`, { headers: { 'x-admin-email': adminEmail } }).then(r => r.json()),
      fetch(`${API}/api/admin/ko-scoring-overview`, { headers: { 'x-admin-email': adminEmail } }).then(r => r.json()),
    ]).then(([s, ko]) => {
      setSummary(s)
      if (!ko.error) setKoBreakdown(ko)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [adminEmail])

  if (loading) return <p className={styles.loading}>Loading summary…</p>
  if (!summary) return <p className={styles.errMsg}>Could not load summary</p>

  const rows = [
    { label: 'Paid Entries',            value: summary.paid_users,             total: null },
    { label: 'Group Matches Scored',    value: summary.group_matches_done,     total: summary.group_matches_total },
    { label: 'KO Slots Entered',        value: summary.ko_slots_done,          total: summary.ko_slots_total },
    { label: 'Bonus Fields Entered',    value: summary.bonus_fields_done,      total: summary.bonus_fields_total },
    { label: 'Match Score Rows',        value: summary.prediction_scores_rows, total: null },
    { label: 'KO Score Rows',           value: summary.knockout_scores_rows,   total: null },
    { label: 'Bonus Score Rows',        value: summary.bonus_scores_rows,      total: null },
  ]

  const STATUS_COLORS = { correct:'#6bca80', incorrect:'#e07070', pending:'#C9A84C', no_pick:'#7A7066' }

  return (
    <div className={styles.summaryTab}>
      <h3 className={styles.bonusTitle}>Scoring Status</h3>
      <div className={styles.summaryGrid}>
        {rows.map(r => (
          <div key={r.label} className={styles.summaryCard}>
            <span className={styles.summaryNum}>{r.value}{r.total != null ? `/${r.total}` : ''}</span>
            <span className={styles.summaryLabel}>{r.label}</span>
            {r.total != null && (
              <div className={styles.summaryBar}>
                <div className={styles.summaryBarFill} style={{width:`${Math.round((r.value/r.total)*100)}%`}} />
              </div>
            )}
          </div>
        ))}
      </div>

      {koBreakdown?.slots?.length > 0 && (
        <div style={{marginTop:32}}>
          <h3 className={styles.bonusTitle} style={{marginBottom:12}}>KO Slot Scoring Overview</h3>
          <p style={{fontSize:13,color:'var(--white-muted)',marginBottom:16}}>
            Shows how many users picked correctly vs incorrectly for each entered KO result.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {koBreakdown.slots.map(slot => (
              <div key={`${slot.round}|${slot.slot}`} className={styles.logRow}>
                <span className={styles.logTime} style={{minWidth:60,fontWeight:700}}>{slot.round_label}</span>
                <span className={styles.logScore}>{slot.slot}</span>
                <span className={styles.logInfo}>{slot.home} vs {slot.away}</span>
                <span style={{color:'var(--gold-bright)',fontFamily:'Barlow Condensed',fontWeight:700}}>→ {slot.winner}</span>
                <span style={{color:'#6bca80',fontSize:12}}>✓ {slot.correct_picks}</span>
                <span style={{color:'#e07070',fontSize:12}}>✗ {slot.incorrect_picks}</span>
                <span style={{color:'var(--gold-dim)',fontSize:12}}>– {slot.no_picks} no pick</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [emailInput, setEmailInput] = useState('')
  const [adminEmail, setAdminEmail] = useState(() => sessionStorage.getItem(ADMIN_EMAIL_KEY) || '')
  const [authed,  setAuthed]  = useState(false)
  const [tab,     setTab]     = useState('groups')
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Group tab state
  const [matches,   setMatches]  = useState([])
  const [filter,    setFilter]   = useState('all')
  const [scoreLog,  setScoreLog] = useState([])

  // KO tab state
  const [koState, setKoState]  = useState({ standings:{}, koResults:[] })
  const [koRound, setKoRound]  = useState('r32')
  const [koLog,   setKoLog]    = useState([])

  useEffect(() => { if (adminEmail) loadAll(adminEmail) }, [])

  async function loadAll(email) {
    setLoading(true); setLoadErr('')
    try {
      const [gmRes, koRes] = await Promise.all([
        fetch(`${API}/api/admin/matches`,          { headers: { 'x-admin-email': email } }),
        fetch(`${API}/api/admin/knockout-state`,   { headers: { 'x-admin-email': email } }),
      ])
      if (gmRes.status === 403) {
        setLoadErr('Access denied.')
        sessionStorage.removeItem(ADMIN_EMAIL_KEY); setAuthed(false); return
      }
      const gmData = await gmRes.json()
      const koData = await koRes.json()
      setMatches(gmData.matches || [])
      setKoState({ standings: koData.standings || {}, koResults: koData.koResults || [] })
      setAuthed(true)
      sessionStorage.setItem(ADMIN_EMAIL_KEY, email)
      setAdminEmail(email)
    } catch (e) { setLoadErr(e.message) } finally { setLoading(false) }
  }

  function handleGate(e) { e.preventDefault(); loadAll(emailInput.trim().toLowerCase()) }

  function onGroupSave(matchId, home, away, apiResponse) {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, actual_home_score:home, actual_away_score:away, completed:true } : m))
    setScoreLog(prev => [{ home, away, count: apiResponse?.predictions_scored??0, summary: apiResponse?.score_summary??{}, time: new Date().toLocaleTimeString() }, ...prev].slice(0,20))
  }

  function onKOSave(info) {
    setKoState(prev => {
      const updated = [...prev.koResults.filter(r => !(r.round===info.round&&r.slot===info.slot)), { round:info.round, slot:info.slot, winner_name:info.winner }]
      return { ...prev, koResults: updated }
    })
    setKoLog(prev => [{ ...info, time: new Date().toLocaleTimeString() }, ...prev].slice(0,20))
  }

  // Build grouped matches for group tab
  const groupOrder = []
  const groupMap = {}
  for (const m of matches) {
    const g = m.group_name || 'Unknown'
    if (!groupMap[g]) { groupMap[g] = []; groupOrder.push(g) }
    groupMap[g].push(m)
  }
  groupOrder.sort()
  const completedCount = matches.filter(m => m.completed).length
  const filteredMatches = matches.filter(m => filter==='pending' ? !m.completed : filter==='completed' ? m.completed : true)
  const filteredOrder = []; const filteredMap = {}
  for (const m of filteredMatches) {
    const g = m.group_name || 'Unknown'
    if (!filteredMap[g]) { filteredMap[g] = []; filteredOrder.push(g) }
    filteredMap[g].push(m)
  }
  filteredOrder.sort()

  // KO matchups for current round
  const koMatchups = buildKOMatchups(koRound, koState.standings, koState.koResults)

  // ── GATE ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div className={styles.gatePage}>
      <div className={styles.gateCard}>
        <p className={styles.gateEyebrow}>ADMIN ACCESS</p>
        <h1 className={styles.gateTitle}>Results Entry Panel</h1>
        <p className={styles.gateSub}>Wargacki Performance · WC 2026</p>
        {loadErr && <p className={styles.gateErr}>{loadErr}</p>}
        <form onSubmit={handleGate} className={styles.gateForm}>
          <input type="email" className={styles.gateInput} placeholder="Admin email"
            value={emailInput} onChange={e => setEmailInput(e.target.value)} required autoFocus />
          <button type="submit" className={styles.gateBtn} disabled={loading}>
            {loading ? 'Verifying…' : 'Enter Panel'}
          </button>
        </form>
      </div>
    </div>
  )

  // ── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>ADMIN · RESULTS ENTRY</p>
          <h1 className={styles.title}>Tournament Admin</h1>
          <p className={styles.sub}>Enter actual results. All predictions auto-scored on save.</p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}><span className={styles.statNum}>{completedCount}</span><span className={styles.statLabel}>Group Results</span></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span className={styles.statNum}>{koState.koResults.filter(r=>r.winner_name).length}</span><span className={styles.statLabel}>KO Results</span></div>
        </div>
      </div>

      {/* TABS */}
      <div className={styles.tabBar}>
        {[
          { key:'groups',   label:'Group Results',   badge: `${completedCount}/72` },
          { key:'knockout', label:'Knockout Results', badge: `${koState.koResults.filter(r=>r.winner_name).length}/31` },
          { key:'bonus',    label:'Bonus Answers',    badge: null },
          { key:'summary',  label:'Scoring Summary',  badge: null },
        ].map(t => (
          <button key={t.key} className={`${styles.tab} ${tab===t.key?styles.tabActive:''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.badge && <span className={styles.tabBadge}>{t.badge}</span>}
          </button>
        ))}
        <div className={styles.tabSpacer} />
        <a href="/wc/leaderboard" className={styles.toolLink}>Leaderboard →</a>
        <button className={styles.signOutBtn} onClick={() => { sessionStorage.removeItem(ADMIN_EMAIL_KEY); setAuthed(false); setAdminEmail('') }}>Sign out</button>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {/* GROUP RESULTS TAB */}
      {tab === 'groups' && (
        <div className={styles.tabContent}>
          <div className={styles.toolbar}>
            <div className={styles.filters}>
              {[{key:'all',label:'All',count:matches.length},{key:'pending',label:'Pending',count:matches.length-completedCount},{key:'completed',label:'Completed',count:completedCount}].map(f => (
                <button key={f.key} className={`${styles.filterBtn} ${filter===f.key?styles.filterActive:''}`} onClick={() => setFilter(f.key)}>
                  {f.label} <span className={styles.filterCount}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.groups}>
            {filteredOrder.map(gName => (
              <section key={gName} className={styles.group}>
                <h2 className={styles.groupTitle}>{gName}</h2>
                {filteredMap[gName].map(m => (
                  <GroupMatchRow key={m.id} match={m} adminEmail={adminEmail} onSave={onGroupSave} />
                ))}
              </section>
            ))}
            {filteredOrder.length === 0 && <p className={styles.empty}>No matches for this filter.</p>}
          </div>
          {scoreLog.length > 0 && (
            <div className={styles.logSection}>
              <h3 className={styles.logTitle}>Scoring Activity</h3>
              {scoreLog.map((e,i) => (
                <div key={i} className={styles.logRow}>
                  <span className={styles.logTime}>{e.time}</span>
                  <span className={styles.logScore}>{e.home}–{e.away}</span>
                  <span className={styles.logInfo}>{e.count} predictions scored</span>
                  {Object.keys(e.summary).length > 0 && (
                    <span className={styles.logBreakdown}>
                      {Object.entries(e.summary).map(([k,v]) => ({exact_score:`${v} exact`,correct_result_same_gd:`${v} correct+GD`,correct_result_diff_gd:`${v} correct`,one_score_correct:`${v} partial`,wrong_result:`${v} wrong`}[k]||`${v}×${k}`)).join(' · ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KNOCKOUT TAB */}
      {tab === 'knockout' && (
        <div className={styles.tabContent}>
          <div className={styles.koRoundNav}>
            {['r32','r16','qf','sf','final'].map(r => {
              const done = koState.koResults.filter(kr => kr.round===r && kr.winner_name).length
              const total = {r32:16,r16:8,qf:4,sf:2,final:1}[r]
              return (
                <button key={r} className={`${styles.koRoundBtn} ${koRound===r?styles.koRoundActive:''} ${done===total?styles.koRoundDone:''}`} onClick={() => setKoRound(r)}>
                  {ROUND_LABELS_FULL[r]}
                  <span className={styles.koRoundBadge}>{done}/{total}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.koIntro}>
            <p className={styles.koIntroText}>
              Click a team button to select the winner. Save to score all user picks.
              Teams show as TBD until prior round results are entered.
              <strong> +{KO_POINTS[koRound]||0} pts</strong> per correct user pick.
            </p>
          </div>

          <div className={styles.koGrid}>
            {koMatchups.map(m => (
              <KOMatchCard key={`${m.round}|${m.slot}`} match={m} adminEmail={adminEmail} onSave={onKOSave} />
            ))}
          </div>

          {koLog.length > 0 && (
            <div className={styles.logSection}>
              <h3 className={styles.logTitle}>KO Scoring Activity</h3>
              {koLog.slice(0,8).map((e,i) => (
                <div key={i} className={styles.logRow}>
                  <span className={styles.logTime}>{e.time}</span>
                  <span className={styles.logScore}>{e.round}|{e.slot}</span>
                  <span className={styles.logInfo}>Winner: <strong>{e.winner}</strong></span>
                  {e.data && <span className={styles.logBreakdown}>{e.data.picks_scored} picks scored · {e.data.correct_picks} correct</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BONUS TAB */}
      {tab === 'bonus' && (
        <div className={styles.tabContent}>
          <BonusTab adminEmail={adminEmail} />
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className={styles.tabContent}>
          <SummaryTab adminEmail={adminEmail} />
        </div>
      )}
    </div>
  )
}
