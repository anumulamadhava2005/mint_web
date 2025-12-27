"use client";
import React from "react";
import { useParams } from "next/navigation";

// Responsive stage that scales content to fit viewport
function ResponsiveStage({ refW, refH, children }: { refW: number; refH: number; children: React.ReactNode }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  
  React.useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width || 0;
      setScale(w > 0 ? Math.max(0.01, w / refW) : 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [refW]);

  return (
    <div ref={outerRef} style={{ position: "relative", width: "100%", minHeight: "100vh", overflow: "auto", background: "#fff" }}>
      <div style={{ position: "relative", width: refW, minHeight: refH, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "visible" }}>
        {children}
      </div>
    </div>
  );
}

// Box component for rendering nodes
function Box({ style, dataName, dataNodeId, text, isText, children, onClick, asButton }: {
  style: React.CSSProperties;
  dataName: string;
  dataNodeId?: string;
  text?: string;
  isText: boolean;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  asButton?: boolean;
}) {
  const outer: React.CSSProperties = { ...style, overflow: 'visible' };
  const textStyle: React.CSSProperties = { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%" };
  
  if (asButton) {
    const btnStyle: React.CSSProperties = { ...outer, cursor: "pointer" };
    return (
      <button type="button" style={btnStyle} data-name={dataName} data-node-id={dataNodeId} onClick={onClick}>
        {isText && text ? <div style={textStyle}>{text}</div> : null}{children}
      </button>
    );
  }
  
  return (
    <div style={outer} data-name={dataName} data-node-id={dataNodeId} onClick={onClick}>
      {isText && text ? <div style={textStyle}>{text}</div> : null}{children}
    </div>
  );
}

// Image component
function Img({ style, src, alt }: { style: React.CSSProperties; src: string; alt?: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || ""} style={style} />;
}

// DataSource container for non-infinite bindings (fetch once, bind children)
function DataSourceContainer({ node, depth, renderChildren }: {
  node: any;
  depth: number;
  renderChildren: (children: any[], depth: number, dataContext?: Record<string, unknown>) => React.ReactNode[];
}) {
  const [dataContext, setDataContext] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const ds = node.dataSource;
        if (!ds?.url) { setLoading(false); return; }
        let url = ds.url;
        if (ds.params) {
          try { const params = JSON.parse(ds.params); const sp = new URLSearchParams(params); url += (url.includes('?') ? '&' : '?') + sp.toString(); } catch {}
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (ds.headers) { try { Object.assign(headers, JSON.parse(ds.headers)); } catch {} }
        const res = await fetch(url, { method: ds.method || 'GET', headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        let ctx: any = null;
        if (Array.isArray(json)) ctx = json[0] ?? null;
        else if (json && typeof json === 'object') {
          ctx = json;
          for (const k of Object.keys(json)) {
            if (Array.isArray(json[k]) && json[k].length) { ctx = json[k][0]; break; }
          }
        }
        setDataContext(ctx);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch data');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [node.dataSource?.url]);

  const wrapStyle = cssFromNode(node);
  if (depth === 0) { (wrapStyle as any).left = (node.ax ?? node.x ?? 0); (wrapStyle as any).top = (node.ay ?? node.y ?? 0); }

  if (loading) return <div style={wrapStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>Loading data...</div></div>;
  if (error) return <div style={wrapStyle} data-name={node.name} data-node-id={node.id}><div style={{ padding: 16, color: '#c00', fontFamily: 'system-ui' }}>Error: {error}</div></div>;

  return (
    <Box key={node.id} style={wrapStyle} dataName={node.name} dataNodeId={node.id} text="" isText={false}>
      {renderChildren(node.children || [], depth + 1, dataContext || undefined)}
    </Box>
  );
}
// Helper to determine node type
function nodeKind(n: any): "TEXT" | "IMAGE" | "SHAPE" {
  if (String(n.type || "").toUpperCase() === "TEXT") return "TEXT";
  if (n.fill?.type === "IMAGE" && n.fill.imageRef) return "IMAGE";
  return "SHAPE";
}

// Generate CSS from node properties
function cssFromNode(n: any): React.CSSProperties {
  const isText = String(n.type || "").toUpperCase() === "TEXT";
  const isImage = n.fill?.type === "IMAGE" && !!n.fill.imageRef;
  const s: any = { position: "absolute", left: n.x, top: n.y, width: n.w ?? n.width, height: n.h ?? n.height, boxSizing: "border-box" };

  if (!isText && n.stroke?.weight && (n.w === 0 || n.h === 0)) {
    if (n.w === 0) s.width = 1;
    if (n.h === 0) s.height = 1;
    if (n.stroke?.color) s.background = n.stroke.color;
    return s;
  }
  
  if (!isText) {
    if (!isImage && n.backgroundColor) s.background = n.backgroundColor;
    else if (!isImage && n.fill?.type === "SOLID" && n.fill.color) s.background = n.fill.color;
    else if (!isImage && String(n.fill?.type || "").startsWith("GRADIENT") && n.fill.stops?.length) {
      const stops = n.fill.stops.map((st: any) => `${st.color} ${Math.round((st.position ?? 0) * 100)}%`).join(", ");
      s.backgroundImage = `linear-gradient(180deg, ${stops})`;
      s.backgroundSize = "cover";
    }
  }
  
  if (!isText && n.stroke?.weight) {
    s.borderWidth = n.stroke.weight;
    s.borderStyle = n.stroke.dashPattern?.length ? "dashed" : "solid";
    if (n.stroke.color) s.borderColor = n.stroke.color;
  }
  
  if (n.corners) {
    const c = n.corners;
    if (c.topLeft != null) s.borderTopLeftRadius = c.topLeft;
    if (c.topRight != null) s.borderTopRightRadius = c.topRight;
    if (c.bottomRight != null) s.borderBottomRightRadius = c.bottomRight;
    if (c.bottomLeft != null) s.borderBottomLeftRadius = c.bottomLeft;
    if (c.uniform != null) s.borderRadius = c.uniform;
  }
  
  if (Array.isArray(n.effects) && n.effects.length) {
    const sh = n.effects.map((e: any) => e.boxShadow).filter(Boolean);
    if (sh.length) s.boxShadow = sh.join(", ");
  }
  
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
  if (n.rotation != null && n.rotation !== 0) s.transform = `rotate(${n.rotation}deg)`;
  if (n.opacity != null && n.opacity < 1) s.opacity = n.opacity;
  
  if (isText && n.text) {
    if (n.text.fontSize != null) s.fontSize = n.text.fontSize;
    if (n.text.fontFamily) s.fontFamily = n.text.fontFamily;
    if (n.text.fontWeight != null) s.fontWeight = n.text.fontWeight;
    if (n.text.fontStyle === "italic") s.fontStyle = "italic";
    if (n.text.color) s.color = n.text.color;
    if (n.text.textAlignHorizontal) s.textAlign = String(n.text.textAlignHorizontal).toLowerCase();
  }
  
  return s as React.CSSProperties;
}

// Infinite scroll container that fetches data at runtime
function InfiniteScrollContainer({ node, depth, renderChildren, manifest }: { 
  node: any; 
  depth: number; 
  renderChildren: (children: any[], depth: number, dataContext?: Record<string, unknown>) => React.ReactNode[];
  manifest: Record<string, string>;
}) {
  const [dataItems, setDataItems] = React.useState<any[]>([]);
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const json = await res.json();
        
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

  const wrapStyle = cssFromNode(node);
  if (depth === 0) { (wrapStyle as any).left = 0; (wrapStyle as any).top = 0; }
  
  const direction = node.dataSource?.direction || 'vertical';
  const spacing = node.dataSource?.itemSpacing || 10;
  
  // Calculate item dimensions from children bounds
  let itemHeight = node.h || node.height || 100;
  let itemWidth = node.w || node.width || 100;
  if (node.children?.length > 0) {
    let maxBottom = 0, maxRight = 0;
    for (const child of node.children) {
      maxBottom = Math.max(maxBottom, (child.y || 0) + (child.h || child.height || 0));
      maxRight = Math.max(maxRight, (child.x || 0) + (child.w || child.width || 0));
    }
    itemHeight = maxBottom + spacing;
    itemWidth = maxRight + spacing;
  }
  
  // Set up scroll container style - use the original position but allow scrolling
  const containerStyle: any = { 
    ...wrapStyle, 
    position: 'absolute',
    overflow: 'visible', // Don't clip - let content flow
  };
  
  // For vertical scroll, expand height to fit all items
  if (direction === 'vertical') {
    const totalHeight = dataItems.length * itemHeight;
    containerStyle.height = Math.max(node.h || node.height || 100, totalHeight);
    containerStyle.minHeight = totalHeight;
  } else {
    // For horizontal, expand width
    const totalWidth = dataItems.length * itemWidth;
    containerStyle.width = Math.max(node.w || node.width || 100, totalWidth);
    containerStyle.minWidth = totalWidth;
    containerStyle.display = 'flex';
    containerStyle.flexDirection = 'row';
    containerStyle.flexWrap = 'nowrap';
  }

  if (loading) {
    return (
      <div style={containerStyle} data-name={node.name} data-node-id={node.id}>
        <div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle} data-name={node.name} data-node-id={node.id}>
        <div style={{ padding: 16, color: '#c00', fontFamily: 'system-ui' }}>Error: {error}</div>
      </div>
    );
  }

  if (dataItems.length === 0) {
    return (
      <div style={containerStyle} data-name={node.name} data-node-id={node.id}>
        <div style={{ padding: 16, color: '#666', fontFamily: 'system-ui' }}>No data available</div>
      </div>
    );
  }

  return (
    <div style={containerStyle} data-name={node.name} data-node-id={node.id}>
      {dataItems.map((dataItem: any, dataIdx: number) => {
        const offsetY = direction === 'vertical' ? dataIdx * itemHeight : 0;
        const offsetX = direction === 'horizontal' ? dataIdx * itemWidth : 0;
        return (
          <div 
            key={`${node.id}-item-${dataIdx}`} 
            style={{ 
              position: 'absolute', 
              left: offsetX, 
              top: offsetY, 
              width: itemWidth,
              height: itemHeight,
            }}
          >
            {renderChildren(node.children || [], depth + 1, dataItem)}
          </div>
        );
      })}
    </div>
  );
}

// LiveTree component that renders the node tree
function LiveTree({ nodes, manifest }: { nodes: any[]; manifest: Record<string, string> }) {
  const render = (arr: any[], depth = 0, dataContext?: Record<string, unknown>): React.ReactNode[] => arr.map((n, idx) => {
    const kind = nodeKind(n);
    
    // Handle infinite scroll containers
    if (n.dataSource?.infiniteScroll && n.dataSource?.url && n.children?.length) {
      return (
        <InfiniteScrollContainer 
          key={n.id || `${depth}-${idx}`} 
          node={n} 
          depth={depth} 
          renderChildren={render}
          manifest={manifest}
        />
      );
    }
    // Handle non-infinite dataSource: fetch once and bind children
    if (!n.dataSource?.infiniteScroll && n.dataSource?.url && n.children?.length) {
      return (
        <DataSourceContainer 
          key={n.id || `${depth}-${idx}`} 
          node={n} 
          depth={depth} 
          renderChildren={render}
        />
      );
    }
    
    if (n.children?.length) {
      const wrapStyle = cssFromNode(n);
      // For top-level frames, prefer absolute positioning if available to avoid overlapping
      if (depth === 0) {
        (wrapStyle as any).left = (n.ax != null ? n.ax : n.x) || 0;
        (wrapStyle as any).top = (n.ay != null ? n.ay : n.y) || 0;
      }
      
      const bg = kind === "IMAGE" && n.fill?.imageRef
        ? <Img key={`${n.id}-bg`} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: (wrapStyle as any).borderRadius }} src={manifest[n.fill.imageRef] || ""} />
        : null;
      
      return (
        <Box key={n.id || `${depth}-${idx}`} style={wrapStyle} dataName={n.name} dataNodeId={n.id} text="" isText={false}>
          {bg}
          {render(n.children, depth + 1, dataContext)}
        </Box>
      );
    }
    
    if (kind === "IMAGE" && n.fill?.imageRef) {
      const style = { position: "absolute", left: n.x, top: n.y, width: n.w ?? n.width, height: n.h ?? n.height, borderRadius: n.corners?.uniform ?? 0 } as React.CSSProperties;
      return (
        <Box key={n.id || `${depth}-${idx}`} style={style} dataName={n.name} dataNodeId={n.id} text="" isText={false}>
          <Img style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }} src={manifest[n.fill.imageRef] || ""} alt={n.name} />
        </Box>
      );
    }
    
    const style = cssFromNode(n);
    if (depth === 0) {
      (style as any).left = (n.ax != null ? n.ax : n.x) || 0;
      (style as any).top = (n.ay != null ? n.ay : n.y) || 0;
    }
    
    // Handle data binding for text nodes
    let text = String(n.type || "").toUpperCase() === "TEXT" ? (n.text?.characters ?? n.textRaw ?? "") : "";
    if (dataContext && n.dataBinding?.field) {
      const boundValue = dataContext[n.dataBinding.field];
      if (boundValue !== undefined) {
        text = String(boundValue);
      }
    }
    
    const isText = String(n.type || "").toUpperCase() === "TEXT";
    return <Box key={n.id || `${depth}-${idx}`} style={style} dataName={n.name} dataNodeId={n.id} text={text} isText={isText} />;
  });

  return <>{render(nodes)}</>;
}

// Main preview page component
export default function PreviewPage() {
  const params = useParams();
  const fileKey = params.fileKey as string;
  
  const [nodes, setNodes] = React.useState<any[]>([]);
  const [manifest, setManifest] = React.useState<Record<string, string>>({});
  const [refW, setRefW] = React.useState(1920);
  const [refH, setRefH] = React.useState(1080);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`/api/live/snapshot?fileKey=${encodeURIComponent(fileKey)}`);
        if (!res.ok) throw new Error(`Failed to load snapshot: ${res.status}`);
        
        const data = await res.json();
        const payload = data.payload || data;
        
        if (!payload.roots || !Array.isArray(payload.roots)) {
          throw new Error('Invalid snapshot format');
        }
        
        setNodes(payload.roots);
        setManifest(payload.manifest || {});
        setRefW(payload.refW || 1920);
        setRefH(payload.refH || 1080);
      } catch (e: any) {
        setError(e.message || 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    if (fileKey) {
      fetchSnapshot();
    }
  }, [fileKey]);

  // Set up live updates via EventSource
  React.useEffect(() => {
    if (!fileKey) return;
    
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/live/stream?fileKey=${encodeURIComponent(fileKey)}`);
      es.addEventListener('version', () => {
        // Refetch snapshot on version change
        fetch(`/api/live/snapshot?fileKey=${encodeURIComponent(fileKey)}`)
          .then(res => res.json())
          .then(data => {
            const payload = data.payload || data;
            if (payload.roots && Array.isArray(payload.roots)) {
              setNodes(payload.roots);
              setManifest(payload.manifest || {});
              if (payload.refW) setRefW(payload.refW);
              if (payload.refH) setRefH(payload.refH);
            }
          })
          .catch(() => {});
      });
      es.onerror = () => {};
    } catch {
      es = null;
    }
    
    return () => {
      if (es) es.close();
    };
  }, [fileKey]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#c00' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <ResponsiveStage refW={refW} refH={refH}>
      <LiveTree nodes={nodes} manifest={manifest} />
    </ResponsiveStage>
  );
}
