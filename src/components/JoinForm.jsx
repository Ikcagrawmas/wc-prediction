import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { writeSession } from '../hooks/useSession'
import styles from './JoinForm.module.css'

const STATES = { IDLE: 'idle', LOADING: 'loading', ERROR: 'error' }

export default function JoinForm() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [username, setUsername] = useState('')
  const [status,   setStatus]   = useState(STATES.IDLE)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(STATES.LOADING)
    setErrorMsg('')

    const cleanEmail    = email.trim().toLowerCase()
    const cleanUsername = username.trim()

    // Client-side validation (matches server)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.')
      return setStatus(STATES.ERROR)
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setErrorMsg('Username must be 3–20 characters.')
      return setStatus(STATES.ERROR)
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMsg('Username may only contain letters, numbers, and underscores.')
      return setStatus(STATES.ERROR)
    }

    try {
      const res  = await fetch('http://localhost:3001/api/create-or-load-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: cleanEmail, username: cleanUsername }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        return setStatus(STATES.ERROR)
      }

      // Store session with paid flag — page will show preview or full access accordingly
      writeSession({
        userId:   data.userId,
        email:    data.email,
        username: data.username,
        paid:     data.paid,
      })

      // Navigate to predictions — access level determined there
      navigate('/wc/predictions')
    } catch (err) {
      console.error('[JoinForm]', err)
      setErrorMsg('Could not reach server. Check your connection and try again.')
      setStatus(STATES.ERROR)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email Address</label>
          <input
            id="email" type="email"
            className={styles.input}
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={status === STATES.LOADING}
            required autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="username">Pick a Username</label>
          <input
            id="username" type="text"
            className={styles.input}
            placeholder="YourName"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={status === STATES.LOADING}
            maxLength={20} required autoComplete="username"
          />
          <span className={styles.fieldHint}>Letters, numbers, underscores only</span>
        </div>
      </div>

      {status === STATES.ERROR && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={status === STATES.LOADING || !email || !username}
      >
        {status === STATES.LOADING ? (
          <span className={styles.loadingDots}><span /><span /><span /></span>
        ) : (
          <>Enter the Challenge <span className={styles.arrow}>→</span></>
        )}
      </button>

      <p className={styles.disclaimer}>
        Preview is free. Pay $50 inside to lock in your entry.
      </p>
    </form>
  )
}
