/**
 * FigmaNode - Complete Figma-compatible node model
 * 
 * Implements all properties required for Figma-like behavior:
 * - Scene/Node Model (id, parentId, children, type, visible, locked, etc.)
 * - Geometry & Transform (x, y, width, height, rotation, scale, transforms)
 * - Layout & Structure (auto-layout, constraints, sizing)
 * - Visual Styling (fills, strokes, effects, corners)
 * - Text Properties (font, alignment, auto-resize)
 * - Component System (componentId, instanceOverrides)
 * - Interaction Properties (isMask, hitSlop)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// NODE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FigmaNodeType = 
  | 'FRAME' 
  | 'GROUP' 
  | 'RECTANGLE' 
  | 'ELLIPSE' 
  | 'POLYGON' 
  | 'STAR' 
  | 'LINE' 
  | 'VECTOR' 
  | 'TEXT' 
  | 'COMPONENT' 
  | 'INSTANCE'
  | 'BOOLEAN_OPERATION'
  | 'SLICE';

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFORM TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** 2D affine transform matrix [a, b, c, d, tx, ty] */
export type Matrix2D = [number, number, number, number, number, number];

/** Identity matrix constant */
export const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];

/** Transform origin point (0-1 relative to size) */
export interface TransformOrigin {
  x: number; // 0-1, default 0.5 (center)
  y: number; // 0-1, default 0.5 (center)
}

/** Decomposed transform components */
export interface TransformComponents {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;     // degrees
  scaleX: number;
  scaleY: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOUNDING & HIT TESTING
// ═══════════════════════════════════════════════════════════════════════════════

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoundsInfo {
  /** Local bounds (relative to parent) */
  localBounds: Bounds;
  /** World bounds (absolute position) */
  worldBounds: Bounds;
  /** Render bounds (includes effects like shadows) */
  renderBounds: Bounds;
}

export interface HitTestConfig {
  /** Extra tolerance for hit detection (pixels) */
  hitSlop: number;
  /** Whether to use precise shape hit testing (vs rect) */
  preciseHitTest: boolean;
  /** Whether pointer events are enabled */
  pointerEvents: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

export type SizingMode = 'FIXED' | 'HUG' | 'FILL';

export type PrimaryAxisAlign = 
  | 'MIN'           // flex-start
  | 'CENTER'        // center
  | 'MAX'           // flex-end
  | 'SPACE_BETWEEN' // space-between
  | 'SPACE_AROUND'  // space-around
  | 'SPACE_EVENLY'; // space-evenly

export type CounterAxisAlign = 
  | 'MIN'      // flex-start
  | 'CENTER'   // center
  | 'MAX'      // flex-end
  | 'STRETCH'  // stretch
  | 'BASELINE';

export type AlignSelf = 'AUTO' | 'MIN' | 'CENTER' | 'MAX' | 'STRETCH';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AutoLayoutConfig {
  /** Layout direction */
  layoutMode: LayoutMode;
  /** Primary axis sizing */
  primaryAxisSizingMode: SizingMode;
  /** Counter axis sizing */
  counterAxisSizingMode: SizingMode;
  /** Primary axis alignment */
  primaryAxisAlignItems: PrimaryAxisAlign;
  /** Counter axis alignment */
  counterAxisAlignItems: CounterAxisAlign;
  /** Padding */
  padding: Padding;
  /** Gap between items */
  itemSpacing: number;
  /** Gap between rows (for wrap) */
  counterAxisSpacing: number;
  /** Whether items can wrap */
  layoutWrap: 'NO_WRAP' | 'WRAP';
  /** Reverse order */
  itemReverseZIndex: boolean;
  /** Stroke behavior in layout */
  strokesIncludedInLayout: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRAINT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type HorizontalConstraint = 
  | 'LEFT'        // Pin to left edge
  | 'RIGHT'       // Pin to right edge
  | 'LEFT_RIGHT'  // Stretch to both edges
  | 'CENTER'      // Center horizontally
  | 'SCALE';      // Scale proportionally

export type VerticalConstraint = 
  | 'TOP'         // Pin to top edge
  | 'BOTTOM'      // Pin to bottom edge
  | 'TOP_BOTTOM'  // Stretch to both edges
  | 'CENTER'      // Center vertically
  | 'SCALE';      // Scale proportionally

export interface Constraints {
  horizontal: HorizontalConstraint;
  vertical: VerticalConstraint;
}

export interface SizeConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ColorRGBA {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export type BlendMode = 
  | 'PASS_THROUGH'
  | 'NORMAL'
  | 'DARKEN'
  | 'MULTIPLY'
  | 'LINEAR_BURN'
  | 'COLOR_BURN'
  | 'LIGHTEN'
  | 'SCREEN'
  | 'LINEAR_DODGE'
  | 'COLOR_DODGE'
  | 'OVERLAY'
  | 'SOFT_LIGHT'
  | 'HARD_LIGHT'
  | 'DIFFERENCE'
  | 'EXCLUSION'
  | 'HUE'
  | 'SATURATION'
  | 'COLOR'
  | 'LUMINOSITY';

export type FillType = 
  | 'SOLID' 
  | 'GRADIENT_LINEAR' 
  | 'GRADIENT_RADIAL' 
  | 'GRADIENT_ANGULAR' 
  | 'GRADIENT_DIAMOND' 
  | 'IMAGE';

export interface GradientStop {
  position: number; // 0-1
  color: ColorRGBA;
}

export interface GradientTransform {
  /** Gradient handle positions (normalized) */
  handlePositions: Array<{ x: number; y: number }>;
}

export type ScaleMode = 'FILL' | 'FIT' | 'CROP' | 'TILE';

export interface ImageFilters {
  exposure?: number;     // -100 to 100
  contrast?: number;     // -100 to 100
  saturation?: number;   // -100 to 100
  temperature?: number;  // -100 to 100
  tint?: number;         // -100 to 100
  highlights?: number;   // -100 to 100
  shadows?: number;      // -100 to 100
}

export interface Fill {
  type: FillType;
  visible: boolean;
  opacity: number;      // 0-1
  blendMode: BlendMode;
  
  // Solid fill
  color?: ColorRGBA;
  
  // Gradient fill
  gradientStops?: GradientStop[];
  gradientTransform?: GradientTransform;
  
  // Image fill
  imageRef?: string;
  scaleMode?: ScaleMode;
  imageTransform?: Matrix2D;
  rotation?: number;
  filters?: ImageFilters;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STROKE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type StrokeAlign = 'INSIDE' | 'CENTER' | 'OUTSIDE';
export type StrokeCap = 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL';
export type StrokeJoin = 'MITER' | 'BEVEL' | 'ROUND';

export interface Stroke {
  type: FillType;        // Strokes can also be gradients/images
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  
  // Solid stroke
  color?: ColorRGBA;
  
  // Gradient stroke
  gradientStops?: GradientStop[];
  gradientTransform?: GradientTransform;
  
  // Stroke geometry
  strokeWeight: number;
  strokeAlign: StrokeAlign;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  miterLimit: number;
  dashPattern: number[];
  dashOffset: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORNER RADIUS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CornerRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface CornerSmoothing {
  /** iOS-style corner smoothing (0-1) */
  smoothing: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════════

export type EffectType = 
  | 'DROP_SHADOW' 
  | 'INNER_SHADOW' 
  | 'LAYER_BLUR' 
  | 'BACKGROUND_BLUR';

export interface DropShadowEffect {
  type: 'DROP_SHADOW';
  visible: boolean;
  color: ColorRGBA;
  blendMode: BlendMode;
  offsetX: number;
  offsetY: number;
  radius: number;   // blur
  spread: number;
  showShadowBehindNode: boolean;
}

export interface InnerShadowEffect {
  type: 'INNER_SHADOW';
  visible: boolean;
  color: ColorRGBA;
  blendMode: BlendMode;
  offsetX: number;
  offsetY: number;
  radius: number;
  spread: number;
}

export interface BlurEffect {
  type: 'LAYER_BLUR';
  visible: boolean;
  radius: number;
}

export interface BackgroundBlurEffect {
  type: 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
}

export type Effect = 
  | DropShadowEffect 
  | InnerShadowEffect 
  | BlurEffect 
  | BackgroundBlurEffect;

// ═══════════════════════════════════════════════════════════════════════════════
// TEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TextAutoResize = 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
export type TextAlignHorizontal = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
export type TextAlignVertical = 'TOP' | 'CENTER' | 'BOTTOM';
export type TextDecoration = 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
export type TextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED';

export interface TextStyle {
  fontFamily: string;
  fontWeight: number;   // 100-900
  fontSize: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing: { value: number; unit: 'PIXELS' | 'PERCENT' };
  paragraphSpacing: number;
  paragraphIndent: number;
  textAlignHorizontal: TextAlignHorizontal;
  textAlignVertical: TextAlignVertical;
  textAutoResize: TextAutoResize;
  textDecoration: TextDecoration;
  textCase: TextCase;
  hyperlink?: { type: 'URL' | 'NODE'; value: string };
}

export interface TextRange {
  start: number;
  end: number;
  style: Partial<TextStyle>;
  fills?: Fill[];
}

export interface TextNode {
  characters: string;
  style: TextStyle;
  /** Style overrides for specific ranges */
  styleOverrides: TextRange[];
  /** Fill for text (can be different per range) */
  fills: Fill[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComponentProperty {
  name: string;
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  defaultValue: any;
  preferredValues?: any[];
}

export interface ComponentOverride {
  /** Path to overridden node (array of node IDs) */
  nodePath: string[];
  /** Overridden property name */
  property: string;
  /** Override value */
  value: any;
}

export interface ComponentData {
  /** Whether this is a component root */
  isComponentRoot: boolean;
  /** Component definition ID (for instances) */
  componentId?: string;
  /** Variant properties */
  variantProperties?: Record<string, string>;
  /** Instance overrides */
  instanceOverrides?: ComponentOverride[];
  /** Exposed properties */
  exposedProperties?: ComponentProperty[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VECTOR TYPES (for shapes)
// ═══════════════════════════════════════════════════════════════════════════════

export type VectorWindingRule = 'NONZERO' | 'EVENODD';

export interface VectorVertex {
  x: number;
  y: number;
  /** Stroke cap at this vertex */
  strokeCap?: StrokeCap;
}

export interface VectorSegment {
  start: number;        // Vertex index
  end: number;          // Vertex index
  tangentStart?: { x: number; y: number };
  tangentEnd?: { x: number; y: number };
}

export interface VectorRegion {
  windingRule: VectorWindingRule;
  loops: number[][]; // Arrays of segment indices
  fills?: Fill[];
}

export interface VectorNetwork {
  vertices: VectorVertex[];
  segments: VectorSegment[];
  regions: VectorRegion[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOLEAN OPERATION
// ═══════════════════════════════════════════════════════════════════════════════

export type BooleanOperation = 'UNION' | 'INTERSECT' | 'SUBTRACT' | 'EXCLUDE';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FIGMA NODE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface FigmaNode {
  // ─── Identity ───
  /** Stable, immutable identifier */
  id: string;
  /** Parent node ID (null for root) */
  parentId: string | null;
  /** Child node IDs (ordered = z-order) */
  children: string[];
  /** Node type */
  type: FigmaNodeType;
  /** Display name */
  name: string;
  
  // ─── State ───
  /** Visibility */
  visible: boolean;
  /** Locked (not selectable/editable) */
  locked: boolean;
  /** Node-level opacity */
  opacity: number;
  /** Blend mode */
  blendMode: BlendMode;
  /** Whether this node is a mask */
  isMask: boolean;
  /** Mask type if isMask is true */
  maskType?: 'ALPHA' | 'VECTOR' | 'LUMINANCE';
  
  // ─── Transform ───
  /** X position relative to parent */
  x: number;
  /** Y position relative to parent */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  /** Scale X */
  scaleX: number;
  /** Scale Y */
  scaleY: number;
  /** Transform origin (default center) */
  transformOrigin: TransformOrigin;
  /** Local transform matrix (computed from x,y,rotation,scale) */
  localTransform: Matrix2D;
  /** World transform matrix (accumulated from root) */
  worldTransform: Matrix2D;
  
  // ─── Bounds ───
  /** Bounds information */
  bounds: BoundsInfo;
  /** Hit testing configuration */
  hitTest: HitTestConfig;
  
  // ─── Frame Properties ───
  /** Clips children to bounds */
  clipsContent: boolean;
  /** Whether this is a frame root */
  isFrameRoot: boolean;
  
  // ─── Layout ───
  /** Auto-layout configuration */
  autoLayout: AutoLayoutConfig;
  /** Constraints for resizing */
  constraints: Constraints;
  /** Size constraints */
  sizeConstraints: SizeConstraints;
  /** Flex item properties (when child of auto-layout) */
  layoutAlign: AlignSelf;
  layoutGrow: number;
  layoutPositioning: 'AUTO' | 'ABSOLUTE';
  
  // ─── Styles ───
  /** Fills (rendered bottom to top) */
  fills: Fill[];
  /** Strokes */
  strokes: Stroke[];
  /** Corner radius */
  cornerRadius: CornerRadius;
  /** Corner smoothing */
  cornerSmoothing: CornerSmoothing;
  /** Effects */
  effects: Effect[];
  
  // ─── Text (for TEXT nodes) ───
  textData?: TextNode;
  
  // ─── Component (for COMPONENT/INSTANCE nodes) ───
  componentData?: ComponentData;
  
  // ─── Vector (for vector shapes) ───
  vectorNetwork?: VectorNetwork;
  
  // ─── Boolean Operation ───
  booleanOperation?: BooleanOperation;
  
  // ─── Exports ───
  exportSettings?: Array<{
    suffix: string;
    format: 'PNG' | 'JPG' | 'SVG' | 'PDF';
    constraint: { type: 'SCALE' | 'WIDTH' | 'HEIGHT'; value: number };
  }>;
  
  // ─── Reactions/Interactions ───
  reactions?: Array<{
    trigger: { type: 'ON_CLICK' | 'ON_HOVER' | 'ON_PRESS' | 'ON_DRAG' | 'MOUSE_ENTER' | 'MOUSE_LEAVE' | 'MOUSE_DOWN' | 'MOUSE_UP' };
    action: {
      type: 'NAVIGATE' | 'SWAP' | 'OVERLAY' | 'BACK' | 'CLOSE' | 'URL' | 'NODE';
      destinationId?: string;
      navigation?: 'NAVIGATE' | 'SWAP' | 'OVERLAY';
      transition?: {
        type: 'DISSOLVE' | 'SMART_ANIMATE' | 'MOVE_IN' | 'MOVE_OUT' | 'PUSH' | 'SLIDE_IN' | 'SLIDE_OUT';
        direction?: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
        duration: number;
        easing: { type: 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_AND_OUT' | 'CUSTOM'; easingFunctionCubicBezier?: { x1: number; y1: number; x2: number; y2: number } };
      };
    };
  }>;
  
  // ─── Plugin Data ───
  pluginData?: Record<string, string>;
  sharedPluginData?: Record<string, Record<string, string>>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_TRANSFORM_ORIGIN: TransformOrigin = { x: 0.5, y: 0.5 };

export const DEFAULT_BOUNDS: Bounds = { x: 0, y: 0, width: 100, height: 100 };

export const DEFAULT_BOUNDS_INFO: BoundsInfo = {
  localBounds: { ...DEFAULT_BOUNDS },
  worldBounds: { ...DEFAULT_BOUNDS },
  renderBounds: { ...DEFAULT_BOUNDS },
};

export const DEFAULT_HIT_TEST: HitTestConfig = {
  hitSlop: 0,
  preciseHitTest: false,
  pointerEvents: true,
};

export const DEFAULT_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

export const DEFAULT_AUTO_LAYOUT: AutoLayoutConfig = {
  layoutMode: 'NONE',
  primaryAxisSizingMode: 'FIXED',
  counterAxisSizingMode: 'FIXED',
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  padding: { ...DEFAULT_PADDING },
  itemSpacing: 0,
  counterAxisSpacing: 0,
  layoutWrap: 'NO_WRAP',
  itemReverseZIndex: false,
  strokesIncludedInLayout: false,
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  horizontal: 'LEFT',
  vertical: 'TOP',
};

export const DEFAULT_SIZE_CONSTRAINTS: SizeConstraints = {};

export const DEFAULT_CORNER_RADIUS: CornerRadius = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
};

export const DEFAULT_CORNER_SMOOTHING: CornerSmoothing = { smoothing: 0 };

export const DEFAULT_COLOR: ColorRGBA = { r: 1, g: 1, b: 1, a: 1 };

export const DEFAULT_FILL: Fill = {
  type: 'SOLID',
  visible: true,
  opacity: 1,
  blendMode: 'NORMAL',
  color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
};

export const DEFAULT_STROKE: Stroke = {
  type: 'SOLID',
  visible: true,
  opacity: 1,
  blendMode: 'NORMAL',
  color: { r: 0, g: 0, b: 0, a: 1 },
  strokeWeight: 1,
  strokeAlign: 'CENTER',
  strokeCap: 'NONE',
  strokeJoin: 'MITER',
  miterLimit: 4,
  dashPattern: [],
  dashOffset: 0,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontWeight: 400,
  fontSize: 16,
  fontStyle: 'normal',
  lineHeight: { value: 100, unit: 'AUTO' },
  letterSpacing: { value: 0, unit: 'PIXELS' },
  paragraphSpacing: 0,
  paragraphIndent: 0,
  textAlignHorizontal: 'LEFT',
  textAlignVertical: 'TOP',
  textAutoResize: 'WIDTH_AND_HEIGHT',
  textDecoration: 'NONE',
  textCase: 'ORIGINAL',
};

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

let nodeIdCounter = 0;

export function generateNodeId(): string {
  return `node_${Date.now()}_${++nodeIdCounter}`;
}

export function createFigmaNode(
  typeOrPartial: FigmaNodeType | (Partial<FigmaNode> & { type?: FigmaNodeType }),
  partial?: Partial<FigmaNode>
): FigmaNode {
  // Support both signatures:
  // createFigmaNode('FRAME', { width: 100 }) 
  // createFigmaNode({ type: 'FRAME', width: 100 })
  let nodeType: FigmaNodeType;
  let nodePartial: Partial<FigmaNode> | undefined;
  
  if (typeof typeOrPartial === 'string') {
    nodeType = typeOrPartial;
    nodePartial = partial;
  } else {
    nodeType = typeOrPartial.type ?? 'FRAME';
    nodePartial = typeOrPartial;
  }
  
  const id = nodePartial?.id ?? generateNodeId();
  
  return {
    // Identity
    id,
    parentId: null,
    children: [],
    type: nodeType,
    name: nodePartial?.name ?? nodeType,
    
    // State
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'PASS_THROUGH',
    isMask: false,
    
    // Transform
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    transformOrigin: { ...DEFAULT_TRANSFORM_ORIGIN },
    localTransform: [...IDENTITY_MATRIX],
    worldTransform: [...IDENTITY_MATRIX],
    
    // Bounds
    bounds: { ...DEFAULT_BOUNDS_INFO },
    hitTest: { ...DEFAULT_HIT_TEST },
    
    // Frame
    clipsContent: nodeType === 'FRAME',
    isFrameRoot: nodeType === 'FRAME',
    
    // Layout
    autoLayout: { ...DEFAULT_AUTO_LAYOUT },
    constraints: { ...DEFAULT_CONSTRAINTS },
    sizeConstraints: { ...DEFAULT_SIZE_CONSTRAINTS },
    layoutAlign: 'AUTO',
    layoutGrow: 0,
    layoutPositioning: 'AUTO',
    
    // Styles
    fills: nodeType === 'FRAME' ? [{ ...DEFAULT_FILL }] : [],
    strokes: [],
    cornerRadius: { ...DEFAULT_CORNER_RADIUS },
    cornerSmoothing: { ...DEFAULT_CORNER_SMOOTHING },
    effects: [],
    
    // Apply overrides
    ...nodePartial,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Convert hex color to RGBA */
export function hexToRGBA(hex: string, alpha: number = 1): ColorRGBA {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0, a: alpha };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: alpha,
  };
}

/** Convert RGBA to hex */
export function rgbaToHex(color: ColorRGBA): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Convert RGBA to CSS string */
export function rgbaToCSS(color: ColorRGBA): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
}

/** Compute local transform from components */
export function computeLocalTransform(
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  origin: TransformOrigin,
  width: number,
  height: number
): Matrix2D {
  // Compute pivot point
  const px = width * origin.x;
  const py = height * origin.y;
  
  // Convert rotation to radians
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Build matrix: translate to position, translate to pivot, rotate, scale, translate back from pivot
  // Simplified: M = T(x,y) * T(px,py) * R(θ) * S(sx,sy) * T(-px,-py)
  const a = cos * scaleX;
  const b = sin * scaleX;
  const c = -sin * scaleY;
  const d = cos * scaleY;
  const tx = x + px - (a * px + c * py);
  const ty = y + py - (b * px + d * py);
  
  return [a, b, c, d, tx, ty];
}

/** Decompose matrix into transform components */
export function decomposeTransform(m: Matrix2D): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  const [a, b, c, d, tx, ty] = m;
  
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);
  const rotation = Math.atan2(b, a) * (180 / Math.PI);
  
  return { x: tx, y: ty, rotation, scaleX, scaleY };
}

/** Multiply two matrices */
export function multiplyMatrices(a: Matrix2D, b: Matrix2D): Matrix2D {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;
  
  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ];
}

/** Compute render bounds including effects */
export function computeRenderBounds(node: FigmaNode): Bounds {
  let { x, y, width, height } = node.bounds.worldBounds;
  
  // Expand for drop shadows
  for (const effect of node.effects) {
    if (effect.type === 'DROP_SHADOW' && effect.visible) {
      const shadow = effect as DropShadowEffect;
      const blur = shadow.radius + shadow.spread;
      x = Math.min(x, x + shadow.offsetX - blur);
      y = Math.min(y, y + shadow.offsetY - blur);
      width = Math.max(width, width + Math.abs(shadow.offsetX) + blur * 2);
      height = Math.max(height, height + Math.abs(shadow.offsetY) + blur * 2);
    }
  }
  
  // Expand for outside strokes
  for (const stroke of node.strokes) {
    if (stroke.visible && stroke.strokeAlign === 'OUTSIDE') {
      const expand = stroke.strokeWeight;
      x -= expand;
      y -= expand;
      width += expand * 2;
      height += expand * 2;
    } else if (stroke.visible && stroke.strokeAlign === 'CENTER') {
      const expand = stroke.strokeWeight / 2;
      x -= expand;
      y -= expand;
      width += expand * 2;
      height += expand * 2;
    }
  }
  
  return { x, y, width, height };
}
