import { useState } from 'react'
import styles from './PaymentBanner.module.css'

export default function PaymentBanner({ user }) {
  const [loading,  setLoading]  = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handlePay() {
    if (!user?.email || !user?.username) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res  = await fetch('http://localhost:3001/api/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: user.email, username: user.username }),
      })
      const data = await res.json()

      if (!res.ok) { setErrorMsg(data.error || 'Could not start checkout.'); setLoading(false); return }
      if (data.alreadyPaid) { window.location.reload(); return }
      if (data.url) { window.location.href = data.url; return }

      setErrorMsg('Unexpected response. Please try again.')
      setLoading(false)
    } catch (err) {
      setErrorMsg('Could not reach payment server. Check your connection.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <span className={styles.icon}>🔒</span>
        <div className={styles.text}>
          <span className={styles.headline}>Preview mode — predictions are not saved</span>
          <span className={styles.sub}>
            Pay $50 to unlock full access and lock in your entry before kickoff.
          </span>
        </div>
      </div>
      <div className={styles.right}>
        {errorMsg && <span className={styles.err}>{errorMsg}</span>}
        <button
          className={styles.payBtn}
          onClick={handlePay}
          disabled={loading}
        >
          {loading ? 'Opening checkout…' : 'Pay $50 to Enter →'}
        </button>
      </div>
    </div>
  )
}
