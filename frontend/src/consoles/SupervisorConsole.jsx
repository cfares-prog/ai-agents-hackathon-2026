import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { getCampReports } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

export default function SupervisorConsole({ setup }) {
  const camps = setup?.camps || []
  const [campId, setCampId] = useState('')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!campId && camps.length > 0) setCampId(camps[0].id)
  }, [camps, campId])

  const refreshLog = useCallback(() => {
    if (!campId) return
    setLoading(true)
    getCampReports(campId)
      .then((d) => { setRequests(d.requests || []); setError(null) })
      .catch((e) => { setError(e.message); setRequests([]) })
      .finally(() => setLoading(false))
  }, [campId])

  useEffect(() => {
    refreshLog()
    const t = setInterval(refreshLog, 6000)
    return () => clearInterval(t)
  }, [refreshLog])

  const selectedCamp = camps.find((c) => c.id === campId)

  return (
    <div>
      <h3 className={styles.colTitle}>My Emergency Requests</h3>
      <p className={styles.colHint}>
        Reports submitted by this camp supervisor via WhatsApp appear here automatically.
        Use WhatsApp on your registered number — no web submission needed.
      </p>

      <div className={styles.field} style={{ maxWidth: 420, marginBottom: 20 }}>
        <label className={styles.label}>Camp supervisor</label>
        <select className={styles.select} value={campId} onChange={(e) => setCampId(e.target.value)}>
          {camps.map((c) => (
            <option key={c.id} value={c.id}>{c.location} — {c.supervisorName}</option>
          ))}
        </select>
        {selectedCamp && (
          <small style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            WhatsApp: +{selectedCamp.supervisorWhatsappNumber}
          </small>
        )}
      </div>

      {error && <div className={styles.error} style={{ marginBottom: 16 }}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Summary</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Needs</th>
              <th>Source</th>
              <th>Assigned NGO</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.tableEmpty}>Loading requests…</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.tableEmpty}>
                  No requests yet for {selectedCamp?.location || 'this camp'}.
                  Send an emergency report from WhatsApp using the registered supervisor number.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.requestId}>
                  <td><span className={styles.reqId}>{r.requestId}</span></td>
                  <td className={styles.tableSummary}>{r.summary || r.issueDescription}</td>
                  <td><UrgencyMeter score={r.urgencyScore} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{(r.needsList || []).join(', ') || '—'}</td>
                  <td>{r.source}</td>
                  <td>{r.assignedNgo || '—'}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && requests.length > 0 && (
        <p className={styles.refreshNote}>Refreshing…</p>
      )}
    </div>
  )
}
