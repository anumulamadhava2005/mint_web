/**
 * Figma-like Canvas Engine
 * 
 * A complete design tool engine with all Figma-like features.
 * 
 * Features:
 * - Scene/Node Model: Full property support for all node types
 * - Geometry & Transform: Matrix transforms, bounds, hit testing
 * - Layout: Auto-layout with all Figma features
 * - Visual Styling: Fills, strokes, effects, corners
 * - Text: Full typography support
 * - Components: Component/instance system with variants
 * - Selection: Multi-select, handles, rotation
 * - Snapping: Grid, edges, centers, smart guides
 * - History: Undo/redo with drag coalescing
 * - Viewport: Zoom at cursor, smooth pan, fit to selection
 * - Keyboard: Full shortcut support
 */

// Scene Graph
export * from './scene-graph/FigmaNode';
export * from './scene-graph/SelectionManager';

// Interaction
export * from './interaction/DragManager';
export * from './interaction/SnappingEngine';
export * from './interaction/HistoryManager';
export * from './interaction/ViewportManager';
export * from './interaction/KeyboardManager';

// Layout
export * from './layout/AutoLayoutEngine';

// Rendering
export * from './rendering/RenderEngine';

// Components
export * from './components/ComponentSystem';

// Re-export singletons for convenience
export { selectionManager } from './scene-graph/SelectionManager';
export { snappingEngine } from './interaction/SnappingEngine';
export { historyManager } from './interaction/HistoryManager';
export { viewportManager } from './interaction/ViewportManager';
export { keyboardManager } from './interaction/KeyboardManager';
export { autoLayoutEngine } from './layout/AutoLayoutEngine';
export { renderEngine } from './rendering/RenderEngine';
export { componentSystem } from './components/ComponentSystem';
