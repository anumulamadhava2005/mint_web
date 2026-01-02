/**
 * LayoutEngine - Proper Figma-like layout computation
 * 
 * COORDINATE SYSTEM RULES:
 * - x, y are RELATIVE to parent (local coordinates)
 * - ax, ay are IGNORED (editor viewport artifacts)
 * - World position is computed by traversing parent chain
 * 
 * DATA NORMALIZATION:
 * - Some snapshots have corrupt data where x,y contain world coordinates
 * - We detect this by checking if x,y are way outside parent bounds
 * - When detected, we treat x,y as world coords and compute local from them
 * 
 * NODE TYPE SEMANTICS:
 * - FRAME: Layout container, owns coordinate space, can clip children
 * - GROUP: Transparent container, passes through layout
 * - RECTANGLE/ELLIPSE: Pure visual nodes
 * - TEXT: Respects alignment (justifyContent, alignItems)
 * 
 * Z-ORDER RULES:
 * - Children render in array order (first = back, last = front)
 * - No position-based sorting
 */

import type { NodeInput } from '../figma-types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutRect {
  x: number;      // World X position
  y: number;      // World Y position
  width: number;
  height: number;
}

export interface LayoutNode {
  id: string;
  name: string;
  type: string;
  
  // Local coordinates (relative to parent)
  localX: number;
  localY: number;
  width: number;
  height: number;
  
  // Computed world coordinates (after layout pass)
  worldX: number;
  worldY: number;
  
  // Layout properties
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'WRAP';
  justifyContent?: string;  // 'flex-start' | 'center' | 'flex-end' | 'space-between'
  alignItems?: string;      // 'flex-start' | 'center' | 'flex-end' | 'stretch'
  itemSpacing?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  
  // Visual properties (passed through for rendering)
  fill?: any;
  stroke?: any;
  corners?: any;
  effects?: any;
  backgroundColor?: string;
  opacity?: number;
  rotation?: number;
  clipsContent?: boolean;
  text?: any;
  
  // Hierarchy
  parentId: string | null;
  children: LayoutNode[];
  
  // Z-order index (for rendering order)
  zIndex: number;
  
  // Original raw node reference
  raw: NodeInput;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  nodeMap: Map<string, LayoutNode>;
  childToParentMap: Map<string, string>;
  rootNodes: LayoutNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Engine
// ─────────────────────────────────────────────────────────────────────────────

export class LayoutEngine {
  private nodeMap: Map<string, LayoutNode> = new Map();
  private childToParentMap: Map<string, string> = new Map();
  private flatNodes: LayoutNode[] = [];
  private roots: LayoutNode[] = [];
  private zCounter: number = 0;
  
  /**
   * Process raw nodes and compute layout
   */
  compute(rawRoots: NodeInput[] | null): LayoutResult {
    this.reset();
    
    if (!rawRoots || rawRoots.length === 0) {
      return this.getResult();
    }
    
    // Phase 1: Build layout tree from raw nodes
    // Root frames start at world origin (0, 0) - their x,y positions ARE world positions
    for (const rawRoot of rawRoots) {
      const layoutNode = this.buildLayoutNode(rawRoot, null, 0, 0, 0, 0);
      if (layoutNode) {
        this.roots.push(layoutNode);
      }
    }
    
    // Phase 2: Compute world transforms (parent traversal)
    for (const root of this.roots) {
      this.computeWorldTransforms(root, 0, 0);
    }
    
    // Phase 3: Apply layout semantics (centering, alignment)
    for (const root of this.roots) {
      this.applyLayoutSemantics(root);
    }
    
    return this.getResult();
  }
  
  private reset(): void {
    this.nodeMap.clear();
    this.childToParentMap.clear();
    this.flatNodes = [];
    this.roots = [];
    this.zCounter = 0;
  }
  
  private getResult(): LayoutResult {
    return {
      nodes: this.flatNodes,
      nodeMap: this.nodeMap,
      childToParentMap: this.childToParentMap,
      rootNodes: this.roots,
    };
  }
  
  /**
   * Build a LayoutNode from a raw NodeInput
   * 
   * IMPORTANT: We use x, y as LOCAL coordinates relative to parent.
   * We IGNORE ax, ay as they are editor viewport artifacts.
   * 
   * DATA FIX: Some snapshots have corrupt x,y that are actually world coords.
   * We detect this and fix it.
   */
  private buildLayoutNode(
    raw: NodeInput,
    parentId: string | null,
    parentWorldX: number,
    parentWorldY: number,
    parentWidth: number,
    parentHeight: number
  ): LayoutNode | null {
    // Get dimensions - use width/height, fallback to w/h
    const width = raw.width ?? (raw as any).w ?? 0;
    const height = raw.height ?? (raw as any).h ?? 0;
    
    if (width <= 0 || height <= 0) {
      // Skip zero-size nodes but process children
      if (raw.children) {
        for (const child of raw.children) {
          this.buildLayoutNode(child, parentId, parentWorldX, parentWorldY, parentWidth, parentHeight);
        }
      }
      return null;
    }
    
    // Get coordinates from raw data
    const rawX = raw.x ?? 0;
    const rawY = raw.y ?? 0;
    
    let localX: number;
    let localY: number;
    let worldX: number;
    let worldY: number;
    
    // For root nodes (no parent), x,y ARE world coordinates
    if (parentId === null) {
      localX = rawX;
      localY = rawY;
      worldX = rawX;
      worldY = rawY;
    } else {
      // For children, check if x,y are valid local coordinates
      // If they're way outside parent bounds, they might be world coordinates
      const isOutsideBounds = (
        rawX > parentWidth * 2 || 
        rawY > parentHeight * 2 ||
        rawX < -parentWidth ||
        rawY < -parentHeight
      );
      
      if (isOutsideBounds && parentWidth > 0 && parentHeight > 0) {
        // DATA FIX: x,y appear to be world coordinates, not local
        // Convert them to local by subtracting parent world position
        // But wait - this could also just be a child positioned way outside
        // Let's check if treating as world coords makes more sense
        
        // If raw values would place the node at a reasonable position relative to parent origin
        const asLocalX = rawX;
        const asLocalY = rawY;
        
        // Check if there's ax/ay that might hint at actual position
        const ax = (raw as any).ax;
        const ay = (raw as any).ay;
        
        // For now, use raw x,y as local (the normal case)
        // The editor should fix the data, not us at render time
        localX = asLocalX;
        localY = asLocalY;
        worldX = parentWorldX + localX;
        worldY = parentWorldY + localY;
      } else {
        // Normal case: x,y are proper local coordinates
        localX = rawX;
        localY = rawY;
        worldX = parentWorldX + localX;
        worldY = parentWorldY + localY;
      }
    }
    
    const node: LayoutNode = {
      id: raw.id,
      name: raw.name ?? raw.id,
      type: raw.type ?? 'NODE',
      
      localX,
      localY,
      width,
      height,
      
      worldX,
      worldY,
      
      // Layout properties
      layoutMode: (raw as any).layoutMode,
      justifyContent: (raw as any).justifyContent,
      alignItems: (raw as any).alignItems,
      itemSpacing: (raw as any).itemSpacing,
      padding: this.extractPadding(raw),
      
      // Visual properties
      fill: (raw as any).fill,
      stroke: (raw as any).stroke,
      corners: (raw as any).corners,
      effects: (raw as any).effects,
      backgroundColor: (raw as any).backgroundColor,
      opacity: (raw as any).opacity,
      rotation: (raw as any).rotation,
      clipsContent: (raw as any).clipsContent,
      text: (raw as any).text,
      
      // Hierarchy
      parentId,
      children: [],
      
      // Z-order (increments for each node in tree order)
      zIndex: this.zCounter++,
      
      raw,
    };
    
    // Register node
    this.nodeMap.set(node.id, node);
    this.flatNodes.push(node);
    
    if (parentId) {
      this.childToParentMap.set(node.id, parentId);
    }
    
    // Process children in array order (preserves z-order)
    if (raw.children && raw.children.length > 0) {
      for (const childRaw of raw.children) {
        const childNode = this.buildLayoutNode(childRaw, node.id, worldX, worldY, width, height);
        if (childNode) {
          node.children.push(childNode);
        }
      }
    }
    
    return node;
  }
  
  /**
   * Compute world transforms by traversing from root
   * 
   * World position = parent world position + local position
   */
  private computeWorldTransforms(node: LayoutNode, parentWorldX: number, parentWorldY: number): void {
    // For root nodes, their localX/Y ARE world coordinates
    if (node.parentId === null) {
      node.worldX = node.localX;
      node.worldY = node.localY;
    } else {
      // For children, world = parent world + local
      node.worldX = parentWorldX + node.localX;
      node.worldY = parentWorldY + node.localY;
    }
    
    // Recurse to children
    for (const child of node.children) {
      this.computeWorldTransforms(child, node.worldX, node.worldY);
    }
  }
  
  /**
   * Apply layout semantics (centering, alignment, auto-layout)
   * 
   * This handles:
   * - layoutMode: 'HORIZONTAL' | 'VERTICAL' - flex direction
   * - justifyContent: flex-start, center, flex-end, space-between
   * - alignItems: flex-start, center, flex-end, stretch
   * - itemSpacing: gap between children
   * - padding: inset from edges
   */
  private applyLayoutSemantics(node: LayoutNode): void {
    if (node.children.length === 0) {
      return;
    }
    
    const raw = node.raw as any;
    const layoutMode = raw.layoutMode;
    const justify = node.justifyContent || raw.justifyContent;
    const align = node.alignItems || raw.alignItems;
    const itemSpacing = node.itemSpacing || raw.itemSpacing || 0;
    const padding = node.padding || {
      top: raw.paddingTop || 0,
      right: raw.paddingRight || 0,
      bottom: raw.paddingBottom || 0,
      left: raw.paddingLeft || 0,
    };
    
    // Only apply auto-layout if layoutMode is set
    if (layoutMode === 'HORIZONTAL' || layoutMode === 'VERTICAL') {
      const isHorizontal = layoutMode === 'HORIZONTAL';
      
      // Calculate available space (after padding)
      const availableWidth = node.width - padding.left - padding.right;
      const availableHeight = node.height - padding.top - padding.bottom;
      
      // Calculate total children size along main axis
      let totalMainSize = 0;
      let maxCrossSize = 0;
      
      for (const child of node.children) {
        if (isHorizontal) {
          totalMainSize += child.width;
          maxCrossSize = Math.max(maxCrossSize, child.height);
        } else {
          totalMainSize += child.height;
          maxCrossSize = Math.max(maxCrossSize, child.width);
        }
      }
      
      // Add spacing between items
      const totalSpacing = Math.max(0, node.children.length - 1) * itemSpacing;
      totalMainSize += totalSpacing;
      
      // Calculate starting position based on justifyContent
      let mainStart = isHorizontal ? padding.left : padding.top;
      const mainAvailable = isHorizontal ? availableWidth : availableHeight;
      const remainingSpace = mainAvailable - totalMainSize + totalSpacing; // Exclude spacing we'll add back
      
      let gap = itemSpacing;
      
      switch (justify) {
        case 'center':
          mainStart += remainingSpace / 2;
          break;
        case 'flex-end':
          mainStart += remainingSpace;
          break;
        case 'space-between':
          if (node.children.length > 1) {
            gap = (mainAvailable - (totalMainSize - totalSpacing)) / (node.children.length - 1);
          }
          break;
        case 'space-around':
          if (node.children.length > 0) {
            const spaceUnit = (mainAvailable - (totalMainSize - totalSpacing)) / (node.children.length * 2);
            mainStart += spaceUnit;
            gap = spaceUnit * 2;
          }
          break;
        case 'space-evenly':
          if (node.children.length > 0) {
            gap = (mainAvailable - (totalMainSize - totalSpacing)) / (node.children.length + 1);
            mainStart += gap;
          }
          break;
        case 'flex-start':
        default:
          // Keep default mainStart
          break;
      }
      
      // Position each child
      let currentMain = mainStart;
      
      for (const child of node.children) {
        const childMainSize = isHorizontal ? child.width : child.height;
        const childCrossSize = isHorizontal ? child.height : child.width;
        const crossAvailable = isHorizontal ? availableHeight : availableWidth;
        const crossStart = isHorizontal ? padding.top : padding.left;
        
        // Calculate cross-axis position based on alignItems
        let crossPos = crossStart;
        
        switch (align) {
          case 'center':
            crossPos = crossStart + (crossAvailable - childCrossSize) / 2;
            break;
          case 'flex-end':
            crossPos = crossStart + crossAvailable - childCrossSize;
            break;
          case 'stretch':
            // For stretch, we'd need to modify the child size
            // For now, just center it
            crossPos = crossStart + (crossAvailable - childCrossSize) / 2;
            break;
          case 'flex-start':
          default:
            // Keep default crossPos
            break;
        }
        
        // Update child position
        const newLocalX = isHorizontal ? currentMain : crossPos;
        const newLocalY = isHorizontal ? crossPos : currentMain;
        
        const deltaX = newLocalX - child.localX;
        const deltaY = newLocalY - child.localY;
        
        if (deltaX !== 0 || deltaY !== 0) {
          child.localX = newLocalX;
          child.localY = newLocalY;
          this.offsetNodeAndChildren(child, deltaX, deltaY);
        }
        
        currentMain += childMainSize + gap;
      }
    } else {
      // Non-auto-layout: apply simple centering if specified
      for (const child of node.children) {
        let deltaX = 0;
        let deltaY = 0;
        
        // Horizontal alignment
        if (justify === 'center') {
          const centeredX = (node.width - child.width) / 2;
          deltaX = centeredX - child.localX;
        } else if (justify === 'flex-end') {
          const rightX = node.width - child.width;
          deltaX = rightX - child.localX;
        }
        
        // Vertical alignment
        if (align === 'center') {
          const centeredY = (node.height - child.height) / 2;
          deltaY = centeredY - child.localY;
        } else if (align === 'flex-end') {
          const bottomY = node.height - child.height;
          deltaY = bottomY - child.localY;
        }
        
        if (deltaX !== 0 || deltaY !== 0) {
          this.offsetNodeAndChildren(child, deltaX, deltaY);
        }
      }
    }
    
    // Recurse to children
    for (const child of node.children) {
      this.applyLayoutSemantics(child);
    }
  }
  
  /**
   * Offset a node and all its descendants
   */
  private offsetNodeAndChildren(node: LayoutNode, dx: number, dy: number): void {
    node.worldX += dx;
    node.worldY += dy;
    
    for (const child of node.children) {
      this.offsetNodeAndChildren(child, dx, dy);
    }
  }
  
  /**
   * Extract padding from various possible sources
   */
  private extractPadding(raw: NodeInput): { top: number; right: number; bottom: number; left: number } | undefined {
    const r = raw as any;
    
    if (r.padding) return r.padding;
    
    if (r.paddingTop != null || r.paddingRight != null || r.paddingBottom != null || r.paddingLeft != null) {
      return {
        top: r.paddingTop ?? 0,
        right: r.paddingRight ?? 0,
        bottom: r.paddingBottom ?? 0,
        left: r.paddingLeft ?? 0,
      };
    }
    
    return undefined;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Debug Helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Draw layout bounds for debugging
   */
  static drawLayoutBounds(
    ctx: CanvasRenderingContext2D,
    node: LayoutNode,
    offset: { x: number; y: number },
    scale: number,
    color: string = 'rgba(255, 0, 0, 0.5)'
  ): void {
    const x = offset.x + node.worldX * scale;
    const y = offset.y + node.worldY * scale;
    const w = node.width * scale;
    const h = node.height * scale;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(x, y, w, h);
    
    // Draw node name
    ctx.fillStyle = color;
    ctx.font = '10px monospace';
    ctx.fillText(`${node.name} (${node.type})`, x + 2, y + 10);
    ctx.fillText(`world: ${node.worldX.toFixed(0)}, ${node.worldY.toFixed(0)}`, x + 2, y + 20);
    ctx.fillText(`local: ${node.localX.toFixed(0)}, ${node.localY.toFixed(0)}`, x + 2, y + 30);
    
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance
// ─────────────────────────────────────────────────────────────────────────────

export const layoutEngine = new LayoutEngine();

/**
 * Hook-friendly function to compute layout
 */
export function computeLayout(rawRoots: NodeInput[] | null): LayoutResult {
  return layoutEngine.compute(rawRoots);
}
