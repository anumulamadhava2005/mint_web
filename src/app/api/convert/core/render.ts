/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/core/render.ts */
import { DrawableNode } from "./types";

/* helpers */
export function nodeKind(d: DrawableNode): "IMAGE" | "TEXT" | "SHAPE" {
  const t = String(d.type || "").toUpperCase();
  if (t === "TEXT") return "TEXT";
  if (d.fill?.type === "IMAGE" && d.fill.imageRef) return "IMAGE";
  return "SHAPE";
}
function cssGradient(fill: any): string | null {
  if (!fill || !Array.isArray(fill.stops) || !fill.stops.length) return null;
  const stops = fill.stops.map((s: any) => `${s.color} ${Math.round((s.position ?? 0) * 100)}%`).join(", ");
  return String(fill.type).toUpperCase().includes("RADIAL") ? `radial-gradient(circle, ${stops})` : `linear-gradient(180deg, ${stops})`;
}
function toLineHeight(v: any) { if (v == null || v === "AUTO") return undefined; if (typeof v === "number") return v; if (typeof v === "string") return v; return undefined; }
function toLetterSpacing(v: any) { if (v == null) return undefined; if (typeof v === "number") return v; if (typeof v === "string") return v; return undefined; }
function r2(n: number) { return Math.round(n * 100) / 100; } // subpixel stability under scaled stage

/* style mapping */
export function cssFromDrawableLocal(d: DrawableNode) {
  const isText = String(d.type).toUpperCase() === "TEXT";
  const isImage = d.fill?.type === "IMAGE" && !!(d.fill as any).imageRef;

  const style: Record<string, string | number> = {
    position: "absolute",
    left: r2(d.x),
    top: r2(d.y),
    width: r2(d.w),
    height: r2(d.h),
    boxSizing: "border-box",
  };

  // hairline fix (0-dimension + stroke)
  if (!isText && d.stroke?.weight && (d.w === 0 || d.h === 0)) {
    if (d.w === 0) (style as any).width = 1;
    if (d.h === 0) (style as any).height = 1;
    if (d.stroke?.color) (style as any).background = d.stroke.color as string;
    return style;
  }

  // BG
  if (!isText) {
    if (!isImage && d.fill?.type === "SOLID" && (d.fill as any).color) { style.background = (d.fill as any).color; }
    else if (!isImage && d.fill && String(d.fill.type).toUpperCase().startsWith("GRADIENT")) {
      const bg = cssGradient(d.fill); if (bg) { (style as any).backgroundImage = bg; (style as any).backgroundSize = "cover"; }
    }
  }

  // Border
  if (!isText && d.stroke?.weight) {
    (style as any).borderWidth = d.stroke.weight as number;
    (style as any).borderStyle = (d.stroke?.dashPattern && d.stroke.dashPattern.length) ? "dashed" : "solid";
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
    const shadows = (d as any).effects.map((e: any) => e.boxShadow).filter(Boolean) as string[]; if (shadows.length) (style as any).boxShadow = shadows.join(", ");
  }

  // strip paddings
  if ((d.ux?.padL ?? 0) || (d.ux?.padR ?? 0)) {
    (style as any).paddingLeft = d.ux?.padL ?? 0; (style as any).paddingRight = d.ux?.padR ?? 0;
  }

  // Text
  if (isText && d.text) {
    if (d.text.fontSize != null) (style as any).fontSize = d.text.fontSize as number;
    if (d.text.fontFamily) (style as any).fontFamily = d.text.fontFamily as string;
    if (d.text.fontWeight != null) (style as any).fontWeight = d.text.fontWeight as any;
    if (d.text.fontStyle === "italic") (style as any).fontStyle = "italic";
    if (d.text.color) (style as any).color = d.text.color as string;

    // Optional: honor explicit horizontal alignment only (doesn't shift metrics)
    const ta = d.text.textAlignHorizontal;
    if (ta) (style as any).textAlign = ta.toLowerCase() === "justified" ? "justify" : ta.toLowerCase();

    // Note: intentionally NOT setting:
    // - lineHeight (browser/default metrics align with absolute coordinates)
    // - letterSpacing (can shift glyph widths vs snapshot)
    // - whiteSpace/wordBreak/overflowWrap (Box handles layout without forcing wraps)
  }

  // scroller flags
  if (d.ux?.scrollX) { (style as any).overflowX = "auto"; (style as any).overflowY = "hidden"; (style as any).WebkitOverflowScrolling = "touch"; }
  if (d.ux?.snap) { (style as any).scrollSnapType = "x mandatory"; (style as any).scrollBehavior = "smooth"; }

  return style;
}

/* image helpers */
function resolveImgSrc(d: DrawableNode, manifest: Map<string, string>): string {
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
      (d.corners?.uniform ?? d.corners?.topLeft ?? d.corners?.topRight ?? d.corners?.bottomRight ?? d.corners?.bottomLeft) ?? 0,
  };
  const styleJson = JSON.stringify(style).replace(/\"([^\"]+)\":/g, "$1:");
  const srcLocal = resolveImgSrc(d, manifest);
  const alt = d.name || "image";
  return `<Img style={${styleJson}} src=${JSON.stringify(srcLocal)} alt=${JSON.stringify(alt)} />`;
}

function jsxImgCoverInsideWrapper(d: DrawableNode, manifest: Map<string, string>) {
  const style: Record<string, any> = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius:
      (d.corners?.uniform ?? d.corners?.topLeft ?? d.corners?.topRight ?? d.corners?.bottomRight ?? d.corners?.bottomLeft) ?? 0,
  };
  const styleJson = JSON.stringify(style).replace(/\"([^\"]+)\":/g, "$1:");
  const srcLocal = resolveImgSrc(d, manifest);
  const alt = d.name || "image";
  return `<Img style={${styleJson}} src=${JSON.stringify(srcLocal)} alt=${JSON.stringify(alt)} />`;
}
function jsxBoxWithStyleTree(d: DrawableNode) {
  const style = cssFromDrawableLocal(d); const styleJson = JSON.stringify(style).replace(/\"([^\"]+)\":/g, "$1:");
  const isText = String(d.type).toUpperCase() === "TEXT"; const rawText = isText ? (d.text?.characters ?? d.textRaw ?? "") : (d.text?.characters ?? d.textRaw ?? null);
  const textExpr = JSON.stringify(rawText); return `<Box style={${styleJson}} dataName=${JSON.stringify(d.name)} text=${textExpr} isText={${isText}} />`;
}

/* render with rails/peek/snap/elevation */
export function renderTree(nodes: DrawableNode[], manifest: Map<string, string>, indent = 6): string {
  const pad = (n: number) => " ".repeat(n);
  const out: string[] = [];

  for (const n of nodes) {
    const kind = nodeKind(n);

    if (n.children.length > 0) {
      const wrapperStyleObj = cssFromDrawableLocal(n);
      const doPeek = (n.ux as any)?.peek === true;
      if (doPeek) (wrapperStyleObj as any).paddingRight = 48;
      const wrapperStyle = JSON.stringify(wrapperStyleObj).replace(/\"([^\"]+)\":/g, "$1:");

      if (n.ux?.scrollX) {
        const railW = Math.max(1, ...n.children.map(c => c.x + c.w));
        const railStyleObj: any = { position: "relative", width: railW, height: "100%" };
        if (doPeek) railStyleObj.marginLeft = -48;
        const railStyle = JSON.stringify(railStyleObj).replace(/\"([^\"]+)\":/g, "$1:");

        out.push(pad(indent) + `<div style={${wrapperStyle}} data-name=${JSON.stringify(n.name)}>`);
        out.push(pad(indent + 2) + `<div style={${railStyle}}>`);
        for (const c of n.children) {
          const cs = cssFromDrawableLocal(c);
          if ((c.ux as any)?.elevate) {
            (cs as any).zIndex = 2;
            const base = (cs as any).boxShadow || "0px 0px 13px 0px rgba(0,0,0,0.20)";
            (cs as any).boxShadow = "0px 12px 28px rgba(0,0,0,0.22), " + base;
          } else if (n.ux?.scrollX && !(c.ux as any)?.snapAlign) {
            const base = (cs as any).boxShadow;
            if (base) (cs as any).boxShadow = base.replace(/0\.2\)/g, "0.14)");
          }
          if (c.ux?.snapAlign) (cs as any).scrollSnapAlign = c.ux.snapAlign;
          const csJson = JSON.stringify(cs).replace(/\"([^\"]+)\":/g, "$1:");
          const ck = nodeKind(c);

          if (c.children.length > 0) {
            out.push(pad(indent + 4) + `<div style={${csJson}} data-name=${JSON.stringify(c.name)}>`);
            if (ck === "IMAGE") {
              out.push(pad(indent + 6) + jsxImgCoverInsideWrapper(c, manifest));
            }
            out.push(renderTree(c.children, manifest, indent + 6));
            out.push(pad(indent + 4) + `</div>`);
          } else if (ck === "IMAGE") {
            out.push(pad(indent + 4) + jsxImgWithStyleLocalTree(c, manifest));
          } else {
            out.push(pad(indent + 4) + jsxBoxWithStyleTree(c));
          }
        }
        out.push(pad(indent + 2) + `</div>`);
        out.push(pad(indent) + `</div>`);
        continue;
      }

      out.push(pad(indent) + `<div style={${wrapperStyle}} data-name=${JSON.stringify(n.name)}>`);
      if (kind === "IMAGE") {
        out.push(pad(indent + 2) + jsxImgCoverInsideWrapper(n, manifest));
      }
      out.push(renderTree(n.children, manifest, indent + 2));
      out.push(pad(indent) + `</div>`);
      continue;
    }

    if (kind === "IMAGE") {
      out.push(pad(indent) + jsxImgWithStyleLocalTree(n, manifest));
    } else {
      out.push(pad(indent) + jsxBoxWithStyleTree(n));
    }
  }

  return out.join("\n");
}


/* Box helper injected into pages */
export function boxHelperTsStyled() {
  return `"use client";
import type React from "react";

export function Box({ style, dataName, text, isText, children, onClick }:{
  style: React.CSSProperties; dataName: string; text?: string | ""; isText: boolean; children?: React.ReactNode; onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const hasPad = style.padding != null || style.paddingLeft != null || style.paddingRight != null || style.paddingTop != null || style.paddingBottom != null;
  const innerStyle: React.CSSProperties = { width: "100%", height: "100%", display: isText ? "inline-flex" : "flex", alignItems: "flex-start", justifyContent: "flex-start",
    overflow: "visible", textAlign: isText ? "left" : "center", boxSizing: "border-box", ...(hasPad ? {} : { padding: 4 }) };
  const paraGap = (style as any).paragraphSpacing != null ? Number((style as any).paragraphSpacing) : 0;
  const textStyle: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%", ...(paraGap ? { marginBottom: paraGap } : {}) };
  return (<div style={style} data-name={dataName} onClick={onClick}><div style={innerStyle}>{isText && text !== "" && text !== undefined ? (<div style={textStyle}>{text}</div>) : null}{children}</div></div>);
}
// emitted with pages
export function Img({ style, src, alt }: { style: React.CSSProperties; src: string; alt?: string; }) {
  const merged: React.CSSProperties = {
    ...style,
    background: src ? (style as any)?.background : (style as any)?.background || "rgba(240,240,240,1)",
  };
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt || ""} style={merged} /> : <div style={merged} aria-hidden="true" data-img-missing="" />;
}
`;
}
export function imgHelperTs() { return ""; }
