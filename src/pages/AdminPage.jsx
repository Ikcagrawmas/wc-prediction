import { useState, useEffect } from 'react'
import styles from './AdminPage.module.css'

const ADMIN_EMAIL_KEY = 'wc_admin_email'

// Build ordered group list from flat match array
function buildGroupedMatches(matches) {
  const groupOrder = []
  const groups = {}

  for (const m of matches) {
    const gName = m.group_name || 'Unknown Group'
    if (!groups[gName]) {
      groups[gName] = []
      groupOrder.push(gName)
    }
    groups[gName].push(m)
  }

  // Sort groups alphabetically (Group A → Group L)
  groupOrder.sort()
  return { groupOrder, groups }
}

function formatKickoff(utcStr) {
  if (!utcStr) return '—'
  const d = new Date(utcStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  }) + ' · ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  }) + ' ET'
}

// ─── MATCH ROW ────────────────────────────────────────────────────────────────
function MatchRow({ match, adminEmail, onSave }) {
  const [home, setHome] = useState(
    match.actual_home_score != null ? String(match.actual_home_score) : ''
  )
  const [away, setAway] = useState(
    match.actual_away_score != null ? String(match.actual_away_score) : ''
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(match.completed || false)
  const [err,    setErr]    = useState('')

  const homeName = match.home_team_name || '(TBD)'
  const awayName = match.away_team_name || '(TBD)'
  const bothFilled = home !== '' && away !== ''

  async function handleSave() {
    if (!bothFilled) { setErr('Enter both scores'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('http://localhost:3001/api/admin/result', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
        body:    JSON.stringify({ match_id: match.id, home_score: +home, away_score: +away }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      onSave(match.id, +home, +away, data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${styles.matchRow} ${saved ? styles.rowDone : ''}`}>
      {/* Left meta block */}
      <div className={styles.rowMeta}>
        <span className={styles.rowNum}>M{match.match_number}</span>
        <span className={styles.rowDate}>{formatKickoff(match.kickoff_time)}</span>
        {(match.city || match.venue) && (
          <span className={styles.rowVenue}>
            {[match.city, match.venue].filter(Boolean).join(' · ')}
          </span>
        )}
        {saved && <span className={styles.rowDoneBadge}>✓ Entered</span>}
      </div>

      {/* Centre: teams + score inputs */}
      <div className={styles.rowCentre}>
        <span className={`${styles.rowTeam} ${styles.rowTeamHome}`}>{homeName}</span>

        <div className={styles.rowScores}>
          <input
            type="number" min="0" max="99"
            className={`${styles.scoreBox} ${saved ? styles.scoreBoxDone : ''}`}
            value={home}
            onChange={e => { setHome(e.target.value.replace(/\D/,'')); setSaved(false) }}
            onFocus={e => e.target.select()}
            placeholder="0"
          />
          <span className={styles.scoreDash}>–</span>
          <input
            type="number" min="0" max="99"
            className={`${styles.scoreBox} ${saved ? styles.scoreBoxDone : ''}`}
            value={away}
            onChange={e => { setAway(e.target.value.replace(/\D/,'')); setSaved(false) }}
            onFocus={e => e.target.select()}
            placeholder="0"
          />
        </div>

        <span className={`${styles.rowTeam} ${styles.rowTeamAway}`}>{awayName}</span>
      </div>

      {/* Right: save button */}
      <div className={styles.rowAction}>
        <button
          className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
          onClick={handleSave}
          disabled={saving || !bothFilled}
        >
          {saving ? '…' : saved ? '✓ Saved' : 'Save Result'}
        </button>
        {err && <span className={styles.rowErr}>{err}</span>}
      </div>
    </div>
  )
}

// ─── ADMIN PAGE ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [emailInput, setEmailInput] = useState('')
  const [adminEmail, setAdminEmail] = useState(
    () => sessionStorage.getItem(ADMIN_EMAIL_KEY) || ''
  )
  const [authed,  setAuthed]  = useState(false)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [filter,  setFilter]  = useState('all')
  const [scoreLog, setScoreLog] = useState([])

  useEffect(() => {
    if (adminEmail) load(adminEmail)
  }, [])

  async function load(email) {
    setLoading(true); setLoadErr('')
    try {
      const res = await fetch('http://localhost:3001/api/admin/matches', {
        headers: { 'x-admin-email': email },
      })
      if (res.status === 403) {
        setLoadErr('Access denied — email not authorised as admin.')
        sessionStorage.removeItem(ADMIN_EMAIL_KEY)
        setAuthed(false)
        return
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setMatches(data.matches || [])
      setAuthed(true)
      sessionStorage.setItem(ADMIN_EMAIL_KEY, email)
      setAdminEmail(email)
    } catch (e) {
      setLoadErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleGate(e) {
    e.preventDefault()
    load(emailInput.trim().toLowerCase())
  }

  function handleSave(matchId, home, away, apiResponse) {
    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, actual_home_score: home, actual_away_score: away, completed: true } : m
    ))
    setScoreLog(prev => [
      {
        matchId, home, away,
        count:   apiResponse?.predictions_scored ?? 0,
        summary: apiResponse?.score_summary ?? {},
        time:    new Date().toLocaleTimeString(),
      },
      ...prev,
    ].slice(0, 30))
  }

  // Counts
  const completedCount = matches.filter(m => m.completed).length
  const pendingCount   = matches.length - completedCount

  // Filter
  const filtered = matches.filter(m =>
    filter === 'pending'   ? !m.completed :
    filter === 'completed' ?  m.completed :
    true
  )

  const { groupOrder, groups } = buildGroupedMatches(filtered)

  // ── GATE ──────────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className={styles.gatePage}>
        <div className={styles.gateCard}>
          <p className={styles.gateEyebrow}>ADMIN ACCESS</p>
          <h1 className={styles.gateTitle}>Results Entry Panel</h1>
          <p className={styles.gateSub}>Wargacki Performance · WC 2026</p>
          {loadErr && <p className={styles.gateErr}>{loadErr}</p>}
          <form onSubmit={handleGate} className={styles.gateForm}>
            <input
              type="email"
              className={styles.gateInput}
              placeholder="Admin email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              required autoFocus
            />
            <button type="submit" className={styles.gateBtn} disabled={loading}>
              {loading ? 'Verifying…' : 'Enter Panel'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── MAIN ──────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>ADMIN · RESULTS ENTRY</p>
          <h1 className={styles.title}>Match Results</h1>
          <p className={styles.sub}>Enter actual final scores. Predictions are auto-scored immediately.</p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{completedCount}</span>
            <span className={styles.statLabel}>Entered</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>{pendingCount}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            { key: 'all',       label: 'All',       count: matches.length },
            { key: 'pending',   label: 'Pending',   count: pendingCount },
            { key: 'completed', label: 'Completed', count: completedCount },
          ].map(f => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className={styles.filterCount}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <a href="/wc/leaderboard" className={styles.toolLink}>Leaderboard →</a>
          <button
            className={styles.signOutBtn}
            onClick={() => { sessionStorage.removeItem(ADMIN_EMAIL_KEY); setAuthed(false); setAdminEmail('') }}
          >
            Sign out
          </button>
        </div>
      </div>

      {loading && <p className={styles.loading}>Loading matches…</p>}
      {loadErr  && <p className={styles.errMsg}>{loadErr}</p>}

      {/* MATCH GROUPS */}
      <div className={styles.groups}>
        {groupOrder.map(gName => (
          <section key={gName} className={styles.group}>
            <h2 className={styles.groupTitle}>{gName}</h2>
            {groups[gName].map(m => (
              <MatchRow
                key={m.id}
                match={m}
                adminEmail={adminEmail}
                onSave={handleSave}
              />
            ))}
          </section>
        ))}
        {!loading && groupOrder.length === 0 && (
          <p className={styles.empty}>No matches for this filter.</p>
        )}
      </div>

      {/* SCORING LOG */}
      {scoreLog.length > 0 && (
        <div className={styles.logSection}>
          <h3 className={styles.logTitle}>Scoring Activity</h3>
          <div className={styles.logList}>
            {scoreLog.map((e, i) => (
              <div key={i} className={styles.logRow}>
                <span className={styles.logTime}>{e.time}</span>
                <span className={styles.logScore}>{e.home}–{e.away}</span>
                <span className={styles.logInfo}>{e.count} predictions scored</span>
                {Object.keys(e.summary).length > 0 && (
                  <span className={styles.logBreakdown}>
                    {Object.entries(e.summary).map(([k, v]) => {
                      const labels = {
                        exact_score: `${v} exact score${v!==1?'s':''}`,
                        correct_result_same_gd: `${v} correct+GD`,
                        correct_result_diff_gd: `${v} correct result`,
                        one_score_correct: `${v} partial`,
                        wrong_result: `${v} wrong`,
                      }
                      return labels[k] || `${v}×${k.replace(/_/g,' ')}`
                    }).join(' · ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
