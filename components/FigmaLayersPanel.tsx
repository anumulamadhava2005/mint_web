/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { NodeInput } from "../lib/figma-types"

// Icons
const FrameIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="2" y="2" width="8" height="8" rx="0.5" />
  </svg>
)

const TextIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M2 3V2H10V3H7V10H5V3H2Z" />
  </svg>
)

const RectangleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" fillOpacity="0.6">
    <rect x="1" y="1" width="10" height="10" rx="1" />
  </svg>
)

const ImageIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="1" y="2" width="10" height="8" rx="1" />
    <circle cx="3.5" cy="4.5" r="1" fill="currentColor" />
    <path d="M1 8l3-2 2 1.5 3-2.5 2 2" />
  </svg>
)

const ComponentIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M6 1L8 4L6 7L4 4L6 1Z" fillOpacity="0.8" />
    <path d="M6 5L8 8L6 11L4 8L6 5Z" fillOpacity="0.5" />
  </svg>
)

const VectorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M2 10L6 2L10 10" />
  </svg>
)

const GroupIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="1" y="3" width="6" height="6" rx="0.5" />
    <rect x="5" y="3" width="6" height="6" rx="0.5" />
  </svg>
)

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    width="8" 
    height="8" 
    viewBox="0 0 8 8" 
    fill="currentColor"
    style={{ 
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s',
    }}
  >
    <path d="M2 1L6 4L2 7V1Z" />
  </svg>
)

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M7 4C4 4 1.5 7 1.5 7S4 10 7 10S12.5 7 12.5 7S10 4 7 4Z" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" fill="none" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" />
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="3" y="6" width="8" height="6" rx="1" fillOpacity="0.3" />
    <path d="M5 6V4.5a2 2 0 114 0V6" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
)

// Get icon based on node type
function getNodeIcon(type: string) {
  const t = type?.toUpperCase() || ''
  if (t === 'TEXT') return <TextIcon />
  if (t === 'FRAME' || t === 'COMPONENT' || t === 'INSTANCE') return <FrameIcon />
  if (t === 'RECTANGLE') return <RectangleIcon />
  if (t === 'IMAGE') return <ImageIcon />
  if (t === 'VECTOR') return <VectorIcon />
  if (t === 'GROUP') return <GroupIcon />
  if (t === 'COMPONENT') return <ComponentIcon />
  return <RectangleIcon />
}

interface FigmaLayersPanelProps {
  layers: NodeInput[]
  setLayers: (layers: NodeInput[]) => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}

// Layer Item Component
function LayerItem({ 
  node, 
  depth = 0, 
  selectedIds, 
  setSelectedIds,
  expandedIds,
  toggleExpanded,
}: {
  node: NodeInput
  depth?: number
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedIds.has(node.id)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div>
      {/* Layer Row */}
      <div
        onClick={() => setSelectedIds(new Set([node.id]))}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          paddingLeft: 8 + depth * 12,
          paddingRight: 8,
          background: isSelected ? '#0d99ff' : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(node.id)
            }}
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              padding: 0,
              marginRight: 2,
            }}
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        ) : (
          <div style={{ width: 16, marginRight: 2 }} />
        )}

        {/* Icon */}
        <span style={{ 
          display: 'flex', 
          alignItems: 'center',
          color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
          marginRight: 6,
        }}>
          {getNodeIcon(node.type || '')}
        </span>

        {/* Name */}
        <span style={{
          flex: 1,
          fontSize: 11,
          color: isSelected ? '#fff' : 'rgba(255,255,255,0.9)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name || 'Unnamed'}
        </span>

        {/* Visibility/Lock Controls (on hover) */}
        {(isHovered || isSelected) && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Toggle visibility"
            >
              <EyeIcon />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Toggle lock"
            >
              <LockIcon />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            {node.children!.map((child) => (
              <LayerItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Page Item Component
function PageItem({ name, isActive, onClick }: {
  name: string
  isActive?: boolean
  onClick?: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
        background: isActive ? 'rgba(255,255,255,0.1)' : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ marginRight: 8, opacity: 0.6 }}>
        <rect x="1" y="2" width="10" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span style={{
        fontSize: 11,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
        fontWeight: isActive ? 500 : 400,
      }}>
        {name}
      </span>
    </div>
  )
}

export default function FigmaLayersPanel(props: FigmaLayersPanelProps) {
  const { layers, selectedIds, setSelectedIds } = props
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showPages, setShowPages] = useState(true)

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div style={{
      width: 240,
      height: '100%',
      background: '#2c2c2c',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Pages Section */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setShowPages(!showPages)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <span>Pages</span>
          <span style={{ fontSize: 14 }}>+</span>
        </button>
        
        <AnimatePresence>
          {showPages && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <PageItem name="Page 1" isActive />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Layers Section */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          Layers
        </div>

        {layers.length === 0 ? (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 12,
          }}>
            No layers
          </div>
        ) : (
          <div style={{ paddingTop: 4, paddingBottom: 8 }}>
            {layers.map((layer) => (
              <LayerItem
                key={layer.id}
                node={layer}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
              />
            ))}
          </div>
        )}
      </div>

      {/* Assets Section (collapsed) */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <span>Assets</span>
          <span style={{ 
            transform: 'rotate(-90deg)',
            fontSize: 8,
          }}>▼</span>
        </button>
      </div>
    </div>
  )
}
