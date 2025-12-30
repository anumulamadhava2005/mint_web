/**
 * ConstraintsIntegration - Helpers for integrating ConstraintsEngine with CanvasStage
 * 
 * Provides utilities to apply constraint-based child updates when a parent is resized.
 */

import type { NodeInput } from '../../figma-types';
import type { SceneNode } from '../../scene-graph';
import { constraintsEngine, type ConstraintUpdate, type Rect } from './ConstraintsEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ResizeWithConstraintsParams {
  /** Root nodes array */
  roots: NodeInput[];
  /** ID of the node being resized (the parent) */
  nodeId: string;
  /** Old bounds before resize */
  oldBounds: Rect;
  /** New bounds after resize */
  newBounds: Rect;
  /** Scene graph for constraint lookups */
  sceneGraph: Map<string, SceneNode>;
}

export interface ResizeWithConstraintsResult {
  /** Updated roots with parent and constrained children */
  roots: NodeInput[];
  /** List of child IDs that were updated */
  updatedChildIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Integration Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply resize to a node and propagate constraint-based updates to children.
 * 
 * @param params - Resize parameters including bounds and scene graph
 * @returns Updated roots and list of affected child IDs
 */
export function resizeWithConstraints(params: ResizeWithConstraintsParams): ResizeWithConstraintsResult {
  const { roots, nodeId, oldBounds, newBounds, sceneGraph } = params;
  
  // First, apply constraint updates to children
  const constraintUpdates = constraintsEngine.applyParentResize({
    parentId: nodeId,
    oldBounds,
    newBounds,
  });
  
  // Build a map of all updates (parent + constrained children)
  const updateMap = new Map<string, Rect>();
  
  // Add parent update
  updateMap.set(nodeId, newBounds);
  
  // Add child updates
  for (const update of constraintUpdates) {
    updateMap.set(update.nodeId, update.newBounds);
  }
  
  // Apply all updates to the tree
  const updatedRoots = applyRectUpdates(roots, updateMap);
  
  return {
    roots: updatedRoots,
    updatedChildIds: constraintUpdates.map(u => u.nodeId),
  };
}

/**
 * Apply multiple rect updates to a NodeInput tree immutably.
 */
function applyRectUpdates(
  roots: NodeInput[],
  updates: Map<string, Rect>
): NodeInput[] {
  const updateNode = (node: NodeInput): NodeInput => {
    const update = updates.get(node.id);
    let hasChanged = false;
    
    // Check if this node needs updating
    if (update) {
      hasChanged = true;
    }
    
    // Process children recursively
    let nextChildren = node.children;
    if (node.children && node.children.length > 0) {
      const mappedChildren = node.children.map(updateNode);
      if (mappedChildren.some((c, i) => c !== node.children![i])) {
        nextChildren = mappedChildren;
        hasChanged = true;
      }
    }
    
    if (!hasChanged) return node;
    
    // Create updated node
    const next: any = { ...node };
    
    if (update) {
      next.x = update.x;
      next.y = update.y;
      next.width = update.width;
      next.height = update.height;
      next.w = update.width;
      next.h = update.height;
      
      if (next.absoluteBoundingBox) {
        next.absoluteBoundingBox = {
          ...next.absoluteBoundingBox,
          x: update.x,
          y: update.y,
          width: update.width,
          height: update.height,
        };
      }
    }
    
    if (nextChildren !== node.children) {
      next.children = nextChildren;
    }
    
    return next as NodeInput;
  };
  
  return roots.map(updateNode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview constraint updates without applying to the tree.
 * Useful for showing guides/indicators during resize.
 */
export function previewConstraintUpdates(
  sceneGraph: Map<string, SceneNode>,
  parentId: string,
  oldBounds: Rect,
  newBounds: Rect
): ConstraintUpdate[] {
  return constraintsEngine.applyParentResize({
    parentId,
    oldBounds,
    newBounds,
  });
}

/**
 * Get nodes that would be affected by a parent resize.
 */
export function getAffectedChildIds(
  sceneGraph: Map<string, SceneNode>,
  parentId: string
): string[] {
  const parent = sceneGraph.get(parentId);
  if (!parent) return [];
  
  const affected: string[] = [];
  
  for (const childId of parent.children) {
    const child = sceneGraph.get(childId);
    if (!child) continue;
    
    // Skip auto-layout children
    if (parent.layout.mode !== 'NONE' && !child.layout.absolutePosition) {
      continue;
    }
    
    // Check if child has non-default constraints
    if (child.constraints.horizontal !== 'MIN' || child.constraints.vertical !== 'MIN') {
      affected.push(childId);
    }
    
    // Recursively check nested frames
    if (child.children.length > 0 && child.type === 'FRAME') {
      const nestedAffected = getAffectedChildIds(sceneGraph, childId);
      affected.push(...nestedAffected);
    }
  }
  
  return affected;
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeInput Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get node bounds from NodeInput.
 */
export function getNodeBounds(node: NodeInput): Rect {
  return {
    x: (node as any).x ?? node.absoluteBoundingBox?.x ?? 0,
    y: (node as any).y ?? node.absoluteBoundingBox?.y ?? 0,
    width: node.width ?? node.absoluteBoundingBox?.width ?? 0,
    height: node.height ?? node.absoluteBoundingBox?.height ?? 0,
  };
}

/**
 * Find a node by ID in the NodeInput tree.
 */
export function findNodeInput(roots: NodeInput[], id: string): NodeInput | null {
  for (const root of roots) {
    if (root.id === id) return root;
    if (root.children) {
      const found = findNodeInput(root.children, id);
      if (found) return found;
    }
  }
  return null;
}
