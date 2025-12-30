/**
 * useHitTest - React hook for HitTestService
 */

import { useCallback, useEffect, useRef } from 'react';
import { hitTestService, type HitTestOptions, type HitTestResult, type Point, type Rect } from './HitTestService';
import type { SceneNode } from './SceneNode';

export interface UseHitTestReturn {
  /** Hit test at a point, returns topmost node */
  hitTestPoint: (point: Point, options?: HitTestOptions) => HitTestResult | null;
  /** Hit test at a point, returns all hits */
  hitTestPointAll: (point: Point, options?: HitTestOptions) => HitTestResult[];
  /** Hit test a rectangle (marquee) */
  hitTestRect: (rect: Rect, options?: HitTestOptions & { mode?: 'intersect' | 'contain' }) => HitTestResult[];
  /** Find selectable node at point */
  findSelectableNode: (point: Point) => HitTestResult | null;
  /** Find all selectable nodes at point */
  findAllSelectableNodes: (point: Point) => HitTestResult[];
  /** Find container frame at point */
  findContainerFrame: (point: Point) => HitTestResult | null;
  /** Find parent frame for inserting nodes */
  findParentFrameForPoint: (point: Point, fallbackFrameId?: string) => string | null;
  /** Check if node is descendant of ancestor */
  isDescendantOf: (nodeId: string, ancestorId: string) => boolean;
  /** Sync scene graph with service */
  sync: () => void;
}

/**
 * Hook for using the HitTestService
 * @param sceneGraph - The scene graph to hit test against
 */
export function useHitTest(sceneGraph: Map<string, SceneNode> | null): UseHitTestReturn {
  const lastSyncRef = useRef<Map<string, SceneNode> | null>(null);
  
  // Sync when scene graph changes
  useEffect(() => {
    if (sceneGraph && sceneGraph !== lastSyncRef.current) {
      hitTestService.sync(sceneGraph);
      lastSyncRef.current = sceneGraph;
    }
  }, [sceneGraph]);
  
  // Manual sync function
  const sync = useCallback(() => {
    if (sceneGraph) {
      hitTestService.sync(sceneGraph);
      lastSyncRef.current = sceneGraph;
    }
  }, [sceneGraph]);
  
  // Hit test at point
  const hitTestPoint = useCallback(
    (point: Point, options?: HitTestOptions): HitTestResult | null => {
      return hitTestService.hitTestPoint(point, options);
    },
    []
  );
  
  // Hit test all at point
  const hitTestPointAll = useCallback(
    (point: Point, options?: HitTestOptions): HitTestResult[] => {
      return hitTestService.hitTestPointAll(point, options);
    },
    []
  );
  
  // Hit test rectangle
  const hitTestRect = useCallback(
    (rect: Rect, options?: HitTestOptions & { mode?: 'intersect' | 'contain' }): HitTestResult[] => {
      return hitTestService.hitTestRect(rect, options);
    },
    []
  );
  
  // Find selectable node
  const findSelectableNode = useCallback(
    (point: Point): HitTestResult | null => {
      return hitTestService.findSelectableNode(point);
    },
    []
  );
  
  // Find all selectable nodes
  const findAllSelectableNodes = useCallback(
    (point: Point): HitTestResult[] => {
      return hitTestService.findAllSelectableNodes(point);
    },
    []
  );
  
  // Find container frame
  const findContainerFrame = useCallback(
    (point: Point): HitTestResult | null => {
      return hitTestService.findContainerFrame(point);
    },
    []
  );
  
  // Find parent frame for point
  const findParentFrameForPoint = useCallback(
    (point: Point, fallbackFrameId?: string): string | null => {
      return hitTestService.findParentFrameForPoint(point, fallbackFrameId);
    },
    []
  );
  
  // Check descendant
  const isDescendantOf = useCallback(
    (nodeId: string, ancestorId: string): boolean => {
      return hitTestService.isDescendantOf(nodeId, ancestorId);
    },
    []
  );
  
  return {
    hitTestPoint,
    hitTestPointAll,
    hitTestRect,
    findSelectableNode,
    findAllSelectableNodes,
    findContainerFrame,
    findParentFrameForPoint,
    isDescendantOf,
    sync,
  };
}
