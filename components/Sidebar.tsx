"use client"

import type React from "react"
import { useState } from "react"
import LayersPanel from "./LayersPanel"
import SectionDropdown from "./SectionDropdown"
import type { NodeInput } from "../lib/figma-types"

export default function Sidebar(props: {
  rawRoots: NodeInput[] | null
  setRawRoots: React.Dispatch<React.SetStateAction<NodeInput[] | null>>
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedFrameId: string
  setSelectedFrameId: React.Dispatch<React.SetStateAction<string>>
}) {
  const { rawRoots, setRawRoots, selectedIds, setSelectedIds, selectedFrameId, setSelectedFrameId } = props
  const [filter, setFilter] = useState("")

  const filteredNodes = (rawRoots ?? []).filter((node) => node.name?.toLowerCase().includes(filter.toLowerCase()))

  return (
    <aside className="w-[240px] flex flex-col min-h-0 overflow-hidden border-4 border-black bg-stone-50 text-black shadow-[8px_8px_0_0_#000]">
      {/* Pages Section Header */}
      <div className="px-3 py-2 border-b-4 border-black bg-red-600 text-white flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider">Pages</span>
      </div>

      {/* Pages Dropdown */}
      <div className="px-3 py-2 border-b-2 border-black/70">
        <SectionDropdown rawRoots={rawRoots} selectedId={selectedFrameId} setSelectedId={setSelectedFrameId} />
      </div>

      {/* Search Section */}

      {/* Layers Heading */}
      <div className="px-3 py-2 flex items-center justify-between border-b-4 border-black bg-amber-400">
        <span className="text-[11px] font-extrabold uppercase tracking-wider">Layers</span>
      </div>

      {/* Layers Panel - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <LayersPanel
          layers={filteredNodes}
          setLayers={(layers) => setRawRoots(layers as any)}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      </div>
    </aside>
  )
}
