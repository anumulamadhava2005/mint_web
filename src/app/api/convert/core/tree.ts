/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/core/tree.ts */
import { NodeInput, DrawableNode, Drawable, ReferenceFrame } from "./types";
import { rectContains, rectArea } from "./geometry";
/* app/api/convert/core/tree.ts */
import { rectOverlaps } from "./geometry";

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
        textRaw, fill: n.fill ?? null, stroke: n.stroke ?? null,
        corners: n.corners ?? null, effects: n.effects ?? null, text: n.text ?? null,
        children: [],
      };
      const nextPX = ax, nextPY = ay;
      for (const c of n.children || []) node.children.push(...walk(c, nextPX, nextPY));
      return [node];
    } else {
      const out: DrawableNode[] = [];
      for (const c of n.children || []) out.push(...walk(c, px, py));
      return out;
    }
  };

  const out: DrawableNode[] = [];
  for (const root of nodes) out.push(...walk(root, parentAX, parentAY));
  return out;
}

export function findById(nodes: DrawableNode[], id: string): DrawableNode | null {
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    for (const c of n.children) stack.push(c);
  }
  return null;
}

export function flattenTreeToDrawables(nodes: DrawableNode[]): Drawable[] {
  const out: Drawable[] = [];
  const stack: DrawableNode[] = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    out.push({
      id: n.id, name: n.name, type: n.type, x: n.ax, y: n.ay, w: n.w, h: n.h,
      textRaw: n.textRaw, fill: n.fill, stroke: n.stroke, corners: n.corners, effects: n.effects, text: n.text,
    });
    for (const c of n.children) stack.push(c);
  }
  return out;
}

export function flattenTreeToNodes(nodes: DrawableNode[]): DrawableNode[] {
  const out: DrawableNode[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    out.push({ ...n, children: [] });
    for (const c of n.children) stack.push(c);
  }
  return out;
}

export function spatialNestUnder(root: DrawableNode, nodes: DrawableNode[]): DrawableNode {
  const byAreaAsc = [...nodes].sort((a, b) => rectArea({ x: a.ax, y: a.ay, w: a.w, h: a.h }) - rectArea({ x: b.ax, y: b.ay, w: b.w, h: b.h }));
  const candidates = [root, ...byAreaAsc];
  const childrenMap = new Map<string, DrawableNode[]>(candidates.map(n => [n.id, [] as DrawableNode[]]));

  for (const n of byAreaAsc) {
    let best: DrawableNode = root;
    let bestArea = Infinity;
    for (const p of candidates) {
      if (p === n) continue;
      const pr = { x: p.ax, y: p.ay, w: p.w, h: p.h };
      const nr = { x: n.ax, y: n.ay, w: n.w, h: n.h };
      if (rectContains(pr, nr)) {
        const a = rectArea(pr);
        if (a < bestArea && a > rectArea(nr)) { best = p; bestArea = a; }
      }
    }
    childrenMap.get(best.id)!.push(n);
  }

  const attach = (parent: DrawableNode) => {
    const kids = childrenMap.get(parent.id)!;
    parent.children = kids;
    for (const c of kids) { c.x = c.ax - parent.ax; c.y = c.ay - parent.ay; attach(c); }
  };
  attach(root);
  return root;
}

/** Group candidate nodes into vertical bands with tolerance so “rows” are detected. */
// app/api/convert/core/tree.ts

/** Helper: group nodes into vertical bands (rows) with a tolerance. */
function groupByYBand(nodes: DrawableNode[], tol = 48) {
  const out: DrawableNode[][] = [];
  const sorted = [...nodes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  let cur: DrawableNode[] = [];
  let curMin = 0, curMax = 0;

  for (const n of sorted) {
    if (cur.length === 0) {
      cur = [n]; curMin = n.y; curMax = n.y + n.h; out.push(cur);
      continue;
    }
    const overlaps = !(n.y > curMax + tol || (n.y + n.h) < curMin - tol);
    if (overlaps) {
      cur.push(n);
      curMin = Math.min(curMin, n.y);
      curMax = Math.max(curMax, n.y + n.h);
    } else {
      cur = [n]; curMin = n.y; curMax = n.y + n.h; out.push(cur);
    }
  }
  return out;
}

/** Wraps one parent's children that stick outside the reference frame into horizontal strips/carousels.
    Returns true if any wrappers were inserted. Safe to call once per parent due to guards. */
export function wrapForParent(parent: DrawableNode, frame: ReferenceFrame): boolean {
  // Guard: never wrap wrappers or already processed parents
  if (parent.ux?.scrollX || parent.ux?.wrapped) return false;

  const fx = frame.x, fy = frame.y, fw = frame.width, fh = frame.height;
  const fRect = { x: fx, y: fy, w: fw, h: fh };

  // Find offending children that overlap ref but extend beyond left/right, ignoring existing wrappers
  const offenders = parent.children.filter((c) => {
    if (c.ux?.scrollX) return false;
    if (String(c.id).startsWith("ux:scroll:")) return false;
    const r = { x: c.ax, y: c.ay, w: c.w, h: c.h };
    const overlaps = rectOverlaps(fRect, r);
    const contained = rectContains(fRect, r);
    const sticksOut = (c.ax < fx) || ((c.ax + c.w) > (fx + fw));
    return overlaps && !contained && sticksOut;
  });

  if (!offenders.length) return false;

  // Seed vertical bands from offending nodes
  const TOL = 48;
  const seedBands = groupByYBand(offenders, TOL);

  // For each band: include in-frame siblings on the same row, then wrap and normalize
  for (const seed of seedBands) {
    const yMin = Math.min(...seed.map(c => c.y));
    const yMax = Math.max(...seed.map(c => c.y + c.h));
    const bandH = Math.max(1, yMax - yMin);

    const sharesRow = (c: DrawableNode) => {
      if (c.ux?.scrollX) return false;
      if (String(c.id).startsWith("ux:scroll:")) return false;
      const cyMin = c.y, cyMax = c.y + c.h;
      const verticalOverlap = !(cyMin > (yMax + TOL) || cyMax < (yMin - TOL));
      const heightReasonable = c.h <= bandH * 1.6; // skip extremely tall blocks
      return verticalOverlap && heightReasonable;
    };

    const rowMembers = parent.children.filter(sharesRow);
    if (!rowMembers.length) continue;

    // Build wrapper at band position
    const wrapper: DrawableNode = {
      id: `ux:scroll:${parent.id}:${Math.random().toString(36).slice(2,7)}`,
      name: "Overflow Strip",
      type: "FRAME",
      ax: parent.ax,
      ay: parent.ay + yMin,
      x: 0,
      y: yMin,
      w: parent.w,
      h: bandH,
      textRaw: null,
      fill: null,
      stroke: null,
      corners: null,
      effects: null,
      text: null,
      children: [],
      ux: { scrollX: true }, // snap/peek flags may be added below
    };

    // Insert wrapper where the first row member appears to preserve stacking
    const firstIdx = Math.min(...rowMembers.map(c => parent.children.indexOf(c)).filter(i => i >= 0));
    parent.children = parent.children.filter(c => !rowMembers.includes(c));
    parent.children.splice(Number.isFinite(firstIdx) ? firstIdx : parent.children.length, 0, wrapper);

    // Decide between strip and carousel
    const LARGE_W = parent.w * 0.7;
    const allLarge = rowMembers.every(c => c.w >= LARGE_W);
    const isCarousel = rowMembers.length >= 3 && allLarge;

    // Tunable spacing
    const gap = 24;     // space between cards in strips
    const padSide = 24; // side padding for strips
    const peek = 48;    // visual peek for carousels (handled in renderer)

    // Order children left-to-right
    rowMembers.sort((a, b) => a.ax - b.ax || a.ay - b.ay);

    if (isCarousel) {
      wrapper.ux = { ...(wrapper.ux || {}), snap: true, peek: true as any };
      rowMembers.forEach((c, i) => {
        c.x = i * parent.w; // slide position
        c.y = 0;
        c.w = parent.w;     // slide spans frame width
        c.ax = wrapper.ax + c.x;
        c.ay = wrapper.ay + c.y;
        c.ux = { ...(c.ux || {}), snapAlign: "start" };
        wrapper.children.push(c);
      });
    } else {
      // Sequential strip with side padding and gap
      let cursor = padSide;
      rowMembers.forEach((c, idx) => {
        c.x = cursor;
        c.y = 0;
        c.ax = wrapper.ax + c.x;
        c.ay = wrapper.ay + c.y;
        cursor += c.w + gap;
        // Visually elevate the middle card (if any)
        if (rowMembers.length >= 3 && idx === 1) {
          c.ux = { ...(c.ux || {}), elevate: true as any };
        }
        wrapper.children.push(c);
      });

      // Trailing side padding via invisible spacer to extend rail width
      const spacer: DrawableNode = {
        id: `ux:spacer:${wrapper.id}`,
        name: "spacer",
        type: "FRAME",
        ax: wrapper.ax + cursor,
        ay: wrapper.ay,
        x: cursor,
        y: 0,
        w: padSide,
        h: 1,
        textRaw: null,
        fill: null,
        stroke: null,
        corners: null,
        effects: null,
        text: null,
        children: [],
      };
      wrapper.children.push(spacer);
    }
  }

  // Mark processed
  parent.ux = { ...(parent.ux || {}), wrapped: true };
  return true;
}

/** Iterative traversal to avoid deep recursion and to skip wrapper subtrees. */
export function wrapOverflowAsHorizontal(root: DrawableNode, ref: ReferenceFrame) {
  const stack: DrawableNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (!n || !n.children || n.children.length === 0) continue;

    // Try once per parent (idempotent due to .ux.wrapped)
    wrapForParent(n, ref);

    // Visit children except any wrapper containers
    for (const c of n.children) {
      if (c.ux?.scrollX) continue;
      stack.push(c);
    }
  }
}

