import { useEffect, useState } from 'react'
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
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getSetupInfo()
        .then((d) => { if (!cancelled) { setSetup(d); setError(null) } })
        .catch((e) => { if (!cancelled) setError(e.message) })
    load()
    const t = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Control Center</h1>
        <p>
          One interactive test suite for the full dispatch pipeline — submit, triage,
          route, acknowledge, fulfill.
        </p>
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
        {tab === 'supervisor' && <SupervisorConsole setup={setup} />}
        {tab === 'whatsapp' && <WhatsAppConnect setup={setup} />}
        {tab === 'ngo' && <NgoConsole setup={setup} />}
        {tab === 'admin' && <AdminConsole setup={setup} />}
      </div>
    </main>
  )
}
