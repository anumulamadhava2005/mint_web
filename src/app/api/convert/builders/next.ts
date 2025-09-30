/* app/api/convert/builders/next.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame } from "../core/types";
import { renderTree, boxHelperTsStyled, imgHelperTs } from "../core/render";
import { flattenTreeToNodes } from "../core/tree";
import { globalsCss, tokensTs, colorUtilTs, readme } from "../shared/styles";

export function buildNext(
  zip: JSZip,
  name: string,
  roots: DrawableNode[],
  ref: ReferenceFrame | null,
  imageManifest: Map<string, string>,
  imageBlobs: Map<string, { path: string; bytes: Uint8Array }>
) {
  const pkg = {
    name, private: true, version: "1.0.0",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "^14.2.0", react: "^18.2.0", "react-dom": "^18.2.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("README.md", readme(name, "nextjs", imageManifest));

  const pub = zip.folder("public")!;
  pub.file(".gitkeep", "");
  const pubAssets = pub.folder("assets")!;
  pubAssets.file(".gitkeep", "");
  for (const [, v] of imageBlobs) {
    pubAssets.file(v.path.replace(/^assets\//, ""), v.bytes);
  }
  const app = zip.folder("app")!;
  app.file("layout.tsx", nextLayout());
  app.file("page.tsx", nextPageTree(roots, ref, imageManifest));
  app.file("globals.css", globalsCss());

  zip.file("tsconfig.json", JSON.stringify({
    compilerOptions: { target: "ES2021", lib: ["dom", "dom.iterable", "esnext"], allowJs: false, skipLibCheck: true, strict: true, forceConsistentCasingInFileNames: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", baseUrl: ".", paths: {} },
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

export function nextPageTree(roots: DrawableNode[], ref: ReferenceFrame | null, manifest: Map<string, string>) {
  const flat = flattenTreeToNodes(roots);
  const stageW = Math.round(ref ? ref.width : Math.max(1, ...flat.map(n => n.ax + n.w)));
  const stageH = Math.round(ref ? ref.height : Math.max(1, ...flat.map(n => n.ay + n.h)));
  const content = renderTree(roots, manifest, 8);

  return `"use client";
import React from "react";

export default function Page() {
  const refW = ${stageW};
  const refH = ${stageH};
  return (
    <ResponsiveStage refW={refW} refH={refH}>
${content}
    </ResponsiveStage>
  );
}

function ResponsiveStage({ refW, refH, children }: { refW: number; refH: number; children: React.ReactNode }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [cw, setCw] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!outerRef.current) return;
    const measure = () => {
      const w = outerRef.current!.clientWidth || outerRef.current!.getBoundingClientRect().width || 0;
      setCw(w);
      setScale(w > 0 ? Math.max(0.01, w / refW) : 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(outerRef.current);
    measure();
    return () => ro.disconnect();
  }, [refW]);

  const outerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100vh", // viewport height
    overflow: "auto",
    background: "#fff",
  };

  // This div provides the layout height equal to the scaled stage height so scrolling works
  const sizerStyle: React.CSSProperties = {
    width: "100%",
    height: \`\${Math.max(1, refH * scale)}px\`,
  };

  const stageStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: refW,
    height: refH,
    transform: \`scale(\${scale})\`,
    transformOrigin: "top left",
  };

  return (
    <div ref={outerRef} style={outerStyle}>
      <div style={sizerStyle} />
      <div style={stageStyle}>{children}</div>
    </div>
  );
}


${boxHelperTsStyled()}
${imgHelperTs()}
`;
}
