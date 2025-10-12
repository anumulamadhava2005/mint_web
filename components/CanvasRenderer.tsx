"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import type { DrawableNode } from "../lib/figma-types"
import { Box } from "./Box"
import styles from "./css/CanvasRenderer.module.css"

interface CanvasRendererProps {
  nodes: DrawableNode[]
  scale: number
  offset: { x: number; y: number }
  setOffset: (offset: { x: number; y: number }) => void
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
}

export function CanvasRenderer({ nodes, scale, offset, setOffset, selectedIds, setSelectedIds }: CanvasRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null)

  function renderNode(node: DrawableNode): React.ReactNode {
    const { x, y, width, height, children, ...rest } = node

    const style: React.CSSProperties = {
      position: "absolute",
      left: x * scale + offset.x,
      top: y * scale + offset.y,
      width: width * scale,
      height: height * scale,
      background: rest.fill?.color || "transparent",
      border:
        rest.stroke && rest.stroke.weight != null && rest.stroke.color
          ? `${rest.stroke.weight * scale}px solid ${rest.stroke.color}`
          : "none",
      borderRadius:
        rest.corners?.uniform != null
          ? rest.corners.uniform * scale
          : rest.corners
            ? `${(rest.corners.topLeft ?? 0) * scale}px ${(rest.corners.topRight ?? 0) * scale}px ${(rest.corners.bottomRight ?? 0) * scale}px ${(rest.corners.bottomLeft ?? 0) * scale}px`
            : undefined,
      boxShadow: rest.effects?.map((e) => e.boxShadow).join(", ") || undefined,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
    }

    if (node.type === "TEXT" && node.text) {
      if (node.text.color != null) style.color = node.text.color
      if (node.text.fontSize != null) style.fontSize = node.text.fontSize
      if (node.text.fontFamily != null) style.fontFamily = node.text.fontFamily
      if (node.text.textDecoration != null) style.textDecoration = node.text.textDecoration
    }

    const isSelected = selectedIds.has(node.id)
    if (isSelected) {
      style.outline = "2px solid #3b82f6"
      style.outlineOffset = "1px"
    }

    return (
      <Box
        key={node.id}
        style={style}
        dataName={node.name}
        isText={node.type === "TEXT"}
        text={node.text?.characters ?? undefined}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
          if (e.ctrlKey || e.metaKey) {
            const newIds = new Set(selectedIds)
            if (newIds.has(node.id)) {
              newIds.delete(node.id)
            } else {
              newIds.add(node.id)
            }
            setSelectedIds(newIds)
          } else {
            setSelectedIds(new Set([node.id]))
          }
        }}
      >
        {children && children.map(renderNode)}
      </Box>
    )
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleMouseDown(e: MouseEvent) {
      if (e.target === container) {
        setIsDragging(true)
        setLastPosition({ x: e.clientX, y: e.clientY })
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (isDragging && lastPosition) {
        const dx = e.clientX - lastPosition.x
        const dy = e.clientY - lastPosition.y
        setOffset({
          x: offset.x + dx,
          y: offset.y + dy,
        })
        setLastPosition({ x: e.clientX, y: e.clientY })
      }
    }

    function handleMouseUp() {
      setIsDragging(false)
      setLastPosition(null)
    }

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const intensity = 0.0015
        const dir = -e.deltaY
        const scaleFactor = 1 + dir * intensity
        if (!container) return
        // Calculate the point to zoom towards (mouse position)
        const rect = container.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        // Calculate new offset to zoom towards mouse position
        const newOffset = {
          x: x - (x - offset.x) * scaleFactor,
          y: y - (y - offset.y) * scaleFactor,
        }
        setOffset(newOffset)
      }
    }

    container.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("wheel", handleWheel)
    }
  }, [isDragging, lastPosition, offset, scale, setOffset])

  return (
    <div
      ref={containerRef}
      className={styles.root}
      onClick={() => setSelectedIds(new Set())}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <div className={styles.inner}>{nodes.map(renderNode)}</div>
    </div>
  )
}
