/**
 * Constraints Engine Module
 * 
 * Handles constraint-based child repositioning when parent resizes.
 * Supports: MIN (left/top), MAX (right/bottom), CENTER, STRETCH, SCALE
 */

export {
  ConstraintsEngine,
  constraintsEngine,
  parseConstraint,
  constraintToString,
  wouldAffectChildren,
  type Rect,
  type EdgeDistances,
  type ConstraintResult,
  type ParentResize,
  type ConstraintReference,
  type ConstraintUpdate,
} from './ConstraintsEngine';

export {
  useConstraintsEngine,
  useConstraintUpdates,
  type UseConstraintsEngineResult,
} from './useConstraintsEngine';

export {
  resizeWithConstraints,
  previewConstraintUpdates,
  getAffectedChildIds,
  getNodeBounds,
  findNodeInput,
  type ResizeWithConstraintsParams,
  type ResizeWithConstraintsResult,
} from './ConstraintsIntegration';
