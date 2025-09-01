// lib/figma.ts
export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
};

export type FigmaFile = {
  name: string;
  document: FigmaNode;
};

export function parseFileKey(input: string): string | null {
  // supports both .../design/{key}/... and .../file/{key}/...
  try {
    // if they pasted just the key, return it
    if (/^[a-zA-Z0-9]{10,}$/.test(input)) return input.trim();

    const url = new URL(input);
    const m = url.pathname.match(/\/(design|file)\/([^/]+)/i);
    return m?.[2] ?? null;
  } catch {
    return null;
  }
}

export function walkFrames(node: FigmaNode, page: string, acc: {id:string; name:string; page:string}[]) {
  if (node.type === "FRAME") {
    acc.push({ id: node.id, name: node.name, page });
  }
  if (node.children) {
    for (const c of node.children) {
      walkFrames(c, page, acc);
    }
  }
}

export function collectFrameIds(file: FigmaFile) {
  const frames: {id:string; name:string; page:string}[] = [];
  for (const page of file.document.children || []) {
    walkFrames(page, page.name, frames);
  }
  return frames;
}
