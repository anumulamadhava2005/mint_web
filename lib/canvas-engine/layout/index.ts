/**
 * Layout Engine Module
 * 
 * Provides layout computation for SceneNode trees with three modes:
 * - ABSOLUTE: Direct positioning with constraints
 * - AUTO_LAYOUT: Figma-style row/column layout
 * - FLEX: CSS Flexbox parity
 */

export {
  // Main engine
  LayoutEngine,
  layoutEngine,
  
  // Types - Layout modes
  type LayoutEngineMode,
  type HorizontalConstraint,
  type VerticalConstraint,
  type Constraints,
  type SizingMode,
  type Sizing,
  type PrimaryAxisAlign,
  type CounterAxisAlign,
  type AlignSelf,
  type Padding,
  type LayoutProps,
  type FlexItemProps,
  type LayoutNode,
  type ComputedLayout,
  type LayoutOptions,
  
  // Defaults
  DEFAULT_LAYOUT_PROPS,
  DEFAULT_SIZING,
  DEFAULT_CONSTRAINTS,
  DEFAULT_FLEX_ITEM,
} from './LayoutEngine';

export {
  useLayoutEngine,
  useSceneLayout,
  type UseLayoutEngineResult,
} from './useLayoutEngine';

// Canvas Layout Bridge - resolves layout for Canvas 2D rendering
export {
  CanvasLayoutBridge,
  canvasLayoutBridge,
  resolvedBoxToDrawable,
  resolvedBoxesToDrawables,
  type ResolvedBox,
  type ResolveOptions,
} from './CanvasLayoutBridge';

export {
  useCanvasLayout,
  useLayoutResolvedDrawables,
  type UseCanvasLayoutOptions,
  type UseCanvasLayoutResult,
} from './useCanvasLayout';
