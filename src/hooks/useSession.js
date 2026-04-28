// useSession.js
// Manages user session for both paid and unpaid (preview) users.
// Session stored in sessionStorage (cleared on tab close).
//
// status values:
//   'loading'  — checking stored session
//   'authed'   — user exists, paid=true  → full access
//   'preview'  — user exists, paid=false → read-only preview
//   'unauthed' — no session at all       → must enter email/username

import { useState, useEffect, useCallback } from 'react'

export const SESSION_KEY = 'wc_user'

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function writeSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function useSession() {
  const [user,   setUser]   = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    async function init() {
      const stored = readSession()
      if (!stored?.userId) {
        setStatus('unauthed')
        return
      }

      // Re-verify with server to get fresh paid status
      try {
        const res  = await fetch(`http://localhost:3001/api/check-access?user_id=${encodeURIComponent(stored.userId)}`)
        const data = await res.json()

        if (data.userId) {
          const u = { userId: data.userId, email: data.email, username: data.username, paid: data.paid }
          writeSession(u)
          setUser(u)
          setStatus(data.paid ? 'authed' : 'preview')
        } else {
          // User not found in DB — clear stale session
          clearSession()
          setStatus('unauthed')
        }
      } catch {
        // Network error — trust stored session rather than kicking user out
        setUser(stored)
        setStatus(stored.paid ? 'authed' : 'preview')
      }
    }
    init()
  }, [])

  // Call after create-or-load-user or verify-session
  const login = useCallback((userData) => {
    writeSession(userData)
    setUser(userData)
    setStatus(userData.paid ? 'authed' : 'preview')
  }, [])

  // Upgrade preview → authed after payment confirmed
  const markPaid = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, paid: true }
      writeSession(updated)
      return updated
    })
    setStatus('authed')
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setStatus('unauthed')
  }, [])

  return { user, status, login, markPaid, logout }
}
