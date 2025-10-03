"use client"

import { motion } from "framer-motion"
import styles from "./css/hero.module.css"
// Fallback Button if ui/button does not exist
function Button({ children, className = "", ...props }: any) {
  return <button className={`${styles.button} ${className}`} {...props}>{children}</button>;
}
import Link from "next/link"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 22 } },
}

const words = ["Turn", "Figma", "designs", "into", "clean,", "production", "code"]

export function Hero() {
  return (
    <section className={styles.section}>
      {/* decorative orbs without gradients; using borders + opacity to stay on brand tokens */}
      <div aria-hidden className={styles.orbs}>
        <div className={`${styles.orb} ${styles.orbA}`} />
        <div className={`${styles.orb} ${styles.orbB}`} />
        <div className={`${styles.orb} ${styles.orbC}`} />
      </div>

      <div className={styles.container}>
        <motion.div variants={container} initial="hidden" animate="show" className={styles.centerText}>
          <motion.div
            variants={item}
            className={styles.badge}
          >
            <span className={styles.badgeDot} />
            Built for modern teams
          </motion.div>

          <h1 className={styles.title}>
            <span className={styles.srOnly}>{"Turn Figma designs into clean, production code"}</span>
            <motion.span variants={container} className="inline-block">
              {words.map((w, i) => (
                <motion.span key={i} variants={item} className={styles.titleWord}>
                  {w}
                </motion.span>
              ))}
            </motion.span>
          </h1>

          <motion.p
            variants={item}
            className={styles.desc}
          >
            Transform entire files in seconds while preserving layout, spacing, and semantics. Opinionated, accessible,
            and production-ready.
          </motion.p>

          <motion.div variants={item} className={styles.ctaRow}>
            <Button size="lg" asChild>
              <Link href="/api/auth/login">Get started</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="#features">See features</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* floating badges */}
        <div className={styles.badgesGrid}>
          {[
            { label: "Precise Output" },
            { label: "Multiple Formats" },
            { label: "Accessible by Default" },
            { label: "Fast Conversion" },
          ].map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 220, damping: 20 }}
              className={styles.badgeCard}
            >
              {b.label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
