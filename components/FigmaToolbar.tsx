/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { ReferenceFrame } from "../lib/figma-types"

// Figma-style Icons
const CursorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M5.5 2L14 10.5L10.5 11L13 15.5L11 16.5L8.5 12L5.5 14.5V2Z" />
  </svg>
)

const FrameIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="4" width="10" height="10" rx="1" />
    <path d="M4 2V4M4 14V16M14 2V4M14 14V16M2 4H4M14 4H16M2 14H4M14 14H16" />
  </svg>
)

const RectangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="12" height="12" rx="1" />
  </svg>
)

const EllipseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="9" cy="9" rx="6" ry="6" />
  </svg>
)

const LineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 15L15 3" />
  </svg>
)

const PenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M9.5 4L14 8.5L7 15.5H2.5V11L9.5 4Z" />
    <path d="M11 2.5L15.5 7" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
)

const TextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M3 4V3H15V4H10V15H8V4H3Z" />
  </svg>
)

const HandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M7 6V3.5a1 1 0 112 0V6h0V3a1 1 0 112 0v3h0V3.5a1 1 0 112 0V10l-1.5 3.5H7L5 10V7a1 1 0 012 0v-1z" />
  </svg>
)

const CommentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M3 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H8l-3 3v-3H5a2 2 0 01-2-2V4z" />
  </svg>
)

const ComponentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M9 2L11.5 6.5L16 9L11.5 11.5L9 16L6.5 11.5L2 9L6.5 6.5L9 2Z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
)

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M3 2L12 7L3 12V2Z" />
  </svg>
)

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 2V9M4 5L7 2L10 5M2 9V11H12V9" />
  </svg>
)

interface FigmaToolbarProps {
  user: any
  onConnect: () => void
  onMountFetchUser: () => Promise<any>
  fileName: string | null
  loading: boolean
  onFetch: (fileUrlOrKey: string) => void
  frameOptions: ReferenceFrame[]
  selectedFrameId: string
  setSelectedFrameId: (id: string) => void
  fitToScreen: () => void
  openConvert: () => void
  zoomPct: number
  onLogout: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onCommit: () => void
  onNavigateProjects: () => void
  currentTool?: "select" | "grid" | "rect" | "pen" | "text" | "ellipse"
  onToolChange?: (tool: "select" | "grid" | "rect" | "pen" | "text" | "ellipse") => void
}

// Tool Button Component
function ToolButton({ icon, active, onClick, title, hasDropdown }: {
  icon: React.ReactNode
  active?: boolean
  onClick?: () => void
  title?: string
  hasDropdown?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? '#0d99ff' : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: active ? '#fff' : 'rgba(255,255,255,0.8)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {hasDropdown && (
        <span style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 0,
          height: 0,
          borderLeft: '3px solid transparent',
          borderRight: '3px solid transparent',
          borderTop: '3px solid currentColor',
          opacity: 0.6,
        }} />
      )}
    </button>
  )
}

export default function FigmaToolbar(props: FigmaToolbarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showZoomMenu, setShowZoomMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)

  // Mount user fetch
  const hasFetchedUserRef = useRef(false)
  useEffect(() => {
    if (hasFetchedUserRef.current) return
    hasFetchedUserRef.current = true
    props.onMountFetchUser?.()
  }, [])

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) {
        setShowZoomMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentTool = props.currentTool ?? "select"

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 48,
      background: '#2c2c2c',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      zIndex: 100,
      gap: 8,
    }}>
      {/* Left Section - Logo & Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Figma Logo / Menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              width: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showMenu ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              gap: 4,
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              background: 'linear-gradient(135deg, #f24e1e 0%, #ff7262 50%, #a259ff 100%)',
              borderRadius: 4,
            }} />
            <ChevronDownIcon />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: '#2c2c2c',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  minWidth: 200,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                <MenuItem label="Back to Files" onClick={props.onNavigateProjects} shortcut="" />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                <MenuItem label="Undo" onClick={props.onUndo} shortcut="⌘Z" disabled={!props.canUndo} />
                <MenuItem label="Redo" onClick={props.onRedo} shortcut="⇧⌘Z" disabled={!props.canRedo} />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                <MenuItem label="Export..." onClick={props.openConvert} shortcut="⇧⌘E" />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                <MenuItem label="Log out" onClick={props.onLogout} shortcut="" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* File Name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 6,
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
            {props.fileName || 'Untitled'}
          </span>
          <ChevronDownIcon />
        </div>
      </div>

      {/* Center Section - Tools */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(0,0,0,0.2)',
        padding: '4px',
        borderRadius: 8,
      }}>
        <ToolButton
          icon={<CursorIcon />}
          active={currentTool === 'select'}
          onClick={() => props.onToolChange?.('select')}
          title="Move (V)"
          hasDropdown
        />
        <ToolButton
          icon={<FrameIcon />}
          active={currentTool === 'grid'}
          onClick={() => props.onToolChange?.('grid')}
          title="Frame (F)"
          hasDropdown
        />
        <ToolButton
          icon={<RectangleIcon />}
          active={currentTool === 'rect'}
          onClick={() => props.onToolChange?.('rect')}
          title="Rectangle (R)"
          hasDropdown
        />
        <ToolButton
          icon={<EllipseIcon />}
          active={currentTool === 'ellipse'}
          onClick={() => props.onToolChange?.('ellipse')}
          title="Ellipse (O)"
        />
        <ToolButton
          icon={<PenIcon />}
          active={currentTool === 'pen'}
          onClick={() => props.onToolChange?.('pen')}
          title="Pen (P)"
          hasDropdown
        />
        <ToolButton
          icon={<TextIcon />}
          active={currentTool === 'text'}
          onClick={() => props.onToolChange?.('text')}
          title="Text (T)"
        />
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        <ToolButton
          icon={<HandIcon />}
          title="Hand Tool (H)"
        />
        <ToolButton
          icon={<CommentIcon />}
          title="Add Comment (C)"
        />
      </div>

      {/* Right Section - Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Zoom Control */}
        <div ref={zoomRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowZoomMenu(!showZoomMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {Math.round(props.zoomPct)}%
            <ChevronDownIcon />
          </button>

          <AnimatePresence>
            {showZoomMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: '#2c2c2c',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  minWidth: 160,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                <MenuItem label="Zoom in" onClick={props.onZoomIn} shortcut="+" />
                <MenuItem label="Zoom out" onClick={props.onZoomOut} shortcut="-" />
                <MenuItem label="Zoom to 100%" onClick={props.onZoomReset} shortcut="⇧0" />
                <MenuItem label="Zoom to fit" onClick={props.fitToScreen} shortcut="⇧1" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Play Button */}
        <button
          onClick={props.openConvert}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
          }}
          title="Preview"
        >
          <PlayIcon />
        </button>

        {/* Commit Button */}
        <button
          onClick={props.onCommit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: '#10b981',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title="Commit changes to snapshot"
        >
          Commit
        </button>

        {/* Share Button */}
        <button
          onClick={props.openConvert}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: '#0d99ff',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Share
        </button>

        {/* User Avatar */}
        {props.user && (
          <button
            onClick={props.onLogout}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#a259ff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
            title={props.user?.name || 'User'}
          >
            {(props.user?.name?.[0] || 'U').toUpperCase()}
          </button>
        )}
      </div>
    </div>
  )
}

// Menu Item Component
function MenuItem({ label, onClick, shortcut, disabled }: {
  label: string
  onClick?: () => void
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{shortcut}</span>
      )}
    </button>
  )
}
