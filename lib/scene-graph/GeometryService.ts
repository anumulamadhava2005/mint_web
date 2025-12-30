/**
 * GeometryService - Unified geometry computation using TransformEngine
 * 
 * Single source of truth for:
 * - Canvas selection frames
 * - DOM preview layout
 * - Hit-testing
 * 
 * Replaces ad-hoc absoluteBoundingBox resolution with consistent
 * TransformEngine-based computations.
 */

import {
  TransformEngine,
  Matrix2D,
  Point2D,
  BoundingBox,
  transformPoint,
  decompose,
  identity,
  translate,
  rotate,
  multiply,
  cloneMatrix,
  roundForDisplay,
} from '../canvas-engine/transform';

import type { SceneNode } from './SceneNode';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Computed geometry for a node */
export interface NodeGeometry {
  /** Node ID */
  id: string;
  /** World-space bounding box (axis-aligned) */
  bounds: BoundingBox;
  /** World transform matrix */
  worldTransform: Matrix2D;
  /** Display-ready values (rounded) */
  display: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number; // degrees
  };
  /** Oriented bounding box corners in world space */
  corners: Point2D[];
  /** Center point in world space */
  center: Point2D;
}

/** Selection frame (for canvas selection UI) */
export interface SelectionFrame {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isLocked: boolean;
}

/** Hit test result */
export interface HitTestResult {
  nodeId: string;
  depth: number; // Z-depth for stacking
  bounds: BoundingBox;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class GeometryService {
  private transformEngine: TransformEngine;
  private geometryCache: Map<string, NodeGeometry> = new Map();
  private cacheVersion: number = 0;
  
  constructor() {
    this.transformEngine = new TransformEngine();
  }
  
  // ─── Sync with Scene Graph ───
  
  /**
   * Sync geometry from scene graph nodes
   * This should be called whenever the scene graph changes
   */
  syncFromSceneGraph(nodes: Map<string, SceneNode>): void {
    this.transformEngine.clear();
    this.geometryCache.clear();
    this.cacheVersion++;
    
    // Register all nodes with LOCAL transforms; world will be recomputed
    nodes.forEach((node) => {
      this.transformEngine.registerNode(
        node.id,
        node.parentId,
        cloneMatrix(node.localTransform),
        { width: node.size.width, height: node.size.height }
      );
    });

    // Ensure world transforms are consistent across the tree
    this.transformEngine.recomputeAllWorldTransforms();
    
    // Pre-compute geometry for all nodes
    nodes.forEach((node) => {
      this.computeGeometry(node.id, node.name, node.locked);
    });
  }
  
  /**
   * Update a single node's transform
   */
  updateNodeTransform(id: string, worldTransform: Matrix2D, size: { width: number; height: number }): void {
    const existing = this.transformEngine.getNode(id);
    if (existing) {
      this.transformEngine.setLocalTransform(id, worldTransform);
      this.transformEngine.setSize(id, size);
    } else {
      this.transformEngine.registerNode(id, null, worldTransform, size);
    }
    
    // Invalidate cache for this node
    this.geometryCache.delete(id);
  }
  
  // ─── Geometry Computation ───
  
  /**
   * Compute and cache geometry for a node
   */
  private computeGeometry(id: string, name: string = '', locked: boolean = false): NodeGeometry | null {
    const cached = this.geometryCache.get(id);
    if (cached) return cached;
    
    const nodeTransform = this.transformEngine.getNode(id);
    if (!nodeTransform) return null;
    
    const bounds = this.transformEngine.getWorldBounds(id);
    if (!bounds) return null;
    
    const corners = this.transformEngine.getWorldCorners(id);
    if (!corners) return null;
    
    const components = decompose(nodeTransform.worldTransform);
    
    const geometry: NodeGeometry = {
      id,
      bounds,
      worldTransform: cloneMatrix(nodeTransform.worldTransform),
      display: {
        x: roundForDisplay(bounds.x),
        y: roundForDisplay(bounds.y),
        width: roundForDisplay(nodeTransform.size.width),
        height: roundForDisplay(nodeTransform.size.height),
        rotation: roundForDisplay(components.rotation * (180 / Math.PI)),
      },
      corners,
      center: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      },
    };
    
    this.geometryCache.set(id, geometry);
    return geometry;
  }
  
  /**
   * Get computed geometry for a node
   */
  getGeometry(id: string): NodeGeometry | null {
    const cached = this.geometryCache.get(id);
    if (cached) return cached;
    
    // Try to compute if not cached
    return this.computeGeometry(id);
  }
  
  /**
   * Get all computed geometries
   */
  getAllGeometries(): Map<string, NodeGeometry> {
    return new Map(this.geometryCache);
  }
  
  // ─── Selection Frames ───
  
  /**
   * Get selection frame for a node (used by canvas selection UI)
   */
  getSelectionFrame(id: string, name: string, locked: boolean = false): SelectionFrame | null {
    const geometry = this.getGeometry(id);
    if (!geometry) return null;
    
    return {
      id,
      name,
      x: geometry.display.x,
      y: geometry.display.y,
      width: geometry.display.width,
      height: geometry.display.height,
      rotation: geometry.display.rotation,
      isLocked: locked,
    };
  }
  
  /**
   * Get selection frames for multiple nodes
   */
  getSelectionFrames(nodes: Array<{ id: string; name: string; locked?: boolean }>): Map<string, SelectionFrame> {
    const frames = new Map<string, SelectionFrame>();
    
    for (const node of nodes) {
      const frame = this.getSelectionFrame(node.id, node.name, node.locked ?? false);
      if (frame) {
        frames.set(node.id, frame);
      }
    }
    
    return frames;
  }
  
  // ─── DOM Preview Layout ───
  
  /**
   * Get CSS position values for DOM rendering
   */
  getCSSPosition(id: string): { left: string; top: string; width: string; height: string; transform?: string } | null {
    const geometry = this.getGeometry(id);
    if (!geometry) return null;
    
    const result: { left: string; top: string; width: string; height: string; transform?: string } = {
      left: `${geometry.display.x}px`,
      top: `${geometry.display.y}px`,
      width: `${geometry.display.width}px`,
      height: `${geometry.display.height}px`,
    };
    
    if (geometry.display.rotation !== 0) {
      result.transform = `rotate(${geometry.display.rotation}deg)`;
    }
    
    return result;
  }
  
  /**
   * Get bounds for DOM layout (for flex children, relative positioning)
   */
  getLayoutBounds(id: string, parentId: string | null): { x: number; y: number; width: number; height: number } | null {
    const geometry = this.getGeometry(id);
    if (!geometry) return null;
    
    let x = geometry.display.x;
    let y = geometry.display.y;
    
    // If has parent, make position relative to parent
    if (parentId) {
      const parentGeometry = this.getGeometry(parentId);
      if (parentGeometry) {
        x -= parentGeometry.display.x;
        y -= parentGeometry.display.y;
      }
    }
    
    return {
      x: roundForDisplay(x),
      y: roundForDisplay(y),
      width: geometry.display.width,
      height: geometry.display.height,
    };
  }
  
  // ─── Hit Testing ───
  
  /**
   * Hit test at world coordinates
   * Returns nodes that contain the point, sorted by depth (topmost first)
   */
  hitTest(worldX: number, worldY: number, nodeIds: string[]): HitTestResult[] {
    const results: HitTestResult[] = [];
    const point = { x: worldX, y: worldY };
    
    for (let depth = nodeIds.length - 1; depth >= 0; depth--) {
      const id = nodeIds[depth];
      if (this.pointInNode(point, id)) {
        const bounds = this.transformEngine.getWorldBounds(id);
        if (bounds) {
          results.push({ nodeId: id, depth, bounds });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Hit test single node (AABB check)
   */
  hitTestNode(worldX: number, worldY: number, id: string): boolean {
    return this.pointInNode({ x: worldX, y: worldY }, id);
  }
  
  /**
   * Check if point is inside node's bounding box
   */
  private pointInNode(point: Point2D, id: string): boolean {
    const geometry = this.getGeometry(id);
    if (!geometry) return false;
    
    const { bounds } = geometry;
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }
  
  /**
   * Check if point is inside node (precise, handles rotation)
   */
  pointInNodePrecise(worldX: number, worldY: number, id: string): boolean {
    const nodeTransform = this.transformEngine.getNode(id);
    if (!nodeTransform) return false;
    
    // Transform point to node's local space
    const localPoint = this.transformEngine.worldToLocalPoint(id, { x: worldX, y: worldY });
    if (!localPoint) return false;
    
    // Check if in local bounds (0,0 to width,height)
    return (
      localPoint.x >= 0 &&
      localPoint.x <= nodeTransform.size.width &&
      localPoint.y >= 0 &&
      localPoint.y <= nodeTransform.size.height
    );
  }
  
  /**
   * Find topmost node at position
   */
  findTopmostNode(
    worldX: number,
    worldY: number,
    orderedNodeIds: string[],
    filter?: (id: string) => boolean
  ): string | null {
    // Iterate from end (topmost) to start (bottommost)
    for (let i = orderedNodeIds.length - 1; i >= 0; i--) {
      const id = orderedNodeIds[i];
      
      if (filter && !filter(id)) continue;
      
      if (this.pointInNode({ x: worldX, y: worldY }, id)) {
        return id;
      }
    }
    
    return null;
  }
  
  /**
   * Find all nodes intersecting a rectangle (for marquee selection)
   */
  findNodesInRect(
    rect: BoundingBox,
    nodeIds: string[],
    mode: 'intersect' | 'contain' = 'intersect'
  ): string[] {
    const results: string[] = [];
    
    for (const id of nodeIds) {
      const geometry = this.getGeometry(id);
      if (!geometry) continue;
      
      const { bounds } = geometry;
      
      if (mode === 'contain') {
        // Node must be fully inside rect
        if (
          bounds.x >= rect.x &&
          bounds.y >= rect.y &&
          bounds.x + bounds.width <= rect.x + rect.width &&
          bounds.y + bounds.height <= rect.y + rect.height
        ) {
          results.push(id);
        }
      } else {
        // Node must intersect rect
        if (
          bounds.x < rect.x + rect.width &&
          bounds.x + bounds.width > rect.x &&
          bounds.y < rect.y + rect.height &&
          bounds.y + bounds.height > rect.y
        ) {
          results.push(id);
        }
      }
    }
    
    return results;
  }
  
  // ─── Coordinate Conversion ───
  
  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number, offset: Point2D, scale: number): Point2D {
    return this.transformEngine.screenToWorld({ x: screenX, y: screenY }, offset, scale);
  }
  
  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number, offset: Point2D, scale: number): Point2D {
    return this.transformEngine.worldToScreen({ x: worldX, y: worldY }, offset, scale);
  }
  
  /**
   * Convert world point to node's local space
   */
  worldToLocal(id: string, worldPoint: Point2D): Point2D | null {
    return this.transformEngine.worldToLocalPoint(id, worldPoint);
  }
  
  /**
   * Convert node's local point to world space
   */
  localToWorld(id: string, localPoint: Point2D): Point2D | null {
    return this.transformEngine.localToWorldPoint(id, localPoint);
  }
  
  // ─── Snapping ───
  
  /**
   * Get snap result for a position
   */
  snap(point: Point2D, excludeIds: Set<string> = new Set()) {
    return this.transformEngine.snap(point, excludeIds);
  }
  
  /**
   * Get snap result for bounds (dragging)
   */
  snapBounds(bounds: BoundingBox, excludeIds: Set<string> = new Set()) {
    return this.transformEngine.snapBounds(bounds, excludeIds);
  }
  
  /**
   * Configure snapping behavior
   */
  setSnapConfig(config: Parameters<typeof this.transformEngine.setSnapConfig>[0]) {
    this.transformEngine.setSnapConfig(config);
  }
  
  // ─── Direct Transform Access ───
  
  /**
   * Get the underlying transform engine (for advanced operations)
   */
  getTransformEngine(): TransformEngine {
    return this.transformEngine;
  }
  
  /**
   * Get world transform matrix for a node
   */
  getWorldTransform(id: string): Matrix2D | null {
    return this.transformEngine.getWorldTransform(id);
  }
  
  /**
   * Get world bounds for a node
   */
  getWorldBounds(id: string): BoundingBox | null {
    return this.transformEngine.getWorldBounds(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const geometryService = new GeometryService();
