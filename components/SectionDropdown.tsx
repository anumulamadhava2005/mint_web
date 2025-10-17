"use client"

import { useMemo } from "react"
import React from "react"
import styles from "./css/SectionDropdown.module.css"

type NodeInput = {
  id: string
  name?: string
  type?: string
  absoluteBoundingBox?: { width?: number; height?: number }
  children?: NodeInput[]
}

// Helper function to find top-level sections (typically frames)
function getTopLevelFrames(nodes: NodeInput[] | null): NodeInput[] {
  if (!nodes) return []
  return nodes.filter((n) => n.type === "FRAME" || (n.absoluteBoundingBox && n.absoluteBoundingBox.width! > 0))
}

export default function SectionDropdown(props: {
  rawRoots: NodeInput[] | null
  selectedId: string
  setSelectedId: (id: string) => void
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const { rawRoots, selectedId, setSelectedId, setSelectedIds } = props
  const sections = useMemo(() => getTopLevelFrames(rawRoots), [rawRoots])

  if (!sections || sections.length === 0) {
    return null
  }

  const handleFrameSelect = (frameId: string) => {
    setSelectedId(frameId)
    // Also select the frame in the layers panel
    if (frameId) {
      setSelectedIds(new Set([frameId]))
    } else {
      setSelectedIds(new Set())
    }
  }

  return (
    <div className={styles.wrapper}>
      <select
        value={selectedId || ""}
        onChange={(e) => handleFrameSelect(e.target.value)}
        className={styles.select}
      >
        <option value="">Home Page</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name || section.id}
          </option>
        ))}
      </select>
      <div className={styles.chevron}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <polyline points="6 8 10 12 14 8"></polyline>
        </svg>
      </div>
    </div>
  )
}
