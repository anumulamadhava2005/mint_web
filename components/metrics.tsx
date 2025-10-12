"use client"

import { useEffect, useState } from "react"
import styles from "./css/metrics.module.css"

function useCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3)))) // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export function Metrics() {
  const a = useCounter(1200)
  const b = useCounter(48)
  const c = useCounter(99)

  return (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <div className={styles.value}>{a.toLocaleString()}</div>
        <p className={styles.label}>Components Generated</p>
      </div>
      <div className={styles.cell}>
        <div className={styles.value}>{b}x</div>
        <p className={styles.label}>Faster than Manual</p>
      </div>
      <div className={styles.cell}>
        <div className={styles.value}>{c}%</div>
        <p className={styles.label}>Design Fidelity</p>
      </div>
    </div>
  )
}
