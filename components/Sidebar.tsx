"use client"

import type React from "react"
import { useState } from "react"
import LayersPanel from "./LayersPanel"
import SectionDropdown from "./SectionDropdown"
import type { NodeInput } from "../lib/figma-types"
<<<<<<< HEAD
=======
import { Menu } from "lucide-react"
>>>>>>> origin/adhish1

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
<<<<<<< HEAD
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
=======
    <aside 
      className="w-[240px] flex flex-col min-h-0 overflow-hidden border-r border-gray-800 -mt-px" 
      style={{ backgroundColor: 'rgb(45,45,45)' }}
    >
      {/* Header with page name */}
      <div 
        className="px-2 py-1.5 border-b border-gray-800 flex items-center gap-2" 
        style={{ backgroundColor: 'rgb(40,40,40)' }}
      >
        <Menu size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-200">
          Desktop
        </span>
      </div>

      {/* FIXED Section */}
      <div className="border-b border-gray-800">
        <div className="px-2 py-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            FIXED
          </span>
        </div>

        {/* Pages Dropdown */}
        <div className="px-2 pb-2">
          <SectionDropdown 
            rawRoots={rawRoots} 
            selectedId={selectedFrameId} 
            setSelectedId={setSelectedFrameId}
            setSelectedIds={setSelectedIds}
          />
        </div>
      </div>

      {/* SCROLLS Section Header */}
      <div 
        className="px-2 py-1 border-b border-gray-800"
      >
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          SCROLLS
        </span>
      </div>

      {/* Layers Panel - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
>>>>>>> origin/adhish1
        <LayersPanel
          layers={filteredNodes}
          setLayers={(layers) => setRawRoots(layers as any)}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      </div>
<<<<<<< HEAD
    </aside>
  )
}
=======

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(40,40,40);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(60,60,60);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(75,75,75);
        }
      `}</style>
    </aside>
  )
}
>>>>>>> origin/adhish1
