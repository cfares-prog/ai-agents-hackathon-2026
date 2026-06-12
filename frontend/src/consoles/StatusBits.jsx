import styles from './Consoles.module.css'

const BADGE_CLASS = {
  pending: styles.badgePending,
  routed: styles.badgeRouted,
  acknowledged: styles.badgeAcknowledged,
  fulfilled: styles.badgeFulfilled,
  rejected: styles.badgeRejected,
}

export function StatusBadge({ status }) {
  return <span className={BADGE_CLASS[status] || styles.badge}>{status}</span>
}

export function UrgencyMeter({ score }) {
  if (score == null) return null
  const color = score >= 8 ? '#e84855' : score >= 5 ? '#e8b944' : '#2fbf71'
  return (
    <span className={styles.urgency} title={`Urgency ${score}/10`}>
      <span className={styles.urgencyBar}>
        <span
          className={styles.urgencyFill}
          style={{ width: `${score * 10}%`, background: color }}
        />
      </span>
      <span style={{ color }}>{score}/10</span>
    </span>
  )
}

const STEPS = ['pending', 'routed', 'acknowledged', 'fulfilled']

export function ProgressSteps({ status }) {
  const idx = STEPS.indexOf(status)
  return (
    <div>
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={s} className={styles.step} style={i === STEPS.length - 1 ? { flex: '0 0 auto' } : undefined}>
            <span className={i <= idx ? styles.stepDotDone : styles.stepDot}>
              {i <= idx ? '✓' : i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span className={i < idx ? styles.stepLineDone : styles.stepLine} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.stepLabels}>
        {STEPS.map((s) => <span key={s}>{s}</span>)}
      </div>
    </div>
  )
}
