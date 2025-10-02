"use client"

import { useEffect, useState } from "react"

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
    <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-3">
      <div className="text-center">
        <div className="text-3xl font-semibold tabular-nums">{a.toLocaleString()}</div>
        <p className="text-sm text-muted-foreground">Components Generated</p>
      </div>
      <div className="text-center">
        <div className="text-3xl font-semibold tabular-nums">{b}x</div>
        <p className="text-sm text-muted-foreground">Faster than Manual</p>
      </div>
      <div className="text-center">
        <div className="text-3xl font-semibold tabular-nums">{c}%</div>
        <p className="text-sm text-muted-foreground">Design Fidelity</p>
      </div>
    </div>
  )
}
