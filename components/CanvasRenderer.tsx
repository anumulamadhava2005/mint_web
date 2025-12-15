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
      boxSizing: "border-box",
    }

    // Apply background color
    if ((rest as any).backgroundColor) {
      style.backgroundColor = (rest as any).backgroundColor;
    }

    // Apply auto layout properties
    if ((rest as any).layoutMode) {
      const layoutMode = (rest as any).layoutMode;
      if (layoutMode === "HORIZONTAL") {
        style.display = "flex";
        style.flexDirection = "row";
      } else if (layoutMode === "VERTICAL") {
        style.display = "flex";
        style.flexDirection = "column";
      }
    }

    // Apply flex direction override
    if ((rest as any).flexDirection) {
      style.display = "flex";
      style.flexDirection = (rest as any).flexDirection;
    }

    // Apply padding (scaled)
    if ((rest as any).paddingTop != null) style.paddingTop = `${(rest as any).paddingTop * scale}px`;
    if ((rest as any).paddingRight != null) style.paddingRight = `${(rest as any).paddingRight * scale}px`;
    if ((rest as any).paddingBottom != null) style.paddingBottom = `${(rest as any).paddingBottom * scale}px`;
    if ((rest as any).paddingLeft != null) style.paddingLeft = `${(rest as any).paddingLeft * scale}px`;

    // Apply gap (item spacing, scaled)
    if ((rest as any).itemSpacing != null) {
      style.gap = `${(rest as any).itemSpacing * scale}px`;
    }

    // Apply justify content
    if ((rest as any).justifyContent) {
      style.justifyContent = (rest as any).justifyContent;
    }

    // Apply align items
    if ((rest as any).alignItems) {
      style.alignItems = (rest as any).alignItems;
    }

    // Apply text alignment
    if ((rest as any).textAlign) {
      style.textAlign = (rest as any).textAlign;
    }

    // Apply rotation transform
    if (rest.rotation != null && rest.rotation !== 0) {
      style.transform = `rotate(${rest.rotation}deg)`;
      style.transformOrigin = "center center";
    }

    // Apply node-level opacity (different from fill opacity)
    if (rest.opacity != null && rest.opacity < 1) {
      style.opacity = rest.opacity;
    }

    // Apply blend mode
    if (rest.blendMode && rest.blendMode !== "PASS_THROUGH" && rest.blendMode !== "NORMAL") {
      const blendModeMap: Record<string, string> = {
        DARKEN: "darken",
        MULTIPLY: "multiply",
        COLOR_BURN: "color-burn",
        LIGHTEN: "lighten",
        SCREEN: "screen",
        COLOR_DODGE: "color-dodge",
        OVERLAY: "overlay",
        SOFT_LIGHT: "soft-light",
        HARD_LIGHT: "hard-light",
        DIFFERENCE: "difference",
        EXCLUSION: "exclusion",
        HUE: "hue",
        SATURATION: "saturation",
        COLOR: "color",
        LUMINOSITY: "luminosity",
      };
      const cssMixBlendMode = blendModeMap[rest.blendMode];
      if (cssMixBlendMode) {
        style.mixBlendMode = cssMixBlendMode as any;
      }
    }

    // Apply clipping
    if (rest.clipsContent) {
      style.overflow = "hidden";
    }

    const isText = node.type === "TEXT";

    // Handle multiple fills (render from bottom to top)
    const fillsToRender = rest.fills && rest.fills.length > 0 ? rest.fills : (rest.fill ? [rest.fill] : []);
    if (!isText && fillsToRender.length > 0) {
      const backgrounds: string[] = [];
      
      for (const fill of fillsToRender) {
        if (!fill) continue;
        
        if (fill.type === "SOLID" && fill.color) {
          backgrounds.push(fill.color);
        } else if (fill.type && fill.type.toUpperCase().includes("GRADIENT") && fill.stops) {
          const stops = fill.stops.map(s => `${s.color} ${(s.position * 100).toFixed(1)}%`).join(", ");
          if (fill.type.toUpperCase().includes("RADIAL")) {
            backgrounds.push(`radial-gradient(circle, ${stops})`);
          } else {
            backgrounds.push(`linear-gradient(180deg, ${stops})`);
          }
        } else if (fill.type === "IMAGE" && fill.imageRef) {
          const size = fill.fit === "contain" ? "contain" : fill.fit === "fill" ? "100% 100%" : "cover";
          backgrounds.push(`url(${fill.imageRef})`);
          style.backgroundSize = size;
          style.backgroundPosition = "center";
          style.backgroundRepeat = "no-repeat";
        }
      }
      
      if (backgrounds.length > 0) {
        style.background = backgrounds.join(", ");
      }
    }

    // Handle multiple strokes (render all strokes)
    const strokesToRender = rest.strokes && rest.strokes.length > 0 ? rest.strokes : (rest.stroke ? [rest.stroke] : []);
    if (!isText && strokesToRender.length > 0) {
      const stroke = strokesToRender[0];
      if (stroke && stroke.weight) {
        const weight = stroke.weight * scale;
        const color = stroke.color || "#000";
        const dashPattern = stroke.dashPattern;
        const align = stroke.align || "CENTER";
        
        style.borderWidth = `${weight}px`;
        style.borderStyle = (dashPattern && dashPattern.length > 0) ? "dashed" : "solid";
        style.borderColor = color;
        
        // Simulate stroke alignment
        if (align === "INSIDE") {
          // Default CSS behavior
        } else if (align === "OUTSIDE") {
          style.outline = `${weight}px ${(dashPattern && dashPattern.length > 0) ? "dashed" : "solid"} ${color}`;
          style.outlineOffset = "0px";
          style.border = "none";
        }
      }
    }

    // Handle corner radius
    if (rest.corners) {
      if (rest.corners.uniform != null) {
        style.borderRadius = `${rest.corners.uniform * scale}px`;
      } else {
        const tl = (rest.corners.topLeft ?? 0) * scale;
        const tr = (rest.corners.topRight ?? 0) * scale;
        const br = (rest.corners.bottomRight ?? 0) * scale;
        const bl = (rest.corners.bottomLeft ?? 0) * scale;
        style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
      }
    }

    // Handle effects (shadows)
    if (rest.effects && rest.effects.length > 0) {
      style.boxShadow = rest.effects.map((e) => e.boxShadow).filter(Boolean).join(", ");
    }

    // Handle text styling
    if (isText && node.text) {
      if (node.text.color != null) style.color = node.text.color;
      if (node.text.fontSize != null) style.fontSize = `${node.text.fontSize * scale}px`;
      if (node.text.fontFamily != null) style.fontFamily = node.text.fontFamily;
      if (node.text.fontStyle != null) style.fontStyle = node.text.fontStyle;
      if (node.text.lineHeight != null) {
        style.lineHeight = typeof node.text.lineHeight === 'number' 
          ? (node.text.lineHeight > 3 ? `${node.text.lineHeight * scale}px` : node.text.lineHeight)
          : node.text.lineHeight;
      }
      if (node.text.letterSpacing != null) {
        style.letterSpacing = typeof node.text.letterSpacing === 'number'
          ? `${node.text.letterSpacing * scale}px`
          : node.text.letterSpacing;
      }
      if (node.text.textDecoration != null) style.textDecoration = node.text.textDecoration;
      if ((node.text as any).textCase === "UPPER") style.textTransform = "uppercase";
      if ((node.text as any).textCase === "LOWER") style.textTransform = "lowercase";
      if ((node.text as any).textCase === "TITLE") style.textTransform = "capitalize";
      
      // Apply text alignment
      if ((node.text as any).textAlignHorizontal) {
        const align = (node.text as any).textAlignHorizontal;
        if (align === "LEFT") style.textAlign = "left";
        else if (align === "CENTER") style.textAlign = "center";
        else if (align === "RIGHT") style.textAlign = "right";
        else if (align === "JUSTIFIED") style.textAlign = "justify";
      }
      
      if ((node.text as any).textAlignVertical) {
        const vAlign = (node.text as any).textAlignVertical;
        style.display = "flex";
        style.flexDirection = "column";
        if (vAlign === "TOP") style.justifyContent = "flex-start";
        else if (vAlign === "CENTER") style.justifyContent = "center";
        else if (vAlign === "BOTTOM") style.justifyContent = "flex-end";
      }
      
      if ((node.text as any).paragraphIndent) {
        style.textIndent = `${(node.text as any).paragraphIndent * scale}px`;
      }
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
      style={{ cursor: isDragging ? "grabbing" : "grab", overflow: 'hidden' }}
    >
      <div className={styles.inner}>{nodes.map(renderNode)}</div>
    </div>
  )
}
