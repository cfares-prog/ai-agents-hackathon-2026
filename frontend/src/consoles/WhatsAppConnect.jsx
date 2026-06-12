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
            One dispatch Ai Agent number. Supervisors scan the QR or message the bot directly —
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
            <h3>{status?.configured ? 'Backend needs a restart' : 'Bot not configured yet'}</h3>
            {status?.configured ? (
              <p>
                Your <code>.env</code> has Meta credentials, but the <strong>running server</strong>{' '}
                has not loaded them yet (or is missing <code>META_WHATSAPP_NUMBER</code>).
                Stop and run <code>npm start</code> again in the <code>backend</code> folder, then
                refresh this tab.
              </p>
            ) : (
              <p>
                Set <code>META_PHONE_ID</code>, <code>META_TOKEN</code>, and{' '}
                <code>META_WHATSAPP_NUMBER</code> in backend <code>.env</code>, then restart the
                backend.
              </p>
            )}
            {status?.configured && !status?.connected && (
              <p className={styles.error}>
                {status.phoneLookupError || 'Restart the backend if you just updated .env.'}
              </p>
            )}
            {!status?.configured && (
              <p className={styles.colHint}>
                The running server does not see Meta credentials yet — save <code>.env</code> and
                restart <code>npm start</code> in the backend folder.
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
            {!status?.lastWebhookAt && (
              <div className={styles.error} style={{ marginBottom: 12 }}>
                Meta has not delivered any webhook to this server yet. If you are running locally,
                expose port 5000 with ngrok and set the callback URL in Meta Developer Console to{' '}
                <code>https://YOUR-NGROK-URL/api/whatsapp/webhook</code> (verify token ={' '}
                <code>WEBHOOK_VERIFY_TOKEN</code> in .env). Also add your supervisor phone as a
                Meta test recipient.
              </div>
            )}
            {status?.lastWebhookAt && (
              <div className={styles.success} style={{ marginBottom: 12 }}>
                Last webhook received: {new Date(status.lastWebhookAt).toLocaleString()}
                {status.lastWebhookSummary?.from
                  ? ` · from +${status.lastWebhookSummary.from}`
                  : ''}
              </div>
            )}
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
              Opens WhatsApp with a pre-filled emergency message to the Ai Agent.
            </p>
          </div>

          <div className={styles.identitySecondary}>
            <h4>Bot WhatsApp number</h4>
            <p className={styles.colHint} style={{ marginBottom: 10 }}>
              Supervisors can also save this number and message it directly in WhatsApp.
            </p>
            <div className={styles.success}>
              Ai Agent number: <strong>{formatPhone(botNumber)}</strong>
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
          <>
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
            <div style={{ marginTop: 16 }}>
              <h4>Example messages supervisors can send</h4>
              <p className={styles.colHint}>
                Short or vague text is OK — the AI introduces itself, asks follow-ups, and creates
                the request. Arabic replies in Arabic.
              </p>
              <ul className={styles.colHint} style={{ lineHeight: 1.7 }}>
                <li><strong>English:</strong> Hi · We need help · Water is out · 60 families, no food · Medical emergency</li>
                <li><strong>Arabic:</strong> مرحبا · نحتاج مساعدة · ما في مي · عائلات جديدة بدون طعام · حالة طبية عاجلة</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
