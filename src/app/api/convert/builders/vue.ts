/* app/api/convert/builders/vue.ts */
import JSZip from "jszip";
import { DrawableNode, ReferenceFrame } from "../core/types";
import { flattenTreeToNodes } from "../core/tree";
import { readme } from "../shared/styles";

export function buildVue(zip: JSZip, name: string, roots: DrawableNode[], ref: ReferenceFrame | null) {
  const pkg = {
    name, private: true, version: "1.0.0", type: "module",
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
  src.file("App.vue", vueAppVue(roots, ref));
}

function vueIndexHtml() {
  return `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Figma to Vue</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>`;
}
function vueMainTs() { return `import { createApp } from "vue"; import App from "./App.vue"; createApp(App).mount("#app");`; }
function vueViteConfig() { return `import { defineConfig } from "vite"; import vue from "@vitejs/plugin-vue"; export default defineConfig({ plugins: [vue()] });`; }

export function vueAppVue(roots: DrawableNode[], ref: ReferenceFrame | null) {
  const flat = flattenTreeToNodes(roots);
  const stageW = Math.round(ref ? ref.width : Math.max(1, ...flat.map(n => n.ax + n.w)));
  const stageH = Math.round(ref ? ref.height : Math.max(1, ...flat.map(n => n.ay + n.h)));
  const treeJson = JSON.stringify(roots);
  return `<script setup lang="ts">
import { ref as vueRef, onMounted, onBeforeUnmount, h, defineComponent } from "vue";
type Node = ${`{
  id: string; name: string; type: string;
  x: number; y: number; w: number; h: number;
  ax: number; ay: number;
  textRaw?: string | null;
  fill?: any; stroke?: any; corners?: any; effects?: any; text?: any;
  children: Node[];
}`};
const roots = ${treeJson} as Node[];
const refW = ${stageW};
const refH = ${stageH};

const outerRef = vueRef<HTMLElement | null>(null);
const scale = vueRef(1);
let ro: ResizeObserver | null = null;

onMounted(() => {
  if (!outerRef.value) return;
  ro = new ResizeObserver(([entry]) => {
    const cw = entry.contentRect.width;
    const ch = entry.contentRect.height;
    const sx = cw / refW;
    const sy = ch / refH;
    scale.value = Math.max(0.01, Math.min(sx, sy));
  });
  ro.observe(outerRef.value);
});
onBeforeUnmount(() => { if (ro) ro.disconnect(); });

function isText(n: Node){ return String(n.type).toUpperCase()==="TEXT"; }
function isImage(n: Node){ return n.fill?.type==="IMAGE" && !!n.fill.imageRef; }
function styleFor(n: Node){
  const s:any={ position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h };
  if(!isText(n) && !isImage(n) && n.fill?.type==="SOLID" && n.fill.color) s.background=n.fill.color;
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

const Box = defineComponent({
  props: { node: { type: Object, required: true } },
  setup(props:any){
    const n=props.node; const s:any=styleFor(n);
    const it = String(n.type).toUpperCase()==="TEXT";
    const text = it ? (n.text?.characters ?? n.textRaw ?? "") : (n.text?.characters ?? n.textRaw ?? null);
    return ()=> h("div", { style:s, "data-name": n.name }, [
      (text!==null) && h("div", { style: { fontSize: (it && n.text?.fontSize) || 11 } }, text)
    ]);
  }
});
const TreeNode = defineComponent({
  props: { node: { type: Object, required: true } },
  setup(props:any){
    const n = props.node;
    const isImg = n.fill?.type==="IMAGE" && !!n.fill.imageRef;
    if(isImg){
      // Respect the fill's fit mode: cover (default), contain, fill
      const fitMode = n.fill?.fit || "cover";
      const objectFit = fitMode === "fill" ? "fill" : fitMode === "contain" ? "contain" : "cover";
      const s:any = { position:"absolute", left:n.x, top:n.y, width:n.w, height:n.h, objectFit };
      return ()=> h("img", { style: s, alt: n.name, src: typeof n.fill.imageRef==="string" && n.fill.imageRef.startsWith("data:") ? n.fill.imageRef : "" });
    }
    if(n.children.length>0){
      const s:any = styleFor(n);
      return ()=> h("div", { style: s, "data-name": n.name }, n.children.map((c:any)=> h(TreeNode, { node:c })));
    }
    return ()=> h(Box, { node:n });
  }
});
</script>

<template>
  <div ref="outerRef" style="position:relative;width:100%;height:100%;overflow:auto;background:#fff;">
  <div :style="{ position:'relative', width:'100%', aspectRatio: String(refW) + ' / ' + String(refH) }">
  <div :style="{ position:'absolute', left:'0px', top:'0px', width: refW + 'px', height: refH + 'px', transform: 'scale(' + String(scale) + ')', transformOrigin: 'top left' }">
        <template v-for="(n, i) in roots" :key="n.id + ':' + i">
          <div v-if="n.children.length>0 && !isImage(n) && !isText(n)" :style="styleFor(n)" :data-name="n.name">
            <TreeNode v-for="(c, j) in n.children" :key="c.id + ':' + j" :node="c" />
          </div>
          <Box v-else :node="n" />
        </template>
      </div>
    </div>
  </div>
</template>
`;
}
