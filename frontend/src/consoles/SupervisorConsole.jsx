import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { submitReport, getCampReports } from '../api/client.js'
import { StatusBadge, UrgencyMeter, ProgressSteps } from './StatusBits.jsx'

const NEED_OPTIONS = ['water', 'food', 'medical', 'shelter', 'general_relief']

export default function SupervisorConsole({ setup }) {
  const camps = setup?.camps || []
  const [campId, setCampId] = useState('')
  const [description, setDescription] = useState('')
  const [needs, setNeeds] = useState(['water'])
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [requests, setRequests] = useState([])
  const [loadingLog, setLoadingLog] = useState(false)

  useEffect(() => {
    if (!campId && camps.length > 0) setCampId(camps[0].id)
  }, [camps, campId])

  const refreshLog = useCallback(() => {
    if (!campId) return
    setLoadingLog(true)
    getCampReports(campId)
      .then((d) => setRequests(d.requests || []))
      .catch(() => setRequests([]))
      .finally(() => setLoadingLog(false))
  }, [campId])

  useEffect(() => {
    refreshLog()
    const t = setInterval(refreshLog, 6000)
    return () => clearInterval(t)
  }, [refreshLog])

  const toggleNeed = (n) =>
    setNeeds((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n])

  const onSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setSubmitting(true)
    try {
      const res = await submitReport(campId, description, needs)
      setFeedback({
        ok: true,
        text: `Request ${res.requestId} triaged with urgency ${res.urgencyScore}/10 — status: ${res.status}.`,
      })
      setDescription('')
      refreshLog()
    } catch (err) {
      setFeedback({ ok: false, text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCamp = camps.find((c) => c.id === campId)

  return (
    <div className={styles.split}>
      <div>
        <h3 className={styles.colTitle}>Submit Emergency Request</h3>
        <p className={styles.colHint}>
          Webform intake — the same pipeline used when WhatsApp is unavailable.
        </p>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Camp</label>
            <select className={styles.select} value={campId} onChange={(e) => setCampId(e.target.value)}>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>{c.location}</option>
              ))}
            </select>
            {selectedCamp && (
              <small style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Supervisor: {selectedCamp.supervisorName} · {selectedCamp.supervisorPhone}
              </small>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Issue description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              maxLength={2000}
              required
              placeholder="Describe the emergency (min 10 characters)… e.g. Generator failed and the medical fridge is down, insulin spoiling fast."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Needs</label>
            <div className={styles.checks}>
              {NEED_OPTIONS.map((n) => (
                <label key={n} className={needs.includes(n) ? styles.checkOn : styles.check}>
                  <input
                    type="checkbox"
                    checked={needs.includes(n)}
                    onChange={() => toggleNeed(n)}
                  />
                  {n.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>

          <button className={styles.submitBtn} disabled={submitting || !campId || needs.length === 0}>
            {submitting ? 'Triaging…' : 'Submit & Triage'}
          </button>
        </form>

        {feedback && (
          <div className={feedback.ok ? styles.success : styles.error}>{feedback.text}</div>
        )}
      </div>

      <div>
        <h3 className={styles.colTitle}>
          Request History {loadingLog && <small style={{ color: 'var(--text-dim)' }}>· refreshing…</small>}
        </h3>
        <p className={styles.colHint}>
          Last 30 days for {selectedCamp?.location || 'selected camp'} — live progress, auto-refreshes every 6s.
        </p>

        {requests.length === 0 ? (
          <div className={styles.empty}>
            No requests yet. Submit one on the left, or fire a WhatsApp simulation —
            it will appear here instantly.
          </div>
        ) : (
          <div className={styles.cardList}>
            {requests.map((r) => (
              <article key={r.requestId} className={styles.reqCard}>
                <div className={styles.reqTop}>
                  <StatusBadge status={r.status} />
                  <UrgencyMeter score={r.urgencyScore} />
                </div>
                <p className={styles.reqSummary}>{r.summary || r.issueDescription}</p>
                <div className={styles.reqMeta}>
                  <span className={styles.reqId}>{r.requestId}</span>
                  <span>· {r.source}</span>
                  {r.assignedNgo && <span>· → {r.assignedNgo}</span>}
                  <span>· {new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <ProgressSteps status={r.status} />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
