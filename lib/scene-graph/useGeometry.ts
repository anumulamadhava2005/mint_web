/**
 * useGeometry - React hook for unified geometry access
 * 
 * Provides geometry computation using TransformEngine for:
 * - Selection frames
 * - Hit testing
 * - Layout bounds
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import { GeometryService, NodeGeometry, SelectionFrame, HitTestResult } from './GeometryService';
import type { SceneNode } from './SceneNode';
import type { BoundingBox, Point2D, Matrix2D, SnapResult, SnapGuide } from '../canvas-engine/transform';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGeometryResult {
  /** The geometry service instance */
  service: GeometryService;
  
  /** Sync geometry from scene graph (call when sceneGraph changes) */
  syncFromSceneGraph: (nodes: Map<string, SceneNode>) => void;
  
  // ─── Geometry Queries ───
  
  /** Get geometry for a node */
  getGeometry: (id: string) => NodeGeometry | null;
  
  /** Get world bounds for a node */
  getWorldBounds: (id: string) => BoundingBox | null;
  
  /** Get world transform for a node */
  getWorldTransform: (id: string) => Matrix2D | null;
  
  // ─── Selection Frames ───
  
  /** Get selection frame for a node */
  getSelectionFrame: (id: string, name: string, locked?: boolean) => SelectionFrame | null;
  
  /** Build selection frames map from nodes */
  buildSelectionFrames: (nodes: Array<{ id: string; name: string; locked?: boolean }>) => Map<string, SelectionFrame>;
  
  // ─── Hit Testing ───
  
  /** Hit test at world coordinates */
  hitTest: (worldX: number, worldY: number, nodeIds: string[]) => HitTestResult[];
  
  /** Check if point is inside a node */
  hitTestNode: (worldX: number, worldY: number, id: string) => boolean;
  
  /** Find topmost node at position */
  findTopmostNode: (worldX: number, worldY: number, orderedNodeIds: string[], filter?: (id: string) => boolean) => string | null;
  
  /** Find nodes in rectangle (marquee selection) */
  findNodesInRect: (rect: BoundingBox, nodeIds: string[], mode?: 'intersect' | 'contain') => string[];
  
  // ─── Layout Bounds ───
  
  /** Get CSS position values */
  getCSSPosition: (id: string) => { left: string; top: string; width: string; height: string; transform?: string } | null;
  
  /** Get layout bounds relative to parent */
  getLayoutBounds: (id: string, parentId: string | null) => { x: number; y: number; width: number; height: number } | null;
  
  // ─── Coordinate Conversion ───
  
  /** Screen to world coordinates */
  screenToWorld: (screenX: number, screenY: number, offset: Point2D, scale: number) => Point2D;
  
  /** World to screen coordinates */
  worldToScreen: (worldX: number, worldY: number, offset: Point2D, scale: number) => Point2D;
  
  /** World to node local coordinates */
  worldToLocal: (id: string, worldPoint: Point2D) => Point2D | null;
  
  /** Node local to world coordinates */
  localToWorld: (id: string, localPoint: Point2D) => Point2D | null;
  
  // ─── Snapping ───
  
  /** Snap a point */
  snap: (point: Point2D, excludeIds?: Set<string>) => SnapResult;
  
  /** Snap bounds */
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

export function useGeometry(): UseGeometryResult {
  const serviceRef = useRef<GeometryService | null>(null);
  
  if (!serviceRef.current) {
    serviceRef.current = new GeometryService();
  }
  
  const service = serviceRef.current;
  
  // ─── Sync ───
  
  const syncFromSceneGraph = useCallback((nodes: Map<string, SceneNode>) => {
    service.syncFromSceneGraph(nodes);
  }, [service]);
  
  // ─── Geometry Queries ───
  
  const getGeometry = useCallback((id: string) => {
    return service.getGeometry(id);
  }, [service]);
  
  const getWorldBounds = useCallback((id: string) => {
    return service.getWorldBounds(id);
  }, [service]);
  
  const getWorldTransform = useCallback((id: string) => {
    return service.getWorldTransform(id);
  }, [service]);
  
  // ─── Selection Frames ───
  
  const getSelectionFrame = useCallback((id: string, name: string, locked = false) => {
    return service.getSelectionFrame(id, name, locked);
  }, [service]);
  
  const buildSelectionFrames = useCallback((nodes: Array<{ id: string; name: string; locked?: boolean }>) => {
    return service.getSelectionFrames(nodes);
  }, [service]);
  
  // ─── Hit Testing ───
  
  const hitTest = useCallback((worldX: number, worldY: number, nodeIds: string[]) => {
    return service.hitTest(worldX, worldY, nodeIds);
  }, [service]);
  
  const hitTestNode = useCallback((worldX: number, worldY: number, id: string) => {
    return service.hitTestNode(worldX, worldY, id);
  }, [service]);
  
  const findTopmostNode = useCallback((
    worldX: number,
    worldY: number,
    orderedNodeIds: string[],
    filter?: (id: string) => boolean
  ) => {
    return service.findTopmostNode(worldX, worldY, orderedNodeIds, filter);
  }, [service]);
  
  const findNodesInRect = useCallback((
    rect: BoundingBox,
    nodeIds: string[],
    mode: 'intersect' | 'contain' = 'intersect'
  ) => {
    return service.findNodesInRect(rect, nodeIds, mode);
  }, [service]);
  
  // ─── Layout Bounds ───
  
  const getCSSPosition = useCallback((id: string) => {
    return service.getCSSPosition(id);
  }, [service]);
  
  const getLayoutBounds = useCallback((id: string, parentId: string | null) => {
    return service.getLayoutBounds(id, parentId);
  }, [service]);
  
  // ─── Coordinate Conversion ───
  
  const screenToWorld = useCallback((screenX: number, screenY: number, offset: Point2D, scale: number) => {
    return service.screenToWorld(screenX, screenY, offset, scale);
  }, [service]);
  
  const worldToScreen = useCallback((worldX: number, worldY: number, offset: Point2D, scale: number) => {
    return service.worldToScreen(worldX, worldY, offset, scale);
  }, [service]);
  
  const worldToLocal = useCallback((id: string, worldPoint: Point2D) => {
    return service.worldToLocal(id, worldPoint);
  }, [service]);
  
  const localToWorld = useCallback((id: string, localPoint: Point2D) => {
    return service.localToWorld(id, localPoint);
  }, [service]);
  
  // ─── Snapping ───
  
  const snap = useCallback((point: Point2D, excludeIds?: Set<string>) => {
    return service.snap(point, excludeIds);
  }, [service]);
  
  const snapBounds = useCallback((bounds: BoundingBox, excludeIds?: Set<string>) => {
    return service.snapBounds(bounds, excludeIds);
  }, [service]);
  
  return {
    service,
    syncFromSceneGraph,
    getGeometry,
    getWorldBounds,
    getWorldTransform,
    getSelectionFrame,
    buildSelectionFrames,
    hitTest,
    hitTestNode,
    findTopmostNode,
    findNodesInRect,
    getCSSPosition,
    getLayoutBounds,
    screenToWorld,
    worldToScreen,
    worldToLocal,
    localToWorld,
    snap,
    snapBounds,
  };
}
