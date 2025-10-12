"use client";

import { useMemo } from "react";
import { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types";

export function useDrawable(rawRoots: NodeInput[] | null): {
  drawableNodes: DrawableNode[];
  frameOptions: ReferenceFrame[];
} {
  const drawableNodes = useMemo<DrawableNode[]>(() => {
    if (!rawRoots) return [];
    const out: DrawableNode[] = [];
    const walk = (node: NodeInput, px: number, py: number) => {
      let ax: number | undefined,
        ay: number | undefined,
        aw: number | undefined,
        ah: number | undefined;
      if (node.absoluteBoundingBox) {
        ax = node.absoluteBoundingBox.x;
        ay = node.absoluteBoundingBox.y;
        aw = node.absoluteBoundingBox.width;
        ah = node.absoluteBoundingBox.height;
      } else if (node.x != null && node.y != null && node.width != null && node.height != null) {
        ax = (node.x ?? 0) + px;
        ay = (node.y ?? 0) + py;
        aw = node.width ?? 0;
        ah = node.height ?? 0;
      }
      const text =
        typeof node.textContent === "string" ? node.textContent : typeof node.characters === "string" ? node.characters : undefined;

      if (ax != null && ay != null && aw != null && ah != null && aw > 0 && ah > 0) {
        out.push({
          id: node.id,
          name: node.name ?? node.id,
          type: node.type ?? "NODE",
          x: ax,
          y: ay,
          width: aw,
          height: ah,
          textContent: text ?? null,
          children: []
        });
        const nx = node.absoluteBoundingBox ? 0 : (node.x ?? 0) + px;
        const ny = node.absoluteBoundingBox ? 0 : (node.y ?? 0) + py;
        node.children?.forEach((c) => walk(c, nx, ny));
      } else {
        node.children?.forEach((c) => walk(c, px, py));
      }
    };
    rawRoots.forEach((r) => walk(r, 0, 0));
    return out;
  }, [rawRoots]);

  const frameOptions = useMemo<ReferenceFrame[]>(() => {
    return drawableNodes
      .filter((n) => (n.type || "").toUpperCase() === "FRAME")
      .map((f) => ({
        id: f.id,
        name: f.name,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
  }, [drawableNodes]);

  return { drawableNodes, frameOptions };
}
