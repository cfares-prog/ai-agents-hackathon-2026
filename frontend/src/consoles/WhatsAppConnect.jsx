import { useCallback, useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import styles from './Consoles.module.css'
import { getWhatsappStatus } from '../api/client.js'

function formatPhone(number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function botContactUrl(number) {
  const digits = String(number || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent('Emergency report from camp supervisor')}`
}

export default function WhatsAppConnect({ setup, active = true }) {
  const camps = setup?.camps || []
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getWhatsappStatus()
      setStatus(s)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    refresh()
  }, [active, refresh])

  const botNumber = status?.phoneNumber || ''
  const botContact = botContactUrl(botNumber)
  const authorizedCamps = (status?.authorizedSupervisors?.length
    ? status.authorizedSupervisors
    : camps.filter((c) => c.whatsappEnabled)
  ).map((camp) => ({
    id: camp.campId || camp.id,
    name: camp.name,
    region: camp.region || camp.location,
    supervisorName: camp.supervisorName,
    supervisorWhatsappNumber: camp.supervisorWhatsappNumber,
  }))

  return (
    <div>
      <div className={styles.tableToolbar}>
        <div>
          <h3 className={styles.colTitle} style={{ marginBottom: 4 }}>WhatsApp Gateway</h3>
          <p className={styles.colHint} style={{ margin: 0 }}>
            One dispatch bot number. Supervisors scan the QR or message the bot directly —
            only registered numbers in the database are accepted.
          </p>
        </div>
        <button type="button" className={styles.smallBtn} onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh status'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading && !status ? (
        <div className={styles.empty}>Loading WhatsApp status…</div>
      ) : !status?.connected ? (
        <div className={styles.qrCard}>
          <div>
            <h3>Bot not configured yet</h3>
            <p>
              Set <code>META_PHONE_ID</code>, <code>META_TOKEN</code>, and{' '}
              <code>META_WHATSAPP_NUMBER</code> in the backend <code>.env</code>, then restart
              the server. Meta Cloud API handles the bot — no device pairing QR is needed.
            </p>
            {status?.configured && !botNumber && (
              <p className={styles.colHint}>
                Meta credentials are present but the bot phone number could not be resolved.
                Add <code>META_WHATSAPP_NUMBER</code> (digits only, e.g. 961XXXXXXXX).
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.identitySection}>
          <div className={styles.identityPrimary}>
            <h3>
              <span className={styles.dotOk} style={{ display: 'inline-block', marginRight: 8 }} />
              Dispatch bot is live
            </h3>
            <p className={styles.colHint} style={{ marginBottom: 12 }}>
              Scan this QR to open WhatsApp and chat with the AI agent. Only supervisors
              whose numbers appear below can send reports.
            </p>
            {botContact && (
              <div className={styles.qrBox} style={{ display: 'inline-block' }}>
                <QRCode value={botContact} size={220} bgColor="#ffffff" fgColor="#04130a" />
              </div>
            )}
            <p className={styles.colHint} style={{ marginTop: 12 }}>
              Opens WhatsApp with a pre-filled emergency message to the bot.
            </p>
          </div>

          <div className={styles.identitySecondary}>
            <h4>Bot WhatsApp number</h4>
            <p className={styles.colHint} style={{ marginBottom: 10 }}>
              Supervisors can also save this number and message it directly in WhatsApp.
            </p>
            <div className={styles.success}>
              Bot number: <strong>{formatPhone(botNumber)}</strong>
            </div>
            {botContact && (
              <a
                className={styles.smallBtn}
                href={botContact}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', marginTop: 12 }}
              >
                Open in WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <div className={styles.listCard} style={{ marginTop: 22 }}>
        <h3>Numbers authorized to chat with the bot</h3>
        <p className={styles.colHint} style={{ marginBottom: 10 }}>
          Messages from any other number are rejected. Each supervisor is linked to their camp
          in the database.
        </p>
        {authorizedCamps.length === 0 ? (
          <div className={styles.empty}>No supervisor WhatsApp numbers registered yet.</div>
        ) : (
          <div className={styles.campQrGrid}>
            {authorizedCamps.map((camp) => (
              <div key={camp.id} className={styles.campQrCardStatic}>
                <div>
                  <strong>{camp.supervisorName}</strong>
                  <br />
                  <span>{camp.name}</span>
                  <br />
                  <span className={styles.reqId}>{formatPhone(camp.supervisorWhatsappNumber)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
