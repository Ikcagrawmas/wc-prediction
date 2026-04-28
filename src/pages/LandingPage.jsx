import PrizePool from '../components/PrizePool'
import JoinForm from '../components/JoinForm'
import styles from './LandingPage.module.css'

const HOW_IT_WORKS = [
  { number: '01', title: 'Preview Free',     desc: 'Enter your email and username to explore the full prediction system at no cost.' },
  { number: '02', title: 'Pay $50 to Lock In', desc: 'One entry, one shot. Payment secures your official entry and prediction record.' },
  { number: '03', title: 'Predict Every Match', desc: 'Score predictions for all group stage games. Watch your group standings calculate in real time.' },
  { number: '04', title: 'Build Your Bracket', desc: 'Your group predictions generate your knockout bracket. Pick winners all the way to the final.' },
  { number: '05', title: 'Lock at Kickoff',  desc: 'All predictions lock the moment the first whistle blows. Then the tournament does the talking.' },
  { number: '06', title: 'Collect Winnings', desc: 'Top 3 on the leaderboard split 90% of the prize pool.' },
]

export default function LandingPage() {
  return (
    <main className={styles.page}>

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        {/* Real image as full bleed background */}
        <div className={styles.heroBgImg} />

        {/* Darkening + vignette overlays */}
        <div className={styles.heroOverlay} />
        <div className={styles.heroVignette} />

        {/* Subtle animated particles layer (CSS only) */}
        <div className={styles.heroParticles} />

        <div className={styles.heroContent}>

          {/* Brand */}
          <div className={styles.brandLockup}>
            <p className={styles.brandName}>WARGACKI</p>
            <div className={styles.brandRule}>
              <span className={styles.brandRuleLine} />
              <span className={styles.brandRuleText}>PERFORMANCE</span>
              <span className={styles.brandRuleLine} />
            </div>
          </div>

          {/* Title — dominant focal point */}
          <h1 className={styles.heroTitle}>
            <span className={styles.heroLine1}>WORLD CUP</span>
            <div className={styles.heroSubRow}>
              <span className={styles.heroSubLine} />
              <span className={styles.heroLine2}>PREDICTION CHALLENGE</span>
              <span className={styles.heroSubLine} />
            </div>
          </h1>

          {/* Single clean tagline */}
          <p className={styles.heroTagline}>
            One tournament. One champion.
          </p>

          {/* CTAs — clear and centered */}
          <div className={styles.heroCtaRow}>
            <a href="#join" className={styles.heroCta}>
              Enter the Challenge
            </a>
            <a href="/wc/leaderboard" className={styles.heroCtaSecondary}>
              Leaderboard →
            </a>
          </div>

          {/* Minimal info line */}
          <p className={styles.heroInfoLine}>
            2026 FIFA World Cup &nbsp;·&nbsp; $50 Entry &nbsp;·&nbsp; Growing Prize Pool
          </p>

        </div>

        {/* Bottom fog fade into next section */}
        <div className={styles.heroFade} />
      </section>

      {/* ─── PRIZE POOL ───────────────────────────────────────────────── */}
      <PrizePool />

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className={styles.howSection}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>THE FORMAT</p>
            <h2 className={styles.sectionTitle}>How the Challenge Works</h2>
            <div className={styles.titleDivider} />
          </div>
          <div className={styles.steps}>
            {HOW_IT_WORKS.map(step => (
              <div key={step.number} className={styles.step}>
                <div className={styles.stepNum}>{step.number}</div>
                <div className={styles.stepBody}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SCORING ──────────────────────────────────────────────────── */}
      <section className={styles.scoringSection}>
        <div className="container">
          <div className={styles.scoringGrid}>
            <div className={styles.scoringText}>
              <p className={styles.eyebrow}>SCORING SYSTEM</p>
              <h2 className={styles.scoringTitle}>
                Points for Precision.<br />
                <em>Rewards for Accuracy.</em>
              </h2>
              <p className={styles.scoringDesc}>
                The closer your prediction to reality, the more points you earn.
                Exact scores unlock the maximum. Knockout picks compound as teams advance deeper.
              </p>
              <div className={styles.scoringBadges}>
                <span className={styles.badge}>Group Stage Scores</span>
                <span className={styles.badge}>Group Standings</span>
                <span className={styles.badge}>Round of 32</span>
                <span className={styles.badge}>Quarterfinals</span>
                <span className={styles.badge}>Semifinals</span>
                <span className={styles.badge}>Final</span>
              </div>
            </div>
            <div className={styles.scoringCard}>
              <div className={styles.cardEyebrow}>How Points Work</div>
              {[
                ['Exact Score',                    '+5 pts', 'gold'],
                ['Correct Result + Goal Difference','+4 pts', 'green'],
                ['Correct Result',                  '+3 pts', 'yellow'],
                ['One Score Correct',               '+1 pt',  'gray'],
                ['Round of 32 Pick',                '+3 pts', 'dim'],
                ['Quarterfinal Pick',               '+5 pts', 'dim'],
                ['Semifinal Pick',                  '+8 pts', 'dim'],
                ['Champion',                        '+15 pts','gold'],
              ].map(([label, pts, tone]) => (
                <div key={label} className={`${styles.scoreRow} ${styles[`scoreRow_${tone}`]}`}>
                  <span className={styles.scoreLabel}>{label}</span>
                  <span className={`${styles.scorePts} ${styles[`pts_${tone}`]}`}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── JOIN FORM ────────────────────────────────────────────────── */}
      <section className={styles.joinSection} id="join">
        <div className={styles.joinContainer}>
          <div className={styles.joinLeft}>
            <p className={styles.eyebrow}>JOIN THE CHALLENGE</p>
            <h2 className={styles.joinTitle}>
              Secure Your Spot.<br />
              <em>Before Kickoff.</em>
            </h2>
            <p className={styles.joinDesc}>
              Preview is free. Enter your details, explore the system,
              then pay $50 inside to lock in your official entry.
              Once the first whistle blows, entries close permanently.
            </p>
            <div className={styles.joinStats}>
              <div className={styles.joinStat}>
                <span className={styles.joinStatVal}>$50</span>
                <span className={styles.joinStatLabel}>Entry Fee</span>
              </div>
              <div className={styles.joinStatDivider} />
              <div className={styles.joinStat}>
                <span className={styles.joinStatVal}>50+</span>
                <span className={styles.joinStatLabel}>Target Players</span>
              </div>
              <div className={styles.joinStatDivider} />
              <div className={styles.joinStat}>
                <span className={styles.joinStatVal}>90%</span>
                <span className={styles.joinStatLabel}>Back to Players</span>
              </div>
            </div>
          </div>
          <div className={styles.joinRight}>
            <div className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <span className={styles.formCardTitle}>GET STARTED — FREE</span>
                <span className={styles.formCardSub}>Preview free · Pay $50 inside to enter</span>
              </div>
              <JoinForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <span className={styles.footerWP}>WARGACKI PERFORMANCE</span>
              <span className={styles.footerTagline}>World Cup Prediction Challenge · 2026</span>
            </div>
            <div className={styles.footerLinks}>
              <a href="/wc/leaderboard" className={styles.footerLink}>Leaderboard</a>
              <a href="https://wargackiperformance.com" className={styles.footerLink} target="_blank" rel="noopener noreferrer">
                wargackiperformance.com
              </a>
            </div>
          </div>
          <div className={styles.footerNote}>
            Challenge entry fees are non-refundable after the first kickoff.
            By entering, you agree to the challenge rules. This is a skill-based prediction contest.
          </div>
        </div>
      </footer>
    </main>
  )
}
