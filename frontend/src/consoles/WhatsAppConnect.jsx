import { useEffect, useState } from 'react'
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

export default function WhatsAppConnect({ setup }) {
  const camps = setup?.camps || []
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [manualBotNumber, setManualBotNumber] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getWhatsappStatus()
        .then((s) => { if (!cancelled) { setStatus(s); setError(null) } })
        .catch((e) => { if (!cancelled) setError(e.message) })
    load()
    const t = setInterval(load, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  useEffect(() => {
    if (status?.phoneNumber && !manualBotNumber) {
      setManualBotNumber(status.phoneNumber)
    }
  }, [status?.phoneNumber, manualBotNumber])

  const botNumber = status?.phoneNumber || manualBotNumber.replace(/\D/g, '')
  const botContact = botContactUrl(botNumber)

  return (
    <div>
      <h3 className={styles.colTitle}>WhatsApp Gateway</h3>
      <p className={styles.colHint}>
        Link a WhatsApp account to act as the dispatch bot. Camp supervisors then text
        that number directly from their own phones — no extra app required.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {status?.connected ? (
        <>
          <div className={styles.qrCard}>
            <div>
              <h3>
                <span className={styles.dotOk} style={{ display: 'inline-block', marginRight: 8 }} />
                WhatsApp linked — bot is live
              </h3>
              <p>
                The dispatch bot is connected and listening. Any registered supervisor who
                texts the linked number gets an instant AI-triaged response with a ticket
                reference, and the request appears across all consoles.
              </p>
            </div>
          </div>

          {botContact && (
            <div className={styles.identitySection}>
              <div className={styles.identityPrimary}>
                <h4>Scan to message the dispatch bot</h4>
                <p className={styles.colHint} style={{ marginBottom: 12 }}>
                  Supervisors can scan this QR to open WhatsApp and start chatting with the bot.
                </p>
                <div className={styles.qrBox} style={{ display: 'inline-block' }}>
                  <QRCode value={botContact} size={200} bgColor="#ffffff" fgColor="#04130a" />
                </div>
                <p className={styles.colHint} style={{ marginTop: 12 }}>
                  Opens WhatsApp with a pre-filled emergency message.
                </p>
              </div>

              <div className={styles.identitySecondary}>
                <h4>Or use the number manually</h4>
                <p className={styles.colHint} style={{ marginBottom: 10 }}>
                  Save or dial this number in WhatsApp if you cannot scan the QR code.
                </p>
                <div className={styles.manualNumberRow}>
                  <input
                    className={styles.input}
                    value={manualBotNumber}
                    onChange={(e) => setManualBotNumber(e.target.value)}
                    placeholder="Bot WhatsApp number"
                    inputMode="tel"
                  />
                </div>
                {botNumber && (
                  <div className={styles.success} style={{ marginTop: 12 }}>
                    Bot number: <strong>{formatPhone(botNumber)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : status?.qr ? (
        <div className={styles.qrCard}>
          <div className={styles.qrBox}>
            <QRCode value={status.qr} size={240} bgColor="#ffffff" fgColor="#04130a" />
          </div>
          <div>
            <h3>Scan to link the dispatch bot</h3>
            <p>
              Use the phone whose WhatsApp number will receive emergency reports.
            </p>
            <ol>
              <li>Open WhatsApp on that phone</li>
              <li>Go to <strong>Settings → Linked Devices → Link a Device</strong></li>
              <li>Scan this code — it rotates every ~60s and refreshes here automatically</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          {status?.loggedOut
            ? 'The previous WhatsApp session was logged out. Delete backend/logs/whatsapp_auth_session and restart the backend to generate a new pairing QR.'
            : 'Waiting for the WhatsApp daemon to generate a pairing QR…'}
        </div>
      )}

      <div className={styles.listCard} style={{ marginTop: 22 }}>
        <h3>📞 Numbers authorized to text the bot</h3>
        <p className={styles.colHint} style={{ marginBottom: 10 }}>
          Only registered camp supervisors are accepted — messages from other numbers are ignored.
        </p>
        <div className={styles.campQrGrid}>
          {camps.map((c) => (
            <div key={c.id} className={styles.campQrCardStatic}>
              <div className={styles.campQrBox}>
                <QRCode
                  value={c.supervisorWhatsappNumber}
                  size={72}
                  bgColor="#ffffff"
                  fgColor="#04130a"
                />
              </div>
              <div>
                <strong>{c.supervisorName}</strong>
                <br />
                <span>{c.location}</span>
                <br />
                <span className={styles.reqId}>{formatPhone(c.supervisorWhatsappNumber)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
