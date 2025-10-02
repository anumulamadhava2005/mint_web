"use client"

import { useMemo } from "react"
import type { NodeInput } from "../lib/figma-types"

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
    <div className="relative">
      <select
        value={selectedId || ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full text-left rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground appearance-none cursor-pointer hover:bg-muted/80 pr-8 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
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
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}
