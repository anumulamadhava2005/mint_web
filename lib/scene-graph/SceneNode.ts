/**
 * SceneNode - Canonical model for the scene graph
 * 
 * Single source of truth for node structure across:
 * - Snapshot persistence
 * - Canvas rendering (CanvasStage + canvas-draw)
 * - DOM rendering (CanvasRenderer, RenderTree, Box)
 * - Drawable conversion (useDrawable)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Node Types
// ─────────────────────────────────────────────────────────────────────────────

export type SceneNodeType = 'FRAME' | 'GROUP' | 'SHAPE' | 'TEXT';

// ─────────────────────────────────────────────────────────────────────────────
// Transform Types
// ─────────────────────────────────────────────────────────────────────────────

/** 2D affine transform matrix [a, b, c, d, tx, ty] */
export type Transform2D = [number, number, number, number, number, number];

/** Simple transform with position, rotation, scale */
export interface TransformComponents {
  x: number;
  y: number;
  rotation: number;      // degrees
  scaleX: number;
  scaleY: number;
}

/** Identity transform */
export const IDENTITY_TRANSFORM: Transform2D = [1, 0, 0, 1, 0, 0];

// ─────────────────────────────────────────────────────────────────────────────
// Layout Types
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

export type LayoutAlign = 
  | 'flex-start' 
  | 'flex-end' 
  | 'center' 
  | 'space-between' 
  | 'space-around' 
  | 'space-evenly' 
  | 'stretch';

export type LayoutPosition = 'auto' | 'absolute';

/** Sizing mode for width/height computation */
export type SizingMode = 'FIXED' | 'HUG' | 'FILL';

/** Sizing configuration with min/max constraints */
export interface SizingConfig {
  horizontal: SizingMode;
  vertical: SizingMode;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface LayoutConfig {
  /** Layout mode: NONE (absolute), HORIZONTAL (row flex), VERTICAL (column flex) */
  mode: LayoutMode;
  
  /** Position within parent: auto (flow) or absolute (manual) */
  position: LayoutPosition;
  
  /** Primary axis alignment (justify-content) */
  primaryAxisAlign: LayoutAlign;
  
  /** Counter axis alignment (align-items) */
  counterAxisAlign: LayoutAlign;
  
  /** Gap between children */
  gap: number;
  
  /** Padding */
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  
  /** Whether children can wrap to next line */
  wrap?: boolean;
  
  /** Sizing mode configuration */
  sizing?: SizingConfig;
  
  /** Whether this node ignores parent layout (positioned absolutely) */
  absolutePosition?: boolean;
  
  /** Flex item properties (when this node is a child of a flex container) */
  flexItem: {
    grow: number;
    shrink: number;
    basis: number | 'auto';
    alignSelf: LayoutAlign | 'auto';
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConstraintValue = 
  | 'MIN'      // pin to start
  | 'MAX'      // pin to end
  | 'CENTER'   // center in parent
  | 'STRETCH'  // stretch to fill
  | 'SCALE';   // scale proportionally

export interface Constraints {
  horizontal: ConstraintValue;
  vertical: ConstraintValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ColorRGBA {
  r: number;  // 0-1
  g: number;  // 0-1
  b: number;  // 0-1
  a: number;  // 0-1
}

export interface GradientStop {
  position: number;  // 0-1
  color: string;     // hex or rgba
}

export type FillType = 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';

export interface Fill {
  type: FillType;
  color?: string;
  opacity?: number;
  stops?: GradientStop[];
  imageRef?: string;
  imageFit?: 'cover' | 'contain' | 'fill';
  visible: boolean;
}

export interface Stroke {
  color: string;
  weight: number;
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE';
  dashPattern?: number[];
  visible: boolean;
}

export interface CornerRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export type EffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'BLUR' | 'BACKGROUND_BLUR';

export interface Effect {
  type: EffectType;
  visible: boolean;
  // Shadow properties
  color?: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  spread?: number;
  // Blur properties
  blurRadius?: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number | 'auto';
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'center' | 'bottom';
  textDecoration: 'none' | 'underline' | 'line-through';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color: string;
}

export interface NodeStyles {
  fills: Fill[];
  strokes: Stroke[];
  corners: CornerRadius;
  effects: Effect[];
  opacity: number;
  blendMode: string;
  /** For text nodes */
  text?: TextStyle;
  /** Background color shorthand (legacy compat) */
  backgroundColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Binding Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DataSource {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, string>;
  selectedFields?: string[];
  infiniteScroll?: boolean;
  itemSpacing?: number;
  direction?: 'vertical' | 'horizontal';
}

export interface DataBinding {
  field: string;
  parentId: string;
  type: 'field' | 'template';
  template?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneNode - The Canonical Model
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneNode {
  /** Unique identifier */
  id: string;
  
  /** Parent node ID (null for root frames) */
  parentId: string | null;
  
  /** Display name */
  name: string;
  
  /** Node type */
  type: SceneNodeType;
  
  /**
   * Ordered child node IDs - DETERMINES Z-ORDER
   * 
   * Z-ORDER RULES:
   * - children[] array order IS the render order (z-order)
   * - Earlier children render BEHIND later children (painter's algorithm)
   * - Canvas draw order and DOM render order both follow this order
   * - LayersPanel drag-and-drop reorders children[] to change z-order
   * - NO implicit z-index - children[] is the single source of truth
   */
  children: string[];
  
  // ─── Transforms ───
  
  /** Local transform relative to parent */
  localTransform: Transform2D;
  
  /** Computed world transform (cached) */
  worldTransform: Transform2D;
  
  /** Local bounds (width, height) */
  size: { width: number; height: number };
  
  // ─── Layout ───
  
  /** Layout configuration */
  layout: LayoutConfig;
  
  /** Resize constraints */
  constraints: Constraints;
  
  // ─── Styles ───
  
  /** Visual styles */
  styles: NodeStyles;
  
  // ─── State ───
  
  /** Visibility */
  visible: boolean;
  
  /** Locked (not selectable/editable) */
  locked: boolean;
  
  /** Clips children to bounds */
  clipsContent: boolean;
  
  // ─── Content ───
  
  /** Text content (for TEXT nodes) */
  textContent?: string;
  
  // ─── Data ───
  
  /** Data source for dynamic content */
  dataSource?: DataSource;
  
  /** Data binding for text fields */
  dataBinding?: DataBinding;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Factories
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: LayoutConfig = {
  mode: 'NONE',
  position: 'absolute',
  primaryAxisAlign: 'flex-start',
  counterAxisAlign: 'flex-start',
  gap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  flexItem: {
    grow: 0,
    shrink: 1,
    basis: 'auto',
    alignSelf: 'auto',
  },
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  horizontal: 'MIN',
  vertical: 'MIN',
};

export const DEFAULT_CORNER_RADIUS: CornerRadius = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
};

export const DEFAULT_STYLES: NodeStyles = {
  fills: [],
  strokes: [],
  corners: DEFAULT_CORNER_RADIUS,
  effects: [],
  opacity: 1,
  blendMode: 'normal',
};

export function createSceneNode(
  id: string,
  type: SceneNodeType,
  partial?: Partial<SceneNode>
): SceneNode {
  return {
    id,
    parentId: null,
    name: type,
    type,
    children: [],
    localTransform: [...IDENTITY_TRANSFORM],
    worldTransform: [...IDENTITY_TRANSFORM],
    size: { width: 100, height: 100 },
    layout: { ...DEFAULT_LAYOUT },
    constraints: { ...DEFAULT_CONSTRAINTS },
    styles: { ...DEFAULT_STYLES },
    visible: true,
    locked: false,
    clipsContent: false,
    ...partial,
  };
}
