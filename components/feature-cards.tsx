"use client"

import { motion } from "framer-motion"
import styles from "./css/feature-cards.module.css"


const features = [
  {
    title: "Fast Conversion",
    body: "Process full files in seconds without compromising fidelity.",
    icon: (
      <svg className={styles.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Precise Output",
    body: "Preserves spacing, typography, and accessibility out of the box.",
    icon: (
      <svg className={styles.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    title: "Multiple Formats",
    body: "Export to React and HTML with clean, modern patterns.",
    icon: (
      <svg className={styles.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="7" height="7" rx="1" />
        <rect x="14" y="4" width="7" height="7" rx="1" />
        <rect x="3" y="15" width="7" height="7" rx="1" />
        <rect x="14" y="15" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

export function FeatureCards() {
  return (
    <div id="features" className={styles.grid}>
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 250, damping: 20 }}
          whileHover={{ y: -4, scale: 1.01 }}
        >
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.icon}>
                {f.icon}
              </div>
              <div className={styles.title}>{f.title}</div>
            </div>
            <div className={styles.body}>{f.body}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
