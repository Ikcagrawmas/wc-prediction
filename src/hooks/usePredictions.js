// usePredictions.js
// Manages all prediction state: group scores + knockout picks
// Handles load, save (debounced upsert), and returns save status

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { GROUP_STAGE_MATCHES } from '../engine/tournamentData'
import { cascadeClearPicks } from '../engine/bracketProgression'

// First match kicks off June 11 2026 19:00 UTC
export const FIRST_KICKOFF_UTC = new Date('2026-06-11T19:00:00Z')

export function useIsLocked() {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    function check() {
      setLocked(new Date() >= FIRST_KICKOFF_UTC)
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])
  return locked
}

// Build a stable match key: "HomeTeam|AwayTeam"
export function matchKey(m) {
  return `${m.home_team}|${m.away_team}`
}

// ─── MAIN HOOK ───────────────────────────────────────────────────────────────
export function usePredictions(userId, isPaid = false) {
  // scores: { "Mexico|South Africa": { home: 2, away: 0 }, ... }
  const [scores, setScores] = useState({})
  // knockoutPicks: { "r32|M73": "Mexico", ... }
  const [knockoutPicks, setKnockoutPicks] = useState({})
  const [loadStatus, setLoadStatus] = useState('idle') // idle | loading | loaded | error
  const [saveStatus, setSaveStatus] = useState('saved') // saved | saving | unsaved | error

  const pendingGroupSaves = useRef({})
  const pendingKOSaves = useRef({})
  const saveTimerRef = useRef(null)
  const userId_ = useRef(userId)
  userId_.current = userId

  // ── LOAD ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    setLoadStatus('loading')

    async function load() {
      try {
        // Load group predictions
        const { data: groupData, error: groupErr } = await supabase
          .from('predictions')
          .select('match_id, predicted_home_score, predicted_away_score')
          .eq('user_id', userId)

        if (groupErr) throw groupErr

        // Load match ID → matchKey mapping from matches table
        const { data: matchRows, error: matchErr } = await supabase
          .from('matches')
          .select('id, home_team_id, away_team_id')
          .eq('stage', 'group')

        if (matchErr) throw matchErr

        // We also need team names. Load teams table for ID→name map
        const { data: teamRows, error: teamErr } = await supabase
          .from('teams')
          .select('id, name')

        if (teamErr) throw teamErr

        const teamNameById = {}
        for (const t of (teamRows || [])) teamNameById[t.id] = t.name

        const matchKeyById = {}
        for (const m of (matchRows || [])) {
          const home = teamNameById[m.home_team_id]
          const away = teamNameById[m.away_team_id]
          if (home && away) matchKeyById[m.id] = `${home}|${away}`
        }

        // Map predictions → scores state
        const loadedScores = {}
        for (const row of (groupData || [])) {
          const key = matchKeyById[row.match_id]
          if (key) {
            loadedScores[key] = {
              home: row.predicted_home_score,
              away: row.predicted_away_score,
            }
          }
        }

        // Load knockout predictions
        const { data: koData, error: koErr } = await supabase
          .from('knockout_predictions')
          .select('round, slot, team_id')
          .eq('user_id', userId)

        if (koErr) throw koErr

        const loadedKO = {}
        for (const row of (koData || [])) {
          // Only load rows where team_id resolves to a real team name.
          // Rows with null team_id are "cleared" picks — skip them so they
          // never appear in knockoutPicks and never inflate the pick count.
          if (!row.team_id) continue
          const teamName = teamNameById[row.team_id]
          if (!teamName) continue
          const key = `${row.round}|${row.slot}`
          loadedKO[key] = teamName
        }

        setScores(loadedScores)
        setKnockoutPicks(loadedKO)
        setLoadStatus('loaded')
        setSaveStatus('saved')
      } catch (err) {
        console.error('Load error:', err)
        setLoadStatus('error')
      }
    }

    load()
  }, [userId])

  // ── DEBOUNCED SAVE ──────────────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    if (!isPaid) return          // preview users: never save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('unsaved')
    saveTimerRef.current = setTimeout(() => {
      flushSaves()
    }, 800)
  }, [isPaid])

  async function flushSaves() {
    const uid = userId_.current
    if (!uid) return

    const groupBatch = { ...pendingGroupSaves.current }
    const koBatch = { ...pendingKOSaves.current }
    pendingGroupSaves.current = {}
    pendingKOSaves.current = {}

    if (Object.keys(groupBatch).length === 0 && Object.keys(koBatch).length === 0) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('saving')

    try {
      // Load match ID map (needed for upsert)
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, home_team_id, away_team_id')
        .eq('stage', 'group')

      const { data: teamRows } = await supabase
        .from('teams')
        .select('id, name')

      const teamIdByName = {}
      const teamNameById = {}
      for (const t of (teamRows || [])) {
        teamIdByName[t.name] = t.id
        teamNameById[t.id] = t.name
      }

      const matchIdByKey = {}
      for (const m of (matchRows || [])) {
        const home = teamNameById[m.home_team_id]
        const away = teamNameById[m.away_team_id]
        if (home && away) matchIdByKey[`${home}|${away}`] = m.id
      }

      // Upsert group predictions
      if (Object.keys(groupBatch).length > 0) {
        const upsertRows = []
        for (const [key, score] of Object.entries(groupBatch)) {
          const matchId = matchIdByKey[key]
          if (!matchId) continue
          upsertRows.push({
            user_id: uid,
            match_id: matchId,
            predicted_home_score: score.home,
            predicted_away_score: score.away,
          })
        }
        if (upsertRows.length > 0) {
          const { error } = await supabase
            .from('predictions')
            .upsert(upsertRows, { onConflict: 'user_id,match_id' })
          if (error) throw error
        }
      }

      // Upsert knockout predictions — delete cleared picks (null), upsert real picks
      if (Object.keys(koBatch).length > 0) {
        const upsertRows = []
        const deleteKeys = [] // { round, slot } pairs to delete

        for (const [compositeKey, teamName] of Object.entries(koBatch)) {
          const [round, slot] = compositeKey.split('|')
          if (!teamName) {
            // User cleared this pick — remove the DB row so it never loads back
            deleteKeys.push({ round, slot })
          } else {
            const teamId = teamIdByName[teamName]
            if (teamId) {
              upsertRows.push({ user_id: uid, round, slot, team_id: teamId })
            }
          }
        }

        if (upsertRows.length > 0) {
          const { error } = await supabase
            .from('knockout_predictions')
            .upsert(upsertRows, { onConflict: 'user_id,round,slot' })
          if (error) throw error
        }

        // Delete cleared picks one by one (Supabase doesn't support multi-condition OR deletes easily)
        for (const { round, slot } of deleteKeys) {
          await supabase
            .from('knockout_predictions')
            .delete()
            .eq('user_id', uid)
            .eq('round', round)
            .eq('slot', slot)
        }
      }

      setSaveStatus('saved')
    } catch (err) {
      console.error('Save error:', err)
      setSaveStatus('error')
    }
  }

  // ── SCORE UPDATE ────────────────────────────────────────────────────────────
  const updateScore = useCallback((key, side, rawValue) => {
    const parsed = rawValue === '' ? '' : Math.max(0, Math.min(99, parseInt(rawValue, 10) || 0))
    setScores(prev => {
      const existing = prev[key] || { home: '', away: '' }
      return { ...prev, [key]: { ...existing, [side]: parsed } }
    })
    pendingGroupSaves.current[key] = {
      ...(pendingGroupSaves.current[key] || { home: 0, away: 0 }),
      [side]: parsed === '' ? 0 : parsed,
    }
    triggerSave()
  }, [triggerSave])

  // ── KNOCKOUT PICK UPDATE (with downstream cascade) ──────────────────────────
  const updateKnockoutPick = useCallback((round, slot, teamName) => {
    setKnockoutPicks(prev => {
      if (teamName) {
        // Simple set — no cascade needed when picking a team
        const next = { ...prev, [`${round}|${slot}`]: teamName }
        pendingKOSaves.current[`${round}|${slot}`] = teamName
        return next
      } else {
        // Clearing a pick — cascade null all downstream slots that carried
        // the same team forward. Returns a new picks map.
        const next = cascadeClearPicks(prev, round, slot)
        // Queue every slot that changed (now null) for save/delete
        for (const [key, val] of Object.entries(next)) {
          if (val === null && prev[key] !== null && prev[key] !== undefined) {
            pendingKOSaves.current[key] = null
          }
        }
        // Also queue the primary slot even if prev was already null (defensive)
        pendingKOSaves.current[`${round}|${slot}`] = null
        return next
      }
    })
    triggerSave()
  }, [triggerSave])

  return {
    scores,
    knockoutPicks,
    loadStatus,
    saveStatus,
    updateScore,
    updateKnockoutPick,
  }
}
