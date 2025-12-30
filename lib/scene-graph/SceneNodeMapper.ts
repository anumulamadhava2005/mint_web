/**
 * SceneNodeMapper - Maps existing snapshot/drawable formats to canonical SceneNode
 * 
 * This module bridges the legacy NodeInput/DrawableNode types with the new
 * canonical SceneNode model without removing any existing code.
 */

import {
  SceneNode,
  SceneNodeType,
  Transform2D,
  LayoutConfig,
  LayoutMode,
  LayoutAlign,
  Constraints,
  NodeStyles,
  Fill,
  Stroke,
  CornerRadius,
  Effect,
  TextStyle,
  DataSource,
  DataBinding,
  IDENTITY_TRANSFORM,
  DEFAULT_LAYOUT,
  DEFAULT_CONSTRAINTS,
  DEFAULT_STYLES,
  DEFAULT_CORNER_RADIUS,
  createSceneNode,
} from './SceneNode';

import {
  NodeInput,
  DrawableNode,
  FillStyle,
  StrokeStyle,
  Corners,
  EffectStyle,
  TextStyle as LegacyTextStyle,
  DataSourceConfig,
  DataBindingConfig,
} from '../figma-types';

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapNodeType(type: string): SceneNodeType {
  const upper = (type || 'FRAME').toUpperCase();
  switch (upper) {
    case 'TEXT':
      return 'TEXT';
    case 'GROUP':
      return 'GROUP';
    case 'RECTANGLE':
    case 'ELLIPSE':
    case 'POLYGON':
    case 'STAR':
    case 'LINE':
    case 'VECTOR':
      return 'SHAPE';
    case 'FRAME':
    case 'COMPONENT':
    case 'INSTANCE':
    default:
      return 'FRAME';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Mapping
// ─────────────────────────────────────────────────────────────────────────────

function createTransformFromPosition(
  x: number,
  y: number,
  rotation?: number | null
): Transform2D {
  if (rotation && rotation !== 0) {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [cos, sin, -sin, cos, x, y];
  }
  return [1, 0, 0, 1, x, y];
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapLayoutMode(node: NodeInput | DrawableNode | any): LayoutMode {
  // Check for explicit layoutMode (Figma property)
  const layoutMode = (node as any).layoutMode;
  if (layoutMode === 'HORIZONTAL') return 'HORIZONTAL';
  if (layoutMode === 'VERTICAL') return 'VERTICAL';
  
  // Infer from justifyContent/alignItems presence
  const justifyContent = (node as any).justifyContent;
  const alignItems = (node as any).alignItems;
  if (justifyContent || alignItems) {
    // Default to VERTICAL if flex properties present but no explicit mode
    return 'VERTICAL';
  }
  
  return 'NONE';
}

function mapLayoutAlign(value: string | undefined | null): LayoutAlign {
  if (!value) return 'flex-start';
  const lower = value.toLowerCase().replace(/_/g, '-');
  switch (lower) {
    case 'flex-start':
    case 'start':
    case 'min':
      return 'flex-start';
    case 'flex-end':
    case 'end':
    case 'max':
      return 'flex-end';
    case 'center':
      return 'center';
    case 'space-between':
      return 'space-between';
    case 'space-around':
      return 'space-around';
    case 'space-evenly':
      return 'space-evenly';
    case 'stretch':
      return 'stretch';
    default:
      return 'flex-start';
  }
}

function mapLayout(node: NodeInput | DrawableNode | any): LayoutConfig {
  const mode = mapLayoutMode(node);
  
  // Extract padding from various possible fields
  const paddingLeft = (node as any).paddingLeft ?? (node as any).padding ?? 0;
  const paddingRight = (node as any).paddingRight ?? (node as any).padding ?? 0;
  const paddingTop = (node as any).paddingTop ?? (node as any).padding ?? 0;
  const paddingBottom = (node as any).paddingBottom ?? (node as any).padding ?? 0;
  
  // Extract gap
  const gap = (node as any).itemSpacing ?? (node as any).gap ?? 0;
  
  return {
    mode,
    position: mode === 'NONE' ? 'absolute' : 'auto',
    primaryAxisAlign: mapLayoutAlign((node as any).justifyContent ?? (node as any).primaryAxisAlignItems),
    counterAxisAlign: mapLayoutAlign((node as any).alignItems ?? (node as any).counterAxisAlignItems),
    gap,
    padding: {
      top: paddingTop,
      right: paddingRight,
      bottom: paddingBottom,
      left: paddingLeft,
    },
    flexItem: {
      grow: (node as any).flexGrow ?? 0,
      shrink: (node as any).flexShrink ?? 1,
      basis: (node as any).flexBasis ?? 'auto',
      alignSelf: mapLayoutAlign((node as any).alignSelf) ?? 'auto',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapConstraints(node: NodeInput | DrawableNode | any): Constraints {
  const constraints = (node as any).constraints;
  if (!constraints) return { ...DEFAULT_CONSTRAINTS };
  
  const mapValue = (v: string | undefined) => {
    switch (v?.toUpperCase()) {
      case 'MIN': return 'MIN' as const;
      case 'MAX': return 'MAX' as const;
      case 'CENTER': return 'CENTER' as const;
      case 'STRETCH': return 'STRETCH' as const;
      case 'SCALE': return 'SCALE' as const;
      default: return 'MIN' as const;
    }
  };
  
  return {
    horizontal: mapValue(constraints.horizontal),
    vertical: mapValue(constraints.vertical),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Style Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapFill(fill: FillStyle): Fill | null {
  if (!fill) return null;
  
  return {
    type: (fill.type?.toUpperCase() as Fill['type']) || 'SOLID',
    color: fill.color,
    opacity: fill.opacity ?? 1,
    stops: fill.stops,
    imageRef: fill.imageRef ?? undefined,
    imageFit: fill.fit ?? undefined,
    visible: true,
  };
}

function mapFills(node: NodeInput | DrawableNode): Fill[] {
  const fills: Fill[] = [];
  
  // Check fills array
  if (Array.isArray((node as any).fills)) {
    for (const f of (node as any).fills) {
      const mapped = mapFill(f);
      if (mapped) fills.push(mapped);
    }
  }
  
  // Check single fill
  if (node.fill) {
    const mapped = mapFill(node.fill);
    if (mapped) fills.push(mapped);
  }
  
  // Check backgroundColor
  const bg = (node as any).backgroundColor;
  if (bg && fills.length === 0) {
    fills.push({
      type: 'SOLID',
      color: bg,
      opacity: 1,
      visible: true,
    });
  }
  
  return fills;
}

function mapStroke(stroke: StrokeStyle): Stroke | null {
  if (!stroke || !stroke.color) return null;
  
  return {
    color: stroke.color,
    weight: stroke.weight ?? 1,
    align: (stroke.align?.toUpperCase() as Stroke['align']) || 'CENTER',
    dashPattern: stroke.dashPattern ?? undefined,
    visible: true,
  };
}

function mapStrokes(node: NodeInput | DrawableNode): Stroke[] {
  const strokes: Stroke[] = [];
  
  // Check strokes array
  if (Array.isArray((node as any).strokes)) {
    for (const s of (node as any).strokes) {
      const mapped = mapStroke(s);
      if (mapped) strokes.push(mapped);
    }
  }
  
  // Check single stroke
  if (node.stroke) {
    const mapped = mapStroke(node.stroke);
    if (mapped) strokes.push(mapped);
  }
  
  return strokes;
}

function mapCorners(corners: Corners): CornerRadius {
  if (!corners) return { ...DEFAULT_CORNER_RADIUS };
  
  const uniform = corners.uniform ?? 0;
  return {
    topLeft: corners.topLeft ?? uniform,
    topRight: corners.topRight ?? uniform,
    bottomRight: corners.bottomRight ?? uniform,
    bottomLeft: corners.bottomLeft ?? uniform,
  };
}

function mapEffect(effect: EffectStyle): Effect | null {
  if (!effect) return null;
  
  // Parse box-shadow string if present
  // Format: "x y blur spread color" or similar
  const type = effect.type?.toUpperCase() as Effect['type'] || 'DROP_SHADOW';
  
  return {
    type,
    visible: true,
    // TODO: Parse boxShadow string into individual properties
  };
}

function mapEffects(node: NodeInput | DrawableNode): Effect[] {
  if (!Array.isArray(node.effects)) return [];
  
  const effects: Effect[] = [];
  for (const e of node.effects) {
    const mapped = mapEffect(e);
    if (mapped) effects.push(mapped);
  }
  return effects;
}

function mapTextStyle(text: LegacyTextStyle): TextStyle | undefined {
  if (!text) return undefined;
  
  return {
    fontFamily: text.fontFamily ?? 'Inter',
    fontSize: text.fontSize ?? 14,
    fontWeight: text.fontStyle?.includes('Bold') ? 700 : 400,
    fontStyle: text.fontStyle?.includes('Italic') ? 'italic' : 'normal',
    lineHeight: text.lineHeight ?? 'auto',
    letterSpacing: text.letterSpacing ?? 0,
    textAlign: mapTextAlign(text.textAlignHorizontal),
    verticalAlign: mapVerticalAlign(text.textAlignVertical),
    textDecoration: mapTextDecoration(text.textDecoration),
    textTransform: mapTextTransform(text.textCase),
    color: text.color ?? '#000000',
  };
}

function mapTextAlign(align: string | null | undefined): 'left' | 'center' | 'right' | 'justify' {
  switch (align?.toUpperCase()) {
    case 'CENTER': return 'center';
    case 'RIGHT': return 'right';
    case 'JUSTIFIED': return 'justify';
    default: return 'left';
  }
}

function mapVerticalAlign(align: string | null | undefined): 'top' | 'center' | 'bottom' {
  switch (align?.toUpperCase()) {
    case 'CENTER': return 'center';
    case 'BOTTOM': return 'bottom';
    default: return 'top';
  }
}

function mapTextDecoration(dec: string | null | undefined): 'none' | 'underline' | 'line-through' {
  switch (dec?.toUpperCase()) {
    case 'UNDERLINE': return 'underline';
    case 'STRIKETHROUGH': return 'line-through';
    default: return 'none';
  }
}

function mapTextTransform(textCase: string | null | undefined): 'none' | 'uppercase' | 'lowercase' | 'capitalize' {
  switch (textCase?.toUpperCase()) {
    case 'UPPER': return 'uppercase';
    case 'LOWER': return 'lowercase';
    case 'TITLE': return 'capitalize';
    default: return 'none';
  }
}

function mapStyles(node: NodeInput | DrawableNode): NodeStyles {
  return {
    fills: mapFills(node),
    strokes: mapStrokes(node),
    corners: mapCorners(node.corners ?? null),
    effects: mapEffects(node),
    opacity: node.opacity ?? 1,
    blendMode: node.blendMode ?? 'normal',
    text: node.text ? mapTextStyle(node.text) : undefined,
    backgroundColor: (node as any).backgroundColor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapDataSource(ds: DataSourceConfig | undefined | null): DataSource | undefined {
  if (!ds) return undefined;
  
  return {
    url: ds.url,
    method: ds.method,
    headers: ds.headers ? JSON.parse(ds.headers) : undefined,
    params: ds.params ? JSON.parse(ds.params) : undefined,
    selectedFields: ds.selectedFields,
    infiniteScroll: ds.infiniteScroll,
    itemSpacing: ds.itemSpacing,
    direction: ds.direction,
  };
}

function mapDataBinding(db: DataBindingConfig | undefined | null): DataBinding | undefined {
  if (!db) return undefined;
  
  return {
    field: db.field,
    parentId: db.parentId,
    type: db.type === 'custom' ? 'template' : 'field',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Mapper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a NodeInput (snapshot format) to canonical SceneNode
 */
export function nodeInputToSceneNode(
  node: NodeInput,
  parentId: string | null = null,
  nodeMap: Map<string, SceneNode> = new Map()
): SceneNode {
  // Resolve position
  const x = node.absoluteBoundingBox?.x ?? (node as any).ax ?? node.x ?? 0;
  const y = node.absoluteBoundingBox?.y ?? (node as any).ay ?? node.y ?? 0;
  const width = node.absoluteBoundingBox?.width ?? node.width ?? (node as any).w ?? 100;
  const height = node.absoluteBoundingBox?.height ?? node.height ?? (node as any).h ?? 100;
  
  const sceneNode: SceneNode = {
    id: node.id,
    parentId,
    name: node.name || node.id,
    type: mapNodeType(node.type),
    children: [],
    localTransform: createTransformFromPosition(
      parentId ? (node.x ?? 0) : x,
      parentId ? (node.y ?? 0) : y,
      node.rotation
    ),
    worldTransform: createTransformFromPosition(x, y, node.rotation),
    size: { width, height },
    layout: mapLayout(node),
    constraints: mapConstraints(node),
    styles: mapStyles(node),
    visible: true,
    locked: false,
    clipsContent: node.clipsContent ?? false,
    textContent: node.textContent ?? node.characters ?? node.text?.characters ?? undefined,
    dataSource: mapDataSource(node.dataSource),
    dataBinding: mapDataBinding(node.dataBinding),
  };
  
  // Store in map
  nodeMap.set(node.id, sceneNode);
  
  // Process children
  if (Array.isArray(node.children)) {
    sceneNode.children = node.children.map(child => child.id);
    for (const child of node.children) {
      nodeInputToSceneNode(child, node.id, nodeMap);
    }
  }
  
  return sceneNode;
}

/**
 * Convert a DrawableNode to canonical SceneNode
 */
export function drawableToSceneNode(
  node: DrawableNode,
  parentId: string | null = null,
  nodeMap: Map<string, SceneNode> = new Map()
): SceneNode {
  const sceneNode: SceneNode = {
    id: node.id,
    parentId,
    name: node.name || node.id,
    type: mapNodeType(node.type),
    children: [],
    localTransform: createTransformFromPosition(node.x, node.y, node.rotation),
    worldTransform: createTransformFromPosition(node.x, node.y, node.rotation),
    size: { width: node.width, height: node.height },
    layout: mapLayout(node),
    constraints: mapConstraints(node),
    styles: mapStyles(node),
    visible: true,
    locked: false,
    clipsContent: node.clipsContent ?? false,
    textContent: node.textContent ?? undefined,
    dataSource: mapDataSource(node.dataSource),
    dataBinding: mapDataBinding(node.dataBinding),
  };
  
  nodeMap.set(node.id, sceneNode);
  
  if (Array.isArray(node.children)) {
    sceneNode.children = node.children.map(child => child.id);
    for (const child of node.children) {
      drawableToSceneNode(child, node.id, nodeMap);
    }
  }
  
  return sceneNode;
}

/**
 * Convert an array of root NodeInputs to a SceneNode map (flat structure)
 */
export function snapshotToSceneGraph(roots: NodeInput[]): Map<string, SceneNode> {
  const nodeMap = new Map<string, SceneNode>();
  
  for (const root of roots) {
    nodeInputToSceneNode(root, null, nodeMap);
  }
  
  return nodeMap;
}

/**
 * Get root nodes from a scene graph map
 */
export function getRootNodes(nodeMap: Map<string, SceneNode>): SceneNode[] {
  return Array.from(nodeMap.values()).filter(node => node.parentId === null);
}

/**
 * Get children of a node from a scene graph map
 */
export function getChildren(nodeMap: Map<string, SceneNode>, parentId: string): SceneNode[] {
  const parent = nodeMap.get(parentId);
  if (!parent) return [];
  
  return parent.children
    .map(childId => nodeMap.get(childId))
    .filter((node): node is SceneNode => node !== undefined);
}
