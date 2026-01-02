/* app/api/convert/builders/next.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame, Interaction } from "../core/types";
import { renderTree, boxHelperTsStyled, imgHelperTs } from "../core/render";
import { flattenTreeToNodes } from "../core/tree";
import { globalsCss, tokensTs, colorUtilTs, readme } from "../shared/styles";

/* --- live templates injected into the zip --- */
export function nextLivePageTsx(initialSnapJson?: string) {
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
  <div style={{ position: "absolute", left: 0, top: 0, width: refW, height: refH, transform: 'scale(' + String(scale) + ')', transformOrigin: "top left" }}>
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
  const origin = (typeof window !== 'undefined' && (!process.env.NEXT_PUBLIC_LIVE_ORIGIN || process.env.NEXT_PUBLIC_LIVE_ORIGIN === '')) ? window.location.origin : (process.env.NEXT_PUBLIC_LIVE_ORIGIN as any);
  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;
  const [snap, setSnap] = React.useState<any>(INITIAL_SNAP);

  const fetchSnapshot = React.useCallback(async () => {
    try {
      const res = await fetch(\`\${origin}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`);
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
      es = new EventSource(\`\${origin}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`);
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
 
 function slugify(s:string){
   return (s||'frame')
     .toLowerCase()
     .replace(/[^a-z0-9\-\_\s]+/g,'-')
     .replace(/\s+/g,'-')
     .replace(/-+/g,'-')
     .replace(/^-|-$/g,'')
     .slice(0,48) || 'frame';
 }

export function Box({ style, dataName, dataNodeId, text, isText, children, onClick, asButton }:{
  style: React.CSSProperties; dataName: string; dataNodeId?: string; text?: string | ""; isText: boolean; children?: React.ReactNode; onClick?: React.MouseEventHandler<HTMLElement>; asButton?: boolean;
}) {
  // Split flex/layout props to inner so containers work as expected
  const flexKeys = ["display","flexDirection","justifyContent","alignItems","gap","rowGap","columnGap","padding","paddingTop","paddingRight","paddingBottom","paddingLeft","textAlign"] as const;
  const outer: React.CSSProperties = { ...style };
  const hasPad = (style as any).padding != null || (style as any).paddingLeft != null || (style as any).paddingRight != null || (style as any).paddingTop != null || (style as any).paddingBottom != null;
  const inner: React.CSSProperties = { width: "100%", height: "100%", display: isText ? "inline-flex" : "flex", alignItems: "flex-start", justifyContent: "flex-start", overflow: "visible", textAlign: isText ? "left" : "center", boxSizing: "border-box", ...(hasPad ? {} : { padding: 4 }) };
  for (const k of flexKeys) {
    const v = (style as any)[k as any];
    if (v != null) {
      (inner as any)[k as any] = v as any;
      delete (outer as any)[k as any];
    }
  }
  const textStyle: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%" };
  if (asButton) {
    // Provide a consistent canvas-like button appearance via a class,
    // but for TEXT nodes used as buttons we must not apply background/border.
    const btnStyle: React.CSSProperties = { ...outer, cursor: "pointer", borderRadius: (outer as any).borderRadius };
    if (!isText) {
      (btnStyle as any).background = (outer as any).background;
      (btnStyle as any).border = (outer as any).border;
    } else {
      // Ensure text-as-button does not carry background or border inline
      delete (btnStyle as any).background;
      delete (btnStyle as any).border;
      delete (btnStyle as any).borderWidth;
      delete (btnStyle as any).borderColor;
      delete (btnStyle as any).borderStyle;
    }
    return (
      <button type="button" className="mint-button" data-is-text={isText ? "1" : undefined} style={btnStyle} data-name={dataName} data-node-id={dataNodeId} aria-label={(text as any) || dataName} onClick={onClick}>
        <div style={inner}>{isText && text ? <div style={textStyle}>{text}</div> : null}{children}</div>
      </button>
    );
  }
  return (<div style={outer} data-name={dataName} data-node-id={dataNodeId} onClick={onClick}><div style={inner}>{isText && text ? <div style={textStyle}>{text}</div> : null}{children}</div></div>);
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
    if (!isImage && n.backgroundColor) s.background = n.backgroundColor;
    else if (!isImage && n.fill?.type==="SOLID" && n.fill.color) s.background = n.fill.color;
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
  // New layout + appearance properties
  if (n.layoutMode === "HORIZONTAL") { s.display = "flex"; s.flexDirection = "row"; }
  if (n.layoutMode === "VERTICAL") { s.display = "flex"; s.flexDirection = "column"; }
  if (n.flexDirection) { s.display = "flex"; s.flexDirection = n.flexDirection; }
  if (n.paddingTop != null) s.paddingTop = n.paddingTop;
  if (n.paddingRight != null) s.paddingRight = n.paddingRight;
  if (n.paddingBottom != null) s.paddingBottom = n.paddingBottom;
  if (n.paddingLeft != null) s.paddingLeft = n.paddingLeft;
  if (n.itemSpacing != null) s.gap = n.itemSpacing;
  if (n.justifyContent) s.justifyContent = n.justifyContent;
  if (n.alignItems) s.alignItems = n.alignItems;
  if (n.textAlign) s.textAlign = n.textAlign;
  if (n.rotation != null && n.rotation !== 0) { s.transform = (s.transform ? s.transform + " " : "") + ("rotate(" + n.rotation + "deg)"); s.transformOrigin = s.transformOrigin || "center center"; }
  if (n.opacity != null && n.opacity < 1) s.opacity = n.opacity;
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
      // If route unknown, create a page file via API and navigate
      const frameId = tf;
      const frameNode = (nodes||[]).find((n:any)=> String(n.id)===String(frameId));
      const slug = slugify((frameNode && frameNode.name) || String(frameId));
      const dynamicPath = '/'+slug;
      fetch('/api/new-frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) })
        .catch(()=>{});
      if (pathname !== dynamicPath) {
        router.push(dynamicPath);
      } else {
        const el = document.querySelector('[data-node-id="'+CSS.escape(String(targetId))+'"]') as HTMLElement | null;
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    } catch {}
  }, [router, pathname, frameRoutes, nodeToFrame]);

  const onClickForNode = (nodeId:string) => (e: React.MouseEvent) => {
    const list = interactionsBySource.get(nodeId) || [];
    for (const it of list) {
      const targetId = it.targetId;
      if (!targetId) continue;
      const tf = (nodeToFrame && nodeToFrame[targetId]) || targetId;
      const path = frameRoutes && frameRoutes[tf];
      if (path) {
        if (pathname === path) {
          const el = document.querySelector('[data-node-id="'+CSS.escape(String(targetId))+'"]') as HTMLElement | null;
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        } else {
          router.push(path);
        }
      } else {
        const frameNode = (nodes||[]).find((n:any)=> String(n.id)===String(tf));
        const slug = slugify((frameNode && frameNode.name) || String(tf));
        const dynamicPath = '/'+slug;
        fetch('/api/new-frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).catch(()=>{});
        if (pathname !== dynamicPath) {
          router.push(dynamicPath);
        } else {
          const el = document.querySelector('[data-node-id="'+CSS.escape(String(targetId))+'"]') as HTMLElement | null;
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
      }
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

  // Component for infinite scroll containers that fetch data at runtime
  function InfiniteScrollContainer({ node, depth, renderChildren }: { node: any; depth: number; renderChildren: (children: any[], depth: number, dataContext?: Record<string, unknown>) => React.ReactNode[] }) {
    const [dataItems, setDataItems] = React.useState<any[]>([]);
    const [rawJson, setRawJson] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      const fetchData = async () => {
        try {
          const ds = node.dataSource;
          if (!ds?.url) {
            setLoading(false);
            return;
          }

          // Build URL with params
          let url = ds.url;
          if (ds.params) {
            try {
              const params = JSON.parse(ds.params);
              const searchParams = new URLSearchParams(params);
              url += (url.includes('?') ? '&' : '?') + searchParams.toString();
            } catch {}
          }

          // Build headers
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (ds.headers) {
            try {
              const parsed = JSON.parse(ds.headers);
              Object.assign(headers, parsed);
            } catch {}
          }

          const res = await fetch(url, { method: ds.method || 'GET', headers });
          if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
          
          const json = await res.json();
          setRawJson(json);
          
          // Extract array from response
          let items: any[] = [];
          if (Array.isArray(json)) {
            items = json;
          } else if (typeof json === 'object' && json !== null) {
            for (const key of Object.keys(json)) {
              if (Array.isArray(json[key])) {
                items = json[key];
                break;
              }
            }
          }
          
          setDataItems(items);
        } catch (e: any) {
          setError(e.message || 'Failed to fetch data');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [node.dataSource?.url]);

    const direction = node.dataSource?.direction || 'vertical';
    const spacing = node.dataSource?.itemSpacing || 10;
    
    // Calculate item dimensions from children bounds
    // Find the bounding box of all children (handling negative coordinates)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (node.children?.length > 0) {
      for (const child of node.children) {
        const cx = child.x || 0;
        const cy = child.y || 0;
        const cw = child.w || child.width || 0;
        const ch = child.h || child.height || 0;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx + cw);
        maxY = Math.max(maxY, cy + ch);
      }
    }
    
    // Calculate item size based on children bounding box
    const childrenWidth = maxX - minX;
    const childrenHeight = maxY - minY;
    const itemWidth = Math.max(childrenWidth, node.w || node.width || 100) + spacing;
    const itemHeight = Math.max(childrenHeight, node.h || node.height || 100) + spacing;
    
    // Offset to normalize children positions (bring them to 0,0 origin)
    const offsetX = minX < 0 ? -minX : 0;
    const offsetY = minY < 0 ? -minY : 0;
    
    // Normalize children positions for rendering
    const normalizedChildren = (node.children || []).map((child: any) => ({
      ...child,
      x: (child.x || 0) + offsetX,
      y: (child.y || 0) + offsetY,
    }));
    
    // Set up container style
    const containerStyle: any = { 
      position: 'absolute',
      left: node.x,
      top: node.y,
      width: node.w || node.width,
      height: node.h || node.height,
      overflow: 'visible',
      background: node.fill?.color || node.backgroundColor || 'transparent',
    };
    
    // Add border if present
    if (node.stroke?.weight) {
      containerStyle.borderWidth = node.stroke.weight;
      containerStyle.borderStyle = 'solid';
      containerStyle.borderColor = node.stroke.color || '#000';
    }
    
    // Expand container to fit all items
    if (direction === 'vertical') {
      const totalHeight = dataItems.length * itemHeight;
      containerStyle.height = Math.max(containerStyle.height || 100, totalHeight);
    } else {
      const totalWidth = dataItems.length * itemWidth;
      containerStyle.width = Math.max(containerStyle.width || 100, totalWidth);
    }

    if (loading) {
      return <div style={containerStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>Loading data...</div></div>;
    }

    if (error) {
      return <div style={containerStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#c00', fontFamily: 'system-ui' }}>Error: {error}</div></div>;
    }

    if (dataItems.length === 0) {
      return <div style={containerStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>No data</div></div>;
    }

    return (
      <div style={containerStyle} data-name={node.name} data-node-id={node.id}>
        {dataItems.map((dataItem: any, dataIdx: number) => {
          const itemOffsetY = direction === 'vertical' ? dataIdx * itemHeight : 0;
          const itemOffsetX = direction === 'horizontal' ? dataIdx * itemWidth : 0;
          return (
            <div key={\`\${node.id}-item-\${dataIdx}\`} style={{ position: 'absolute', left: itemOffsetX, top: itemOffsetY, width: itemWidth - spacing, height: itemHeight - spacing, overflow: 'visible' }}>
              {renderChildren(normalizedChildren, depth + 1, { ...(dataItem || {}), item: dataItem, payload: rawJson })}
            </div>
          );
        })}
      </div>
    );
  }
  // Non-infinite data source: fetch once and pass payload to children
  function DataSourceContainer({ node, depth, renderChildren }: { node: any; depth: number; renderChildren: (children: any[], depth: number, dataContext?: Record<string, unknown>) => React.ReactNode[] }) {
    const [rawJson, setRawJson] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      const fetchData = async () => {
        try {
          const ds = node.dataSource;
          if (!ds?.url) { setLoading(false); return; }
          let url = ds.url;
          if (ds.params) {
            try {
              const params = JSON.parse(ds.params);
              const searchParams = new URLSearchParams(params);
              url += (url.includes('?') ? '&' : '?') + searchParams.toString();
            } catch {}
          }
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (ds.headers) { try { const parsed = JSON.parse(ds.headers); Object.assign(headers, parsed); } catch {} }
          const res = await fetch(url, { method: ds.method || 'GET', headers });
          if (!res.ok) throw new Error(\`HTTP ${'${'}res.status${'}'}\`);
          const json = await res.json(); setRawJson(json);
        } catch (e:any) { setError(e.message || 'Failed to fetch data'); }
        finally { setLoading(false); }
      };
      fetchData();
    }, [node.dataSource?.url]);

    const containerStyle: any = {
      position: 'absolute', left: node.x, top: node.y, width: node.w || node.width, height: node.h || node.height,
      overflow: 'visible', background: node.fill?.color || node.backgroundColor || 'transparent'
    };
    if (node.stroke?.weight) { containerStyle.borderWidth = node.stroke.weight; containerStyle.borderStyle = 'solid'; containerStyle.borderColor = node.stroke.color || '#000'; }

    if (loading) return <div style={containerStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>Loading…</div></div>;
    if (error) return <div style={containerStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#c00', fontFamily: 'system-ui' }}>Error: {${'${'}error${'}'}}</div></div>;
    return <div style={containerStyle} data-name={node.name} data-node-id={node.id}>{renderChildren(node.children || [], depth + 1, { payload: rawJson })}</div>;
  }
  // Helper: resolve dot/bracket paths from context
  function getByPath(obj:any, path:string){
    if (!obj || !path) return undefined;
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur:any = obj;
    for(const p of parts){ if (!p) continue; cur = (cur==null) ? undefined : cur[p]; }
    return cur;
  }
  function renderTemplate(t:string, ctx:any){
    if (!t || typeof t !== 'string') return t;
    return t.replace(/{{\s*([^}]+)\s*}}/g, (_, expr)=>{
      const v = getByPath(ctx, String(expr || '').trim());
      return v == null ? '' : String(v);
    });
  }

  const render = (arr:any[], depth=0, dataContext?: Record<string, unknown>): React.ReactNode[] => arr.map((n, idx)=>{
    const kind = nodeKind(n);
    
    // Handle infinite and non-infinite data sources
    if (n.dataSource?.infiniteScroll && n.dataSource?.url && n.children?.length) {
      return <InfiniteScrollContainer key={n.id||\`\${depth}-\${idx}\`} node={n} depth={depth} renderChildren={render} />;
    }
    if (n.dataSource && !n.dataSource.infiniteScroll && n.dataSource.url && n.children?.length) {
      return <DataSourceContainer key={n.id||\`\${depth}-\${idx}\`} node={n} depth={depth} renderChildren={render} />;
    }
    
    if (n.children?.length){
      const wrapStyle = cssFromNode(n);
      // Ensure top-level frame anchors at (0,0)
      if (depth === 0) { (wrapStyle as any).left = 0; (wrapStyle as any).top = 0; }
      const list = interactionsBySource.get(n.id)||[];
      const hasClick = list.some((it:any)=>!it.trigger || it.trigger==="onClick");
      const bg = kind==="IMAGE" && n.fill?.imageRef
        ? (() => {
            // Respect the fill's fit mode: cover (default), contain, fill
            const fitMode = n.fill?.fit || "cover";
            const objectFit = fitMode === "fill" ? "fill" : fitMode === "contain" ? "contain" : "cover";
            return <Img key={\`\${n.id}-bg\`} style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit, borderRadius: (wrapStyle as any).borderRadius as any }} src={manifest[n.fill.imageRef]||""} />;
          })()
        : null;
          return (
            <Box key={n.id||\`\${depth}-\${idx}\`} style={wrapStyle} dataName={n.name} dataNodeId={n.id} text={""} isText={false} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={hasClick}>
          {bg}
          {render(n.children, depth+1, dataContext)}
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
      return (
        <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} dataNodeId={n.id} text={""} isText={false} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={hasClick}>
          <Img style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit }} src={manifest[n.fill.imageRef]||""} alt={n.name} />
        </Box>
      );
    }
    const style = cssFromNode(n);
    if (depth === 0) { (style as any).left = 0; (style as any).top = 0; }
    
    // Handle data binding for text nodes + template replacement
    let text = String(n.type||"").toUpperCase()==="TEXT" ? (n.text?.characters ?? n.textRaw ?? "") : "";
    if (dataContext) {
      if (n.dataBinding?.field) {
        const boundValue = getByPath(dataContext, n.dataBinding.field);
        if (boundValue !== undefined) {
          text = String(boundValue);
        }
      }
      if (text && text.includes('{{')) {
        text = renderTemplate(text, dataContext);
      }
    }
    
    const isText = String(n.type||"").toUpperCase()==="TEXT";
    const list = interactionsBySource.get(n.id)||[];
    const hasClick = list.some((it:any)=>!it.trigger || it.trigger==="onClick");
    return <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} dataNodeId={n.id} text={text} isText={isText} onClick={hasClick ? onClickForNode(n.id) : undefined} asButton={hasClick} />;
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
    scripts: { dev: "next dev -p 3001", build: "next build", start: "next start -p 3001" },
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
  const indexClient = `"use client"\nimport React from 'react';\nimport { useRouter } from 'next/navigation';\n\nfunction slugify(s:string){ return (s||'frame').toLowerCase().replace(/[^a-z0-9\\-\\_\\s]+/g,'-').replace(/\\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'frame'; }\n\nexport default function Page(){\n  const origin = (typeof window !== 'undefined' && (!process.env.NEXT_PUBLIC_LIVE_ORIGIN || process.env.NEXT_PUBLIC_LIVE_ORIGIN === '')) ? window.location.origin : (process.env.NEXT_PUBLIC_LIVE_ORIGIN as any);\n  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;\n  const router = useRouter();\n  React.useEffect(()=>{\n    (async()=>{\n      try {\n        const res = await fetch(\`${'${'}origin${'}'}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`);\n        if (!res.ok) return;\n        const raw = await res.json();\n        const src = raw?.payload || raw || {};\n        const roots = Array.isArray(src.roots) ? src.roots : [];\n        if (!roots.length) return;\n        const first = roots[0];\n        const slug = slugify(first.name || first.id);\n        router.replace('/'+slug);\n      } catch {}\n    })();\n  }, [router]);\n  return <div style={{ padding:24,fontFamily:'sans-serif' }}>Loading…</div>;\n}`;
  app.file("page.tsx", indexClient);

  // Responsive stage helper shared by pages
  const responsiveStage = `function ResponsiveStage({ refW, refH, children }: { refW:number; refH:number; children: React.ReactNode }){\n  const outerRef = React.useRef<HTMLDivElement>(null);\n  const [scale, setScale] = React.useState(1);\n  React.useLayoutEffect(()=>{\n    const el = outerRef.current; if (!el) return;\n    const measure = () => { const w = el.clientWidth || el.getBoundingClientRect().width || 0; setScale(w>0? Math.max(0.01, w/refW) : 1); };\n    const ro = new ResizeObserver(measure); ro.observe(el); measure(); return ()=>ro.disconnect();\n  }, [refW]);\n  return (<div ref={outerRef} style={{ position:"relative", width:"100%", height:"100vh", overflow:"auto", background:"#fff" }}>\n    <div style={{ width:"100%", height: \`${'${'}Math.max(1, refH * scale)${'}'}px\` }} />\n    <div style={{ position:"absolute", left:0, top:0, width: refW, height: refH, transform: \`scale(${'${'}scale${'}'})\`, transformOrigin:"top left" }}>{children}</div>\n  </div>);\n}`;

  // Create a page for each frame
  for (const f of frameMeta) {
    const folder = app.folder(f.slug)!;
    const frameNode = roots.find(r => r.id === f.id)!;
    const refW = (ref && (ref.width || 0)) || frameNode.w;
    const refH = (ref && (ref.height || 0)) || frameNode.h;
  const pageSrc = `"use client"\nimport React from "react";\nimport { useRouter, usePathname } from "next/navigation";\nimport { LiveTree } from "../../src/live/runtime";\nimport { frameRoutes } from "../../src/live/routes";\n${responsiveStage}\n\nconst FRAME_ID = ${JSON.stringify(f.id)};\nconst INITIAL_NODES = ${JSON.stringify([frameNode])};\nconst INITIAL_MANIFEST = ${JSON.stringify(manifestObj)};\nconst INITIAL_INTERACTIONS = ${JSON.stringify(interactions)};\n\nfunction normalizeSnapshot(raw:any){\n  try {\n    if (!raw || typeof raw !== 'object') return null;\n    const src = (raw.payload ? raw.payload : raw) || {};\n    if (!Array.isArray(src.roots)) return null;\n    const manifest: Record<string,string> = {};\n    if (src.manifest && typeof src.manifest === 'object') {\n      for (const k of Object.keys(src.manifest)) {\n        try { const v = src.manifest[k]; manifest[k] = typeof v === 'string' ? v.replace(/^assets\\\//, '/assets/') : String(v||''); } catch { manifest[k] = ''; }\n      }\n    }\n    return { roots: src.roots, manifest, interactions: Array.isArray(src.interactions) ? src.interactions : [], focusFrameId: src.focusFrameId ?? null };\n  } catch { return null; }\n}\nfunction findNodeById(arr:any[], id:string): any|null {\n  const stack = Array.isArray(arr) ? [...arr] : [];\n  while (stack.length){ const n = stack.pop(); if (n && n.id === id) return n; if (n && Array.isArray(n.children)) for (const c of n.children) stack.push(c); }\n  return null;\n}\nfunction buildMaps(roots:any[]){\n  const nodeToFrame: Record<string,string> = {};\n  const stack:any[] = [...roots];\n  while (stack.length){ const n = stack.pop(); if (!n) continue; if (n.children) for (const c of n.children){ (c as any).parent = n; stack.push(c);} }\n  const walk=(arr:any[], rootId:string)=>{ for(const n of arr){ nodeToFrame[String(n.id)] = rootId; if (Array.isArray(n.children)) walk(n.children, rootId);} };\n  for (const r of roots){ walk([r], String(r.id)); }\n  return { nodeToFrame } as const;\n}\nasync function syncFrames(roots:any[], manifest:Record<string,string>, interactions:any[]){\n  try {\n    const frames = roots.map(r=>({ id: String(r.id), name: r.name||String(r.id) }));\n    await fetch('/api/sync-frames', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ frames, snapshot: { roots, manifest, interactions } }) });\n  } catch {}\n}\n\nexport default function Page(){\n  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;\n  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;\n  const router = useRouter();\n  const pathname = usePathname();\n  const [nodes, setNodes] = React.useState<any[]>(INITIAL_NODES);\n  const [manifest, setManifest] = React.useState<Record<string,string>>(INITIAL_MANIFEST);\n  const [interactions, setInteractions] = React.useState<any[]>(INITIAL_INTERACTIONS);\n  const [refW, setRefW] = React.useState<number>(INITIAL_NODES[0]?.w || INITIAL_NODES[0]?.width || ${refW});\n  const [refH, setRefH] = React.useState<number>(INITIAL_NODES[0]?.h || INITIAL_NODES[0]?.height || ${refH});\n\n  const fetchSnapshot = React.useCallback(async ()=>{\n    try {\n      const res = await fetch(\`${'${'}origin${'}'}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`);\n      if (!res.ok) return;\n      const raw = await res.json();\n      const norm = normalizeSnapshot(raw);\n      if (!norm) return;\n\n      // Ensure pages and routes exist after commit - pass full snapshot data\n      syncFrames(norm.roots, norm.manifest, norm.interactions);\n\n      // If server signaled a focused frame, navigate to its route (unless we're already on it)\n      try {\n        const focus = norm.focusFrameId;\n        if (focus && String(focus) !== String(FRAME_ID)) {\n          const { nodeToFrame } = buildMaps(norm.roots);\n          const tf = nodeToFrame[focus] || focus;\n          const path = frameRoutes && frameRoutes[tf];\n          if (path && pathname !== path) { router.push(path); return; }\n        }\n      } catch (e) { /* ignore navigation errors */ }\n\n      const node = findNodeById(norm.roots, FRAME_ID);\n      if (node) {\n        setNodes([node]);\n        const w = Number(node.w ?? node.width ?? 0) || refW;\n        const h = Number(node.h ?? node.height ?? 0) || refH;\n        setRefW(w); setRefH(h);\n      }\n      setManifest(norm.manifest || {});\n      if (Array.isArray(norm.interactions)) setInteractions(norm.interactions);\n    } catch { /* ignore */ }\n  }, [origin, fileKey, router, pathname]);\n\n  React.useEffect(()=>{\n    fetchSnapshot();\n    let es: EventSource | null = null;\n    try {\n      es = new EventSource(\`${'${'}origin${'}'}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`);\n      es.addEventListener('version', ()=>{ fetchSnapshot(); });\n      es.onerror = ()=>{};\n    } catch { es = null; }\n    return ()=>{ if (es) es.close(); }\n  }, [origin, fileKey, fetchSnapshot]);\n\n  return (<ResponsiveStage refW={refW} refH={refH}>\n    <LiveTree nodes={nodes} manifest={manifest} interactions={interactions} frameRoutes={frameRoutes} />\n  </ResponsiveStage>);\n}`;
    folder.file("page.tsx", pageSrc);
  }
  // Dynamic frame page: app/[frame]/page.tsx — handles ANY frame slug at runtime
  const dynamicPage = `"use client"\nimport React from 'react';\nimport { useRouter, usePathname, useParams } from 'next/navigation';\nimport { LiveTree } from '../../src/live/runtime';\n${responsiveStage}\n\nfunction slugify(s:string){ return (s||'frame').toLowerCase().replace(/[^a-z0-9\\-\\_\\s]+/g,'-').replace(/\\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'frame'; }\n\nfunction normalizeSnapshot(raw:any){\n  try {\n    if (!raw || typeof raw !== 'object') return null;\n    const src = (raw.payload ? raw.payload : raw) || {};\n    if (!Array.isArray(src.roots)) return null;\n    const manifest: Record<string,string> = {};\n    if (src.manifest && typeof src.manifest === 'object') {\n      for (const k of Object.keys(src.manifest)) {\n        try { const v = src.manifest[k]; manifest[k] = typeof v === 'string' ? v.replace(/^assets\\\//, '/assets/') : String(v||''); } catch { manifest[k] = ''; }\n      }\n    }\n    return { roots: src.roots, manifest, interactions: Array.isArray(src.interactions) ? src.interactions : [], focusFrameId: src.focusFrameId ?? null };\n  } catch { return null; }\n}\n\nfunction buildMaps(roots:any[]){\n  const nodeToFrame: Record<string,string> = {};\n  const frameRoutes: Record<string,string> = {};\n  const stack = [...roots];\n  const frames: Array<{id:string; name:string}> = [];\n  for (const r of roots){ frames.push({ id: String(r.id), name: r.name||String(r.id) }); }\n  while (stack.length){ const n = stack.pop(); if (!n) continue; const rootId = n.rootId || (n.parent==null? n.id : undefined); if (n.children) for (const c of n.children){ c.rootId = rootId || (n.rootId ?? (n.parent==null? n.id : undefined)); stack.push(c); } }\n  const walk = (arr:any[], rootId:string)=>{ for(const n of arr){ nodeToFrame[String(n.id)] = rootId; if (Array.isArray(n.children)) walk(n.children, rootId); } };\n  for (const r of roots){ walk([r], String(r.id)); frameRoutes[String(r.id)] = '/' + slugify(r.name || String(r.id)); }\n  return { nodeToFrame, frameRoutes, frames } as const;\n}\n\nexport default function Page(){\n  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;\n  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;\n  const router = useRouter();\n  const pathname = usePathname();\n  const params = useParams() as { frame?: string };\n  const slug = String(params?.frame || '');\n\n  const [nodes, setNodes] = React.useState<any[]>([]);\n  const [manifest, setManifest] = React.useState<Record<string,string>>({});\n  const [interactions, setInteractions] = React.useState<any[]>([]);\n  const [refW, setRefW] = React.useState<number>(${ref ? (ref.width || 0) : 1200});\n  const [refH, setRefH] = React.useState<number>(${ref ? (ref.height || 0) : 800});\n\n  const fetchSnapshot = React.useCallback(async ()=>{\n    try {\n      const res = await fetch(\`${'${'}origin${'}'}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`);\n      if (!res.ok) return;\n      const raw = await res.json();\n      const norm = normalizeSnapshot(raw);\n      if (!norm) return;\n\n      const { nodeToFrame, frameRoutes, frames } = buildMaps(norm.roots);\n\n      // Focus: navigate to the focused frame if different\n      try {\n        const focus = norm.focusFrameId;\n        if (focus) {\n          const tf = nodeToFrame[focus] || focus;\n          const targetPath = frameRoutes[tf];\n          const cur = pathname.startsWith('/') ? pathname : ('/'+pathname);\n          if (targetPath && cur !== targetPath) { router.push(targetPath); return; }\n        }\n      } catch {}\n\n      // Resolve current slug -> frame id; if unknown, redirect to first available frame\n      const pair = Object.entries(frameRoutes).find(([fid, p])=> p.slice(1) === slug);\n      let frameId = pair ? pair[0] : (frames[0]?.id || '');\n      if (!pair && frames[0]) { router.replace(frameRoutes[frameId]); return; }\n\n      // Find frame node and set state\n      const stack:any[] = [...norm.roots]; let node:any = null;\n      while (stack.length){ const n = stack.pop(); if (!n) continue; if (String(n.id)===String(frameId)){ node = n; break; } if (n.children) for (const c of n.children) stack.push(c); }\n      if (node) { setNodes([node]); const w = Number(node.w ?? node.width ?? 0) || ${ref ? (ref.width || 0) : 1200}; const h = Number(node.h ?? node.height ?? 0) || ${ref ? (ref.height || 0) : 800}; setRefW(w); setRefH(h); }\n      setManifest(norm.manifest || {});\n      if (Array.isArray(norm.interactions)) setInteractions(norm.interactions);\n    } catch { /* ignore */ }\n  }, [origin, fileKey, slug, pathname, router]);\n\n  React.useEffect(()=>{\n    fetchSnapshot();\n    let es: EventSource | null = null;\n    try {\n      es = new EventSource(\`${'${'}origin${'}'}/api/live/stream?fileKey=\${encodeURIComponent(fileKey)}\`);\n      es.addEventListener('version', ()=>{ fetchSnapshot(); });\n      es.onerror = ()=>{};\n    } catch { es = null; }\n    return ()=>{ if (es) es.close(); }\n  }, [origin, fileKey, fetchSnapshot]);\n\n  return (<ResponsiveStage refW={refW} refH={refH}>\n    <LiveTree nodes={nodes} manifest={manifest} interactions={interactions} />\n  </ResponsiveStage>);\n}`;
  app.folder("[frame]")!.file("page.tsx", dynamicPage);

  // Add runtime helpers
  const src = zip.folder("src")!;
  const liveFolder = src.folder("live")!;
  liveFolder.file("runtime.tsx", liveRuntimeTsx());
  liveFolder.file("types.ts", `export type LiveSnapshot = { version: number; payload: { roots:any[]; manifest: Record<string,string>; refW:number; refH:number; interactions: any[]; } };`);
  // Shared routes file that can be updated on commit by /api/sync-frames
  const initialRoutesTs =
    "export const frameRoutes: Record<string,string> = " + JSON.stringify(frameRoutes, null, 2) + ";\n" +
    "export default frameRoutes;\n";
  liveFolder.file("routes.ts", initialRoutesTs);

  // API route to materialize new frames as filesystem pages in dev builds
  const api = app.folder("api")!;
  const newFrameRoute = "import { NextResponse } from 'next/server';\n"
    + "import { promises as fs } from 'fs';\n"
    + "import path from 'path';\n\n"
    + "export async function POST(req: Request){\n"
    + "  try {\n"
    + "    const body = await req.json();\n"
    + "    const slug = String(body?.slug || '').trim();\n"
    + "    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });\n"
    + "    const dir = path.join(process.cwd(), 'app', slug);\n"
    + "    const pagePath = path.join(dir, 'page.tsx');\n"
    + "    await fs.mkdir(dir, { recursive: true });\n"
    + "    const content = \"export { default } from '../page';\\n\";\n"
    + "    await fs.writeFile(pagePath, content, 'utf8');\n"
    + "    return NextResponse.json({ ok: true, pagePath: '/' + slug + '/page.tsx' });\n"
    + "  } catch (e:any) {\n"
    + "    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });\n"
    + "  }\n"
    + "}";
  api.folder("new-frame")!.file("route.ts", newFrameRoute);

  // API to sync frames on commit: writes src/live/routes.ts and creates full app/<slug>/page.tsx
  const syncFramesRoute = `import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

function slugify(s:string){ return (s||'frame').toLowerCase().replace(/[^a-z0-9\\-\\_\\s]+/g,'-').replace(/\\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'frame'; }

// Generate full page content for a frame
function generateFramePage(frameId: string, frameName: string, frameNode: any, allFrames: any[], manifest: Record<string,string>, interactions: any[], frameRoutes: Record<string,string>) {
  const refW = frameNode?.w || frameNode?.width || 1200;
  const refH = frameNode?.h || frameNode?.height || 800;
  
  // Build nodeToFrame mapping
  const nodeToFrame: Record<string,string> = {};
  const buildNodeToFrame = (node: any, rootId: string) => {
    nodeToFrame[String(node.id)] = rootId;
    if (Array.isArray(node.children)) {
      for (const child of node.children) buildNodeToFrame(child, rootId);
    }
  };
  for (const f of allFrames) buildNodeToFrame(f, String(f.id));

  return \`"use client"
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { LiveTree } from "../../src/live/runtime";
import { frameRoutes } from "../../src/live/routes";

function ResponsiveStage({ refW, refH, children }: { refW:number; refH:number; children: React.ReactNode }){
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(()=>{
    const el = outerRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth || el.getBoundingClientRect().width || 0; setScale(w>0? Math.max(0.01, w/refW) : 1); };
    const ro = new ResizeObserver(measure); ro.observe(el); measure(); return ()=>ro.disconnect();
  }, [refW]);
  return (<div ref={outerRef} style={{ position:"relative", width:"100%", height:"100vh", overflow:"auto", background:"#fff" }}>
    <div style={{ width:"100%", height: \\\`\\\${Math.max(1, refH * scale)}px\\\` }} />
    <div style={{ position:"absolute", left:0, top:0, width: refW, height: refH, transform: \\\`scale(\\\${scale})\\\`, transformOrigin:"top left" }}>{children}</div>
  </div>);
}

const FRAME_ID = \${JSON.stringify(frameId)};
const INITIAL_NODES = \${JSON.stringify([frameNode])};
const INITIAL_MANIFEST = \${JSON.stringify(manifest)};
const INITIAL_INTERACTIONS = \${JSON.stringify(interactions)};

function normalizeSnapshot(raw:any){
  try {
    if (!raw || typeof raw !== 'object') return null;
    const src = (raw.payload ? raw.payload : raw) || {};
    if (!Array.isArray(src.roots)) return null;
    const manifest: Record<string,string> = {};
    if (src.manifest && typeof src.manifest === 'object') {
      for (const k of Object.keys(src.manifest)) {
        try { const v = src.manifest[k]; manifest[k] = typeof v === 'string' ? v.replace(/^assets\\\\//, '/assets/') : String(v||''); } catch { manifest[k] = ''; }
      }
    }
    return { roots: src.roots, manifest, interactions: Array.isArray(src.interactions) ? src.interactions : [], focusFrameId: src.focusFrameId ?? null };
  } catch { return null; }
}
function findNodeById(arr:any[], id:string): any|null {
  const stack = Array.isArray(arr) ? [...arr] : [];
  while (stack.length){ const n = stack.pop(); if (n && n.id === id) return n; if (n && Array.isArray(n.children)) for (const c of n.children) stack.push(c); }
  return null;
}
function buildMaps(roots:any[]){
  const nodeToFrame: Record<string,string> = {};
  const stack:any[] = [...roots];
  while (stack.length){ const n = stack.pop(); if (!n) continue; if (n.children) for (const c of n.children){ (c as any).parent = n; stack.push(c);} }
  const walk=(arr:any[], rootId:string)=>{ for(const n of arr){ nodeToFrame[String(n.id)] = rootId; if (Array.isArray(n.children)) walk(n.children, rootId);} };
  for (const r of roots){ walk([r], String(r.id)); }
  return { nodeToFrame } as const;
}
async function syncFrames(roots:any[], manifest:Record<string,string>, interactions:any[]){
  try {
    const frames = roots.map(r=>({ id: String(r.id), name: r.name||String(r.id) }));
    await fetch('/api/sync-frames', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ frames, snapshot: { roots, manifest, interactions } }) });
  } catch {}
}

export default function Page(){
  const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN!;
  const fileKey = process.env.NEXT_PUBLIC_FILE_KEY!;
  const router = useRouter();
  const pathname = usePathname();
  const [nodes, setNodes] = React.useState<any[]>(INITIAL_NODES);
  const [manifest, setManifest] = React.useState<Record<string,string>>(INITIAL_MANIFEST);
  const [interactions, setInteractions] = React.useState<any[]>(INITIAL_INTERACTIONS);
  const [refW, setRefW] = React.useState<number>(INITIAL_NODES[0]?.w || INITIAL_NODES[0]?.width || \${refW});
  const [refH, setRefH] = React.useState<number>(INITIAL_NODES[0]?.h || INITIAL_NODES[0]?.height || \${refH});

  const fetchSnapshot = React.useCallback(async ()=>{
    try {
      const res = await fetch(\\\`\\\${origin}/api/live/snapshot?fileKey=\\\${encodeURIComponent(fileKey)}\\\`);
      if (!res.ok) return;
      const raw = await res.json();
      const norm = normalizeSnapshot(raw);
      if (!norm) return;

      // Ensure pages and routes exist after commit - pass full snapshot data
      syncFrames(norm.roots, norm.manifest, norm.interactions);

      // If server signaled a focused frame, navigate to its route (unless we're already on it)
      try {
        const focus = norm.focusFrameId;
        if (focus && String(focus) !== String(FRAME_ID)) {
          const { nodeToFrame } = buildMaps(norm.roots);
          const tf = nodeToFrame[focus] || focus;
          const path = frameRoutes && frameRoutes[tf];
          if (path && pathname !== path) { router.push(path); return; }
        }
      } catch (e) { /* ignore navigation errors */ }

      const node = findNodeById(norm.roots, FRAME_ID);
      if (node) {
        setNodes([node]);
        const w = Number(node.w ?? node.width ?? 0) || refW;
        const h = Number(node.h ?? node.height ?? 0) || refH;
        setRefW(w); setRefH(h);
      }
      setManifest(norm.manifest || {});
      if (Array.isArray(norm.interactions)) setInteractions(norm.interactions);
    } catch { /* ignore */ }
  }, [origin, fileKey, router, pathname]);

  React.useEffect(()=>{
    fetchSnapshot();
    let es: EventSource | null = null;
    try {
      es = new EventSource(\\\`\\\${origin}/api/live/stream?fileKey=\\\${encodeURIComponent(fileKey)}\\\`);
      es.addEventListener('version', ()=>{ fetchSnapshot(); });
      es.onerror = ()=>{};
    } catch { es = null; }
    return ()=>{ if (es) es.close(); }
  }, [origin, fileKey, fetchSnapshot]);

  return (<ResponsiveStage refW={refW} refH={refH}>
    <LiveTree nodes={nodes} manifest={manifest} interactions={interactions} frameRoutes={frameRoutes} />
  </ResponsiveStage>);
}
\`;
}

export async function POST(req: Request){
  try {
    const body = await req.json();
    const frames = Array.isArray(body?.frames) ? body.frames : [];
    const snapshot = body?.snapshot || null;
    const routes: Record<string,string> = {};
    for (const f of frames){ try { const id = String(f.id); const slug = slugify(String(f.name||id)); routes[id] = '/' + slug; } catch {} }
    
    // Write shared routes file
    const routesPath = path.join(process.cwd(), 'src', 'live', 'routes.ts');
    const routesContent = 'export const frameRoutes: Record<string,string> = ' + JSON.stringify(routes, null, 2) + ';\\nexport default frameRoutes;\\n';
    await fs.mkdir(path.dirname(routesPath), { recursive: true });
    await fs.writeFile(routesPath, routesContent, 'utf8');
    
    // Get snapshot data for generating full pages
    let snapshotData: any = snapshot;
    if (!snapshotData) {
      // Try to read from the origin server
      try {
        const origin = process.env.NEXT_PUBLIC_LIVE_ORIGIN || '';
        const fileKey = process.env.NEXT_PUBLIC_FILE_KEY || '';
        if (origin && fileKey) {
          const res = await fetch(\`\${origin}/api/live/snapshot?fileKey=\${encodeURIComponent(fileKey)}\`);
          if (res.ok) {
            const raw = await res.json();
            snapshotData = raw?.payload || raw || null;
          }
        }
      } catch {}
    }
    
    const allFrameNodes = snapshotData?.roots || [];
    const manifest = snapshotData?.manifest || {};
    const interactions = snapshotData?.interactions || [];
    
    // Generate full page for each frame
    for (const f of frames) {
      const id = String(f.id);
      const slug = routes[id]?.slice(1) || slugify(String(f.name || id));
      const dir = path.join(process.cwd(), 'app', slug);
      const pagePath = path.join(dir, 'page.tsx');
      
      await fs.mkdir(dir, { recursive: true });
      
      // Find the frame node data
      let frameNode = allFrameNodes.find((n: any) => String(n.id) === id);
      if (!frameNode) {
        // Create a minimal frame node if not found
        frameNode = { id, name: f.name || id, type: 'FRAME', w: 1200, h: 800, children: [] };
      }
      
      // Generate full page content
      const pageContent = generateFramePage(id, f.name || id, frameNode, allFrameNodes, manifest, interactions, routes);
      await fs.writeFile(pagePath, pageContent, 'utf8');
    }
    
    return NextResponse.json({ ok: true, count: Object.keys(routes).length });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
`;
  api.folder("sync-frames")!.file("route.ts", syncFramesRoute);

  // Pre-fill env so the app connects back to the editor that did the conversion
  const liveOrigin = (opts?.liveOrigin || "http://localhost:3001").replace(/\/$/, "");
  // Use provided fileKey, or generate a unique one if not available
  const fileKey = opts?.fileKey || `generated-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
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
