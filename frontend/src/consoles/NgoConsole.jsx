import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { getNgoRequests, acknowledgeRequest, fulfillRequest } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

const STATUSES = ['routed', 'acknowledged', 'fulfilled', 'pending']

export default function NgoConsole({ setup }) {
  const ngos = setup?.ngos || []
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('routed')
  const [requests, setRequests] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const activeNgo = ngos.find((n) => n.apiKey === apiKey)

  const refresh = useCallback(() => {
    if (!apiKey) return
    setLoading(true)
    getNgoRequests(apiKey, status)
      .then((d) => { setRequests(d.requests || []); setError(null) })
      .catch((e) => { setError(e.message); setRequests([]) })
      .finally(() => setLoading(false))
  }, [apiKey, status])

  useEffect(() => {
    refresh()
    if (!apiKey) return
    const t = setInterval(refresh, 6000)
    return () => clearInterval(t)
  }, [refresh, apiKey])

  const act = async (fn, requestId) => {
    setBusyId(requestId)
    try {
      await fn(apiKey, requestId)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className={styles.split}>
        <div>
          <h3 className={styles.colTitle}>NGO Authentication</h3>
          <p className={styles.colHint}>
            Enter your organization's API key, or pick a seeded NGO below.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>NGO API key</label>
            <input
              className={styles.input}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="e.g. ngo_lrc_key"
            />
          </div>

          <div className={styles.keyChips}>
            {ngos.map((n) => (
              <button key={n.apiKey} type="button" className={styles.keyChip} onClick={() => setApiKey(n.apiKey)}>
                {n.apiKey}
              </button>
            ))}
          </div>

          {activeNgo && (
            <div className={styles.success}>
              Authenticated as <strong>{activeNgo.ngoName}</strong> · specialties:{' '}
              {activeNgo.resourceSpecialties.join(', ')}
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div>
          <h3 className={styles.colTitle}>
            Task Queue {loading && <small style={{ color: 'var(--text-dim)' }}>· refreshing…</small>}
          </h3>
          <p className={styles.colHint}>
            Sorted by urgency, auto-refreshes every 6s. Acknowledge new tasks, then mark them fulfilled.
          </p>

          <div className={styles.statusTabs}>
            {STATUSES.map((s) => (
              <button
                key={s}
                className={s === status ? styles.statusTabActive : styles.statusTab}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {!apiKey ? (
            <div className={styles.empty}>Enter an NGO API key to load the dispatch queue.</div>
          ) : requests.length === 0 ? (
            <div className={styles.empty}>
              No "{status}" requests right now. Submit one from the Supervisor portal
              or the WhatsApp simulator.
            </div>
          ) : (
            <div className={styles.cardList}>
              {requests.map((r) => (
                <article key={r.requestId} className={styles.reqCard}>
                  <div className={styles.reqTop}>
                    <StatusBadge status={status} />
                    <UrgencyMeter score={r.urgencyScore} />
                  </div>
                  <p className={styles.reqSummary}>{r.summary}</p>
                  <div className={styles.reqMeta}>
                    <span className={styles.reqId}>{r.requestId}</span>
                    <span>· 📍 {r.campLocation}</span>
                    <span>· needs: {(r.needsList || []).join(', ')}</span>
                  </div>
                  <div className={styles.reqActions}>
                    {status === 'routed' && (
                      <button
                        className={styles.smallBtn}
                        disabled={busyId === r.requestId}
                        onClick={() => act(acknowledgeRequest, r.requestId)}
                      >
                        {busyId === r.requestId ? 'Working…' : '✓ Acknowledge'}
                      </button>
                    )}
                    {(status === 'acknowledged' || status === 'routed') && (
                      <button
                        className={styles.dangerBtn}
                        disabled={busyId === r.requestId}
                        onClick={() => act(fulfillRequest, r.requestId)}
                      >
                        {busyId === r.requestId ? 'Working…' : '🚚 Mark Fulfilled'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
