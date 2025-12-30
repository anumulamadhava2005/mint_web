/**
 * useConstraintsEngine - React hook for constraint-based child repositioning
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { SceneNode } from '../../scene-graph';
import {
  ConstraintsEngine,
  constraintsEngine,
  ConstraintUpdate,
  ParentResize,
  Rect,
  ConstraintResult,
} from './ConstraintsEngine';

export interface UseConstraintsEngineResult {
  /** Apply parent resize and get child updates */
  applyParentResize: (resize: ParentResize) => ConstraintUpdate[];
  
  /** Apply constraints to a single child */
  applyConstraintsToChild: (
    child: SceneNode,
    oldParentBounds: Rect,
    newParentBounds: Rect
  ) => ConstraintResult | null;
  
  /** Preview constraint result without applying */
  previewConstraints: (
    nodeId: string,
    oldParentBounds: Rect,
    newParentBounds: Rect
  ) => ConstraintResult | null;
  
  /** Capture reference data for a node */
  captureReference: (nodeId: string, parentBounds: Rect) => void;
  
  /** The underlying engine instance */
  engine: ConstraintsEngine;
}

/**
 * Hook for using the ConstraintsEngine in React components
 */
export function useConstraintsEngine(
  sceneGraph: Map<string, SceneNode> | null
): UseConstraintsEngineResult {
  const engine = constraintsEngine;
  
  // Sync scene graph with engine
  useEffect(() => {
    if (sceneGraph && sceneGraph.size > 0) {
      engine.syncFromSceneGraph(sceneGraph);
    }
  }, [sceneGraph, engine]);
  
  // Apply parent resize
  const applyParentResize = useCallback(
    (resize: ParentResize) => engine.applyParentResize(resize),
    [engine]
  );
  
  // Apply constraints to child
  const applyConstraintsToChild = useCallback(
    (child: SceneNode, oldParentBounds: Rect, newParentBounds: Rect) =>
      engine.applyConstraintsToChild(child, oldParentBounds, newParentBounds),
    [engine]
  );
  
  // Preview constraints
  const previewConstraints = useCallback(
    (nodeId: string, oldParentBounds: Rect, newParentBounds: Rect) =>
      engine.previewConstraints(nodeId, oldParentBounds, newParentBounds),
    [engine]
  );
  
  // Capture reference
  const captureReference = useCallback(
    (nodeId: string, parentBounds: Rect) =>
      engine.captureReference(nodeId, parentBounds),
    [engine]
  );
  
  return {
    applyParentResize,
    applyConstraintsToChild,
    previewConstraints,
    captureReference,
    engine,
  };
}

/**
 * Hook that returns constraint updates when a parent is resized
 */
export function useConstraintUpdates(
  sceneGraph: Map<string, SceneNode> | null,
  parentResize: ParentResize | null
): ConstraintUpdate[] {
  const { applyParentResize } = useConstraintsEngine(sceneGraph);
  
  return useMemo(() => {
    if (!parentResize) return [];
    return applyParentResize(parentResize);
  }, [parentResize, applyParentResize]);
}
