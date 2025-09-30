/* app/api/convert/core/tree.ts */
import { NodeInput, DrawableNode, Drawable, ReferenceFrame } from "./types";
import { rectContains, rectArea } from "./geometry";

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
