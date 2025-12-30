/**
 * useCanvasLayout - React hook for layout-resolved canvas rendering
 * 
 * Provides DrawableNode[] with numerically computed layout positions
 * for visual parity with DOM preview.
 */

import { useMemo } from 'react';
import type { SceneNode } from '../../scene-graph';
import type { DrawableNode } from '../../figma-types';
import {
  CanvasLayoutBridge,
  canvasLayoutBridge,
  ResolvedBox,
  ResolveOptions,
  resolvedBoxesToDrawables,
} from './CanvasLayoutBridge';

export interface UseCanvasLayoutOptions extends ResolveOptions {
  /** Whether to return as DrawableNode[] (true) or ResolvedBox[] (false) */
  asDrawable?: boolean;
}

export interface UseCanvasLayoutResult {
  /** Resolved boxes with computed layout positions */
  resolvedBoxes: ResolvedBox[];
  /** DrawableNode[] for direct use with canvas-draw.ts */
  drawableNodes: DrawableNode[];
  /** Get resolved box for a specific node */
  getBox: (nodeId: string) => ResolvedBox | null;
  /** The bridge instance */
  bridge: CanvasLayoutBridge;
}

/**
 * Hook that computes layout for SceneGraph and returns canvas-ready nodes
 */
export function useCanvasLayout(
  sceneGraph: Map<string, SceneNode> | null,
  options: UseCanvasLayoutOptions = {}
): UseCanvasLayoutResult {
  const bridge = canvasLayoutBridge;
  
  // Compute layout and resolve boxes
  const resolvedBoxes = useMemo<ResolvedBox[]>(() => {
    if (!sceneGraph || sceneGraph.size === 0) return [];
    return bridge.resolve(sceneGraph, options);
  }, [sceneGraph, options, bridge]);
  
  // Convert to DrawableNode format for canvas-draw.ts
  const drawableNodes = useMemo<DrawableNode[]>(() => {
    return resolvedBoxesToDrawables(resolvedBoxes);
  }, [resolvedBoxes]);
  
  // Getter for individual boxes
  const getBox = useMemo(() => {
    return (nodeId: string): ResolvedBox | null => {
      if (!sceneGraph) return null;
      return bridge.getResolvedBox(nodeId, sceneGraph);
    };
  }, [sceneGraph, bridge]);
  
  return {
    resolvedBoxes,
    drawableNodes,
    getBox,
    bridge,
  };
}

/**
 * Simpler hook that just returns layout-resolved DrawableNode[]
 */
export function useLayoutResolvedDrawables(
  sceneGraph: Map<string, SceneNode> | null,
  options?: ResolveOptions
): DrawableNode[] {
  const { drawableNodes } = useCanvasLayout(sceneGraph, options);
  return drawableNodes;
}
