/**
 * SnapGuidesOverlay - Renders snap guides on the canvas
 */

import React from 'react';
import { SnapGuide, SnapType } from './SnappingEngine';

export interface SnapGuidesOverlayProps {
  /** Snap guides to render */
  guides: SnapGuide[];
  /** Canvas offset in screen coordinates */
  offset: { x: number; y: number };
  /** Canvas scale */
  scale: number;
  /** Custom colors by snap type */
  colors?: Partial<Record<SnapType, string>>;
  /** Line width */
  lineWidth?: number;
  /** Whether to show distance indicators */
  showDistances?: boolean;
}

const DEFAULT_COLORS: Record<SnapType, string> = {
  'grid': '#888888',
  'sibling-edge': '#ff4081',
  'sibling-center': '#7c4dff',
  'frame-edge': '#00bcd4',
  'frame-center': '#4caf50',
};

export function SnapGuidesOverlay({
  guides,
  offset,
  scale,
  colors = {},
  lineWidth = 1,
}: SnapGuidesOverlayProps): JSX.Element | null {
  if (guides.length === 0) return null;
  
  const mergedColors = { ...DEFAULT_COLORS, ...colors };
  
  // Convert world coordinates to screen coordinates
  const worldToScreen = (wx: number, wy: number) => ({
    sx: wx * scale + offset.x,
    sy: wy * scale + offset.y,
  });
  
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Dash pattern for different snap types */}
        <pattern id="snap-dash-grid" patternUnits="userSpaceOnUse" width="8" height="1">
          <line x1="0" y1="0" x2="4" y2="0" stroke={mergedColors.grid} strokeWidth={lineWidth} />
        </pattern>
      </defs>
      
      {guides.map((guide, index) => {
        const color = mergedColors[guide.type];
        const isDashed = guide.type === 'grid';
        
        if (guide.orientation === 'vertical') {
          const { sx } = worldToScreen(guide.position, 0);
          const startY = guide.start * scale + offset.y;
          const endY = guide.end * scale + offset.y;
          
          return (
            <g key={`guide-${index}`}>
              <line
                x1={sx}
                y1={startY}
                x2={sx}
                y2={endY}
                stroke={color}
                strokeWidth={lineWidth}
                strokeDasharray={isDashed ? '4,4' : undefined}
              />
              {/* Small markers at intersection points */}
              <circle cx={sx} cy={startY + 10} r={3} fill={color} />
              <circle cx={sx} cy={endY - 10} r={3} fill={color} />
            </g>
          );
        } else {
          const { sy } = worldToScreen(0, guide.position);
          const startX = guide.start * scale + offset.x;
          const endX = guide.end * scale + offset.x;
          
          return (
            <g key={`guide-${index}`}>
              <line
                x1={startX}
                y1={sy}
                x2={endX}
                y2={sy}
                stroke={color}
                strokeWidth={lineWidth}
                strokeDasharray={isDashed ? '4,4' : undefined}
              />
              {/* Small markers at intersection points */}
              <circle cx={startX + 10} cy={sy} r={3} fill={color} />
              <circle cx={endX - 10} cy={sy} r={3} fill={color} />
            </g>
          );
        }
      })}
    </svg>
  );
}

/**
 * SnapGuidesCanvas - Renders snap guides on a 2D canvas context
 * For use when rendering guides directly on the main canvas
 */
export function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  offset: { x: number; y: number },
  scale: number,
  colors: Partial<Record<SnapType, string>> = {}
): void {
  if (guides.length === 0) return;
  
  const mergedColors = { ...DEFAULT_COLORS, ...colors };
  
  ctx.save();
  ctx.lineWidth = 1;
  
  for (const guide of guides) {
    const color = mergedColors[guide.type];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    
    // Set dash pattern for grid
    if (guide.type === 'grid') {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    
    if (guide.orientation === 'vertical') {
      const sx = guide.position * scale + offset.x;
      const startY = guide.start * scale + offset.y;
      const endY = guide.end * scale + offset.y;
      
      ctx.moveTo(sx, startY);
      ctx.lineTo(sx, endY);
      ctx.stroke();
      
      // Markers
      ctx.beginPath();
      ctx.arc(sx, startY + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, endY - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sy = guide.position * scale + offset.y;
      const startX = guide.start * scale + offset.x;
      const endX = guide.end * scale + offset.x;
      
      ctx.moveTo(startX, sy);
      ctx.lineTo(endX, sy);
      ctx.stroke();
      
      // Markers
      ctx.beginPath();
      ctx.arc(startX + 10, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endX - 10, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}
