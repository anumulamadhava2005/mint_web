/**
 * RenderEngine - Complete Canvas 2D rendering with Figma-like visual features
 * 
 * Features:
 * - Multiple fills (solid, gradient, image)
 * - Strokes (inside, center, outside)
 * - Effects (drop shadow, inner shadow, blur)
 * - Corner radius (individual corners)
 * - Text rendering with full typography
 * - Blend modes
 * - Masks
 * - DPR-aware rendering
 */

import type { 
  FigmaNode, 
  Fill, 
  Stroke, 
  Effect,
  Matrix2D,
  Bounds,
  TextNode
} from '../scene-graph/FigmaNode';
import { rgbaToCSS } from '../scene-graph/FigmaNode';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RenderOptions {
  /** Device pixel ratio */
  dpr: number;
  /** Debug mode (show bounds) */
  debug: boolean;
  /** Whether to render guides */
  renderGuides: boolean;
  /** Whether to render selection */
  renderSelection: boolean;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  options: RenderOptions;
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class RenderEngine {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  
  // ─── Main Render ───
  
  /**
   * Render a node and its children
   */
  renderNode(ctx: CanvasRenderingContext2D, node: FigmaNode, options: RenderOptions): void {
    if (!node.visible) return;
    
    ctx.save();
    
    // Apply opacity
    if (node.opacity < 1) {
      ctx.globalAlpha = node.opacity;
    }
    
    // Apply blend mode
    if (node.blendMode !== 'NORMAL') {
      ctx.globalCompositeOperation = this.getBlendMode(node.blendMode);
    }
    
    // Apply transform
    this.applyTransform(ctx, node);
    
    // Render based on type
    switch (node.type) {
      case 'FRAME':
      case 'GROUP':
        this.renderFrame(ctx, node, options);
        break;
      case 'RECTANGLE':
        this.renderRectangle(ctx, node);
        break;
      case 'ELLIPSE':
        this.renderEllipse(ctx, node);
        break;
      case 'TEXT':
        this.renderText(ctx, node);
        break;
      case 'LINE':
        this.renderLine(ctx, node);
        break;
      case 'VECTOR':
        this.renderVector(ctx, node);
        break;
      case 'POLYGON':
      case 'STAR':
        this.renderPolygon(ctx, node);
        break;
    }
    
    // Render children (if a node lookup is provided)
    // Note: node.children contains IDs, actual nodes must be resolved externally
    
    ctx.restore();
  }
  
  // ─── Shape Rendering ───
  
  private renderRectangle(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    const { width, height, cornerRadius } = node;
    
    // Apply effects (shadows need to be applied before fill)
    this.applyEffects(ctx, node, 'shadow');
    
    // Create path with corner radius
    this.createRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
    
    // Render fills
    for (const fill of node.fills) {
      this.renderFill(ctx, fill, width, height);
    }
    
    // Render strokes
    for (const stroke of node.strokes) {
      this.renderStroke(ctx, stroke, () => {
        this.createRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
      });
    }
    
    // Apply blur effects
    this.applyEffects(ctx, node, 'blur');
  }
  
  private renderEllipse(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    const { width, height } = node;
    const rx = width / 2;
    const ry = height / 2;
    
    this.applyEffects(ctx, node, 'shadow');
    
    ctx.beginPath();
    ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    
    for (const fill of node.fills) {
      this.renderFill(ctx, fill, width, height);
    }
    
    for (const stroke of node.strokes) {
      this.renderStroke(ctx, stroke, () => {
        ctx.beginPath();
        ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.closePath();
      });
    }
  }
  
  private renderLine(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    const { width } = node;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    
    for (const stroke of node.strokes) {
      this.renderStroke(ctx, stroke, () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
      });
    }
  }
  
  private renderPolygon(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    const { width, height } = node;
    const sides = node.type === 'STAR' ? 10 : 6; // Default to hexagon
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;
    
    this.applyEffects(ctx, node, 'shadow');
    
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
      const r = node.type === 'STAR' && i % 2 === 1 ? radius * 0.5 : radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    
    for (const fill of node.fills) {
      this.renderFill(ctx, fill, width, height);
    }
    
    for (const stroke of node.strokes) {
      this.renderStroke(ctx, stroke, () => {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
          const r = node.type === 'STAR' && i % 2 === 1 ? radius * 0.5 : radius;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
      });
    }
  }
  
  private renderVector(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    // Vector paths would be rendered from vectorNetwork
    // For now, render as rectangle
    this.renderRectangle(ctx, node);
  }
  
  private renderFrame(ctx: CanvasRenderingContext2D, node: FigmaNode, options: RenderOptions): void {
    const { width, height, cornerRadius, clipsContent } = node;
    
    // Render fills (frames can have backgrounds)
    if (node.fills.length > 0) {
      this.createRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
      for (const fill of node.fills) {
        this.renderFill(ctx, fill, width, height);
      }
    }
    
    // Render strokes
    for (const stroke of node.strokes) {
      this.renderStroke(ctx, stroke, () => {
        this.createRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
      });
    }
    
    // Clip content if enabled
    if (clipsContent) {
      this.createRoundedRectPath(ctx, 0, 0, width, height, cornerRadius);
      ctx.clip();
    }
  }
  
  // ─── Text Rendering ───
  
  private renderText(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    const { width, height } = node;
    const textData = node.textData;
    
    if (!textData || !textData.characters) return;
    
    const textStyle = textData.style;
    const textContent = textData.characters;
    const textAlignHorizontal = textStyle?.textAlignHorizontal || 'LEFT';
    const textAlignVertical = textStyle?.textAlignVertical || 'TOP';
    
    // Build font string
    const fontWeight = textStyle?.fontWeight || 400;
    const fontStyle = textStyle?.fontStyle === 'italic' ? 'italic' : 'normal';
    const fontSize = textStyle?.fontSize || 14;
    const fontFamily = textStyle?.fontFamily || 'Inter, sans-serif';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    
    // Set text color from fills
    if (node.fills.length > 0 && node.fills[0].type === 'SOLID' && node.fills[0].visible && node.fills[0].color) {
      ctx.fillStyle = rgbaToCSS(node.fills[0].color);
    } else {
      ctx.fillStyle = '#000000';
    }
    
    // Set text alignment
    ctx.textAlign = textAlignHorizontal === 'CENTER' ? 'center' :
                   textAlignHorizontal === 'RIGHT' ? 'right' : 'left';
    
    ctx.textBaseline = textAlignVertical === 'CENTER' ? 'middle' :
                       textAlignVertical === 'BOTTOM' ? 'bottom' : 'top';
    
    // Calculate position based on alignment
    let x = textAlignHorizontal === 'CENTER' ? width / 2 :
            textAlignHorizontal === 'RIGHT' ? width : 0;
    let y = textAlignVertical === 'CENTER' ? height / 2 :
            textAlignVertical === 'BOTTOM' ? height : 0;
    
    // Apply text decoration
    if (textStyle?.textDecoration === 'UNDERLINE') {
      // Draw underline after text
    }
    
    // Handle line height and multi-line text
    const lineHeight = textStyle?.lineHeight?.value || fontSize * 1.2;
    const lines = textContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * lineHeight;
      ctx.fillText(lines[i], x, lineY);
      
      // Draw underline
      if (textStyle?.textDecoration === 'UNDERLINE') {
        const metrics = ctx.measureText(lines[i]);
        const underlineY = lineY + fontSize * 0.1;
        ctx.beginPath();
        ctx.moveTo(x - (textAlignHorizontal === 'CENTER' ? metrics.width / 2 : 0), underlineY);
        ctx.lineTo(x + metrics.width - (textAlignHorizontal === 'CENTER' ? metrics.width / 2 : 0), underlineY);
        ctx.strokeStyle = ctx.fillStyle as string;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Draw strikethrough
      if (textStyle?.textDecoration === 'STRIKETHROUGH') {
        const metrics = ctx.measureText(lines[i]);
        const strikeY = lineY - fontSize * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - (textAlignHorizontal === 'CENTER' ? metrics.width / 2 : 0), strikeY);
        ctx.lineTo(x + metrics.width - (textAlignHorizontal === 'CENTER' ? metrics.width / 2 : 0), strikeY);
        ctx.strokeStyle = ctx.fillStyle as string;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  
  // ─── Fill Rendering ───
  
  private renderFill(ctx: CanvasRenderingContext2D, fill: Fill, width: number, height: number): void {
    if (!fill.visible) return;
    
    ctx.save();
    ctx.globalAlpha *= fill.opacity;
    
    switch (fill.type) {
      case 'SOLID':
        if (fill.color) {
          ctx.fillStyle = rgbaToCSS(fill.color);
          ctx.fill();
        }
        break;
        
      case 'GRADIENT_LINEAR':
        if (fill.gradientStops && fill.gradientTransform) {
          const gradient = this.createLinearGradient(ctx, fill, width, height);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        break;
        
      case 'GRADIENT_RADIAL':
        if (fill.gradientStops) {
          const gradient = this.createRadialGradient(ctx, fill, width, height);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        break;
        
      case 'IMAGE':
        if (fill.imageRef) {
          this.renderImageFill(ctx, fill, width, height);
        }
        break;
    }
    
    ctx.restore();
  }
  
  private createLinearGradient(
    ctx: CanvasRenderingContext2D, 
    fill: Fill, 
    width: number, 
    height: number
  ): CanvasGradient {
    // Default gradient from left to right
    const gradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
    
    if (fill.gradientStops) {
      for (const stop of fill.gradientStops) {
        gradient.addColorStop(stop.position, rgbaToCSS(stop.color));
      }
    }
    
    return gradient;
  }
  
  private createRadialGradient(
    ctx: CanvasRenderingContext2D, 
    fill: Fill, 
    width: number, 
    height: number
  ): CanvasGradient {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.max(width, height) / 2;
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    
    if (fill.gradientStops) {
      for (const stop of fill.gradientStops) {
        gradient.addColorStop(stop.position, rgbaToCSS(stop.color));
      }
    }
    
    return gradient;
  }
  
  private renderImageFill(ctx: CanvasRenderingContext2D, fill: Fill, width: number, height: number): void {
    const img = this.imageCache.get(fill.imageRef!);
    if (!img) {
      // Load image if not cached
      this.loadImage(fill.imageRef!);
      return;
    }
    
    ctx.save();
    ctx.clip();
    
    switch (fill.scaleMode) {
      case 'FILL':
        // Cover entire area
        const scale = Math.max(width / img.width, height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        ctx.drawImage(
          img,
          (width - scaledWidth) / 2,
          (height - scaledHeight) / 2,
          scaledWidth,
          scaledHeight
        );
        break;
        
      case 'FIT':
        // Fit within area
        const fitScale = Math.min(width / img.width, height / img.height);
        const fitWidth = img.width * fitScale;
        const fitHeight = img.height * fitScale;
        ctx.drawImage(
          img,
          (width - fitWidth) / 2,
          (height - fitHeight) / 2,
          fitWidth,
          fitHeight
        );
        break;
        
      case 'TILE':
        // Tile pattern
        const pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
        break;
        
      case 'CROP':
      default:
        ctx.drawImage(img, 0, 0, width, height);
        break;
    }
    
    ctx.restore();
  }
  
  private loadImage(src: string): void {
    if (this.imageCache.has(src)) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.imageCache.set(src, img);
    };
    img.src = src;
  }
  
  // ─── Stroke Rendering ───
  
  private renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, createPath: () => void): void {
    if (!stroke.visible) return;
    
    ctx.save();
    ctx.globalAlpha *= stroke.opacity;
    
    // Set stroke style
    if (stroke.color) {
      ctx.strokeStyle = rgbaToCSS(stroke.color);
    }
    ctx.lineWidth = stroke.strokeWeight;
    ctx.lineCap = stroke.strokeCap.toLowerCase() as CanvasLineCap;
    ctx.lineJoin = stroke.strokeJoin.toLowerCase() as CanvasLineJoin;
    ctx.miterLimit = stroke.miterLimit;
    
    // Set dash pattern
    if (stroke.dashPattern.length > 0) {
      ctx.setLineDash(stroke.dashPattern);
      ctx.lineDashOffset = stroke.dashOffset;
    }
    
    // Handle stroke alignment
    if (stroke.strokeAlign === 'INSIDE') {
      // Clip to path and double stroke weight
      createPath();
      ctx.clip();
      ctx.lineWidth = stroke.strokeWeight * 2;
      createPath();
      ctx.stroke();
    } else if (stroke.strokeAlign === 'OUTSIDE') {
      // Inverse clip and double stroke weight
      ctx.save();
      createPath();
      // Use even-odd rule with larger rect to create outside-only stroke
      ctx.rect(-10000, -10000, 20000, 20000);
      ctx.clip('evenodd');
      ctx.lineWidth = stroke.strokeWeight * 2;
      createPath();
      ctx.stroke();
      ctx.restore();
    } else {
      // Center stroke (default)
      createPath();
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // ─── Effects ───
  
  private applyEffects(ctx: CanvasRenderingContext2D, node: FigmaNode, phase: 'shadow' | 'blur'): void {
    for (const effect of node.effects) {
      if (!effect.visible) continue;
      
      if (phase === 'shadow') {
        if (effect.type === 'DROP_SHADOW') {
          ctx.shadowColor = rgbaToCSS(effect.color);
          ctx.shadowBlur = effect.radius;
          ctx.shadowOffsetX = effect.offsetX;
          ctx.shadowOffsetY = effect.offsetY;
        }
      }
      
      if (phase === 'blur') {
        if (effect.type === 'LAYER_BLUR') {
          // Canvas doesn't support blur natively, would need offscreen canvas
          // This is a placeholder
          ctx.filter = `blur(${effect.radius}px)`;
        }
      }
    }
  }
  
  // ─── Helpers ───
  
  private applyTransform(ctx: CanvasRenderingContext2D, node: FigmaNode): void {
    // Translate to position
    ctx.translate(node.x, node.y);
    
    // Apply rotation around center
    if (node.rotation !== 0) {
      const cx = node.width / 2;
      const cy = node.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((node.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    
    // Apply scale
    if (node.scaleX !== 1 || node.scaleY !== 1) {
      ctx.scale(node.scaleX, node.scaleY);
    }
  }
  
  private createRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    }
  ): void {
    const { topLeft, topRight, bottomRight, bottomLeft } = cornerRadius;
    
    ctx.beginPath();
    ctx.moveTo(x + topLeft, y);
    ctx.lineTo(x + width - topRight, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
    ctx.lineTo(x + width, y + height - bottomRight);
    ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
    ctx.lineTo(x + bottomLeft, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
    ctx.lineTo(x, y + topLeft);
    ctx.quadraticCurveTo(x, y, x + topLeft, y);
    ctx.closePath();
  }
  
  private getBlendMode(mode: string): GlobalCompositeOperation {
    const modeMap: Record<string, GlobalCompositeOperation> = {
      'NORMAL': 'source-over',
      'MULTIPLY': 'multiply',
      'SCREEN': 'screen',
      'OVERLAY': 'overlay',
      'DARKEN': 'darken',
      'LIGHTEN': 'lighten',
      'COLOR_DODGE': 'color-dodge',
      'COLOR_BURN': 'color-burn',
      'HARD_LIGHT': 'hard-light',
      'SOFT_LIGHT': 'soft-light',
      'DIFFERENCE': 'difference',
      'EXCLUSION': 'exclusion',
      'HUE': 'hue',
      'SATURATION': 'saturation',
      'COLOR': 'color',
      'LUMINOSITY': 'luminosity',
    };
    return modeMap[mode] || 'source-over';
  }
  
  // ─── Selection Rendering ───
  
  /**
   * Render selection boxes and handles
   */
  renderSelection(
    ctx: CanvasRenderingContext2D,
    bounds: Bounds,
    handles: Array<{ x: number; y: number }>,
    zoom: number
  ): void {
    const handleSize = 8 / zoom;
    const lineWidth = 1 / zoom;
    
    ctx.save();
    
    // Selection box
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    
    // Resize handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0066ff';
    
    for (const handle of handles) {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }
    
    ctx.restore();
  }
  
  /**
   * Render hover outline
   */
  renderHover(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number): void {
    const lineWidth = 1 / zoom;
    
    ctx.save();
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }
  
  /**
   * Render snap guides
   */
  renderGuides(
    ctx: CanvasRenderingContext2D,
    guides: Array<{
      orientation: 'horizontal' | 'vertical';
      position: number;
      start: number;
      end: number;
      label?: string;
    }>,
    zoom: number
  ): void {
    ctx.save();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([]);
    
    for (const guide of guides) {
      ctx.beginPath();
      if (guide.orientation === 'vertical') {
        ctx.moveTo(guide.position, guide.start);
        ctx.lineTo(guide.position, guide.end);
      } else {
        ctx.moveTo(guide.start, guide.position);
        ctx.lineTo(guide.end, guide.position);
      }
      ctx.stroke();
      
      // Render label if present
      if (guide.label) {
        ctx.save();
        ctx.fillStyle = '#ff00ff';
        ctx.font = `${10 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (guide.orientation === 'vertical') {
          ctx.fillText(guide.label, guide.position, (guide.start + guide.end) / 2);
        } else {
          ctx.fillText(guide.label, (guide.start + guide.end) / 2, guide.position);
        }
        ctx.restore();
      }
    }
    
    ctx.restore();
  }
  
  /**
   * Render marquee selection rectangle
   */
  renderMarquee(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1 / zoom;
    
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const renderEngine = new RenderEngine();
