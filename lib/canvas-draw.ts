/* eslint-disable @typescript-eslint/no-explicit-any */
import { DrawableNode, NodeInput, ReferenceFrame } from "./figma-types";

/**
 * Canvas 2D Drawing Module
 * 
 * Note: This module supports visual properties (backgroundColor, opacity, rotation)
 * but does NOT support flexbox layout properties (padding, gap, justifyContent, alignItems)
 * as Canvas 2D API doesn't have built-in flexbox support. For full layout property support,
 * use the DOM renderers (RenderTree.tsx or CanvasRenderer.tsx).
 */

// Grid
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: { x: number; y: number },
  scale: number,
  major: number,
  minor: number
) {
  const worldMinX = -offset.x / scale;
  const worldMinY = -offset.y / scale;
  const worldMaxX = (width - offset.x) / scale;
  const worldMaxY = (height - offset.y) / scale;

  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const startMinorX = Math.floor(worldMinX / minor) * minor;
  const startMinorY = Math.floor(worldMinY / minor) * minor;
  for (let x = startMinorX; x <= worldMaxX; x += minor) {
    const sx = offset.x + x * scale;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }
  for (let y = startMinorY; y <= worldMaxY; y += minor) {
    const sy = offset.y + y * scale;
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  const startMajorX = Math.floor(worldMinX / major) * major;
  const startMajorY = Math.floor(worldMinY / major) * major;
  for (let x = startMajorX; x <= worldMaxX; x += major) {
    const sx = offset.x + x * scale;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }
  for (let y = startMajorY; y <= worldMaxY; y += major) {
    const sy = offset.y + y * scale;
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }
  ctx.stroke();

  // Center lines in light purple
  ctx.strokeStyle = "rgba(147, 51, 234, 0.3)"; // light purple
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  // Vertical center line (x = 0)
  if (worldMinX <= 0 && worldMaxX >= 0) {
    const sx = offset.x + 0 * scale;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }
  
  // Horizontal center line (y = 0)
  if (worldMinY <= 0 && worldMaxY >= 0) {
    const sy = offset.y + 0 * scale;
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }
  
  ctx.stroke();
}

// Nodes
export function drawNodes(
  ctx: CanvasRenderingContext2D,
  drawableNodes: DrawableNode[],
  offset: { x: number; y: number },
  scale: number,
  selectedIds: Set<string>,
  transientOffsets: Map<string, { dx: number; dy: number }>,
  rawRoots: NodeInput[] | null,
  hoveredId?: string | null,
  images?: Record<string, HTMLImageElement | string>
) {
  // Helper to find the raw node by id
  function findRaw(id: string): NodeInput | undefined {
    if (!rawRoots) return undefined;
    const stack = [...rawRoots];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.id === id) return node;
      if (node.children) stack.push(...node.children);
    }
    return undefined;
  }

  // Helper to get all child IDs of a node
  function getChildIds(nodeId: string): Set<string> {
    const childIds = new Set<string>();
    const rawNode = findRaw(nodeId);
    if (!rawNode || !rawNode.children) return childIds;
    
    const stack = [...rawNode.children];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      childIds.add(node.id);
      if (node.children) stack.push(...node.children);
    }
    return childIds;
  }

  // Helper to check if a node has children
  function hasChildren(nodeId: string): boolean {
    const rawNode = findRaw(nodeId);
    return !!(rawNode && rawNode.children && rawNode.children.length > 0);
  }

  // Helper to get data array from infinite scroll node
  function getInfiniteScrollData(rawNode: NodeInput | undefined): unknown[] {
    if (!rawNode?.dataSource?.infiniteScroll || !rawNode.dataSource.lastResponse) {
      return [];
    }
    const response = rawNode.dataSource.lastResponse;
    if (Array.isArray(response)) {
      return response;
    }
    // If response is an object with an array property, find it
    if (typeof response === 'object' && response !== null) {
      for (const key of Object.keys(response)) {
        if (Array.isArray((response as Record<string, unknown>)[key])) {
          return (response as Record<string, unknown>)[key] as unknown[];
        }
      }
    }
    return [];
  }

  // Helper to get bound value for a data binding
  function getBoundValue(dataBinding: { field: string; parentId: string; type: string } | null | undefined, dataItem: Record<string, unknown>): string | null {
    if (!dataBinding || !dataItem) return null;
    const value = dataItem[dataBinding.field];
    return value !== undefined ? String(value) : null;
  }

  // Simple word-wrap helper
  function wrapAndDrawText(
    ctx2: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number
  ) {
    const words = text.split(/\s+/);
    let line = "";
    let cy = y;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const wpx = ctx2.measureText(test).width;
      if (wpx > maxW && line) {
        ctx2.fillText(line, x, cy);
        line = w;
        cy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx2.fillText(line, x, cy);
    return cy + lineH; // bottom Y of the block
  }

  // Build a map of nodes with infinite scroll and their expanded children
  const infiniteScrollExpansions = new Map<string, { dataItems: unknown[], itemHeight: number, direction: 'vertical' | 'horizontal' }>();
  
  // Find nodes with infinite scroll enabled
  for (const n of drawableNodes) {
    const rawNode = findRaw(n.id);
    if (rawNode?.dataSource?.infiniteScroll) {
      const dataItems = getInfiniteScrollData(rawNode);
      if (dataItems.length > 0) {
        // Calculate item height based on children bounds + spacing
        const spacing = rawNode.dataSource.itemSpacing || 10;
        let itemHeight = n.height;
        let itemWidth = n.width;
        if (rawNode.children && rawNode.children.length > 0) {
          // Find the bounding box of children
          let maxChildBottom = 0;
          let maxChildRight = 0;
          for (const child of rawNode.children) {
            const childBottom = (child.y || 0) + (child.height || 0);
            const childRight = (child.x || 0) + (child.width || 0);
            if (childBottom > maxChildBottom) maxChildBottom = childBottom;
            if (childRight > maxChildRight) maxChildRight = childRight;
          }
          itemHeight = maxChildBottom + spacing;
          itemWidth = maxChildRight + spacing;
        }
        infiniteScrollExpansions.set(n.id, {
          dataItems,
          itemHeight: rawNode.dataSource.direction === 'horizontal' ? itemWidth : itemHeight,
          direction: rawNode.dataSource.direction || 'vertical'
        });
      }
    }
  }

  drawableNodes.forEach((n) => {
    let wx = n.x;
    let wy = n.y;
    const off = transientOffsets.get(n.id);
    if (off) {
      wx += off.dx;
      wy += off.dy;
    }

    const x = offset.x + wx * scale;
    const y = offset.y + wy * scale;
    const w = Math.max(0.5, n.width * scale);
    const h = Math.max(0.5, n.height * scale);
    const rawNode = findRaw(n.id);
    const isTextNode = (n.type || "").toUpperCase() === "TEXT";

    // Save context for transformations
    ctx.save();

    // Apply rotation if present
    if (rawNode?.rotation != null && rawNode.rotation !== 0) {
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rawNode.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Apply node-level opacity
    if (rawNode?.opacity != null && rawNode.opacity < 1) {
      ctx.globalAlpha = rawNode.opacity;
    }

    // Apply blend mode
    if (rawNode?.blendMode && rawNode.blendMode !== "PASS_THROUGH" && rawNode.blendMode !== "NORMAL") {
      const blendModeMap: Record<string, GlobalCompositeOperation> = {
        MULTIPLY: "multiply",
        SCREEN: "screen",
        OVERLAY: "overlay",
        DARKEN: "darken",
        LIGHTEN: "lighten",
        COLOR_DODGE: "color-dodge",
        COLOR_BURN: "color-burn",
        HARD_LIGHT: "hard-light",
        SOFT_LIGHT: "soft-light",
        DIFFERENCE: "difference",
        EXCLUSION: "exclusion",
        HUE: "hue",
        SATURATION: "saturation",
        COLOR: "color",
        LUMINOSITY: "luminosity",
      };
      const compositeOp = blendModeMap[rawNode.blendMode];
      if (compositeOp) {
        ctx.globalCompositeOperation = compositeOp;
      }
    }

  const isEllipse = (n.type || '').toUpperCase() === 'ELLIPSE';
  // --- Fill/Background ---
  if (!isTextNode) {
      // Check for backgroundColor property first
      if ((rawNode as any)?.backgroundColor) {
        ctx.fillStyle = (rawNode as any).backgroundColor;
      } else if (rawNode?.fill) {
        if (rawNode.fill.type === "SOLID" && rawNode.fill.color) {
          ctx.fillStyle = rawNode.fill.color;
          // Apply opacity if specified
          if (rawNode.fill.opacity != null && rawNode.fill.opacity < 1) {
            ctx.globalAlpha = rawNode.fill.opacity;
          }
        } else if (rawNode.fill.type && rawNode.fill.type.startsWith("GRADIENT") && rawNode.fill.stops?.length) {
          // Support both linear and radial gradients
          let gradient;
          if (rawNode.fill.type.toUpperCase().includes("RADIAL")) {
            const centerX = x + w / 2;
            const centerY = y + h / 2;
            const radius = Math.max(w, h) / 2;
            gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          } else {
            // Use vertical gradient as default
            gradient = ctx.createLinearGradient(x, y, x, y + h);
          }
          rawNode.fill.stops.forEach((stop: any) => gradient.addColorStop(stop.position, stop.color));
          ctx.fillStyle = gradient;
          // Apply gradient opacity
          if (rawNode.fill.opacity != null && rawNode.fill.opacity < 1) {
            ctx.globalAlpha = rawNode.fill.opacity;
          }
        } else if (rawNode.fill.type === "IMAGE" && rawNode.fill.imageRef) {
          // Will be handled in image rendering section
          ctx.fillStyle = "transparent";
        } else {
          ctx.fillStyle = "transparent";
        }
      } else {
        ctx.fillStyle = "transparent";
      }
    }

  // --- Border/Stroke ---
  if (!isTextNode) {
    if (rawNode?.stroke) {
      ctx.strokeStyle = rawNode.stroke.color || "#3b82f6";
      ctx.lineWidth = (rawNode.stroke.weight || 2) * scale;
      if (rawNode.stroke.dashPattern && rawNode.stroke.dashPattern.length) {
        ctx.setLineDash(rawNode.stroke.dashPattern.map((d: any) => d * scale));
      } else {
        ctx.setLineDash([]);
      }
    } else {
      // If node has no stroke, don't draw a border here. Selection will be highlighted separately.
      ctx.setLineDash([]);
    }
  }

    // --- Shadow/Effects ---
    if (rawNode?.effects && rawNode.effects.length > 0) {
      const effect = rawNode.effects.find((e: any) => e.boxShadow);
      if (effect?.boxShadow) {
        const m = effect.boxShadow.match(
          /(inset\s+)?(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+(\d+(?:\.\d+)?)px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+.*)$/
        );
        if (m) {
          // 2=ox, 3=oy, 4=blur, 6=color
          const ox = parseFloat(m[3]) * scale;
          const oy = parseFloat(m[4]) * scale;
          const blur = parseFloat(m[5]) * scale;
          const color = m[6] || "rgba(0,0,0,0.2)";
          ctx.shadowOffsetX = ox;
          ctx.shadowOffsetY = oy;
          ctx.shadowBlur = blur;
          ctx.shadowColor = color;
        }
      }
    }

    // --- Corners/Radius ---
    let radius = 0;
    if (!isTextNode) {
      radius =
        rawNode?.corners?.uniform ??
        rawNode?.corners?.topLeft ??
        rawNode?.corners?.topRight ??
        rawNode?.corners?.bottomRight ??
        rawNode?.corners?.bottomLeft ??
        0;

      // Apply clipping if clipsContent is true
      if (rawNode?.clipsContent) {
        ctx.save();
        ctx.beginPath();
        if (isEllipse) {
          ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
        } else if (radius && radius > 0) {
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x, y, w, h, radius * scale);
          } else {
            const r = Math.min(radius * scale, Math.min(w, h) / 2);
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
          }
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();
      }

      if (isEllipse) {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
        ctx.fill();
        if (rawNode?.stroke) ctx.stroke();
      } else if (radius && radius > 0) {
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(x, y, w, h, radius * scale);
        } else {
          const r = Math.min(radius * scale, Math.min(w, h) / 2);
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        }
        ctx.fill();
        if (rawNode?.stroke) {
          ctx.stroke();
        } else {
          // No default outline - remove black borders
        }
      } else {
        ctx.fillRect(x, y, w, h);
        if (rawNode?.stroke) {
          ctx.strokeRect(x, y, w, h);
        } else {
          // No default outline - remove black borders
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        }
      }
    }

    // --- Reset effects after shape ---
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1; // Reset opacity
    ctx.globalCompositeOperation = "source-over"; // Reset blend mode

    // Restore clipping context if it was applied
    if (rawNode?.clipsContent) {
      ctx.restore();
    }

    // Restore context (rotation, etc.)
    ctx.restore();

    // --- Image rendering ---
    if (images && (rawNode as any)?.fill?.imageRef && typeof (rawNode as any).fill.imageRef === 'string' && (rawNode as any).fill.imageRef.length > 0) {
      const imageKey = (rawNode as any).fill.imageRef;
      const imageData = images[imageKey];
      
      if (imageData instanceof HTMLImageElement && imageData.complete) {
        try {
          // Save context state for clipping
          ctx.save();
          
          // Draw the image to fill the node bounds
          ctx.drawImage(imageData, x, y, w, h);
          
          ctx.restore();
        } catch (e) {
          console.warn('Failed to draw image:', e);
        }
      }
    }

    // --- Selection and Hover outlines ---
    if (selectedIds.has(n.id)) {
      ctx.lineWidth = 1.5; // Thinner border for cleaner look
      ctx.strokeStyle = "#60a5fa"; // light blue for selection
      ctx.setLineDash([]); // solid outline
      ctx.strokeRect(x, y, w, h);
    } else if (hoveredId) {
      const hoveredChildIds = getChildIds(hoveredId);
      
      if (hoveredId === n.id) {
        // This is the hovered node itself
        const isParent = hasChildren(n.id);
        
        if (isParent) {
          // Parent nodes get solid lines with thinner border
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#1a72ffff"; // blue for parent
          ctx.setLineDash([]);
        } else {
          // Child nodes get dotted lines with lighter color
          ctx.lineWidth = 0.5;
          ctx.strokeStyle = "#70b1ffff"; // lighter blue for children
          ctx.setLineDash([4, 4]);
        }
        
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]); // reset
      } else if (hoveredChildIds.has(n.id)) {
        // This is a child of the hovered node
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "#60a5fa"; // lighter blue for children
        ctx.setLineDash([4, 4]); // dotted lines for children
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]); // reset
      }
    }

    // --- Text rendering ---
    if (isTextNode && rawNode?.text) {
      const t: any = rawNode.text;
      const fam = t.fontFamily || "system-ui";
      const basePx = t.fontSize || 20;
      const scaledPx = basePx * scale;
      
      // Apply text styling
      ctx.fillStyle = t.color || "#333";
      
      // Font style with weight and style
      const fontStyle = t.fontStyle || "";
      const isBold = fontStyle.toLowerCase().includes("bold");
      const isItalic = fontStyle.toLowerCase().includes("italic");
      
      const weight = isBold ? "bold" : "normal";
      const style = isItalic ? "italic" : "normal";
      ctx.font = `${style} ${weight} ${scaledPx}px ${fam}`;
      
      // Text alignment
      const textAlignH = t.textAlignHorizontal || "LEFT";
      if (textAlignH === "CENTER") {
        ctx.textAlign = "center";
      } else if (textAlignH === "RIGHT") {
        ctx.textAlign = "right";
      } else {
        ctx.textAlign = "left";
      }
      
      ctx.textBaseline = "top";
      
      const chars = (t.characters || "").replace(/\\s+/g, " ").trim();
      if (chars) {
        const paddingX = 0;
        let startX = x + paddingX;
        let startY = y;
        const maxW = Math.max(0, w - paddingX * 2);
        
        // Adjust X position based on alignment
        if (textAlignH === "CENTER") {
          startX = x + w / 2;
        } else if (textAlignH === "RIGHT") {
          startX = x + w - paddingX;
        }
        
        // Apply vertical alignment
        const textAlignV = t.textAlignVertical || "TOP";
        const lineHeight = t.lineHeight || scaledPx * 1.2;
        const lineH = typeof lineHeight === 'number' 
          ? (lineHeight > 3 ? lineHeight * scale : scaledPx * lineHeight)
          : Math.ceil(scaledPx * 1.2);
        
        // Calculate text height for vertical alignment
        const lines = chars.split("\\n");
        const textHeight = lines.length * lineH;
        
        if (textAlignV === "CENTER") {
          startY = y + (h - textHeight) / 2;
        } else if (textAlignV === "BOTTOM") {
          startY = y + h - textHeight;
        }
        
        // Apply paragraph indent if present
        const indent = t.paragraphIndent ? t.paragraphIndent * scale : 0;
        if (indent > 0) {
          startX += indent;
        }
        
        wrapAndDrawText(ctx, chars, startX, startY, maxW, lineH);
      }
    }

    // --- Infinite Scroll Rendering ---
    // After rendering the container, render repeated children for each data item
    const expansion = infiniteScrollExpansions.get(n.id);
    if (expansion && expansion.dataItems.length > 0) {
      const rawNode = findRaw(n.id);
      if (rawNode?.children && rawNode.children.length > 0) {
        const { dataItems, itemHeight, direction } = expansion;
        const itemsToRender = dataItems; // Render all items (can limit if needed)
        
        // Draw a visual indicator for infinite scroll
        ctx.save();
        ctx.strokeStyle = "#8b5cf6"; // purple indicator
        ctx.lineWidth = 2 * scale;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h + (itemsToRender.length - 1) * itemHeight * scale);
        ctx.setLineDash([]);
        
        // Draw badge
        ctx.fillStyle = "#8b5cf6";
        ctx.font = `${11 * scale}px system-ui`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`Infinite Scroll (${itemsToRender.length}/${dataItems.length} items)`, x + 4, y - 16 * scale);
        ctx.restore();
        
        // Render children for each data item
        for (let dataIdx = 0; dataIdx < itemsToRender.length; dataIdx++) {
          const dataItem = itemsToRender[dataIdx] as Record<string, unknown>;
          
          // Calculate offset for this data item
          const offsetY = direction === 'vertical' ? dataIdx * itemHeight : 0;
          const offsetX = direction === 'horizontal' ? dataIdx * itemHeight : 0;
          
          // Render each child with the data binding
          for (const child of rawNode.children) {
            const childX = x + ((child.x || 0) + offsetX) * scale;
            const childY = y + ((child.y || 0) + offsetY) * scale;
            const childW = (child.width || 50) * scale;
            const childH = (child.height || 20) * scale;
            
            const childType = (child.type || '').toUpperCase();
            const isChildText = childType === 'TEXT';
            
            ctx.save();
            
            // Apply child rotation if present
            if (child.rotation != null && child.rotation !== 0) {
              const centerX = childX + childW / 2;
              const centerY = childY + childH / 2;
              ctx.translate(centerX, centerY);
              ctx.rotate((child.rotation * Math.PI) / 180);
              ctx.translate(-centerX, -centerY);
            }
            
            // Draw child background (for non-text nodes)
            if (!isChildText) {
              if ((child as any).backgroundColor) {
                ctx.fillStyle = (child as any).backgroundColor;
              } else if (child.fill?.type === 'SOLID' && child.fill.color) {
                ctx.fillStyle = child.fill.color;
              } else {
                ctx.fillStyle = 'transparent';
              }
              
              const childRadius = child.corners?.uniform || 0;
              if (childRadius > 0) {
                ctx.beginPath();
                if ((ctx as any).roundRect) {
                  (ctx as any).roundRect(childX, childY, childW, childH, childRadius * scale);
                }
                ctx.fill();
                if (child.stroke) {
                  ctx.strokeStyle = child.stroke.color || '#3b82f6';
                  ctx.lineWidth = (child.stroke.weight || 1) * scale;
                  ctx.stroke();
                }
              } else {
                ctx.fillRect(childX, childY, childW, childH);
                if (child.stroke) {
                  ctx.strokeStyle = child.stroke.color || '#3b82f6';
                  ctx.lineWidth = (child.stroke.weight || 1) * scale;
                  ctx.strokeRect(childX, childY, childW, childH);
                }
              }
            }
            
            // Draw child text with data binding
            if (isChildText && child.text) {
              const t = child.text;
              const fam = t.fontFamily || 'system-ui';
              const basePx = t.fontSize || 14;
              const scaledPx = basePx * scale;
              
              ctx.fillStyle = t.color || '#333';
              const fontStyle = t.fontStyle || '';
              const isBold = fontStyle.toLowerCase().includes('bold');
              const isItalic = fontStyle.toLowerCase().includes('italic');
              const weight = isBold ? 'bold' : 'normal';
              const style = isItalic ? 'italic' : 'normal';
              ctx.font = `${style} ${weight} ${scaledPx}px ${fam}`;
              
              const textAlignH = t.textAlignHorizontal || 'LEFT';
              ctx.textAlign = textAlignH === 'CENTER' ? 'center' : textAlignH === 'RIGHT' ? 'right' : 'left';
              ctx.textBaseline = 'top';
              
              // Get text content - use bound value or original text
              let textContent = t.characters || '';
              if (child.dataBinding?.field) {
                const boundValue = getBoundValue(child.dataBinding, dataItem);
                if (boundValue !== null) {
                  textContent = boundValue;
                }
              }
              
              let textX = childX;
              if (textAlignH === 'CENTER') {
                textX = childX + childW / 2;
              } else if (textAlignH === 'RIGHT') {
                textX = childX + childW;
              }
              
              const lineH = scaledPx * 1.2;
              wrapAndDrawText(ctx, textContent, textX, childY, childW, lineH);
            }
            
            ctx.restore();
          }
        }
      }
    }
  });
}

// Reference frame overlay (Figma-like outline)
export function drawReferenceFrameOverlay(
  octx: CanvasRenderingContext2D,
  selectedFrame: ReferenceFrame,
  offset: { x: number; y: number },
  scale: number
) {
  const fx = offset.x + selectedFrame.x * scale;
  const fy = offset.y + selectedFrame.y * scale;
  const fw = selectedFrame.width * scale;
  const fh = selectedFrame.height * scale;

  octx.save();
  octx.strokeStyle = "#18A0FB";
  octx.lineWidth = 2; // screen-space constant
  if ((octx as any).roundRect) {
    (octx as any).beginPath();
    (octx as any).roundRect(fx, fy, fw, fh, Math.min(6, Math.min(fw, fh) / 2));
    octx.stroke();
  } else {
    octx.strokeRect(fx, fy, fw, fh);
  }
  octx.restore();

  // Badge
  const badgeH = 18;
  const pad = 6;
  const text = "Reference frame";
  octx.save();
  octx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const tw = octx.measureText(text).width;
  const badgeW = Math.ceil(tw + pad * 2);
  octx.fillStyle = "rgba(24,160,251,0.12)";
  octx.strokeStyle = "#18A0FB";
  octx.lineWidth = 1;
  octx.fillRect(fx, fy - badgeH - 6, badgeW, badgeH);
  octx.strokeRect(fx, fy - badgeH - 6, badgeW, badgeH);
  octx.fillStyle = "#0B6DAE";
  octx.textBaseline = "middle";
  octx.fillText(text, fx + pad, fy - badgeH / 2 - 6);
  octx.restore();
}
