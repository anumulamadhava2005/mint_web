import { NextRequest } from "next/server";
import { getSnapshot } from "../store";
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
    const payload: any = {
      refW: snap.payload?.refW ?? 0,
      refH: snap.payload?.refH ?? 0,
      roots: snap.payload?.roots ?? [],
      manifest: snap.payload?.manifest ?? {},
      interactions: Array.isArray(snap.payload?.interactions) ? snap.payload!.interactions : [],
      focusFrameId: snap.payload?.focusFrameId ?? null,
    };
    return new Response(
      JSON.stringify({
        fileKey,
        version: snap.version,
        timestamp: Date.now(),
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
              interactions: Array.isArray(parsed.payload.interactions) ? parsed.payload.interactions : [],
              focusFrameId: parsed.payload.focusFrameId ?? null,
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
              interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
              focusFrameId: parsed.focusFrameId ?? parsed.payload?.focusFrameId ?? null,
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
            interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
            focusFrameId: parsed.focusFrameId ?? null,
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

// Note: Removed non-standard export canonicalGET; Next.js App Router only supports HTTP method exports like GET/POST.
