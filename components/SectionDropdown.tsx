"use client"

import { useMemo } from "react"
import React from "react"

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
    <div className="relative">
      <select
        value={selectedId || ""}
        onChange={(e) => handleFrameSelect(e.target.value)}
        className="w-full appearance-none rounded border border-gray-700 text-gray-300 px-2 py-1 pr-6 text-sm focus:outline-none focus:border-gray-500 transition-colors"
        style={{
          backgroundColor: 'rgb(55,55,55)',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23999' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3E%3Cpolyline points='6 8 10 12 14 8'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.25rem center",
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
    </div>
  )
}
