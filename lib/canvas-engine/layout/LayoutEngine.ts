/**
 * LayoutEngine - Computes sizes and positions for SceneNode trees
 * 
 * Modes:
 * - ABSOLUTE: Direct positioning with optional constraints
 * - AUTO_LAYOUT: Figma-style row/column layout with gap, padding, alignment
 * - FLEX: CSS Flexbox parity for DOM rendering
 */

import type { SceneNode, LayoutMode as SceneLayoutMode } from '../../scene-graph';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Layout engine modes */
export type LayoutEngineMode = 'ABSOLUTE' | 'AUTO_LAYOUT' | 'FLEX';

/** Horizontal constraint behavior */
export type HorizontalConstraint = 
  | 'LEFT'        // Fixed distance from left
  | 'RIGHT'       // Fixed distance from right
  | 'LEFT_RIGHT'  // Stretch to maintain both distances
  | 'CENTER'      // Center horizontally
  | 'SCALE';      // Scale proportionally

/** Vertical constraint behavior */
export type VerticalConstraint = 
  | 'TOP'         // Fixed distance from top
  | 'BOTTOM'      // Fixed distance from bottom
  | 'TOP_BOTTOM'  // Stretch to maintain both distances
  | 'CENTER'      // Center vertically
  | 'SCALE';      // Scale proportionally

/** Constraints for absolute positioning */
export interface Constraints {
  horizontal: HorizontalConstraint;
  vertical: VerticalConstraint;
}

/** Sizing mode for each axis */
export type SizingMode = 'FIXED' | 'HUG' | 'FILL';

/** Sizing configuration */
export interface Sizing {
  horizontal: SizingMode;
  vertical: SizingMode;
  /** Min width constraint */
  minWidth?: number;
  /** Max width constraint */
  maxWidth?: number;
  /** Min height constraint */
  minHeight?: number;
  /** Max height constraint */
  maxHeight?: number;
}

/** Primary axis alignment */
export type PrimaryAxisAlign = 
  | 'START' 
  | 'CENTER' 
  | 'END' 
  | 'SPACE_BETWEEN' 
  | 'SPACE_AROUND' 
  | 'SPACE_EVENLY';

/** Counter axis alignment */
export type CounterAxisAlign = 
  | 'START' 
  | 'CENTER' 
  | 'END' 
  | 'STRETCH' 
  | 'BASELINE';

/** Flex item alignment override */
export type AlignSelf = 
  | 'AUTO' 
  | 'START' 
  | 'CENTER' 
  | 'END' 
  | 'STRETCH' 
  | 'BASELINE';

/** Padding configuration */
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Layout properties for a container */
export interface LayoutProps {
  /** Layout mode */
  mode: LayoutEngineMode;
  /** Direction for auto-layout/flex */
  direction: 'ROW' | 'COLUMN';
  /** Gap between children */
  gap: number;
  /** Row gap (for wrap mode) */
  rowGap?: number;
  /** Padding inside container */
  padding: Padding;
  /** Primary axis alignment */
  primaryAxisAlign: PrimaryAxisAlign;
  /** Counter axis alignment */
  counterAxisAlign: CounterAxisAlign;
  /** Whether children can wrap to next line */
  wrap: boolean;
  /** Reverse direction */
  reverse: boolean;
}

/** Flex item properties */
export interface FlexItemProps {
  /** Flex grow factor */
  grow: number;
  /** Flex shrink factor */
  shrink: number;
  /** Flex basis ('auto' or pixel value) */
  basis: number | 'auto';
  /** Alignment override for this item */
  alignSelf: AlignSelf;
  /** Order for sorting (lower = earlier) */
  order: number;
}

/** Input node for layout computation */
export interface LayoutNode {
  id: string;
  /** Parent node ID (null for roots) */
  parentId: string | null;
  /** Child node IDs in order */
  children: string[];
  /** Position (for absolute mode) */
  x: number;
  y: number;
  /** Intrinsic/fixed size */
  width: number;
  height: number;
  /** Layout properties (if container) */
  layout: LayoutProps;
  /** Sizing mode */
  sizing: Sizing;
  /** Constraints (for absolute positioning) */
  constraints: Constraints;
  /** Flex item properties */
  flexItem: FlexItemProps;
  /** Whether node is visible (affects layout) */
  visible: boolean;
  /** Whether node is absolutely positioned (ignores parent layout) */
  absolutePosition: boolean;
}

/** Computed layout result for a node */
export interface ComputedLayout {
  /** Computed X position relative to parent */
  x: number;
  /** Computed Y position relative to parent */
  y: number;
  /** Computed width */
  width: number;
  /** Computed height */
  height: number;
  /** World X position (accumulated from root) */
  worldX: number;
  /** World Y position (accumulated from root) */
  worldY: number;
}

/** Layout computation options */
export interface LayoutOptions {
  /** Viewport/canvas width (for root constraints) */
  viewportWidth?: number;
  /** Viewport/canvas height (for root constraints) */
  viewportHeight?: number;
  /** Round values to pixels */
  roundToPixels?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT_PROPS: LayoutProps = {
  mode: 'ABSOLUTE',
  direction: 'ROW',
  gap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  primaryAxisAlign: 'START',
  counterAxisAlign: 'START',
  wrap: false,
  reverse: false,
};

export const DEFAULT_SIZING: Sizing = {
  horizontal: 'FIXED',
  vertical: 'FIXED',
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  horizontal: 'LEFT',
  vertical: 'TOP',
};

export const DEFAULT_FLEX_ITEM: FlexItemProps = {
  grow: 0,
  shrink: 1,
  basis: 'auto',
  alignSelf: 'AUTO',
  order: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LayoutEngine Class
// ─────────────────────────────────────────────────────────────────────────────

export class LayoutEngine {
  /** Computed layouts indexed by node ID */
  private computed: Map<string, ComputedLayout> = new Map();
  
  /** Node registry for lookups */
  private nodes: Map<string, LayoutNode> = new Map();
  
  /** Computation options */
  private options: LayoutOptions = {};
  
  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Compute layout for all nodes in the tree
   */
  compute(
    nodes: Map<string, LayoutNode>,
    options: LayoutOptions = {}
  ): Map<string, ComputedLayout> {
    this.nodes = nodes;
    this.options = options;
    this.computed.clear();
    
    // Find root nodes (no parent)
    const roots: LayoutNode[] = [];
    nodes.forEach(node => {
      if (node.parentId === null) {
        roots.push(node);
      }
    });
    
    // Compute each root tree
    for (const root of roots) {
      this.computeNode(root, null, 0, 0);
    }
    
    // Round to pixels if requested
    if (options.roundToPixels) {
      this.computed.forEach(layout => {
        layout.x = Math.round(layout.x);
        layout.y = Math.round(layout.y);
        layout.width = Math.round(layout.width);
        layout.height = Math.round(layout.height);
        layout.worldX = Math.round(layout.worldX);
        layout.worldY = Math.round(layout.worldY);
      });
    }
    
    return new Map(this.computed);
  }
  
  /**
   * Compute layout from SceneNode graph
   */
  computeFromSceneGraph(
    sceneGraph: Map<string, SceneNode>,
    options: LayoutOptions = {}
  ): Map<string, ComputedLayout> {
    // Convert SceneNodes to LayoutNodes
    const layoutNodes = new Map<string, LayoutNode>();
    
    sceneGraph.forEach((node, id) => {
      layoutNodes.set(id, this.sceneNodeToLayoutNode(node));
    });
    
    return this.compute(layoutNodes, options);
  }
  
  /**
   * Get computed layout for a single node
   */
  getLayout(nodeId: string): ComputedLayout | undefined {
    return this.computed.get(nodeId);
  }
  
  /**
   * Recompute layout for a subtree (after local change)
   */
  recomputeSubtree(rootId: string): void {
    const node = this.nodes.get(rootId);
    if (!node) return;
    
    // Find parent's computed layout for world position
    let parentWorldX = 0;
    let parentWorldY = 0;
    if (node.parentId) {
      const parentLayout = this.computed.get(node.parentId);
      if (parentLayout) {
        parentWorldX = parentLayout.worldX;
        parentWorldY = parentLayout.worldY;
      }
    }
    
    // Get current position
    const currentLayout = this.computed.get(rootId);
    const x = currentLayout?.x ?? node.x;
    const y = currentLayout?.y ?? node.y;
    
    this.computeNode(node, node.parentId ? this.nodes.get(node.parentId) ?? null : null, parentWorldX, parentWorldY);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Core Computation
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeNode(
    node: LayoutNode,
    parent: LayoutNode | null,
    parentWorldX: number,
    parentWorldY: number
  ): ComputedLayout {
    // Skip invisible nodes
    if (!node.visible) {
      const layout: ComputedLayout = {
        x: node.x,
        y: node.y,
        width: 0,
        height: 0,
        worldX: parentWorldX + node.x,
        worldY: parentWorldY + node.y,
      };
      this.computed.set(node.id, layout);
      return layout;
    }
    
    // Determine effective mode
    const mode = node.absolutePosition ? 'ABSOLUTE' : node.layout.mode;
    
    // Get children LayoutNodes
    const children = node.children
      .map(id => this.nodes.get(id))
      .filter((n): n is LayoutNode => n !== undefined && n.visible);
    
    // Compute own size first (may need children for HUG)
    let { width, height } = this.computeSize(node, parent, children);
    
    // Compute children positions based on mode
    let childLayouts: Map<string, ComputedLayout>;
    
    switch (mode) {
      case 'ABSOLUTE':
        childLayouts = this.computeAbsoluteChildren(node, children, width, height, parentWorldX, parentWorldY);
        break;
      case 'AUTO_LAYOUT':
        childLayouts = this.computeAutoLayoutChildren(node, children, width, height, parentWorldX, parentWorldY);
        break;
      case 'FLEX':
        childLayouts = this.computeFlexChildren(node, children, width, height, parentWorldX, parentWorldY);
        break;
      default:
        childLayouts = this.computeAbsoluteChildren(node, children, width, height, parentWorldX, parentWorldY);
    }
    
    // If HUG sizing, recompute size based on children
    if (node.sizing.horizontal === 'HUG' || node.sizing.vertical === 'HUG') {
      const hugSize = this.computeHugSize(node, childLayouts, children);
      if (node.sizing.horizontal === 'HUG') width = hugSize.width;
      if (node.sizing.vertical === 'HUG') height = hugSize.height;
    }
    
    // Apply min/max constraints
    width = this.clamp(width, node.sizing.minWidth, node.sizing.maxWidth);
    height = this.clamp(height, node.sizing.minHeight, node.sizing.maxHeight);
    
    // Compute own position
    const { x, y } = this.computePosition(node, parent, width, height);
    
    // Store result
    const layout: ComputedLayout = {
      x,
      y,
      width,
      height,
      worldX: parentWorldX + x,
      worldY: parentWorldY + y,
    };
    this.computed.set(node.id, layout);
    
    // Update children with final world positions
    childLayouts.forEach((childLayout, childId) => {
      childLayout.worldX = layout.worldX + childLayout.x;
      childLayout.worldY = layout.worldY + childLayout.y;
      this.computed.set(childId, childLayout);
    });
    
    return layout;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Size Computation
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeSize(
    node: LayoutNode,
    parent: LayoutNode | null,
    children: LayoutNode[]
  ): { width: number; height: number } {
    let width = node.width;
    let height = node.height;
    
    // Handle FILL sizing
    if (node.sizing.horizontal === 'FILL' && parent) {
      const parentWidth = parent.width - parent.layout.padding.left - parent.layout.padding.right;
      if (parent.layout.mode !== 'ABSOLUTE' && parent.layout.direction === 'ROW') {
        // In row layout, FILL takes remaining space (computed later in flex)
        width = node.width; // Will be overridden by flex
      } else {
        width = parentWidth;
      }
    }
    
    if (node.sizing.vertical === 'FILL' && parent) {
      const parentHeight = parent.height - parent.layout.padding.top - parent.layout.padding.bottom;
      if (parent.layout.mode !== 'ABSOLUTE' && parent.layout.direction === 'COLUMN') {
        // In column layout, FILL takes remaining space (computed later in flex)
        height = node.height; // Will be overridden by flex
      } else {
        height = parentHeight;
      }
    }
    
    // HUG sizing is computed after children are laid out
    // Return current size as placeholder
    
    return { width, height };
  }
  
  private computeHugSize(
    node: LayoutNode,
    childLayouts: Map<string, ComputedLayout>,
    children: LayoutNode[]
  ): { width: number; height: number } {
    const { padding, direction, gap } = node.layout;
    
    if (children.length === 0) {
      return {
        width: padding.left + padding.right,
        height: padding.top + padding.bottom,
      };
    }
    
    let maxRight = 0;
    let maxBottom = 0;
    
    childLayouts.forEach(childLayout => {
      maxRight = Math.max(maxRight, childLayout.x + childLayout.width);
      maxBottom = Math.max(maxBottom, childLayout.y + childLayout.height);
    });
    
    return {
      width: maxRight + padding.right,
      height: maxBottom + padding.bottom,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Position Computation
  // ─────────────────────────────────────────────────────────────────────────
  
  private computePosition(
    node: LayoutNode,
    parent: LayoutNode | null,
    width: number,
    height: number
  ): { x: number; y: number } {
    // If no parent or absolute position, use direct coordinates
    if (!parent || node.absolutePosition) {
      return { x: node.x, y: node.y };
    }
    
    // Position is computed by parent's layout algorithm
    // Return node's position (will be set by parent computation)
    return { x: node.x, y: node.y };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Absolute Layout
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeAbsoluteChildren(
    parent: LayoutNode,
    children: LayoutNode[],
    parentWidth: number,
    parentHeight: number,
    parentWorldX: number,
    parentWorldY: number
  ): Map<string, ComputedLayout> {
    const results = new Map<string, ComputedLayout>();
    const { padding } = parent.layout;
    
    const contentWidth = parentWidth - padding.left - padding.right;
    const contentHeight = parentHeight - padding.top - padding.bottom;
    
    for (const child of children) {
      // Apply constraints to compute position and size
      const { x, y, width, height } = this.applyConstraints(
        child,
        contentWidth,
        contentHeight,
        parent
      );
      
      // Recursively compute child's subtree
      const childWorldX = parentWorldX + padding.left + x;
      const childWorldY = parentWorldY + padding.top + y;
      
      // Compute children of this child
      const childChildren = child.children
        .map(id => this.nodes.get(id))
        .filter((n): n is LayoutNode => n !== undefined && n.visible);
      
      this.computeChildSubtree(child, childChildren, width, height, childWorldX, childWorldY);
      
      results.set(child.id, {
        x: padding.left + x,
        y: padding.top + y,
        width,
        height,
        worldX: childWorldX,
        worldY: childWorldY,
      });
    }
    
    return results;
  }
  
  private applyConstraints(
    node: LayoutNode,
    parentContentWidth: number,
    parentContentHeight: number,
    parent: LayoutNode
  ): { x: number; y: number; width: number; height: number } {
    const { constraints } = node;
    let x = node.x;
    let y = node.y;
    let width = node.width;
    let height = node.height;
    
    // Original distances (from when constraints were set)
    const originalRight = parentContentWidth - (node.x + node.width);
    const originalBottom = parentContentHeight - (node.y + node.height);
    
    // Horizontal constraint
    switch (constraints.horizontal) {
      case 'LEFT':
        // Keep x fixed
        break;
      case 'RIGHT':
        x = parentContentWidth - width - originalRight;
        break;
      case 'LEFT_RIGHT':
        // Stretch width to maintain both distances
        width = parentContentWidth - node.x - originalRight;
        break;
      case 'CENTER':
        x = (parentContentWidth - width) / 2;
        break;
      case 'SCALE':
        const hRatio = parentContentWidth / (parent.width - parent.layout.padding.left - parent.layout.padding.right);
        x = node.x * hRatio;
        width = node.width * hRatio;
        break;
    }
    
    // Vertical constraint
    switch (constraints.vertical) {
      case 'TOP':
        // Keep y fixed
        break;
      case 'BOTTOM':
        y = parentContentHeight - height - originalBottom;
        break;
      case 'TOP_BOTTOM':
        // Stretch height to maintain both distances
        height = parentContentHeight - node.y - originalBottom;
        break;
      case 'CENTER':
        y = (parentContentHeight - height) / 2;
        break;
      case 'SCALE':
        const vRatio = parentContentHeight / (parent.height - parent.layout.padding.top - parent.layout.padding.bottom);
        y = node.y * vRatio;
        height = node.height * vRatio;
        break;
    }
    
    // Apply min/max
    width = this.clamp(width, node.sizing.minWidth, node.sizing.maxWidth);
    height = this.clamp(height, node.sizing.minHeight, node.sizing.maxHeight);
    
    return { x, y, width, height };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Auto Layout (Figma-style)
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeAutoLayoutChildren(
    parent: LayoutNode,
    children: LayoutNode[],
    parentWidth: number,
    parentHeight: number,
    parentWorldX: number,
    parentWorldY: number
  ): Map<string, ComputedLayout> {
    const results = new Map<string, ComputedLayout>();
    const { padding, direction, gap, primaryAxisAlign, counterAxisAlign, reverse } = parent.layout;
    
    const contentWidth = parentWidth - padding.left - padding.right;
    const contentHeight = parentHeight - padding.top - padding.bottom;
    
    // Separate absolute and flow children
    const flowChildren = children.filter(c => !c.absolutePosition);
    const absoluteChildren = children.filter(c => c.absolutePosition);
    
    // Handle absolute children separately
    const absoluteLayouts = this.computeAbsoluteChildren(
      parent, absoluteChildren, parentWidth, parentHeight, parentWorldX, parentWorldY
    );
    absoluteLayouts.forEach((layout, id) => results.set(id, layout));
    
    if (flowChildren.length === 0) return results;
    
    // Optionally reverse order
    const orderedChildren = reverse ? [...flowChildren].reverse() : flowChildren;
    
    // Determine primary and counter axes
    const isRow = direction === 'ROW';
    const primarySize = isRow ? contentWidth : contentHeight;
    const counterSize = isRow ? contentHeight : contentWidth;
    
    // Calculate total children size on primary axis
    let totalChildPrimarySize = 0;
    const childSizes: { node: LayoutNode; primary: number; counter: number }[] = [];
    
    for (const child of orderedChildren) {
      const childPrimary = isRow ? child.width : child.height;
      const childCounter = isRow ? child.height : child.width;
      childSizes.push({ node: child, primary: childPrimary, counter: childCounter });
      totalChildPrimarySize += childPrimary;
    }
    
    // Calculate gaps
    const totalGaps = gap * (orderedChildren.length - 1);
    const totalUsed = totalChildPrimarySize + totalGaps;
    const freeSpace = primarySize - totalUsed;
    
    // Calculate starting position based on alignment
    let currentPrimary = this.calculateStartPosition(primaryAxisAlign, freeSpace, orderedChildren.length);
    
    // Calculate gap adjustment for space-* alignments
    let effectiveGap = gap;
    if (primaryAxisAlign === 'SPACE_BETWEEN' && orderedChildren.length > 1) {
      effectiveGap = freeSpace / (orderedChildren.length - 1);
      currentPrimary = 0;
    } else if (primaryAxisAlign === 'SPACE_AROUND' && orderedChildren.length > 0) {
      effectiveGap = freeSpace / orderedChildren.length;
      currentPrimary = effectiveGap / 2;
    } else if (primaryAxisAlign === 'SPACE_EVENLY' && orderedChildren.length > 0) {
      effectiveGap = freeSpace / (orderedChildren.length + 1);
      currentPrimary = effectiveGap;
    }
    
    // Position each child
    for (const { node: child, primary: childPrimary, counter: childCounter } of childSizes) {
      // Calculate counter axis position based on alignment
      let counterPos = this.calculateCounterPosition(
        counterAxisAlign,
        counterSize,
        childCounter,
        child.flexItem.alignSelf
      );
      
      // Handle STRETCH
      let finalCounter = childCounter;
      const effectiveAlign = child.flexItem.alignSelf !== 'AUTO' 
        ? child.flexItem.alignSelf 
        : counterAxisAlign;
      
      if (effectiveAlign === 'STRETCH') {
        finalCounter = counterSize;
        counterPos = 0;
      }
      
      // Convert to x,y based on direction
      const x = isRow ? currentPrimary : counterPos;
      const y = isRow ? counterPos : currentPrimary;
      const width = isRow ? childPrimary : finalCounter;
      const height = isRow ? finalCounter : childPrimary;
      
      // Compute child's subtree
      const childWorldX = parentWorldX + padding.left + x;
      const childWorldY = parentWorldY + padding.top + y;
      
      const childChildren = child.children
        .map(id => this.nodes.get(id))
        .filter((n): n is LayoutNode => n !== undefined && n.visible);
      
      this.computeChildSubtree(child, childChildren, width, height, childWorldX, childWorldY);
      
      results.set(child.id, {
        x: padding.left + x,
        y: padding.top + y,
        width,
        height,
        worldX: childWorldX,
        worldY: childWorldY,
      });
      
      // Move to next position
      currentPrimary += childPrimary + effectiveGap;
    }
    
    return results;
  }
  
  private calculateStartPosition(
    align: PrimaryAxisAlign,
    freeSpace: number,
    childCount: number
  ): number {
    switch (align) {
      case 'START':
        return 0;
      case 'CENTER':
        return freeSpace / 2;
      case 'END':
        return freeSpace;
      case 'SPACE_BETWEEN':
      case 'SPACE_AROUND':
      case 'SPACE_EVENLY':
        return 0; // Handled separately
      default:
        return 0;
    }
  }
  
  private calculateCounterPosition(
    align: CounterAxisAlign | AlignSelf,
    containerSize: number,
    childSize: number,
    alignSelf: AlignSelf
  ): number {
    const effectiveAlign = alignSelf !== 'AUTO' ? alignSelf : align;
    
    switch (effectiveAlign) {
      case 'START':
        return 0;
      case 'CENTER':
        return (containerSize - childSize) / 2;
      case 'END':
        return containerSize - childSize;
      case 'STRETCH':
        return 0;
      case 'BASELINE':
        return 0; // Baseline requires font metrics, fallback to start
      default:
        return 0;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Flex Layout (CSS Flexbox parity)
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeFlexChildren(
    parent: LayoutNode,
    children: LayoutNode[],
    parentWidth: number,
    parentHeight: number,
    parentWorldX: number,
    parentWorldY: number
  ): Map<string, ComputedLayout> {
    const results = new Map<string, ComputedLayout>();
    const { padding, direction, gap, rowGap, primaryAxisAlign, counterAxisAlign, wrap, reverse } = parent.layout;
    
    const contentWidth = parentWidth - padding.left - padding.right;
    const contentHeight = parentHeight - padding.top - padding.bottom;
    
    // Separate absolute and flow children
    const flowChildren = children.filter(c => !c.absolutePosition);
    const absoluteChildren = children.filter(c => c.absolutePosition);
    
    // Handle absolute children
    const absoluteLayouts = this.computeAbsoluteChildren(
      parent, absoluteChildren, parentWidth, parentHeight, parentWorldX, parentWorldY
    );
    absoluteLayouts.forEach((layout, id) => results.set(id, layout));
    
    if (flowChildren.length === 0) return results;
    
    // Sort by order
    const sortedChildren = [...flowChildren].sort((a, b) => a.flexItem.order - b.flexItem.order);
    
    // Optionally reverse
    const orderedChildren = reverse ? sortedChildren.reverse() : sortedChildren;
    
    const isRow = direction === 'ROW';
    const primarySize = isRow ? contentWidth : contentHeight;
    const counterSize = isRow ? contentHeight : contentWidth;
    const effectiveRowGap = rowGap ?? gap;
    
    // Wrap into lines if needed
    const lines = wrap 
      ? this.wrapIntoLines(orderedChildren, primarySize, gap, isRow)
      : [orderedChildren];
    
    // Compute each line
    let currentCounter = 0;
    
    for (const line of lines) {
      const lineResult = this.computeFlexLine(
        line,
        parent,
        primarySize,
        counterSize,
        currentCounter,
        gap,
        isRow,
        primaryAxisAlign,
        counterAxisAlign,
        parentWorldX,
        parentWorldY,
        padding
      );
      
      lineResult.layouts.forEach((layout, id) => results.set(id, layout));
      currentCounter += lineResult.lineCounter + effectiveRowGap;
    }
    
    return results;
  }
  
  private wrapIntoLines(
    children: LayoutNode[],
    primarySize: number,
    gap: number,
    isRow: boolean
  ): LayoutNode[][] {
    const lines: LayoutNode[][] = [];
    let currentLine: LayoutNode[] = [];
    let currentLineSize = 0;
    
    for (const child of children) {
      const childPrimary = isRow ? child.width : child.height;
      const childWithGap = currentLine.length > 0 ? childPrimary + gap : childPrimary;
      
      if (currentLineSize + childWithGap > primarySize && currentLine.length > 0) {
        // Start new line
        lines.push(currentLine);
        currentLine = [child];
        currentLineSize = childPrimary;
      } else {
        currentLine.push(child);
        currentLineSize += childWithGap;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  private computeFlexLine(
    children: LayoutNode[],
    parent: LayoutNode,
    primarySize: number,
    counterSize: number,
    counterOffset: number,
    gap: number,
    isRow: boolean,
    primaryAxisAlign: PrimaryAxisAlign,
    counterAxisAlign: CounterAxisAlign,
    parentWorldX: number,
    parentWorldY: number,
    padding: Padding
  ): { layouts: Map<string, ComputedLayout>; lineCounter: number } {
    const layouts = new Map<string, ComputedLayout>();
    
    // Calculate basis sizes and flex factors
    const items: {
      node: LayoutNode;
      basis: number;
      grow: number;
      shrink: number;
      counter: number;
      frozen: boolean;
      final: number;
    }[] = [];
    
    let totalBasis = 0;
    let totalGrow = 0;
    let totalShrink = 0;
    
    for (const child of children) {
      const basis = child.flexItem.basis === 'auto'
        ? (isRow ? child.width : child.height)
        : child.flexItem.basis;
      
      items.push({
        node: child,
        basis,
        grow: child.flexItem.grow,
        shrink: child.flexItem.shrink,
        counter: isRow ? child.height : child.width,
        frozen: false,
        final: basis,
      });
      
      totalBasis += basis;
      totalGrow += child.flexItem.grow;
      totalShrink += child.flexItem.shrink;
    }
    
    // Calculate free space
    const totalGaps = gap * (children.length - 1);
    let freeSpace = primarySize - totalBasis - totalGaps;
    
    // Distribute free space
    if (freeSpace > 0 && totalGrow > 0) {
      // Grow
      for (const item of items) {
        const growRatio = item.grow / totalGrow;
        item.final = item.basis + freeSpace * growRatio;
      }
    } else if (freeSpace < 0 && totalShrink > 0) {
      // Shrink
      const scaledShrinkSum = items.reduce((sum, item) => sum + item.shrink * item.basis, 0);
      if (scaledShrinkSum > 0) {
        for (const item of items) {
          const shrinkRatio = (item.shrink * item.basis) / scaledShrinkSum;
          item.final = Math.max(0, item.basis + freeSpace * shrinkRatio);
        }
      }
    }
    
    // Apply min/max constraints (simplified - full implementation would re-flex)
    for (const item of items) {
      const minPrimary = isRow ? item.node.sizing.minWidth : item.node.sizing.minHeight;
      const maxPrimary = isRow ? item.node.sizing.maxWidth : item.node.sizing.maxHeight;
      item.final = this.clamp(item.final, minPrimary, maxPrimary);
    }
    
    // Calculate line counter size (max of children)
    let lineCounter = 0;
    for (const item of items) {
      const effectiveAlign = item.node.flexItem.alignSelf !== 'AUTO'
        ? item.node.flexItem.alignSelf
        : counterAxisAlign;
      
      if (effectiveAlign === 'STRETCH') {
        lineCounter = Math.max(lineCounter, counterSize);
      } else {
        lineCounter = Math.max(lineCounter, item.counter);
      }
    }
    
    // Position items
    const totalFinal = items.reduce((sum, item) => sum + item.final, 0);
    const finalFreeSpace = primarySize - totalFinal - totalGaps;
    
    let currentPrimary = this.calculateStartPosition(primaryAxisAlign, finalFreeSpace, items.length);
    
    // Recalculate effective gap for space-* alignments
    let effectiveGap = gap;
    if (primaryAxisAlign === 'SPACE_BETWEEN' && items.length > 1) {
      effectiveGap = (primarySize - totalFinal) / (items.length - 1);
      currentPrimary = 0;
    } else if (primaryAxisAlign === 'SPACE_AROUND' && items.length > 0) {
      const spaceUnit = (primarySize - totalFinal) / items.length;
      effectiveGap = spaceUnit;
      currentPrimary = spaceUnit / 2;
    } else if (primaryAxisAlign === 'SPACE_EVENLY' && items.length > 0) {
      const spaceUnit = (primarySize - totalFinal) / (items.length + 1);
      effectiveGap = spaceUnit;
      currentPrimary = spaceUnit;
    }
    
    for (const item of items) {
      const effectiveAlign = item.node.flexItem.alignSelf !== 'AUTO'
        ? item.node.flexItem.alignSelf
        : counterAxisAlign;
      
      let finalCounter = item.counter;
      if (effectiveAlign === 'STRETCH') {
        finalCounter = lineCounter;
      }
      
      const counterPos = this.calculateCounterPosition(
        effectiveAlign,
        lineCounter,
        finalCounter,
        item.node.flexItem.alignSelf
      );
      
      const x = isRow ? currentPrimary : counterOffset + counterPos;
      const y = isRow ? counterOffset + counterPos : currentPrimary;
      const width = isRow ? item.final : finalCounter;
      const height = isRow ? finalCounter : item.final;
      
      // Compute child's subtree
      const childWorldX = parentWorldX + padding.left + x;
      const childWorldY = parentWorldY + padding.top + y;
      
      const childChildren = item.node.children
        .map(id => this.nodes.get(id))
        .filter((n): n is LayoutNode => n !== undefined && n.visible);
      
      this.computeChildSubtree(item.node, childChildren, width, height, childWorldX, childWorldY);
      
      layouts.set(item.node.id, {
        x: padding.left + x,
        y: padding.top + y,
        width,
        height,
        worldX: childWorldX,
        worldY: childWorldY,
      });
      
      currentPrimary += item.final + effectiveGap;
    }
    
    return { layouts, lineCounter };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────
  
  private computeChildSubtree(
    node: LayoutNode,
    children: LayoutNode[],
    width: number,
    height: number,
    worldX: number,
    worldY: number
  ): void {
    // Create temporary node with computed size
    const tempNode: LayoutNode = {
      ...node,
      width,
      height,
    };
    
    // Determine mode and compute children
    const mode = node.layout.mode;
    
    let childLayouts: Map<string, ComputedLayout>;
    switch (mode) {
      case 'ABSOLUTE':
        childLayouts = this.computeAbsoluteChildren(tempNode, children, width, height, worldX, worldY);
        break;
      case 'AUTO_LAYOUT':
        childLayouts = this.computeAutoLayoutChildren(tempNode, children, width, height, worldX, worldY);
        break;
      case 'FLEX':
        childLayouts = this.computeFlexChildren(tempNode, children, width, height, worldX, worldY);
        break;
      default:
        childLayouts = this.computeAbsoluteChildren(tempNode, children, width, height, worldX, worldY);
    }
    
    childLayouts.forEach((layout, id) => {
      this.computed.set(id, layout);
    });
  }
  
  private clamp(value: number, min?: number, max?: number): number {
    let result = value;
    if (min !== undefined) result = Math.max(result, min);
    if (max !== undefined) result = Math.min(result, max);
    return result;
  }
  
  private sceneNodeToLayoutNode(node: SceneNode): LayoutNode {
    // Map SceneNode layout mode to LayoutEngine mode
    let mode: LayoutEngineMode = 'ABSOLUTE';
    if (node.layout.mode === 'HORIZONTAL' || node.layout.mode === 'VERTICAL') {
      mode = 'AUTO_LAYOUT';
    }
    // Could detect FLEX mode from additional flags if needed
    
    return {
      id: node.id,
      parentId: node.parentId,
      children: node.children,
      x: node.worldTransform[4],
      y: node.worldTransform[5],
      width: node.size.width,
      height: node.size.height,
      layout: {
        mode,
        direction: node.layout.mode === 'VERTICAL' ? 'COLUMN' : 'ROW',
        gap: node.layout.gap,
        padding: {
          top: node.layout.padding.top,
          right: node.layout.padding.right,
          bottom: node.layout.padding.bottom,
          left: node.layout.padding.left,
        },
        primaryAxisAlign: this.mapAxisAlign(node.layout.primaryAxisAlign),
        counterAxisAlign: this.mapCounterAlign(node.layout.counterAxisAlign),
        wrap: node.layout.wrap ?? false,
        reverse: false,
      },
      sizing: {
        horizontal: this.mapSizingMode(node.layout.sizing?.horizontal),
        vertical: this.mapSizingMode(node.layout.sizing?.vertical),
        minWidth: node.layout.sizing?.minWidth,
        maxWidth: node.layout.sizing?.maxWidth,
        minHeight: node.layout.sizing?.minHeight,
        maxHeight: node.layout.sizing?.maxHeight,
      },
      constraints: {
        horizontal: this.mapHConstraint(node.constraints?.horizontal),
        vertical: this.mapVConstraint(node.constraints?.vertical),
      },
      flexItem: {
        grow: node.layout.flexItem.grow,
        shrink: node.layout.flexItem.shrink,
        basis: node.layout.flexItem.basis,
        alignSelf: this.mapAlignSelf(node.layout.flexItem.alignSelf),
        order: 0,
      },
      visible: node.visible,
      absolutePosition: node.layout.absolutePosition ?? false,
    };
  }
  
  private mapAxisAlign(align?: string): PrimaryAxisAlign {
    switch (align) {
      case 'MIN': return 'START';
      case 'CENTER': return 'CENTER';
      case 'MAX': return 'END';
      case 'SPACE_BETWEEN': return 'SPACE_BETWEEN';
      default: return 'START';
    }
  }
  
  private mapCounterAlign(align?: string): CounterAxisAlign {
    switch (align) {
      case 'MIN': return 'START';
      case 'CENTER': return 'CENTER';
      case 'MAX': return 'END';
      case 'STRETCH': return 'STRETCH';
      case 'BASELINE': return 'BASELINE';
      default: return 'START';
    }
  }
  
  private mapSizingMode(mode?: string): SizingMode {
    switch (mode) {
      case 'FIXED': return 'FIXED';
      case 'HUG': return 'HUG';
      case 'FILL': return 'FILL';
      default: return 'FIXED';
    }
  }
  
  private mapHConstraint(constraint?: string): HorizontalConstraint {
    switch (constraint) {
      case 'LEFT': return 'LEFT';
      case 'RIGHT': return 'RIGHT';
      case 'LEFT_RIGHT': return 'LEFT_RIGHT';
      case 'CENTER': return 'CENTER';
      case 'SCALE': return 'SCALE';
      default: return 'LEFT';
    }
  }
  
  private mapVConstraint(constraint?: string): VerticalConstraint {
    switch (constraint) {
      case 'TOP': return 'TOP';
      case 'BOTTOM': return 'BOTTOM';
      case 'TOP_BOTTOM': return 'TOP_BOTTOM';
      case 'CENTER': return 'CENTER';
      case 'SCALE': return 'SCALE';
      default: return 'TOP';
    }
  }
  
  private mapAlignSelf(align?: string): AlignSelf {
    switch (align) {
      case 'AUTO': return 'AUTO';
      case 'START': return 'START';
      case 'CENTER': return 'CENTER';
      case 'END': return 'END';
      case 'STRETCH': return 'STRETCH';
      case 'BASELINE': return 'BASELINE';
      default: return 'AUTO';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

export const layoutEngine = new LayoutEngine();
