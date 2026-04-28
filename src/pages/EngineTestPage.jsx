// ============================================================
// ENGINE TEST HARNESS — Phase 2
// Route: /wc/engine-test (dev only, gated by DEV flag)
// Tests the full prediction → standings → bracket pipeline
// ============================================================

import { useState, useEffect } from 'react'
import { TEAMS, GROUP_STAGE_MATCHES } from '../engine/tournamentData.js'
import {
  generateUserTournamentState,
  validateRoundOf32,
} from '../engine/tournamentEngine.js'

// ─── SAMPLE PREDICTIONS ──────────────────────────────────────────────────────
// A complete set of hypothetical scores covering all 48 group-stage matches.
// Chosen to create interesting standings and test third-place logic.
const SAMPLE_PREDICTIONS = [
  // GROUP A
  { home_team: 'Mexico',        away_team: 'South Africa', predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'South Korea',   away_team: 'Czechia',      predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'Czechia',       away_team: 'South Africa', predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Mexico',        away_team: 'South Korea',  predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Czechia',       away_team: 'Mexico',       predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'South Africa',  away_team: 'South Korea',  predicted_home_score: 0, predicted_away_score: 3 },
  // GROUP B
  { home_team: 'Canada',             away_team: 'Bosnia-Herzegovina', predicted_home_score: 3, predicted_away_score: 1 },
  { home_team: 'Qatar',              away_team: 'Switzerland',        predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Switzerland',        away_team: 'Bosnia-Herzegovina', predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Canada',             away_team: 'Qatar',              predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Switzerland',        away_team: 'Canada',             predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'Bosnia-Herzegovina', away_team: 'Qatar',              predicted_home_score: 2, predicted_away_score: 1 },
  // GROUP C
  { home_team: 'Brazil',   away_team: 'Morocco',  predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Haiti',    away_team: 'Scotland',  predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Brazil',   away_team: 'Haiti',    predicted_home_score: 4, predicted_away_score: 0 },
  { home_team: 'Scotland', away_team: 'Morocco',  predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Scotland', away_team: 'Brazil',   predicted_home_score: 1, predicted_away_score: 2 },
  { home_team: 'Morocco',  away_team: 'Haiti',    predicted_home_score: 3, predicted_away_score: 0 },
  // GROUP D
  { home_team: 'USA',       away_team: 'Paraguay',  predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Australia', away_team: 'Turkiye',   predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'USA',       away_team: 'Australia', predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Turkiye',   away_team: 'Paraguay',  predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Turkiye',   away_team: 'USA',       predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'Paraguay',  away_team: 'Australia', predicted_home_score: 1, predicted_away_score: 2 },
  // GROUP E
  { home_team: 'Germany',     away_team: 'Curaçao',     predicted_home_score: 5, predicted_away_score: 0 },
  { home_team: 'Ivory Coast', away_team: 'Ecuador',     predicted_home_score: 1, predicted_away_score: 2 },
  { home_team: 'Germany',     away_team: 'Ivory Coast', predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Ecuador',     away_team: 'Curaçao',     predicted_home_score: 3, predicted_away_score: 0 },
  { home_team: 'Curaçao',     away_team: 'Ivory Coast', predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'Ecuador',     away_team: 'Germany',     predicted_home_score: 1, predicted_away_score: 1 },
  // GROUP F
  { home_team: 'Netherlands', away_team: 'Japan',    predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Sweden',      away_team: 'Tunisia',  predicted_home_score: 1, predicted_away_score: 0 },
  { home_team: 'Netherlands', away_team: 'Sweden',   predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Tunisia',     away_team: 'Japan',    predicted_home_score: 1, predicted_away_score: 2 },
  { home_team: 'Tunisia',     away_team: 'Netherlands', predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'Japan',       away_team: 'Sweden',   predicted_home_score: 2, predicted_away_score: 1 },
  // GROUP G
  { home_team: 'Belgium',     away_team: 'Egypt',       predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Iran',        away_team: 'New Zealand', predicted_home_score: 1, predicted_away_score: 0 },
  { home_team: 'Belgium',     away_team: 'Iran',        predicted_home_score: 3, predicted_away_score: 1 },
  { home_team: 'New Zealand', away_team: 'Egypt',       predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'New Zealand', away_team: 'Belgium',     predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Egypt',       away_team: 'Iran',        predicted_home_score: 2, predicted_away_score: 1 },
  // GROUP H
  { home_team: 'Spain',       away_team: 'Cape Verde',   predicted_home_score: 3, predicted_away_score: 0 },
  { home_team: 'Saudi Arabia',away_team: 'Uruguay',      predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Uruguay',     away_team: 'Cape Verde',   predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Spain',       away_team: 'Saudi Arabia', predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Cape Verde',  away_team: 'Saudi Arabia', predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'Uruguay',     away_team: 'Spain',        predicted_home_score: 1, predicted_away_score: 2 },
  // GROUP I
  { home_team: 'France',  away_team: 'Senegal', predicted_home_score: 2, predicted_away_score: 1 },
  { home_team: 'Iraq',    away_team: 'Norway',  predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'Norway',  away_team: 'Senegal', predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'France',  away_team: 'Iraq',    predicted_home_score: 3, predicted_away_score: 0 },
  { home_team: 'Norway',  away_team: 'France',  predicted_home_score: 0, predicted_away_score: 1 },
  { home_team: 'Senegal', away_team: 'Iraq',    predicted_home_score: 2, predicted_away_score: 0 },
  // GROUP J
  { home_team: 'Argentina', away_team: 'Algeria',  predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Austria',   away_team: 'Jordan',   predicted_home_score: 1, predicted_away_score: 0 },
  { home_team: 'Argentina', away_team: 'Austria',  predicted_home_score: 1, predicted_away_score: 0 },
  { home_team: 'Jordan',    away_team: 'Algeria',  predicted_home_score: 1, predicted_away_score: 2 },
  { home_team: 'Algeria',   away_team: 'Austria',  predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'Jordan',    away_team: 'Argentina',predicted_home_score: 0, predicted_away_score: 3 },
  // GROUP K
  { home_team: 'Portugal',   away_team: 'DR Congo',   predicted_home_score: 3, predicted_away_score: 0 },
  { home_team: 'Uzbekistan', away_team: 'Colombia',   predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Portugal',   away_team: 'Uzbekistan', predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Colombia',   away_team: 'DR Congo',   predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Colombia',   away_team: 'Portugal',   predicted_home_score: 1, predicted_away_score: 1 },
  { home_team: 'DR Congo',   away_team: 'Uzbekistan', predicted_home_score: 1, predicted_away_score: 1 },
  // GROUP L
  { home_team: 'England', away_team: 'Croatia', predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Ghana',   away_team: 'Panama',  predicted_home_score: 1, predicted_away_score: 0 },
  { home_team: 'England', away_team: 'Ghana',   predicted_home_score: 2, predicted_away_score: 0 },
  { home_team: 'Panama',  away_team: 'Croatia', predicted_home_score: 0, predicted_away_score: 2 },
  { home_team: 'Panama',  away_team: 'England', predicted_home_score: 0, predicted_away_score: 3 },
  { home_team: 'Croatia', away_team: 'Ghana',   predicted_home_score: 2, predicted_away_score: 1 },
]

// ─── BUILD teamsByGroup LOOKUP ────────────────────────────────────────────────
function buildTeamsByGroup() {
  const result = {}
  for (const team of TEAMS) {
    if (!result[team.group]) result[team.group] = []
    result[team.group].push(team)
  }
  return result
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function EngineTestPage() {
  const [result, setResult] = useState(null)
  const [validation, setValidation] = useState(null)

  useEffect(() => {
    const teamsByGroup = buildTeamsByGroup()
    const state = generateUserTournamentState(teamsByGroup, SAMPLE_PREDICTIONS)
    const valid = validateRoundOf32(state.roundOf32)
    setResult(state)
    setValidation(valid)

    // Also log to console for detailed inspection
    console.group('🏆 ENGINE TEST — FIFA World Cup 2026')
    console.log('All Group Standings:', state.allGroupStandings)
    console.log('Advancing Teams:', state.advancingTeams)
    console.log('Round of 32 Bracket:', state.roundOf32)
    console.log('Validation:', valid)
    console.groupEnd()
  }, [])

  if (!result) return <div style={s.loading}>Running engine…</div>

  const { allGroupStandings, advancingTeams, roundOf32 } = result
  const groups = Object.entries(allGroupStandings)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>⚙️ ENGINE TEST — Phase 2</h1>
        <p style={s.sub}>Sample predictions → standings → bracket pipeline</p>
        <div style={validation?.valid ? s.validBadge : s.invalidBadge}>
          {validation?.valid
            ? `✓ VALID — Round of 32 has exactly ${validation.count} unique teams`
            : `✗ INVALID — ${validation?.count} teams (expected 32). Duplicates: ${validation?.duplicates?.join(', ')}`}
        </div>
      </div>

      {/* GROUP STANDINGS */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Group Standings (calculated from predictions)</h2>
        <div style={s.groupGrid}>
          {groups.map(([groupName, standings]) => (
            <div key={groupName} style={s.groupCard}>
              <div style={s.groupName}>{groupName}</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={{...s.th, textAlign:'left'}}>Team</th>
                    <th style={s.th}>P</th>
                    <th style={s.th}>W</th>
                    <th style={s.th}>D</th>
                    <th style={s.th}>L</th>
                    <th style={s.th}>GF</th>
                    <th style={s.th}>GA</th>
                    <th style={s.th}>GD</th>
                    <th style={s.th}>Pts</th>
                    <th style={s.th}>Adv</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(team => {
                    const isFirst = team.rank === 1
                    const isSecond = team.rank === 2
                    const isThird = team.rank === 3
                    const isBestThird = advancingTeams.bestThird.some(t => t.team === team.team)
                    const advances = isFirst || isSecond || (isThird && isBestThird)
                    return (
                      <tr key={team.team} style={advances ? s.advanceRow : s.normalRow}>
                        <td style={s.td}>{team.rank}</td>
                        <td style={{...s.td, textAlign:'left', fontWeight: advances ? 600 : 400}}>{team.team}</td>
                        <td style={s.td}>{team.played}</td>
                        <td style={s.td}>{team.wins}</td>
                        <td style={s.td}>{team.draws}</td>
                        <td style={s.td}>{team.losses}</td>
                        <td style={s.td}>{team.goals_for}</td>
                        <td style={s.td}>{team.goals_against}</td>
                        <td style={s.td}>{team.goal_difference > 0 ? `+${team.goal_difference}` : team.goal_difference}</td>
                        <td style={{...s.td, fontWeight: 700}}>{team.points}</td>
                        <td style={s.td}>
                          {isFirst ? '🥇' : isSecond ? '🥈' : (isThird && isBestThird) ? '🔄' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* BEST 8 THIRD-PLACE */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Best 8 Third-Place Teams (advancing)</h2>
        <table style={{...s.table, maxWidth: 700}}>
          <thead>
            <tr>
              <th style={s.th}>Rank</th>
              <th style={{...s.th, textAlign:'left'}}>Team</th>
              <th style={{...s.th, textAlign:'left'}}>Group</th>
              <th style={s.th}>Pts</th>
              <th style={s.th}>GD</th>
              <th style={s.th}>GF</th>
            </tr>
          </thead>
          <tbody>
            {advancingTeams.bestThird.map((t, i) => (
              <tr key={t.team} style={s.advanceRow}>
                <td style={s.td}>{i + 1}</td>
                <td style={{...s.td, textAlign:'left', fontWeight: 600}}>{t.team}</td>
                <td style={{...s.td, textAlign:'left'}}>{t.group}</td>
                <td style={s.td}>{t.points}</td>
                <td style={s.td}>{t.goal_difference > 0 ? `+${t.goal_difference}` : t.goal_difference}</td>
                <td style={s.td}>{t.goals_for}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={s.note}>🔄 = third place advancing as one of best 8</p>
      </section>

      {/* ROUND OF 32 BRACKET */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Round of 32 Bracket ({roundOf32.length} matches)</h2>
        <div style={s.bracketGrid}>
          {roundOf32.map(m => (
            <div key={m.match_number} style={s.bracketMatch}>
              <div style={s.matchNum}>Match {m.match_number}</div>
              <div style={s.matchTeams}>
                <span style={s.teamA}>{m.home_team}</span>
                <span style={s.vs}>vs</span>
                <span style={s.teamB}>{m.away_team}</span>
              </div>
              <div style={s.matchMeta}>{m.city} · {m.venue}</div>
              <div style={s.matchDesc}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ADVANCING SUMMARY */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Group Winners & Runners-Up</h2>
        <div style={s.advancingGrid}>
          {Object.keys(advancingTeams.winners).sort().map(letter => (
            <div key={letter} style={s.advancingCard}>
              <div style={s.advLetter}>Group {letter}</div>
              <div style={s.advWinner}>🥇 {advancingTeams.winners[letter]}</div>
              <div style={s.advRunnerup}>🥈 {advancingTeams.runnersUp[letter]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  page: { background: '#0A0806', color: '#F7F3ED', minHeight: '100vh', padding: '80px 20px 60px', fontFamily: 'Barlow, sans-serif' },
  loading: { color: '#C9A84C', padding: 40, fontSize: 20 },
  header: { maxWidth: 1200, margin: '0 auto 48px', textAlign: 'center' },
  title: { fontFamily: 'Playfair Display, serif', fontSize: 32, color: '#E8C46A', marginBottom: 8 },
  sub: { color: '#7A7066', marginBottom: 20 },
  validBadge: { display: 'inline-block', background: 'rgba(80,200,120,0.15)', border: '1px solid rgba(80,200,120,0.4)', color: '#80e090', padding: '8px 20px', borderRadius: 3, fontSize: 14 },
  invalidBadge: { display: 'inline-block', background: 'rgba(232,112,112,0.15)', border: '1px solid rgba(232,112,112,0.4)', color: '#e07070', padding: '8px 20px', borderRadius: 3, fontSize: 14 },
  section: { maxWidth: 1200, margin: '0 auto 60px' },
  sectionTitle: { fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: '#C9A84C', marginBottom: 20, textTransform: 'uppercase' },
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16 },
  groupCard: { background: '#1A1512', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 4, overflow: 'hidden' },
  groupName: { background: 'rgba(201,168,76,0.08)', padding: '10px 16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.15em', color: '#C9A84C' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '6px 8px', fontSize: 11, color: '#7A7066', fontWeight: 600, letterSpacing: '0.1em', textAlign: 'center', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '7px 8px', fontSize: 13, color: '#C8BFB5', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  advanceRow: { background: 'rgba(201,168,76,0.06)' },
  normalRow: {},
  note: { marginTop: 12, fontSize: 12, color: '#7A7066', fontStyle: 'italic' },
  bracketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 },
  bracketMatch: { background: '#1A1512', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 4, padding: '14px 16px' },
  matchNum: { fontSize: 11, color: '#7A7066', marginBottom: 8, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' },
  matchTeams: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  teamA: { flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 14, color: '#F7F3ED' },
  vs: { fontSize: 11, color: '#7A7066', flex: '0 0 20px', textAlign: 'center' },
  teamB: { flex: 1, fontWeight: 600, fontSize: 14, color: '#F7F3ED' },
  matchMeta: { fontSize: 11, color: '#C9A84C', marginBottom: 4 },
  matchDesc: { fontSize: 11, color: '#7A7066', fontStyle: 'italic' },
  advancingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  advancingCard: { background: '#1A1512', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 4, padding: '12px 16px' },
  advLetter: { fontSize: 11, color: '#C9A84C', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' },
  advWinner: { fontSize: 13, color: '#F7F3ED', fontWeight: 600, marginBottom: 4 },
  advRunnerup: { fontSize: 13, color: '#C8BFB5' },
}
