// helpers for live files (put in app/api/convert/core/live-templates.ts or inline)
export function nextLivePageTsx() {
  return `"use client";
import React from "react";
import { LiveTree } from "../src/live/runtime";

function ResponsiveStage({ refW, refH, children }: { refW: number; refH: number; children: React.ReactNode }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = outerRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth || el.getBoundingClientRect().width || 0; setScale(w > 0 ? Math.max(0.01, w / refW) : 1); };
    const ro = new ResizeObserver(measure); ro.observe(el); measure(); return () => ro.disconnect();
  }, [refW]);
  return (
    <div ref={outerRef} style={{ position: "relative", width: "100%", height: "100vh", overflow: "auto", background: "#fff" }}>
      <div style={{ width: "100%", height: \`\${Math.max(1, refH * scale)}px\` }} />
  <div style={{ position: "absolute", left: 0, top: 0, width: refW, height: refH, transform: 'scale(' + String(scale) + ')', transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

export default function Page() {
  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;
  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;
  const [snap, setSnap] = React.useState<any>(null);

  const fetchSnapshot = React.useCallback(async () => {
    const res = await fetch(\`\${origin}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`, { credentials: "include" });
    if (res.ok) setSnap(await res.json());
  }, [origin, fileKey]);

  React.useEffect(() => {
    fetchSnapshot();
    const es = new EventSource(\`\${origin}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`, { withCredentials: true } as any);
    es.addEventListener("version", () => { fetchSnapshot(); });
    es.onerror = () => {};
    return () => { es.close(); };
  }, [origin, fileKey, fetchSnapshot]);

  if (!snap) return <div style={{ padding: 24 }}>Waiting for snapshot…</div>;
  const { refW, refH, roots, manifest } = snap.payload;
  return (
    <ResponsiveStage refW={refW} refH={refH}>
      <LiveTree nodes={roots} manifest={manifest} />
    </ResponsiveStage>
  );
}
`;
}

export function liveRuntimeTsx() {
  return `"use client";
import React from "react";

export function Box({ style, dataName, text, isText, children }:{
  style: React.CSSProperties; dataName: string; text?: string | ""; isText: boolean; children?: React.ReactNode;
}) {
  const hasPad = style.padding != null || style.paddingLeft != null || style.paddingRight != null || style.paddingTop != null || style.paddingBottom != null;
  const inner: React.CSSProperties = { width: "100%", height: "100%", display: isText ? "inline-flex" : "flex", alignItems: "flex-start", justifyContent: "flex-start", overflow: "visible", textAlign: isText ? "left" : "center", boxSizing: "border-box", ...(hasPad ? {} : { padding: 4 }) };
  const textStyle: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%" };
  return (<div style={style} data-name={dataName}><div style={inner}>{isText && text ? <div style={textStyle}>{text}</div> : null}{children}</div></div>);
}

export function Img({ style, src, alt }:{ style: React.CSSProperties; src: string; alt?: string; }) {
  if (!src) return null;
  return <img src={src} alt={alt || ""} style={style} />;
}

function nodeKind(n:any): "TEXT" | "IMAGE" | "SHAPE" { if (String(n.type||"").toUpperCase()==="TEXT") return "TEXT"; if (n.fill?.type==="IMAGE" && n.fill.imageRef) return "IMAGE"; return "SHAPE"; }

function cssFromNode(n:any): React.CSSProperties {
  const isText = String(n.type||"").toUpperCase()==="TEXT";
  const isImage = n.fill?.type==="IMAGE" && !!n.fill.imageRef;
  const s:any = { position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, boxSizing: "border-box" };
  if (!isText && n.stroke?.weight && (n.w===0 || n.h===0)) { if (n.w===0) s.width=1; if (n.h===0) s.height=1; if (n.stroke?.color) s.background=n.stroke.color; return s; }
  if (!isText) {
    if (!isImage && n.fill?.type==="SOLID" && n.fill.color) s.background = n.fill.color;
    else if (!isImage && String(n.fill?.type||"").startsWith("GRADIENT") && n.fill.stops?.length) {
      const stops = n.fill.stops.map((st:any)=>\`\${st.color} \${Math.round((st.position??0)*100)}%\`).join(", ");
      s.backgroundImage = \`linear-gradient(180deg, \${stops})\`; s.backgroundSize = "cover";
    }
  }
  if (!isText && n.stroke?.weight) { s.borderWidth = n.stroke.weight; s.borderStyle = n.stroke.dashPattern?.length ? "dashed" : "solid"; if (n.stroke.color) s.borderColor = n.stroke.color; }
  if (n.corners) { const c=n.corners; let has=false; if (c.topLeft!=null){s.borderTopLeftRadius=c.topLeft; has=true;} if (c.topRight!=null){s.borderTopRightRadius=c.topRight; has=true;} if (c.bottomRight!=null){s.borderBottomRightRadius=c.bottomRight; has=true;} if (c.bottomLeft!=null){s.borderBottomLeftRadius=c.bottomLeft; has=true;} if (!has && c.uniform!=null){s.borderRadius=c.uniform; has=true;} if (has) s.contain="paint"; }
  if (Array.isArray(n.effects) && n.effects.length){ const sh=n.effects.map((e:any)=>e.boxShadow).filter(Boolean); if (sh.length) s.boxShadow = sh.join(", "); }
  if (n.ux?.padL || n.ux?.padR){ s.paddingLeft = n.ux.padL||0; s.paddingRight = n.ux.padR||0; }
  if (isText && n.text){ if (n.text.fontSize!=null) s.fontSize = n.text.fontSize; if (n.text.fontFamily) s.fontFamily = n.text.fontFamily; if (n.text.fontWeight!=null) s.fontWeight = n.text.fontWeight; if (n.text.fontStyle==="italic") s.fontStyle = "italic"; if (n.text.color) s.color = n.text.color; if (n.text.textAlignHorizontal) s.textAlign = String(n.text.textAlignHorizontal).toLowerCase()==="justified"?"justify":String(n.text.textAlignHorizontal).toLowerCase(); }
  if (n.ux?.scrollX){ s.overflowX="auto"; s.overflowY="hidden"; s.WebkitOverflowScrolling="touch"; }
  if (n.ux?.snap){ s.scrollSnapType="x mandatory"; s.scrollBehavior="smooth"; }
  return s as React.CSSProperties;
}

export function LiveTree({ nodes, manifest }:{ nodes:any[]; manifest:Record<string,string>; }) {
  const render = (arr:any[], depth=0): React.ReactNode[] => arr.map((n, idx)=>{
    const kind = nodeKind(n);
    if (n.children?.length){
      const wrapStyle = cssFromNode(n);
      const bg = kind==="IMAGE" && n.fill?.imageRef ? <Img key={\`\${n.id}-bg\`} style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit:"cover", borderRadius: wrapStyle.borderRadius as any }} src={manifest[n.fill.imageRef]||""} /> : null;
      return <div key={n.id||\`\${depth}-\${idx}\`} style={wrapStyle} data-name={n.name}>{bg}{render(n.children, depth+1)}</div>;
    }
    if (kind==="IMAGE" && n.fill?.imageRef){ const style = { position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h, objectFit:"cover", borderRadius:(n.corners?.uniform??0) } as React.CSSProperties; return <Img key={n.id||\`\${depth}-\${idx}\`} style={style} src={manifest[n.fill.imageRef]||""} alt={n.name} />; }
    const style = cssFromNode(n); const text = String(n.type||"").toUpperCase()==="TEXT" ? (n.text?.characters ?? n.textRaw ?? "") : ""; const isText = String(n.type||"").toUpperCase()==="TEXT";
    return <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} text={text} isText={isText} />;
  });
  return <>{render(nodes)}</>;
}
`;
}

export function envLocal(liveOrigin: string, fileKey: string) {
  return `NEXT_PUBLIC_LIVE_ORIGIN=${liveOrigin}
NEXT_PUBLIC_FILE_KEY=${fileKey}
`;
}
