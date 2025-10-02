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
    <div className="bg-background/80 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top Row - Branding and User */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 py-2 flex items-center gap-3 border-b border-border"
      >
        <h1 className="text-lg font-semibold text-foreground text-pretty">Figma Node Visualizer</h1>
        <div className="flex-1" />
        {!user ? (
          <button
            onClick={onConnect}
            className="rounded-lg px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90"
          >
            Connect Figma
          </button>
        ) : (
          <div
            className="flex items-center gap-2 relative"
            onMouseEnter={() => setProfileHovered(true)}
            onMouseLeave={() => setProfileHovered(false)}
            style={{ cursor: "pointer" }}
          >
            <Image
              src={user.img_url || "/placeholder.svg"}
              alt={user.handle}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full border border-gray-700"
            />
            <div className="text-xs">
              <div className="font-medium text-gray-200">@{user.handle}</div>
              {user.email && <div className="text-gray-500">{user.email}</div>}
            </div>
            <AnimatePresence>
              {profileHovered && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onClick={handleLogout}
                  className="absolute right-0 top-10 z-10 px-4 py-2 rounded bg-gray-800 text-white text-xs font-medium shadow border border-gray-700 hover:bg-red-600 hover:text-white transition-colors"
                  style={{ minWidth: 90 }}
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
        className="px-4 py-2 flex items-center gap-3"
      >
        {/* File Input */}
        <input
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
          placeholder="Paste Figma file URL or key"
          value={fileInputVal}
          onChange={(e) => setFileInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetch()
          }}
        />
        <button
          onClick={handleFetch}
          className="rounded-lg px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Fetching…" : "Fetch"}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Frame Selector */}
        {frameOptions.length > 0 && (
          <>
            <label className="text-xs text-muted-foreground">Reference frame</label>
            <select
              className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
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
            <div className="h-6 w-px bg-border" />
          </>
        )}

        {/* Action Buttons */}
        <button
          onClick={fitToScreen}
          className="rounded-lg px-3 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-sm font-medium transition-colors"
        >
          Fit
        </button>

        <button
          onClick={openConvert}
          className="rounded-lg px-3 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-sm font-medium transition-colors"
        >
          Convert
        </button>

        {/* Zoom Display */}
        <div className="text-xs text-muted-foreground px-2 min-w-[70px] text-right">{zoomPct.toFixed(0)}%</div>
      </motion.div>

      {/* File Name Row */}
      <AnimatePresence>
        {fileName && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="px-4 py-1.5 bg-muted/60 border-t border-border text-xs text-muted-foreground"
          >
            <span className="text-muted-foreground/70">File:</span>{" "}
            <span className="text-foreground/90">{fileName}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
