import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

const problems = [
  {
    icon: '💥',
    title: 'War & mass displacement',
    text: 'Israel’s war on Lebanon forced hundreds of thousands to flee the south. Families abandoned homes under bombardment and crowded into Beirut, the north, and informal settlements with little notice.',
  },
  {
    icon: '📵',
    title: 'Communication breakdown',
    text: 'Damaged towers, power cuts, and overloaded networks make it hard for displaced supervisors to reach NGOs. Messages get lost in chaotic group chats when every minute counts.',
  },
  {
    icon: '🏕️',
    title: 'Overwhelmed refugee camps',
    text: 'Sudden influxes strain water, medicine, shelter, and food supplies. Camps lack a shared queue — duplicate aid arrives at one site while another waits in silence.',
  },
]

const capabilities = [
  {
    icon: '💬',
    tag: 'Zero-install intake',
    title: 'WhatsApp Bot Integration',
    text: 'Camp supervisors report emergencies from any phone using the app they already have. A Baileys-powered daemon listens 24/7 — no new apps, no training.',
  },
  {
    icon: '🧠',
    tag: 'GPT-powered triage',
    title: 'AI Urgency Scoring',
    text: 'Every message is parsed and scored 1–10 by an AI triage engine, with a keyword fallback when connectivity to the model fails. Insulin shortage ≠ blanket request.',
  },
  {
    icon: '🎯',
    tag: 'Specialty matching',
    title: 'Smart NGO Routing',
    text: 'Requests are auto-assigned to NGOs by resource specialty — medical, water, food, shelter — with round-robin balancing so no organization is overloaded.',
  },
  {
    icon: '📡',
    tag: 'Full lifecycle',
    title: 'Live Dispatch Tracking',
    text: 'From pending to routed, acknowledged and fulfilled — every request is trackable in real time by supervisors, NGOs, and system admins.',
  },
]

const flow = [
  { step: '01', title: 'Report', text: '"We need insulin and water urgently" — sent via WhatsApp from a registered supervisor number.' },
  { step: '02', title: 'AI Triage', text: 'The message is analyzed, needs are extracted, urgency scored 1–10.' },
  { step: '03', title: 'Route', text: 'The allocator matches needs against NGO specialties and assigns the task.' },
  { step: '04', title: 'Acknowledge', text: 'The NGO confirms it has taken ownership of the request.' },
  { step: '05', title: 'Fulfill', text: 'Aid is delivered, the loop closes, and the record is archived.' },
]

export default function Landing() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.kicker}>AI Agents Hackathon 2026 · Life in Lebanon</p>
        <h1 className={styles.title}>
          Emergency aid dispatch,<br />
          <span className={styles.gradientText}>triaged by AI in seconds.</span>
        </h1>
        <p className={styles.subtitle}>
          CedarRelief connects displacement camp supervisors to specialized NGOs
          through a WhatsApp-first reporting pipeline — built for families uprooted
          by war, struggling to coordinate relief from Beirut, the north, and
          overcrowded camps across Lebanon.
        </p>
        <div className={styles.heroActions}>
          <Link to="/console" className={styles.primaryBtn}>Open the Control Center →</Link>
          <a href="#why-lebanon" className={styles.ghostBtn}>Why Lebanon needs this</a>
        </div>
        <div className={styles.heroStats}>
          <div><strong>1–10</strong><span>AI urgency scale</span></div>
          <div><strong>&lt; 5s</strong><span>triage + routing</span></div>
          <div><strong>0</strong><span>apps to install</span></div>
        </div>
      </section>

      <section className={styles.section} id="why-lebanon">
        <h2 className={styles.sectionTitle}>Why Lebanon needs this</h2>
        <p className={styles.sectionLead}>
          Israel’s war on Lebanon displaced entire communities from the south toward
          Beirut and the north. People arrived in unfamiliar cities and hastily built
          camps with broken phones, patchy signal, and no single line to the NGOs
          that could help. CedarRelief closes that gap — one WhatsApp message, one
          shared dispatch queue, one auditable path from crisis to delivery.
        </p>
        <div className={styles.grid3}>
          {problems.map((p) => (
            <article key={p.title} className={styles.problemCard}>
              <span className={styles.problemIcon}>{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Core capabilities</h2>
        <p className={styles.sectionLead}>
          A complete dispatch pipeline, built for low-connectivity field conditions.
        </p>
        <div className={styles.grid4}>
          {capabilities.map((c) => (
            <article key={c.title} className={styles.capCard}>
              <div className={styles.capHead}>
                <span className={styles.capIcon}>{c.icon}</span>
                <span className={styles.capTag}>{c.tag}</span>
              </div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <h2 className={styles.sectionTitle}>The dispatch flow</h2>
        <p className={styles.sectionLead}>
          From a supervisor's WhatsApp message to delivered aid — five auditable steps.
        </p>
        <div className={styles.flow}>
          {flow.map((f, i) => (
            <div key={f.step} className={styles.flowItem}>
              <div className={styles.flowCard}>
                <span className={styles.flowStep}>{f.step}</span>
                <h4>{f.title}</h4>
                <p>{f.text}</p>
              </div>
              {i < flow.length - 1 && <span className={styles.flowArrow}>→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Try the full pipeline, end to end.</h2>
        <p>
          Link the WhatsApp bot, send a real emergency report from a supervisor phone,
          watch the AI triage it, and dispatch NGOs from the interactive Control Center.
        </p>
        <Link to="/console" className={styles.primaryBtn}>Launch Control Center →</Link>
      </section>

      <footer className={styles.footer}>
        <span>CedarRelief · AI Agents Hackathon 2026</span>
        <span>Built for Life in Lebanon 🇱🇧</span>
      </footer>
    </main>
  )
}
