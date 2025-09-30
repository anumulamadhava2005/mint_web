/* eslint-disable @typescript-eslint/no-explicit-any */
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

/* ---------- Types ---------- */
type FillStyle = {
  type: string;
  color?: string;
  stops?: Array<{ position: number; color: string }>;
  imageRef?: string | null;
};
type StrokeStyle = {
  color?: string | null;
  weight?: number | null;
  align?: "INSIDE" | "CENTER" | "OUTSIDE" | null;
  dashPattern?: number[] | null;
};
type Corners = {
  uniform?: number | null;
  topLeft?: number | null;
  topRight?: number | null;
  bottomRight?: number | null;
  bottomLeft?: number | null;
};
type EffectStyle = { type: string; boxShadow?: string };
type TextStyle = {
  fontSize?: number | null;
  fontFamily?: string | null;
  fontStyle?: string | null;
  fontWeight?: number | string | null;
  lineHeight?: any;
  letterSpacing?: any;
  textDecoration?: string | null;
  textCase?: string | null;
  color?: string | null;
  characters?: string | null;
};
type NodeInput = {
  id: string;
  name: string;
  type: string;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  children?: NodeInput[];
  characters?: string | null;
  textContent?: string | null;
  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;
  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
};
type Drawable = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  textRaw?: string | null;
  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;
  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
};
type DrawableNode = {
  id: string;
  name: string;
  type: string;
  // absolute coords (page space)
  ax: number;
  ay: number;
  // local coords (relative to parent)
  x: number;
  y: number;
  w: number;
  h: number;
  textRaw?: string | null;
  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;
  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
  children: DrawableNode[];
};
type ReferenceFrame = { id: string; x: number; y: number; width: number; height: number };
type Payload = { target: string; fileName: string; nodes: NodeInput[]; referenceFrame?: ReferenceFrame | null };

/* ---------- API ---------- */
export async function POST(req: NextRequest) {
  try {
    const body: Payload = await req.json();
    const target = (body.target || "react").toLowerCase().trim();
    const fileName = toProjectName(body.fileName || "figma-project");
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const ref = body.referenceFrame ?? null;

    // Build a nested tree with local (parent-relative) x/y and absolute ax/ay for pruning/debug
    // Seed the top-level parent origin with the reference frame origin if provided (so top roots are local to it)
    const tree = buildDrawableTree(nodes, ref ? ref.x : 0, ref ? ref.y : 0);
    // In POST(), after building the tree:
    // NEW: ref-aware roots selection that supports “viewport” fallback + spatial nesting
    let roots: DrawableNode[];
    if (ref) {
      const refNode = findById(tree, ref.id);
      if (refNode && refNode.children.length > 0) {
        // The ref node is present with descendants: use it directly
        roots = [refNode];
      } else {
        // Viewport fallback: synthesize a root and spatially nest all nodes inside the ref rect
        const syntheticRoot = makeSyntheticRootFromRef(ref);
        const all = flattenTreeToNodes(tree); // preserves ax/ay/w/h and styles
        const inside = all.filter(n => rectContains({ x: ref.x, y: ref.y, w: ref.width, h: ref.height }, { x: n.ax, y: n.ay, w: n.w, h: n.h }));
        roots = [spatialNestUnder(syntheticRoot, inside)];
      }
    } else {
      roots = tree;
    }

    // Then proceed with assets using a flat projection of roots
    const flatForAssets = flattenTreeToDrawables(roots);
    const { imageManifest, imageBlobs, skipped } = await collectAndDownloadImages(flatForAssets);

    const zip = new JSZip();
    switch (target) {
      case "nextjs":
        buildNext(zip, fileName, roots, ref, imageManifest, imageBlobs);
        break;
      case "react":
        buildReactVite(zip, fileName, roots, ref, imageManifest, imageBlobs);
        break;
      case "react-native":
      case "reactnative":
        buildReactNative(zip, fileName, flatForAssets, ref);
        break;
      case "vue":
        buildVue(zip, fileName, roots, ref);
        break;
      case "svelte":
        buildSvelte(zip, fileName, roots, ref);
        break;
      case "flutter":
        buildFlutter(zip, fileName, flatForAssets, ref);
        break;
      default:
        return new NextResponse(`Unsupported target: ${target}`, { status: 400 });
    }

    // Global reports to help debugging images
    const report =
      imageManifest.size > 0
        ? Array.from(imageManifest.entries())
          .map(([u, p]) => `${p} <= ${u}`)
          .join("\n")
        : "no images";
    zip.file("IMAGES.txt", report);
    if (skipped.length) {
      zip.file(
        "SKIPPED_IMAGES.txt",
        skipped.map((s) => `${s.refUrl} :: ${s.reason}`).join("\n")
      );
    }

    const content = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}-${target}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    return new NextResponse(msg || "Failed to convert", { status: 500 });
  }
}

/* ---------- Core utilities ---------- */
function toProjectName(name: string) {
  const out =
    name
      .toLowerCase()
      .replace(/[^a-z0-9\-_\s]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "figma-project";
  return out;
}

/* ---------- Tree builder (nested, parent-relative) ---------- */
function buildDrawableTree(nodes: NodeInput[], parentAX = 0, parentAY = 0): DrawableNode[] {
  const toAbs = (n: NodeInput, px: number, py: number) => {
    let ax: number | undefined,
      ay: number | undefined,
      w: number | undefined,
      h: number | undefined;
    if (n.absoluteBoundingBox) {
      ax = n.absoluteBoundingBox.x;
      ay = n.absoluteBoundingBox.y;
      w = n.absoluteBoundingBox.width;
      h = n.absoluteBoundingBox.height;
    } else if (n.x != null && n.y != null && n.width != null && n.height != null) {
      ax = px + (n.x || 0);
      ay = py + (n.y || 0);
      w = n.width || 0;
      h = n.height || 0;
    }
    return ax != null && ay != null && w != null && h != null ? { ax, ay, w, h } : null;
  };

  const walk = (n: NodeInput, px: number, py: number): DrawableNode[] => {
    const abs = toAbs(n, px, py);
    const textRaw =
      typeof n.textContent === "string"
        ? n.textContent
        : typeof n.characters === "string"
          ? n.characters
          : "";

    if (abs) {
      const { ax, ay, w, h } = abs;
      const lx = ax - px;
      const ly = ay - py;
      const node: DrawableNode = {
        id: n.id,
        name: n.name || n.id,
        type: n.type || "NODE",
        ax,
        ay,
        x: lx,
        y: ly,
        w,
        h,
        textRaw,
        fill: n.fill ?? null,
        stroke: n.stroke ?? null,
        corners: n.corners ?? null,
        effects: n.effects ?? null,
        text: n.text ?? null,
        children: [],
      };
      const nextPX = ax;
      const nextPY = ay;
      for (const c of n.children || []) {
        node.children.push(...walk(c, nextPX, nextPY));
      }
      return [node];
    } else {
      const out: DrawableNode[] = [];
      for (const c of n.children || []) {
        out.push(...walk(c, px, py));
      }
      return out;
    }
  };

  const out: DrawableNode[] = [];
  for (const root of nodes) out.push(...walk(root, parentAX, parentAY));
  return out;
}


function findById(nodes: DrawableNode[], id: string): DrawableNode | null {
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return n;
    for (const c of n.children) stack.push(c);
  }
  return null;
}

function pruneTreeByRef(nodes: DrawableNode[], ref: ReferenceFrame): DrawableNode[] {
  const fx = ref.x,
    fy = ref.y,
    fw = ref.width,
    fh = ref.height;
  const overlaps = (n: DrawableNode) => !(n.ax + n.w < fx || fx + fw < n.ax || n.ay + n.h < fy || fy + fh < n.ay);

  const prune = (n: DrawableNode): DrawableNode | null => {
    const keptChildren: DrawableNode[] = [];
    for (const c of n.children) {
      const pc = prune(c);
      if (pc) keptChildren.push(pc);
    }
    if (overlaps(n) || keptChildren.length > 0) {
      return { ...n, children: keptChildren };
    }
    return null;
  };

  const out: DrawableNode[] = [];
  for (const r of nodes) {
    const pr = prune(r);
    if (pr) out.push(pr);
  }
  return out;
}

function flattenTreeToDrawables(nodes: DrawableNode[]): Drawable[] {
  const out: Drawable[] = [];
  const stack: DrawableNode[] = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    out.push({
      id: n.id,
      name: n.name,
      type: n.type,
      x: n.ax, // for image collection we only care about fills, not positions
      y: n.ay,
      w: n.w,
      h: n.h,
      textRaw: n.textRaw,
      fill: n.fill,
      stroke: n.stroke,
      corners: n.corners,
      effects: n.effects,
      text: n.text,
    });
    for (const c of n.children) stack.push(c);
  }
  return out;
}

/* ---------- Image collection and download ---------- */
function inferExtFromMime(mime: string | undefined, fallback = "png") {
  if (!mime) return fallback;
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  return fallback;
}
function safeFileSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
// tiny non-crypto hash for filename uniqueness
function tinyHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}
async function collectAndDownloadImages(drawables: Drawable[]) {
  const imageNodes = drawables.filter((d) => d.fill?.type === "IMAGE" && d.fill.imageRef);
  const unique = new Map<string, true>();
  const manifest = new Map<string, string>(); // maps refUrl -> local path OR data URL
  const blobs = new Map<string, { path: string; bytes: Uint8Array }>();
  const skipped: Array<{ refUrl: string; reason: string }> = [];
  const allowPlaceholder = false; // keep false to avoid blank files
  for (const dn of imageNodes) {
    const refUrl = String(dn.fill!.imageRef);
    if (!refUrl || unique.has(refUrl)) continue;
    unique.set(refUrl, true);
    // Data URL path: embed as-is, no file
    if (/^data:image\//i.test(refUrl)) {
      manifest.set(refUrl, refUrl);
      continue;
    }
    // Remote URL path
    try {
      const res = await fetch(refUrl, { headers: { Accept: "image/*" } });
      if (!res.ok) {
        skipped.push({ refUrl, reason: `HTTP ${res.status}` });
        if (allowPlaceholder) {
          const base = safeFileSlug(new URL(refUrl).pathname.split("/").pop() || "image") || "image";
          const filename = `${base}-${tinyHash(refUrl)}.png`;
          const localPath = `assets/${filename}`;
          const tiny = Uint8Array.from(
            atobSafe("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/UtMZzQAAAAASUVORK5CYII="),
            (c) => c.charCodeAt(0)
          );
          manifest.set(refUrl, localPath);
          blobs.set(refUrl, { path: localPath, bytes: tiny });
        }
        continue;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.startsWith("image/")) {
        skipped.push({ refUrl, reason: `non-image content-type: ${ct || "unknown"}` });
        continue;
      }
      const buf = await res.arrayBuffer();
      const ext = inferExtFromMime(ct, "png");
      let baseName = "image";
      try {
        const u = new URL(refUrl);
        const last = u.pathname.split("/").pop() || "image";
        baseName = safeFileSlug(last.replace(/\.[a-z0-9]+$/i, "")) || "image";
      } catch { }
      const filename = `${baseName}-${tinyHash(refUrl)}.${ext}`;
      const localPath = `assets/${filename}`;
      manifest.set(refUrl, localPath);
      blobs.set(refUrl, { path: localPath, bytes: new Uint8Array(buf) });
    } catch (err: any) {
      skipped.push({ refUrl, reason: err?.message || "network error" });
      if (allowPlaceholder) {
        const base = safeFileSlug(dn.name || "image") || "image";
        const filename = `${base}-${tinyHash(refUrl)}.png`;
        const localPath = `assets/${filename}`;
        const tiny = Uint8Array.from(
          atobSafe("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/UtMZzQAAAAASUVORK5CYII="),
          (c) => c.charCodeAt(0)
        );
        manifest.set(refUrl, localPath);
        blobs.set(refUrl, { path: localPath, bytes: tiny });
      }
    }
  }
  return { imageManifest: manifest, imageBlobs: blobs, skipped };
}
function atobSafe(b64: string) {
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("binary");
}

/* ---------- Style mappers (tree) ---------- */
function nodeKind(d: DrawableNode): "IMAGE" | "TEXT" | "SHAPE" {
  const t = String(d.type || "").toUpperCase();
  if (t === "TEXT") return "TEXT";
  if (d.fill?.type === "IMAGE" && d.fill.imageRef) return "IMAGE";
  return "SHAPE";
}

function cssFromDrawableLocal(d: DrawableNode) {
  const isText = String(d.type).toUpperCase() === "TEXT";
  const style: Record<string, string | number> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
  };
  const isImage = d.fill?.type === "IMAGE" && !!d.fill.imageRef;
  if (!isText && !isImage && d.fill?.type === "SOLID" && d.fill.color) style.background = d.fill.color;
  if (!isText && d.stroke?.weight) {
    style.borderWidth = d.stroke.weight!;
    style.borderStyle = "solid";
    if (d.stroke?.color) style.borderColor = d.stroke.color!;
  }
  let hasRadius = false;
  if (d.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft, uniform } = d.corners;
    if (topLeft != null) {
      (style as any).borderTopLeftRadius = topLeft;
      hasRadius = true;
    }
    if (topRight != null) {
      (style as any).borderTopRightRadius = topRight;
      hasRadius = true;
    }
    if (bottomRight != null) {
      (style as any).borderBottomRightRadius = bottomRight;
      hasRadius = true;
    }
    if (bottomLeft != null) {
      (style as any).borderBottomLeftRadius = bottomLeft;
      hasRadius = true;
    }
    if (!hasRadius && uniform != null) {
      (style as any).borderRadius = uniform;
      hasRadius = true;
    }
  }
  if (hasRadius) (style as any).contain = "paint";
  if (!isText && Array.isArray(d.effects) && d.effects.length > 0) {
    const shadows = d.effects.map((e) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }
  if (isText && d.text) {
    if (d.text.fontSize != null) (style as any).fontSize = d.text.fontSize as number;
    if (d.text.fontFamily) (style as any).fontFamily = d.text.fontFamily!;
    if (d.text.fontWeight != null) (style as any).fontWeight = d.text.fontWeight as any;
    if (d.text.color) (style as any).color = d.text.color!;
    if (d.text.textDecoration) (style as any).textDecoration = d.text.textDecoration!;
  }
  return style;
}

type Rect = { x: number; y: number; w: number; h: number };

function makeSyntheticRootFromRef(ref: ReferenceFrame): DrawableNode {
  return {
    id: `ref:${ref.id}`,
    name: "Reference",
    type: "FRAME",
    ax: ref.x,
    ay: ref.y,
    x: 0,
    y: 0,
    w: ref.width,
    h: ref.height,
    textRaw: null,
    fill: null,
    stroke: null,
    corners: null,
    effects: null,
    text: null,
    children: [],
  };
}

function rectContains(a: Rect, b: Rect) {
  return b.x >= a.x && b.y >= a.y && (b.x + b.w) <= (a.x + a.w) && (b.y + b.h) <= (a.y + a.h);
}
function rectOverlaps(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
function rectArea(r: Rect) { return r.w * r.h; }

function flattenTreeToNodes(nodes: DrawableNode[]): DrawableNode[] {
  const out: DrawableNode[] = [];
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    out.push({ ...n, children: [] }); // shallow copy without tree links
    for (const c of n.children) stack.push(c);
  }
  return out;
}

// Spatially nest “nodes” under “root” choosing the smallest containing parent;
// recompute local x/y from absolute ax/ay after assigning parent.
function spatialNestUnder(root: DrawableNode, nodes: DrawableNode[]): DrawableNode {
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
        if (a < bestArea && a > rectArea(nr)) {
          best = p;
          bestArea = a;
        }
      }
    }
    childrenMap.get(best.id)!.push(n);
  }

  // attach children and recompute local coords
  const attach = (parent: DrawableNode) => {
    const kids = childrenMap.get(parent.id)!;
    parent.children = kids;
    for (const c of kids) {
      c.x = c.ax - parent.ax;
      c.y = c.ay - parent.ay;
      attach(c);
    }
  };
  attach(root);
  return root;
}


function jsxImgWithStyleLocalTree(d: DrawableNode, manifest: Map<string, string>) {
  const style: Record<string, any> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
    objectFit: "cover",
    borderRadius:
      d.corners?.uniform ??
      d.corners?.topLeft ??
      d.corners?.topRight ??
      d.corners?.bottomRight ??
      d.corners?.bottomLeft ??
      0,
  };
  if (Array.isArray(d.effects) && d.effects.length > 0) {
    const shadows = d.effects.map((e) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }
  const styleJson = JSON.stringify(style).replace(/"([^"]+)":/g, "$1:");
  const ref = d.fill?.imageRef ? String(d.fill.imageRef) : "";
  let srcLocal = "";
  if (ref) {
    const mapped = manifest.get(ref);
    if (mapped) {
      srcLocal = mapped.startsWith("data:") ? mapped : `/${mapped}`;
    } else {
      srcLocal = ref.startsWith("data:") ? ref : "";
    }
  }
  const alt = d.name || "image";
  return `<Img style={${styleJson}} src=${JSON.stringify(srcLocal)} alt=${JSON.stringify(alt)} />`;
}

function jsxBoxWithStyleTree(d: DrawableNode) {
  const style = cssFromDrawableLocal(d);
  const styleJson = JSON.stringify(style).replace(/"([^"]+)":/g, "$1:");
  const isText = String(d.type).toUpperCase() === "TEXT";
  const rawText = isText ? (d.text?.characters ?? d.textRaw ?? "") : (d.text?.characters ?? d.textRaw ?? null);
  const textExpr = JSON.stringify(rawText);
  return `<Box style={${styleJson}} dataName=${JSON.stringify(d.name)} text=${textExpr} isText={${isText}} />`;
}

function renderTree(nodes: DrawableNode[], manifest: Map<string, string>, indent = 6): string {
  const pad = (n: number) => " ".repeat(n);
  const out: string[] = [];
  for (const n of nodes) {
    if (nodeKind(n) === "IMAGE") {
      out.push(pad(indent) + jsxImgWithStyleLocalTree(n, manifest));
    } else if (n.children.length > 0) {
      const style = JSON.stringify(cssFromDrawableLocal(n)).replace(/"([^"]+)":/g, "$1:");
      out.push(pad(indent) + `<div style={${style}} data-name=${JSON.stringify(n.name)}>`); // wrapper acts as positioned ancestor
      out.push(renderTree(n.children, manifest, indent + 2));
      out.push(pad(indent) + `</div>`);
    } else {
      out.push(pad(indent) + jsxBoxWithStyleTree(n));
    }
  }
  return out.join("\n");
}

/* ---------- Shared helpers ---------- */
function boxHelperTsStyled() {
  return `function Box({
  style, dataName, text, isText,
}: {
  style: React.CSSProperties;
  dataName: string;
  text?: string | "";
  isText: boolean;
}) {
  const textColor = (isText && typeof style.color === "string") ? style.color : undefined;
  const textSize = typeof style.fontSize === "number" ? style.fontSize : 11;
  const innerStyle: React.CSSProperties = {
    width: isText ? "fit-content" : "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: isText ? "flex-start" : "center",
    overflow: "visible",
    textAlign: isText ? "left" : "center",
    boxSizing: "border-box",
    padding: 4,
  };
  const textStyle: React.CSSProperties = {
    fontSize: textSize,
    ...(textColor ? { color: textColor } : {}),
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  };
  return (
    <div style={style} data-name={dataName}>
      <div style={innerStyle}>
        {(text !== "" && text !== undefined) && (<div style={textStyle}>{text}</div>)}
      </div>
    </div>
  );
}
`;
}
function imgHelperTs() {
  return `function Img({ style, src, alt }: { style: React.CSSProperties; src: string; alt?: string; }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || ""} style={style} />;
}
`;
}

/* ---------- Next.js build (with assets, nested) ---------- */
function buildNext(
  zip: JSZip,
  name: string,
  roots: DrawableNode[],
  ref: ReferenceFrame | null,
  imageManifest: Map<string, string>,
  imageBlobs: Map<string, { path: string; bytes: Uint8Array }>
) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "^14.2.0", react: "^18.2.0", "react-dom": "^18.2.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "nextjs", imageManifest));
  // Place assets in public/assets
  const pub = zip.folder("public")!;
  pub.file(".gitkeep", "");
  const pubAssets = pub.folder("assets")!;
  pubAssets.file(".gitkeep", ""); // ensure folder exists
  for (const [, v] of imageBlobs) {
    pubAssets.file(v.path.replace(/^assets\//, ""), v.bytes);
  }
  const app = zip.folder("app")!;
  app.file("layout.tsx", nextLayout());
  app.file("page.tsx", nextPageTree(roots, ref, imageManifest));
  app.file("globals.css", globalsCss());
  zip.file(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2021",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: false,
          skipLibCheck: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          baseUrl: ".",
          paths: {},
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  );
  zip.file(
    "next-env.d.ts",
    `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`
  );
  const lib = zip.folder("lib")!;
  lib.file("tokens.ts", tokensTs());
  lib.file("color.ts", colorUtilTs());
}
function nextLayout() {
  return `import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ margin: 0 }}>{children}</body></html>);
}
`;
}
function nextPageTree(roots: DrawableNode[], ref: ReferenceFrame | null, manifest: Map<string, string>) {
  const cont = ref
    ? {
      position: "relative",
      width: `${Math.round(ref.width)}px`,
      height: `${Math.round(ref.height)}px`,
      background: "#fff",
    }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const contJson = JSON.stringify(cont).replace(/"([^"]+)":/g, "$1:");
  return `export default function Page() {
  return (
    <div style={${contJson}}>
${renderTree(roots, manifest, 6)}
    </div>
  );
}
${boxHelperTsStyled()}
${imgHelperTs()}
`;
}

/* ---------- React (Vite) build (with assets, nested) ---------- */
function buildReactVite(
  zip: JSZip,
  name: string,
  roots: DrawableNode[],
  ref: ReferenceFrame | null,
  imageManifest: Map<string, string>,
  imageBlobs: Map<string, { path: string; bytes: Uint8Array }>
) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: {
      vite: "^5.0.0",
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      typescript: "^5.4.0",
    },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", reactIndexHtml());
  zip.file("README.md", readme(name, "react", imageManifest));
  // public/assets for Vite too
  const pub = zip.folder("public")!;
  const pubAssets = pub.folder("assets")!;
  pubAssets.file(".gitkeep", "");
  for (const [, v] of imageBlobs) {
    pubAssets.file(v.path.replace(/^assets\//, ""), v.bytes);
  }
  const src = zip.folder("src")!;
  src.file("main.tsx", reactMainTsx());
  src.file("App.tsx", reactAppTree(roots, ref, imageManifest));
  src.file("globals.css", globalsCss());
  const lib = src.folder("lib")!;
  lib.file("tokens.ts", tokensTs());
  lib.file("color.ts", colorUtilTs());
  zip.file(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2021",
          lib: ["dom", "dom.iterable", "esnext"],
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2
    )
  );
}
function reactIndexHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Figma to React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}
function reactMainTsx() {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";
createRoot(document.getElementById("root")!).render(<App />);
`;
}
function reactAppTree(roots: DrawableNode[], ref: ReferenceFrame | null, manifest: Map<string, string>) {
  const cont = ref
    ? {
      position: "relative",
      width: `${Math.round(ref.width)}px`,
      height: `${Math.round(ref.height)}px`,
      background: "#fff",
    }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const contJson = JSON.stringify(cont).replace(/"([^"]+)":/g, "$1:");
  return `export default function App() {
  return (
    <div style={${contJson}}>
${renderTree(roots, manifest, 6)}
    </div>
  );
}
${boxHelperTsStyled()}
${imgHelperTs()}
`;
}

/* ---------- Vue (nested) ---------- */
function buildVue(zip: JSZip, name: string, roots: DrawableNode[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { vue: "^3.4.0" },
    devDependencies: { vite: "^5.0.0", "@vitejs/plugin-vue": "^5.0.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", vueIndexHtml());
  zip.file("vite.config.ts", vueViteConfig());
  zip.file("README.md", readme(name, "vue"));
  const src = zip.folder("src")!;
  src.file("main.ts", vueMainTs());
  src.file("App.vue", vueAppVue(roots, ref));
}
function vueIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Vue</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function vueMainTs() {
  return `import { createApp } from "vue"; import App from "./App.vue"; createApp(App).mount("#app");`;
}
function vueViteConfig() {
  return `import { defineConfig } from "vite"; import vue from "@vitejs/plugin-vue"; export default defineConfig({ plugins: [vue()] });`;
}
function vueAppVue(roots: DrawableNode[], ref: ReferenceFrame | null) {
  const container = ref
    ? {
      position: "relative",
      width: `${Math.round(ref.width)}px`,
      height: `${Math.round(ref.height)}px`,
      background: "#fff",
    }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const containerJson = JSON.stringify(container).replace(/"([^"]+)":/g, "$1:");

  // Emit a small recursive component to render the tree
  const treeJson = JSON.stringify(roots);

  return `<script setup lang="ts">
import { computed } from "vue";
type Node = ${`{
  id: string; name: string; type: string;
  x: number; y: number; w: number; h: number;
  ax: number; ay: number;
  textRaw?: string | null;
  fill?: any; stroke?: any; corners?: any; effects?: any; text?: any;
  children: Node[];
}`};
const roots = ${treeJson} as Node[];
const containerStyle = ${containerJson};
function isText(n: Node){ return String(n.type).toUpperCase()==="TEXT"; }
function isImage(n: Node){ return n.fill?.type==="IMAGE" && !!n.fill.imageRef; }
function styleFor(n: Node){
  const s:any={ position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h };
  if(!isText(n) && !isImage(n) && n.fill?.type==="SOLID" && n.fill.color) s.background=n.fill.color;
  if(!isText(n) && n.stroke?.weight){ s.borderWidth=n.stroke.weight; s.borderStyle="solid"; if(n.stroke?.color) s.borderColor=n.stroke.color; }
  if(n.corners){
    const {topLeft,topRight,bottomRight,bottomLeft,uniform}=n.corners;
    if(topLeft!=null) s.borderTopLeftRadius=topLeft;
    if(topRight!=null) s.borderTopRightRadius=topRight;
    if(bottomRight!=null) s.borderBottomRightRadius=bottomRight;
    if(bottomLeft!=null) s.borderBottomLeftRadius=bottomLeft;
    if(uniform!=null && !("borderTopLeftRadius" in s)) s.borderRadius=uniform;
  }
  return s;
}
</script>
<template>
  <div :style="containerStyle">
    <template v-for="(n, i) in roots" :key="n.id + ':' + i">
      <div v-if="n.children.length>0 && !isImage(n) && !isText(n)" :style="styleFor(n)" :data-name="n.name">
        <TreeNode v-for="(c, j) in n.children" :key="c.id + ':' + j" :node="c" />
      </div>
      <Box v-else :node="n" />
    </template>
  </div>
</template>
<script lang="ts">
import { defineComponent, h } from "vue";
const Box = defineComponent({
  props: { node: { type: Object, required: true } },
  setup(props:any){
    const n=props.node; const s:any=(${cssFromDrawableLocal.toString()})(n);
    const isText=String(n.type).toUpperCase()==="TEXT";
    const text=isText ? (n.text?.characters ?? n.textRaw ?? "") : (n.text?.characters ?? n.textRaw ?? null);
    return ()=> h("div", { style:s, "data-name": n.name }, [
      text!==null && h("div", { style: { fontSize: isText && n.text?.fontSize || 11 } }, text)
    ]);
  }
});
const TreeNode = defineComponent({
  props: { node: { type: Object, required: true } },
  setup(props:any){
    const n=props.node;
    const isImg = n.fill?.type==="IMAGE" && !!n.fill.imageRef;
    if(isImg){
      const s:any = { position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h, objectFit:"cover" };
      return ()=> h("img", { style: s, alt: n.name, src: typeof n.fill.imageRef==="string" && n.fill.imageRef.startsWith("data:") ? n.fill.imageRef : "" });
    }
    if(n.children.length>0){
      const s:any= (${cssFromDrawableLocal.toString()})(n);
      return ()=> h("div", { style: s, "data-name": n.name }, n.children.map((c:any)=> h(TreeNode, { node:c })));
    }
    return ()=> h(Box, { node:n });
  }
});
export default {};
</script>
`;
}

/* ---------- Svelte (nested) ---------- */
function buildSvelte(zip: JSZip, name: string, roots: DrawableNode[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    devDependencies: { vite: "^5.0.0", svelte: "^4.2.0", "@sveltejs/vite-plugin-svelte": "^3.0.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", svelteIndexHtml());
  zip.file("vite.config.ts", svelteViteConfig());
  zip.file("README.md", readme(name, "svelte"));
  const src = zip.folder("src")!;
  src.file("main.ts", svelteMainTs());
  src.file("App.svelte", svelteApp(roots, ref));
}
function svelteIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Svelte</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function svelteMainTs() {
  return `import App from "./App.svelte"; new App({ target: document.getElementById("app")! });`;
}
function svelteViteConfig() {
  return `import { defineConfig } from "vite"; import { svelte } from "@sveltejs/vite-plugin-svelte"; export default defineConfig({ plugins: [svelte()] });`;
}
function svelteApp(roots: DrawableNode[], ref: ReferenceFrame | null) {
  const rootsJson = JSON.stringify(roots).replace(/"([^"]+)":/g, "$1:");
  const container = ref
    ? { position: "relative", width: `${Math.round(ref.width)}px`, height: `${Math.round(ref.height)}px`, background: "#fff" }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const containerJson = JSON.stringify(container).replace(/"([^"]+)":/g, "$1:");
  return `<script lang="ts">
  export let roots = ${rootsJson};
  export let containerStyle = ${containerJson};
  const isText = (n:any)=> String(n.type).toUpperCase()==="TEXT";
  const isImg = (n:any)=> n.fill?.type==="IMAGE" && !!n.fill.imageRef;
  const cssFrom = ${cssFromDrawableLocal.toString()};
</script>
<div style={containerStyle}>
  {#each roots as n, i (n.id + ':' + i)}
    {#if n.children.length>0 && !isImg(n) && !isText(n)}
      <div style={cssFrom(n)} data-name={n.name}>
        {#each n.children as c, j (c.id + ':' + j)}
          <svelte:component this={TreeNode} node={c}/>
        {/each}
      </div>
    {:else}
      <svelte:component this={Box} node={n}/>
    {/if}
  {/each}
</div>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  const Box = ({} as any); // TS silence for inline components
</script>

<!-- Inline components -->
<script>
  export let node;
</script>
<svelte:component this={undefined} />
`;
}

/* ---------- React Native (flat content boxes; images via web URLs not bundled) ---------- */
function buildReactNative(zip: JSZip, name: string, d: Drawable[], _ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    main: "App.js",
    scripts: { start: "expo start" },
    dependencies: { expo: "~51.0.0", react: "18.2.0", "react-native": "0.74.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "react-native"));
  const rnBoxes = d.map((b) => ({
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    style: rnStyleFromDrawable(b),
    textStyle: rnTextStyle(b),
  }));
  const rnBoxesJson = JSON.stringify(rnBoxes).replace(/"([^"]+)":/g, "$1:");
  zip.file(
    "App.js",
    `import React from "react"; import { View, Text, SafeAreaView, StyleSheet } from "react-native";
const boxes = ${rnBoxesJson};
export default function App(){return(<SafeAreaView style={styles.root}><View style={styles.stage}>{boxes.map((b,i)=>(<Box key={i} style={b.style} name={b.name} text={b.text} isText={b.isText} textStyle={b.textStyle}/>))}</View></SafeAreaView>);}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:"#fff"},stage:{flex:1}});
function Box({style,name,text,isText,textStyle}){return(<View style={style}>{(text!==null&&text!==undefined)&&(<Text style={{fontSize:11,color:"#333",...(textStyle||{})}}>{text}</Text>)}</View>);}
`
  );
  zip.folder("assets")?.file(".gitkeep", "");
  zip.file(".watchmanconfig", '{ "ignore_dirs": ["node_modules"] }');
}
function rnStyleFromDrawable(d: Drawable) {
  const style: Record<string, any> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
    padding: 4,
  };
  if (d.fill?.type === "SOLID" && d.fill.color) style.backgroundColor = d.fill.color;
  if (d.stroke?.weight) style.borderWidth = d.stroke.weight;
  if (d.stroke?.color) style.borderColor = d.stroke.color;
  if (d.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft, uniform } = d.corners;
    if (topLeft != null) style.borderTopLeftRadius = topLeft;
    if (topRight != null) style.borderTopRightRadius = topRight;
    if (bottomRight != null) style.borderBottomRightRadius = bottomRight;
    if (bottomLeft != null) style.borderBottomLeftRadius = bottomLeft;
    if (uniform != null) style.borderRadius = uniform;
  }
  return style;
}
function rnTextStyle(d: Drawable) {
  const t: Record<string, any> = {};
  if (d.text?.fontSize != null) t.fontSize = d.text.fontSize;
  if (d.text?.fontFamily) t.fontFamily = d.text.fontFamily;
  if (d.text?.fontWeight != null) t.fontWeight = String(d.text.fontWeight);
  if (d.text?.color) t.color = d.text.color;
  return t;
}

/* ---------- Flutter (flat content boxes) ---------- */
function buildFlutter(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  zip.file("pubspec.yaml", flutterPubspec(name));
  const items = d.map((b) => ({
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    bg: b.fill?.type === "SOLID" ? b.fill.color ?? null : null,
    borderWidth: b.stroke?.weight ?? null,
    borderColor: b.stroke?.color ?? null,
    radius: b.corners?.uniform ?? null,
  }));
  const itemsJson = JSON.stringify(items);
  const container = ref ? { w: Math.round(ref.width), h: Math.round(ref.height) } : null;
  zip
    .folder("lib")!
    .file(
      "main.dart",
      `import 'package:flutter/material.dart';
void main()=>runApp(const MyApp());
class MyApp extends StatelessWidget{const MyApp({super.key});@override Widget build(BuildContext context){return MaterialApp(home: Scaffold(body:${container ? `SizedBox(width:${container.w}.0,height:${container.h}.0, child: Stack(children: buildBoxes()))` : `Stack(children: buildBoxes())`},),);}}
List<Widget> buildBoxes(){const items=${itemsJson};return items.map((b){return Positioned(left:(b["x"] as num).toDouble(),top:(b["y"] as num).toDouble(),width:(b["w"] as num).toDouble(),height:(b["h"] as num).toDouble(),child: Container(padding: const EdgeInsets.all(4),decoration: BoxDecoration(color: Colors.white,border:(b["borderWidth"]!=null&&b["borderColor"]!=null)?Border.all(color: const Color(0xFF3B82F6),width:(b["borderWidth"] as num).toDouble()):null,borderRadius:(b["radius"]!=null)?BorderRadius.circular((b["radius"] as num).toDouble()):null,),child: Column(crossAxisAlignment: CrossAxisAlignment.start,children:[if(b["text"]!=null) Text(b["text"] as String,style: const TextStyle(fontSize:11,color: Color(0xFF333333))),],),),);}).toList();}`
    );
  zip.file("README.md", readme(name, "flutter"));
}

/* ---------- Shared outputs ---------- */
function globalsCss() {
  return `:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
/* Prevent background bleed past rounded parents without clipping children */
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] > * { border-radius: inherit; }
/* Optional: stabilize paint for rounded elements that rely on large shadows */
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] { contain: paint; }
[data-name] > div { overflow: visible; }
`;
}
function tokensTs() {
  return `// Design tokens placeholder: map Figma styles -> code styles here
export const tokens = {
  colors: { primary: "#3b82f6", accent: "#FF5733", text: "#111111", muted: "#333333" },
  radii: { none: 0, sm: 4, md: 8, lg: 12 },
  typography: { body: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontSize: 14, lineHeight: 1.4 }, small: { fontSize: 12, lineHeight: 1.35 } },
};
`;
}
function colorUtilTs() {
  return `
  export function rgba255(r:number,g:number,b:number,a=1){
    const rr=Math.max(0,Math.min(255,Math.round(r)));
    const gg=Math.max(0,Math.min(255,Math.round(g)));
    const bb=Math.max(0,Math.min(255,Math.round(b)));
    const aa=Math.max(0,Math.min(1,a));
    return 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + aa + ')';
  }
`;
}
function readme(project: string, target: string, imageManifest?: Map<string, string>) {
  const imgCount = imageManifest ? imageManifest.size : 0;
  const list =
    imgCount > 0
      ? Array.from(imageManifest!.entries())
        .map(([u, p]) => `- ${p.startsWith("data:") ? "(inline data URL)" : p}`)
        .join("\n")
      : "- none";
  return `# ${project} – ${target}
This project was generated from Figma nodes and includes visual styles (background, radius, border, basic text, shadows).
If a frame was selected during conversion, the canvas matches that frame and positions are relative to its top-left.
Images
- For data URLs, images are embedded inline in <img src="data:..."> and no files are written.
- For http(s) URLs, images are downloaded into /public/assets and referenced as /assets/filename.ext.
- Total referenced: ${imgCount}
${list}
`;
}
function flutterPubspec(name: string): string {
  return `name: ${name}
description: A Flutter project generated from Figma nodes.
publish_to: "none"
version: 1.0.0+1
environment: { sdk: ">=3.0.0 <4.0.0" }
dependencies: { flutter: { sdk: flutter } }
dev_dependencies: { flutter_test: { sdk: flutter } }
flutter: { uses-material-design: true }`;
}
