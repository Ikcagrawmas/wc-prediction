// useBonusPredictions.js
// Manages golden boot + team stat bonus predictions.
// Uses upsert on bonus_predictions with user_id as unique key (one row per user).

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = {
  golden_boot_player: '',
  most_yellow_cards_team: '',
  most_red_cards_team: '',
  most_clean_sheets_team: '',
}

export function useBonusPredictions(userId) {
  const [bonus, setBonus] = useState(EMPTY)
  const [bonusLoadStatus, setBonusLoadStatus]   = useState('idle')
  const [bonusSaveStatus, setBonusSaveStatus]   = useState('saved')

  const pending = useRef({})
  const timerRef = useRef(null)
  const userId_ = useRef(userId)
  userId_.current = userId

  // ── LOAD ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    setBonusLoadStatus('loading')

    async function load() {
      try {
        const { data, error } = await supabase
          .from('bonus_predictions')
          .select('golden_boot_player, most_yellow_cards_team, most_red_cards_team, most_clean_sheets_team')
          .eq('user_id', userId)
          .single()

        if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

        if (data) {
          setBonus({
            golden_boot_player:       data.golden_boot_player       || '',
            most_yellow_cards_team:   data.most_yellow_cards_team   || '',
            most_red_cards_team:      data.most_red_cards_team      || '',
            most_clean_sheets_team:   data.most_clean_sheets_team   || '',
          })
        }
        setBonusLoadStatus('loaded')
        setBonusSaveStatus('saved')
      } catch (err) {
        console.error('Bonus load error:', err)
        setBonusLoadStatus('error')
      }
    }

    load()
  }, [userId])

  // ── DEBOUNCED SAVE ────────────────────────────────────────────────────────
  const triggerBonusSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setBonusSaveStatus('unsaved')
    timerRef.current = setTimeout(flushBonusSave, 800)
  }, [])

  async function flushBonusSave() {
    const uid = userId_.current
    if (!uid) return

    const patch = { ...pending.current }
    pending.current = {}

    if (Object.keys(patch).length === 0) {
      setBonusSaveStatus('saved')
      return
    }

    setBonusSaveStatus('saving')
    try {
      const { error } = await supabase
        .from('bonus_predictions')
        .upsert(
          { user_id: uid, ...patch, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      setBonusSaveStatus('saved')
    } catch (err) {
      console.error('Bonus save error:', err)
      setBonusSaveStatus('error')
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const updateBonus = useCallback((field, value) => {
    setBonus(prev => ({ ...prev, [field]: value }))
    pending.current[field] = value
    triggerBonusSave()
  }, [triggerBonusSave])

  return { bonus, bonusLoadStatus, bonusSaveStatus, updateBonus }
}
