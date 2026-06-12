import { useCallback, useEffect, useState } from 'react'
import styles from './Console.module.css'
import { getSetupInfo } from '../api/client.js'
import SupervisorConsole from '../consoles/SupervisorConsole.jsx'
import WhatsAppConnect from '../consoles/WhatsAppConnect.jsx'
import NgoConsole from '../consoles/NgoConsole.jsx'
import AdminConsole from '../consoles/AdminConsole.jsx'

const TABS = [
  { id: 'supervisor', icon: '🏕️', label: 'Camp Supervisor' },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp Link' },
  { id: 'ngo', icon: '🚑', label: 'NGO Dispatch' },
  { id: 'admin', icon: '🛰️', label: 'Admin / Health' },
]

export default function Console() {
  const [tab, setTab] = useState('supervisor')
  const [setup, setSetup] = useState(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadSetup = useCallback(() => {
    setSetupLoading(true)
    return getSetupInfo()
      .then((d) => { setSetup(d); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setSetupLoading(false))
  }, [])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1>Control Center</h1>
            <p>
              One interactive test suite for the full dispatch pipeline — triage,
              route, acknowledge, fulfill.
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshHeaderBtn}
            onClick={loadSetup}
            disabled={setupLoading}
          >
            {setupLoading ? 'Loading…' : '↻ Reload setup'}
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          Backend unreachable: {error}. Make sure the server is running on port 5000
          and the database is seeded (<code>npm run seed</code>).
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {tab === 'supervisor' && (
          <SupervisorConsole setup={setup} active={tab === 'supervisor'} />
        )}
        {tab === 'whatsapp' && (
          <WhatsAppConnect setup={setup} active={tab === 'whatsapp'} />
        )}
        {tab === 'ngo' && (
          <NgoConsole setup={setup} active={tab === 'ngo'} />
        )}
        {tab === 'admin' && (
          <AdminConsole setup={setup} active={tab === 'admin'} />
        )}
      </div>
    </main>
  )
}
