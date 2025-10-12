export type LivePayload = {
  roots: any[];
  manifest: Record<string,string>;
  refW: number;
  refH: number;
};

export type LiveSnapshot = { version: number; payload: LivePayload };

/**
 * Build a normalized snapshot object using the canonical shape:
 * { version, payload: { roots, manifest, refW, refH } }
 */
export function buildSnapshot(
  roots: any[] | null,
  manifest: Record<string,string> | null,
  refW: number | null | undefined,
  refH: number | null | undefined,
  version = 1
): LiveSnapshot {
  return {
    version,
    payload: {
      roots: Array.isArray(roots) ? roots : (roots ? [roots] : []),
      manifest: manifest || {},
      refW: Number(refW ?? 0) || 0,
      refH: Number(refH ?? 0) || 0,
    }
  };
}

/** Return pretty-printed JSON for a snapshot (used when writing to disk) */
export function formatSnapshotJson(
  roots: any[] | null,
  manifest: Record<string,string> | null,
  refW: number | null | undefined,
  refH: number | null | undefined,
  version = 1
): string {
  return JSON.stringify(buildSnapshot(roots, manifest, refW, refH, version), null, 2);
}

/**
 * Defensive normalizer to accept payloads from the network and produce the canonical shape.
 * Keeps the same logic used client-side: map w/h -> width/height, resolve manifest paths.
 */
export function normalizeSnapshot(raw: any): LiveSnapshot | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const src = raw.payload ? raw.payload : raw;
    if (!src || !Array.isArray(src.roots)) return null;

    const manifest: Record<string,string> = {};
    if (src.manifest && typeof src.manifest === "object") {
      for (const k of Object.keys(src.manifest)) {
        const v = src.manifest[k];
        manifest[k] = typeof v === "string" ? v.replace(/^assets\//, "/assets/") : String(v || "");
      }
    }

    function adaptNode(n: any): any {
      if (!n || typeof n !== "object") return n;
      const x = Math.round(n.x ?? 0);
      const y = Math.round(n.y ?? 0);
      const width = Math.round(n.width ?? n.w ?? 0);
      const height = Math.round(n.height ?? n.h ?? 0);

      let fill = n.fill ?? null;
      if (fill && typeof fill === "object" && fill.type === "IMAGE" && fill.imageRef) {
        const srcUrl = manifest[fill.imageRef] || null;
        fill = { ...fill, src: srcUrl };
      }

      const text = n.text ?? (String(n.type||"").toUpperCase() === "TEXT" ? { characters: n.characters ?? n.textRaw ?? "" } : null);
      const children = Array.isArray(n.children) ? n.children.map((c:any)=>adaptNode(c)) : [];

      const out: any = {
        ...n,
        x, y, width, height,
        fill,
        text,
        children,
      };
      delete out.w; delete out.h; delete out.ax; delete out.ay;
      return out;
    }

    const adaptedRoots = src.roots.map(adaptNode);
    const refW = Number(src.refW ?? src.width ?? 0) || 0;
    const refH = Number(src.refH ?? src.height ?? 0) || 0;
    return { version: raw.version ?? 1, payload: { roots: adaptedRoots, manifest, refW, refH } };
  } catch {
    return null;
  }
}
