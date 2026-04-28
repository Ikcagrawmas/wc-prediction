import styles from './SaveStatusBar.module.css'

const MESSAGES = {
  saving: { text: 'Saving…', icon: '⟳', cls: 'saving' },
  saved:  { text: 'Predictions saved. You can edit them until kickoff.', icon: '✓', cls: 'saved' },
  unsaved:{ text: 'Unsaved changes…', icon: '●', cls: 'unsaved' },
  error:  { text: 'Save failed — check connection', icon: '!', cls: 'error' },
}

export default function SaveStatusBar({ status, isLocked }) {
  if (isLocked) {
    return (
      <div className={`${styles.bar} ${styles.locked}`}>
        <span className={styles.icon}>🔒</span>
        <span className={styles.text}>Tournament has started. Predictions are locked.</span>
      </div>
    )
  }

  const msg = MESSAGES[status] || MESSAGES.saved
  return (
    <div className={`${styles.bar} ${styles[msg.cls]}`}>
      <span className={`${styles.icon} ${status === 'saving' ? styles.spin : ''}`}>
        {msg.icon}
      </span>
      <span className={styles.text}>{msg.text}</span>
    </div>
  )
}
