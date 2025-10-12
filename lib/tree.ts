import { NodeInput } from "./figma-types";

export function findNodeById(roots: NodeInput[], id: string): NodeInput | null {
  const stack: NodeInput[] = [...roots];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}

export function updateNodeById(roots: NodeInput[], id: string, mut: (n: NodeInput) => NodeInput): NodeInput[] {
  const cloneNode = (node: NodeInput): NodeInput => {
    // shallow clone own fields
    const base: NodeInput = { ...node, children: node.children?.map(cloneNode) ?? undefined };
    return base;
  };

  const rec = (node: NodeInput): NodeInput => {
    if (node.id === id) {
      // apply mutation on a cloned node; ensure children preserved unless mut changes them intentionally
      const cloned = { ...node, children: node.children ? [...node.children] : undefined };
      const next = mut(cloned) || cloned;
      // Ensure children defaults aren’t lost
      if (cloned.children && !next.children) next.children = cloned.children;
      return next;
    }
    if (node.children && node.children.length) {
      const nextChildren = node.children.map(rec);
      if (nextChildren !== node.children) {
        return { ...node, children: nextChildren };
      }
    }
    return node;
  };

  return roots.map(rec);
}

