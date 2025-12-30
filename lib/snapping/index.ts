/**
 * Snapping Module
 * 
 * Provides intelligent snapping during drag and resize operations:
 * - Grid snapping
 * - Sibling edge alignment
 * - Center alignment
 * - Frame/parent edge alignment
 */

export {
  SnappingEngine,
  type Rect,
  type Point,
  type SnapGuide,
  type SnapType,
  type SnapTarget,
  type SnapResult,
  type SnappingOptions,
  type SnapCandidate,
  getSnappingEngine,
  createSnappingEngine,
} from './SnappingEngine';

export {
  useSnapping,
  type UseSnappingOptions,
  type UseSnappingResult,
} from './useSnapping';

export {
  SnapGuidesOverlay,
  type SnapGuidesOverlayProps,
  drawSnapGuides,
} from './SnapGuidesOverlay';
