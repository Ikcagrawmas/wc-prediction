import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcPrizePool, formatCurrency } from '../lib/prizePool'
import styles from './PrizePool.module.css'

export default function PrizePool() {
  const [data, setData] = useState(calcPrizePool(0))
  const [loading, setLoading] = useState(true)
  const [animating, setAnimating] = useState(false)

  async function fetchPaidCount() {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('paid', true)
      if (!error && count !== null) {
        setData(calcPrizePool(count))
      }
    } catch {
      // Use example data if Supabase not connected
      setData(calcPrizePool(0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaidCount()
    const interval = setInterval(fetchPaidCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Animate on data change
  useEffect(() => {
    setAnimating(true)
    const t = setTimeout(() => setAnimating(false), 600)
    return () => clearTimeout(t)
  }, [data.paidUsers])

  const rows = [
    { label: 'Paid Entries', value: `${data.paidUsers}`, sub: 'at $50/entry', accent: false },
    { label: 'Total Pot', value: formatCurrency(data.totalPot), sub: 'gross entry pool', accent: false },
    { label: 'Host Fee (10%)', value: formatCurrency(data.hostFee), sub: 'platform & admin', accent: false },
    { label: 'Prize Pool', value: formatCurrency(data.prizePool), sub: '90% back to players', accent: true },
    { label: '🥇 1st Place', value: formatCurrency(data.first), sub: '65% of prize pool', accent: true },
    { label: '🥈 2nd Place', value: formatCurrency(data.second), sub: '25% of prize pool', accent: false },
    { label: '🥉 3rd Place', value: formatCurrency(data.third), sub: '10% of prize pool', accent: false },
  ]

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>LIVE PRIZE POOL</p>
          <h2 className={styles.title}>
            The More Players That Join,<br />
            <em>The Bigger the Payouts</em>
          </h2>
          <div className={styles.divider} />
          <p className={styles.subtitle}>
            Goal is 50+ players, but the challenge will run with the active paid prize pool
            once entries lock at first whistle.
          </p>
        </div>

        <div className={`${styles.board} ${animating ? styles.flash : ''}`}>
          <div className={styles.boardHeader}>
            <div className={styles.liveTag}>
              <span className={styles.liveDot} />
              LIVE
            </div>
            <span className={styles.boardTitle}>Prize Breakdown</span>
            {loading && <span className={styles.updating}>Updating…</span>}
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`${styles.row} ${row.accent ? styles.accentRow : ''} ${i === 3 ? styles.totalRow : ''}`}
            >
              <div className={styles.rowLabel}>
                <span className={styles.labelText}>{row.label}</span>
                <span className={styles.labelSub}>{row.sub}</span>
              </div>
              <div className={`${styles.rowValue} ${row.accent ? styles.accentValue : ''}`}>
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <p className={styles.note}>
          Prize pool grows with every new paid entry. All values update in real time.
        </p>
      </div>
    </section>
  )
}
