/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import type React from "react"

import { useRef, useState } from "react"
import type { NodeInput } from "../lib/figma-types"
import { motion } from "framer-motion"
import styles from "./css/PropertiesPanel.module.css"

export default function PropertiesPanel(props: {
  selectedNode: NodeInput | null
  onUpdateSelected: (mut: (n: NodeInput) => void) => void
  images?: Record<string, string> // optional: map nodeId/name -> URL (for preview sync)
  onImageChange?: (id: string, url: string) => void // optional callback to sync external caches
  onClose?: () => void
}) {
  const { selectedNode, onUpdateSelected, images, onImageChange, onClose } = props
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [localImg, setLocalImg] = useState<string | null>(null)

  if (!selectedNode) return null

  const nodeKey = selectedNode.id || selectedNode.name
  const currentImage =
    localImg ??
    (typeof selectedNode.fill?.imageRef === "string" ? selectedNode.fill?.imageRef : null) ??
    ((images ? images[nodeKey] || null : null) || null)

  function setImageUrl(url: string) {
    setLocalImg(url)
    onUpdateSelected((n) => {
      const prev = n.fill && n.fill.type === "IMAGE" ? n.fill : null
      n.fill = { type: "IMAGE", imageRef: url, ...(prev || {}) } as any
    })
    if (onImageChange) onImageChange(nodeKey, url)
  }

  function clearImage() {
    setLocalImg(null)
    onUpdateSelected((n) => {
      // Remove image fill; keep other fill types if desired. Here we null it.
      if (n.fill?.type === "IMAGE") n.fill = null
    })
    if (onImageChange) onImageChange(nodeKey, "")
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Convert to a local preview URL (data URL) for immediate rendering
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || "")
      if (url) setImageUrl(url)
    }
    reader.readAsDataURL(file)
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

    // Validate as URL; allow empty string
    function validate(value: string) {
      if (!value) return true
      try {
        // Accept http(s) or data:image/...;base64
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
      onPreview(v) // live preview as the user types
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

        {/* Inline URL preview box */}
        {url ? (
          <div className={styles.inlinePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url || "/placeholder.svg"}
              alt="URL preview"
              className={styles.imgContain}
              onError={() => setIsValid(false)}
              onLoad={() => setIsValid(true)}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        width: '18rem',
        borderLeft: '1px solid rgb(48,48,48)',
        background: 'rgb(48,48,48)',
        color: '#fff',
        padding: '1rem',
        overflowY: 'auto',
        minHeight: 0
      }}
    >
      {/* Header */}
      <div className={styles.header} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className={styles.title}>Properties</div>
          <div className={styles.subtle}>{selectedNode.name || selectedNode.id}</div>
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
          />
        </div>
      </div>

      {/* Image */}
      <div className={styles.section}>
        <div className={styles.label}>Image</div>

        {/* URL input with preview */}
        <ImageUrlField
          initialUrl={currentImage || ""}
          onPreview={(u) => setLocalImg(u || null)}
          onApply={(u) => {
            if (u && u.trim()) setImageUrl(u.trim())
          }}
          onClear={() => clearImage()}
        />

        {/* File upload */}
        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.btn}`}
            onClick={() => fileRef.current?.click()}
          >
            Upload File
          </button>
          <span className={styles.hint}>PNG/JPG</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className={styles.hidden} onChange={handleFile} />

        {/* Final preview */}
        {currentImage && (
          <div className={styles.finalPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage || "/placeholder.svg"}
              alt="Preview"
              className={styles.imgContain}
            />
          </div>
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
        />
      </div>
    </motion.aside>
  )
}
