/* eslint-disable @typescript-eslint/no-explicit-any */
/* ---- build tree (abs + local) ---- */
/* app/api/convert/core/tree.ts */
import { NodeInput, DrawableNode, Drawable, ReferenceFrame, FillStyle, StrokeStyle } from "./types";
import { rectContains, rectArea } from "./geometry";
import { rectOverlaps } from "./geometry";

function pickFill(n: NodeInput): FillStyle | null {
  if (n.fill) return n.fill!;
  const arr = n.fills || null;
  if (!arr || !arr.length) return null;
  // Prefer IMAGE > GRADIENT > SOLID
  const byType = (t: string) => arr.find(f => String(f.type).toUpperCase().includes(t));
  return byType("IMAGE") || byType("GRADIENT") || byType("SOLID") || null;
}
function pickStroke(n: NodeInput): StrokeStyle | null {
  if (n.stroke) return n.stroke!;
  const arr = n.strokes || null;
  if (!arr || !arr.length) return null;
  return arr[0] || null;
}

export function buildDrawableTree(nodes: NodeInput[], parentAX = 0, parentAY = 0): DrawableNode[] {
  const toAbs = (n: NodeInput, px: number, py: number) => {
    let ax: number | undefined, ay: number | undefined, w: number | undefined, h: number | undefined;
    if (n.absoluteBoundingBox) {
      ax = n.absoluteBoundingBox.x; ay = n.absoluteBoundingBox.y;
      w = n.absoluteBoundingBox.width; h = n.absoluteBoundingBox.height;
    } else if (n.x != null && n.y != null && n.width != null && n.height != null) {
      ax = px + (n.x || 0); ay = py + (n.y || 0); w = n.width || 0; h = n.height || 0;
    }
    return ax != null && ay != null && w != null && h != null ? { ax, ay, w, h } : null;
  };

  const walk = (n: NodeInput, px: number, py: number): DrawableNode[] => {
    const abs = toAbs(n, px, py);
    const textRaw =
      typeof n.textContent === "string" ? n.textContent :
      typeof n.characters === "string" ? n.characters : "";
    if (abs) {
      const { ax, ay, w, h } = abs;
      const lx = ax - px, ly = ay - py;

      const node: DrawableNode = {
        id: n.id, name: n.name || n.id, type: n.type || "NODE",
        ax, ay, x: lx, y: ly, w, h,
        textRaw,
        // Normalize paints so renderer can detect images reliably
        fill: pickFill(n),
        stroke: pickStroke(n),
        corners: n.corners ?? null,
        effects: n.effects ?? null,
        text: n.text ?? null,
        children: [],
      };

      const nextPX = ax, nextPY = ay;
      for (const c of n.children || []) node.children.push(...walk(c, nextPX, nextPY));
      return [node];
    }
    const out: DrawableNode[] = [];
    for (const c of n.children || []) out.push(...walk(c, px, py));
    return out;
  };

  const out: DrawableNode[] = [];
  for (const root of nodes) out.push(...walk(root, parentAX, parentAY));
  return out;
}


/* ---- utilities ---- */
export function findById(nodes: DrawableNode[], id: string): DrawableNode | null { const s = [...nodes]; while (s.length) { const n = s.pop()!; if (n.id === id) return n; for (const c of n.children) s.push(c); } return null; }
export function flattenTreeToDrawables(nodes: DrawableNode[]): Drawable[] { const out: Drawable[] = []; const s: DrawableNode[] = [...nodes]; while (s.length) { const n = s.pop()!; out.push({ id: n.id, name: n.name, type: n.type, x: n.ax, y: n.ay, w: n.w, h: n.h, textRaw: n.textRaw, fill: n.fill, stroke: n.stroke, corners: n.corners, effects: n.effects, text: n.text }); for (const c of n.children) s.push(c); } return out; }
export function flattenTreeToNodes(nodes: DrawableNode[]): DrawableNode[] { const out: DrawableNode[] = []; const s = [...nodes]; while (s.length) { const n = s.pop()!; out.push({ ...n, children: [] }); for (const c of n.children) s.push(c); } return out; }
export function spatialNestUnder(root: DrawableNode, nodes: DrawableNode[]): DrawableNode {
  const byAreaAsc = [...nodes].sort((a, b) => rectArea({ x: a.ax, y: a.ay, w: a.w, h: a.h }) - rectArea({ x: b.ax, y: b.ay, w: b.w, h: b.h }));
  const candidates = [root, ...byAreaAsc]; const childrenMap = new Map<string, DrawableNode[]>(candidates.map(n => [n.id, [] as DrawableNode[]]));
  for (const n of byAreaAsc) { let best: DrawableNode = root; let bestArea = Infinity;
    for (const p of candidates) { if (p === n) continue; const pr = { x: p.ax, y: p.ay, w: p.w, h: p.h }; const nr = { x: n.ax, y: n.ay, w: n.w, h: n.h };
      if (rectContains(pr, nr)) { const a = rectArea(pr); if (a < bestArea && a > rectArea(nr)) { best = p; bestArea = a; } } }
    childrenMap.get(best.id)!.push(n); }
  const attach = (parent: DrawableNode) => { const kids = childrenMap.get(parent.id)!; parent.children = kids; for (const c of kids) { c.x = c.ax - parent.ax; c.y = c.ay - parent.ay; attach(c); } };
  attach(root); return root;
}

/* ---- band grouping ---- */
function groupByYBand(nodes: DrawableNode[], tol = 48) {
  const out: DrawableNode[][] = []; const sorted = [...nodes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  let cur: DrawableNode[] = []; let curMin = 0, curMax = 0;
  for (const n of sorted) { if (cur.length === 0) { cur = [n]; curMin = n.y; curMax = n.y + n.h; out.push(cur); continue; }
    const overlaps = !(n.y > curMax + tol || (n.y + n.h) < curMin - tol);
    if (overlaps) { cur.push(n); curMin = Math.min(curMin, n.y); curMax = Math.max(curMax, n.y + n.h); }
    else { cur = [n]; curMin = n.y; curMax = n.y + n.h; out.push(cur); } }
  return out;
}

/* ---- wrap parent rows into scrollers/carousels ---- */
export function wrapForParent(parent: DrawableNode, frame: ReferenceFrame): boolean {
  if ((parent as any).ux?.scrollX || (parent as any).ux?.wrapped) return false;
  const fx = frame.x, fy = frame.y, fw = frame.width, fh = frame.height; const fRect = { x: fx, y: fy, w: fw, h: fh };

  const offenders = parent.children.filter((c) => {
    if ((c as any).ux?.scrollX) return false; if (String(c.id).startsWith("ux:scroll:")) return false;
    const r = { x: c.ax, y: c.ay, w: c.w, h: c.h }; const overlaps = rectOverlaps(fRect, r); const contained = rectContains(fRect, r);
    const sticksOut = (c.ax < fx) || ((c.ax + c.w) > (fx + fw)); return overlaps && !contained && sticksOut;
  });
  if (!offenders.length) return false;

  const TOL = 48; const seedBands = groupByYBand(offenders, TOL);

  for (const seed of seedBands) {
    const yMin = Math.min(...seed.map(c => c.y)); const yMax = Math.max(...seed.map(c => c.y + c.h)); const bandH = Math.max(1, yMax - yMin);
    const sharesRow = (c: DrawableNode) => {
      if ((c as any).ux?.scrollX) return false; if (String(c.id).startsWith("ux:scroll:")) return false;
      const cyMin = c.y, cyMax = c.y + c.h; const verticalOverlap = !(cyMin > (yMax + TOL) || cyMax < (yMin - TOL));
      const heightReasonable = c.h <= bandH * 1.6; return verticalOverlap && heightReasonable;
    };
    const rowMembers = parent.children.filter(sharesRow); if (!rowMembers.length) continue;

    const wrapper: DrawableNode = { id: `ux:scroll:${parent.id}:${Math.random().toString(36).slice(2,7)}`, name: "Overflow Strip", type: "FRAME",
      ax: parent.ax, ay: parent.ay + yMin, x: 0, y: yMin, w: parent.w, h: bandH, textRaw: null, fill: null, stroke: null, corners: null, effects: null, text: null, children: [], ux: { scrollX: true, padL: 24, padR: 24 } } as any;

    const firstIdx = Math.min(...rowMembers.map(c => parent.children.indexOf(c)).filter(i => i >= 0));
    parent.children = parent.children.filter(c => !rowMembers.includes(c));
    parent.children.splice(Number.isFinite(firstIdx) ? firstIdx : parent.children.length, 0, wrapper);

    const LARGE_W = parent.w * 0.7; const allLarge = rowMembers.every(c => c.w >= LARGE_W); const isCarousel = rowMembers.length >= 3 && allLarge;
    const gap = 24; const padSide = (wrapper as any).ux?.padL ?? 24;
    rowMembers.sort((a, b) => a.ax - b.ax || a.ay - b.ay);

    if (isCarousel) {
      (wrapper as any).ux = { ...(wrapper as any).ux, snap: true, peek: true };
      rowMembers.forEach((c, i) => { c.x = i * parent.w; c.y = 0; c.w = parent.w; c.ax = wrapper.ax + c.x; c.ay = wrapper.ay + c.y; (c as any).ux = { ...((c as any).ux || {}), snapAlign: "start" }; wrapper.children.push(c); });
    } else {
      let cursor = padSide;
      rowMembers.forEach((c, idx) => { c.x = cursor; c.y = 0; c.ax = wrapper.ax + c.x; c.ay = wrapper.ay + c.y; cursor += c.w + gap; if (rowMembers.length >= 3 && idx === 1) { (c as any).ux = { ...((c as any).ux || {}), elevate: true }; } wrapper.children.push(c); });
      const spacer: DrawableNode = { id: `ux:spacer:${wrapper.id}`, name: "spacer", type: "FRAME", ax: wrapper.ax + cursor, ay: wrapper.ay, x: cursor, y: 0, w: (wrapper as any).ux?.padR ?? 24, h: 1, textRaw: null, fill: null, stroke: null, corners: null, effects: null, text: null, children: [] };
      wrapper.children.push(spacer);
    }
  }
  (parent as any).ux = { ...((parent as any).ux || {}), wrapped: true }; return true;
}

/* ---- apply wrappers across subtree ---- */
export function wrapOverflowAsHorizontal(root: DrawableNode, ref: ReferenceFrame) {
  const stack: DrawableNode[] = [root];
  while (stack.length) { const n = stack.pop()!; if (!n || !n.children || n.children.length === 0) continue;
    wrapForParent(n, ref); for (const c of n.children) { if ((c as any).ux?.scrollX) continue; stack.push(c); } }
}
