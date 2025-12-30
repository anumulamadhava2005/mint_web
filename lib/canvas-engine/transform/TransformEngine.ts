/**
 * TransformEngine - Manages local ↔ world transforms with matrix math
 * 
 * Responsibilities:
 * - Local ↔ world transform conversions
 * - Parent-child propagation
 * - Rotation, scale, translate via matrices
 * - Snapping-ready numeric output
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 2D Affine Transform Matrix (3x3, stored as 6 values)
 * 
 * | a  c  tx |   | scaleX  skewX   translateX |
 * | b  d  ty | = | skewY   scaleY  translateY |
 * | 0  0  1  |   | 0       0       1          |
 * 
 * Stored as [a, b, c, d, tx, ty]
 */
export type Matrix2D = [number, number, number, number, number, number];

/** Point in 2D space */
export interface Point2D {
  x: number;
  y: number;
}

/** Size in 2D space */
export interface Size2D {
  width: number;
  height: number;
}

/** Bounding box */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Decomposed transform components */
export interface TransformComponents {
  translateX: number;
  translateY: number;
  rotation: number; // radians
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}

/** Node transform data */
export interface NodeTransform {
  id: string;
  parentId: string | null;
  localTransform: Matrix2D;
  worldTransform: Matrix2D;
  size: Size2D;
  pivot: Point2D; // Rotation/scale pivot (0-1, relative to size)
}

/** Snapping configuration */
export interface SnapConfig {
  enabled: boolean;
  gridSize: number;
  threshold: number; // Snap threshold in pixels
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGuides: boolean;
}

/** Snap result */
export interface SnapResult {
  snapped: Point2D;
  guides: SnapGuide[];
  didSnap: boolean;
}

/** Snap guide line */
export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  label?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix Math Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Identity matrix */
export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

/** Create identity matrix */
export function identity(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/** Create translation matrix */
export function translate(tx: number, ty: number): Matrix2D {
  return [1, 0, 0, 1, tx, ty];
}

/** Create rotation matrix (radians, around origin) */
export function rotate(angle: number): Matrix2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos, 0, 0];
}

/** Create scale matrix */
export function scale(sx: number, sy: number = sx): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

/** Create skew matrix (radians) */
export function skew(ax: number, ay: number): Matrix2D {
  return [1, Math.tan(ay), Math.tan(ax), 1, 0, 0];
}

/** Multiply two matrices: result = a * b */
export function multiply(a: Matrix2D, b: Matrix2D): Matrix2D {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;
  
  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ];
}

/** Multiply multiple matrices left to right */
export function multiplyAll(...matrices: Matrix2D[]): Matrix2D {
  return matrices.reduce(multiply, identity());
}

/** Compute inverse of a matrix */
export function invert(m: Matrix2D): Matrix2D | null {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  
  if (Math.abs(det) < 1e-10) {
    return null; // Singular matrix
  }
  
  const invDet = 1 / det;
  
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (c * ty - d * tx) * invDet,
    (b * tx - a * ty) * invDet,
  ];
}

/** Transform a point by a matrix */
export function transformPoint(m: Matrix2D, p: Point2D): Point2D {
  const [a, b, c, d, tx, ty] = m;
  return {
    x: a * p.x + c * p.y + tx,
    y: b * p.x + d * p.y + ty,
  };
}

/** Transform a vector (direction) by a matrix (ignores translation) */
export function transformVector(m: Matrix2D, v: Point2D): Point2D {
  const [a, b, c, d] = m;
  return {
    x: a * v.x + c * v.y,
    y: b * v.x + d * v.y,
  };
}

/** Decompose matrix into components */
export function decompose(m: Matrix2D): TransformComponents {
  const [a, b, c, d, tx, ty] = m;
  
  // Scale
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);
  
  // Rotation (from first column)
  const rotation = Math.atan2(b, a);
  
  // Skew
  const skewX = Math.atan2(a * c + b * d, scaleX * scaleX);
  const skewY = 0; // Assuming no Y skew in standard decomposition
  
  return {
    translateX: tx,
    translateY: ty,
    rotation,
    scaleX,
    scaleY,
    skewX,
    skewY,
  };
}

/** Compose matrix from components */
export function compose(components: Partial<TransformComponents>): Matrix2D {
  const {
    translateX = 0,
    translateY = 0,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    skewX = 0,
    skewY = 0,
  } = components;
  
  // Build: T * R * Sk * S
  return multiplyAll(
    translate(translateX, translateY),
    rotate(rotation),
    skew(skewX, skewY),
    scale(scaleX, scaleY)
  );
}

/** Create rotation matrix around a pivot point */
export function rotateAround(angle: number, pivot: Point2D): Matrix2D {
  return multiplyAll(
    translate(pivot.x, pivot.y),
    rotate(angle),
    translate(-pivot.x, -pivot.y)
  );
}

/** Create scale matrix around a pivot point */
export function scaleAround(sx: number, sy: number, pivot: Point2D): Matrix2D {
  return multiplyAll(
    translate(pivot.x, pivot.y),
    scale(sx, sy),
    translate(-pivot.x, -pivot.y)
  );
}

/** Check if two matrices are approximately equal */
export function matrixEquals(a: Matrix2D, b: Matrix2D, epsilon = 1e-6): boolean {
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
}

/** Clone a matrix */
export function cloneMatrix(m: Matrix2D): Matrix2D {
  return [...m] as Matrix2D;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapping Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Round to nearest grid value */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Snap point to grid */
export function snapPointToGrid(p: Point2D, gridSize: number): Point2D {
  return {
    x: snapToGrid(p.x, gridSize),
    y: snapToGrid(p.y, gridSize),
  };
}

/** Round for display (avoid floating point noise) */
export function roundForDisplay(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Round point for display */
export function roundPointForDisplay(p: Point2D, decimals = 2): Point2D {
  return {
    x: roundForDisplay(p.x, decimals),
    y: roundForDisplay(p.y, decimals),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Engine Class
// ─────────────────────────────────────────────────────────────────────────────

export class TransformEngine {
  private nodes: Map<string, NodeTransform> = new Map();
  private snapConfig: SnapConfig = {
    enabled: true,
    gridSize: 1,
    threshold: 5,
    snapToGrid: false,
    snapToObjects: true,
    snapToGuides: true,
  };
  
  // ─── Node Management ───
  
  /** Register a node with its transform */
  registerNode(
    id: string,
    parentId: string | null,
    localTransform: Matrix2D,
    size: Size2D,
    pivot: Point2D = { x: 0.5, y: 0.5 }
  ): void {
    const worldTransform = this.computeWorldTransform(localTransform, parentId);
    
    this.nodes.set(id, {
      id,
      parentId,
      localTransform: cloneMatrix(localTransform),
      worldTransform,
      size,
      pivot,
    });
  }
  
  /** Update node's local transform */
  setLocalTransform(id: string, localTransform: Matrix2D): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    node.localTransform = cloneMatrix(localTransform);
    node.worldTransform = this.computeWorldTransform(localTransform, node.parentId);
    
    // Propagate to children
    this.propagateToChildren(id);
  }
  
  /** Update node's size */
  setSize(id: string, size: Size2D): void {
    const node = this.nodes.get(id);
    if (node) {
      node.size = { ...size };
    }
  }
  
  /** Update node's parent */
  setParent(id: string, newParentId: string | null): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Keep world position constant when reparenting
    const worldPos = this.getWorldPosition(id);
    node.parentId = newParentId;
    
    if (worldPos) {
      // Compute new local transform that maintains world position
      const newLocalTransform = this.worldToLocal(node.worldTransform, newParentId);
      if (newLocalTransform) {
        node.localTransform = newLocalTransform;
      }
    }
    
    node.worldTransform = this.computeWorldTransform(node.localTransform, newParentId);
    this.propagateToChildren(id);
  }
  
  /** Remove a node */
  unregisterNode(id: string): void {
    this.nodes.delete(id);
  }
  
  /** Clear all nodes */
  clear(): void {
    this.nodes.clear();
  }
  
  /** Get node transform */
  getNode(id: string): NodeTransform | undefined {
    return this.nodes.get(id);
  }
  
  /** Get all nodes */
  getAllNodes(): Map<string, NodeTransform> {
    return this.nodes;
  }
  
  // ─── Transform Computation ───
  
  /** Compute world transform from local transform and parent */
  private computeWorldTransform(localTransform: Matrix2D, parentId: string | null): Matrix2D {
    if (!parentId) {
      // Root node: parent is identity; world = I × local
      return cloneMatrix(localTransform);
    }
    
    const parent = this.nodes.get(parentId);
    if (!parent) {
      return cloneMatrix(localTransform);
    }
    
    return multiply(parent.worldTransform, localTransform);
  }
  
  /** Convert world transform to local transform */
  private worldToLocal(worldTransform: Matrix2D, parentId: string | null): Matrix2D | null {
    if (!parentId) {
      return cloneMatrix(worldTransform);
    }
    
    const parent = this.nodes.get(parentId);
    if (!parent) {
      return cloneMatrix(worldTransform);
    }
    
    const parentInverse = invert(parent.worldTransform);
    if (!parentInverse) return null;
    
    return multiply(parentInverse, worldTransform);
  }
  
  /** Propagate transform changes to all children */
  private propagateToChildren(parentId: string): void {
    this.nodes.forEach((node) => {
      if (node.parentId === parentId) {
        node.worldTransform = this.computeWorldTransform(node.localTransform, node.parentId);
        this.propagateToChildren(node.id);
      }
    });
  }

  /**
   * Recompute world transforms for the entire tree.
   * Handles arbitrary registration order by walking from roots.
   */
  recomputeAllWorldTransforms(): void {
    // Build adjacency list of children
    const childrenMap = new Map<string | null, string[]>();
    this.nodes.forEach((node) => {
      const key = node.parentId;
      const arr = childrenMap.get(key) ?? [];
      arr.push(node.id);
      childrenMap.set(key, arr);
    });

    const visit = (id: string, parentId: string | null) => {
      const node = this.nodes.get(id);
      if (!node) return;
      node.worldTransform = this.computeWorldTransform(node.localTransform, parentId);
      const kids = childrenMap.get(id) ?? [];
      for (const childId of kids) visit(childId, id);
    };

    // Start from roots (parentId === null)
    const roots = childrenMap.get(null) ?? [];
    for (const rootId of roots) visit(rootId, null);
  }
  
  // ─── Position & Bounds Queries ───
  
  /** Get world position (translation component) */
  getWorldPosition(id: string): Point2D | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    return {
      x: node.worldTransform[4],
      y: node.worldTransform[5],
    };
  }
  
  /** Get local position */
  getLocalPosition(id: string): Point2D | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    return {
      x: node.localTransform[4],
      y: node.localTransform[5],
    };
  }
  
  /** Get world rotation (radians) */
  getWorldRotation(id: string): number | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const { rotation } = decompose(node.worldTransform);
    return rotation;
  }
  
  /** Get local rotation (radians) */
  getLocalRotation(id: string): number | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const { rotation } = decompose(node.localTransform);
    return rotation;
  }
  
  /** Get world scale */
  getWorldScale(id: string): Point2D | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const { scaleX, scaleY } = decompose(node.worldTransform);
    return { x: scaleX, y: scaleY };
  }
  
  /** Get axis-aligned bounding box in world space */
  getWorldBounds(id: string): BoundingBox | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    // Transform all four corners
    const corners = [
      { x: 0, y: 0 },
      { x: node.size.width, y: 0 },
      { x: node.size.width, y: node.size.height },
      { x: 0, y: node.size.height },
    ].map(p => transformPoint(node.worldTransform, p));
    
    // Find AABB
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  
  /** Get oriented bounding box corners in world space */
  getWorldCorners(id: string): Point2D[] | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    return [
      transformPoint(node.worldTransform, { x: 0, y: 0 }),
      transformPoint(node.worldTransform, { x: node.size.width, y: 0 }),
      transformPoint(node.worldTransform, { x: node.size.width, y: node.size.height }),
      transformPoint(node.worldTransform, { x: 0, y: node.size.height }),
    ];
  }
  
  // ─── Transform Operations ───
  
  /** Translate node in world space */
  translateWorld(id: string, dx: number, dy: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Apply delta to local transform
    node.localTransform[4] += dx;
    node.localTransform[5] += dy;
    
    node.worldTransform = this.computeWorldTransform(node.localTransform, node.parentId);
    this.propagateToChildren(id);
  }
  
  /** Translate node in local space */
  translateLocal(id: string, dx: number, dy: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Transform delta to local space
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        const parentInverse = invert(parent.worldTransform);
        if (parentInverse) {
          const localDelta = transformVector(parentInverse, { x: dx, y: dy });
          dx = localDelta.x;
          dy = localDelta.y;
        }
      }
    }
    
    node.localTransform[4] += dx;
    node.localTransform[5] += dy;
    
    node.worldTransform = this.computeWorldTransform(node.localTransform, node.parentId);
    this.propagateToChildren(id);
  }
  
  /** Set world position directly */
  setWorldPosition(id: string, x: number, y: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    const currentWorld = this.getWorldPosition(id);
    if (!currentWorld) return;
    
    const dx = x - currentWorld.x;
    const dy = y - currentWorld.y;
    
    this.translateWorld(id, dx, dy);
  }
  
  /** Rotate node around its pivot (in world space) */
  rotateWorld(id: string, deltaAngle: number): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Get pivot in world space
    const localPivot = {
      x: node.size.width * node.pivot.x,
      y: node.size.height * node.pivot.y,
    };
    const worldPivot = transformPoint(node.worldTransform, localPivot);
    
    // Create rotation around pivot
    const rotationMatrix = rotateAround(deltaAngle, worldPivot);
    
    // Apply to world transform
    const newWorldTransform = multiply(rotationMatrix, node.worldTransform);
    
    // Convert back to local
    const newLocalTransform = this.worldToLocal(newWorldTransform, node.parentId);
    if (newLocalTransform) {
      node.localTransform = newLocalTransform;
      node.worldTransform = newWorldTransform;
      this.propagateToChildren(id);
    }
  }
  
  /** Set absolute rotation (radians, in world space) */
  setWorldRotation(id: string, angle: number): void {
    const currentAngle = this.getWorldRotation(id);
    if (currentAngle === null) return;
    
    const delta = angle - currentAngle;
    this.rotateWorld(id, delta);
  }
  
  /** Scale node around its pivot */
  scaleWorld(id: string, sx: number, sy: number = sx): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Get pivot in world space
    const localPivot = {
      x: node.size.width * node.pivot.x,
      y: node.size.height * node.pivot.y,
    };
    const worldPivot = transformPoint(node.worldTransform, localPivot);
    
    // Create scale around pivot
    const scaleMatrix = scaleAround(sx, sy, worldPivot);
    
    // Apply to world transform
    const newWorldTransform = multiply(scaleMatrix, node.worldTransform);
    
    // Convert back to local
    const newLocalTransform = this.worldToLocal(newWorldTransform, node.parentId);
    if (newLocalTransform) {
      node.localTransform = newLocalTransform;
      node.worldTransform = newWorldTransform;
      this.propagateToChildren(id);
    }
  }
  
  /** Resize node (changes size, not scale transform) */
  resize(id: string, newWidth: number, newHeight: number, anchor: Point2D = { x: 0, y: 0 }): void {
    const node = this.nodes.get(id);
    if (!node) return;
    
    // Calculate position adjustment based on anchor
    const dw = newWidth - node.size.width;
    const dh = newHeight - node.size.height;
    
    const dx = -dw * anchor.x;
    const dy = -dh * anchor.y;
    
    // Update size
    node.size = { width: newWidth, height: newHeight };
    
    // Adjust position
    if (dx !== 0 || dy !== 0) {
      this.translateWorld(id, dx, dy);
    }
  }
  
  // ─── Coordinate Conversion ───
  
  /** Convert world point to local space of a node */
  worldToLocalPoint(id: string, worldPoint: Point2D): Point2D | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const inverse = invert(node.worldTransform);
    if (!inverse) return null;
    
    return transformPoint(inverse, worldPoint);
  }
  
  /** Convert local point to world space */
  localToWorldPoint(id: string, localPoint: Point2D): Point2D | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    return transformPoint(node.worldTransform, localPoint);
  }
  
  /** Convert screen point to world space */
  screenToWorld(screenPoint: Point2D, viewportOffset: Point2D, scale: number): Point2D {
    return {
      x: (screenPoint.x - viewportOffset.x) / scale,
      y: (screenPoint.y - viewportOffset.y) / scale,
    };
  }
  
  /** Convert world point to screen space */
  worldToScreen(worldPoint: Point2D, viewportOffset: Point2D, scale: number): Point2D {
    return {
      x: worldPoint.x * scale + viewportOffset.x,
      y: worldPoint.y * scale + viewportOffset.y,
    };
  }
  
  // ─── Snapping ───
  
  /** Configure snapping behavior */
  setSnapConfig(config: Partial<SnapConfig>): void {
    this.snapConfig = { ...this.snapConfig, ...config };
  }
  
  /** Get snapping configuration */
  getSnapConfig(): SnapConfig {
    return { ...this.snapConfig };
  }
  
  /** Snap a point with current configuration */
  snap(point: Point2D, excludeIds: Set<string> = new Set()): SnapResult {
    const guides: SnapGuide[] = [];
    let snapped = { ...point };
    let didSnap = false;
    
    if (!this.snapConfig.enabled) {
      return { snapped, guides, didSnap };
    }
    
    // Grid snapping
    if (this.snapConfig.snapToGrid) {
      snapped = snapPointToGrid(snapped, this.snapConfig.gridSize);
      didSnap = true;
    }
    
    // Object snapping
    if (this.snapConfig.snapToObjects) {
      const objectSnap = this.snapToObjects(point, excludeIds);
      if (objectSnap.didSnap) {
        snapped = objectSnap.snapped;
        guides.push(...objectSnap.guides);
        didSnap = true;
      }
    }
    
    return { snapped, guides, didSnap };
  }
  
  /** Snap to other objects' edges and centers */
  private snapToObjects(point: Point2D, excludeIds: Set<string>): SnapResult {
    const threshold = this.snapConfig.threshold;
    const guides: SnapGuide[] = [];
    let snappedX = point.x;
    let snappedY = point.y;
    let didSnapX = false;
    let didSnapY = false;
    
    // Collect snap targets from other nodes
    const snapTargetsX: number[] = [];
    const snapTargetsY: number[] = [];
    
    this.nodes.forEach((node, nodeId) => {
      if (excludeIds.has(nodeId)) return;
      
      const bounds = this.getWorldBounds(nodeId);
      if (!bounds) return;
      
      // Edges
      snapTargetsX.push(bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width);
      snapTargetsY.push(bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height);
    });
    
    // Find closest X snap
    for (const target of snapTargetsX) {
      if (Math.abs(point.x - target) < threshold) {
        snappedX = target;
        didSnapX = true;
        guides.push({
          type: 'vertical',
          position: target,
          start: -10000,
          end: 10000,
        });
        break;
      }
    }
    
    // Find closest Y snap
    for (const target of snapTargetsY) {
      if (Math.abs(point.y - target) < threshold) {
        snappedY = target;
        didSnapY = true;
        guides.push({
          type: 'horizontal',
          position: target,
          start: -10000,
          end: 10000,
        });
        break;
      }
    }
    
    return {
      snapped: { x: snappedX, y: snappedY },
      guides,
      didSnap: didSnapX || didSnapY,
    };
  }
  
  /** Snap node bounds (for dragging/resizing) */
  snapBounds(bounds: BoundingBox, excludeIds: Set<string> = new Set()): {
    snapped: BoundingBox;
    guides: SnapGuide[];
    deltaX: number;
    deltaY: number;
  } {
    const threshold = this.snapConfig.threshold;
    const guides: SnapGuide[] = [];
    let deltaX = 0;
    let deltaY = 0;
    
    if (!this.snapConfig.enabled || !this.snapConfig.snapToObjects) {
      return { snapped: bounds, guides, deltaX, deltaY };
    }
    
    // Snap points: left, center, right for X; top, center, bottom for Y
    const boundsSnapX = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
    const boundsSnapY = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
    
    // Collect all snap targets
    const targetsX: number[] = [];
    const targetsY: number[] = [];
    
    this.nodes.forEach((node, nodeId) => {
      if (excludeIds.has(nodeId)) return;
      
      const nodeBounds = this.getWorldBounds(nodeId);
      if (!nodeBounds) return;
      
      targetsX.push(nodeBounds.x, nodeBounds.x + nodeBounds.width / 2, nodeBounds.x + nodeBounds.width);
      targetsY.push(nodeBounds.y, nodeBounds.y + nodeBounds.height / 2, nodeBounds.y + nodeBounds.height);
    });
    
    // Find best snap for X
    let bestSnapDeltaX = Infinity;
    let bestSnapTargetX = 0;
    
    for (const bx of boundsSnapX) {
      for (const tx of targetsX) {
        const d = tx - bx;
        if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestSnapDeltaX)) {
          bestSnapDeltaX = d;
          bestSnapTargetX = tx;
        }
      }
    }
    
    // Find best snap for Y
    let bestSnapDeltaY = Infinity;
    let bestSnapTargetY = 0;
    
    for (const by of boundsSnapY) {
      for (const ty of targetsY) {
        const d = ty - by;
        if (Math.abs(d) < threshold && Math.abs(d) < Math.abs(bestSnapDeltaY)) {
          bestSnapDeltaY = d;
          bestSnapTargetY = ty;
        }
      }
    }
    
    if (Math.abs(bestSnapDeltaX) < Infinity) {
      deltaX = bestSnapDeltaX;
      guides.push({
        type: 'vertical',
        position: bestSnapTargetX,
        start: bounds.y - 50,
        end: bounds.y + bounds.height + 50,
      });
    }
    
    if (Math.abs(bestSnapDeltaY) < Infinity) {
      deltaY = bestSnapDeltaY;
      guides.push({
        type: 'horizontal',
        position: bestSnapTargetY,
        start: bounds.x - 50,
        end: bounds.x + bounds.width + 50,
      });
    }
    
    return {
      snapped: {
        x: bounds.x + deltaX,
        y: bounds.y + deltaY,
        width: bounds.width,
        height: bounds.height,
      },
      guides,
      deltaX,
      deltaY,
    };
  }
  
  // ─── Snapping-Ready Output ───
  
  /** Get world transform values rounded for display */
  getDisplayTransform(id: string): TransformComponents & { width: number; height: number } | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const components = decompose(node.worldTransform);
    
    return {
      translateX: roundForDisplay(components.translateX),
      translateY: roundForDisplay(components.translateY),
      rotation: roundForDisplay(components.rotation * (180 / Math.PI)), // Convert to degrees
      scaleX: roundForDisplay(components.scaleX, 3),
      scaleY: roundForDisplay(components.scaleY, 3),
      skewX: roundForDisplay(components.skewX * (180 / Math.PI)),
      skewY: roundForDisplay(components.skewY * (180 / Math.PI)),
      width: roundForDisplay(node.size.width),
      height: roundForDisplay(node.size.height),
    };
  }
  
  /** Get CSS transform string for a node */
  getCSSTransform(id: string): string | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    
    const [a, b, c, d, tx, ty] = node.worldTransform;
    return `matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})`;
  }
  
  /** Get world transform matrix for a node */
  getWorldTransform(id: string): Matrix2D | null {
    const node = this.nodes.get(id);
    return node ? cloneMatrix(node.worldTransform) : null;
  }
  
  /** Get local transform matrix for a node */
  getLocalTransform(id: string): Matrix2D | null {
    const node = this.nodes.get(id);
    return node ? cloneMatrix(node.localTransform) : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const transformEngine = new TransformEngine();
