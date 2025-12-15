/**
 * AutoLayoutEngine.ts
 * 
 * Pure layout calculation engine for auto-layout frames.
 * Handles horizontal/vertical layouts, padding, gaps, alignment, and constraints.
 * No React dependencies - can be used in any context.
 */

export type LayoutDirection = 'HORIZONTAL' | 'VERTICAL';

export type AlignItems = 
  | 'MIN'        // top for vertical, left for horizontal
  | 'CENTER'     // center alignment
  | 'MAX'        // bottom for vertical, right for horizontal
  | 'STRETCH';   // stretch to fill

export type AlignContent = 
  | 'MIN'            // packed to start
  | 'CENTER'         // centered
  | 'MAX'            // packed to end
  | 'SPACE_BETWEEN'; // space between items

export type ConstraintType = 
  | 'MIN'       // fixed to start edge
  | 'MAX'       // fixed to end edge  
  | 'STRETCH'   // stretch between edges
  | 'CENTER'    // centered
  | 'SCALE';    // scale proportionally

export interface Constraints {
  horizontal: ConstraintType;
  vertical: ConstraintType;
}

export interface AutoLayoutConfig {
  layoutMode: LayoutDirection;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  primaryAxisAlignItems: AlignContent; // how items are distributed along main axis
  counterAxisAlignItems: AlignItems;    // how items align on cross axis
  layoutWrap?: 'NO_WRAP' | 'WRAP';      // wrapping behavior (future)
}

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  constraints: Constraints;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  layoutGrow?: number; // flex-grow equivalent
  layoutAlign?: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';
}

export interface LayoutResult {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

/**
 * Calculate auto-layout positions and sizes for child nodes
 */
export class AutoLayoutEngine {
  /**
   * Calculate layout for all children within a frame
   */
  static calculate(
    config: AutoLayoutConfig,
    children: LayoutNode[],
    frameSize: FrameSize
  ): LayoutResult[] {
    const isHorizontal = config.layoutMode === 'HORIZONTAL';
    
    // Calculate available space
    const availableWidth = frameSize.width - config.paddingLeft - config.paddingRight;
    const availableHeight = frameSize.height - config.paddingTop - config.paddingBottom;
    
    // Calculate primary axis (main direction) size
    const primaryAxisSize = isHorizontal ? availableWidth : availableHeight;
    const counterAxisSize = isHorizontal ? availableHeight : availableWidth;
    
    // Calculate total spacing between items
    const totalSpacing = Math.max(0, children.length - 1) * config.itemSpacing;
    
    // Calculate sizes for each child
    const childSizes = this.calculateChildSizes(
      children,
      primaryAxisSize - totalSpacing,
      counterAxisSize,
      isHorizontal
    );
    
    // Calculate positions along primary axis
    const positions = this.calculatePrimaryAxisPositions(
      childSizes,
      primaryAxisSize,
      config.itemSpacing,
      config.primaryAxisAlignItems
    );
    
    // Build final layout results
    const results: LayoutResult[] = children.map((child, index) => {
      const size = childSizes[index];
      const primaryPos = positions[index];
      
      // Calculate counter-axis position
      const counterPos = this.calculateCounterAxisPosition(
        size.counterAxis,
        counterAxisSize,
        config.counterAxisAlignItems,
        child.layoutAlign
      );
      
      return {
        id: child.id,
        x: isHorizontal 
          ? config.paddingLeft + primaryPos 
          : config.paddingLeft + counterPos,
        y: isHorizontal 
          ? config.paddingTop + counterPos 
          : config.paddingTop + primaryPos,
        width: isHorizontal ? size.primary : size.counterAxis,
        height: isHorizontal ? size.counterAxis : size.primary,
      };
    });
    
    return results;
  }
  
  /**
   * Calculate the size needed to contain all children
   * Used for auto-resizing frames
   */
  static calculateFrameSize(
    config: AutoLayoutConfig,
    children: LayoutNode[],
    currentSize: FrameSize
  ): FrameSize {
    if (children.length === 0) {
      return {
        width: config.paddingLeft + config.paddingRight,
        height: config.paddingTop + config.paddingBottom,
      };
    }
    
    const isHorizontal = config.layoutMode === 'HORIZONTAL';
    const totalSpacing = Math.max(0, children.length - 1) * config.itemSpacing;
    
    let primaryAxisSize = 0;
    let counterAxisSize = 0;
    
    children.forEach(child => {
      const childPrimary = isHorizontal ? child.width : child.height;
      const childCounter = isHorizontal ? child.height : child.width;
      
      primaryAxisSize += childPrimary;
      counterAxisSize = Math.max(counterAxisSize, childCounter);
    });
    
    primaryAxisSize += totalSpacing;
    
    const width = isHorizontal
      ? primaryAxisSize + config.paddingLeft + config.paddingRight
      : counterAxisSize + config.paddingLeft + config.paddingRight;
      
    const height = isHorizontal
      ? counterAxisSize + config.paddingTop + config.paddingBottom
      : primaryAxisSize + config.paddingTop + config.paddingBottom;
    
    return { width, height };
  }
  
  /**
   * Calculate sizes for children, handling flex-grow and constraints
   */
  private static calculateChildSizes(
    children: LayoutNode[],
    availablePrimarySpace: number,
    availableCounterSpace: number,
    isHorizontal: boolean
  ): Array<{ primary: number; counterAxis: number }> {
    // Calculate base sizes
    const baseSizes = children.map(child => ({
      primary: isHorizontal ? child.width : child.height,
      counterAxis: isHorizontal ? child.height : child.width,
    }));
    
    // Calculate total base size and total grow factor
    const totalBaseSize = baseSizes.reduce((sum, size) => sum + size.primary, 0);
    const totalGrow = children.reduce((sum, child) => sum + (child.layoutGrow || 0), 0);
    
    // Distribute remaining space to growing children
    const remainingSpace = Math.max(0, availablePrimarySpace - totalBaseSize);
    
    return baseSizes.map((size, index) => {
      const child = children[index];
      let primary = size.primary;
      
      // Apply flex-grow if there's remaining space
      if (totalGrow > 0 && child.layoutGrow) {
        const growAmount = (remainingSpace * child.layoutGrow) / totalGrow;
        primary += growAmount;
      }
      
      // Apply min/max constraints
      if (isHorizontal) {
        if (child.minWidth !== undefined) primary = Math.max(primary, child.minWidth);
        if (child.maxWidth !== undefined) primary = Math.min(primary, child.maxWidth);
      } else {
        if (child.minHeight !== undefined) primary = Math.max(primary, child.minHeight);
        if (child.maxHeight !== undefined) primary = Math.min(primary, child.maxHeight);
      }
      
      // Handle counter-axis stretch
      let counterAxis = size.counterAxis;
      const shouldStretch = 
        child.layoutAlign === 'STRETCH' ||
        (child.layoutAlign === 'INHERIT' && counterAxis < availableCounterSpace);
      
      if (shouldStretch) {
        counterAxis = availableCounterSpace;
        
        // Apply counter-axis constraints
        if (isHorizontal) {
          if (child.minHeight !== undefined) counterAxis = Math.max(counterAxis, child.minHeight);
          if (child.maxHeight !== undefined) counterAxis = Math.min(counterAxis, child.maxHeight);
        } else {
          if (child.minWidth !== undefined) counterAxis = Math.max(counterAxis, child.minWidth);
          if (child.maxWidth !== undefined) counterAxis = Math.min(counterAxis, child.maxWidth);
        }
      }
      
      return { primary, counterAxis };
    });
  }
  
  /**
   * Calculate positions along the primary axis based on alignment
   */
  private static calculatePrimaryAxisPositions(
    sizes: Array<{ primary: number; counterAxis: number }>,
    availableSpace: number,
    spacing: number,
    alignment: AlignContent
  ): number[] {
    const totalSize = sizes.reduce((sum, size) => sum + size.primary, 0);
    const totalSpacing = Math.max(0, sizes.length - 1) * spacing;
    const usedSpace = totalSize + totalSpacing;
    const remainingSpace = Math.max(0, availableSpace - usedSpace);
    
    const positions: number[] = [];
    let currentPos = 0;
    
    switch (alignment) {
      case 'MIN':
        // Pack to start
        sizes.forEach(size => {
          positions.push(currentPos);
          currentPos += size.primary + spacing;
        });
        break;
        
      case 'CENTER':
        // Center the group
        currentPos = remainingSpace / 2;
        sizes.forEach(size => {
          positions.push(currentPos);
          currentPos += size.primary + spacing;
        });
        break;
        
      case 'MAX':
        // Pack to end
        currentPos = remainingSpace;
        sizes.forEach(size => {
          positions.push(currentPos);
          currentPos += size.primary + spacing;
        });
        break;
        
      case 'SPACE_BETWEEN':
        // Distribute space between items
        if (sizes.length === 1) {
          positions.push(0);
        } else {
          const gap = remainingSpace / (sizes.length - 1) + spacing;
          sizes.forEach((size, index) => {
            positions.push(currentPos);
            currentPos += size.primary + gap;
          });
        }
        break;
    }
    
    return positions;
  }
  
  /**
   * Calculate position on counter axis based on alignment
   */
  private static calculateCounterAxisPosition(
    itemSize: number,
    availableSize: number,
    frameAlignment: AlignItems,
    itemAlignment?: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX'
  ): number {
    // Item alignment overrides frame alignment
    const alignment = itemAlignment === 'INHERIT' || !itemAlignment 
      ? frameAlignment 
      : itemAlignment;
    
    switch (alignment) {
      case 'MIN':
        return 0;
      case 'CENTER':
        return (availableSize - itemSize) / 2;
      case 'MAX':
        return availableSize - itemSize;
      case 'STRETCH':
        return 0; // Item already stretched to fill available size
      default:
        return 0;
    }
  }
  
  /**
   * Apply constraints when parent frame resizes
   * Returns new size and position for a child node
   */
  static applyConstraints(
    node: LayoutNode,
    originalPosition: { x: number; y: number },
    originalFrameSize: FrameSize,
    newFrameSize: FrameSize
  ): { x: number; y: number; width: number; height: number } {
    const result = {
      x: originalPosition.x,
      y: originalPosition.y,
      width: node.width,
      height: node.height,
    };
    
    // Calculate deltas
    const deltaWidth = newFrameSize.width - originalFrameSize.width;
    const deltaHeight = newFrameSize.height - originalFrameSize.height;
    
    // Apply horizontal constraints
    const rightEdge = originalPosition.x + node.width;
    const centerX = originalPosition.x + node.width / 2;
    
    switch (node.constraints.horizontal) {
      case 'MIN':
        // Fixed to left - no change needed
        break;
      case 'MAX':
        // Fixed to right - move with right edge
        result.x += deltaWidth;
        break;
      case 'STRETCH':
        // Stretch between edges
        result.width += deltaWidth;
        break;
      case 'CENTER':
        // Maintain center position
        result.x += deltaWidth / 2;
        break;
      case 'SCALE':
        // Scale proportionally
        const xRatio = originalPosition.x / originalFrameSize.width;
        const widthRatio = node.width / originalFrameSize.width;
        result.x = xRatio * newFrameSize.width;
        result.width = widthRatio * newFrameSize.width;
        break;
    }
    
    // Apply vertical constraints
    const bottomEdge = originalPosition.y + node.height;
    const centerY = originalPosition.y + node.height / 2;
    
    switch (node.constraints.vertical) {
      case 'MIN':
        // Fixed to top - no change needed
        break;
      case 'MAX':
        // Fixed to bottom - move with bottom edge
        result.y += deltaHeight;
        break;
      case 'STRETCH':
        // Stretch between edges
        result.height += deltaHeight;
        break;
      case 'CENTER':
        // Maintain center position
        result.y += deltaHeight / 2;
        break;
      case 'SCALE':
        // Scale proportionally
        const yRatio = originalPosition.y / originalFrameSize.height;
        const heightRatio = node.height / originalFrameSize.height;
        result.y = yRatio * newFrameSize.height;
        result.height = heightRatio * newFrameSize.height;
        break;
    }
    
    // Apply min/max constraints
    if (node.minWidth) result.width = Math.max(result.width, node.minWidth);
    if (node.maxWidth) result.width = Math.min(result.width, node.maxWidth);
    if (node.minHeight) result.height = Math.max(result.height, node.minHeight);
    if (node.maxHeight) result.height = Math.min(result.height, node.maxHeight);
    
    return result;
  }
}
