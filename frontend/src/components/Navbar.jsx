import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <header className={styles.nav}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.logoMark}>▲</span>
        <span>Cedar<b>Relief</b></span>
      </NavLink>
      <nav className={styles.links}>
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : styles.link}>
          Home
        </NavLink>
        <NavLink to="/console" className={({ isActive }) => isActive ? styles.active : styles.link}>
          Control Center
        </NavLink>
        <a
          className={styles.cta}
          href="https://github.com/cfares-prog/ai-agents-hackathon-2026"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  )
}
