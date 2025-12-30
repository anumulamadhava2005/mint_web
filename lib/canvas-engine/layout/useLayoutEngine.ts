/**
 * useLayoutEngine - React hook for LayoutEngine
 */

import { useMemo, useCallback } from 'react';
import type { SceneNode } from '../../scene-graph';
import {
  LayoutEngine,
  layoutEngine,
  ComputedLayout,
  LayoutNode,
  LayoutOptions,
} from './LayoutEngine';

export interface UseLayoutEngineResult {
  /** Compute layout for all nodes */
  compute: (options?: LayoutOptions) => Map<string, ComputedLayout>;
  
  /** Compute layout from SceneNode graph */
  computeFromSceneGraph: (
    sceneGraph: Map<string, SceneNode>,
    options?: LayoutOptions
  ) => Map<string, ComputedLayout>;
  
  /** Get computed layout for a single node */
  getLayout: (nodeId: string) => ComputedLayout | undefined;
  
  /** Recompute layout for a subtree */
  recomputeSubtree: (rootId: string) => void;
  
  /** The underlying engine instance */
  engine: LayoutEngine;
}

/**
 * Hook for using the LayoutEngine in React components
 */
export function useLayoutEngine(
  nodes?: Map<string, LayoutNode>,
  options?: LayoutOptions
): UseLayoutEngineResult {
  // Compute layout when nodes change
  const computedLayouts = useMemo(() => {
    if (!nodes || nodes.size === 0) return new Map<string, ComputedLayout>();
    return layoutEngine.compute(nodes, options);
  }, [nodes, options]);
  
  // Compute callback for manual triggering
  const compute = useCallback(
    (opts?: LayoutOptions) => {
      if (!nodes || nodes.size === 0) return new Map<string, ComputedLayout>();
      return layoutEngine.compute(nodes, opts ?? options);
    },
    [nodes, options]
  );
  
  // Compute from SceneNode graph
  const computeFromSceneGraph = useCallback(
    (sceneGraph: Map<string, SceneNode>, opts?: LayoutOptions) => {
      return layoutEngine.computeFromSceneGraph(sceneGraph, opts ?? options);
    },
    [options]
  );
  
  // Get single layout
  const getLayout = useCallback(
    (nodeId: string) => layoutEngine.getLayout(nodeId),
    []
  );
  
  // Recompute subtree
  const recomputeSubtree = useCallback(
    (rootId: string) => layoutEngine.recomputeSubtree(rootId),
    []
  );
  
  return {
    compute,
    computeFromSceneGraph,
    getLayout,
    recomputeSubtree,
    engine: layoutEngine,
  };
}

/**
 * Hook that automatically computes layout from a SceneNode graph
 */
export function useSceneLayout(
  sceneGraph: Map<string, SceneNode> | null,
  options?: LayoutOptions
): Map<string, ComputedLayout> {
  return useMemo(() => {
    if (!sceneGraph || sceneGraph.size === 0) {
      return new Map<string, ComputedLayout>();
    }
    return layoutEngine.computeFromSceneGraph(sceneGraph, options);
  }, [sceneGraph, options]);
}
