"use client"

import { useMemo } from "react"
import type { NodeInput } from "../lib/figma-types"
import styles from "./css/section-cta.module.css"

// Helper function to find top-level sections (typically frames)
function getTopLevelFrames(nodes: NodeInput[] | null): NodeInput[] {
  if (!nodes) return []
  // Return nodes that are frames or have a position and size
  return nodes.filter((n) => n.type === "FRAME" || (n.absoluteBoundingBox && n.absoluteBoundingBox.width > 0))
}

export default function SectionDropdown(props: {
  rawRoots: NodeInput[] | null
  selectedId: string
  setSelectedId: (id: string) => void
}) {
  const { rawRoots, selectedId, setSelectedId } = props
  const sections = useMemo(() => getTopLevelFrames(rawRoots), [rawRoots])

  if (!sections || sections.length === 0) {
    return null // Don't show if there are no sections
  }

  return (
    <div className={styles.wrapper}>
      <select
        value={selectedId || ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className={styles.select}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundPosition: "right 0.5rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1em",
        }}
      >
        <option value="">Home Page</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name || section.id}
          </option>
        ))}
      </select>
      <div className={styles.chevron} />
    </div>
  )
}
