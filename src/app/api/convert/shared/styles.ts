/* app/api/convert/shared/styles.ts */
export function globalsCss() {
  return `:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
.text-wrap { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] > * { border-radius: inherit; }
[data-name][style*="border-radius"],
[data-name][style*="border-top-left-radius"],
[data-name][style*="border-top-right-radius"],
[data-name][style*="border-bottom-left-radius"],
[data-name][style*="border-bottom-right-radius"] { contain: paint; }
* { transform-style: preserve-3d; }`;
}

export function tokensTs() {
  return `export const tokens = {
  colors: { primary: "#3b82f6", accent: "#FF5733", text: "#111111", muted: "#333333" },
  radii: { none: 0, sm: 4, md: 8, lg: 12 },
  typography: { body: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontSize: 14, lineHeight: 1.4 }, small: { fontSize: 12, lineHeight: 1.35 } },
};
`;
}
export function colorUtilTs() {
  return `
  export function rgba255(r:number,g:number,b:number,a=1){
    const rr=Math.max(0,Math.min(255,Math.round(r)));
    const gg=Math.max(0,Math.min(255,Math.round(g)));
    const bb=Math.max(0,Math.min(255,Math.round(b)));
    const aa=Math.max(0,Math.min(1,a));
    return 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + aa + ')';
  }
`;
}
export function readme(project: string, target: string, imageManifest?: Map<string, string>) {
  const imgCount = imageManifest ? imageManifest.size : 0;
  const list =
    imgCount > 0
      ? Array.from(imageManifest!.entries()).map(([u, p]) => `- ${p.startsWith("data:") ? "(inline data URL)" : p}`).join("\n")
      : "- none";
  return `# ${project} – ${target}
This project was generated from Figma nodes and includes visual styles (background, radius, border, basic text, shadows).
If a frame was selected during conversion, the canvas matches that frame and positions are relative to its top-left.
Images
- For data URLs, images are embedded inline in <img src="data:..."> and no files are written.
- For http(s) URLs, images are downloaded into /public/assets and referenced as /assets/filename.ext.
- Total referenced: ${imgCount}
${list}
`;
}
export function flutterPubspec(name: string): string {
  return `name: ${name}
description: A Flutter project generated from Figma nodes.
publish_to: "none"
version: 1.0.0+1
environment: { sdk: ">=3.0.0 <4.0.0" }
dependencies: { flutter: { sdk: flutter } }
dev_dependencies: { flutter_test: { sdk: flutter } }
flutter: { uses-material-design: true }`;
}
