/* app/api/convert/builders/next.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame, Interaction } from "../core/types";
import { renderTree, boxHelperTsStyled, imgHelperTs } from "../core/render";
import { flattenTreeToNodes } from "../core/tree";
import { globalsCss, tokensTs, colorUtilTs, readme } from "../shared/styles";

/* --- live templates injected into the zip --- */
function nextLivePageTsx(initialSnapJson?: string) {
  return `"use client";
import React from "react";
import { LiveTree } from "../src/live/runtime";

function ResponsiveStage({ refW, refH, children }: { refW: number; refH: number; children: React.ReactNode }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = outerRef.current; if (!el) return;
    const measure = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width || 0;
      setScale(w > 0 ? Math.max(0.01, w / refW) : 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el); measure();
    return () => ro.disconnect();
  }, [refW]);
  return (
    <div ref={outerRef} style={{ position: "relative", width: "100%", height: "100vh", overflow: "auto", background: "#fff" }}>
      <div style={{ width: "100%", height: \`\${Math.max(1, refH * scale)}px\` }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: refW, height: refH, transform: \`scale(\${scale})\`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Defensive INITIAL_SNAP: may be null or a prebuilt snapshot object.
 * Normalize fetched snapshots so nodes always have x,y,width,height and image fills resolved.
 */
const INITIAL_SNAP = ${initialSnapJson || "null"};

function normalizeSnapshot(raw:any) {
  try {
    if (!raw || typeof raw !== "object") return null;
    // Accept server shapes under .payload or direct payload
    const src = raw.payload ? raw.payload : raw;
    if (!src || !Array.isArray(src.roots)) return null;

    // Manifest resolver: ensure public paths
    const manifest: Record<string,string> = {};
    if (src.manifest && typeof src.manifest === "object") {
      for (const k of Object.keys(src.manifest)) {
        try {
          const v = src.manifest[k];
          manifest[k] = typeof v === "string" ? v.replace(/^assets\\//, "/assets/") : String(v || "");
        } catch {
          manifest[k] = "";
        }
      }
    }

    // Recursive adapter: map w/h -> width/height, coerce numbers, preserve ax/ay, preserve w/h, resolve image fills
    function adaptNode(n:any): any {
      if (!n || typeof n !== "object") return n;
      const x = Math.round(n.x ?? 0);
      const y = Math.round(n.y ?? 0);
      // compute canonical numeric values for both w/h and width/height
      const wVal = Math.round(n.w ?? n.width ?? 0);
      const hVal = Math.round(n.h ?? n.height ?? 0);

      let fill = n.fill ?? null;
      if (fill && typeof fill === "object" && fill.type === "IMAGE" && fill.imageRef) {
        const srcUrl = manifest[fill.imageRef] || null;
        // keep original fill metadata but add src for runtime convenience
        fill = { ...fill, src: srcUrl };
      }

      const text = n.text ?? (String(n.type||"").toUpperCase() === "TEXT" ? { characters: n.characters ?? n.textRaw ?? "" } : null);

      const children = Array.isArray(n.children) ? n.children.map((c:any)=>adaptNode(c)) : [];

      // Preserve other useful props and keep ax/ay and w/h intact
      const out: any = {
        ...n,
        x, y,
        // keep both representations to be compatible with different runtimes
        w: wVal,
        h: hVal,
        width: (n.width ?? wVal),
        height: (n.height ?? hVal),
        fill,
        text,
        children,
        // preserve ax/ay if present
        ax: (n.ax ?? n.ax),
        ay: (n.ay ?? n.ay),
      };
      // Do NOT delete w/h or ax/ay so runtime that expects them still works
      return out;
    }

    const adaptedRoots = src.roots.map(adaptNode);
    const refW = Number(src.refW ?? src.width ?? 0) || 0;
    const refH = Number(src.refH ?? src.height ?? 0) || 0;
    const interactions = Array.isArray(src.interactions) ? src.interactions : [];
    return { version: raw.version ?? 1, payload: { roots: adaptedRoots, manifest, refW, refH, interactions } };
  } catch (e) {
    return null;
  }
}

export default function Page() {
  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;
  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;
  const [snap, setSnap] = React.useState<any>(INITIAL_SNAP);

  const fetchSnapshot = React.useCallback(async () => {
    try {
      const res = await fetch(\`\${origin}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`, { credentials: "include" });
      if (!res.ok) return; // ignore non-ok responses
      const raw = await res.json();
      const normalized = normalizeSnapshot(raw);
      if (normalized) {
        setSnap(normalized);
      } else {
        // invalid snapshot from server — keep current snap and log
        // eslint-disable-next-line no-console
        console.warn("Received invalid snapshot, ignoring.");
      }
    } catch (err) {
      // network/parsing error — ignore to avoid breaking UI
      // eslint-disable-next-line no-console
      console.warn("Failed to fetch snapshot:", err);
    }
  }, [origin, fileKey]);

  React.useEffect(() => {
    // Try to hydrate from server, but don't overwrite a valid INITIAL_SNAP with invalid data.
    fetchSnapshot();
    let es: EventSource | null = null;
    try {
      es = new EventSource(\`\${origin}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`, { withCredentials: true } as any);
      es.addEventListener("version", () => { fetchSnapshot(); });
      es.onerror = () => { /* ignore es errors, keep trying */ };
    } catch (e) {
      // if EventSource creation fails, continue without live updates
      // eslint-disable-next-line no-console
      console.warn("EventSource failed to start:", e);
      es = null;
    }
    return () => { if (es) es.close(); };
  }, [origin, fileKey, fetchSnapshot]);

  if (!snap || !snap.payload || !Array.isArray(snap.payload.roots)) {
    return <div style={{ padding: 24 }}>Waiting for snapshot…</div>;
  }
  const { refW, refH, roots, manifest, interactions } = snap.payload;
  return (
    <ResponsiveStage refW={refW} refH={refH}>
      <LiveTree nodes={roots} manifest={manifest} interactions={interactions || []} />
    </ResponsiveStage>
  );
}
`;
}

function liveRuntimeTsx() {
  return `"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";

export function Box({ style, dataName, dataNodeId, text, isText, children, onClick, asButton }:{
  style: React.CSSProperties; dataName: string; dataNodeId?: string; text?: string | ""; isText: boolean; children?: React.ReactNode; onClick?: React.MouseEventHandler<HTMLElement>; asButton?: boolean;
}) {
  const hasPad = style.padding != null || style.paddingLeft != null || style.paddingRight != null || style.paddingTop != null || style.paddingBottom != null;
  const inner: React.CSSProperties = { width: "100%", height: "100%", display: isText ? "inline-flex" : "flex", alignItems: "flex-start", justifyContent: "flex-start", overflow: "visible", textAlign: isText ? "left" : "center", boxSizing: "border-box", ...(hasPad ? {} : { padding: 4 }) };
  const textStyle: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%" };
  if (asButton) {
    const btnStyle: React.CSSProperties = { ...style, cursor: "pointer", background: (style as any).background, border: (style as any).border, borderRadius: (style as any).borderRadius };
    return (
      <button type="button" style={btnStyle} data-name={dataName} data-node-id={dataNodeId} aria-label={(text as any) || dataName} onClick={onClick}>
        <div style={inner}>{isText && text ? <div style={textStyle}>{text}</div> : null}{children}</div>
      </button>
    );
  }
  return (<div style={style} data-name={dataName} data-node-id={dataNodeId} onClick={onClick}><div style={inner}>{isText && text ? <div style={textStyle}>{text}</div> : null}{children}</div></div>);
}

export function Img({ style, src, alt }:{ style: React.CSSProperties; src: string; alt?: string; }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || ""} style={style} />;
}

function nodeKind(n:any): "TEXT" | "IMAGE" | "SHAPE" {
  if (String(n.type||"").toUpperCase()==="TEXT") return "TEXT";
  if (n.fill?.type==="IMAGE" && n.fill.imageRef) return "IMAGE";
  return "SHAPE";
}

function cssFromNode(n:any): React.CSSProperties {
  const isText = String(n.type||"").toUpperCase()==="TEXT";
  const isImage = n.fill?.type==="IMAGE" && !!n.fill.imageRef;
  const s:any = { position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, boxSizing: "border-box" };

  if (!isText && n.stroke?.weight && (n.w===0 || n.h===0)) {
    if (n.w===0) s.width=1; if (n.h===0) s.height=1;
    if (n.stroke?.color) s.background=n.stroke.color; return s;
  }
  if (!isText) {
    if (!isImage && n.fill?.type==="SOLID" && n.fill.color) s.background = n.fill.color;
    else if (!isImage && String(n.fill?.type||"").startsWith("GRADIENT") && n.fill.stops?.length) {
      const stops = n.fill.stops.map((st:any)=>\`\${st.color} \${Math.round((st.position??0)*100)}%\`).join(", ");
      s.backgroundImage = \`linear-gradient(180deg, \${stops})\`; s.backgroundSize = "cover";
    }
  }
  if (!isText && n.stroke?.weight) {
    s.borderWidth = n.stroke.weight; s.borderStyle = n.stroke.dashPattern?.length ? "dashed" : "solid";
    if (n.stroke.color) s.borderColor = n.stroke.color;
  }
  if (n.corners) {
    const c=n.corners; let has=false;
    if (c.topLeft!=null){s.borderTopLeftRadius=c.topLeft; has=true;}
    if (c.topRight!=null){s.borderTopRightRadius=c.topRight; has=true;}
    if (c.bottomRight!=null){s.borderBottomRightRadius=c.bottomRight; has=true;}
    if (c.bottomLeft!=null){s.borderBottomLeftRadius=c.bottomLeft; has=true;}
    if (!has && c.uniform!=null){s.borderRadius=c.uniform; has=true;}
    if (has) s.contain="paint";
  }
  if (Array.isArray(n.effects) && n.effects.length){
    const sh=n.effects.map((e:any)=>e.boxShadow).filter(Boolean);
    if (sh.length) s.boxShadow = sh.join(", ");
  }
  if (n.ux?.padL || n.ux?.padR){ s.paddingLeft = n.ux.padL||0; s.paddingRight = n.ux.padR||0; }
  if (isText && n.text){
    if (n.text.fontSize!=null) s.fontSize = n.text.fontSize;
    if (n.text.fontFamily) s.fontFamily = n.text.fontFamily;
    if (n.text.fontWeight!=null) s.fontWeight = n.text.fontWeight;
    if (n.text.fontStyle==="italic") s.fontStyle = "italic";
    if (n.text.color) s.color = n.text.color;
    if (n.text.textAlignHorizontal) s.textAlign = String(n.text.textAlignHorizontal).toLowerCase()==="justified"?"justify":String(n.text.textAlignHorizontal).toLowerCase();
  }
  if (n.ux?.scrollX){ s.overflowX="auto"; s.overflowY="hidden"; s.WebkitOverflowScrolling="touch"; }
  if (n.ux?.snap){ s.scrollSnapType="x mandatory"; s.scrollBehavior="smooth"; }
  return s as React.CSSProperties;
}

export function LiveTree({ nodes, manifest, interactions, frameRoutes, nodeToFrame }:{ nodes:any[]; manifest:Record<string,string>; interactions: any[]; frameRoutes?: Record<string,string>; nodeToFrame?: Record<string,string>; }) {
  const router = useRouter();
  const pathname = usePathname();
  const interactionsBySource = React.useMemo(()=>{
    const m = new Map<string, any[]>();
    (interactions||[]).forEach((it:any)=>{
      if (!it || !it.sourceId) return; if (!m.has(it.sourceId)) m.set(it.sourceId, []);
      m.get(it.sourceId)!.push(it);
    });
    return m;
  }, [interactions]);

  const handleNav = React.useCallback((targetId:string)=>{
    try {
      const tf = (nodeToFrame && nodeToFrame[targetId]) || targetId;
      const path = frameRoutes && frameRoutes[tf];
      if (path) {
        if (pathname === path) {
          const el = document.querySelector('[data-node-id="'+CSS.escape(String(targetId))+'"]') as HTMLElement | null;
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        } else {
          router.push(path);
        }
        return;
      }
      // fallback to scroll if no route known
      const el = document.querySelector('[data-node-id="'+CSS.escape(String(targetId))+'"]') as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } catch {}
  }, [router, pathname, frameRoutes, nodeToFrame]);

  const onClickForNode = (nodeId:string) => (e: React.MouseEvent) => {
    const list = interactionsBySource.get(nodeId) || [];
    for (const it of list) {
      if (!it || (it.trigger && it.trigger !== "onClick")) continue;
      if (it.type === "navigation" && it.targetId) handleNav(it.targetId);
      // simple animation demo: fade target
      if (it.type === "animation" && it.targetId) {
        const t = document.querySelector('[data-node-id="'+CSS.escape(String(it.targetId))+'"]') as HTMLElement | null;
        if (t) {
          const dur = Math.max(50, Math.min(2000, Number(it.animation?.durationMs || 300)));
          t.style.transition = 'opacity '+dur+'ms';
          const prev = t.style.opacity || '1';
          t.style.opacity = '0';
          requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ t.style.opacity = prev; }); });
        }
      }
    }
  };

  const render = (arr:any[], depth=0): React.ReactNode[] => arr.map((n, idx)=>{
    const kind = nodeKind(n);
    if (n.children?.length){
      const wrapStyle = cssFromNode(n);
      // Ensure top-level frame anchors at (0,0)
      if (depth === 0) { (wrapStyle as any).left = 0; (wrapStyle as any).top = 0; }
      const list = interactionsBySource.get(n.id)||[];
      const hasClick = list.some((it:any)=>!it.trigger || it.trigger==="onClick");
      const isNav = list.some((it:any)=>it.type==="navigation");
      const bg = kind==="IMAGE" && n.fill?.imageRef
        ? (() => {
            // Respect the fill's fit mode: cover (default), contain, fill
            const fitMode = n.fill?.fit || "cover";
            const objectFit = fitMode === "fill" ? "fill" : fitMode === "contain" ? "contain" : "cover";
            return <Img key={\`\${n.id}-bg\`} style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit, borderRadius: (wrapStyle as any).borderRadius as any }} src={manifest[n.fill.imageRef]||""} />;
          })()
        : null;
      return (
        <Box key={n.id||\`\${depth}-\${idx}\`} style={wrapStyle} dataName={n.name} dataNodeId={n.id} text={""} isText={false} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={isNav}>
          {bg}
          {render(n.children, depth+1)}
        </Box>
      );
    }
    if (kind==="IMAGE" && n.fill?.imageRef){
      // Respect the fill's fit mode: cover (default), contain, fill
      const fitMode = n.fill?.fit || "cover";
      const objectFit = fitMode === "fill" ? "fill" : fitMode === "contain" ? "contain" : "cover";
      const style = { position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h, borderRadius:(n.corners?.uniform??0) } as React.CSSProperties;
      const list = interactionsBySource.get(n.id)||[];
      const hasClick = list.some((it:any)=>!it.trigger || it.trigger==="onClick");
      const isNav = list.some((it:any)=>it.type==="navigation");
      return (
        <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} dataNodeId={n.id} text={""} isText={false} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={isNav}>
          <Img style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit }} src={manifest[n.fill.imageRef]||""} alt={n.name} />
        </Box>
      );
    }
    const style = cssFromNode(n);
    if (depth === 0) { (style as any).left = 0; (style as any).top = 0; }
    const text = String(n.type||"").toUpperCase()==="TEXT" ? (n.text?.characters ?? n.textRaw ?? "") : "";
    const isText = String(n.type||"").toUpperCase()==="TEXT";
    const list = interactionsBySource.get(n.id)||[];
    const hasClick = list.some((it:any)=>!it.trigger || it.trigger==="onClick");
    const isNav = list.some((it:any)=>it.type==="navigation");
    return <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} dataNodeId={n.id} text={text} isText={isText} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={isNav} />;
  });
  return <>{render(nodes)}</>;
}
`;
}

function envLocal(liveOrigin: string, fileKey: string) {
  return `NEXT_PUBLIC_LIVE_ORIGIN=${liveOrigin}
NEXT_PUBLIC_FILE_KEY=${fileKey}
`;
}

/* --- builder --- */
export function buildNext(
  zip: JSZip,
  name: string,
  roots: DrawableNode[],
  ref: ReferenceFrame | null,
  imageManifest: Map<string, string>,
  imageBlobs: Map<string, { path: string; bytes: Uint8Array }>,
  opts?: { liveOrigin?: string; fileKey?: string; interactions?: Interaction[] }
) {
  const pkg = {
    name, private: true, version: "1.0.0",
    scripts: { dev: "next dev -p 3002", build: "next build", start: "next start -p 3002" },
    dependencies: { next: "^14.2.0", react: "^18.2.0", "react-dom": "^18.2.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "nextjs", imageManifest));

  const pub = zip.folder("public")!;
  pub.file(".gitkeep", "");
  const pubAssets = pub.folder("assets")!;
  pubAssets.file(".gitkeep", "");
  for (const [, v] of imageBlobs) pubAssets.file(v.path.replace(/^assets\//, ""), v.bytes);

  const app = zip.folder("app")!;
  app.file("layout.tsx", nextLayout());

  // Build manifest object with public paths
  const manifestObj: Record<string, string> = {};
  for (const [k, v] of imageManifest) {
    // ensure paths point to /assets/ when using the public folder
    manifestObj[k] = typeof v === "string" ? v.replace(/^assets\//, "/assets/") : String(v);
  }
  app.file("globals.css", globalsCss());

  // Helper slug generator
  const slugify = (s: string) => (s || "frame")
    .toLowerCase()
    .replace(/[^a-z0-9\-\_\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "frame";

  // Compute node->frame and frame routes
  const nodeToFrame: Record<string, string> = {};
  const frameRoutes: Record<string, string> = {};
  const frameMeta: Array<{ id: string; name: string; slug: string }> = [];
  const visit = (root: DrawableNode) => {
    const stack: DrawableNode[] = [root];
    while (stack.length) { const n = stack.pop()!; nodeToFrame[n.id] = root.id; for (const c of n.children) stack.push(c); }
  };
  for (const r of roots) { visit(r); const slug = slugify(r.name || r.id); frameRoutes[r.id] = "/" + slug; frameMeta.push({ id: r.id, name: r.name || r.id, slug }); }

  const interactions = Array.isArray(opts?.interactions) ? opts!.interactions! : [];

  // Index page: redirect to first frame for a cleaner default experience
  const indexHtml = (() => {
    if (frameMeta.length === 0) {
      return `export default function Page(){ return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>No frames to render.</div>; }`;
    }
    const first = frameMeta[0];
    return `import { redirect } from 'next/navigation';\nexport default function Page(){ redirect('/${first.slug}'); }`;
  })();
  app.file("page.tsx", indexHtml);

  // Responsive stage helper shared by pages
  const responsiveStage = `function ResponsiveStage({ refW, refH, children }: { refW:number; refH:number; children: React.ReactNode }){\n  const outerRef = React.useRef<HTMLDivElement>(null);\n  const [scale, setScale] = React.useState(1);\n  React.useLayoutEffect(()=>{\n    const el = outerRef.current; if (!el) return;\n    const measure = () => { const w = el.clientWidth || el.getBoundingClientRect().width || 0; setScale(w>0? Math.max(0.01, w/refW) : 1); };\n    const ro = new ResizeObserver(measure); ro.observe(el); measure(); return ()=>ro.disconnect();\n  }, [refW]);\n  return (<div ref={outerRef} style={{ position:"relative", width:"100%", height:"100vh", overflow:"auto", background:"#fff" }}>\n    <div style={{ width:"100%", height: \`${'${'}Math.max(1, refH * scale)${'}'}px\` }} />\n    <div style={{ position:"absolute", left:0, top:0, width: refW, height: refH, transform: \`scale(${'${'}scale${'}'})\`, transformOrigin:"top left" }}>{children}</div>\n  </div>);\n}`;

  // Create a page for each frame
  for (const f of frameMeta) {
    const folder = app.folder(f.slug)!;
    const frameNode = roots.find(r => r.id === f.id)!;
    const refW = (ref && (ref.width || 0)) || frameNode.w;
    const refH = (ref && (ref.height || 0)) || frameNode.h;
  const pageSrc = `"use client"\nimport React from "react";\nimport { LiveTree } from "../../src/live/runtime";\n${responsiveStage}\n\nconst FRAME_ID = ${JSON.stringify(f.id)};\nconst INITIAL_NODES = ${JSON.stringify([frameNode])};\nconst INITIAL_MANIFEST = ${JSON.stringify(manifestObj)};\nconst INITIAL_INTERACTIONS = ${JSON.stringify(interactions)};\n\nfunction normalizeSnapshot(raw:any){\n  try {\n    if (!raw || typeof raw !== 'object') return null;\n    const src = (raw.payload ? raw.payload : raw) || {};\n    if (!Array.isArray(src.roots)) return null;\n    const manifest: Record<string,string> = {};\n    if (src.manifest && typeof src.manifest === 'object') {\n      for (const k of Object.keys(src.manifest)) {\n        try { const v = src.manifest[k]; manifest[k] = typeof v === 'string' ? v.replace(/^assets\\\//, '/assets/') : String(v||''); } catch { manifest[k] = ''; }\n      }\n    }\n    return { roots: src.roots, manifest, interactions: Array.isArray(src.interactions) ? src.interactions : [] };\n  } catch { return null; }\n}\nfunction findNodeById(arr:any[], id:string): any|null {\n  const stack = Array.isArray(arr) ? [...arr] : [];\n  while (stack.length){ const n = stack.pop(); if (n && n.id === id) return n; if (n && Array.isArray(n.children)) for (const c of n.children) stack.push(c); }\n  return null;\n}\n\nexport default function Page(){\n  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;\n  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;\n  const [nodes, setNodes] = React.useState<any[]>(INITIAL_NODES);\n  const [manifest, setManifest] = React.useState<Record<string,string>>(INITIAL_MANIFEST);\n  const [interactions, setInteractions] = React.useState<any[]>(INITIAL_INTERACTIONS);\n  const [refW, setRefW] = React.useState<number>(INITIAL_NODES[0]?.w || INITIAL_NODES[0]?.width || ${refW});\n  const [refH, setRefH] = React.useState<number>(INITIAL_NODES[0]?.h || INITIAL_NODES[0]?.height || ${refH});\n\n  const fetchSnapshot = React.useCallback(async ()=>{\n    try {\n      const res = await fetch(\`${'${'}origin${'}'}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`, { credentials: 'include' });\n      if (!res.ok) return;\n      const raw = await res.json();\n      const norm = normalizeSnapshot(raw);\n      if (!norm) return;\n      const node = findNodeById(norm.roots, FRAME_ID);\n      if (node) {\n        setNodes([node]);\n        const w = Number(node.w ?? node.width ?? 0) || refW;\n        const h = Number(node.h ?? node.height ?? 0) || refH;\n        setRefW(w); setRefH(h);\n      }\n      setManifest(norm.manifest || {});\n      if (Array.isArray(norm.interactions)) setInteractions(norm.interactions);\n    } catch { /* ignore */ }\n  }, [origin, fileKey]);\n\n  React.useEffect(()=>{\n    fetchSnapshot();\n    let es: EventSource | null = null;\n    try {\n      es = new EventSource(\`${'${'}origin${'}'}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`, { withCredentials: true } as any);\n      es.addEventListener('version', ()=>{ fetchSnapshot(); });\n      es.onerror = ()=>{};\n    } catch { es = null; }\n    return ()=>{ if (es) es.close(); }\n  }, [origin, fileKey, fetchSnapshot]);\n\n  return (<ResponsiveStage refW={refW} refH={refH}>\n    <LiveTree nodes={nodes} manifest={manifest} interactions={interactions} frameRoutes=${JSON.stringify(frameRoutes)} nodeToFrame=${JSON.stringify(nodeToFrame)} />\n  </ResponsiveStage>);\n}`;
    folder.file("page.tsx", pageSrc);
  }

  // Add runtime helpers
  const src = zip.folder("src")!;
  const liveFolder = src.folder("live")!;
  liveFolder.file("runtime.tsx", liveRuntimeTsx());
  liveFolder.file("types.ts", `export type LiveSnapshot = { version: number; payload: { roots:any[]; manifest: Record<string,string>; refW:number; refH:number; interactions: any[]; } };`);

  // Pre-fill env so the app connects back to the editor that did the conversion
  const liveOrigin = (opts?.liveOrigin || "http://localhost:3001").replace(/\/$/, "");
  const fileKey = opts?.fileKey || "BO4SUjwC6DDP1zHCu1RcaJ";
  zip.file(".env.local", envLocal(liveOrigin, fileKey));

  zip.file("tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2021", lib: ["dom", "dom.iterable", "esnext"], allowJs: false, skipLibCheck: true, strict: true,
      forceConsistentCasingInFileNames: true, noEmit: true, esModuleInterop: true, module: "esnext",
      moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", baseUrl: ".", paths: {}
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"], exclude: ["node_modules"],
  }, null, 2));
  zip.file("next-env.d.ts", `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`);

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
