import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { getSupervisorDashboard } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

const PAGE_SIZE = 6

const STAT_CARDS = [
  { key: 'total', label: 'Total requests', icon: '📋' },
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'routed', label: 'Routed', icon: '🎯' },
  { key: 'acknowledged', label: 'Acknowledged', icon: '✅' },
  { key: 'fulfilled', label: 'Fulfilled', icon: '🚚' },
]

function DetailDialog({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-dialog-title"
      >
        <div className={styles.modalHeader}>
          <h4 id="detail-dialog-title">{title}</h4>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}

function TruncCell({ text, label, onOpen }) {
  if (!text || text === '—') return '—'

  return (
    <button
      type="button"
      className={styles.truncCell}
      title="Click to view full text"
      onClick={() => onOpen(label, text)}
    >
      {text}
    </button>
  )
}

export default function SupervisorConsole({ setup, active = true }) {
  const supervisorCamps = (setup?.camps || []).filter((c) => c.whatsappEnabled)
  const [campId, setCampId] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!campId && supervisorCamps.length > 0) setCampId(supervisorCamps[0].id)
  }, [supervisorCamps, campId])

  useEffect(() => {
    setPage(1)
  }, [campId])

  const refresh = useCallback(() => {
    if (!campId) return
    setLoading(true)
    getSupervisorDashboard(campId)
      .then((d) => { setDashboard(d); setError(null) })
      .catch((e) => { setError(e.message); setDashboard(null) })
      .finally(() => setLoading(false))
  }, [campId])

  useEffect(() => {
    if (!active || !campId) return
    refresh()
  }, [active, campId, refresh])

  const camp = dashboard?.camp
  const requests = dashboard?.requests || []
  const stats = dashboard?.stats
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRequests = requests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openDetail = (title, content) => setDialog({ title, content })

  return (
    <div>
      <h3 className={styles.colTitle}>My Emergency Requests</h3>
      <p className={styles.colHint}>
        Only registered camp supervisors with a WhatsApp number can report via the AI agent.
        Data loads when you open this tab or switch camps — no background polling.
      </p>

      {supervisorCamps.length === 0 ? (
        <div className={styles.empty}>
          No WhatsApp-authorized supervisors in the database. Run <code>npm run seed</code> in the backend.
        </div>
      ) : (
        <>
          <div className={styles.field} style={{ maxWidth: 520, marginBottom: 20 }}>
            <label className={styles.label}>Camp supervisor</label>
            <select
              className={styles.select}
              value={campId}
              onChange={(e) => setCampId(e.target.value)}
            >
              {supervisorCamps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.supervisorName}
                </option>
              ))}
            </select>
            {camp && (
              <div className={styles.campMetaChip}>
                <span>📍 {camp.region}</span>
                <span>🏕️ {camp.capacity} capacity</span>
                <span>💬 +{camp.supervisorWhatsappNumber}</span>
              </div>
            )}
          </div>

          {camp && stats && (
            <div className={styles.statGrid}>
              {STAT_CARDS.map(({ key, label, icon }) => (
                <div key={key} className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">{icon}</span>
                  <div>
                    <p className={styles.statLabel}>{label}</p>
                    <p className={styles.statValue}>{stats[key] ?? 0}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className={styles.error} style={{ marginBottom: 16 }}>{error}</div>}

          <div className={styles.tableToolbar}>
            <span className={styles.colHint} style={{ margin: 0 }}>
              {requests.length} request{requests.length !== 1 ? 's' : ''}
              {requests.length > 0 && ` · page ${safePage} of ${totalPages}`}
            </span>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Summary</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Needs</th>
                  <th>Assigned NGO</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {loading && requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.tableEmpty}>Loading requests…</td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.tableEmpty}>
                      No WhatsApp requests yet for {camp?.name || 'this camp'}.
                      Text the dispatch bot from +{camp?.supervisorWhatsappNumber}.
                    </td>
                  </tr>
                ) : (
                  pageRequests.map((r) => {
                    const summary = r.summary || r.issueDescription
                    const needs = (r.needsList || []).join(', ') || '—'
                    return (
                      <tr key={r.requestId}>
                        <td>
                          <TruncCell
                            text={r.requestId}
                            label="Ticket ID"
                            onOpen={openDetail}
                          />
                        </td>
                        <td>
                          <TruncCell
                            text={summary}
                            label="Request summary"
                            onOpen={(title, text) => openDetail(title, (
                              <>
                                <p>{text}</p>
                                {r.issueDescription && r.issueDescription !== text && (
                                  <p className={styles.modalSub}>
                                    <strong>Original message:</strong><br />
                                    {r.issueDescription}
                                  </p>
                                )}
                                {r.urgencyReason && (
                                  <p className={styles.modalSub}>
                                    <strong>AI reason:</strong> {r.urgencyReason}
                                  </p>
                                )}
                              </>
                            ))}
                          />
                        </td>
                        <td><UrgencyMeter score={r.urgencyScore} /></td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          <TruncCell text={needs} label="Needs" onOpen={openDetail} />
                        </td>
                        <td>
                          <TruncCell
                            text={r.assignedNgo || '—'}
                            label="Assigned NGO"
                            onOpen={openDetail}
                          />
                        </td>
                        <td>{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {requests.length > PAGE_SIZE && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <DetailDialog
        open={Boolean(dialog)}
        title={dialog?.title || ''}
        onClose={() => setDialog(null)}
      >
        {typeof dialog?.content === 'string' ? <p>{dialog.content}</p> : dialog?.content}
      </DetailDialog>
    </div>
  )
}
