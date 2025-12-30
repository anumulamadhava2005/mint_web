/**
 * useSnapping - React hook for snap functionality
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { 
  SnappingEngine, 
  SnappingOptions, 
  SnapResult, 
  SnapGuide, 
  SnapTarget,
  Rect 
} from './SnappingEngine';

export interface UseSnappingOptions extends SnappingOptions {
  /** Whether snapping is enabled */
  enabled?: boolean;
}

export interface UseSnappingResult {
  /** Whether snapping is currently enabled */
  enabled: boolean;
  /** Toggle snapping on/off */
  setEnabled: (enabled: boolean) => void;
  /** Update snapping options */
  setOptions: (options: Partial<SnappingOptions>) => void;
  /** Set snap targets (siblings) */
  setTargets: (targets: SnapTarget[]) => void;
  /** Set parent frame bounds */
  setParentBounds: (bounds: Rect | null) => void;
  /** Clear all targets and guides */
  clear: () => void;
  /** Snap a position during drag */
  snap: (nodeId: string, nodeBounds: Rect, proposedX: number, proposedY: number) => SnapResult;
  /** Snap during resize */
  snapResize: (nodeId: string, originalBounds: Rect, handle: string, proposedBounds: Rect) => SnapResult;
  /** Get current snap guides for rendering */
  guides: SnapGuide[];
  /** Clear guides (call when drag ends) */
  clearGuides: () => void;
  /** The underlying engine instance */
  engine: SnappingEngine;
}

export function useSnapping(options: UseSnappingOptions = {}): UseSnappingResult {
  const { enabled: initialEnabled = true, ...engineOptions } = options;
  
  const [enabled, setEnabled] = useState(initialEnabled);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  
  const engineRef = useRef<SnappingEngine | null>(null);
  
  // Create engine once
  if (!engineRef.current) {
    engineRef.current = new SnappingEngine(engineOptions);
  }
  
  const engine = engineRef.current;
  
  const setOptions = useCallback((opts: Partial<SnappingOptions>) => {
    engine.setOptions(opts);
  }, [engine]);
  
  const setTargets = useCallback((targets: SnapTarget[]) => {
    engine.setTargets(targets);
  }, [engine]);
  
  const setParentBounds = useCallback((bounds: Rect | null) => {
    engine.setParentBounds(bounds);
  }, [engine]);
  
  const clear = useCallback(() => {
    engine.clearTargets();
    setGuides([]);
  }, [engine]);
  
  const snap = useCallback((
    nodeId: string, 
    nodeBounds: Rect, 
    proposedX: number, 
    proposedY: number
  ): SnapResult => {
    if (!enabled) {
      return {
        snappedX: proposedX,
        snappedY: proposedY,
        snapDeltaX: 0,
        snapDeltaY: 0,
        didSnapX: false,
        didSnapY: false,
        guides: [],
      };
    }
    
    const result = engine.snap(nodeId, nodeBounds, proposedX, proposedY);
    setGuides(result.guides);
    return result;
  }, [engine, enabled]);
  
  const snapResize = useCallback((
    nodeId: string,
    originalBounds: Rect,
    handle: string,
    proposedBounds: Rect
  ): SnapResult => {
    if (!enabled) {
      return {
        snappedX: proposedBounds.x,
        snappedY: proposedBounds.y,
        snapDeltaX: 0,
        snapDeltaY: 0,
        didSnapX: false,
        didSnapY: false,
        guides: [],
      };
    }
    
    const result = engine.snapResize(nodeId, originalBounds, handle, proposedBounds);
    setGuides(result.guides);
    return result;
  }, [engine, enabled]);
  
  const clearGuides = useCallback(() => {
    engine.clearGuides();
    setGuides([]);
  }, [engine]);
  
  return useMemo(() => ({
    enabled,
    setEnabled,
    setOptions,
    setTargets,
    setParentBounds,
    clear,
    snap,
    snapResize,
    guides,
    clearGuides,
    engine,
  }), [enabled, setOptions, setTargets, setParentBounds, clear, snap, snapResize, guides, clearGuides, engine]);
}
