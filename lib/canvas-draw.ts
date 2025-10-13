/* eslint-disable @typescript-eslint/no-explicit-any */
import { DrawableNode, NodeInput, ReferenceFrame } from "./figma-types";

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
  hoveredId?: string | null
) {
  // Helper to find the raw node by id
  function findRaw(id: string) {
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

    // --- Fill/Background ---
    if (!isTextNode) {
      if (rawNode?.fill) {
        if (rawNode.fill.type === "SOLID" && rawNode.fill.color) {
          ctx.fillStyle = rawNode.fill.color;
        } else if (rawNode.fill.type && rawNode.fill.type.startsWith("GRADIENT") && rawNode.fill.stops?.length) {
          // Use vertical gradient as default
          const gradient = ctx.createLinearGradient(x, y, x, y + h);
          rawNode.fill.stops.forEach((stop: any) => gradient.addColorStop(stop.position, stop.color));
          ctx.fillStyle = gradient;
        } else if (rawNode.fill.type === "IMAGE" && rawNode.fill.imageRef) {
          // Optionally, you can draw an image here if you have it loaded
          ctx.fillStyle = "#fff";
        } else {
          ctx.fillStyle = "#fff";
        }
      } else {
        ctx.fillStyle = "#fff";
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

      if (radius && radius > 0) {
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
      const basePx = t.fontSize || 20; // size at 100% zoom
      const scaledPx = basePx * scale; // proportional with zoom
      ctx.fillStyle = t.color || "#333";
      ctx.font = `${scaledPx}px ${fam}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const chars = (t.characters || "").replace(/\s+/g, " ").trim();
      if (chars) {
        const paddingX = 0;
        const startX = x + paddingX;
        const startY = y;
        const maxW = Math.max(0, w - paddingX * 2);
        const lineH = Math.ceil(scaledPx * 1.3);
        wrapAndDrawText(ctx, chars, startX, startY, maxW, lineH);
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
