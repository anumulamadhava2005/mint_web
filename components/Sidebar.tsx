"use client"

import type React from "react"
import { useState } from "react"
import LayersPanel from "./LayersPanel"
import SectionDropdown from "./SectionDropdown"
import type { NodeInput } from "../lib/figma-types"
import { Menu } from "lucide-react"

export default function Sidebar(props: {
  rawRoots: NodeInput[] | null
  setRawRoots: React.Dispatch<React.SetStateAction<NodeInput[] | null>>
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedFrameId: string
  setSelectedFrameId: React.Dispatch<React.SetStateAction<string>>
  lastFileKey: string | null
  onReset: () => void
}) {
  const { rawRoots, setRawRoots, selectedIds, setSelectedIds, selectedFrameId, setSelectedFrameId, lastFileKey, onReset } = props
  const [filter, setFilter] = useState("")

  const filteredNodes = (rawRoots ?? []).filter((node) => node.name?.toLowerCase().includes(filter.toLowerCase()))

  return (
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
        <LayersPanel
          layers={filteredNodes}
          setLayers={(layers) => setRawRoots(layers as any)}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      </div>

      {/* Reset Button */}
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '20px',
        zIndex: 10 ,
        height: '40px',
        width: '20px'
      }}>
        <button
          onClick={() => {
            // First clear selections
            setSelectedIds(new Set());
            setSelectedFrameId('');
            // Then trigger refetch
            onReset();
          }}
          style={{
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(180deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.1))';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(180deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05))';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }}
        >
          <span>↺</span>
          <span>Reset</span>
        </button>
      </div>

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
