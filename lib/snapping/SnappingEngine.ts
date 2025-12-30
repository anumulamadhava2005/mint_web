/**
 * SnappingEngine - Intelligent snapping for drag and resize operations
 * 
 * Snap targets:
 * - Grid (configurable spacing)
 * - Sibling edges (left, right, top, bottom)
 * - Centers (horizontal and vertical midpoints)
 * - Frame/parent edges
 * 
 * Exposes snap guides for visual feedback in CanvasStage
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SnapGuide {
  /** Orientation of the guide line */
  orientation: 'horizontal' | 'vertical';
  /** Position of the guide (x for vertical, y for horizontal) */
  position: number;
  /** Start point for rendering the guide line */
  start: number;
  /** End point for rendering the guide line */
  end: number;
  /** Type of snap that created this guide */
  type: SnapType;
  /** IDs of nodes involved in this snap */
  sourceIds: string[];
}

export type SnapType = 
  | 'grid'
  | 'sibling-edge'
  | 'sibling-center'
  | 'frame-edge'
  | 'frame-center';

export interface SnapTarget {
  /** The node/element being snapped to */
  id: string;
  /** Bounding rect in world coordinates */
  bounds: Rect;
  /** Whether this is a frame/container */
  isFrame: boolean;
  /** Whether this is the parent of the dragged node */
  isParent: boolean;
}

export interface SnapResult {
  /** Adjusted position after snapping */
  snappedX: number;
  snappedY: number;
  /** Delta applied for snapping */
  snapDeltaX: number;
  snapDeltaY: number;
  /** Whether X was snapped */
  didSnapX: boolean;
  /** Whether Y was snapped */
  didSnapY: boolean;
  /** Active snap guides for rendering */
  guides: SnapGuide[];
}

export interface SnappingOptions {
  /** Enable grid snapping */
  enableGrid?: boolean;
  /** Grid spacing in pixels */
  gridSize?: number;
  /** Enable snapping to sibling edges */
  enableSiblingEdges?: boolean;
  /** Enable snapping to sibling centers */
  enableSiblingCenters?: boolean;
  /** Enable snapping to parent frame edges */
  enableFrameEdges?: boolean;
  /** Enable snapping to parent frame center */
  enableFrameCenter?: boolean;
  /** Snap threshold in pixels (how close before snapping) */
  threshold?: number;
  /** Priority order for snap types (higher = more priority) */
  priority?: Record<SnapType, number>;
}

export interface SnapCandidate {
  type: SnapType;
  position: number;
  delta: number;
  sourceId: string;
  edge: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<SnappingOptions> = {
  enableGrid: true,
  gridSize: 8,
  enableSiblingEdges: true,
  enableSiblingCenters: true,
  enableFrameEdges: true,
  enableFrameCenter: true,
  threshold: 8,
  priority: {
    'grid': 1,
    'sibling-edge': 3,
    'sibling-center': 2,
    'frame-edge': 4,
    'frame-center': 3,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SnappingEngine Class
// ─────────────────────────────────────────────────────────────────────────────

export class SnappingEngine {
  private options: Required<SnappingOptions>;
  private targets: SnapTarget[] = [];
  private parentBounds: Rect | null = null;
  
  // Cache for current snap session
  private lastGuides: SnapGuide[] = [];
  
  constructor(options: SnappingOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Update snapping options
   */
  setOptions(options: Partial<SnappingOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Get current options
   */
  getOptions(): Required<SnappingOptions> {
    return { ...this.options };
  }
  
  /**
   * Set snap targets (siblings, frames, etc.)
   */
  setTargets(targets: SnapTarget[]): void {
    this.targets = targets;
  }
  
  /**
   * Set parent frame bounds for frame edge snapping
   */
  setParentBounds(bounds: Rect | null): void {
    this.parentBounds = bounds;
  }
  
  /**
   * Clear all targets
   */
  clearTargets(): void {
    this.targets = [];
    this.parentBounds = null;
    this.lastGuides = [];
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Main Snapping Logic
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Calculate snapped position for a dragged node
   */
  snap(
    nodeId: string,
    nodeBounds: Rect,
    proposedX: number,
    proposedY: number
  ): SnapResult {
    const proposedBounds: Rect = {
      x: proposedX,
      y: proposedY,
      width: nodeBounds.width,
      height: nodeBounds.height,
    };
    
    // Collect all snap candidates
    const xCandidates: SnapCandidate[] = [];
    const yCandidates: SnapCandidate[] = [];
    
    // Grid snapping
    if (this.options.enableGrid) {
      this.collectGridCandidates(proposedBounds, xCandidates, yCandidates);
    }
    
    // Sibling snapping
    const siblings = this.targets.filter(t => t.id !== nodeId && !t.isParent);
    
    if (this.options.enableSiblingEdges) {
      this.collectSiblingEdgeCandidates(proposedBounds, siblings, xCandidates, yCandidates);
    }
    
    if (this.options.enableSiblingCenters) {
      this.collectSiblingCenterCandidates(proposedBounds, siblings, xCandidates, yCandidates);
    }
    
    // Frame/parent snapping
    if (this.parentBounds) {
      if (this.options.enableFrameEdges) {
        this.collectFrameEdgeCandidates(proposedBounds, xCandidates, yCandidates);
      }
      if (this.options.enableFrameCenter) {
        this.collectFrameCenterCandidates(proposedBounds, xCandidates, yCandidates);
      }
    }
    
    // Select best snap candidates
    const bestX = this.selectBestCandidate(xCandidates);
    const bestY = this.selectBestCandidate(yCandidates);
    
    // Calculate result
    const snapDeltaX = bestX?.delta ?? 0;
    const snapDeltaY = bestY?.delta ?? 0;
    const snappedX = proposedX + snapDeltaX;
    const snappedY = proposedY + snapDeltaY;
    
    // Generate guides
    const guides: SnapGuide[] = [];
    
    if (bestX) {
      guides.push(...this.createGuidesForCandidate(
        bestX,
        { ...proposedBounds, x: snappedX, y: snappedY },
        'vertical'
      ));
    }
    
    if (bestY) {
      guides.push(...this.createGuidesForCandidate(
        bestY,
        { ...proposedBounds, x: snappedX, y: snappedY },
        'horizontal'
      ));
    }
    
    this.lastGuides = guides;
    
    return {
      snappedX,
      snappedY,
      snapDeltaX,
      snapDeltaY,
      didSnapX: bestX !== null,
      didSnapY: bestY !== null,
      guides,
    };
  }
  
  /**
   * Get the last calculated guides (for rendering)
   */
  getGuides(): SnapGuide[] {
    return this.lastGuides;
  }
  
  /**
   * Clear guides (call when drag ends)
   */
  clearGuides(): void {
    this.lastGuides = [];
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Grid Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  private collectGridCandidates(
    bounds: Rect,
    xCandidates: SnapCandidate[],
    yCandidates: SnapCandidate[]
  ): void {
    const { gridSize, threshold } = this.options;
    
    // Snap left edge to grid
    const leftSnap = this.snapToGrid(bounds.x, gridSize);
    if (Math.abs(leftSnap) <= threshold) {
      xCandidates.push({
        type: 'grid',
        position: bounds.x + leftSnap,
        delta: leftSnap,
        sourceId: 'grid',
        edge: 'left',
      });
    }
    
    // Snap right edge to grid
    const rightX = bounds.x + bounds.width;
    const rightSnap = this.snapToGrid(rightX, gridSize);
    if (Math.abs(rightSnap) <= threshold) {
      xCandidates.push({
        type: 'grid',
        position: rightX + rightSnap,
        delta: rightSnap,
        sourceId: 'grid',
        edge: 'right',
      });
    }
    
    // Snap top edge to grid
    const topSnap = this.snapToGrid(bounds.y, gridSize);
    if (Math.abs(topSnap) <= threshold) {
      yCandidates.push({
        type: 'grid',
        position: bounds.y + topSnap,
        delta: topSnap,
        sourceId: 'grid',
        edge: 'top',
      });
    }
    
    // Snap bottom edge to grid
    const bottomY = bounds.y + bounds.height;
    const bottomSnap = this.snapToGrid(bottomY, gridSize);
    if (Math.abs(bottomSnap) <= threshold) {
      yCandidates.push({
        type: 'grid',
        position: bottomY + bottomSnap,
        delta: bottomSnap,
        sourceId: 'grid',
        edge: 'bottom',
      });
    }
  }
  
  private snapToGrid(value: number, gridSize: number): number {
    const snapped = Math.round(value / gridSize) * gridSize;
    return snapped - value;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Sibling Edge Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  private collectSiblingEdgeCandidates(
    bounds: Rect,
    siblings: SnapTarget[],
    xCandidates: SnapCandidate[],
    yCandidates: SnapCandidate[]
  ): void {
    const { threshold } = this.options;
    
    const myLeft = bounds.x;
    const myRight = bounds.x + bounds.width;
    const myTop = bounds.y;
    const myBottom = bounds.y + bounds.height;
    
    for (const sibling of siblings) {
      const sb = sibling.bounds;
      const sibLeft = sb.x;
      const sibRight = sb.x + sb.width;
      const sibTop = sb.y;
      const sibBottom = sb.y + sb.height;
      
      // X-axis: left-to-left, left-to-right, right-to-left, right-to-right
      this.addCandidateIfClose(xCandidates, myLeft, sibLeft, threshold, sibling.id, 'sibling-edge', 'left');
      this.addCandidateIfClose(xCandidates, myLeft, sibRight, threshold, sibling.id, 'sibling-edge', 'left');
      this.addCandidateIfClose(xCandidates, myRight, sibLeft, threshold, sibling.id, 'sibling-edge', 'right');
      this.addCandidateIfClose(xCandidates, myRight, sibRight, threshold, sibling.id, 'sibling-edge', 'right');
      
      // Y-axis: top-to-top, top-to-bottom, bottom-to-top, bottom-to-bottom
      this.addCandidateIfClose(yCandidates, myTop, sibTop, threshold, sibling.id, 'sibling-edge', 'top');
      this.addCandidateIfClose(yCandidates, myTop, sibBottom, threshold, sibling.id, 'sibling-edge', 'top');
      this.addCandidateIfClose(yCandidates, myBottom, sibTop, threshold, sibling.id, 'sibling-edge', 'bottom');
      this.addCandidateIfClose(yCandidates, myBottom, sibBottom, threshold, sibling.id, 'sibling-edge', 'bottom');
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Sibling Center Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  private collectSiblingCenterCandidates(
    bounds: Rect,
    siblings: SnapTarget[],
    xCandidates: SnapCandidate[],
    yCandidates: SnapCandidate[]
  ): void {
    const { threshold } = this.options;
    
    const myCenterX = bounds.x + bounds.width / 2;
    const myCenterY = bounds.y + bounds.height / 2;
    
    for (const sibling of siblings) {
      const sb = sibling.bounds;
      const sibCenterX = sb.x + sb.width / 2;
      const sibCenterY = sb.y + sb.height / 2;
      
      // Center-to-center alignment
      const deltaX = sibCenterX - myCenterX;
      if (Math.abs(deltaX) <= threshold) {
        xCandidates.push({
          type: 'sibling-center',
          position: sibCenterX,
          delta: deltaX,
          sourceId: sibling.id,
          edge: 'centerX',
        });
      }
      
      const deltaY = sibCenterY - myCenterY;
      if (Math.abs(deltaY) <= threshold) {
        yCandidates.push({
          type: 'sibling-center',
          position: sibCenterY,
          delta: deltaY,
          sourceId: sibling.id,
          edge: 'centerY',
        });
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Frame Edge Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  private collectFrameEdgeCandidates(
    bounds: Rect,
    xCandidates: SnapCandidate[],
    yCandidates: SnapCandidate[]
  ): void {
    if (!this.parentBounds) return;
    
    const { threshold } = this.options;
    const pb = this.parentBounds;
    
    const myLeft = bounds.x;
    const myRight = bounds.x + bounds.width;
    const myTop = bounds.y;
    const myBottom = bounds.y + bounds.height;
    
    const frameLeft = pb.x;
    const frameRight = pb.x + pb.width;
    const frameTop = pb.y;
    const frameBottom = pb.y + pb.height;
    
    // X-axis: snap to frame left/right edges
    this.addCandidateIfClose(xCandidates, myLeft, frameLeft, threshold, 'frame', 'frame-edge', 'left');
    this.addCandidateIfClose(xCandidates, myRight, frameRight, threshold, 'frame', 'frame-edge', 'right');
    // Also allow snapping left edge to right and vice versa for positioning at edges
    this.addCandidateIfClose(xCandidates, myLeft, frameRight, threshold, 'frame', 'frame-edge', 'left');
    this.addCandidateIfClose(xCandidates, myRight, frameLeft, threshold, 'frame', 'frame-edge', 'right');
    
    // Y-axis: snap to frame top/bottom edges
    this.addCandidateIfClose(yCandidates, myTop, frameTop, threshold, 'frame', 'frame-edge', 'top');
    this.addCandidateIfClose(yCandidates, myBottom, frameBottom, threshold, 'frame', 'frame-edge', 'bottom');
    this.addCandidateIfClose(yCandidates, myTop, frameBottom, threshold, 'frame', 'frame-edge', 'top');
    this.addCandidateIfClose(yCandidates, myBottom, frameTop, threshold, 'frame', 'frame-edge', 'bottom');
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Frame Center Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  private collectFrameCenterCandidates(
    bounds: Rect,
    xCandidates: SnapCandidate[],
    yCandidates: SnapCandidate[]
  ): void {
    if (!this.parentBounds) return;
    
    const { threshold } = this.options;
    const pb = this.parentBounds;
    
    const myCenterX = bounds.x + bounds.width / 2;
    const myCenterY = bounds.y + bounds.height / 2;
    const frameCenterX = pb.x + pb.width / 2;
    const frameCenterY = pb.y + pb.height / 2;
    
    const deltaX = frameCenterX - myCenterX;
    if (Math.abs(deltaX) <= threshold) {
      xCandidates.push({
        type: 'frame-center',
        position: frameCenterX,
        delta: deltaX,
        sourceId: 'frame',
        edge: 'centerX',
      });
    }
    
    const deltaY = frameCenterY - myCenterY;
    if (Math.abs(deltaY) <= threshold) {
      yCandidates.push({
        type: 'frame-center',
        position: frameCenterY,
        delta: deltaY,
        sourceId: 'frame',
        edge: 'centerY',
      });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Candidate Selection
  // ─────────────────────────────────────────────────────────────────────────
  
  private addCandidateIfClose(
    candidates: SnapCandidate[],
    myEdge: number,
    targetEdge: number,
    threshold: number,
    sourceId: string,
    type: SnapType,
    edge: SnapCandidate['edge']
  ): void {
    const delta = targetEdge - myEdge;
    if (Math.abs(delta) <= threshold) {
      candidates.push({
        type,
        position: targetEdge,
        delta: edge === 'right' || edge === 'bottom' ? delta - (myEdge - (myEdge - delta)) : delta,
        sourceId,
        edge,
      });
      // Fix delta calculation for right/bottom edges
      candidates[candidates.length - 1].delta = delta;
    }
  }
  
  private selectBestCandidate(candidates: SnapCandidate[]): SnapCandidate | null {
    if (candidates.length === 0) return null;
    
    // Sort by priority (higher = better), then by absolute delta (smaller = better)
    candidates.sort((a, b) => {
      const priorityDiff = this.options.priority[b.type] - this.options.priority[a.type];
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(a.delta) - Math.abs(b.delta);
    });
    
    return candidates[0];
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Guide Generation
  // ─────────────────────────────────────────────────────────────────────────
  
  private createGuidesForCandidate(
    candidate: SnapCandidate,
    snappedBounds: Rect,
    orientation: 'horizontal' | 'vertical'
  ): SnapGuide[] {
    const guides: SnapGuide[] = [];
    
    if (orientation === 'vertical') {
      // Vertical line at X position
      const x = candidate.position;
      
      // Find extent of the guide line
      let minY = snappedBounds.y;
      let maxY = snappedBounds.y + snappedBounds.height;
      
      // Extend to include source node
      if (candidate.sourceId !== 'grid' && candidate.sourceId !== 'frame') {
        const source = this.targets.find(t => t.id === candidate.sourceId);
        if (source) {
          minY = Math.min(minY, source.bounds.y);
          maxY = Math.max(maxY, source.bounds.y + source.bounds.height);
        }
      } else if (candidate.sourceId === 'frame' && this.parentBounds) {
        minY = Math.min(minY, this.parentBounds.y);
        maxY = Math.max(maxY, this.parentBounds.y + this.parentBounds.height);
      }
      
      guides.push({
        orientation: 'vertical',
        position: x,
        start: minY - 10,
        end: maxY + 10,
        type: candidate.type,
        sourceIds: [candidate.sourceId],
      });
    } else {
      // Horizontal line at Y position
      const y = candidate.position;
      
      // Find extent of the guide line
      let minX = snappedBounds.x;
      let maxX = snappedBounds.x + snappedBounds.width;
      
      // Extend to include source node
      if (candidate.sourceId !== 'grid' && candidate.sourceId !== 'frame') {
        const source = this.targets.find(t => t.id === candidate.sourceId);
        if (source) {
          minX = Math.min(minX, source.bounds.x);
          maxX = Math.max(maxX, source.bounds.x + source.bounds.width);
        }
      } else if (candidate.sourceId === 'frame' && this.parentBounds) {
        minX = Math.min(minX, this.parentBounds.x);
        maxX = Math.max(maxX, this.parentBounds.x + this.parentBounds.width);
      }
      
      guides.push({
        orientation: 'horizontal',
        position: y,
        start: minX - 10,
        end: maxX + 10,
        type: candidate.type,
        sourceIds: [candidate.sourceId],
      });
    }
    
    return guides;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Resize Snapping
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Snap a resize handle position
   */
  snapResize(
    nodeId: string,
    originalBounds: Rect,
    handle: string,
    proposedBounds: Rect
  ): SnapResult {
    // Determine which edges are being resized
    const resizingLeft = handle.includes('w');
    const resizingRight = handle.includes('e');
    const resizingTop = handle.includes('n');
    const resizingBottom = handle.includes('s');
    
    const xCandidates: SnapCandidate[] = [];
    const yCandidates: SnapCandidate[] = [];
    
    const siblings = this.targets.filter(t => t.id !== nodeId && !t.isParent);
    
    // Only snap edges that are being resized
    if (resizingLeft || resizingRight) {
      for (const sibling of siblings) {
        const sb = sibling.bounds;
        
        if (resizingLeft) {
          this.addCandidateIfClose(xCandidates, proposedBounds.x, sb.x, this.options.threshold, sibling.id, 'sibling-edge', 'left');
          this.addCandidateIfClose(xCandidates, proposedBounds.x, sb.x + sb.width, this.options.threshold, sibling.id, 'sibling-edge', 'left');
        }
        
        if (resizingRight) {
          const rightEdge = proposedBounds.x + proposedBounds.width;
          this.addCandidateIfClose(xCandidates, rightEdge, sb.x, this.options.threshold, sibling.id, 'sibling-edge', 'right');
          this.addCandidateIfClose(xCandidates, rightEdge, sb.x + sb.width, this.options.threshold, sibling.id, 'sibling-edge', 'right');
        }
      }
      
      // Frame edges
      if (this.parentBounds && this.options.enableFrameEdges) {
        if (resizingLeft) {
          this.addCandidateIfClose(xCandidates, proposedBounds.x, this.parentBounds.x, this.options.threshold, 'frame', 'frame-edge', 'left');
        }
        if (resizingRight) {
          const rightEdge = proposedBounds.x + proposedBounds.width;
          this.addCandidateIfClose(xCandidates, rightEdge, this.parentBounds.x + this.parentBounds.width, this.options.threshold, 'frame', 'frame-edge', 'right');
        }
      }
      
      // Grid
      if (this.options.enableGrid) {
        if (resizingLeft) {
          const snap = this.snapToGrid(proposedBounds.x, this.options.gridSize);
          if (Math.abs(snap) <= this.options.threshold) {
            xCandidates.push({ type: 'grid', position: proposedBounds.x + snap, delta: snap, sourceId: 'grid', edge: 'left' });
          }
        }
        if (resizingRight) {
          const rightEdge = proposedBounds.x + proposedBounds.width;
          const snap = this.snapToGrid(rightEdge, this.options.gridSize);
          if (Math.abs(snap) <= this.options.threshold) {
            xCandidates.push({ type: 'grid', position: rightEdge + snap, delta: snap, sourceId: 'grid', edge: 'right' });
          }
        }
      }
    }
    
    if (resizingTop || resizingBottom) {
      for (const sibling of siblings) {
        const sb = sibling.bounds;
        
        if (resizingTop) {
          this.addCandidateIfClose(yCandidates, proposedBounds.y, sb.y, this.options.threshold, sibling.id, 'sibling-edge', 'top');
          this.addCandidateIfClose(yCandidates, proposedBounds.y, sb.y + sb.height, this.options.threshold, sibling.id, 'sibling-edge', 'top');
        }
        
        if (resizingBottom) {
          const bottomEdge = proposedBounds.y + proposedBounds.height;
          this.addCandidateIfClose(yCandidates, bottomEdge, sb.y, this.options.threshold, sibling.id, 'sibling-edge', 'bottom');
          this.addCandidateIfClose(yCandidates, bottomEdge, sb.y + sb.height, this.options.threshold, sibling.id, 'sibling-edge', 'bottom');
        }
      }
      
      // Frame edges
      if (this.parentBounds && this.options.enableFrameEdges) {
        if (resizingTop) {
          this.addCandidateIfClose(yCandidates, proposedBounds.y, this.parentBounds.y, this.options.threshold, 'frame', 'frame-edge', 'top');
        }
        if (resizingBottom) {
          const bottomEdge = proposedBounds.y + proposedBounds.height;
          this.addCandidateIfClose(yCandidates, bottomEdge, this.parentBounds.y + this.parentBounds.height, this.options.threshold, 'frame', 'frame-edge', 'bottom');
        }
      }
      
      // Grid
      if (this.options.enableGrid) {
        if (resizingTop) {
          const snap = this.snapToGrid(proposedBounds.y, this.options.gridSize);
          if (Math.abs(snap) <= this.options.threshold) {
            yCandidates.push({ type: 'grid', position: proposedBounds.y + snap, delta: snap, sourceId: 'grid', edge: 'top' });
          }
        }
        if (resizingBottom) {
          const bottomEdge = proposedBounds.y + proposedBounds.height;
          const snap = this.snapToGrid(bottomEdge, this.options.gridSize);
          if (Math.abs(snap) <= this.options.threshold) {
            yCandidates.push({ type: 'grid', position: bottomEdge + snap, delta: snap, sourceId: 'grid', edge: 'bottom' });
          }
        }
      }
    }
    
    // Select best candidates
    const bestX = this.selectBestCandidate(xCandidates);
    const bestY = this.selectBestCandidate(yCandidates);
    
    // Calculate adjusted bounds
    let snappedX = proposedBounds.x;
    let snappedY = proposedBounds.y;
    let snappedWidth = proposedBounds.width;
    let snappedHeight = proposedBounds.height;
    
    if (bestX) {
      if (resizingLeft && bestX.edge === 'left') {
        const newX = proposedBounds.x + bestX.delta;
        snappedWidth = proposedBounds.width - bestX.delta;
        snappedX = newX;
      } else if (resizingRight && bestX.edge === 'right') {
        snappedWidth = proposedBounds.width + bestX.delta;
      }
    }
    
    if (bestY) {
      if (resizingTop && bestY.edge === 'top') {
        const newY = proposedBounds.y + bestY.delta;
        snappedHeight = proposedBounds.height - bestY.delta;
        snappedY = newY;
      } else if (resizingBottom && bestY.edge === 'bottom') {
        snappedHeight = proposedBounds.height + bestY.delta;
      }
    }
    
    // Generate guides
    const guides: SnapGuide[] = [];
    const snappedBounds = { x: snappedX, y: snappedY, width: snappedWidth, height: snappedHeight };
    
    if (bestX) {
      guides.push(...this.createGuidesForCandidate(bestX, snappedBounds, 'vertical'));
    }
    if (bestY) {
      guides.push(...this.createGuidesForCandidate(bestY, snappedBounds, 'horizontal'));
    }
    
    this.lastGuides = guides;
    
    return {
      snappedX,
      snappedY,
      snapDeltaX: snappedX - proposedBounds.x,
      snapDeltaY: snappedY - proposedBounds.y,
      didSnapX: bestX !== null,
      didSnapY: bestY !== null,
      guides,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let globalSnappingEngine: SnappingEngine | null = null;

export function getSnappingEngine(): SnappingEngine {
  if (!globalSnappingEngine) {
    globalSnappingEngine = new SnappingEngine();
  }
  return globalSnappingEngine;
}

export function createSnappingEngine(options?: SnappingOptions): SnappingEngine {
  globalSnappingEngine = new SnappingEngine(options);
  return globalSnappingEngine;
}
