/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/core/render.ts */
import { DrawableNode } from "./types";

/* ---------- Kind helpers ---------- */
export function nodeKind(d: DrawableNode): "IMAGE" | "TEXT" | "SHAPE" {
  const t = String(d.type || "").toUpperCase();
  if (t === "TEXT") return "TEXT";
  if (d.fill?.type === "IMAGE" && d.fill.imageRef) return "IMAGE";
  return "SHAPE";
}

/* ---------- Fill helpers ---------- */
function cssGradient(fill: any): string | null {
  if (!fill || !Array.isArray(fill.stops) || !fill.stops.length) return null;
  const stops = fill.stops
    .map((s: any) => `${s.color} ${Math.round((s.position ?? 0) * 100)}%`)
    .join(", ");
  if (String(fill.type).toUpperCase().includes("RADIAL")) {
    return `radial-gradient(circle, ${stops})`;
  }
  // Default to vertical linear gradient if angle info isn't provided
  return `linear-gradient(180deg, ${stops})`;
}

/* ---------- CSS from node (absolute within parent) ---------- */
export function cssFromDrawableLocal(d: DrawableNode) {
  const isText = String(d.type).toUpperCase() === "TEXT";
  const isImage = d.fill?.type === "IMAGE" && !!(d.fill as any).imageRef;

  const style: Record<string, string | number> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
  };

  // Backgrounds
  if (!isText) {
    if (!isImage && d.fill?.type === "SOLID" && (d.fill as any).color) {
      style.background = (d.fill as any).color;
    } else if (!isImage && d.fill && String(d.fill.type).toUpperCase().startsWith("GRADIENT")) {
      const bg = cssGradient(d.fill);
      if (bg) {
        (style as any).backgroundImage = bg;
        (style as any).backgroundSize = "cover";
      }
    } else if (isImage) {
      // If this node has no children, we will render it as a standalone <Img>;
      // if it has children, we render an <Img> overlay at 0/0 inside a wrapper and keep style here bare.
      // No-op here; image is injected in renderTree when children are present.
    }
  }

  // Border
  if (!isText && d.stroke?.weight) {
    (style as any).borderWidth = d.stroke.weight as number;
    (style as any).borderStyle = "solid";
    if (d.stroke?.color) (style as any).borderColor = d.stroke.color as string;
  }

  // Radius
  let hasRadius = false;
  if (d.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft, uniform } = d.corners as any;
    if (topLeft != null) { (style as any).borderTopLeftRadius = topLeft; hasRadius = true; }
    if (topRight != null) { (style as any).borderTopRightRadius = topRight; hasRadius = true; }
    if (bottomRight != null) { (style as any).borderBottomRightRadius = bottomRight; hasRadius = true; }
    if (bottomLeft != null) { (style as any).borderBottomLeftRadius = bottomLeft; hasRadius = true; }
    if (!hasRadius && uniform != null) { (style as any).borderRadius = uniform; hasRadius = true; }
    if (hasRadius) (style as any).contain = "paint";
  }

  // Shadows
  if (!isText && Array.isArray((d as any).effects) && (d as any).effects.length > 0) {
    const shadows = (d as any).effects.map((e: any) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }

  // Text
  if (isText && d.text) {
    if (d.text.fontSize != null) (style as any).fontSize = d.text.fontSize as number;
    if (d.text.fontFamily) (style as any).fontFamily = d.text.fontFamily as string;
    if (d.text.fontWeight != null) (style as any).fontWeight = d.text.fontWeight as any;
    if (d.text.color) (style as any).color = d.text.color as string;
    if (d.text.textDecoration) (style as any).textDecoration = d.text.textDecoration as string;
  }

  // UX overrides for horizontal overflow handling
  if (d.ux?.scrollX) {
    (style as any).overflowX = "auto";
    (style as any).overflowY = "hidden";
    // No white-space hack needed because children are absolutely positioned to compute scrollWidth
    (style as any).WebkitOverflowScrolling = "touch";
  }
  if (d.ux?.snap) {
    (style as any).scrollSnapType = "x mandatory";
    (style as any).scrollBehavior = "smooth";
  }
  if (d.ux?.snapAlign) {
    (style as any).scrollSnapAlign = d.ux.snapAlign;
  }
  return style;
}

/* ---------- <Img> helpers ---------- */
function imgStyleCoverWithinParent(d: DrawableNode) {
  const style: Record<string, any> = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius:
      (d.corners?.uniform ??
        d.corners?.topLeft ??
        d.corners?.topRight ??
        d.corners?.bottomRight ??
        d.corners?.bottomLeft) ?? 0,
  };
  if (Array.isArray((d as any).effects) && (d as any).effects.length > 0) {
    const shadows = (d as any).effects.map((e: any) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }
  return style;
}

function resolveImgSrc(d: DrawableNode, manifest: Map<string, string>) {
  const ref = d.fill?.imageRef ? String(d.fill.imageRef) : "";
  if (!ref) return "";
  const mapped = manifest.get(ref);
  if (mapped) return mapped.startsWith("data:") ? mapped : `/${mapped}`;
  return ref.startsWith("data:") ? ref : "";
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
      (d.corners?.uniform ??
        d.corners?.topLeft ??
        d.corners?.topRight ??
        d.corners?.bottomRight ??
        d.corners?.bottomLeft) ?? 0,
  };
  if (Array.isArray((d as any).effects) && (d as any).effects.length > 0) {
    const shadows = (d as any).effects.map((e: any) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }
  const styleJson = JSON.stringify(style).replace(/\"([^\"]+)\":/g, "$1:");
  const srcLocal = resolveImgSrc(d, manifest);
  const alt = d.name || "image";
  return srcLocal
    ? `<Img style={${styleJson}} src=${JSON.stringify(srcLocal)} alt=${JSON.stringify(alt)} />`
    : ""; // if no src, we’ll rely on gradient/solid background already in cssFromDrawableLocal
}

function jsxImgCoverInsideWrapper(d: DrawableNode, manifest: Map<string, string>) {
  const styleJson = JSON.stringify(imgStyleCoverWithinParent(d)).replace(/\"([^\"]+)\":/g, "$1:");
  const srcLocal = resolveImgSrc(d, manifest);
  const alt = d.name || "image";
  return srcLocal ? `<Img style={${styleJson}} src=${JSON.stringify(srcLocal)} alt=${JSON.stringify(alt)} />` : "";
}

/* ---------- Primitive box ---------- */
function jsxBoxWithStyleTree(d: DrawableNode) {
  const style = cssFromDrawableLocal(d);
  const styleJson = JSON.stringify(style).replace(/\"([^\"]+)\":/g, "$1:");
  const isText = String(d.type).toUpperCase() === "TEXT";
  const rawText = isText ? (d.text?.characters ?? d.textRaw ?? "") : (d.text?.characters ?? d.textRaw ?? null);
  const textExpr = JSON.stringify(rawText);
  return `<Box style={${styleJson}} dataName=${JSON.stringify(d.name)} text=${textExpr} isText={${isText}} />`;
}

/* ---------- Tree render ---------- */
// core/render.ts
export function renderTree(nodes: DrawableNode[], manifest: Map<string, string>, indent = 6): string {
  const pad = (n: number) => " ".repeat(n);
  const out: string[] = [];

  for (const n of nodes) {
    const kind = nodeKind(n);

    // Container nodes
    if (n.children.length > 0) {
      // Base wrapper style from node
      const wrapperStyleObj = cssFromDrawableLocal(n);

      // If this container is a scroll wrapper, render with an inner rail
      if (n.ux?.scrollX) {
        // Peek behavior for carousels (set by tree pass on wrapper.ux.peek)
        const doPeek = (n.ux as any)?.peek === true;
        if (doPeek) {
          // Give a bit of room on the right so the last slide can still peek without clipping
          (wrapperStyleObj as any).paddingRight = 48;
        }

        const wrapperStyle = JSON.stringify(wrapperStyleObj).replace(/\"([^\"]+)\":/g, "$1:");

        // Rail width is the farthest child right edge (children x are already normalized by tree pass)
        const railW = Math.max(1, ...n.children.map(c => c.x + c.w));
        const railStyleObj: any = { position: "relative", width: railW, height: "100%" };
        if (doPeek) {
          // Offset the rail to show a hint of previous/next slide without affecting scrollWidth
          railStyleObj.marginLeft = -48;
        }
        const railStyle = JSON.stringify(railStyleObj).replace(/\"([^\"]+)\":/g, "$1:");

        out.push(pad(indent) + `<div style={${wrapperStyle}} data-name=${JSON.stringify(n.name)}>`);
        out.push(pad(indent + 2) + `<div style={${railStyle}}>`);
        // Render children inside the rail
        for (const c of n.children) {
          // Compute child style and apply UX decorations if present
          const cs = cssFromDrawableLocal(c);

          // Elevation: emphasized card in strip rows
          if ((c.ux as any)?.elevate) {
            (cs as any).zIndex = 2;
            const base = (cs as any).boxShadow || "0px 0px 13px 0px rgba(0,0,0,0.20)";
            (cs as any).boxShadow = "0px 12px 28px rgba(0,0,0,0.22), " + base;
          } else if (n.ux?.scrollX && !(c.ux as any)?.snapAlign) {
            // Side cards in strips: soften shadow slightly if present
            const base = (cs as any).boxShadow;
            if (base) (cs as any).boxShadow = base.replace(/0\.2\)/g, "0.14)");
          }

          // Scroll snapping for carousel slides
          if (c.ux?.snapAlign) (cs as any).scrollSnapAlign = c.ux.snapAlign;

          const csJson = JSON.stringify(cs).replace(/\"([^\"]+)\":/g, "$1:");
          const ck = nodeKind(c);

          if (ck === "IMAGE" && c.children.length === 0) {
            // Leaf image
            out.push(pad(indent + 4) + jsxImgWithStyleLocalTree(c, manifest));
          } else if (c.children.length > 0) {
            // Nested container as positioned box within rail
            out.push(pad(indent + 4) + `<div style={${csJson}} data-name=${JSON.stringify(c.name)}>`);
            out.push(renderTree(c.children, manifest, indent + 6));
            out.push(pad(indent + 4) + `</div>`);
          } else {
            // Primitive box/text
            out.push(pad(indent + 4) + jsxBoxWithStyleTree(c));
          }
        }
        out.push(pad(indent + 2) + `</div>`);
        out.push(pad(indent) + `</div>`);
        continue;
      }

      // Regular non-scroll container: still allow an image fill under its children
      const wrapperStyle = JSON.stringify(wrapperStyleObj).replace(/\"([^\"]+)\":/g, "$1:");
      out.push(pad(indent) + `<div style={${wrapperStyle}} data-name=${JSON.stringify(n.name)}>`);
      if (kind === "IMAGE") {
        const bgImg = jsxImgCoverInsideWrapper(n, manifest);
        if (bgImg) out.push(pad(indent + 2) + bgImg);
      }
      out.push(renderTree(n.children, manifest, indent + 2));
      out.push(pad(indent) + `</div>`);
      continue;
    }

    // Leaves
    if (kind === "IMAGE") {
      out.push(pad(indent) + jsxImgWithStyleLocalTree(n, manifest));
    } else {
      out.push(pad(indent) + jsxBoxWithStyleTree(n));
    }
  }

  return out.join("\n");
}



/* ---------- React helpers injected into pages/apps ---------- */
export function boxHelperTsStyled() {
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

export function imgHelperTs() {
  return `function Img({ style, src, alt }: { style: React.CSSProperties; src: string; alt?: string; }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || ""} style={style} />;
}
`;
}
