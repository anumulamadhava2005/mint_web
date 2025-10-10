// app/api/live/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSnapshot } from "../store";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

// --------- Geometry helpers (normalized sizing + positioning) ---------

// Pull absolute x/y and size hints from node or its absoluteBoundingBox
function getAbsAndSize(n: any) {
  const abs = n.absoluteBoundingBox ?? {};
  const ax = Number(n.ax ?? abs.x ?? n.x ?? 0);
  const ay = Number(n.ay ?? abs.y ?? n.y ?? 0);
  const w = Math.round(n.w ?? n.width ?? abs.width ?? 0);
  const h = Math.round(n.h ?? n.height ?? abs.height ?? 0);
  return { ax, ay, w, h };
}

// Map node fields to a stable live/canvas shape and drop absoluteBoundingBox
function normalizeCommon(n: any, ax: number, ay: number, w: number, h: number) {
  const out: any = { ...n };
  out.ax = ax;
  out.ay = ay;
  out.w = w;
  out.h = h;
  out.width = out.width ?? w;     // size mapping: width <- w
  out.height = out.height ?? h;   // size mapping: height <- h
  out.textRaw = n.textRaw ?? n.text?.characters ?? n.characters ?? "";
  if (out.absoluteBoundingBox) delete out.absoluteBoundingBox;
  return out;
}

// Reference-based subtree rebuild: compute child local coords relative to parent absolute coords.
function rebuildSubtreeRelativeTo(
  parentAbsX: number,
  parentAbsY: number,
  node: any,
  manifestMap: Record<string, string>,
  filterSet?: Set<string>
): any {
  const { ax, ay, w, h } = getAbsAndSize(node);
  const mapped: any = normalizeCommon(node, ax, ay, w, h);
  // local coordinates relative to parent absolute coords
  mapped.x = Math.round(ax - (Number(parentAbsX) || 0));
  mapped.y = Math.round(ay - (Number(parentAbsY) || 0));
  // ensure renderer has explicit width/height
  mapped.width = mapped.width ?? mapped.w;
  mapped.height = mapped.height ?? mapped.h;
  // resolve image fill URL (attach src) while keeping imageRef key intact
  if (mapped.fill && typeof mapped.fill === "object" && mapped.fill.type === "IMAGE" && mapped.fill.imageRef) {
    const ref = String(mapped.fill.imageRef);
    (mapped.fill as any).src = manifestMap[ref] ?? (mapped.fill as any).src ?? null;
  }
  if (mapped.absoluteBoundingBox) delete mapped.absoluteBoundingBox;
  mapped.children = [];
  if (Array.isArray(node.children) && node.children.length) {
    for (const c of node.children) {
      if (!filterSet || filterSet.has(String(c.id))) {
        // recurse with THIS node's absolute coords as parent for children
        mapped.children.push(rebuildSubtreeRelativeTo(ax, ay, c, manifestMap, filterSet));
      }
    }
  }
  return mapped;
}

// No-reference mapping: roots get local 0, children are parent-relative; also attach fill.src and width/height
function mapNoRef(
  node: any,
  manifestMap: Record<string, string>,
  parentAbsX?: number,
  parentAbsY?: number
): any {
  const { ax, ay, w, h } = getAbsAndSize(node);
  const mapped: any = normalizeCommon(node, ax, ay, w, h);
  const hasLocal = node.x != null && node.y != null;
  if (parentAbsX == null || parentAbsY == null) {
    // root
    mapped.x = hasLocal ? Number(node.x) : 0;
    mapped.y = hasLocal ? Number(node.y) : 0;
  } else {
    // child: convert absolute->parent-relative if local not provided
    mapped.x = hasLocal ? Number(node.x) : Math.round(ax - parentAbsX);
    mapped.y = hasLocal ? Number(node.y) : Math.round(ay - parentAbsY);
  }
  mapped.width = mapped.width ?? mapped.w;
  mapped.height = mapped.height ?? mapped.h;
  if (mapped.fill && typeof mapped.fill === "object" && mapped.fill.type === "IMAGE" && mapped.fill.imageRef) {
    const ref = String(mapped.fill.imageRef);
    (mapped.fill as any).src = manifestMap[ref] ?? (mapped.fill as any).src ?? null;
  }
  mapped.children = Array.isArray(node.children)
    ? node.children.map((c: any) => mapNoRef(c, manifestMap, ax, ay))
    : [];
  return mapped;
}

// Utility: rectangle tests for synthetic reference selection
function rectOverlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const ax2 = a.x + (a.w || 0), ay2 = a.y + (a.h || 0);
  const bx2 = b.x + (b.w || 0), by2 = b.y + (b.h || 0);
  return !(b.x >= ax2 || bx2 <= a.x || b.y >= ay2 || by2 <= a.y);
}
function rectContains(outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) {
  return inner.x >= outer.x && inner.y >= outer.y &&
         (inner.x + (inner.w || 0)) <= (outer.x + (outer.w || 0)) &&
         (inner.y + (inner.h || 0)) <= (outer.y + (outer.h || 0));
}
function flattenNodes(arr: any[], out: any[] = []) {
  for (const n of arr || []) {
    out.push(n);
    if (Array.isArray(n.children) && n.children.length) flattenNodes(n.children, out);
  }
  return out;
}

// --------- Figma image manifest (fills) ---------

function collectImageRefs(nodes: any[], out = new Set<string>()) {
  for (const n of nodes) {
    if (n?.fill?.type === "IMAGE" && n?.fill?.imageRef) out.add(String(n.fill.imageRef));
    if (n?.children?.length) collectImageRefs(n.children, out);
  }
  return Array.from(out);
}

async function getImageFillsMap(fileKey: string, token: string) {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/images`, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image fills ${res.status}: ${text}`);
  }
  const js = await res.json();
  return (js?.images ?? {}) as Record<string, string>;
}

async function resolveManifestFromFigma(fileKey: string, token: string, roots: any[]) {
  const fills = await getImageFillsMap(fileKey, token);
  const refs = collectImageRefs(roots);
  const out: Record<string, string> = {};
  for (const r of refs) if (fills[r]) out[r] = fills[r];
  return out;
}

// Optional legacy fallback: tries /v1/images with ids (expects node ids, not imageRef)
async function getImagesByRef(fileKey: string, imageRefs: string[], token: string, _arg3: number): Promise<Record<string, string>> {
  if (!fileKey || !Array.isArray(imageRefs) || !token) throw new Error("fileKey, imageRefs, and token are required");
  if (imageRefs.length === 0) return {};
  const out: Record<string, string> = {};
  const chunkSize = 40; // conservative chunk to avoid overly long query strings
  for (let i = 0; i < imageRefs.length; i += chunkSize) {
    const batch = imageRefs.slice(i, i + chunkSize);
    const ids = batch.join(",");
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}`;
    try {
      const res = await fetch(url, { headers: { "X-Figma-Token": token }, cache: "no-store" });
      if (!res.ok) {
        // If CloudFront or server rejects long requests (413) or similar, fall back to per-id fetches for this batch
        if (res.status === 413 || res.status === 414) {
          for (const id of batch) {
            try {
              const singleUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(id)}`;
              const r2 = await fetch(singleUrl, { headers: { "X-Figma-Token": token }, cache: "no-store" });
              if (!r2.ok) continue;
              const j2 = await r2.json();
              Object.assign(out, j2?.images ?? {});
            } catch (e) {
              // ignore per-id failures
              continue;
            }
          }
          continue;
        }
        const text = await res.text().catch(() => "");
        const err: any = new Error(`Figma image fetch failed: ${res.status} ${text}`);
        err.status = res.status;
        throw err;
      }
      const js = await res.json();
      Object.assign(out, js?.images ?? {});
    } catch (err) {
      // If network or other failure, try per-id within this batch as a best-effort
      for (const id of batch) {
        try {
          const singleUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(id)}`;
          const r2 = await fetch(singleUrl, { headers: { "X-Figma-Token": token }, cache: "no-store" });
          if (!r2.ok) continue;
          const j2 = await r2.json();
          Object.assign(out, j2?.images ?? {});
        } catch (e) {
          continue;
        }
      }
    }
  }
  return out;
}

// --------- Route handler ---------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileKey, roots, manifest, refW, refH, referenceFrame, images: clientImages } = body as any;

    // Basic validation
    if (!fileKey || !Array.isArray(roots) || !refW || !refH) {
      return NextResponse.json({ error: "fileKey, roots, refW, refH required" }, { status: 400 });
    }

    if (!fileKey || !Array.isArray(roots) || !refW || !refH) {
      return NextResponse.json({ error: "fileKey, roots, refW, refH required" }, { status: 400 });
    }

  // Manifest resolution (tolerate failures, publish shapes/text anyway)
    const sessionToken = cookies().get("figma_access")?.value || cookies().get("token")?.value || "";
  // finalManifest initially from payload if provided
  let finalManifest: Record<string, string> = manifest || {};
    if (!finalManifest || Object.keys(finalManifest).length === 0) {
      if (sessionToken) {
        try {
          finalManifest = await resolveManifestFromFigma(fileKey, sessionToken, roots);
        } catch (err: any) {
          console.warn(`Unable to fetch manifest images from Figma, continuing with empty manifest: ${err?.message || String(err)}`);
          finalManifest = {};
        }
      } else {
        console.warn("No Figma session; publishing snapshot without manifest");
      }
    }

  // Optional extra attempt to fill gaps using /v1/images with ids (not imageRef); keep non-fatal
    const imageRefs = collectImageRefs(roots);
    let fetchedImages: Record<string, string> = {};
    const missingImageRefs: string[] = [];
    if (sessionToken && imageRefs.length) {
      try {
        fetchedImages = await getImagesByRef(fileKey, imageRefs, sessionToken, 2);
      } catch (err: any) {
        console.warn("Bulk image fetch failed, attempting per-ref fetch. Error:", err?.message ?? err);
        for (const ref of imageRefs) {
          try {
            const single = await getImagesByRef(fileKey, [ref], sessionToken, 2);
            if (single && single[ref]) fetchedImages[ref] = single[ref];
          } catch (e: any) {
            if (e?.status === 404 || (e?.message && /404/.test(String(e?.message)))) {
              console.warn(`Image not found for ref ${ref}, skipping.`);
              missingImageRefs.push(ref);
              continue;
            }
            throw e;
          }
        }
      }
    }

  // Merge known manifests (payload -> figma API results)
  let mergedManifest: Record<string, string> = { ...(finalManifest || {}), ...(fetchedImages || {}) };

    // If client supplied `images` (maps nodeId or nodeName -> url), try to associate those with imageRefs.
    // Build map imageRef -> [nodeIds/names] so we can look up provided client images
  const refToNodes = new Map<string, Array<string>>();
    function collectRefNodes(n: any) {
      if (n?.fill?.type === "IMAGE" && n?.fill?.imageRef) {
        const r = String(n.fill.imageRef);
        const keyCandidates: string[] = [];
        if (n.id) keyCandidates.push(String(n.id));
        if (n.name) keyCandidates.push(String(n.name));
        if (!refToNodes.has(r)) refToNodes.set(r, []);
        refToNodes.get(r)!.push(...keyCandidates);
      }
      if (Array.isArray(n?.children)) for (const c of n.children) collectRefNodes(c);
    }
    for (const r of roots || []) collectRefNodes(r);

  // helper to get origin for resolving relative paths (try several headers)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || req.headers.get("x-forwarded-protocol") || req.headers.get("x-forwarded-scheme") || undefined;
  const originHeader = req.headers.get("origin") || (host ? `${proto || "https"}://${host}` : undefined);

    // Attempt to resolve remaining refs using clientImages or by proxying absolute URLs
    const resolvedEntries: Array<{ ref: string; url: string; source: string }> = [];
    const unresolved: string[] = [];
    for (const ref of imageRefs) {
      if (mergedManifest[ref]) {
        resolvedEntries.push({ ref, url: mergedManifest[ref], source: "manifest" });
        continue; // already resolved
      }
      // Try client-sent images: find node keys referencing this ref
      const nodes = refToNodes.get(ref) || [];
      let foundUrl: string | undefined | null = null;
      let source: string | null = null;
      try {
        if (clientImages && typeof clientImages === "object") {
          for (const k of nodes) {
            const v = clientImages[k];
            if (typeof v === "string" && v.length > 0) {
              foundUrl = v;
              source = `client:${k}`;
              break;
            }
          }
        }

        // If still not found, try a few fallbacks: if ref is absolute http(s), use it
        if (!foundUrl && typeof ref === "string") {
          if (/^https?:\/\//i.test(ref)) {
            foundUrl = ref; source = "ref-absolute";
          } else if (ref.startsWith("//")) {
            foundUrl = `https:${ref}`; source = "ref-protocol-relative";
          } else if (originHeader && ref.startsWith("/")) {
            foundUrl = originHeader.replace(/\/$/, "") + ref; source = "ref-site-relative";
          }
        }

        if (foundUrl) {
          // Normalize and choose proxied path for external hosts
          try {
            const u = new URL(foundUrl, originHeader);
            const hostHeader = req.headers.get("host") || "";
            if (u.hostname && hostHeader && u.hostname !== hostHeader && /^https?:$/i.test(u.protocol)) {
              mergedManifest[ref] = `/api/image-proxy?url=${encodeURIComponent(foundUrl)}`;
            } else {
              mergedManifest[ref] = foundUrl;
            }
            resolvedEntries.push({ ref, url: mergedManifest[ref], source: source || "computed" });
          } catch (e) {
            // Fallback: store raw foundUrl
            mergedManifest[ref] = foundUrl;
            resolvedEntries.push({ ref, url: foundUrl, source: source || "computed-fallback" });
          }
        } else {
          unresolved.push(ref);
        }
      } catch (err) {
        // Never throw on per-ref resolution; just mark unresolved and continue
        console.warn(`Failed to resolve image ref ${ref}:`, err);
        unresolved.push(ref);
      }
    }

    // --------- Build mapped roots with correct math ---------

    let mappedRoots: any[] = [];

    if (referenceFrame) {
      // try to find the referenced node inside posted roots
      function findNodeById(arr: any[], id?: string): any | null {
        if (!id) return null;
        for (const n of arr || []) {
          if (String(n.id) === String(id)) return n;
          if (n.children) {
            const found = findNodeById(n.children, id);
            if (found) return found;
          }
        }
        return null;
      }

      const refNode = findNodeById(roots, referenceFrame.id);
      if (refNode) {
        const { ax: refAx, ay: refAy } = getAbsAndSize(refNode);
        const insideIds = new Set(flattenNodes([refNode]).map((n: any) => String(n.id)));
        // rebuild so children are parent-relative; ensure root local coords are 0
        const r = rebuildSubtreeRelativeTo(refAx, refAy, refNode, mergedManifest, insideIds);
        r.x = 0; r.y = 0;
        mappedRoots = [r];
      } else {
        // Synthetic: include all nodes that overlap the reference rect and measure from that rect origin
        const all = flattenNodes(roots);
        const refRect = {
          x: Number(referenceFrame.x ?? referenceFrame.ax ?? 0),
          y: Number(referenceFrame.y ?? referenceFrame.ay ?? 0),
          w: Number(referenceFrame.width ?? referenceFrame.w ?? 0),
          h: Number(referenceFrame.height ?? referenceFrame.h ?? 0),
        };
        const inside = all.filter((n) => {
          const { ax, ay, w, h } = getAbsAndSize(n);
          return rectOverlaps(refRect, { x: ax, y: ay, w, h });
        });
        const insideSet = new Set(inside.map((n: any) => String(n.id)));
        // top-level = not fully contained by another inside node
        const topLevel = inside.filter((n) => {
          const na = getAbsAndSize(n);
          return !inside.some((p) => {
            if (p === n) return false;
            const pa = getAbsAndSize(p);
            return rectContains({ x: pa.ax, y: pa.ay, w: pa.w, h: pa.h }, { x: na.ax, y: na.ay, w: na.w, h: na.h });
          });
        });

        const syntheticRoot = {
          id: `__ref__${referenceFrame.id ?? "synthetic"}`,
          name: referenceFrame.name ?? "ref",
          type: "FRAME",
          ax: refRect.x,
          ay: refRect.y,
          x: 0,
          y: 0,
          w: Math.round(refRect.w),
          h: Math.round(refRect.h),
          width: Math.round(refRect.w),
          height: Math.round(refRect.h),
          textRaw: "",
          fill: null,
          stroke: null,
          corners: { uniform: null, topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
          effects: [],
          text: null,
          children: topLevel.map((t) => rebuildSubtreeRelativeTo(refRect.x, refRect.y, t, mergedManifest, insideSet)),
        };
        mappedRoots = [syntheticRoot];
      }
    } else {
      // No reference: compute local x/y relative to parent absolute; root x/y default to 0
      mappedRoots = (Array.isArray(roots) ? roots : []).map((r: any) => {
        const { ax, ay } = getAbsAndSize(r);
        const m = mapNoRef(r, mergedManifest);
        if (r.x == null) m.x = 0;
        if (r.y == null) m.y = 0;
        m.ax = ax;
        m.ay = ay;
        return m;
      });
    }

    // Persist live snapshot in memory
    const snap = setSnapshot(fileKey, {
      roots: mappedRoots,
      manifest: mergedManifest,
      refW: Math.round(refW),
      refH: Math.round(refH),
    });

    // Write a static backup snapshot (optional)
    (async () => {
      try {
        const publicDir = path.join(process.cwd(), "public", "live", "snapshots");
        await fs.promises.mkdir(publicDir, { recursive: true });
        // try to derive a safe name from the fileKey; fallback to full encoded key
        const parts = fileKey.split("/").filter(Boolean);
        const safeName = encodeURIComponent(parts[3] ?? fileKey);
        const outPath = path.join(publicDir, `${safeName}.json`);
        const payload = {
          version: snap.version,
          payload: { roots: mappedRoots, manifest: mergedManifest, refW: Math.round(refW), refH: Math.round(refH) },
        };
        await fs.promises.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
        console.info(`Wrote static snapshot to ${outPath}`);
      } catch (e: any) {
        console.warn("Failed to write static snapshot file:", e?.message || String(e));
      }
    })();

    const result = {
      message: "Publish completed",
      version: snap.version,
      storedManifestKeys: Object.keys(mergedManifest).length,
      staticSnapshotUrl: `/live/snapshots/${encodeURIComponent(fileKey)}.json`,
      resolvedImages: resolvedEntries || [],
      unresolvedImageRefs: unresolved || [],
    };

    return new Response(JSON.stringify(result), { status: 200, headers: CORS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
