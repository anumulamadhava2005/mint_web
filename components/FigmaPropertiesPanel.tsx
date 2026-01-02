/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { NodeInput } from "../lib/figma-types"
import { motion, AnimatePresence } from "framer-motion"
import { uploadToMintApi } from "../lib/upload"

// Icon components for Figma-like UI
const AlignLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="3" width="2" height="10" rx="0.5"/>
    <rect x="6" y="5" width="8" height="2" rx="0.5"/>
    <rect x="6" y="9" width="5" height="2" rx="0.5"/>
  </svg>
)

const AlignCenterHIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="7" y="2" width="2" height="12" rx="0.5"/>
    <rect x="3" y="5" width="10" height="2" rx="0.5"/>
    <rect x="5" y="9" width="6" height="2" rx="0.5"/>
  </svg>
)

const AlignRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="12" y="3" width="2" height="10" rx="0.5"/>
    <rect x="2" y="5" width="8" height="2" rx="0.5"/>
    <rect x="5" y="9" width="5" height="2" rx="0.5"/>
  </svg>
)

const AlignTopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="3" y="2" width="10" height="2" rx="0.5"/>
    <rect x="5" y="6" width="2" height="8" rx="0.5"/>
    <rect x="9" y="6" width="2" height="5" rx="0.5"/>
  </svg>
)

const AlignCenterVIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="7" width="12" height="2" rx="0.5"/>
    <rect x="5" y="3" width="2" height="10" rx="0.5"/>
    <rect x="9" y="5" width="2" height="6" rx="0.5"/>
  </svg>
)

const FlowHorizontalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="4" width="3" height="8" rx="0.5"/>
    <rect x="6.5" y="4" width="3" height="8" rx="0.5"/>
    <rect x="11" y="4" width="3" height="8" rx="0.5"/>
  </svg>
)

const FlowVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="2" width="8" height="3" rx="0.5"/>
    <rect x="4" y="6.5" width="8" height="3" rx="0.5"/>
    <rect x="4" y="11" width="8" height="3" rx="0.5"/>
  </svg>
)

const FlowWrapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="3" height="3" rx="0.5"/>
    <rect x="6.5" y="2" width="3" height="3" rx="0.5"/>
    <rect x="11" y="2" width="3" height="3" rx="0.5"/>
    <rect x="2" y="6.5" width="3" height="3" rx="0.5"/>
    <rect x="6.5" y="6.5" width="3" height="3" rx="0.5"/>
  </svg>
)

const FlowNoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="4" width="8" height="8" rx="0.5" fillOpacity="0.3"/>
    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
)

const FlipHorizontalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M7 3v10H4L7 3zM9 3v10h3L9 3z" fillOpacity="0.6"/>
    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1"/>
  </svg>
)

const FlipVerticalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 7h10V4L3 7zM3 9h10v3L3 9z" fillOpacity="0.6"/>
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1"/>
  </svg>
)

const ConstraintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
  </svg>
)

const PaddingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/>
    <rect x="4" y="4" width="8" height="8" rx="0.5" fill="currentColor" fillOpacity="0.3"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4C4 4 1 8 1 8s3 4 7 4 7-4 7-4-3-4-7-4z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
  </svg>
)

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.5 1.5M10.5 10.5L12 12M12 4l-1.5 1.5M5.5 10.5L4 12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const CornerRadiusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 12V7a3 3 0 013-3h5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const MinusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

interface Props {
  selectedNode: NodeInput | null
  onUpdateSelected: (mut: (n: NodeInput) => void) => void
  images?: Record<string, string>
  onImageChange?: (id: string, url: string) => void
  onClose?: () => void
  onDelete?: (node: NodeInput) => void
  rawRoots?: NodeInput[] | null
}

// Collapsible Section Component
function Section({ title, icon, defaultOpen = true, children, onAdd }: {
  title: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  onAdd?: () => void
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onAdd && (
            <span 
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              style={{ opacity: 0.6, cursor: 'pointer' }}
            >
              <PlusIcon />
            </span>
          )}
          <span style={{ 
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', 
            transition: 'transform 0.15s',
            opacity: 0.5,
            fontSize: 10,
          }}>
            ▼
          </span>
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 12px 12px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Input Field Component
function InputField({ label, value, onChange, type = 'text', min, max, step, suffix, prefix, style }: {
  label?: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
  suffix?: string
  prefix?: string | React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && (
        <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {prefix && (
          <span style={{ 
            padding: '0 6px', 
            fontSize: 11, 
            color: 'rgba(255,255,255,0.4)',
            borderRight: '1px solid rgba(255,255,255,0.1)',
          }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: 11,
            padding: '6px 8px',
            outline: 'none',
            width: '100%',
            minWidth: 0,
          }}
        />
        {suffix && (
          <span style={{ 
            padding: '0 8px', 
            fontSize: 10, 
            color: 'rgba(255,255,255,0.4)',
          }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// Icon Button Component
function IconButton({ icon, active, onClick, title, size = 28 }: {
  icon: React.ReactNode
  active?: boolean
  onClick?: () => void
  title?: string
  size?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'rgba(24, 160, 251, 0.2)' : 'transparent',
        border: active ? '1px solid rgba(24, 160, 251, 0.5)' : '1px solid transparent',
        borderRadius: 4,
        color: active ? '#18A0FB' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
    </button>
  )
}

// Select Dropdown Component
function SelectField({ value, onChange, options, style }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  style?: React.CSSProperties
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        color: '#fff',
        fontSize: 11,
        padding: '6px 8px',
        outline: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: '#2c2c2c' }}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Alignment Grid Component (3x3)
function AlignmentGrid({ value, onChange }: {
  value: { h: string; v: string }
  onChange: (value: { h: string; v: string }) => void
}) {
  const positions = [
    ['top-left', 'top-center', 'top-right'],
    ['center-left', 'center-center', 'center-right'],
    ['bottom-left', 'bottom-center', 'bottom-right'],
  ]
  
  const currentPos = `${value.v}-${value.h}`
  
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: 2,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 4,
      padding: 4,
    }}>
      {positions.flat().map((pos) => {
        const [v, h] = pos.split('-')
        const isActive = currentPos === pos
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onChange({ h, v })}
            style={{
              width: 18,
              height: 18,
              background: isActive ? '#18A0FB' : 'transparent',
              border: 'none',
              borderRadius: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: 4,
              height: 4,
              borderRadius: 1,
              background: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
            }} />
          </button>
        )
      })}
    </div>
  )
}

export default function FigmaPropertiesPanel(props: Props) {
  const { selectedNode, onUpdateSelected, images, onImageChange, onClose, onDelete, rawRoots } = props
  const [panelWidth, setPanelWidth] = useState(240)
  const [isResizing, setIsResizing] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [localImg, setLocalImg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showFillPicker, setShowFillPicker] = useState(false)

  // Helper to find parent node of selected node
  const findParentNode = (nodeId: string, roots: NodeInput[] | null | undefined): NodeInput | null => {
    if (!roots) return null
    
    const search = (nodes: NodeInput[], parent: NodeInput | null): NodeInput | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return parent
        if (node.children) {
          const found = search(node.children, node)
          if (found !== null) return found
        }
      }
      return null
    }
    
    return search(roots, null)
  }

  // Helper to check if node is a root frame
  const isRootFrame = (nodeId: string, roots: NodeInput[] | null | undefined): boolean => {
    if (!roots) return false
    return roots.some(r => r.id === nodeId)
  }

  // Get parent node
  const parentNode = findParentNode(selectedNode?.id || '', rawRoots)
  const isFrame = isRootFrame(selectedNode?.id || '', rawRoots)

  // Resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = panelWidth

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 200), 400)
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  if (!selectedNode) {
    return (
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          width: panelWidth,
          background: '#2c2c2c',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          height: '100%',
          overflowY: 'auto',
          fontSize: 12,
        }}
      >
        <div style={{ padding: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Select a layer to see its properties
        </div>
      </motion.aside>
    )
  }

  // Get absolute positions
  const absX = (selectedNode as any).x ?? selectedNode.absoluteBoundingBox?.x ?? 0
  const absY = (selectedNode as any).y ?? selectedNode.absoluteBoundingBox?.y ?? 0
  
  // Get parent's absolute position for relative calculation
  const parentAbsX = parentNode ? ((parentNode as any).x ?? parentNode.absoluteBoundingBox?.x ?? 0) : 0
  const parentAbsY = parentNode ? ((parentNode as any).y ?? parentNode.absoluteBoundingBox?.y ?? 0) : 0
  
  // Calculate position relative to parent (if not a root frame)
  // For root frames, show absolute position
  const x = isFrame ? absX : (absX - parentAbsX)
  const y = isFrame ? absY : (absY - parentAbsY)
  
  const width = (selectedNode as any).width ?? selectedNode.absoluteBoundingBox?.width ?? 100
  const height = (selectedNode as any).height ?? selectedNode.absoluteBoundingBox?.height ?? 100
  const rotation = (selectedNode as any).rotation ?? 0
  const opacity = ((selectedNode as any).opacity ?? 1) * 100
  const cornerRadius = selectedNode.corners?.uniform ?? 0
  const layoutMode = (selectedNode as any).layoutMode || 'NONE'
  const paddingTop = (selectedNode as any).paddingTop ?? 0
  const paddingRight = (selectedNode as any).paddingRight ?? 0
  const paddingBottom = (selectedNode as any).paddingBottom ?? 0
  const paddingLeft = (selectedNode as any).paddingLeft ?? 0
  const itemSpacing = (selectedNode as any).itemSpacing ?? 0
  const clipsContent = (selectedNode as any).clipsContent ?? false
  const fillColor = selectedNode.fill?.type === 'SOLID' ? selectedNode.fill.color : '#ffffff'
  const strokeColor = selectedNode.stroke?.color ?? '#000000'
  const strokeWeight = selectedNode.stroke?.weight ?? 0
  const justifyContent = (selectedNode as any).justifyContent || 'flex-start'
  const alignItems = (selectedNode as any).alignItems || 'flex-start'

  // Derive alignment grid position
  const getAlignmentValue = () => {
    let h = 'left'
    let v = 'top'
    if (justifyContent === 'center') h = 'center'
    else if (justifyContent === 'flex-end') h = 'right'
    if (alignItems === 'center') v = 'center'
    else if (alignItems === 'flex-end') v = 'bottom'
    return { h, v }
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        width: panelWidth,
        background: '#2c2c2c',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        fontSize: 12,
        position: 'relative',
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 4,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />

      {/* Header - Node Type & Name */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {isFrame ? 'Frame' : (selectedNode.type || 'Element')}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="rgba(255,255,255,0.5)">
              <path d="M2 3l3 4 3-4H2z"/>
            </svg>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            {selectedNode.name || selectedNode.id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton icon={<span style={{ fontSize: 10 }}>&lt;/&gt;</span>} title="Code" />
          <IconButton icon={<span style={{ fontSize: 14 }}>⚙</span>} title="Settings" />
        </div>
      </div>

      {/* POSITION Section */}
      <Section title="Position" defaultOpen={true}>
        {/* Alignment Buttons - Align node within parent */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Alignment {parentNode ? `(within ${parentNode.name || 'parent'})` : ''}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <IconButton 
              icon={<AlignLeftIcon />} 
              title="Align left"
              onClick={() => {
                if (!parentNode) return
                const parentW = (parentNode as any).width ?? parentNode.absoluteBoundingBox?.width ?? 0
                onUpdateSelected((n) => {
                  // Align to left edge of parent (x = 0 relative to parent)
                  const newAbsX = parentAbsX
                  ;(n as any).x = newAbsX
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.x = newAbsX
                })
              }}
            />
            <IconButton 
              icon={<AlignCenterHIcon />} 
              title="Align center horizontally"
              onClick={() => {
                if (!parentNode) return
                const parentW = (parentNode as any).width ?? parentNode.absoluteBoundingBox?.width ?? 0
                const nodeW = width
                onUpdateSelected((n) => {
                  // Center horizontally within parent
                  const newAbsX = parentAbsX + (parentW - nodeW) / 2
                  ;(n as any).x = newAbsX
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.x = newAbsX
                })
              }}
            />
            <IconButton 
              icon={<AlignRightIcon />} 
              title="Align right"
              onClick={() => {
                if (!parentNode) return
                const parentW = (parentNode as any).width ?? parentNode.absoluteBoundingBox?.width ?? 0
                const nodeW = width
                onUpdateSelected((n) => {
                  // Align to right edge of parent
                  const newAbsX = parentAbsX + parentW - nodeW
                  ;(n as any).x = newAbsX
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.x = newAbsX
                })
              }}
            />
            <IconButton 
              icon={<AlignTopIcon />} 
              title="Align top"
              onClick={() => {
                if (!parentNode) return
                onUpdateSelected((n) => {
                  // Align to top edge of parent (y = 0 relative to parent)
                  const newAbsY = parentAbsY
                  ;(n as any).y = newAbsY
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.y = newAbsY
                })
              }}
            />
            <IconButton 
              icon={<AlignCenterVIcon />} 
              title="Align center vertically"
              onClick={() => {
                if (!parentNode) return
                const parentH = (parentNode as any).height ?? parentNode.absoluteBoundingBox?.height ?? 0
                const nodeH = height
                onUpdateSelected((n) => {
                  // Center vertically within parent
                  const newAbsY = parentAbsY + (parentH - nodeH) / 2
                  ;(n as any).y = newAbsY
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.y = newAbsY
                })
              }}
            />
          </div>
        </div>

        {/* Position X/Y */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Position {!isFrame && parentNode ? `(relative to ${parentNode.name || 'parent'})` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <InputField
              prefix="X"
              value={Math.round(x)}
              onChange={(v) => onUpdateSelected((n) => { 
                const newRelX = Number(v) || 0
                // Convert relative position back to absolute for storage
                const newAbsX = isFrame ? newRelX : (parentAbsX + newRelX)
                ;(n as any).x = newAbsX
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.x = newAbsX
              })}
              type="number"
            />
            <InputField
              prefix="Y"
              value={Math.round(y)}
              onChange={(v) => onUpdateSelected((n) => { 
                const newRelY = Number(v) || 0
                // Convert relative position back to absolute for storage
                const newAbsY = isFrame ? newRelY : (parentAbsY + newRelY)
                ;(n as any).y = newAbsY
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.y = newAbsY
              })}
              type="number"
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Rotation
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <InputField
              prefix="∠"
              value={rotation}
              onChange={(v) => onUpdateSelected((n) => { (n as any).rotation = Number(v) || 0 })}
              type="number"
              suffix="°"
              style={{ flex: 1 }}
            />
            <IconButton 
              icon={<FlipHorizontalIcon />} 
              title="Flip horizontal"
              onClick={() => onUpdateSelected((n) => { (n as any).scaleX = ((n as any).scaleX || 1) * -1 })}
            />
            <IconButton 
              icon={<FlipVerticalIcon />} 
              title="Flip vertical"
              onClick={() => onUpdateSelected((n) => { (n as any).scaleY = ((n as any).scaleY || 1) * -1 })}
            />
          </div>
        </div>
      </Section>

      {/* AUTO LAYOUT Section */}
      <Section title="Auto layout" defaultOpen={true}>
        {/* Flow Direction */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Flow
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <IconButton 
              icon={<FlowHorizontalIcon />} 
              active={layoutMode === 'HORIZONTAL'}
              onClick={() => onUpdateSelected((n) => { (n as any).layoutMode = 'HORIZONTAL' })}
              title="Horizontal"
            />
            <IconButton 
              icon={<FlowVerticalIcon />} 
              active={layoutMode === 'VERTICAL'}
              onClick={() => onUpdateSelected((n) => { (n as any).layoutMode = 'VERTICAL' })}
              title="Vertical"
            />
            <IconButton 
              icon={<FlowWrapIcon />} 
              active={layoutMode === 'WRAP'}
              onClick={() => onUpdateSelected((n) => { (n as any).layoutMode = 'WRAP' })}
              title="Wrap"
            />
            <IconButton 
              icon={<FlowNoneIcon />} 
              active={layoutMode === 'NONE'}
              onClick={() => onUpdateSelected((n) => { (n as any).layoutMode = 'NONE' })}
              title="None"
            />
          </div>
        </div>

        {/* Resizing */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Resizing
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <InputField
              prefix="W"
              value={Math.round(width)}
              onChange={(v) => onUpdateSelected((n) => { 
                (n as any).width = Number(v) || 0
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.width = Number(v) || 0
              })}
              type="number"
            />
            <InputField
              prefix="H"
              value={Math.round(height)}
              onChange={(v) => onUpdateSelected((n) => { 
                (n as any).height = Number(v) || 0
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.height = Number(v) || 0
              })}
              type="number"
            />
            <SelectField
              value={(selectedNode as any).resizeMode || 'HUG'}
              onChange={(v) => onUpdateSelected((n) => { (n as any).resizeMode = v })}
              options={[
                { value: 'HUG', label: 'Hug' },
                { value: 'FIXED', label: 'Fixed' },
                { value: 'FILL', label: 'Fill' },
              ]}
              style={{ width: 60 }}
            />
          </div>
        </div>

        {/* Alignment Grid + Gap */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Alignment
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
            <AlignmentGrid
              value={getAlignmentValue()}
              onChange={({ h, v }) => {
                onUpdateSelected((n) => {
                  (n as any).justifyContent = h === 'left' ? 'flex-start' : h === 'center' ? 'center' : 'flex-end';
                  (n as any).alignItems = v === 'top' ? 'flex-start' : v === 'center' ? 'center' : 'flex-end';
                })
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Gap</div>
              <InputField
                prefix="≡"
                value={itemSpacing}
                onChange={(v) => onUpdateSelected((n) => { (n as any).itemSpacing = Number(v) || 0 })}
                type="number"
              />
            </div>
          </div>
        </div>

        {/* Padding */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase' }}>
            Padding
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <InputField
              prefix="↑"
              value={paddingTop}
              onChange={(v) => onUpdateSelected((n) => { (n as any).paddingTop = Number(v) || 0 })}
              type="number"
            />
            <InputField
              prefix="↓"
              value={paddingBottom}
              onChange={(v) => onUpdateSelected((n) => { (n as any).paddingBottom = Number(v) || 0 })}
              type="number"
            />
            <InputField
              prefix="←"
              value={paddingLeft}
              onChange={(v) => onUpdateSelected((n) => { (n as any).paddingLeft = Number(v) || 0 })}
              type="number"
            />
            <InputField
              prefix="→"
              value={paddingRight}
              onChange={(v) => onUpdateSelected((n) => { (n as any).paddingRight = Number(v) || 0 })}
              type="number"
            />
          </div>
        </div>

        {/* Clip Content */}
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          cursor: 'pointer',
          fontSize: 11,
          color: 'rgba(255,255,255,0.8)',
        }}>
          <input
            type="checkbox"
            checked={clipsContent}
            onChange={(e) => onUpdateSelected((n) => { (n as any).clipsContent = e.target.checked })}
            style={{ accentColor: '#18A0FB' }}
          />
          Clip content
        </label>
      </Section>

      {/* APPEARANCE Section */}
      <Section title="Appearance" defaultOpen={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Opacity */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase' }}>
              Opacity
            </div>
            <InputField
              prefix={<EyeIcon />}
              value={Math.round(opacity)}
              onChange={(v) => onUpdateSelected((n) => { (n as any).opacity = (Number(v) || 100) / 100 })}
              type="number"
              suffix="%"
            />
          </div>
          {/* Corner Radius */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase' }}>
              Corner radius
            </div>
            <InputField
              prefix={<CornerRadiusIcon />}
              value={cornerRadius}
              onChange={(v) => onUpdateSelected((n) => { 
                n.corners = { ...(n.corners || {}), uniform: Number(v) || 0 }
              })}
              type="number"
            />
          </div>
        </div>
      </Section>

      {/* FILL Section */}
      <Section title="Fill" defaultOpen={true} onAdd={() => {}}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          padding: '8px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 4,
        }}>
          <input
            type="color"
            value={fillColor || '#ffffff'}
            onChange={(e) => onUpdateSelected((n) => {
              n.fill = { type: 'SOLID', color: e.target.value }
            })}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              padding: 0,
            }}
          />
          <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
            {selectedNode.fill?.type === 'SOLID' ? 'Solid' : selectedNode.fill?.type === 'IMAGE' ? 'Image' : 'Background'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {fillColor?.toUpperCase()}
          </span>
        </div>
      </Section>

      {/* STROKE Section */}
      <Section title="Stroke" defaultOpen={false} onAdd={() => {}}>
        {strokeWeight > 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            padding: '8px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 4,
          }}>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), color: e.target.value }
              })}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                padding: 0,
              }}
            />
            <InputField
              value={strokeWeight}
              onChange={(v) => onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), weight: Number(v) || 0 }
              })}
              type="number"
              style={{ width: 60 }}
            />
          </div>
        ) : (
          <div style={{ 
            fontSize: 11, 
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            padding: '8px',
          }}>
            Click + to add stroke
          </div>
        )}
      </Section>

      {/* EFFECTS Section */}
      <Section title="Effects" defaultOpen={false} onAdd={() => {}}>
        <div style={{ 
          fontSize: 11, 
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          padding: '8px',
        }}>
          Click + to add effect
        </div>
      </Section>

      {/* Hidden file input for image upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            // Handle file upload
          }
        }}
      />
    </motion.aside>
  )
}
