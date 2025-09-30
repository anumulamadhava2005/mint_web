/* app/api/convert/builders/react.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame } from "../core/types";
import { renderTree, boxHelperTsStyled, imgHelperTs } from "../core/render";
import { flattenTreeToNodes } from "../core/tree";
import { globalsCss, tokensTs, colorUtilTs, readme } from "../shared/styles";

export function buildReactVite(
  zip: JSZip,
  name: string,
  roots: DrawableNode[],
  ref: ReferenceFrame | null,
  manifest: Map<string, string>,
  imageBlobs: Map<string, { path: string; bytes: Uint8Array }>
) {
  const pkg = {
    name, private: true, version: "1.0.0",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vite: "^5.0.0", "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", typescript: "^5.4.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", reactIndexHtml());
  zip.file("README.md", readme(name, "react", manifest));

  const pub = zip.folder("public")!;
  const pubAssets = pub.folder("assets")!;
  pubAssets.file(".gitkeep", "");
  for (const [, v] of imageBlobs) {
    pubAssets.file(v.path.replace(/^assets\//, ""), v.bytes);
  }

  const src = zip.folder("src")!;
  src.file("main.tsx", reactMainTsx());
  src.file("App.tsx", reactAppTree(roots, ref, manifest));
  src.file("globals.css", globalsCss());
  const lib = src.folder("lib")!;
  lib.file("tokens.ts", tokensTs());
  lib.file("color.ts", colorUtilTs());

  zip.file("tsconfig.json", JSON.stringify({
    compilerOptions: { target: "ES2021", lib: ["dom", "dom.iterable", "esnext"], jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true, skipLibCheck: true, noEmit: true },
    include: ["src"],
  }, null, 2));
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
export function reactAppTree(roots: DrawableNode[], ref: ReferenceFrame | null, manifest: Map<string, string>) {
  const flat = flattenTreeToNodes(roots);
  const stageW = Math.round(ref ? ref.width : Math.max(1, ...flat.map(n => n.ax + n.w)));
  const stageH = Math.round(ref ? ref.height : Math.max(1, ...flat.map(n => n.ay + n.h)));
  const content = renderTree(roots, manifest, 8);

  return `import React from "react";

export default function App() {
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

  React.useLayoutEffect(() => {
    if (!outerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width;
      const ch = entry.contentRect.height;
      const sx = cw / refW;
      const sy = ch / refH;
      setScale(Math.max(0.01, Math.min(sx, sy)));
    });
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, [refW, refH]);

  const outerStyle: React.CSSProperties = {
    position: "relative", width: "100%", height: "100%", overflow: "auto", background: "#fff",
  };
  const aspectStyle: React.CSSProperties = {
    position: "relative", width: "100%", aspectRatio: \`\${refW} / \${refH}\`,
  };
  const stageStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: refW, height: refH,
    transform: \`scale(\${scale})\`, transformOrigin: "top left",
  };

  return (
    <div ref={outerRef} style={outerStyle}>
      <div style={aspectStyle}>
        <div style={stageStyle}>{children}</div>
      </div>
    </div>
  );
}

${boxHelperTsStyled()}
${imgHelperTs()}
`;
}
