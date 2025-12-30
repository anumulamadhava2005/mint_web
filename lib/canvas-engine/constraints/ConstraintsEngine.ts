/**
 * ConstraintsEngine - Handles constraint-based child repositioning when parent resizes
 * 
 * Constraints:
 * - MIN (left/top): Pin to start edge
 * - MAX (right/bottom): Pin to end edge
 * - CENTER: Keep centered in parent
 * - STRETCH: Stretch to fill (pin both edges)
 * - SCALE: Scale proportionally with parent
 */

import type { SceneNode, ConstraintValue, Constraints, Transform2D } from '../../scene-graph';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Rectangle representing bounds */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Edge distances from parent */
export interface EdgeDistances {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Constraint application result */
export interface ConstraintResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parent resize info */
export interface ParentResize {
  /** Parent ID */
  parentId: string;
  /** Original parent bounds */
  oldBounds: Rect;
  /** New parent bounds */
  newBounds: Rect;
}

/** Stored constraint reference data for a node */
export interface ConstraintReference {
  /** Original edge distances when constraints were captured */
  edges: EdgeDistances;
  /** Original node bounds relative to parent */
  bounds: Rect;
  /** Original parent bounds */
  parentBounds: Rect;
  /** The constraints to apply */
  constraints: Constraints;
}

/** Batch update for multiple nodes */
export interface ConstraintUpdate {
  nodeId: string;
  newBounds: Rect;
}

// ─────────────────────────────────────────────────────────────────────────────
// ConstraintsEngine Class
// ─────────────────────────────────────────────────────────────────────────────

export class ConstraintsEngine {
  /** Stored reference data for constraint calculations */
  private references: Map<string, ConstraintReference> = new Map();
  
  /** Scene graph reference for lookups */
  private sceneGraph: Map<string, SceneNode> | null = null;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Sync with scene graph
   */
  syncFromSceneGraph(sceneGraph: Map<string, SceneNode>): void {
    this.sceneGraph = sceneGraph;
    this.buildReferences(sceneGraph);
  }
  
  /**
   * Apply constraints when a parent is resized.
   * Returns updates for all affected children.
   */
  applyParentResize(resize: ParentResize): ConstraintUpdate[] {
    if (!this.sceneGraph) return [];
    
    const updates: ConstraintUpdate[] = [];
    const parent = this.sceneGraph.get(resize.parentId);
    if (!parent) return updates;
    
    // Process all direct children
    for (const childId of parent.children) {
      const child = this.sceneGraph.get(childId);
      if (!child) continue;
      
      // Skip children in auto-layout (they're managed by LayoutEngine)
      if (parent.layout.mode !== 'NONE' && !child.layout.absolutePosition) {
        continue;
      }
      
      const update = this.applyConstraintsToChild(
        child,
        resize.oldBounds,
        resize.newBounds
      );
      
      if (update) {
        updates.push({ nodeId: child.id, newBounds: update });
        
        // Recursively apply to nested frames
        if (child.children.length > 0 && child.type === 'FRAME') {
          const nestedUpdates = this.applyParentResize({
            parentId: child.id,
            oldBounds: {
              x: child.worldTransform[4],
              y: child.worldTransform[5],
              width: child.size.width,
              height: child.size.height,
            },
            newBounds: update,
          });
          updates.push(...nestedUpdates);
        }
      }
    }
    
    return updates;
  }
  
  /**
   * Apply constraints to a single child node
   */
  applyConstraintsToChild(
    child: SceneNode,
    oldParentBounds: Rect,
    newParentBounds: Rect
  ): ConstraintResult | null {
    const ref = this.references.get(child.id);
    if (!ref) {
      // No reference data - compute from current state
      return this.computeConstrainedBounds(
        child,
        oldParentBounds,
        newParentBounds
      );
    }
    
    return this.applyStoredConstraints(ref, newParentBounds);
  }
  
  /**
   * Capture constraint reference for a node (call after repositioning)
   */
  captureReference(nodeId: string, parentBounds: Rect): void {
    if (!this.sceneGraph) return;
    
    const node = this.sceneGraph.get(nodeId);
    if (!node) return;
    
    const bounds: Rect = {
      x: node.worldTransform[4],
      y: node.worldTransform[5],
      width: node.size.width,
      height: node.size.height,
    };
    
    // Compute relative position to parent
    const relativeX = bounds.x - parentBounds.x;
    const relativeY = bounds.y - parentBounds.y;
    
    const edges: EdgeDistances = {
      left: relativeX,
      right: parentBounds.width - (relativeX + bounds.width),
      top: relativeY,
      bottom: parentBounds.height - (relativeY + bounds.height),
    };
    
    this.references.set(nodeId, {
      edges,
      bounds: { ...bounds, x: relativeX, y: relativeY },
      parentBounds,
      constraints: node.constraints,
    });
  }
  
  /**
   * Get the reference data for a node
   */
  getReference(nodeId: string): ConstraintReference | undefined {
    return this.references.get(nodeId);
  }
  
  /**
   * Clear all stored references
   */
  clearReferences(): void {
    this.references.clear();
  }
  
  /**
   * Preview constraint result without applying
   */
  previewConstraints(
    nodeId: string,
    oldParentBounds: Rect,
    newParentBounds: Rect
  ): ConstraintResult | null {
    if (!this.sceneGraph) return null;
    
    const node = this.sceneGraph.get(nodeId);
    if (!node) return null;
    
    return this.computeConstrainedBounds(node, oldParentBounds, newParentBounds);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildReferences(sceneGraph: Map<string, SceneNode>): void {
    this.references.clear();
    
    sceneGraph.forEach(node => {
      if (node.parentId) {
        const parent = sceneGraph.get(node.parentId);
        if (parent) {
          const parentBounds: Rect = {
            x: parent.worldTransform[4],
            y: parent.worldTransform[5],
            width: parent.size.width,
            height: parent.size.height,
          };
          this.captureReference(node.id, parentBounds);
        }
      }
    });
  }
  
  private computeConstrainedBounds(
    node: SceneNode,
    oldParent: Rect,
    newParent: Rect
  ): ConstraintResult {
    // Get node's position relative to old parent
    const nodeWorldX = node.worldTransform[4];
    const nodeWorldY = node.worldTransform[5];
    const relX = nodeWorldX - oldParent.x;
    const relY = nodeWorldY - oldParent.y;
    
    // Current edge distances
    const edges: EdgeDistances = {
      left: relX,
      right: oldParent.width - (relX + node.size.width),
      top: relY,
      bottom: oldParent.height - (relY + node.size.height),
    };
    
    // Apply horizontal constraint
    const { x, width } = this.applyHorizontalConstraint(
      node.constraints.horizontal,
      edges,
      node.size.width,
      oldParent.width,
      newParent.width
    );
    
    // Apply vertical constraint
    const { y, height } = this.applyVerticalConstraint(
      node.constraints.vertical,
      edges,
      node.size.height,
      oldParent.height,
      newParent.height
    );
    
    // Convert back to world coordinates
    return {
      x: newParent.x + x,
      y: newParent.y + y,
      width,
      height,
    };
  }
  
  private applyStoredConstraints(
    ref: ConstraintReference,
    newParent: Rect
  ): ConstraintResult {
    // Apply horizontal constraint using stored reference
    const { x, width } = this.applyHorizontalConstraint(
      ref.constraints.horizontal,
      ref.edges,
      ref.bounds.width,
      ref.parentBounds.width,
      newParent.width
    );
    
    // Apply vertical constraint using stored reference
    const { y, height } = this.applyVerticalConstraint(
      ref.constraints.vertical,
      ref.edges,
      ref.bounds.height,
      ref.parentBounds.height,
      newParent.height
    );
    
    // Convert to world coordinates
    return {
      x: newParent.x + x,
      y: newParent.y + y,
      width,
      height,
    };
  }
  
  private applyHorizontalConstraint(
    constraint: ConstraintValue,
    edges: EdgeDistances,
    nodeWidth: number,
    oldParentWidth: number,
    newParentWidth: number
  ): { x: number; width: number } {
    switch (constraint) {
      case 'MIN': // Pin to left
        return { x: edges.left, width: nodeWidth };
        
      case 'MAX': // Pin to right
        return { x: newParentWidth - edges.right - nodeWidth, width: nodeWidth };
        
      case 'CENTER': // Keep centered
        const oldCenterX = edges.left + nodeWidth / 2;
        const centerRatio = oldCenterX / oldParentWidth;
        const newCenterX = centerRatio * newParentWidth;
        return { x: newCenterX - nodeWidth / 2, width: nodeWidth };
        
      case 'STRETCH': // Pin both edges, stretch width
        const newWidth = newParentWidth - edges.left - edges.right;
        return { x: edges.left, width: Math.max(1, newWidth) };
        
      case 'SCALE': // Scale proportionally
        const scaleX = newParentWidth / oldParentWidth;
        return {
          x: edges.left * scaleX,
          width: nodeWidth * scaleX,
        };
        
      default:
        return { x: edges.left, width: nodeWidth };
    }
  }
  
  private applyVerticalConstraint(
    constraint: ConstraintValue,
    edges: EdgeDistances,
    nodeHeight: number,
    oldParentHeight: number,
    newParentHeight: number
  ): { y: number; height: number } {
    switch (constraint) {
      case 'MIN': // Pin to top
        return { y: edges.top, height: nodeHeight };
        
      case 'MAX': // Pin to bottom
        return { y: newParentHeight - edges.bottom - nodeHeight, height: nodeHeight };
        
      case 'CENTER': // Keep centered
        const oldCenterY = edges.top + nodeHeight / 2;
        const centerRatio = oldCenterY / oldParentHeight;
        const newCenterY = centerRatio * newParentHeight;
        return { y: newCenterY - nodeHeight / 2, height: nodeHeight };
        
      case 'STRETCH': // Pin both edges, stretch height
        const newHeight = newParentHeight - edges.top - edges.bottom;
        return { y: edges.top, height: Math.max(1, newHeight) };
        
      case 'SCALE': // Scale proportionally
        const scaleY = newParentHeight / oldParentHeight;
        return {
          y: edges.top * scaleY,
          height: nodeHeight * scaleY,
        };
        
      default:
        return { y: edges.top, height: nodeHeight };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const constraintsEngine = new ConstraintsEngine();

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert Figma-style constraint names to our ConstraintValue
 */
export function parseConstraint(value: string | undefined): ConstraintValue {
  switch (value?.toUpperCase()) {
    case 'LEFT':
    case 'TOP':
    case 'MIN':
      return 'MIN';
    case 'RIGHT':
    case 'BOTTOM':
    case 'MAX':
      return 'MAX';
    case 'CENTER':
      return 'CENTER';
    case 'LEFT_RIGHT':
    case 'TOP_BOTTOM':
    case 'STRETCH':
      return 'STRETCH';
    case 'SCALE':
      return 'SCALE';
    default:
      return 'MIN';
  }
}

/**
 * Get human-readable constraint description
 */
export function constraintToString(constraint: ConstraintValue, axis: 'horizontal' | 'vertical'): string {
  const isH = axis === 'horizontal';
  switch (constraint) {
    case 'MIN': return isH ? 'Left' : 'Top';
    case 'MAX': return isH ? 'Right' : 'Bottom';
    case 'CENTER': return 'Center';
    case 'STRETCH': return isH ? 'Left & Right' : 'Top & Bottom';
    case 'SCALE': return 'Scale';
    default: return 'Unknown';
  }
}

/**
 * Check if resizing would affect children based on their constraints
 */
export function wouldAffectChildren(
  sceneGraph: Map<string, SceneNode>,
  parentId: string
): boolean {
  const parent = sceneGraph.get(parentId);
  if (!parent || parent.children.length === 0) return false;
  
  // Check if any child has non-MIN constraints
  for (const childId of parent.children) {
    const child = sceneGraph.get(childId);
    if (!child) continue;
    
    // Skip auto-layout children
    if (parent.layout.mode !== 'NONE' && !child.layout.absolutePosition) {
      continue;
    }
    
    if (child.constraints.horizontal !== 'MIN' || child.constraints.vertical !== 'MIN') {
      return true;
    }
  }
  
  return false;
}
