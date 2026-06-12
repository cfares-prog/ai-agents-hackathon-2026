import { useCallback, useEffect, useState } from 'react'
import styles from './Consoles.module.css'
import { ADMIN_KEY, fetchWhatsappPairingQr, getHealth, getNgoRequests, getWhatsappStatus } from '../api/client.js'
import { StatusBadge, UrgencyMeter } from './StatusBits.jsx'

const ALL_STATUSES = ['pending', 'routed', 'acknowledged', 'fulfilled']

export default function AdminConsole({ setup }) {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [wa, setWa] = useState(null)
  const [pairingQrSrc, setPairingQrSrc] = useState(null)
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)

  const refreshHealth = useCallback(async () => {
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
      if (!status.connected) {
        const qrSrc = await fetchWhatsappPairingQr()
        setPairingQrSrc(qrSrc)
      } else {
        setPairingQrSrc(null)
      }
    } catch {
      setWa(null)
      setPairingQrSrc(null)
    }
  }, [])

  const refreshFeed = useCallback(() => {
    setFeedLoading(true)
    Promise.all(
      ALL_STATUSES.map((s) =>
        getNgoRequests(ADMIN_KEY, s)
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
  }, [])

  useEffect(() => {
    refreshHealth()
    refreshFeed()
    const t1 = setInterval(refreshHealth, 5000)
    const t2 = setInterval(refreshFeed, 7000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [refreshHealth, refreshFeed])

  const counts = ALL_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: feed.filter((r) => r.status === s).length }),
    {},
  )

  return (
    <div>
      <h3 className={styles.colTitle}>System Health</h3>
      <p className={styles.colHint}>Polled every 5 seconds from <code>/health</code>.</p>

      <div className={styles.healthRow}>
        <div className={styles.healthCard}>
          <h4>API Server</h4>
          <div className={styles.healthValue}>
            <span className={health ? styles.dotOk : styles.dotBad} />
            {health ? 'online' : 'offline'}
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
          <h4>WhatsApp Daemon</h4>
          <div className={styles.healthValue}>
            <span className={health?.whatsapp === 'connected' ? styles.dotOk : styles.dotBad} />
            {health?.whatsapp || 'unknown'}
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

      {health?.whatsapp !== 'connected' && (
        <div className={styles.qrCard}>
          {pairingQrSrc ? (
            <>
              <div className={styles.qrBox}>
                <img src={pairingQrSrc} alt="WhatsApp pairing QR code" width={196} height={196} />
              </div>
              <div>
                <h3>Link a WhatsApp account</h3>
                <p>
                  This number becomes the dispatch bot — camp supervisors text it directly
                  from their own WhatsApp.
                </p>
                <ol>
                  <li>Open WhatsApp on the phone you want to use as the bot</li>
                  <li>Go to <strong>Settings → Linked Devices → Link a Device</strong></li>
                  <li>Scan this code from <code>/qr</code> (refreshes automatically)</li>
                </ol>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>
              {wa?.loggedOut
                ? 'WhatsApp session was logged out. Delete backend/logs/whatsapp_auth_session and restart the server to generate a new pairing QR.'
                : 'Waiting for the WhatsApp daemon to generate a pairing QR…'}
            </p>
          )}
        </div>
      )}

      <div className={styles.adminGrid}>
        <div className={styles.listCard}>
          <h3>🏕️ Registered Camps ({setup?.camps?.length ?? 0})</h3>
          {(setup?.camps || []).map((c) => (
            <div key={c.id} className={styles.entityRow}>
              <div>
                {c.location}
                <br />
                <span>{c.supervisorName} · +{c.supervisorWhatsappNumber}</span>
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

      <h3 className={styles.colTitle}>
        Live Request Feed {feedLoading && <small style={{ color: 'var(--text-dim)' }}>· refreshing…</small>}
      </h3>
      <p className={styles.colHint}>
        All requests across every status, sorted by urgency —{' '}
        {ALL_STATUSES.map((s) => `${counts[s]} ${s}`).join(' · ')}
      </p>

      {feed.length === 0 ? (
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
