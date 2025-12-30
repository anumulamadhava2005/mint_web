"use client";

import { useMemo } from "react";
import { DrawableNode, NodeInput, ReferenceFrame, FillStyle, StrokeStyle, Corners, EffectStyle, TextStyle } from "../lib/figma-types";

/**
 * useDrawable - Converts raw Figma nodes to drawable nodes for canvas rendering
 * 
 * Features:
 * - Proper coordinate computation (absolute vs relative)
 * - Fill, stroke, corner radius, effects support
 * - Text style support
 * - Parent-child relationship mapping
 * - Clip content support
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
    if (!rawRoots) return { drawableNodes: [] as DrawableNode[], childToParentMap: new Map<string, string>(), nodeMap: new Map<string, DrawableNode>() };
    
    const out: DrawableNode[] = [];
    const parentMap = new Map<string, string>();
    const nMap = new Map<string, DrawableNode>();
    
    const walk = (node: NodeInput, px: number, py: number, parentId: string | null) => {
      let ax: number | undefined,
        ay: number | undefined,
        aw: number | undefined,
        ah: number | undefined;
      
      // Determine absolute position
      if (node.absoluteBoundingBox) {
        ax = node.absoluteBoundingBox.x;
        ay = node.absoluteBoundingBox.y;
        aw = node.absoluteBoundingBox.width;
        ah = node.absoluteBoundingBox.height;
      } else if (node.x != null && node.y != null && node.width != null && node.height != null) {
        ax = (node.x ?? 0) + px;
        ay = (node.y ?? 0) + py;
        aw = node.width ?? 0;
        ah = node.height ?? 0;
      }
      
      // Extract text content
      const text = typeof node.textContent === "string" 
        ? node.textContent 
        : typeof node.characters === "string" 
          ? node.characters 
          : (node as any).text?.characters ?? undefined;

      if (ax != null && ay != null && aw != null && ah != null && aw > 0 && ah > 0) {
        // Track parent relationship
        if (parentId) {
          parentMap.set(node.id, parentId);
        }
        
        // Convert fill style
        let fill: FillStyle | null = null;
        let fills: FillStyle[] | undefined;
        if ((node as any).fills && Array.isArray((node as any).fills)) {
          fills = (node as any).fills.map((f: any): FillStyle => ({
            type: f.type || 'SOLID',
            color: f.color,
            opacity: f.opacity,
            stops: f.gradientStops,
            imageRef: f.imageRef,
            fit: f.scaleMode,
          })).filter((f: FillStyle) => f && (f.color || f.stops || f.imageRef));
          fill = fills?.[0] ?? null;
        } else if ((node as any).fill) {
          fill = (node as any).fill;
        } else if ((node as any).backgroundColor) {
          fill = { type: 'SOLID', color: (node as any).backgroundColor };
        }
        
        // Convert stroke style
        let stroke: StrokeStyle | null = null;
        let strokes: StrokeStyle[] | undefined;
        if ((node as any).strokes && Array.isArray((node as any).strokes)) {
          strokes = (node as any).strokes.map((s: any): StrokeStyle => ({
            color: s.color,
            weight: (node as any).strokeWeight ?? s.weight ?? 1,
            align: (node as any).strokeAlign ?? s.align,
            dashPattern: s.dashPattern,
          })).filter((s: StrokeStyle) => s && s.color);
          stroke = strokes?.[0] ?? null;
        } else if ((node as any).stroke) {
          stroke = (node as any).stroke;
        }
        
        // Convert corner radius
        let corners: Corners | undefined;
        if ((node as any).cornerRadius != null) {
          corners = { uniform: (node as any).cornerRadius };
        } else if ((node as any).rectangleCornerRadii) {
          const r = (node as any).rectangleCornerRadii;
          corners = { topLeft: r[0], topRight: r[1], bottomRight: r[2], bottomLeft: r[3] };
        }
        
        // Convert effects
        let effects: EffectStyle[] | undefined;
        if ((node as any).effects && Array.isArray((node as any).effects)) {
          effects = (node as any).effects.map((e: any): EffectStyle => ({
            type: e.type,
            boxShadow: e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'
              ? `${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${e.color ?? 'rgba(0,0,0,0.25)'}`
              : undefined,
          })).filter((e: EffectStyle) => e && e.type);
        }
        
        // Convert text style
        let textStyle: TextStyle | undefined;
        if ((node as any).style || (node as any).text) {
          const s = (node as any).style ?? (node as any).text ?? {};
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
          id: node.id,
          name: node.name ?? node.id,
          type: node.type ?? "NODE",
          x: ax,
          y: ay,
          width: aw,
          height: ah,
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
          opacity: (node as any).opacity,
          blendMode: (node as any).blendMode,
          rotation: (node as any).rotation,
          clipsContent: (node as any).clipsContent,
          // Data binding
          dataSource: (node as any).dataSource,
          dataBinding: (node as any).dataBinding,
        };
        
        out.push(drawable);
        nMap.set(node.id, drawable);
        
        // Compute child offset - if node has absoluteBoundingBox, children are relative to it
        const nx = node.absoluteBoundingBox ? ax : (node.x ?? 0) + px;
        const ny = node.absoluteBoundingBox ? ay : (node.y ?? 0) + py;
        node.children?.forEach((c) => walk(c, nx, ny, node.id));
      } else {
        node.children?.forEach((c) => walk(c, px, py, parentId));
      }
    };
    
    rawRoots.forEach((r) => walk(r, 0, 0, null));
    return { drawableNodes: out, childToParentMap: parentMap, nodeMap: nMap };
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
