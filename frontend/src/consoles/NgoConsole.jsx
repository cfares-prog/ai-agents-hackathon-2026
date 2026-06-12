import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { getNgoRequests, acknowledgeRequest, fulfillRequest } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

const STATUSES = ['routed', 'acknowledged', 'fulfilled', 'pending']

export default function NgoConsole({ setup, active = true }) {
  const ngos = setup?.ngos || []
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('routed')
  const [requests, setRequests] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const activeNgo = ngos.find((n) => n.apiKey === apiKey)

  const refresh = useCallback(() => {
    if (!apiKey) {
      setRequests([])
      return
    }
    setLoading(true)
    getNgoRequests(apiKey, status)
      .then((d) => { setRequests(d.requests || []); setError(null) })
      .catch((e) => { setError(e.message); setRequests([]) })
      .finally(() => setLoading(false))
  }, [apiKey, status])

  useEffect(() => {
    if (!active) return
    refresh()
  }, [active, refresh])

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
            Enter your organization&apos;s API key, or pick a seeded NGO below.
            Queue loads when you open this tab or change filters.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>NGO API key</label>
            <input
              className={styles.input}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="e.g. ngo_rwb_demo_key"
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
          <div className={styles.tableToolbar}>
            <h3 className={styles.colTitle} style={{ margin: 0 }}>
              Task Queue {loading && <small style={{ color: 'var(--text-dim)' }}>· loading…</small>}
            </h3>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={refresh}
              disabled={!apiKey || loading}
            >
              ↻ Refresh
            </button>
          </div>
          <p className={styles.colHint}>
            Sorted by urgency. Switch status tabs or refresh to load the latest tasks.
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
          ) : loading && requests.length === 0 ? (
            <div className={styles.empty}>Loading queue…</div>
          ) : requests.length === 0 ? (
            <div className={styles.empty}>
              No &quot;{status}&quot; requests right now. Check another status tab or refresh.
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
