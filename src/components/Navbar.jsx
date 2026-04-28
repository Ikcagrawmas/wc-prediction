import { Link, useLocation } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { pathname } = useLocation()
  const isPredictions  = pathname.includes('/predictions')
  const isLeaderboard  = pathname.includes('/leaderboard')
  const isAdmin        = pathname.includes('/admin')

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/wc" className={styles.brand}>
          <span className={styles.wp}>WARGACKI</span>
          <span className={styles.performance}>PERFORMANCE</span>
        </Link>

        <div className={styles.navRight}>
          {/* Leaderboard always visible */}
          <Link
            to="/wc/leaderboard"
            className={`${styles.leaderboardLink} ${isLeaderboard ? styles.active : ''}`}
          >
            Leaderboard
          </Link>

          {isPredictions && (
            <Link to="/wc" className={styles.backLink}>← Home</Link>
          )}

          {isAdmin && (
            <Link to="/wc" className={styles.backLink}>← Home</Link>
          )}

          {!isPredictions && !isAdmin && !isLeaderboard && (
            <a href="#join" className={styles.cta}>
              Enter Challenge — $50
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
