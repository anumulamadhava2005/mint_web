import styles from "./css/site-footer.module.css"

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>© 2025 FigmaFlow. All rights reserved.</p>
        <nav className={styles.links}>
          <a href="#" className={styles.link}>
            Privacy Policy
          </a>
          <a href="#" className={styles.link}>
            Terms of Service
          </a>
          <a href="#" className={styles.link}>
            Documentation
          </a>
        </nav>
      </div>
    </footer>
  )
}
