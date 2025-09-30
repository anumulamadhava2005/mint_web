/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/core/images.ts */
import { Drawable } from "./types";

function inferExtFromMime(mime: string | undefined, fallback = "png") {
  if (!mime) return fallback;
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  return fallback;
}
function safeFileSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\-\_\s]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}
function tinyHash(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).slice(0, 8); }
function atobSafe(b64: string) { if (typeof atob === "function") return atob(b64); return Buffer.from(b64, "base64").toString("binary"); }

export async function collectAndDownloadImages(drawables: Drawable[]) {
  const imageNodes = drawables.filter((d) => d.fill?.type === "IMAGE" && d.fill.imageRef);
  const unique = new Map<string, true>();
  const manifest = new Map<string, string>();
  const blobs = new Map<string, { path: string; bytes: Uint8Array }>();
  const skipped: Array<{ refUrl: string; reason: string }> = [];
  const allowPlaceholder = false;

  for (const dn of imageNodes) {
    const refUrl = String(dn.fill!.imageRef);
    if (!refUrl || unique.has(refUrl)) continue;
    unique.set(refUrl, true);

    if (/^data:image\//i.test(refUrl)) { manifest.set(refUrl, refUrl); continue; }

    try {
      const res = await fetch(refUrl, { headers: { Accept: "image/*" } });
      if (!res.ok) { skipped.push({ refUrl, reason: `HTTP ${res.status}` }); continue; }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.startsWith("image/")) { skipped.push({ refUrl, reason: `non-image content-type: ${ct || "unknown"}` }); continue; }
      const buf = await res.arrayBuffer();
      const ext = inferExtFromMime(ct, "png");
      let baseName = "image";
      try { const u = new URL(refUrl); const last = u.pathname.split("/").pop() || "image"; baseName = safeFileSlug(last.replace(/\.[a-z0-9]+$/i, "")) || "image"; } catch {}
      const filename = `${baseName}-${tinyHash(refUrl)}.${ext}`;
      const localPath = `assets/${filename}`;
      manifest.set(refUrl, localPath);
      blobs.set(refUrl, { path: localPath, bytes: new Uint8Array(buf) });
    } catch (err: any) { skipped.push({ refUrl, reason: err?.message || "network error" }); }
  }
  return { imageManifest: manifest, imageBlobs: blobs, skipped };
}
