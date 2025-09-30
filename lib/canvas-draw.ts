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
}

// Nodes
export function drawNodes(
  ctx: CanvasRenderingContext2D,
  drawableNodes: DrawableNode[],
  offset: { x: number; y: number },
  scale: number,
  selectedIds: Set<string>,
  transientOffsets: Map<string, { dx: number; dy: number }>,
  rawRoots: NodeInput[] | null
) {
  const findRaw = (id: string) => rawRoots?.find((n) => n.id === id);

  // simple word-wrap helper
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

    // Fill background ONLY for non-text nodes
    if (!isTextNode) {
      if (rawNode?.fill) {
        if (rawNode.fill.type === "SOLID" && rawNode.fill.color) {
          ctx.fillStyle = rawNode.fill.color;
        } else if (rawNode.fill.type && rawNode.fill.type.startsWith("GRADIENT") && rawNode.fill.stops?.length) {
          const gradient = ctx.createLinearGradient(x, y, x + w, y);
          rawNode.fill.stops.forEach((stop) => gradient.addColorStop(stop.position, stop.color));
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = "rgba(59,130,246,0.08)";
        }
      } else {
        ctx.fillStyle = "rgba(59,130,246,0.08)";
      }
    }

    // Stroke ONLY for non-text nodes
    if (!isTextNode) {
      if (rawNode?.stroke) {
        ctx.strokeStyle = rawNode.stroke.color || "#3b82f6";
        ctx.lineWidth = (rawNode.stroke.weight || 2) * scale;
        if (rawNode.stroke.dashPattern && rawNode.stroke.dashPattern.length) {
          ctx.setLineDash(rawNode.stroke.dashPattern.map((d) => d * scale));
        } else {
          ctx.setLineDash([]);
        }
      } else {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }
    }

    // Shadow (boxShadow string)
    if (rawNode?.effects && rawNode.effects.length > 0) {
      const effect = rawNode.effects.find((e) => e.boxShadow);
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

    // Corners and shape drawing for non-text
    if (!isTextNode) {
      const radius =
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
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    }

    // Reset effects after shape
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // Selection outline
    if (selectedIds.has(n.id)) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#10b981";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    // Debug label
    ctx.fillStyle = "#111";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(n.name ?? n.id, x + 6, y + 6);

    // Fallback text preview (no styled characters)
    if (n.textContent && !rawNode?.text?.characters) {
      const basePx = 20; // 100% zoom size
      const scaledPx = basePx * scale; // 200% -> 40px, 50% -> 10px
      ctx.fillStyle = "#333";
      ctx.font = `${scaledPx}px system - ui, -apple - system, Segoe UI, Roboto, sans - serif`;
      const content = n.textContent.replace(/\s+/g, " ").trim();
      const startX = x + 6;
      const startY = y + 22;
      const maxW = Math.max(0, w - 12);
      const lineH = Math.ceil(scaledPx * 1.3);
      wrapAndDrawText(ctx, content, startX, startY, maxW, lineH);
    }



    // Styled text (TEXT nodes)
    // Styled text (TEXT nodes) with zoom-proportional size
    if (rawNode?.text) {
      const t: any = rawNode.text;
      const fam = t.fontFamily || "system-ui";
      const basePx = t.fontSize || 20; // size at 100% zoom
      const scaledPx = basePx * scale; // proportional with zoom
      ctx.fillStyle = t.color || "#333";
      ctx.font = `${ scaledPx }px ${ fam }`;
      const chars = (t.characters || "").replace(/\s+/g, " ").trim();
      if (chars) {
        const paddingX = 6;
        const startX = x + paddingX;
        const startY = y + 22;
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
