/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import type React from "react"
import { useRef, useState } from "react"
import { uploadToMintApi } from "../lib/upload"
import type { NodeInput } from "../lib/figma-types"
import { motion, AnimatePresence } from "framer-motion"
import styles from "./css/PropertiesPanel.module.css"

export default function PropertiesPanel(props: {
  selectedNode: NodeInput | null
  onUpdateSelected: (mut: (n: NodeInput) => void) => void
  images?: Record<string, string>
  onImageChange?: (id: string, url: string) => void
  onClose?: () => void
  onDelete?: (node: NodeInput) => void
}) {
  const { selectedNode, onUpdateSelected, images, onImageChange, onClose, onDelete } = props
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [localImg, setLocalImg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [imageFit, setImageFit] = useState<"cover" | "contain" | "fill">("cover")
  const [imageOpacity, setImageOpacity] = useState(100)
  const [panelWidth, setPanelWidth] = useState(288) // 18rem = 288px
  const [isResizing, setIsResizing] = useState(false)

  // Image manipulation states
  const [imageManipulationMode, setImageManipulationMode] = useState<'select' | 'resize' | 'crop' | null>(null)
  const [imageSelected, setImageSelected] = useState(false)
  const [imageResize, setImageResize] = useState({ width: 100, height: 100, maintainAspectRatio: true })
  const [imageCrop, setImageCrop] = useState({ x: 0, y: 0, width: 100, height: 100 })

  // Resize functionality
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = panelWidth

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX // Left border, so we subtract
      const newWidth = Math.min(Math.max(startWidth + deltaX, 250), 500) // Min 250px, max 500px
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
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          width: `${panelWidth}px`,
          borderLeft: '1px solid rgb(60,60,60)',
          background: 'rgb(60,60,60)',
          color: '#fff',
          padding: '1rem',
          paddingTop: '4rem',
          overflowY: 'auto',
          minHeight: 0,
          position: 'relative',
          transition: isResizing ? 'none' : 'width 0.1s ease'
        }}
      >
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className={styles.title}>Properties</div>
            <div className={styles.subtle}>No component selected</div>
          </div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              cursor: 'pointer',
              borderRadius: 6
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
          Select a component to view its properties
        </div>
      </motion.aside>
    )
  }

  const nodeKey = selectedNode.id || selectedNode.name
  const currentImage =
    localImg ??
    (typeof selectedNode.fill?.imageRef === "string" ? selectedNode.fill?.imageRef : null) ??
    ((images ? images[nodeKey] || null : null) || null)

  function setImageUrl(url: string) {
    setLocalImg(url)
    onUpdateSelected((n) => {
      const prev = n.fill && n.fill.type === "IMAGE" ? n.fill : null
      // Spread previous first so we can override with new values (avoid reverting imageRef)
      n.fill = { ...(prev || {}), type: "IMAGE", imageRef: url, fit: imageFit, opacity: imageOpacity / 100 } as any
    })
    if (onImageChange) onImageChange(nodeKey, url)

    // Initialize resize dimensions when new image is set
    const img = new Image()
    img.onload = () => {
      setImageResize({ width: img.width, height: img.height, maintainAspectRatio: true })
      setImageCrop({ x: 0, y: 0, width: img.width, height: img.height })
    }
    img.src = url
  }

  function clearImage() {
    setLocalImg(null)
    onUpdateSelected((n) => {
      if (n.fill?.type === "IMAGE") n.fill = null
    })
    if (onImageChange) onImageChange(nodeKey, "")
  }

  async function handleFile(file: File) {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || "")
      if (url) setImageUrl(url)
    }
    reader.readAsDataURL(file)

    setUploading(true)
    setUploadError(null)
    setProgress(0)
    try {
      // Try proxy endpoint first (avoids CORS)
      let uploaded = await uploadToMintApi(file, {
        onProgress: (p: number) => setProgress(p),
        retries: 1,
        endpoint: "/api/upload-proxy",
      })
      // Fallback to direct (may fail due to CORS but worth trying)
      if (!uploaded) {
        uploaded = await uploadToMintApi(file, {
          onProgress: (p: number) => setProgress(p),
          retries: 1,
        })
      }
      if (uploaded) {
        setImageUrl(uploaded)
        // Show success feedback and close modal immediately
        setUploadError(null)
        setUploadSuccess(true)
        // Close modal after a very brief success indication (200ms)
        setTimeout(() => {
          setUploadSuccess(false)
          setShowUploadModal(false)
        }, 200)
      } else {
        // Only show error if no image is set (we may already have a preview from FileReader)
  const hasImageNow = Boolean(localImg) || Boolean(currentImage)
        if (!hasImageNow) {
          setUploadError("Upload failed - please try again")
        } else {
          // If we already show a preview, clear any previous error so users don't see a failure badge
          setUploadError(null)
        }
      }
    } catch (err: any) {
      console.error("Upload error:", err)
      setUploadError(String(err?.message || "Upload failed"))
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 500)
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
  }

  const hasImageFill = selectedNode.fill?.type === "IMAGE" || Boolean(currentImage)
  const fillColor = selectedNode.fill?.type === "SOLID" ? selectedNode.fill.color : "#ffffff"

  function ImageUrlField(props: {
    initialUrl: string
    onPreview: (url: string) => void
    onApply: (url: string) => void
    onClear: () => void
  }) {
    const { initialUrl, onPreview, onApply, onClear } = props
    const [url, setUrl] = useState(initialUrl)
    const [isValid, setIsValid] = useState(true)

    function validate(value: string) {
      if (!value) return true
      try {
        if (value.startsWith("data:image/")) return true
        const u = new URL(value)
        return u.protocol === "http:" || u.protocol === "https:"
      } catch {
        return false
      }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value
      setUrl(v)
      setIsValid(validate(v))
      onPreview(v)
    }

    function handleApply() {
      if (!validate(url)) return
      onApply(url)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        e.preventDefault()
        handleApply()
      }
    }

    return (
      <div className={styles.section}>
        <div className={styles.row}>
          <input
            type="url"
            placeholder="https://example.com/image.png"
            className={styles.input}
            value={url}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            title="Enter a valid http(s) URL or a data:image URL"
            style={{
              backgroundColor: '#f8f9fa',
              color: '#000000',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!isValid}
            onClick={handleApply}
            title={isValid ? "Set image" : "URL invalid"}
          >
            Set
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => {
              setUrl("")
              setIsValid(true)
              onPreview("")
              onClear()
            }}
          >
            Clear
          </button>
        </div>

        {url ? (
          <div className={styles.inlinePreview}>
            <img
              src={url || "/placeholder.svg"}
              alt="URL preview"
              className={styles.imgContain}
              onError={(e) => {
                setIsValid(false)
                // Show a placeholder for failed images
                const target = e.target as HTMLImageElement
                const canvas = document.createElement('canvas')
                canvas.width = 100
                canvas.height = 100
                const ctx = canvas.getContext('2d')!
                ctx.fillStyle = '#f0f0f0'
                ctx.fillRect(0, 0, 100, 100)
                ctx.fillStyle = '#999'
                ctx.font = '10px Arial'
                ctx.textAlign = 'center'
                ctx.fillText('Preview failed', 50, 40)
                ctx.fillText('to load', 50, 60)
                target.src = canvas.toDataURL()
              }}
              onLoad={() => setIsValid(true)}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          width: `${panelWidth}px`,
          borderLeft: '1px solid rgb(60,60,60)',
          background: 'rgba(48, 47, 47, 1)',
          color: '#fff',
          padding: '1rem',
          paddingTop: '2rem', // Push down to show reference frame selector
          overflowY: 'auto',
          minHeight: 0,
          position: 'relative',
          transition: isResizing ? 'none' : 'width 0.1s ease'
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 4,
            height: '100%',
            cursor: 'col-resize',
            background: 'transparent',
            zIndex: 10,
            borderLeft: isResizing ? '2px solid #10b981' : 'none'
          }}
          title="Drag to resize panel"
        />
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className={styles.title}>Properties</div>
            <div className={styles.subtle}>{selectedNode.name || selectedNode.id}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onDelete && (
              <button
                type="button"
                onClick={() => selectedNode && onDelete(selectedNode)}
                title="Delete component"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 4,
                  cursor: 'pointer',
                  borderRadius: 6
                }}
              >
                🗑️
              </button>
            )}
            <button
              type="button"
              onClick={() => onClose && onClose()}
              title="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
                cursor: 'pointer',
                borderRadius: 6
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Size */}
        <div className={styles.section}>
          <div className={styles.label}>Size</div>
          <div className={styles.grid2}>
            <input
              type="number"
              className={`${styles.input} ${styles.number}`}
              value={selectedNode.width ?? selectedNode.absoluteBoundingBox?.width ?? 0}
              onChange={(e) => {
                const w = Number(e.target.value) || 0
                onUpdateSelected((n) => {
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.width = w
                  else (n as any).width = w
                })
              }}
              style={{
                backgroundColor: '#f8f9fa',
                color: '#000000',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <input
              type="number"
              className={`${styles.input} ${styles.number}`}
              value={selectedNode.height ?? selectedNode.absoluteBoundingBox?.height ?? 0}
              onChange={(e) => {
                const h = Number(e.target.value) || 0
                onUpdateSelected((n) => {
                  if (n.absoluteBoundingBox) n.absoluteBoundingBox.height = h
                  else (n as any).height = h
                })
              }}
              style={{
                backgroundColor: '#f8f9fa',
                color: '#000000',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* Image */}
        <div className={styles.section}>
          <div className={styles.label}>Image</div>

          <ImageUrlField
            initialUrl={currentImage || ""}
            onPreview={(u) => setLocalImg(u || null)}
            onApply={(u) => {
              if (u && u.trim()) setImageUrl(u.trim())
            }}
            onClear={() => clearImage()}
          />

          <div className={styles.row}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowUploadModal(true)}
              style={{ width: '100%', fontSize: 14, fontWeight: 500, textAlign: 'center' , display: 'flex', justifyContent: 'center' }}
            >
              📤 Upload Image
            </button>
          </div>

          {currentImage && (
            <>
              {/* Image Manipulation Tools */}
              <div style={{ marginTop: 12 }}>
                <div className={styles.label} style={{ fontSize: 12, marginBottom: 6 }}>Image Tools</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setImageManipulationMode(imageManipulationMode === 'select' ? null : 'select')
                      setImageSelected(!imageSelected)
                    }}
                    style={{
                      background: imageManipulationMode === 'select' ? '#10b981' : 'rgba(255,255,255,0.1)',
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {imageSelected ? '✅ Selected' : '👆 Select'}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setImageManipulationMode(imageManipulationMode === 'resize' ? null : 'resize')}
                    style={{
                      background: imageManipulationMode === 'resize' ? '#10b981' : 'rgba(255,255,255,0.1)',
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📏 Resize
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setImageManipulationMode(imageManipulationMode === 'crop' ? null : 'crop')}
                    style={{
                      background: imageManipulationMode === 'crop' ? '#10b981' : 'rgba(255,255,255,0.1)',
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ✂️ Crop
                  </button>
                </div>
              </div>

              {/* Resize Controls */}
              {imageManipulationMode === 'resize' && (
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  <div className={styles.label} style={{ fontSize: 12, marginBottom: 8 }}>Resize Image</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Width</label>
                      <input
                        type="number"
                        value={imageResize.width}
                        onChange={(e) => {
                          const newWidth = Number(e.target.value)
                          setImageResize(prev => ({
                            ...prev,
                            width: newWidth,
                            height: prev.maintainAspectRatio ? Math.round(newWidth * (prev.height / prev.width)) : prev.height
                          }))
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Height</label>
                      <input
                        type="number"
                        value={imageResize.height}
                        onChange={(e) => {
                          const newHeight = Number(e.target.value)
                          setImageResize(prev => ({
                            ...prev,
                            height: newHeight,
                            width: prev.maintainAspectRatio ? Math.round(newHeight * (prev.width / prev.height)) : prev.width
                          }))
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={imageResize.maintainAspectRatio}
                        onChange={(e) => setImageResize(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                      />
                      Maintain aspect ratio
                    </label>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        // Apply resize
                        onUpdateSelected((n) => {
                          if (n.fill?.type === "IMAGE") {
                            (n.fill as any).resize = imageResize
                          }
                        })
                      }}
                      style={{
                        padding: '4px 12px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setImageManipulationMode(null)}
                      style={{
                        padding: '4px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Crop Controls */}
              {imageManipulationMode === 'crop' && (
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  <div className={styles.label} style={{ fontSize: 12, marginBottom: 8 }}>Crop Image</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>X Position</label>
                      <input
                        type="number"
                        value={imageCrop.x}
                        onChange={(e) => setImageCrop(prev => ({ ...prev, x: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Y Position</label>
                      <input
                        type="number"
                        value={imageCrop.y}
                        onChange={(e) => setImageCrop(prev => ({ ...prev, y: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Width</label>
                      <input
                        type="number"
                        value={imageCrop.width}
                        onChange={(e) => setImageCrop(prev => ({ ...prev, width: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Height</label>
                      <input
                        type="number"
                        value={imageCrop.height}
                        onChange={(e) => setImageCrop(prev => ({ ...prev, height: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: '#f8f9fa',
                          color: '#000000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        // Apply crop
                        onUpdateSelected((n) => {
                          if (n.fill?.type === "IMAGE") {
                            (n.fill as any).crop = imageCrop
                          }
                        })
                      }}
                      style={{
                        padding: '4px 12px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setImageManipulationMode(null)}
                      style={{
                        padding: '4px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Image Fit Mode */}
              <div style={{ marginTop: 12 }}>
                <div className={styles.label} style={{ fontSize: 12, marginBottom: 6 }}>Fit Mode</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setImageFit("cover")
                      onUpdateSelected((n) => {
                        if (n.fill?.type === "IMAGE") (n.fill as any).fit = "cover"
                      })
                    }}
                    style={{
                      background: imageFit === "cover" ? "#10b981" : "rgba(255,255,255,0.1)",
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setImageFit("contain")
                      onUpdateSelected((n) => {
                        if (n.fill?.type === "IMAGE") (n.fill as any).fit = "contain"
                      })
                    }}
                    style={{
                      background: imageFit === "contain" ? "#10b981" : "rgba(255,255,255,0.1)",
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Contain
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setImageFit("fill")
                      onUpdateSelected((n) => {
                        if (n.fill?.type === "IMAGE") (n.fill as any).fit = "fill"
                      })
                    }}
                    style={{
                      background: imageFit === "fill" ? "#10b981" : "rgba(255,255,255,0.1)",
                      fontSize: 11,
                      padding: '6px 8px',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Fill
                  </button>
                </div>
              </div>

              {/* Image Opacity */}
              <div style={{ marginTop: 12 }}>
                <div className={styles.label} style={{ fontSize: 12, marginBottom: 6 }}>
                  Opacity: {imageOpacity}%
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={imageOpacity}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setImageOpacity(val)
                    onUpdateSelected((n) => {
                      if (n.fill?.type === "IMAGE") (n.fill as any).opacity = val / 100
                    })
                  }}
                  style={{
                    width: '100%',
                    accentColor: '#10b981'
                  }}
                />
              </div>

              {/* Preview */}
              <div className={styles.finalPreview} style={{ position: 'relative', marginTop: 12 }}>
                <img
                  src={localImg || currentImage || "/placeholder.svg"}
                  alt="Preview"
                  className={styles.imgContain}
                  style={{
                    opacity: uploading ? 0.6 : imageOpacity / 100,
                    transition: 'opacity 160ms',
                    border: imageSelected ? '3px solid #10b981' : 'none',
                    borderRadius: imageSelected ? '4px' : '0'
                  }}
                />
                {imageSelected && (
                  <div style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    background: '#10b981',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12
                  }}>
                    ✓
                  </div>
                )}
                {uploading && (
                  <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: '#10b981', borderRadius: 4, transition: 'width 0.2s' }} />
                    </div>
                    <div style={{ color: '#d1fae5', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{progress}%</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Fill */}
        <div className={styles.section}>
          <div className={styles.label}>Fill</div>
          <input
            type="color"
            className={styles.input}
            value={fillColor || "#ffffff"}
            disabled={hasImageFill}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.fill = { type: "SOLID", color: e.target.value }
              })
            }
            title={hasImageFill ? "Remove image to edit solid fill" : "Pick color"}
          />
        </div>

        {/* Stroke */}
        <div className={styles.section}>
          <div className={styles.label}>Stroke</div>
          <div className={styles.grid3}>
            <input
              type="color"
              className={styles.input}
              value={selectedNode.stroke?.color || "#000000"}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.stroke = { ...(n.stroke || {}), color: e.target.value }
                })
              }
            />
            <input
              type="number"
              min={0}
              className={styles.input}
              value={selectedNode.stroke?.weight ?? 1}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.stroke = { ...(n.stroke || {}), weight: Number(e.target.value) || 0 }
                })
              }
              style={{
                backgroundColor: '#f8f9fa',
                color: '#000000',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <select
              className={styles.input}
              value={selectedNode.stroke?.align || "CENTER"}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.stroke = { ...(n.stroke || {}), align: e.target.value }
                })
              }
            >
              <option value="INSIDE">Inside</option>
              <option value="CENTER">Center</option>
              <option value="OUTSIDE">Outside</option>
            </select>
          </div>
        </div>

        {/* Corners */}
        <div className={styles.section}>
          <div className={styles.label}>Corner radius</div>
          <input
            type="number"
            min={0}
            className={styles.input}
            value={selectedNode.corners?.uniform ?? 0}
            onChange={(e) =>
              onUpdateSelected((n) => {
                const r = Math.max(0, Number(e.target.value) || 0)
                n.corners = { ...(n.corners || {}), uniform: r }
              })
            }
            style={{
              backgroundColor: '#f8f9fa',
              color: '#000000',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
        </div>

        {/* Text */}
        {selectedNode.text && (
          <div className={styles.section}>
            <div className={styles.label}>Text</div>
            <textarea
              className={`${styles.textarea}`}
              rows={3}
              value={selectedNode.text.characters || ""}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.text = { ...(n.text || {}), characters: e.target.value }
                })
              }
              style={{
                backgroundColor: '#f8f9fa',
                color: '#000000',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <div className={styles.grid2}>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={selectedNode.text.fontSize ?? 12}
                onChange={(e) =>
                  onUpdateSelected((n) => {
                    n.text = { ...(n.text || {}), fontSize: Number(e.target.value) || 12 }
                  })
                }
                style={{
                  backgroundColor: '#f8f9fa',
                  color: '#000000',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Font family"
                value={selectedNode.text.fontFamily || "system-ui"}
                onChange={(e) =>
                  onUpdateSelected((n) => {
                    n.text = { ...(n.text || {}), fontFamily: e.target.value }
                  })
                }
                style={{
                  backgroundColor: '#f8f9fa',
                  color: '#000000',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div className={styles.grid2}>
              <input
                type="color"
                className={styles.input}
                value={selectedNode.text.color || "#333333"}
                onChange={(e) =>
                  onUpdateSelected((n) => {
                    n.text = { ...(n.text || {}), color: e.target.value }
                  })
                }
              />
              <input
                type="number"
                min={0}
                step={0.1}
                className={styles.input}
                placeholder="Line height"
                value={selectedNode.text.lineHeight ?? ""}
                onChange={(e) =>
                  onUpdateSelected((n) => {
                    const v = e.target.value === "" ? null : Number(e.target.value)
                    n.text = { ...(n.text || {}), lineHeight: v as any }
                  })
                }
                style={{
                  backgroundColor: '#f8f9fa',
                  color: '#000000',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        )}

        {/* Shadow */}
        <div className={styles.section}>
          <div className={styles.label}>Shadow</div>
          <input
            type="text"
            className={styles.input}
            placeholder="e.g. 0px 4px 10px rgba(0,0,0,0.15)"
            value={selectedNode.effects?.find((e) => e?.boxShadow)?.boxShadow || ""}
            onChange={(e) =>
              onUpdateSelected((n) => {
                const effects = [...(n.effects || [])]
                const idx = effects.findIndex((x) => x?.boxShadow)
                const entry = { type: "DROP_SHADOW", boxShadow: e.target.value }
                if (idx >= 0) effects[idx] = entry as any
                else effects.push(entry as any)
                n.effects = effects as any
              })
            }
            style={{
              backgroundColor: '#f8f9fa',
              color: '#000000',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
        </div>
      </motion.aside>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => !uploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgb(32,32,32)',
                borderRadius: 16,
                padding: 32,
                maxWidth: 480,
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Upload Image</h2>
                {!uploading && (
                  <button
                    onClick={() => setShowUploadModal(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      fontSize: 24,
                      cursor: 'pointer',
                      padding: 4,
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <p style={{ margin: '0 0 24px', color: '#9ca3af', fontSize: 14 }}>
                Drop your image here or click to browse. Accepted formats: PNG, JPG, GIF, WebP
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploading && fileRef.current?.click()}
                style={{
                  border: dragActive ? '3px dashed #10b981' : '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  padding: 48,
                  textAlign: 'center',
                  cursor: uploading ? 'wait' : 'pointer',
                  background: dragActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.2s',
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                  {uploading ? '⏳' : dragActive ? '📥' : '🖼️'}
                </div>
                {uploading ? (
                  <>
                    <div style={{ color: '#10b981', fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
                      Uploading to server...
                    </div>
                    <div style={{ width: '100%', maxWidth: 300, marginBottom: 12 }}>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                            borderRadius: 4,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ color: '#d1fae5', fontSize: 14, fontWeight: 500 }}>
                      {progress}%
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>
                      {dragActive ? 'Drop it here!' : 'Drag & drop your image'}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 14 }}>
                      or click to browse files
                    </div>
                  </>
                )}
              </div>

              {uploadError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    color: '#fca5a5',
                    fontSize: 14
                  }}
                >
                  ⚠️ {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 8,
                    color: '#bbf7d0',
                    fontSize: 14
                  }}
                >
                  ✅ Upload successful
                </div>
              )}

             
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}