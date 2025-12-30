/**
 * HitTestService - Proper scene graph hit testing
 * 
 * Z-ORDER RULES:
 * - children[] array order determines render/z-order
 * - Earlier children render BEHIND later children (painter's algorithm)
 * - Hit testing traverses in REVERSE order to find topmost (last) child first
 * - This matches Canvas draw order and DOM document order
 * 
 * Features:
 * - Depth-first traversal (reverse children[] order for topmost-first)
 * - Respects visibility and locked flags
 * - Prefers deepest child under cursor
 * - Falls back to bounding-box hit
 * - Handles clipping containers
 */

import type { SceneNode } from './SceneNode';
import { geometryService, type NodeGeometry } from './GeometryService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Hit test result with full context */
export interface HitTestResult {
  /** The node ID that was hit */
  nodeId: string;
  /** Depth in tree (0 = root) */
  depth: number;
  /** Node type */
  type: string;
  /** Whether node is locked */
  isLocked: boolean;
  /** Parent chain from root to this node */
  parentChain: string[];
  /** World bounds of hit node */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** Options for hit testing */
export interface HitTestOptions {
  /** Include invisible nodes (default: false) */
  includeInvisible?: boolean;
  /** Include locked nodes (default: true, but marks them) */
  includeLocked?: boolean;
  /** Skip these node IDs */
  excludeIds?: Set<string>;
  /** Only test these node IDs (if provided) */
  includeIds?: Set<string>;
  /** Respect clipsContent for containers (default: true) */
  respectClipping?: boolean;
  /** Return all hits, not just topmost (default: false) */
  returnAll?: boolean;
  /** Filter function for custom exclusions */
  filter?: (node: SceneNode) => boolean;
}

/** Point for hit testing */
export interface Point {
  x: number;
  y: number;
}

/** Rectangle for marquee hit testing */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HitTestService Class
// ─────────────────────────────────────────────────────────────────────────────

export class HitTestService {
  private sceneGraph: Map<string, SceneNode> | null = null;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Sync
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Sync with scene graph
   */
  sync(sceneGraph: Map<string, SceneNode>): void {
    this.sceneGraph = sceneGraph;
  }
  
  /**
   * Clear scene graph reference
   */
  clear(): void {
    this.sceneGraph = null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Point Hit Testing
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Hit test at world coordinates.
   * Returns the topmost (deepest visible) node under the point.
   */
  hitTestPoint(point: Point, options: HitTestOptions = {}): HitTestResult | null {
    if (!this.sceneGraph || this.sceneGraph.size === 0) return null;
    
    const results = this.hitTestPointAll(point, options);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * Hit test at world coordinates, returning all hits.
   * Results are sorted topmost-first (deepest child first).
   */
  hitTestPointAll(point: Point, options: HitTestOptions = {}): HitTestResult[] {
    if (!this.sceneGraph || this.sceneGraph.size === 0) return [];
    
    const {
      includeInvisible = false,
      includeLocked = true,
      excludeIds,
      includeIds,
      respectClipping = true,
      filter,
    } = options;
    
    const results: HitTestResult[] = [];
    
    // Collect root nodes preserving insertion order from sceneGraph
    const roots: SceneNode[] = [];
    this.sceneGraph.forEach(node => {
      if (node.parentId === null) {
        roots.push(node);
      }
    });
    
    // Traverse roots in REVERSE order because:
    // - children[] order is the z-order (earlier = behind, later = on top)
    // - We want to find the topmost (last) node first for hit testing
    // - DO NOT sort by position - children[] IS the explicit z-order
    for (let i = roots.length - 1; i >= 0; i--) {
      this.traverseForHit(
        roots[i],
        point,
        0,
        [],
        true, // isInClipBounds - root is always in bounds
        results,
        { includeInvisible, includeLocked, excludeIds, includeIds, respectClipping, filter }
      );
    }
    
    return results;
  }
  
  /**
   * Recursive depth-first traversal for hit testing.
   * 
   * Children are processed in REVERSE children[] order because:
   * - children[] order determines z-order (painter's algorithm)
   * - Later children in the array are rendered ON TOP of earlier children
   * - We want to hit test topmost (last) children first
   */
  private traverseForHit(
    node: SceneNode,
    point: Point,
    depth: number,
    parentChain: string[],
    isInClipBounds: boolean,
    results: HitTestResult[],
    options: {
      includeInvisible: boolean;
      includeLocked: boolean;
      excludeIds?: Set<string>;
      includeIds?: Set<string>;
      respectClipping: boolean;
      filter?: (node: SceneNode) => boolean;
    }
  ): void {
    // Visibility check
    if (!options.includeInvisible && !node.visible) return;
    
    // Exclusion check
    if (options.excludeIds?.has(node.id)) return;
    
    // Inclusion check
    if (options.includeIds && !options.includeIds.has(node.id)) return;
    
    // Custom filter
    if (options.filter && !options.filter(node)) return;
    
    // Locked check (still process, but mark as locked)
    const isLocked = node.locked;
    if (!options.includeLocked && isLocked) return;
    
    // Get geometry for bounds check
    const geometry = geometryService.getGeometry(node.id);
    if (!geometry) return;
    
    const bounds = geometry.bounds;
    const isPointInBounds = this.pointInBounds(point, bounds);
    
    // If parent clips content and we're outside clip bounds, skip entirely
    if (options.respectClipping && !isInClipBounds) return;
    
    // Determine if point is in this node's clip bounds
    let childClipBounds = isInClipBounds;
    if (node.clipsContent) {
      childClipBounds = isPointInBounds;
    }
    
    // First, traverse children in reverse order (topmost first)
    // This ensures we find the deepest (topmost) child first
    const childChain = [...parentChain, node.id];
    for (let i = node.children.length - 1; i >= 0; i--) {
      const childId = node.children[i];
      const child = this.sceneGraph!.get(childId);
      if (child) {
        this.traverseForHit(
          child,
          point,
          depth + 1,
          childChain,
          childClipBounds,
          results,
          options
        );
      }
    }
    
    // Then check this node (so children are added before parent in results)
    if (isPointInBounds) {
      results.push({
        nodeId: node.id,
        depth,
        type: node.type,
        isLocked,
        parentChain,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Rectangle Hit Testing (Marquee Selection)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Find all nodes intersecting a rectangle (marquee selection).
   * By default returns nodes that intersect; use mode='contain' for fully contained only.
   */
  hitTestRect(rect: Rect, options: HitTestOptions & { mode?: 'intersect' | 'contain' } = {}): HitTestResult[] {
    if (!this.sceneGraph || this.sceneGraph.size === 0) return [];
    
    const {
      includeInvisible = false,
      includeLocked = true,
      excludeIds,
      includeIds,
      filter,
      mode = 'intersect',
    } = options;
    
    const results: HitTestResult[] = [];
    
    // Find root nodes
    const roots: SceneNode[] = [];
    this.sceneGraph.forEach(node => {
      if (node.parentId === null) {
        roots.push(node);
      }
    });
    
    // Traverse each root tree
    for (const root of roots) {
      this.traverseForRectHit(
        root,
        rect,
        0,
        [],
        results,
        { includeInvisible, includeLocked, excludeIds, includeIds, filter, mode }
      );
    }
    
    return results;
  }
  
  /**
   * Recursive traversal for rectangle hit testing.
   */
  private traverseForRectHit(
    node: SceneNode,
    rect: Rect,
    depth: number,
    parentChain: string[],
    results: HitTestResult[],
    options: {
      includeInvisible: boolean;
      includeLocked: boolean;
      excludeIds?: Set<string>;
      includeIds?: Set<string>;
      filter?: (node: SceneNode) => boolean;
      mode: 'intersect' | 'contain';
    }
  ): void {
    // Visibility check
    if (!options.includeInvisible && !node.visible) return;
    
    // Exclusion check
    if (options.excludeIds?.has(node.id)) return;
    
    // Inclusion check
    if (options.includeIds && !options.includeIds.has(node.id)) return;
    
    // Custom filter
    if (options.filter && !options.filter(node)) return;
    
    // Locked check
    const isLocked = node.locked;
    if (!options.includeLocked && isLocked) return;
    
    // Get geometry
    const geometry = geometryService.getGeometry(node.id);
    if (!geometry) return;
    
    const bounds = geometry.bounds;
    
    // Check intersection/containment
    const doesIntersect = options.mode === 'contain'
      ? this.rectContains(rect, bounds)
      : this.rectsIntersect(rect, bounds);
    
    if (doesIntersect) {
      results.push({
        nodeId: node.id,
        depth,
        type: node.type,
        isLocked,
        parentChain,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      });
    }
    
    // Traverse children
    const childChain = [...parentChain, node.id];
    for (const childId of node.children) {
      const child = this.sceneGraph!.get(childId);
      if (child) {
        this.traverseForRectHit(child, rect, depth + 1, childChain, results, options);
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Find Specific Nodes
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Find the deepest selectable (non-locked, visible) node at point
   */
  findSelectableNode(point: Point): HitTestResult | null {
    return this.hitTestPoint(point, {
      includeLocked: false,
      includeInvisible: false,
    });
  }
  
  /**
   * Find all selectable nodes at point (for multi-selection or click-through)
   */
  findAllSelectableNodes(point: Point): HitTestResult[] {
    return this.hitTestPointAll(point, {
      includeLocked: false,
      includeInvisible: false,
      returnAll: true,
    });
  }
  
  /**
   * Find the container frame at point (for inserting new nodes)
   */
  findContainerFrame(point: Point): HitTestResult | null {
    const hits = this.hitTestPointAll(point, {
      includeLocked: false,
      includeInvisible: false,
      filter: (node) => node.type === 'FRAME',
    });
    
    // Return the deepest frame
    return hits.length > 0 ? hits[0] : null;
  }
  
  /**
   * Find parent frame for a given point (for creation tools)
   */
  findParentFrameForPoint(point: Point, fallbackFrameId?: string): string | null {
    const frame = this.findContainerFrame(point);
    if (frame) return frame.nodeId;
    if (fallbackFrameId) return fallbackFrameId;
    
    // Return first root frame if nothing found
    if (!this.sceneGraph) return null;
    for (const node of this.sceneGraph.values()) {
      if (node.parentId === null && node.type === 'FRAME') {
        return node.id;
      }
    }
    return null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if a point is inside bounds
   */
  private pointInBounds(point: Point, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }
  
  /**
   * Check if two rectangles intersect
   */
  private rectsIntersect(a: Rect, b: { x: number; y: number; width: number; height: number }): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }
  
  /**
   * Check if rect fully contains bounds
   */
  private rectContains(rect: Rect, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return (
      bounds.x >= rect.x &&
      bounds.y >= rect.y &&
      bounds.x + bounds.width <= rect.x + rect.width &&
      bounds.y + bounds.height <= rect.y + rect.height
    );
  }
  
  /**
   * Get the parent of a node
   */
  getParent(nodeId: string): SceneNode | null {
    if (!this.sceneGraph) return null;
    const node = this.sceneGraph.get(nodeId);
    if (!node || !node.parentId) return null;
    return this.sceneGraph.get(node.parentId) ?? null;
  }
  
  /**
   * Check if nodeId is a descendant of ancestorId
   */
  isDescendantOf(nodeId: string, ancestorId: string): boolean {
    if (!this.sceneGraph) return false;
    
    let current = this.sceneGraph.get(nodeId);
    while (current) {
      if (current.parentId === ancestorId) return true;
      if (!current.parentId) return false;
      current = this.sceneGraph.get(current.parentId);
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const hitTestService = new HitTestService();
