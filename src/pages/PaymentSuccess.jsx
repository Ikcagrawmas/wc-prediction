import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { writeSession } from '../hooks/useSession'
import styles from './PaymentSuccess.module.css'

const MAX_RETRIES    = 5
const RETRY_DELAY_MS = 2500

// In dev the page may load from any origin. Always try the direct Express
// port first, then fall back to the relative /api path (Vite proxy).
// In production both resolve to the same server.
const API_ENDPOINTS = [
  'http://localhost:3001/api/verify-session', // direct Express (works even if Vite port varies)
  '/api/verify-session',                       // relative (Vite proxy, or same-origin in prod)
]

export default function PaymentSuccess() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const [phase, setPhase]     = useState('verifying')
  const [msg, setMsg]         = useState('Verifying your payment…')
  const [detail, setDetail]   = useState('')
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return  // StrictMode double-invoke guard
    didRun.current = true

    const sessionId = params.get('session_id')
    console.log('[PaymentSuccess] session_id:', sessionId)

    if (!sessionId) {
      setMsg('No session ID in URL.')
      setDetail('The payment redirect did not include a session_id parameter.')
      setPhase('error')
      return
    }

    verifyWithRetry(sessionId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function verifyWithRetry(sessionId, attempt = 1) {
    setMsg(attempt === 1
      ? 'Confirming payment with Stripe…'
      : `Confirming payment… (${attempt}/${MAX_RETRIES})`)

    let lastError = null

    // Try each endpoint in order until one returns valid JSON
    for (const endpoint of API_ENDPOINTS) {
      try {
        const url = `${endpoint}?session_id=${encodeURIComponent(sessionId)}`
        console.log(`[PaymentSuccess] fetching ${url}`)

        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        })

        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          // Got HTML (Vite fallback or Express SPA route) — this endpoint didn't work
          console.warn(`[PaymentSuccess] ${endpoint} returned non-JSON (${contentType}) — trying next`)
          lastError = new Error(`Got HTML from ${endpoint}. Proxy may not be running.`)
          continue
        }

        const data = await res.json()
        console.log(`[PaymentSuccess] response from ${endpoint}:`, data)

        if (res.status === 402) {
          // Stripe hasn't confirmed yet — retry whole function
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS)
            return verifyWithRetry(sessionId, attempt + 1)
          }
          setMsg('Payment is taking longer than expected to confirm.')
          setDetail(`Stripe status: ${data.status || 'unknown'}. Your payment may still process — check your email.`)
          setPhase('error')
          return
        }

        if (!res.ok || !data.userId) {
          lastError = new Error(data.error || `Server error ${res.status}`)
          continue
        }

        // ✓ Success — write session with paid=true to upgrade any preview session
        try {
          writeSession({
            userId:   data.userId,
            email:    data.email,
            username: data.username,
            paid:     true,
          })
        } catch { /* sessionStorage blocked (private mode) — continue anyway */ }

        setMsg(`Welcome${data.username ? ', ' + data.username : ''}! Payment confirmed.`)
        setPhase('success')
        setTimeout(() => navigate('/wc/predictions', { replace: true }), 1500)
        return

      } catch (fetchErr) {
        console.warn(`[PaymentSuccess] fetch error from ${endpoint}:`, fetchErr.message)
        lastError = fetchErr
        // Continue to next endpoint
      }
    }

    // All endpoints failed
    if (attempt < MAX_RETRIES) {
      console.log(`[PaymentSuccess] all endpoints failed, retrying in ${RETRY_DELAY_MS}ms`)
      await sleep(RETRY_DELAY_MS)
      return verifyWithRetry(sessionId, attempt + 1)
    }

    setMsg('Could not verify your payment automatically.')
    setDetail(lastError?.message || 'All verification attempts failed.')
    setPhase('error')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {phase === 'verifying' && (
          <>
            <div className={styles.spinner} />
            <p className={styles.msg}>{msg}</p>
            <p className={styles.sub}>Don't close this tab — this takes just a moment.</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.msg}>{msg}</p>
            <p className={styles.sub}>Taking you to your predictions…</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className={styles.errorIcon}>⚠</div>
            <p className={styles.msg}>{msg}</p>
            {detail && <p className={styles.detail}>{detail}</p>}
            <p className={styles.sub}>
              If your payment went through, your entry is safe.{' '}
              Email{' '}
              <a href="mailto:support@wargackiperformance.com" className={styles.link}>
                support@wargackiperformance.com
              </a>{' '}
              and we'll get you in.
            </p>
            <div className={styles.actions}>
              <a href="/wc/predictions" className={styles.btn}>Try Accessing Predictions</a>
              <a href="/wc" className={styles.btnSecondary}>Return to Home</a>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
