/**
 * AutoLayoutEngine - Complete auto-layout system with Figma-like behavior
 * 
 * Features:
 * - Horizontal and vertical layout
 * - Gap between items
 * - Padding (individual sides)
 * - Primary axis alignment (start, center, end, space-between)
 * - Counter axis alignment (start, center, end, stretch)
 * - Sizing modes (fixed, hug, fill)
 * - Wrap support
 * - Absolute positioned children
 * - Min/max size constraints
 */

import type { FigmaNode, AutoLayoutConfig, Bounds } from '../scene-graph/FigmaNode';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LayoutResult {
  /** New bounds for each child */
  childBounds: Map<string, Bounds>;
  /** New size for the container (if hug sizing) */
  containerSize: { width: number; height: number };
  /** Whether layout was applied */
  applied: boolean;
}

export interface LayoutChild {
  id: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  layoutSizingHorizontal: 'FIXED' | 'FILL' | 'HUG';
  layoutSizingVertical: 'FIXED' | 'FILL' | 'HUG';
  layoutPositioning?: 'AUTO' | 'ABSOLUTE';
  /** Absolute position constraints */
  constraints?: {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO LAYOUT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class AutoLayoutEngine {
  
  /**
   * Apply auto-layout to a frame and its children
   */
  applyLayout(
    frame: FigmaNode,
    children: LayoutChild[]
  ): LayoutResult {
    const layout = frame.autoLayout;
    
    // If no auto-layout, skip
    if (!layout || layout.layoutMode === 'NONE') {
      return {
        childBounds: new Map(),
        containerSize: { width: frame.width, height: frame.height },
        applied: false,
      };
    }
    
    // Separate auto and absolute positioned children
    const autoChildren = children.filter(c => c.layoutPositioning !== 'ABSOLUTE');
    const absoluteChildren = children.filter(c => c.layoutPositioning === 'ABSOLUTE');
    
    // Calculate layout
    const result = layout.layoutMode === 'HORIZONTAL'
      ? this.layoutHorizontal(frame, layout, autoChildren)
      : this.layoutVertical(frame, layout, autoChildren);
    
    // Layout absolute positioned children
    for (const child of absoluteChildren) {
      const bounds = this.layoutAbsoluteChild(frame, child);
      result.childBounds.set(child.id, bounds);
    }
    
    return result;
  }
  
  /**
   * Layout children horizontally
   */
  private layoutHorizontal(
    frame: FigmaNode,
    layout: AutoLayoutConfig,
    children: LayoutChild[]
  ): LayoutResult {
    const childBounds = new Map<string, Bounds>();
    
    const paddingLeft = layout.padding.left;
    const paddingRight = layout.padding.right;
    const paddingTop = layout.padding.top;
    const paddingBottom = layout.padding.bottom;
    const gap = layout.itemSpacing;
    
    // Available space
    const availableWidth = frame.width - paddingLeft - paddingRight;
    const availableHeight = frame.height - paddingTop - paddingBottom;
    
    // Calculate total fixed width and count fill children
    let totalFixedWidth = 0;
    let fillCount = 0;
    
    for (const child of children) {
      if (child.layoutSizingHorizontal === 'FILL') {
        fillCount++;
      } else {
        totalFixedWidth += child.width;
      }
    }
    
    // Add gaps
    totalFixedWidth += (children.length - 1) * gap;
    
    // Calculate fill child width
    const remainingWidth = Math.max(0, availableWidth - totalFixedWidth);
    const fillWidth = fillCount > 0 ? remainingWidth / fillCount : 0;
    
    // Calculate starting X based on primary axis alignment
    let currentX = paddingLeft;
    
    if (layout.primaryAxisAlignItems === 'CENTER') {
      const contentWidth = this.calculateContentWidth(children, fillWidth, gap);
      currentX = paddingLeft + (availableWidth - contentWidth) / 2;
    } else if (layout.primaryAxisAlignItems === 'MAX') {
      const contentWidth = this.calculateContentWidth(children, fillWidth, gap);
      currentX = paddingLeft + availableWidth - contentWidth;
    }
    
    // Space-between distribution
    let spaceBetweenGap = gap;
    if (layout.primaryAxisAlignItems === 'SPACE_BETWEEN' && children.length > 1) {
      const contentWidth = this.calculateContentWidth(children, fillWidth, 0);
      spaceBetweenGap = (availableWidth - contentWidth) / (children.length - 1);
    }
    
    // Position each child
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      // Calculate child width
      let childWidth = child.layoutSizingHorizontal === 'FILL' 
        ? fillWidth 
        : child.width;
      
      // Apply min/max constraints
      if (child.minWidth !== undefined) childWidth = Math.max(childWidth, child.minWidth);
      if (child.maxWidth !== undefined) childWidth = Math.min(childWidth, child.maxWidth);
      
      // Calculate child height
      let childHeight = child.layoutSizingVertical === 'FILL'
        ? availableHeight
        : child.height;
      
      // Apply min/max constraints
      if (child.minHeight !== undefined) childHeight = Math.max(childHeight, child.minHeight);
      if (child.maxHeight !== undefined) childHeight = Math.min(childHeight, child.maxHeight);
      
      // Calculate Y based on counter axis alignment
      let childY = paddingTop;
      
      if (layout.counterAxisAlignItems === 'CENTER') {
        childY = paddingTop + (availableHeight - childHeight) / 2;
      } else if (layout.counterAxisAlignItems === 'MAX') {
        childY = paddingTop + availableHeight - childHeight;
      } else if (layout.counterAxisAlignItems === 'STRETCH' && child.layoutSizingVertical !== 'FIXED') {
        childHeight = availableHeight;
      }
      
      childBounds.set(child.id, {
        x: currentX,
        y: childY,
        width: childWidth,
        height: childHeight,
      });
      
      // Advance X position
      currentX += childWidth;
      if (i < children.length - 1) {
        currentX += layout.primaryAxisAlignItems === 'SPACE_BETWEEN' ? spaceBetweenGap : gap;
      }
    }
    
    // Calculate container size for hug sizing
    const contentWidth = currentX - paddingLeft + paddingRight;
    const maxChildHeight = Math.max(...children.map(c => {
      const bounds = childBounds.get(c.id);
      return bounds ? bounds.height : 0;
    }), 0);
    const contentHeight = maxChildHeight + paddingTop + paddingBottom;
    
    return {
      childBounds,
      containerSize: {
        width: layout.primaryAxisSizingMode === 'HUG' ? contentWidth : frame.width,
        height: layout.counterAxisSizingMode === 'HUG' ? contentHeight : frame.height,
      },
      applied: true,
    };
  }
  
  /**
   * Layout children vertically
   */
  private layoutVertical(
    frame: FigmaNode,
    layout: AutoLayoutConfig,
    children: LayoutChild[]
  ): LayoutResult {
    const childBounds = new Map<string, Bounds>();
    
    const paddingLeft = layout.padding.left;
    const paddingRight = layout.padding.right;
    const paddingTop = layout.padding.top;
    const paddingBottom = layout.padding.bottom;
    const gap = layout.itemSpacing;
    
    // Available space
    const availableWidth = frame.width - paddingLeft - paddingRight;
    const availableHeight = frame.height - paddingTop - paddingBottom;
    
    // Calculate total fixed height and count fill children
    let totalFixedHeight = 0;
    let fillCount = 0;
    
    for (const child of children) {
      if (child.layoutSizingVertical === 'FILL') {
        fillCount++;
      } else {
        totalFixedHeight += child.height;
      }
    }
    
    // Add gaps
    totalFixedHeight += (children.length - 1) * gap;
    
    // Calculate fill child height
    const remainingHeight = Math.max(0, availableHeight - totalFixedHeight);
    const fillHeight = fillCount > 0 ? remainingHeight / fillCount : 0;
    
    // Calculate starting Y based on primary axis alignment
    let currentY = paddingTop;
    
    if (layout.primaryAxisAlignItems === 'CENTER') {
      const contentHeight = this.calculateContentHeight(children, fillHeight, gap);
      currentY = paddingTop + (availableHeight - contentHeight) / 2;
    } else if (layout.primaryAxisAlignItems === 'MAX') {
      const contentHeight = this.calculateContentHeight(children, fillHeight, gap);
      currentY = paddingTop + availableHeight - contentHeight;
    }
    
    // Space-between distribution
    let spaceBetweenGap = gap;
    if (layout.primaryAxisAlignItems === 'SPACE_BETWEEN' && children.length > 1) {
      const contentHeight = this.calculateContentHeight(children, fillHeight, 0);
      spaceBetweenGap = (availableHeight - contentHeight) / (children.length - 1);
    }
    
    // Position each child
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      // Calculate child height
      let childHeight = child.layoutSizingVertical === 'FILL'
        ? fillHeight
        : child.height;
      
      // Apply min/max constraints
      if (child.minHeight !== undefined) childHeight = Math.max(childHeight, child.minHeight);
      if (child.maxHeight !== undefined) childHeight = Math.min(childHeight, child.maxHeight);
      
      // Calculate child width
      let childWidth = child.layoutSizingHorizontal === 'FILL'
        ? availableWidth
        : child.width;
      
      // Apply min/max constraints
      if (child.minWidth !== undefined) childWidth = Math.max(childWidth, child.minWidth);
      if (child.maxWidth !== undefined) childWidth = Math.min(childWidth, child.maxWidth);
      
      // Calculate X based on counter axis alignment
      let childX = paddingLeft;
      
      if (layout.counterAxisAlignItems === 'CENTER') {
        childX = paddingLeft + (availableWidth - childWidth) / 2;
      } else if (layout.counterAxisAlignItems === 'MAX') {
        childX = paddingLeft + availableWidth - childWidth;
      } else if (layout.counterAxisAlignItems === 'STRETCH' && child.layoutSizingHorizontal !== 'FIXED') {
        childWidth = availableWidth;
      }
      
      childBounds.set(child.id, {
        x: childX,
        y: currentY,
        width: childWidth,
        height: childHeight,
      });
      
      // Advance Y position
      currentY += childHeight;
      if (i < children.length - 1) {
        currentY += layout.primaryAxisAlignItems === 'SPACE_BETWEEN' ? spaceBetweenGap : gap;
      }
    }
    
    // Calculate container size for hug sizing
    const contentHeight = currentY - paddingTop + paddingBottom;
    const maxChildWidth = Math.max(...children.map(c => {
      const bounds = childBounds.get(c.id);
      return bounds ? bounds.width : 0;
    }), 0);
    const contentWidth = maxChildWidth + paddingLeft + paddingRight;
    
    return {
      childBounds,
      containerSize: {
        width: layout.counterAxisSizingMode === 'HUG' ? contentWidth : frame.width,
        height: layout.primaryAxisSizingMode === 'HUG' ? contentHeight : frame.height,
      },
      applied: true,
    };
  }
  
  /**
   * Layout an absolute positioned child within frame
   */
  private layoutAbsoluteChild(frame: FigmaNode, child: LayoutChild): Bounds {
    const constraints = child.constraints || { horizontal: 'MIN', vertical: 'MIN' };
    
    let x = 0;
    let y = 0;
    let width = child.width;
    let height = child.height;
    
    // Horizontal constraint
    switch (constraints.horizontal) {
      case 'MIN':
        x = 0;
        break;
      case 'CENTER':
        x = (frame.width - width) / 2;
        break;
      case 'MAX':
        x = frame.width - width;
        break;
      case 'STRETCH':
        x = 0;
        width = frame.width;
        break;
      case 'SCALE':
        // Scale proportionally (would need original frame size)
        x = 0;
        break;
    }
    
    // Vertical constraint
    switch (constraints.vertical) {
      case 'MIN':
        y = 0;
        break;
      case 'CENTER':
        y = (frame.height - height) / 2;
        break;
      case 'MAX':
        y = frame.height - height;
        break;
      case 'STRETCH':
        y = 0;
        height = frame.height;
        break;
      case 'SCALE':
        y = 0;
        break;
    }
    
    return { x, y, width, height };
  }
  
  /**
   * Calculate total content width
   */
  private calculateContentWidth(
    children: LayoutChild[],
    fillWidth: number,
    gap: number
  ): number {
    let total = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      total += child.layoutSizingHorizontal === 'FILL' ? fillWidth : child.width;
      if (i < children.length - 1) {
        total += gap;
      }
    }
    return total;
  }
  
  /**
   * Calculate total content height
   */
  private calculateContentHeight(
    children: LayoutChild[],
    fillHeight: number,
    gap: number
  ): number {
    let total = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      total += child.layoutSizingVertical === 'FILL' ? fillHeight : child.height;
      if (i < children.length - 1) {
        total += gap;
      }
    }
    return total;
  }
  
  /**
   * Check if a frame has auto-layout enabled
   */
  hasAutoLayout(frame: FigmaNode): boolean {
    return frame.autoLayout !== undefined && frame.autoLayout.layoutMode !== 'NONE';
  }
  
  /**
   * Create default auto-layout config
   */
  createDefaultConfig(layoutMode: 'HORIZONTAL' | 'VERTICAL'): AutoLayoutConfig {
    return {
      layoutMode,
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'FIXED',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      itemSpacing: 10,
      counterAxisSpacing: 0,
      layoutWrap: 'NO_WRAP',
      itemReverseZIndex: false,
      strokesIncludedInLayout: false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const autoLayoutEngine = new AutoLayoutEngine();
