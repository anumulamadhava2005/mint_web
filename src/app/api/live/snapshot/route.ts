import { NextRequest } from "next/server";
import { getSnapshot } from "../../store";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fileKey = url.searchParams.get("fileKey");
  if (!fileKey) {
    return new Response(JSON.stringify({ error: "fileKey required" }), { status: 400, headers: CORS });
  }

  const snap = getSnapshot(fileKey);
  if (snap) {
    const payload = {
      refW: snap.refW,
      refH: snap.refH,
      roots: snap.roots,
      manifest: snap.manifest ?? {},
    };
    return new Response(
      JSON.stringify({
        fileKey,
        version: snap.version,
        timestamp: snap.timestamp,
        payload,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Fallback: try static file in public/live/snapshots/<encoded>.json or raw name
  const candidates = [
    `${encodeURIComponent(fileKey)}.json`,
    `${fileKey}.json`,
  ];
  for (const name of candidates) {
    const fp = path.join(process.cwd(), "public", "live", "snapshots", name);
    try {
      const body = await fs.readFile(fp, "utf8");
      let parsed: any = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = null;
      }

      // If parsed JSON, normalize into the expected shape.
      if (parsed && typeof parsed === "object") {
        // If the static file already contains the exact shape, return as-is.
        if (parsed.payload && typeof parsed.payload === "object" && parsed.payload.roots) {
          const normalized = {
            fileKey: parsed.fileKey ?? fileKey,
            version: parsed.version ?? parsed.payload.version ?? 0,
            timestamp: parsed.timestamp ?? Date.now(),
            payload: {
              refW: parsed.payload.refW ?? null,
              refH: parsed.payload.refH ?? null,
              roots: parsed.payload.roots ?? [],
              manifest: parsed.payload.manifest ?? {},
            },
          };
          return new Response(JSON.stringify(normalized), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
        }

        // If parsed appears to be a top-level snapshot (refW/refH/roots at top level), wrap into payload.
        if (parsed.roots || parsed.refW || parsed.refH) {
          const normalized = {
            fileKey: parsed.fileKey ?? fileKey,
            version: parsed.version ?? 0,
            timestamp: parsed.timestamp ?? Date.now(),
            payload: {
              refW: parsed.refW ?? null,
              refH: parsed.refH ?? null,
              roots: parsed.roots ?? [],
              manifest: parsed.manifest ?? {},
            },
          };
          return new Response(JSON.stringify(normalized), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
        }

        // If parsed is some other object, assume it's the payload itself.
        const fallback = {
          fileKey,
          version: parsed.version ?? 0,
          timestamp: parsed.timestamp ?? Date.now(),
          payload: {
            refW: parsed.refW ?? null,
            refH: parsed.refH ?? null,
            roots: parsed.roots ?? (Array.isArray(parsed) ? parsed : []),
            manifest: parsed.manifest ?? {},
          },
        };
        return new Response(JSON.stringify(fallback), {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // If file wasn't JSON, skip it (avoid returning a raw string as payload that renders as characters).
    } catch {
      // try next candidate
    }
  }

  return new Response(JSON.stringify({ error: "snapshot not found" }), { status: 404, headers: CORS });
}

/**
 * GET /api/live/snapshot?fileKey=FILE_KEY
 * Returns canonical snapshot:
 * { version: number, payload: { roots: any[], manifest: Record<string,string>, refW: number, refH: number } }
 */
export async function canonicalGET(req: Request) {
  try {
    const url = new URL(req.url);
    const fileKey = url.searchParams.get("fileKey");
    if (!fileKey) return new Response(JSON.stringify({ error: "missing fileKey" }), { status: 400 });

    const safeName = encodeURIComponent(fileKey) + ".json";
    const snapshotsDir = path.join(process.cwd(), "public", "live", "snapshots");
    const filePath = path.join(snapshotsDir, safeName);

    let rawText: string;
    try {
      rawText = await fs.readFile(filePath, "utf8");
    } catch (e) {
      return new Response(JSON.stringify({ error: "snapshot not found" }), { status: 404 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "invalid snapshot JSON" }), { status: 500 });
    }

    // Normalize into canonical shape
    function normalize(raw: any) {
      if (!raw || typeof raw !== "object") return null;
      const src = raw.payload ? raw.payload : raw;
      if (!src || !Array.isArray(src.roots)) return null;

      const manifest: Record<string, string> = {};
      if (src.manifest && typeof src.manifest === "object") {
        for (const k of Object.keys(src.manifest)) {
          const v = src.manifest[k];
          manifest[k] = typeof v === "string" ? v.replace(/^assets\//, "/assets/") : String(v ?? "");
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

        const text = n.text ?? (String(n.type || "").toUpperCase() === "TEXT" ? { characters: n.characters ?? n.textRaw ?? "" } : null);
        const children = Array.isArray(n.children) ? n.children.map((c: any) => adaptNode(c)) : [];

        const out: any = {
          ...n,
          x,
          y,
          width,
          height,
          fill,
          text,
          children,
        };
        delete out.w;
        delete out.h;
        delete out.ax;
        delete out.ay;
        return out;
      }

      const adaptedRoots = src.roots.map(adaptNode);
      const refW = Number(src.refW ?? src.width ?? 0) || 0;
      const refH = Number(src.refH ?? src.height ?? 0) || 0;
      return { version: raw.version ?? 1, payload: { roots: adaptedRoots, manifest, refW, refH } };
    }

    const normalized = normalize(parsed);
    if (!normalized) return new Response(JSON.stringify({ error: "snapshot has unexpected shape" }), { status: 500 });

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500 });
  }
}
