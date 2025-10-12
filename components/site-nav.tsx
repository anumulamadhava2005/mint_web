import Link from "next/link"
import styles from "./css/site-nav.module.css"
// Fallback Button if ui/button does not exist
function Button({ children, className = "", variant, asChild, ...props }: any) {
  const classes = [styles.button, variant === "ghost" ? styles.buttonGhost : styles.buttonPrimary, className]
    .filter(Boolean)
    .join(" ");
  if (asChild) return children;
  return <button className={classes} {...props}>{children}</button>;
}

export function SiteNav() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <span
            aria-hidden
            className={styles.logo}
          >
            {/* simple brand mark */}
            <svg viewBox="0 0 24 24" className={styles.logoSvg} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h16M12 4v16" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.brandText}>FigmaFlow</span>
          <span className={styles.srOnly}>FigmaFlow Home</span>
        </Link>

        <div className={styles.actions}>
          <Button variant="ghost" asChild>
            <Link href="/api/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/api/auth/login">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
