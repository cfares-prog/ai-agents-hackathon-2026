import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { ADMIN_KEY, getHealth, getNgoRequests, getWhatsappStatus } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

const ALL_STATUSES = ['pending', 'routed', 'acknowledged', 'fulfilled']

export default function AdminConsole({ setup, active = true }) {
  const adminKey = setup?.adminApiKey || ADMIN_KEY
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [wa, setWa] = useState(null)
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const h = await getHealth()
      setHealth(h)
      setHealthError(null)
    } catch (e) {
      setHealth(null)
      setHealthError(e.message)
    }

    try {
      const status = await getWhatsappStatus()
      setWa(status)
    } catch {
      setWa(null)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const refreshFeed = useCallback(() => {
    setFeedLoading(true)
    Promise.all(
      ALL_STATUSES.map((s) =>
        getNgoRequests(adminKey, s)
          .then((d) => (d.requests || []).map((r) => ({ ...r, status: s })))
          .catch(() => []),
      ),
    )
      .then((groups) => {
        const merged = groups.flat()
        merged.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0))
        setFeed(merged)
      })
      .finally(() => setFeedLoading(false))
  }, [adminKey])

  const refreshAll = useCallback(() => {
    refreshHealth()
    refreshFeed()
  }, [refreshHealth, refreshFeed])

  useEffect(() => {
    if (!active) return
    refreshAll()
  }, [active, refreshAll])

  const counts = ALL_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: feed.filter((r) => r.status === s).length }),
    {},
  )

  const metaConfigured = health?.metaCloudApi === 'configured'
  const whatsappConnected = wa?.connected === true

  return (
    <div>
      <div className={styles.tableToolbar}>
        <div>
          <h3 className={styles.colTitle} style={{ marginBottom: 4 }}>System Health</h3>
          <p className={styles.colHint} style={{ margin: 0 }}>
            Loads when you open this tab — no background polling.
          </p>
        </div>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={refreshAll}
          disabled={healthLoading || feedLoading}
        >
          {healthLoading || feedLoading ? 'Loading…' : '↻ Refresh all'}
        </button>
      </div>

      <div className={styles.healthRow}>
        <div className={styles.healthCard}>
          <h4>API Server</h4>
          <div className={styles.healthValue}>
            <span className={health ? styles.dotOk : styles.dotBad} />
            {health ? 'online' : healthLoading ? 'checking…' : 'offline'}
          </div>
        </div>
        <div className={styles.healthCard}>
          <h4>MongoDB</h4>
          <div className={styles.healthValue}>
            <span className={health?.mongodb === 'connected' ? styles.dotOk : styles.dotBad} />
            {health?.mongodb || 'unknown'}
          </div>
        </div>
        <div className={styles.healthCard}>
          <h4>Meta WhatsApp API</h4>
          <div className={styles.healthValue}>
            <span className={metaConfigured ? styles.dotOk : styles.dotBad} />
            {health ? (metaConfigured ? 'configured' : 'missing credentials') : 'unknown'}
          </div>
        </div>
        <div className={styles.healthCard}>
          <h4>Dispatch bot</h4>
          <div className={styles.healthValue}>
            <span className={whatsappConnected ? styles.dotOk : styles.dotBad} />
            {wa
              ? whatsappConnected
                ? `live · +${wa.phoneNumber}`
                : metaConfigured
                  ? 'missing Ai Agent number'
                  : 'not configured'
              : 'unknown'}
          </div>
        </div>
        <div className={styles.healthCard}>
          <h4>Uptime</h4>
          <div className={styles.healthValue}>
            {health ? `${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s` : '—'}
          </div>
        </div>
      </div>

      {healthError && <div className={styles.error} style={{ marginBottom: 20 }}>{healthError}</div>}

      {!whatsappConnected && (
        <div className={styles.qrCard}>
          <div>
            <h3>WhatsApp Ai Agent setup</h3>
            <p>
              The Ai Agent runs on Meta Cloud API — no device pairing QR. Add{' '}
              <code>META_PHONE_ID</code>, <code>META_TOKEN</code>, and{' '}
              <code>META_WHATSAPP_NUMBER</code> to backend <code>.env</code>, then use the{' '}
              <strong>WhatsApp Link</strong> tab for the single supervisor contact QR.
            </p>
            {wa?.authorizedSupervisors?.length > 0 && (
              <p className={styles.colHint}>
                {wa.authorizedSupervisors.length} supervisor numbers are registered and will be
                accepted when the Ai Agent is live.
              </p>
            )}
          </div>
        </div>
      )}

      <div className={styles.adminGrid}>
        <div className={styles.listCard}>
          <h3>🏕️ Registered Camps ({setup?.camps?.length ?? 0})</h3>
          {(setup?.camps || []).map((c) => (
            <div key={c.id} className={styles.entityRow}>
              <div>
                {c.name || c.location}
                <br />
                <span>
                  {c.region}
                  {c.whatsappEnabled ? ` · +${c.supervisorWhatsappNumber}` : ' · no WhatsApp supervisor'}
                </span>
              </div>
              <span className={styles.reqId}>{c.id}</span>
            </div>
          ))}
        </div>

        <div className={styles.listCard}>
          <h3>🚑 Registered NGOs ({setup?.ngos?.length ?? 0})</h3>
          {(setup?.ngos || []).map((n) => (
            <div key={n.ngoId} className={styles.entityRow}>
              <div>
                {n.ngoName}
                <br />
                <span>specialties: {n.resourceSpecialties.join(', ')}</span>
              </div>
              <span className={styles.reqId}>{n.apiKey}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.tableToolbar} style={{ marginTop: 24 }}>
        <h3 className={styles.colTitle} style={{ margin: 0 }}>
          Live Request Feed {feedLoading && <small style={{ color: 'var(--text-dim)' }}>· loading…</small>}
        </h3>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={refreshFeed}
          disabled={feedLoading}
        >
          ↻ Refresh feed
        </button>
      </div>
      <p className={styles.colHint}>
        All requests across every status, sorted by urgency —{' '}
        {ALL_STATUSES.map((s) => `${counts[s]} ${s}`).join(' · ')}
      </p>

      {feedLoading && feed.length === 0 ? (
        <div className={styles.empty}>Loading request feed…</div>
      ) : feed.length === 0 ? (
        <div className={styles.empty}>
          No requests in the system yet. Generate some from the other consoles.
        </div>
      ) : (
        <div className={styles.cardList}>
          {feed.map((r) => (
            <article key={r.requestId} className={styles.reqCard}>
              <div className={styles.reqTop}>
                <StatusBadge status={r.status} />
                <UrgencyMeter score={r.urgencyScore} />
              </div>
              <p className={styles.reqSummary}>{r.summary}</p>
              <div className={styles.reqMeta}>
                <span className={styles.reqId}>{r.requestId}</span>
                <span>· 📍 {r.campLocation}</span>
                <span>· needs: {(r.needsList || []).join(', ')}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
