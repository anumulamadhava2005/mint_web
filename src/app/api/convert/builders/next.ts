/* app/api/convert/builders/next.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame } from "../core/types";
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
    return { version: raw.version ?? 1, payload: { roots: adaptedRoots, manifest, refW, refH } };
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
  const { refW, refH, roots, manifest } = snap.payload;
  return (
    <ResponsiveStage refW={refW} refH={refH}>
      <LiveTree nodes={roots} manifest={manifest} />
    </ResponsiveStage>
  );
}
`;
}

function liveRuntimeTsx() {
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

export function LiveTree({ nodes, manifest }:{ nodes:any[]; manifest:Record<string,string>; }) {
  const render = (arr:any[], depth=0): React.ReactNode[] => arr.map((n, idx)=>{
    const kind = nodeKind(n);
    if (n.children?.length){
      const wrapStyle = cssFromNode(n);
      const bg = kind==="IMAGE" && n.fill?.imageRef
        ? <Img key={\`\${n.id}-bg\`} style={{ position:"absolute", left:0, top:0, width:"100%", height:"100%", objectFit:"cover", borderRadius: wrapStyle.borderRadius as any }} src={manifest[n.fill.imageRef]||""} />
        : null;
      return <div key={n.id||\`\${depth}-\${idx}\`} style={wrapStyle} data-name={n.name}>{bg}{render(n.children, depth+1)}</div>;
    }
    if (kind==="IMAGE" && n.fill?.imageRef){
      const style = { position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h, objectFit:"cover", borderRadius:(n.corners?.uniform??0) } as React.CSSProperties;
      return <Img key={n.id||\`\${depth}-\${idx}\`} style={style} src={manifest[n.fill.imageRef]||""} alt={n.name} />;
    }
    const style = cssFromNode(n);
    const text = String(n.type||"").toUpperCase()==="TEXT" ? (n.text?.characters ?? n.textRaw ?? "") : "";
    const isText = String(n.type||"").toUpperCase()==="TEXT";
    return <Box key={n.id||\`\${depth}-\${idx}\`} style={style} dataName={n.name} text={text} isText={isText} />;
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
  opts?: { liveOrigin?: string; fileKey?: string }
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

  // Inject LIVE page instead of static render so it auto-updates after Commit
  // Build an initial snapshot so the generated app immediately renders the converted roots
  const manifestObj: Record<string, string> = {};
  for (const [k, v] of imageManifest) {
    // ensure paths point to /assets/ when using the public folder
    manifestObj[k] = typeof v === "string" ? v.replace(/^assets\//, "/assets/") : String(v);
  }
  const initialSnapshot = {
    version: 1,
    payload: {
      roots: roots || [],
      manifest: manifestObj,
      refW: (ref && (ref?.width || 0)) || 0,
      refH: (ref && (ref?.height || 0)) || 0
    }
  };
  const initialSnapJson = JSON.stringify(initialSnapshot, null, 2);
  app.file("page.tsx", nextLivePageTsx(initialSnapJson));
  app.file("globals.css", globalsCss());

  // Add runtime helpers
  const src = zip.folder("src")!;
  const liveFolder = src.folder("live")!;
  liveFolder.file("runtime.tsx", liveRuntimeTsx());
  liveFolder.file("types.ts", `export type LiveSnapshot = { version: number; payload: { roots:any[]; manifest: Record<string,string>; refW:number; refH:number; } };`);

  // Pre-fill env so the app connects back to the editor that did the conversion
  const liveOrigin = (opts?.liveOrigin || "http://localhost:3001").replace(/\/$/, "");
  const fileKey = opts?.fileKey || "YOUR_FILE_KEY";
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
