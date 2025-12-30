/**
 * Viewport Module
 * 
 * Centralized zoom/pan logic for canvas rendering:
 * - Zoom centered on cursor
 * - Canvas/DOM preview sync
 * - DevicePixelRatio handling
 * - Coordinate transforms
 */

export {
  ViewportManager,
  type ViewportState,
  type ViewportConfig,
  type ScreenPoint,
  type WorldPoint,
  type ViewportRect,
  useViewport,
  type UseViewportOptions,
  type UseViewportResult,
  getViewportManager,
  createViewportManager,
} from './ViewportManager';
