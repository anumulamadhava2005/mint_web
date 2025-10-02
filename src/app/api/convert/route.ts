/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/route.ts */
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import {
  Payload, ReferenceFrame, DrawableNode, Drawable,
} from "./core/types";
import {
  buildDrawableTree, findById, flattenTreeToNodes,
  flattenTreeToDrawables, spatialNestUnder,
} from "./core/tree";
import { rectOverlaps } from "./core/geometry";
import { collectAndDownloadImages } from "./core/images";
import { buildNext } from "./builders/next";
import { buildReactVite } from "./builders/react";
import { buildVue } from "./builders/vue";
import { buildSvelte } from "./builders/svelte";
import { buildReactNative } from "./builders/reactNative";
import { buildFlutter } from "./builders/flutter";
import { wrapOverflowAsHorizontal } from "./core/tree"; // NEW

function toProjectName(name: string) {
  const out = (name || "figma-project")
    .toLowerCase()
    .replace(/[^a-z0-9\-\_\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "figma-project";
  return out;
}

function makeSyntheticRootFromRef(ref: ReferenceFrame): DrawableNode {
  return {
    id: `ref:${ref.id}`, name: "Reference", type: "FRAME",
    ax: ref.x, ay: ref.y, x: 0, y: 0, w: ref.width, h: ref.height,
    textRaw: null, fill: null, stroke: null, corners: null, effects: null, text: null, children: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: Payload = await req.json();
    const target = (body.target || "react").toLowerCase().trim();
    const fileName = toProjectName(body.fileName || "figma-project");
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const ref = body.referenceFrame ?? null;

    const tree = buildDrawableTree(nodes, ref ? ref.x : 0, ref ? ref.y : 0);
    let roots: DrawableNode[];
    if (ref) {
      const refNode = findById(tree, ref.id);
      if (refNode && refNode.children.length > 0) {
        roots = [refNode];
      } else {
        const syntheticRoot = makeSyntheticRootFromRef(ref);
        const all = flattenTreeToNodes(tree);
        const inside = all.filter(n =>
          rectOverlaps({ x: ref.x, y: ref.y, w: ref.width, h: ref.height },
            { x: n.ax, y: n.ay, w: n.w, h: n.h })
        );
        roots = [spatialNestUnder(syntheticRoot, inside)];
      }
    } else {
      roots = tree;
    }

    if (ref && roots.length === 1) {
      // roots[0] is either the actual reference node or the synthetic root sized to ref
      wrapOverflowAsHorizontal(roots[0], ref);
    }

    const flatForAssets: Drawable[] = flattenTreeToDrawables(roots);
    const { imageManifest, imageBlobs, skipped } = await collectAndDownloadImages(flatForAssets);

    const zip = new JSZip();
    switch (target) {
      case "nextjs":
        buildNext(zip, fileName, roots, ref, imageManifest, imageBlobs);
        break;
      case "react":
        buildReactVite(zip, fileName, roots, ref, imageManifest, imageBlobs);
        break;
      case "vue":
        buildVue(zip, fileName, roots, ref);
        break;
      case "svelte":
        buildSvelte(zip, fileName, roots, ref);
        break;
      case "react-native":
      case "reactnative":
        buildReactNative(zip, fileName, flatForAssets, ref);
        break;
      case "flutter":
        buildFlutter(zip, fileName, flatForAssets, ref);
        break;
      default:
        return new NextResponse(`Unsupported target: ${target}`, { status: 400 });
    }

    const report =
      imageManifest.size > 0
        ? Array.from(imageManifest.entries()).map(([u, p]) => `${p} <= ${u}`).join("\n")
        : "no images";
    zip.file("IMAGES.txt", report);
    if (skipped.length) {
      zip.file("SKIPPED_IMAGES.txt", skipped.map(s => `${s.refUrl} :: ${s.reason}`).join("\n"));
    }

    const content = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}-${target}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to convert", { status: 500 });
  }
}
