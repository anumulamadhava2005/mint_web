/**
 * CanvasLayoutBridge - Bridges LayoutEngine to Canvas 2D rendering
 * 
 * Resolves auto-layout numerically so Canvas 2D can render with visual parity
 * to DOM preview without any flexbox dependency.
 */

import type { SceneNode } from '../../scene-graph';
import { LayoutEngine, layoutEngine, ComputedLayout, LayoutNode } from './LayoutEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Resolved box for canvas rendering - all positions are world coordinates */
export interface ResolvedBox {
  id: string;
  name: string;
  type: string;
  /** World X position (absolute, ready for canvas) */
  x: number;
  /** World Y position (absolute, ready for canvas) */
  y: number;
  /** Computed width */
  width: number;
  /** Computed height */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  /** Opacity (0-1) */
  opacity: number;
  /** Whether visible */
  visible: boolean;
  /** Whether to clip children */
  clipsContent: boolean;
  /** Z-index for draw order */
  zIndex: number;
  /** Parent ID for hierarchy */
  parentId: string | null;
  /** Reference to source SceneNode for style access */
  sceneNode: SceneNode;
}

/** Options for layout resolution */
export interface ResolveOptions {
  /** Round positions to pixel boundaries */
  roundToPixels?: boolean;
  /** Viewport width for root constraints */
  viewportWidth?: number;
  /** Viewport height for root constraints */
  viewportHeight?: number;
  /** Whether to include invisible nodes */
  includeInvisible?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CanvasLayoutBridge Class
// ─────────────────────────────────────────────────────────────────────────────

export class CanvasLayoutBridge {
  private engine: LayoutEngine;
  private cache: Map<string, ComputedLayout> = new Map();
  private lastSceneGraphVersion: number = 0;
  
  constructor(engine?: LayoutEngine) {
    this.engine = engine ?? layoutEngine;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Resolve layout for a SceneGraph and return flat list of boxes for canvas rendering.
   * Boxes are returned in draw order (parents before children, respecting z-index).
   */
  resolve(
    sceneGraph: Map<string, SceneNode>,
    options: ResolveOptions = {}
  ): ResolvedBox[] {
    if (sceneGraph.size === 0) return [];
    
    // Compute layouts using LayoutEngine
    const layouts = this.engine.computeFromSceneGraph(sceneGraph, {
      roundToPixels: options.roundToPixels ?? true,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
    });
    
    this.cache = layouts;
    
    // Convert to flat list in draw order
    return this.flattenInDrawOrder(sceneGraph, layouts, options);
  }
  
  /**
   * Get resolved box for a single node (after resolve() has been called)
   */
  getResolvedBox(nodeId: string, sceneGraph: Map<string, SceneNode>): ResolvedBox | null {
    const layout = this.cache.get(nodeId);
    const node = sceneGraph.get(nodeId);
    if (!layout || !node) return null;
    
    return this.createResolvedBox(node, layout, 0);
  }
  
  /**
   * Get computed layout for a node
   */
  getComputedLayout(nodeId: string): ComputedLayout | undefined {
    return this.cache.get(nodeId);
  }
  
  /**
   * Invalidate cache (call when scene graph changes)
   */
  invalidate(): void {
    this.cache.clear();
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Flatten scene graph into draw order array.
   * 
   * Z-ORDER RULES:
   * - Order is determined by children[] array order
   * - Earlier children render BEFORE (behind) later children
   * - This matches DOM document order and canvas painter's algorithm
   * - LayersPanel drag-and-drop updates children[] to reorder
   * - NO implicit z-index assumptions - children[] is the single source of truth
   */
  private flattenInDrawOrder(
    sceneGraph: Map<string, SceneNode>,
    layouts: Map<string, ComputedLayout>,
    options: ResolveOptions
  ): ResolvedBox[] {
    const result: ResolvedBox[] = [];
    
    // Collect root nodes preserving their insertion order from sceneGraph
    // (Map iteration order is insertion order in JS)
    const roots: SceneNode[] = [];
    sceneGraph.forEach(node => {
      if (node.parentId === null) {
        roots.push(node);
      }
    });
    
    // DO NOT sort roots - children[] order is the explicit z-order
    // Earlier roots render behind later roots (painter's algorithm)
    
    // Traverse each root tree in order
    let globalZIndex = 0;
    for (const root of roots) {
      globalZIndex = this.traverseNode(
        root,
        sceneGraph,
        layouts,
        result,
        globalZIndex,
        options
      );
    }
    
    return result;
  }
  
  /**
   * Recursively traverse a node and its children in draw order.
   * Children are processed in children[] array order (first child draws first/behind).
   * This is the painter's algorithm: earlier items are painted behind later items.
   */
  private traverseNode(
    node: SceneNode,
    sceneGraph: Map<string, SceneNode>,
    layouts: Map<string, ComputedLayout>,
    result: ResolvedBox[],
    zIndex: number,
    options: ResolveOptions
  ): number {
    // Skip invisible nodes unless requested
    if (!node.visible && !options.includeInvisible) {
      return zIndex;
    }
    
    const layout = layouts.get(node.id);
    if (!layout) return zIndex;
    
    // Add this node (parent renders before children)
    const box = this.createResolvedBox(node, layout, zIndex);
    result.push(box);
    zIndex++;
    
    // Process children in children[] order - this IS the z-order
    // Earlier children render behind later children (painter's algorithm)
    for (const childId of node.children) {
      const child = sceneGraph.get(childId);
      if (child) {
        zIndex = this.traverseNode(child, sceneGraph, layouts, result, zIndex, options);
      }
    }
    
    return zIndex;
  }
  
  private createResolvedBox(
    node: SceneNode,
    layout: ComputedLayout,
    zIndex: number
  ): ResolvedBox {
    // Extract rotation from world transform
    const rotation = Math.atan2(node.worldTransform[1], node.worldTransform[0]) * (180 / Math.PI);
    
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      x: layout.worldX,
      y: layout.worldY,
      width: layout.width,
      height: layout.height,
      rotation,
      opacity: node.styles.opacity,
      visible: node.visible,
      clipsContent: node.clipsContent,
      zIndex,
      parentId: node.parentId,
      sceneNode: node,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const canvasLayoutBridge = new CanvasLayoutBridge();

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Convert ResolvedBox to DrawableNode-compatible format
// ─────────────────────────────────────────────────────────────────────────────

import type { DrawableNode, FillStyle, StrokeStyle, Corners, EffectStyle, TextStyle } from '../../figma-types';

/**
 * Convert a ResolvedBox to DrawableNode format for canvas-draw.ts compatibility
 */
export function resolvedBoxToDrawable(box: ResolvedBox): DrawableNode {
  const node = box.sceneNode;
  
  // Convert fills
  const fills: FillStyle[] = node.styles.fills
    .filter(f => f.visible)
    .map(f => ({
      type: f.type,
      color: f.color,
      opacity: f.opacity,
      stops: f.stops,
      imageRef: f.imageRef,
      fit: f.imageFit,
    }));
  
  // Convert strokes
  const strokes: StrokeStyle[] = node.styles.strokes
    .filter(s => s.visible)
    .map(s => ({
      color: s.color,
      weight: s.weight,
      align: s.align,
      dashPattern: s.dashPattern,
    }));
  
  // Convert corners
  const corners: Corners = node.styles.corners.topLeft === node.styles.corners.topRight &&
    node.styles.corners.topRight === node.styles.corners.bottomRight &&
    node.styles.corners.bottomRight === node.styles.corners.bottomLeft
      ? { uniform: node.styles.corners.topLeft }
      : {
          topLeft: node.styles.corners.topLeft,
          topRight: node.styles.corners.topRight,
          bottomRight: node.styles.corners.bottomRight,
          bottomLeft: node.styles.corners.bottomLeft,
        };
  
  // Convert effects
  const effects: EffectStyle[] = node.styles.effects
    .filter(e => e.visible)
    .map(e => {
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
        return {
          type: e.type,
          boxShadow: `${inset}${e.offsetX ?? 0}px ${e.offsetY ?? 0}px ${e.blur ?? 0}px ${e.spread ?? 0}px ${e.color ?? 'rgba(0,0,0,0.25)'}`,
        };
      }
      return { type: e.type };
    });
  
  // Convert text style
  let text: TextStyle | undefined;
  if (node.styles.text) {
    const t = node.styles.text;
    text = {
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
      fontStyle: t.fontStyle,
      lineHeight: typeof t.lineHeight === 'number' ? t.lineHeight : undefined,
      letterSpacing: t.letterSpacing,
      textDecoration: t.textDecoration,
      textCase: t.textTransform === 'uppercase' ? 'UPPER' : t.textTransform === 'lowercase' ? 'LOWER' : t.textTransform === 'capitalize' ? 'TITLE' : undefined,
      characters: node.textContent,
      color: t.color,
      textAlignHorizontal: t.textAlign === 'left' ? 'LEFT' : t.textAlign === 'center' ? 'CENTER' : t.textAlign === 'right' ? 'RIGHT' : t.textAlign === 'justify' ? 'JUSTIFIED' : undefined,
      textAlignVertical: t.verticalAlign === 'top' ? 'TOP' : t.verticalAlign === 'center' ? 'CENTER' : t.verticalAlign === 'bottom' ? 'BOTTOM' : undefined,
    };
  }
  
  return {
    id: box.id,
    name: box.name,
    type: box.type,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    children: [], // Flat list - no nested children
    textContent: node.textContent,
    fill: fills[0] ?? null,
    fills: fills.length > 0 ? fills : null,
    stroke: strokes[0] ?? null,
    strokes: strokes.length > 0 ? strokes : null,
    corners,
    effects: effects.length > 0 ? (effects as Array<Exclude<EffectStyle, null>>) : null,
    text,
    opacity: box.opacity,
    blendMode: node.styles.blendMode,
    rotation: box.rotation,
    clipsContent: box.clipsContent,
  };
}

/**
 * Convert all resolved boxes to DrawableNode array
 */
export function resolvedBoxesToDrawables(boxes: ResolvedBox[]): DrawableNode[] {
  return boxes.map(resolvedBoxToDrawable);
}
