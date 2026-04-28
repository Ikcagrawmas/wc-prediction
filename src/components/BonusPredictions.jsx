import { TEAMS } from '../engine/tournamentData'
import styles from './BonusPredictions.module.css'

// Sorted team list for dropdowns
const TEAM_OPTIONS = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name))

function TeamSelect({ id, label, value, onChange, isLocked, hint }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {hint && <p className={styles.hint}>{hint}</p>}
      <select
        id={id}
        className={`${styles.select} ${isLocked ? styles.locked : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={isLocked}
      >
        <option value="">— Select a team —</option>
        {TEAM_OPTIONS.map(t => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function BonusPredictions({ bonus, onUpdate, isLocked, saveStatus }) {
  const statusMsgs = {
    saving:  { text: 'Saving…',  cls: styles.statusSaving },
    saved:   { text: 'Saved ✓',  cls: styles.statusSaved  },
    unsaved: { text: 'Unsaved…', cls: styles.statusUnsaved },
    error:   { text: 'Save error — check connection', cls: styles.statusError },
  }
  const statusMsg = statusMsgs[saveStatus] || statusMsgs.saved

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>BONUS PREDICTIONS</p>
          <h2 className={styles.title}>Tournament Stat Picks</h2>
          <p className={styles.subtitle}>
            Earn bonus points for calling tournament-wide outcomes.
            These lock at first kickoff like all other predictions.
          </p>
        </div>
        <div className={`${styles.saveStatus} ${statusMsg.cls}`}>
          {statusMsg.text}
        </div>
      </div>

      <div className={styles.grid}>
        {/* Golden Boot */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="golden-boot">
            ⚽ Golden Boot — Top Scorer
          </label>
          <p className={styles.hint}>
            Which player will score the most goals in the tournament?
          </p>
          <input
            id="golden-boot"
            type="text"
            className={`${styles.textInput} ${isLocked ? styles.locked : ''}`}
            value={bonus.golden_boot_player}
            onChange={e => onUpdate('golden_boot_player', e.target.value)}
            placeholder="e.g. Kylian Mbappé"
            disabled={isLocked}
            maxLength={80}
            autoComplete="off"
          />
        </div>

        {/* Yellow Cards */}
        <TeamSelect
          id="yellow-cards"
          label="🟨 Most Yellow Cards"
          hint="Which team will collect the most yellow cards?"
          value={bonus.most_yellow_cards_team}
          onChange={v => onUpdate('most_yellow_cards_team', v)}
          isLocked={isLocked}
        />

        {/* Red Cards */}
        <TeamSelect
          id="red-cards"
          label="🟥 Most Red Cards"
          hint="Which team will receive the most red cards?"
          value={bonus.most_red_cards_team}
          onChange={v => onUpdate('most_red_cards_team', v)}
          isLocked={isLocked}
        />

        {/* Clean Sheets */}
        <TeamSelect
          id="clean-sheets"
          label="🧤 Most Clean Sheets"
          hint="Which team will keep the most clean sheets?"
          value={bonus.most_clean_sheets_team}
          onChange={v => onUpdate('most_clean_sheets_team', v)}
          isLocked={isLocked}
        />
      </div>

      {isLocked && (
        <div className={styles.lockedBanner}>
          🔒 Tournament has started — bonus predictions are locked.
        </div>
      )}
    </div>
  )
}
