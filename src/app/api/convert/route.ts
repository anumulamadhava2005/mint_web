/* eslint-disable @typescript-eslint/no-explicit-any */
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

type FillStyle = {
  type: string;
  color?: string;
  stops?: Array<{ position: number; color: string }>;
  imageRef?: string | null;
};

type StrokeStyle = {
  color?: string | null;
  weight?: number | null;
  align?: "INSIDE" | "CENTER" | "OUTSIDE" | null;
  dashPattern?: number[] | null;
};

type Corners = {
  uniform?: number | null;
  topLeft?: number | null;
  topRight?: number | null;
  bottomRight?: number | null;
  bottomLeft?: number | null;
};

type EffectStyle = { type: string; boxShadow?: string };

type TextStyle = {
  fontSize?: number | null;
  fontFamily?: string | null;
  fontStyle?: string | null;
  fontWeight?: number | string | null;
  lineHeight?: any;
  letterSpacing?: any;
  textDecoration?: string | null;
  textCase?: string | null;
  color?: string | null;
  characters?: string | null;
};

type NodeInput = {
  id: string;
  name: string;
  type: string;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  children?: NodeInput[];
  characters?: string | null;
  textContent?: string | null;

  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;
  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
};

type Drawable = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  textRaw?: string | null;
  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;
  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
};

type ReferenceFrame = { id: string; x: number; y: number; width: number; height: number };

type Payload = {
  target: string;
  fileName: string;
  nodes: NodeInput[];
  referenceFrame?: ReferenceFrame | null;
};

export async function POST(req: NextRequest) {
  try {
    const body: Payload = await req.json();
    const target = (body.target || "react").toLowerCase().trim();
    const fileName = toProjectName(body.fileName || "figma-project");
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const ref = body.referenceFrame ?? null;

    // Flatten
    let drawables = flattenNodes(nodes);

    // If a reference frame is provided, optionally cull and normalize coordinates
    if (ref) {
      const fx = ref.x, fy = ref.y, fw = ref.width, fh = ref.height;
      const overlaps = (d: Drawable) => !(d.x + d.w < fx || fx + fw < d.x || d.y + d.h < fy || fy + fh < d.y);
      drawables = drawables.filter(overlaps).map((d) => ({ ...d, x: d.x - fx, y: d.y - fy }));
    }

    const zip = new JSZip();

    switch (target) {
      case "nextjs":
        buildNext(zip, fileName, drawables, ref);
        break;
      case "react":
        buildReactVite(zip, fileName, drawables, ref);
        break;
      case "react-native":
      case "reactnative":
        buildReactNative(zip, fileName, drawables, ref);
        break;
      case "vue":
        buildVue(zip, fileName, drawables, ref);
        break;
      case "svelte":
        buildSvelte(zip, fileName, drawables, ref);
        break;
      case "flutter":
        buildFlutter(zip, fileName, drawables, ref);
        break;
      default:
        return new NextResponse(`Unsupported target: ${target}`, { status: 400 });
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
    const msg = e?.message || String(e);
    return new NextResponse(msg || "Failed to convert", { status: 500 });
  }
}

/* ----------------------------- Core utilities ---------------------------- */

function toProjectName(name: string) {
  const out =
    name
      .toLowerCase()
      .replace(/[^a-z0-9\-_\s]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "figma-project";
  return out;
}

function flattenNodes(nodes: NodeInput[]): Drawable[] {
  const out: Drawable[] = [];
  const walk = (n: NodeInput, px: number, py: number) => {
    let x: number | undefined, y: number | undefined, w: number | undefined, h: number | undefined;

    if (n.absoluteBoundingBox) {
      x = n.absoluteBoundingBox.x;
      y = n.absoluteBoundingBox.y;
      w = n.absoluteBoundingBox.width;
      h = n.absoluteBoundingBox.height;
    } else if (n.x != null && n.y != null && n.width != null && n.height != null) {
      x = (n.x || 0) + px;
      y = (n.y || 0) + py;
      w = n.width || 0;
      h = n.height || 0;
    }

    const textRaw =
      typeof n.textContent === "string"
        ? n.textContent
        : typeof n.characters === "string"
          ? n.characters
          : "";

    if (x != null && y != null && w != null && h != null && w > 0 && h > 0) {
      out.push({
        id: n.id,
        name: n.name || n.id,
        type: n.type || "NODE",
        x,
        y,
        w,
        h,
        textRaw,
        fill: n.fill ?? null,
        stroke: n.stroke ?? null,
        corners: n.corners ?? null,
        effects: n.effects ?? null,
        text: n.text ?? null,
      });

      const nx = n.absoluteBoundingBox ? 0 : (n.x || 0) + px;
      const ny = n.absoluteBoundingBox ? 0 : (n.y || 0) + py;
      (n.children || []).forEach((c) => walk(c, nx, ny));
    } else {
      (n.children || []).forEach((c) => walk(c, px, py));
    }
  };
  nodes.forEach((root) => walk(root, 0, 0));
  return out;
}

/* ------------------------------- Style mappers ---------------------------- */

// Web CSS mapper
function cssFromDrawable(d: Drawable) {
  const isText = String(d.type).toUpperCase() === "TEXT";
  const style: Record<string, string | number> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
    boxSizing: "border-box",
  };

  // Background only for non-text nodes
  if (!isText && d.fill?.type === "SOLID" && d.fill.color) {
    style.background = d.fill.color;
  }

  // Border only for non-text nodes
  if (!isText && d.stroke?.weight) {
    style.borderWidth = d.stroke.weight;
    style.borderStyle = "solid";
    if (d.stroke?.color) style.borderColor = d.stroke.color!;
  }

  // Corners
  let hasRadius = false;
  if (d.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft, uniform } = d.corners;
    if (topLeft != null) { style.borderTopLeftRadius = topLeft; hasRadius = true; }
    if (topRight != null) { style.borderTopRightRadius = topRight; hasRadius = true; }
    if (bottomRight != null) { style.borderBottomRightRadius = bottomRight; hasRadius = true; }
    if (bottomLeft != null) { style.borderBottomLeftRadius = bottomLeft; hasRadius = true; }
    if (!hasRadius && uniform != null) { style.borderRadius = uniform; hasRadius = true; }
  }
  if (hasRadius) (style as any).contain = "paint";

  // Shadows (apply to non-text containers as visual frames)
  if (!isText && Array.isArray(d.effects) && d.effects.length > 0) {
    const shadows = d.effects.map((e) => e.boxShadow).filter(Boolean) as string[];
    if (shadows.length) style.boxShadow = shadows.join(", ");
  }

  // Text styles (applied to the inner text node)
  if (isText && d.text) {
    if (d.text.fontSize != null) style.fontSize = d.text.fontSize as number;
    if (d.text.fontFamily) style.fontFamily = d.text.fontFamily!;
    if (d.text.fontWeight != null) style.fontWeight = d.text.fontWeight as any;
    if (typeof d.text.lineHeight === "number") style.lineHeight = d.text.lineHeight as number;
    if (typeof d.text.letterSpacing === "number") style.letterSpacing = d.text.letterSpacing as number;
    if (d.text.color) style.color = d.text.color!;
    if (d.text.textDecoration) style.textDecoration = d.text.textDecoration!;
    (style as any).whiteSpace = "normal";
    (style as any).wordBreak = "break-word";
  }

  return style;
}




function jsxBoxWithStyle(d: Drawable) {
  const style = cssFromDrawable(d);
  const styleJson = JSON.stringify(style).replace(/"([^"]+)":/g, "$1:");
  const isText = String(d.type).toUpperCase() === "TEXT";
  const rawText = isText
    ? (d.text?.characters ?? d.textRaw ?? "")
    : (d.text?.characters ?? d.textRaw ?? null);
  const textExpr = JSON.stringify(rawText); // empty string when missing
  // name kept only as data-name attribute (no visible label)
  return `<Box style={${styleJson}} dataName=${JSON.stringify(d.name)} text=${textExpr} isText={${isText}} />`;
}


function boxHelperTsStyled() {
  return `function Box({
  style, dataName, text, isText,
}: {
  style: React.CSSProperties;
  dataName: string;
  text?: string | "";
  isText: boolean;
}) {
  // Derive text styling for TEXT nodes
  const textColor = (isText && typeof style.color === "string") ? style.color : undefined;
  const textSize = typeof style.fontSize === "number" ? style.fontSize : 11;

  // Inner container: do not clip; allow wrapping/expansion for text
  const innerStyle: React.CSSProperties = {
    width: isText ? "fit-content" : "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: isText ? "flex-start" : "center",
    overflow: "visible",            // was hidden; allow text to wrap/grow
    textAlign: isText ? "left" : "center",
    boxSizing: "border-box",
    padding: 4,
  };

  // Text style: allow wrapping
  const textStyle: React.CSSProperties = {
    fontSize: textSize,
    ...(textColor ? { color: textColor } : {}),
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  };

  return (
    <div style={style} data-name={dataName}>
      <div style={innerStyle}>
        {(text !== "" && text !== undefined) && (
          <div style={textStyle}>{text}</div>
        )}
      </div>
    </div>
  );
}
`;
}


// React Native mappers
function rnStyleFromDrawable(d: Drawable) {
  const style: Record<string, any> = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
    padding: 4,
  };
  if (d.fill?.type === "SOLID" && d.fill.color) style.backgroundColor = d.fill.color;
  if (d.stroke?.weight) style.borderWidth = d.stroke.weight;
  if (d.stroke?.color) style.borderColor = d.stroke.color;
  if (d.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft, uniform } = d.corners;
    if (topLeft != null) style.borderTopLeftRadius = topLeft;
    if (topRight != null) style.borderTopRightRadius = topRight;
    if (bottomRight != null) style.borderBottomRightRadius = bottomRight;
    if (bottomLeft != null) style.borderBottomLeftRadius = bottomLeft;
    if (uniform != null) style.borderRadius = uniform;
  }
  return style;
}

function rnTextStyle(d: Drawable) {
  const t: Record<string, any> = {};
  if (d.text?.fontSize != null) t.fontSize = d.text.fontSize;
  if (d.text?.fontFamily) t.fontFamily = d.text.fontFamily;
  if (d.text?.fontWeight != null) t.fontWeight = String(d.text.fontWeight);
  if (d.text?.color) t.color = d.text.color;
  return t;
}

/* ------------------------------- Next.js build ----------------------------- */

function buildNext(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "^14.2.0", react: "^18.2.0", "react-dom": "^18.2.0" },
  };

  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "nextjs"));

  zip.folder("public")?.file(".gitkeep", "");

  const app = zip.folder("app")!;
  app.file("layout.tsx", nextLayout());
  app.file("page.tsx", nextPage(d, ref));
  app.file("globals.css", globalsCss());

  zip.file(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2021",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: false,
          skipLibCheck: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          baseUrl: ".",
          paths: {},
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  );
  zip.file(
    "next-env.d.ts",
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`
  );

  const lib = zip.folder("lib")!;
  lib.file("tokens.ts", tokensTs());
  lib.file("color.ts", colorUtilTs());
}

function nextLayout() {
  return `import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`;
}

function nextPage(d: Drawable[], ref: ReferenceFrame | null) {
  const cont = ref
    ? { position: "relative", width: `${Math.round(ref.width)}px`, height: `${Math.round(ref.height)}px`, background: "#fff" }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const contJson = JSON.stringify(cont).replace(/"([^"]+)":/g, "$1:");
  return `export default function Page() {
  return (
    <div style={${contJson}}>
${d.map((r) => "      " + jsxBoxWithStyle(r)).join("\n")}
    </div>
  );
}

${boxHelperTsStyled()}
`;
}

/* ----------------------------- React (Vite) build -------------------------- */

function buildReactVite(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vite: "^5.0.0", "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", typescript: "^5.4.0" },
  };

  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", reactIndexHtml());
  zip.file("README.md", readme(name, "react"));

  const src = zip.folder("src")!;
  src.file("main.tsx", reactMainTsx());
  src.file("App.tsx", reactApp(d, ref));
  src.file("globals.css", globalsCss());

  const lib = src.folder("lib")!;
  lib.file("tokens.ts", tokensTs());
  lib.file("color.ts", colorUtilTs());

  zip.file(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2021",
          lib: ["dom", "dom.iterable", "esnext"],
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2
    )
  );
}

function reactIndexHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Figma to React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function reactMainTsx() {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);
`;
}

function reactApp(d: Drawable[], ref: ReferenceFrame | null) {
  const cont = ref
    ? { position: "relative", width: `${Math.round(ref.width)}px`, height: `${Math.round(ref.height)}px`, background: "#fff" }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const contJson = JSON.stringify(cont).replace(/"([^"]+)":/g, "$1:");
  return `export default function App() {
  return (
    <div style={${contJson}}>
${d.map((r) => "      " + jsxBoxWithStyle(r)).join("\n")}
    </div>
  );
}

${boxHelperTsStyled()}
`;
}

/* ---------------------------------- Vue 3 ---------------------------------- */

function buildVue(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { vue: "^3.4.0" },
    devDependencies: { vite: "^5.0.0", "@vitejs/plugin-vue": "^5.0.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", vueIndexHtml());
  zip.file("vite.config.ts", vueViteConfig());
  zip.file("README.md", readme(name, "vue"));

  const src = zip.folder("src")!;
  src.file("main.ts", vueMainTs());
  src.file("App.vue", vueAppVue(d, ref));
}

function vueIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Vue</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function vueMainTs() {
  return `import { createApp } from "vue";
import App from "./App.vue";
createApp(App).mount("#app");
`;
}
function vueViteConfig() {
  return `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({ plugins: [vue()] });
`;
}
function vueAppVue(d: Drawable[], ref: ReferenceFrame | null) {
  const boxes = d.map((b) => ({
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    style: cssFromDrawable(b),
  }));
  const container = ref
    ? { position: "relative", width: `${Math.round(ref.width)}px`, height: `${Math.round(ref.height)}px`, background: "#fff" }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const boxesJson = JSON.stringify(boxes);
  const containerJson = JSON.stringify(container).replace(/"([^"]+)":/g, "$1:");
  return `<script setup lang="ts">
const boxes = ${boxesJson};
const containerStyle = ${containerJson};
</script>
<template>
  <div :style="containerStyle">
    <div v-for="(b, i) in boxes" :key="i" :style="b.style">
      <div v-if="b.text !== null && b.text !== undefined" style="font:11px system-ui">{{ b.text }}</div>
    </div>
  </div>
</template>
`;
}

/* ---------------------------------- Svelte --------------------------------- */

function buildSvelte(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    devDependencies: { vite: "^5.0.0", svelte: "^4.2.0", "@sveltejs/vite-plugin-svelte": "^3.0.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", svelteIndexHtml());
  zip.file("vite.config.ts", svelteViteConfig());
  zip.file("README.md", readme(name, "svelte"));

  const src = zip.folder("src")!;
  src.file("main.ts", svelteMainTs());
  src.file("App.svelte", svelteApp(d, ref));
}

function svelteIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Svelte</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function svelteMainTs() {
  return `import App from "./App.svelte";
new App({ target: document.getElementById("app")! });
`;
}
function svelteViteConfig() {
  return `import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({ plugins: [svelte()] });
`;
}
function svelteApp(d: Drawable[], ref: ReferenceFrame | null) {
  const boxes = d.map((b) => ({
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    style: cssFromDrawable(b),
  }));
  const container = ref
    ? { position: "relative", width: `${Math.round(ref.width)}px`, height: `${Math.round(ref.height)}px`, background: "#fff" }
    : { position: "relative", width: "100vw", height: "100vh", background: "#fff" };
  const boxesJson = JSON.stringify(boxes).replace(/"([^"]+)":/g, "$1:");
  const containerJson = JSON.stringify(container).replace(/"([^"]+)":/g, "$1:");
  return `<script lang="ts">
  export let boxes = ${boxesJson};
  export let containerStyle = ${containerJson};
</script>
<div style={containerStyle}>
  {#each boxes as b, i (i)}
    <div style={b.style} data-name={b.name}>
      {#if b.text !== null && b.text !== undefined}
        <div style="font:11px system-ui">{b.text}</div>
      {/if}
    </div>
  {/each}
</div>
`;
}

/* ------------------------------- React Native ------------------------------ */

function buildReactNative(zip: JSZip, name: string, d: Drawable[], _ref: ReferenceFrame | null) {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    main: "App.js",
    scripts: { start: "expo start" },
    dependencies: { expo: "~51.0.0", react: "18.2.0", "react-native": "0.74.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "react-native"));

  const rnBoxes = d.map((b) => ({
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    style: rnStyleFromDrawable(b),
    textStyle: rnTextStyle(b),
  }));
  const rnBoxesJson = JSON.stringify(rnBoxes).replace(/"([^"]+)":/g, "$1:");

  zip.file(
    "App.js",
    `import React from "react";
import { View, Text, SafeAreaView, StyleSheet } from "react-native";

const boxes = ${rnBoxesJson};

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.stage}>
        {boxes.map((b, i) => (
          <Box key={i} style={b.style} name={b.name} text={b.text} isText={b.isText} textStyle={b.textStyle} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  stage: { flex: 1 },
});

function Box({ style, name, text, isText, textStyle }) {
  return (
    <View style={style}>
      {(text !== null && text !== undefined) && (
        <Text style={{ fontSize: 11, color: "#333", ...(textStyle||{}) }}>{text}</Text>
      )}
    </View>
  );
}

`
  );

  zip.folder("assets")?.file(".gitkeep", "");
  zip.file(".watchmanconfig", '{ "ignore_dirs": ["node_modules"] }');
}

/* --------------------------------- Flutter -------------------------------- */

function buildFlutter(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  zip.file("pubspec.yaml", flutterPubspec(name));

  // Simplified Flutter mapping
  const items = d.map((b) => ({
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    bg: b.fill?.type === "SOLID" ? b.fill.color ?? null : null,
    borderWidth: b.stroke?.weight ?? null,
    borderColor: b.stroke?.color ?? null,
    radius: b.corners?.uniform ?? null,
  }));
  const itemsJson = JSON.stringify(items);

  const container = ref
    ? { w: Math.round(ref.width), h: Math.round(ref.height) }
    : null;

  zip.folder("lib")!.file(
    "main.dart",
    `import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: ${container ? `SizedBox(width: ${container.w}.0, height: ${container.h}.0, child: Stack(children: buildBoxes()))` : `Stack(children: buildBoxes())`},
      ),
    );
  }
}

List<Widget> buildBoxes() {
  const items = ${itemsJson};
  return items.map((b) {
    return Positioned(
      left: (b["x"] as num).toDouble(),
      top: (b["y"] as num).toDouble(),
      width: (b["w"] as num).toDouble(),
      height: (b["h"] as num).toDouble(),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white, // TODO: parse rgba to ARGB for bg
          border: (b["borderWidth"] != null && b["borderColor"] != null)
            ? Border.all(color: const Color(0xFF3B82F6), width: (b["borderWidth"] as num).toDouble())
            : null,
          borderRadius: (b["radius"] != null)
            ? BorderRadius.circular((b["radius"] as num).toDouble())
            : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (b["text"] != null) Text(b["text"] as String, style: const TextStyle(fontSize: 11, color: Color(0xFF333333))),
          ],
        ),
      ),
    );
  }).toList();
}
`
  );

  zip.file("README.md", readme(name, "flutter"));
}

/* ------------------------------ Shared outputs ----------------------------- */

function globalsCss() {
  return `:root { color-scheme: light; }  /* system light scheme */ 
* { box-sizing: border-box; }  /* predictable sizing */ 
html, body, #root { margin: 0; height: 100%; }  /* full-viewport app shell */ 
/* Typography smoothing for crisper canvas overlays */
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* Prevent background bleed past rounded parents without clipping children */
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] > * {
  border-radius: inherit;
}

/* Optional: stabilize paint for rounded elements that rely on large shadows */
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] {
  contain: paint;
}
[data-name] > div { overflow: visible; } /* inner wrapper */
`;
}


function tokensTs() {
  return `// Design tokens placeholder: map Figma styles -> code styles here
export const tokens = {
  colors: {
    primary: "#3b82f6",
    accent: "#FF5733",
    text: "#111111",
    muted: "#333333",
  },
  radii: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
  },
  typography: {
    body: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontSize: 14, lineHeight: 1.4 },
    small: { fontSize: 12, lineHeight: 1.35 },
  },
};
`;
}

function colorUtilTs() {
  return `export function rgba255(r: number, g: number, b: number, a = 1) {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  const aa = Math.max(0, Math.min(1, a));
  return \`rgba(\${rr}, \${gg}, \${bb}, \${aa})\`;
}
`;
}

function readme(project: string, target: string) {
  return `# ${project} – ${target}

This project was generated from Figma nodes and includes visual styles (background, border radius, border, basic text, shadows).
It also supports device frames: if a frame was selected during conversion, the canvas size matches that frame and positions are relative to its top-left.

## Quick start
1. npm install
2. ${target === "nextjs" ? "npm run dev (http://localhost:3000)" : "npm run dev"}
3. Build: ${target === "nextjs" ? "npm run build && npm start" : "npm run build && npm run preview"}

## Notes
- Web border align INSIDE/OUTSIDE is approximated (CSS borders are center-only).
- Gradients and image fills are TODO; add mapping from Figma gradient handles and image assets as needed.
`;
}
function flutterPubspec(name: string): string {
  return `name: ${name}
description: A Flutter project generated from Figma nodes.
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`;
}

