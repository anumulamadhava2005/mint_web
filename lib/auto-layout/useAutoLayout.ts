/**
 * useAutoLayout.ts
 * 
 * React hook for managing auto-layout state and calculations.
 * Provides reactive updates when children or layout config changes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AutoLayoutEngine,
  AutoLayoutConfig,
  LayoutNode,
  LayoutResult,
  FrameSize,
  LayoutDirection,
  AlignItems,
  AlignContent,
  Constraints,
} from './AutoLayoutEngine';

export interface UseAutoLayoutOptions {
  /** Initial layout configuration */
  config: AutoLayoutConfig;
  /** Child nodes to layout */
  children: LayoutNode[];
  /** Frame size - if undefined, will auto-resize */
  frameSize?: FrameSize;
  /** Enable auto-resizing based on children */
  autoResize?: boolean;
  /** Callback when frame size changes */
  onFrameSizeChange?: (size: FrameSize) => void;
}

export interface UseAutoLayoutResult {
  /** Calculated layout positions for all children */
  layout: LayoutResult[];
  /** Current frame size */
  frameSize: FrameSize;
  /** Update layout configuration */
  updateConfig: (config: Partial<AutoLayoutConfig>) => void;
  /** Update a specific child node */
  updateChild: (id: string, updates: Partial<LayoutNode>) => void;
  /** Add a new child node */
  addChild: (node: LayoutNode) => void;
  /** Remove a child node */
  removeChild: (id: string) => void;
  /** Manually trigger layout recalculation */
  recalculate: () => void;
  /** Current layout configuration */
  config: AutoLayoutConfig;
}

/**
 * Hook for managing auto-layout frames
 */
export function useAutoLayout(options: UseAutoLayoutOptions): UseAutoLayoutResult {
  const [config, setConfig] = useState<AutoLayoutConfig>(options.config);
  const [children, setChildren] = useState<LayoutNode[]>(options.children);
  const [manualFrameSize, setManualFrameSize] = useState<FrameSize | undefined>(
    options.frameSize
  );
  
  // Calculate auto frame size if enabled
  const autoFrameSize = useMemo(() => {
    if (!options.autoResize) return null;
    
    return AutoLayoutEngine.calculateFrameSize(
      config,
      children,
      manualFrameSize || { width: 0, height: 0 }
    );
  }, [config, children, options.autoResize, manualFrameSize]);
  
  // Use auto size if enabled, otherwise use manual size
  const frameSize = options.autoResize && autoFrameSize 
    ? autoFrameSize 
    : manualFrameSize || { width: 0, height: 0 };
  
  // Calculate layout
  const layout = useMemo(() => {
    return AutoLayoutEngine.calculate(config, children, frameSize);
  }, [config, children, frameSize]);
  
  // Notify on frame size changes
  useEffect(() => {
    if (options.onFrameSizeChange && frameSize) {
      options.onFrameSizeChange(frameSize);
    }
  }, [frameSize, options.onFrameSizeChange]);
  
  // Update config
  const updateConfig = useCallback((updates: Partial<AutoLayoutConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Update a specific child
  const updateChild = useCallback((id: string, updates: Partial<LayoutNode>) => {
    setChildren(prev =>
      prev.map(child =>
        child.id === id ? { ...child, ...updates } : child
      )
    );
  }, []);
  
  // Add a new child
  const addChild = useCallback((node: LayoutNode) => {
    setChildren(prev => [...prev, node]);
  }, []);
  
  // Remove a child
  const removeChild = useCallback((id: string) => {
    setChildren(prev => prev.filter(child => child.id !== id));
  }, []);
  
  // Manual recalculation trigger
  const recalculate = useCallback(() => {
    setChildren(prev => [...prev]); // Force re-render
  }, []);
  
  return {
    layout,
    frameSize,
    updateConfig,
    updateChild,
    addChild,
    removeChild,
    recalculate,
    config,
  };
}

/**
 * Helper hook for managing frame resize with constraints
 */
export function useConstraints(
  node: LayoutNode,
  originalPosition: { x: number; y: number },
  originalFrameSize: FrameSize
) {
  const [currentFrameSize, setCurrentFrameSize] = useState(originalFrameSize);
  
  const constrainedLayout = useMemo(() => {
    return AutoLayoutEngine.applyConstraints(
      node,
      originalPosition,
      originalFrameSize,
      currentFrameSize
    );
  }, [node, originalPosition, originalFrameSize, currentFrameSize]);
  
  return {
    layout: constrainedLayout,
    setFrameSize: setCurrentFrameSize,
    frameSize: currentFrameSize,
  };
}

/**
 * Helper to create default auto-layout config
 */
export function createDefaultAutoLayoutConfig(
  overrides?: Partial<AutoLayoutConfig>
): AutoLayoutConfig {
  return {
    layoutMode: 'HORIZONTAL',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    itemSpacing: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    layoutWrap: 'NO_WRAP',
    ...overrides,
  };
}

/**
 * Helper to create default layout node
 */
export function createLayoutNode(
  id: string,
  width: number,
  height: number,
  overrides?: Partial<LayoutNode>
): LayoutNode {
  return {
    id,
    width,
    height,
    constraints: {
      horizontal: 'MIN',
      vertical: 'MIN',
    },
    ...overrides,
  };
}

// Export types for convenience
export type {
  AutoLayoutConfig,
  LayoutNode,
  LayoutResult,
  FrameSize,
  LayoutDirection,
  AlignItems,
  AlignContent,
  Constraints,
};
