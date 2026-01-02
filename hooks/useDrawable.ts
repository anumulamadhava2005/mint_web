"use client";

import { useMemo } from "react";
import { DrawableNode, NodeInput, ReferenceFrame, FillStyle, StrokeStyle, Corners, EffectStyle, TextStyle } from "../lib/figma-types";
import { computeLayout, LayoutNode } from "../lib/layout/LayoutEngine";

/**
 * useDrawable - Converts raw Figma nodes to drawable nodes for canvas rendering
 * 
 * COORDINATE SYSTEM:
 * - Uses LayoutEngine to compute proper world coordinates
 * - x, y in raw nodes are RELATIVE to parent (local coordinates)
 * - ax, ay are IGNORED (editor viewport artifacts)
 * - World position is computed via parent traversal in LayoutEngine
 * 
 * FRAME vs RECTANGLE:
 * - FRAME: Layout container, owns coordinate space
 * - RECTANGLE: Pure visual node
 * 
 * Z-ORDER:
 * - Children render in array order (preserved by LayoutEngine)
 * - No position-based sorting
 */

export interface UseDrawableResult {
  drawableNodes: DrawableNode[];
  frameOptions: ReferenceFrame[];
  /** Map of node ID to parent ID */
  childToParentMap: Map<string, string>;
  /** Map of node ID to DrawableNode */
  nodeMap: Map<string, DrawableNode>;
}

export function useDrawable(rawRoots: NodeInput[] | null): UseDrawableResult {
  const { drawableNodes, childToParentMap, nodeMap } = useMemo(() => {
    if (!rawRoots) {
      return { 
        drawableNodes: [] as DrawableNode[], 
        childToParentMap: new Map<string, string>(), 
        nodeMap: new Map<string, DrawableNode>() 
      };
    }
    
    // Use LayoutEngine to compute proper coordinates
    const layoutResult = computeLayout(rawRoots);
    
    const out: DrawableNode[] = [];
    const nMap = new Map<string, DrawableNode>();
    
    // Convert LayoutNodes to DrawableNodes
    for (const layoutNode of layoutResult.nodes) {
      const drawable = layoutNodeToDrawable(layoutNode);
      out.push(drawable);
      nMap.set(drawable.id, drawable);
    }
    
    return { 
      drawableNodes: out, 
      childToParentMap: layoutResult.childToParentMap, 
      nodeMap: nMap 
    };
  }, [rawRoots]);

  const frameOptions = useMemo<ReferenceFrame[]>(() => {
    return drawableNodes
      .filter((n) => (n.type || "").toUpperCase() === "FRAME")
      .map((f) => ({
        id: f.id,
        name: f.name,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
  }, [drawableNodes]);

  return { drawableNodes, frameOptions, childToParentMap, nodeMap };
}

/**
 * Convert a LayoutNode to a DrawableNode
 */
function layoutNodeToDrawable(layoutNode: LayoutNode): DrawableNode {
  const raw = layoutNode.raw;
  
  // Extract text content
  const text = typeof raw.textContent === "string" 
    ? raw.textContent 
    : typeof raw.characters === "string" 
      ? raw.characters 
      : (raw as any).text?.characters ?? undefined;
  
  // Convert fill style
  let fill: FillStyle | null = null;
  let fills: FillStyle[] | undefined;
  if ((raw as any).fills && Array.isArray((raw as any).fills)) {
    fills = (raw as any).fills.map((f: any): FillStyle => ({
      type: f.type || 'SOLID',
      color: f.color,
      opacity: f.opacity,
      stops: f.gradientStops,
      imageRef: f.imageRef,
      fit: f.scaleMode,
    })).filter((f: FillStyle) => f && (f.color || f.stops || f.imageRef));
    fill = fills?.[0] ?? null;
  } else if ((raw as any).fill) {
    fill = (raw as any).fill;
  } else if ((raw as any).backgroundColor) {
    fill = { type: 'SOLID', color: (raw as any).backgroundColor };
  }
  
  // Convert stroke style
  let stroke: StrokeStyle | null = null;
  let strokes: StrokeStyle[] | undefined;
  if ((raw as any).strokes && Array.isArray((raw as any).strokes)) {
    strokes = (raw as any).strokes.map((s: any): StrokeStyle => ({
      color: s.color,
      weight: (raw as any).strokeWeight ?? s.weight ?? 1,
      align: (raw as any).strokeAlign ?? s.align,
      dashPattern: s.dashPattern,
    })).filter((s: StrokeStyle) => s && s.color);
    stroke = strokes?.[0] ?? null;
  } else if ((raw as any).stroke) {
    stroke = (raw as any).stroke;
  }
  
  // Convert corner radius
  let corners: Corners | undefined;
  if ((raw as any).cornerRadius != null) {
    corners = { uniform: (raw as any).cornerRadius };
  } else if ((raw as any).rectangleCornerRadii) {
    const r = (raw as any).rectangleCornerRadii;
    corners = { topLeft: r[0], topRight: r[1], bottomRight: r[2], bottomLeft: r[3] };
  } else if ((raw as any).corners) {
    corners = (raw as any).corners;
  }
  
  // Convert effects
  let effects: EffectStyle[] | undefined;
  if ((raw as any).effects && Array.isArray((raw as any).effects)) {
    effects = (raw as any).effects.map((e: any): EffectStyle => ({
      type: e.type,
      boxShadow: e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'
        ? `${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${e.color ?? 'rgba(0,0,0,0.25)'}`
        : undefined,
    })).filter((e: EffectStyle) => e && e.type);
  }
  
  // Convert text style
  let textStyle: TextStyle | undefined;
  if ((raw as any).style || (raw as any).text) {
    const s = (raw as any).style ?? (raw as any).text ?? {};
    textStyle = {
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      fontStyle: s.fontStyle,
      lineHeight: s.lineHeightPx ?? s.lineHeight,
      letterSpacing: s.letterSpacing,
      textDecoration: s.textDecoration,
      textCase: s.textCase,
      characters: text,
      color: s.fills?.[0]?.color ?? s.color,
      textAlignHorizontal: s.textAlignHorizontal ?? s.textAlign,
      textAlignVertical: s.textAlignVertical,
    };
  }
  
  const drawable: DrawableNode = {
    id: layoutNode.id,
    name: layoutNode.name,
    type: layoutNode.type,
    
    // Use WORLD coordinates from LayoutEngine (not local!)
    x: layoutNode.worldX,
    y: layoutNode.worldY,
    width: layoutNode.width,
    height: layoutNode.height,
    
    textContent: text ?? null,
    children: [],
    
    // Style properties
    fill,
    fills,
    stroke,
    strokes,
    corners,
    effects: effects as Array<Exclude<EffectStyle, null>> | undefined,
    text: textStyle,
    opacity: layoutNode.opacity,
    blendMode: (raw as any).blendMode,
    rotation: layoutNode.rotation,
    clipsContent: layoutNode.clipsContent,
    
    // Data binding
    dataSource: (raw as any).dataSource,
    dataBinding: (raw as any).dataBinding,
  };
  
  return drawable;
}
