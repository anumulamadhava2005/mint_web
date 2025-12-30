/**
 * Scene Graph Module
 * 
 * Canonical model for the scene tree structure.
 * Single source of truth across Canvas 2D, DOM renderers, and persistence.
 */

// Core types
export * from './SceneNode';

// Mapper utilities
export {
  nodeInputToSceneNode,
  drawableToSceneNode,
  snapshotToSceneGraph,
  getRootNodes,
  getChildren,
} from './SceneNodeMapper';

// Geometry service (unified geometry using TransformEngine)
export {
  GeometryService,
  geometryService,
  type NodeGeometry,
  type SelectionFrame,
  type HitTestResult,
} from './GeometryService';

// Geometry hook
export {
  useGeometry,
  type UseGeometryResult,
} from './useGeometry';

// Hit test service (proper tree-traversal hit testing)
export {
  HitTestService,
  hitTestService,
  type HitTestResult as HitTestServiceResult,
  type HitTestOptions,
  type Point,
  type Rect,
} from './HitTestService';

// Hit test hook
export {
  useHitTest,
  type UseHitTestReturn,
} from './useHitTest';

// Re-export types explicitly for convenience
export type {
  SceneNode,
  SceneNodeType,
  Transform2D,
  TransformComponents,
  LayoutMode,
  LayoutAlign,
  LayoutPosition,
  SizingMode,
  SizingConfig,
  LayoutConfig,
  ConstraintValue,
  Constraints,
  Fill,
  FillType,
  Stroke,
  CornerRadius,
  Effect,
  EffectType,
  TextStyle,
  NodeStyles,
  DataSource,
  DataBinding,
} from './SceneNode';