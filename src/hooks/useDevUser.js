// useDevUser.js
// Phase 3 dev override: ensures a test user exists in Supabase and returns their ID.
// Replace this entire hook in Phase 4 with real auth (Supabase Auth or Stripe-gated session).

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEV_EMAIL    = 'dev@wargackiperformance.com'
const DEV_USERNAME = 'DevTester'

export function useDevUser() {
  const [userId, setUserId] = useState(null)
  const [status, setStatus]  = useState('loading') // loading | ready | error

  useEffect(() => {
    async function ensureDevUser() {
      try {
        // Try to find existing dev user
        const { data: existing, error: fetchErr } = await supabase
          .from('users')
          .select('id')
          .eq('email', DEV_EMAIL)
          .single()

        if (!fetchErr && existing) {
          setUserId(existing.id)
          setStatus('ready')
          return
        }

        // Insert dev user if not found
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert({ email: DEV_EMAIL, username: DEV_USERNAME, paid: true })
          .select('id')
          .single()

        if (insertErr) {
          // Could be a race — try fetching again
          const { data: retry } = await supabase
            .from('users')
            .select('id')
            .eq('email', DEV_EMAIL)
            .single()
          if (retry) {
            setUserId(retry.id)
            setStatus('ready')
            return
          }
          throw insertErr
        }

        setUserId(inserted.id)
        setStatus('ready')
      } catch (err) {
        console.error('useDevUser error:', err)
        setStatus('error')
      }
    }

    ensureDevUser()
  }, [])

  return { userId, status }
}
