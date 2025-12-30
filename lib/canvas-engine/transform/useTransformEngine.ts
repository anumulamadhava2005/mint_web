/**
 * useTransformEngine - React hook for integrating TransformEngine
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import {
  TransformEngine,
  Matrix2D,
  Point2D,
  Size2D,
  BoundingBox,
  SnapConfig,
  SnapResult,
  SnapGuide,
  TransformComponents,
  identity,
  translate,
  decompose,
  compose,
} from './TransformEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTransformEngineResult {
  /** The transform engine instance */
  engine: TransformEngine;
  
  // ─── Node Registration ───
  
  /** Register a node with transform */
  registerNode: (
    id: string,
    parentId: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation?: number
  ) => void;
  
  /** Unregister a node */
  unregisterNode: (id: string) => void;
  
  /** Sync all nodes from scene graph */
  syncFromSceneGraph: (nodes: Map<string, {
    id: string;
    parentId: string | null;
    worldTransform: Matrix2D;
    size: { width: number; height: number };
  }>) => void;
  
  // ─── Transform Queries ───
  
  /** Get world position */
  getWorldPosition: (id: string) => Point2D | null;
  
  /** Get world bounds (AABB) */
  getWorldBounds: (id: string) => BoundingBox | null;
  
  /** Get world transform matrix */
  getWorldTransform: (id: string) => Matrix2D | null;
  
  /** Get display-ready transform values */
  getDisplayTransform: (id: string) => (TransformComponents & { width: number; height: number }) | null;
  
  /** Get CSS transform string */
  getCSSTransform: (id: string) => string | null;
  
  // ─── Transform Operations ───
  
  /** Move node by delta in world space */
  translateWorld: (id: string, dx: number, dy: number) => void;
  
  /** Set node's world position */
  setWorldPosition: (id: string, x: number, y: number) => void;
  
  /** Rotate node by delta (degrees) */
  rotateWorld: (id: string, deltaDegrees: number) => void;
  
  /** Set node's world rotation (degrees) */
  setWorldRotation: (id: string, degrees: number) => void;
  
  /** Scale node */
  scaleWorld: (id: string, sx: number, sy?: number) => void;
  
  /** Resize node */
  resize: (id: string, width: number, height: number, anchor?: Point2D) => void;
  
  // ─── Coordinate Conversion ───
  
  /** Convert screen point to world */
  screenToWorld: (screenX: number, screenY: number, offset: Point2D, scale: number) => Point2D;
  
  /** Convert world point to screen */
  worldToScreen: (worldX: number, worldY: number, offset: Point2D, scale: number) => Point2D;
  
  /** Convert world point to node's local space */
  worldToLocal: (id: string, worldPoint: Point2D) => Point2D | null;
  
  /** Convert node's local point to world */
  localToWorld: (id: string, localPoint: Point2D) => Point2D | null;
  
  // ─── Snapping ───
  
  /** Configure snapping */
  setSnapConfig: (config: Partial<SnapConfig>) => void;
  
  /** Get snap config */
  getSnapConfig: () => SnapConfig;
  
  /** Snap a point */
  snap: (point: Point2D, excludeIds?: Set<string>) => SnapResult;
  
  /** Snap bounds (for dragging) */
  snapBounds: (bounds: BoundingBox, excludeIds?: Set<string>) => {
    snapped: BoundingBox;
    guides: SnapGuide[];
    deltaX: number;
    deltaY: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useTransformEngine(): UseTransformEngineResult {
  const engineRef = useRef<TransformEngine | null>(null);
  
  if (!engineRef.current) {
    engineRef.current = new TransformEngine();
  }
  
  const engine = engineRef.current;
  
  // ─── Node Registration ───
  
  const registerNode = useCallback((
    id: string,
    parentId: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number = 0
  ) => {
    const localTransform = compose({
      translateX: x,
      translateY: y,
      rotation: rotation * (Math.PI / 180), // Convert to radians
    });
    
    engine.registerNode(id, parentId, localTransform, { width, height });
  }, [engine]);
  
  const unregisterNode = useCallback((id: string) => {
    engine.unregisterNode(id);
  }, [engine]);
  
  const syncFromSceneGraph = useCallback((nodes: Map<string, {
    id: string;
    parentId: string | null;
    worldTransform: Matrix2D;
    size: { width: number; height: number };
  }>) => {
    engine.clear();
    
    // First pass: register all nodes without parent consideration
    nodes.forEach((node) => {
      // For now, use worldTransform as localTransform (we'll fix parent relationships)
      engine.registerNode(
        node.id,
        node.parentId,
        node.worldTransform,
        node.size
      );
    });
  }, [engine]);
  
  // ─── Transform Queries ───
  
  const getWorldPosition = useCallback((id: string) => {
    return engine.getWorldPosition(id);
  }, [engine]);
  
  const getWorldBounds = useCallback((id: string) => {
    return engine.getWorldBounds(id);
  }, [engine]);
  
  const getWorldTransform = useCallback((id: string) => {
    return engine.getWorldTransform(id);
  }, [engine]);
  
  const getDisplayTransform = useCallback((id: string) => {
    return engine.getDisplayTransform(id);
  }, [engine]);
  
  const getCSSTransform = useCallback((id: string) => {
    return engine.getCSSTransform(id);
  }, [engine]);
  
  // ─── Transform Operations ───
  
  const translateWorldCb = useCallback((id: string, dx: number, dy: number) => {
    engine.translateWorld(id, dx, dy);
  }, [engine]);
  
  const setWorldPositionCb = useCallback((id: string, x: number, y: number) => {
    engine.setWorldPosition(id, x, y);
  }, [engine]);
  
  const rotateWorldCb = useCallback((id: string, deltaDegrees: number) => {
    engine.rotateWorld(id, deltaDegrees * (Math.PI / 180));
  }, [engine]);
  
  const setWorldRotationCb = useCallback((id: string, degrees: number) => {
    engine.setWorldRotation(id, degrees * (Math.PI / 180));
  }, [engine]);
  
  const scaleWorldCb = useCallback((id: string, sx: number, sy?: number) => {
    engine.scaleWorld(id, sx, sy);
  }, [engine]);
  
  const resizeCb = useCallback((id: string, width: number, height: number, anchor?: Point2D) => {
    engine.resize(id, width, height, anchor);
  }, [engine]);
  
  // ─── Coordinate Conversion ───
  
  const screenToWorld = useCallback((screenX: number, screenY: number, offset: Point2D, scale: number) => {
    return engine.screenToWorld({ x: screenX, y: screenY }, offset, scale);
  }, [engine]);
  
  const worldToScreen = useCallback((worldX: number, worldY: number, offset: Point2D, scale: number) => {
    return engine.worldToScreen({ x: worldX, y: worldY }, offset, scale);
  }, [engine]);
  
  const worldToLocal = useCallback((id: string, worldPoint: Point2D) => {
    return engine.worldToLocalPoint(id, worldPoint);
  }, [engine]);
  
  const localToWorld = useCallback((id: string, localPoint: Point2D) => {
    return engine.localToWorldPoint(id, localPoint);
  }, [engine]);
  
  // ─── Snapping ───
  
  const setSnapConfig = useCallback((config: Partial<SnapConfig>) => {
    engine.setSnapConfig(config);
  }, [engine]);
  
  const getSnapConfigCb = useCallback(() => {
    return engine.getSnapConfig();
  }, [engine]);
  
  const snapCb = useCallback((point: Point2D, excludeIds?: Set<string>) => {
    return engine.snap(point, excludeIds);
  }, [engine]);
  
  const snapBoundsCb = useCallback((bounds: BoundingBox, excludeIds?: Set<string>) => {
    return engine.snapBounds(bounds, excludeIds);
  }, [engine]);
  
  return {
    engine,
    registerNode,
    unregisterNode,
    syncFromSceneGraph,
    getWorldPosition,
    getWorldBounds,
    getWorldTransform,
    getDisplayTransform,
    getCSSTransform,
    translateWorld: translateWorldCb,
    setWorldPosition: setWorldPositionCb,
    rotateWorld: rotateWorldCb,
    setWorldRotation: setWorldRotationCb,
    scaleWorld: scaleWorldCb,
    resize: resizeCb,
    screenToWorld,
    worldToScreen,
    worldToLocal,
    localToWorld,
    setSnapConfig,
    getSnapConfig: getSnapConfigCb,
    snap: snapCb,
    snapBounds: snapBoundsCb,
  };
}
