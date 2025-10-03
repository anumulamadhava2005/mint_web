/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import Image from "next/image"
import type { ReferenceFrame } from "../lib/figma-types"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type FrameOption = ReferenceFrame

export default function Toolbar(props: {
  user: any
  onConnect: () => void
  onMountFetchUser: () => void
  fileName: string | null
  loading: boolean
  onFetch: (fileUrlOrKey: string) => void
  frameOptions: FrameOption[]
  selectedFrameId: string
  setSelectedFrameId: (v: string) => void
  fitToScreen: () => void
  openConvert: () => void
  zoomPct: number
  onLogout?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const {
    user,
    onConnect,
    onMountFetchUser,
    fileName,
    loading,
    onFetch,
    frameOptions,
    selectedFrameId,
    setSelectedFrameId,
    fitToScreen,
    openConvert,
    zoomPct,
  } = props

  const [fileInputVal, setFileInputVal] = useState("")

  // fetch user on mount (kept here to keep page.tsx lean)
  if (typeof window !== "undefined") {
    // run once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__userFetched__ ||= (onMountFetchUser(), true)
  }

  function handleFetch() {
    onFetch(fileInputVal)
  }

  // Hover state for logout button
  const [profileHovered, setProfileHovered] = useState(false)

  function handleLogout() {
    if (props.onLogout) {
      props.onLogout()
    } else {
      // Remove common session cookies
      const cookiesToClear = ["session", ".session", "token", "auth", "user", "sid"]
      cookiesToClear.forEach((name) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
      window.location.href = "/home"
    }
  }

  return (
    <div style={{
      background: 'rgba(24,24,27,0.8)',
      borderBottom: '1px solid #333',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      width: '100%',
    }}>
      {/* Top Row - Branding and User */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid #333',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: 0.2 }}>Figma Node Visualizer</h1>
        <div style={{ flex: 1 }} />
        {!user ? (
          <button
            onClick={onConnect}
            style={{
              borderRadius: 8,
              padding: '6px 16px',
              background: '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#1d4ed8')}
            onMouseOut={e => (e.currentTarget.style.background = '#2563eb')}
          >
            Connect Figma
          </button>
        ) : (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', cursor: 'pointer' }}
            onMouseEnter={() => setProfileHovered(true)}
            onMouseLeave={() => setProfileHovered(false)}
          >
            <Image
              src={user.img_url || "/placeholder.svg"}
              alt={user.handle}
              width={28}
              height={28}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #444' }}
            />
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: '#e5e7eb' }}>@{user.handle}</div>
              {user.email && <div style={{ color: '#9ca3af' }}>{user.email}</div>}
            </div>
            <AnimatePresence>
              {profileHovered && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onClick={handleLogout}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 40,
                    zIndex: 10,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: profileHovered ? '#dc2626' : '#23272f',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid #444',
                    minWidth: 90,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#dc2626')}
                  onMouseOut={e => (e.currentTarget.style.background = '#23272f')}
                >
                  Log out
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Bottom Row - Controls */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
        }}
      >
        {/* Zoom/Undo/Redo Controls */}
  <button onClick={props.onZoomOut} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 2, cursor: 'pointer' }}>-</button>
  <button onClick={props.onZoomIn} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 8, cursor: 'pointer' }}>+</button>
  <button onClick={props.onUndo} disabled={!props.canUndo} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 8, marginLeft: 16, cursor: props.canUndo ? 'pointer' : 'not-allowed', opacity: props.canUndo ? 1 : 0.5 }}>Undo</button>
  <button onClick={props.onRedo} disabled={!props.canRedo} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 8, cursor: props.canRedo ? 'pointer' : 'not-allowed', opacity: props.canRedo ? 1 : 0.5 }}>Redo</button>
        {/* File Input */}
        <input
          style={{
            flex: 1,
            background: '#23272f',
            border: '1px solid #444',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 14,
            color: '#fff',
            marginRight: 8,
          }}
          placeholder="Paste Figma file URL or key"
          value={fileInputVal}
          onChange={(e) => setFileInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetch()
          }}
        />
        <button
          onClick={handleFetch}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: loading ? '#3b82f6' : '#2563eb',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginRight: 8,
            transition: 'background 0.2s',
          }}
          disabled={loading}
          onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8' }}
          onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
        >
          {loading ? "Fetching…" : "Fetch"}
        </button>


        {/* Divider */}
  <div style={{ height: 24, width: 1, background: '#333', margin: '0 8px' }} />

        {/* Frame Selector */}
        {frameOptions.length > 0 && (
          <>
            <label style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>Reference frame</label>
            <select
              style={{
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 14,
                backgroundColor: '#18181b',
                color: '#fff',
                border: '1px solid #333',
                marginRight: 8,
              }}
              value={selectedFrameId}
              onChange={(e) => setSelectedFrameId(e.target.value)}
              title="Choose a frame to anchor coordinates and preview overlay"
            >
              <option value="">World origin</option>
              {frameOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.id} ({Math.round(f.width)}×{Math.round(f.height)})
                </option>
              ))}
            </select>
            <div style={{ height: 24, width: 1, background: '#333', margin: '0 8px' }} />
          </>
        )}

        {/* Action Buttons */}
        <button
          onClick={fitToScreen}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: '#23272f',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: '1px solid #444',
            marginRight: 8,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#18181b')}
          onMouseOut={e => (e.currentTarget.style.background = '#23272f')}
        >
          Fit
        </button>
        <button
          onClick={openConvert}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: '#23272f',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: '1px solid #444',
            marginRight: 8,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#18181b')}
          onMouseOut={e => (e.currentTarget.style.background = '#23272f')}
        >
          Convert
        </button>

        {/* Zoom Display */}
  <div style={{ fontSize: 12, color: '#9ca3af', padding: '0 8px', minWidth: 70, textAlign: 'right' }}>{zoomPct.toFixed(0)}%</div>
      </motion.div>

      {/* File Name Row */}
      <AnimatePresence>
        {fileName && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              padding: '8px 16px',
              background: '#18181b',
              borderTop: '1px solid #333',
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            <span style={{ color: '#6b7280' }}>File:</span>{' '}
            <span style={{ color: '#fff' }}>{fileName}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
