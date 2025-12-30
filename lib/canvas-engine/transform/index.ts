/**
 * Transform module - Matrix math and transform management
 */

// Core engine
export {
  TransformEngine,
  transformEngine,
  
  // Types
  type Matrix2D,
  type Point2D,
  type Size2D,
  type BoundingBox,
  type TransformComponents,
  type NodeTransform,
  type SnapConfig,
  type SnapResult,
  type SnapGuide,
  
  // Constants
  IDENTITY_MATRIX,
  
  // Matrix utilities
  identity,
  translate,
  rotate,
  scale,
  skew,
  multiply,
  multiplyAll,
  invert,
  transformPoint,
  transformVector,
  decompose,
  compose,
  rotateAround,
  scaleAround,
  matrixEquals,
  cloneMatrix,
  
  // Snapping utilities
  snapToGrid,
  snapPointToGrid,
  roundForDisplay,
  roundPointForDisplay,
} from './TransformEngine';

// React hook
export {
  useTransformEngine,
  type UseTransformEngineResult,
} from './useTransformEngine';
