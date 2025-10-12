/* app/api/convert/builders/svelte.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame } from "../core/types";
import { flattenTreeToNodes } from "../core/tree";
import { readme } from "../shared/styles";

export function buildSvelte(zip: JSZip, name: string, roots: DrawableNode[], ref: ReferenceFrame | null) {
  const pkg = {
    name, private: true, version: "1.0.0", type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    devDependencies: { vite: "^5.0.0", svelte: "^4.2.0", "@sveltejs/vite-plugin-svelte": "^3.0.0" },
  };
  zip.file("package.json", JSON.stringify(pkg, null, 2));
  zip.file("index.html", svelteIndexHtml());
  zip.file("vite.config.ts", svelteViteConfig());
  zip.file("README.md", readme(name, "svelte"));

  const src = zip.folder("src")!;
  src.file("main.ts", svelteMainTs());
  src.file("App.svelte", svelteApp(roots, ref));
}

function svelteIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Svelte</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function svelteMainTs() { return `import App from "./App.svelte"; new App({ target: document.getElementById("app")! });`; }
function svelteViteConfig() { return `import { defineConfig } from "vite"; import { svelte } from "@sveltejs/vite-plugin-svelte"; export default defineConfig({ plugins: [svelte()] });`; }

export function svelteApp(roots: DrawableNode[], ref: ReferenceFrame | null) {
  const flat = flattenTreeToNodes(roots);
  const stageW = Math.round(ref ? ref.width : Math.max(1, ...flat.map(n => n.ax + n.w)));
  const stageH = Math.round(ref ? ref.height : Math.max(1, ...flat.map(n => n.ay + n.h)));
  const rootsJson = JSON.stringify(roots).replace(/\\"([^\\"]+)\\":/g, "$1:");

  return `<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  export let roots = ${rootsJson};
  const refW = ${stageW};
  const refH = ${stageH};

  let outerEl: HTMLDivElement | null = null;
  let scale = 1;
  let ro: ResizeObserver | null = null;

  onMount(() => {
    if (!outerEl) return;
    ro = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width;
      const ch = entry.contentRect.height;
      const sx = cw / refW;
      const sy = ch / refH;
      scale = Math.max(0.01, Math.min(sx, sy));
    });
    ro.observe(outerEl);
  });
  onDestroy(() => { if (ro) ro.disconnect(); });

  const isText = (n:any)=> String(n.type).toUpperCase()==="TEXT";
  const isImg  = (n:any)=> n.fill?.type==="IMAGE" && !!n.fill.imageRef;
  function cssFrom(n:any){
    const s:any={ position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h };
    if(!isText(n) && !isImg(n) && n.fill?.type==="SOLID" && n.fill.color) s.background=n.fill.color;
    if(!isText(n) && n.stroke?.weight){ s.borderWidth=n.stroke.weight; s.borderStyle="solid"; if(n.stroke?.color) s.borderColor=n.stroke.color; }
    if(n.corners){
      const {topLeft,topRight,bottomRight,bottomLeft,uniform}=n.corners;
      if(topLeft!=null) s.borderTopLeftRadius=topLeft;
      if(topRight!=null) s.borderTopRightRadius=topRight;
      if(bottomRight!=null) s.borderBottomRightRadius=bottomRight;
      if(bottomLeft!=null) s.borderBottomLeftRadius=bottomLeft;
      if(uniform!=null && !("borderTopLeftRadius" in s)) s.borderRadius=uniform;
    }
    return s;
  }
</script>

<div bind:this={outerEl} style="position:relative;width:100%;height:100%;overflow:auto;background:#fff;">
  <div style={"position:relative;width:100%;aspect-ratio:" + refW + " / " + refH}>
    <div style={"position:absolute;left:0;top:0;width:"+refW+"px;height:"+refH+"px;transform:scale("+scale+");transform-origin:top left"}>
      {#each roots as n, i (n.id + ':' + i)}
        {#if n.children.length>0 && !isImg(n) && !isText(n)}
          <div style={cssFrom(n)} data-name={n.name}>
            {#each n.children as c, j (c.id + ':' + j)}
              <!-- Render children similarly or inline boxes as desired -->
              <div style={cssFrom(c)} data-name={c.name}></div>
            {/each}
          </div>
        {:else}
          <div style={cssFrom(n)} data-name={n.name}></div>
        {/if}
      {/each}
    </div>
  </div>
</div>
`;
}
