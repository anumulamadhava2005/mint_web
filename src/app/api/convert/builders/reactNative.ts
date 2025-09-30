/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/api/convert/builders/reactNative.ts */
import JSZip from "jszip";
import { Drawable, ReferenceFrame } from "../core/types";
import { readme } from "../shared/styles";

export function buildReactNative(zip: JSZip, name: string, d: Drawable[], _ref: ReferenceFrame | null) {
  const pkg = {
    name, private: true, version: "1.0.0", main: "App.js",
    scripts: { start: "expo start" }, dependencies: { expo: "~51.0.0", react: "18.2.0", "react-native": "0.74.0" },
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
  const rnBoxesJson = JSON.stringify(rnBoxes).replace(/\"([^\"]+)\":/g, "$1:");
  zip.file(
    "App.js",
    `import React from "react"; import { View, Text, SafeAreaView, StyleSheet } from "react-native";
const boxes = ${rnBoxesJson};
export default function App(){return(<SafeAreaView style={styles.root}><View style={styles.stage}>{boxes.map((b,i)=>(<Box key={i} style={b.style} name={b.name} text={b.text} isText={b.isText} textStyle={b.textStyle}/>))}</View></SafeAreaView>);}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:"#fff"},stage:{flex:1}});
function Box({style,name,text,isText,textStyle}){return(<View style={style}>{(text!==null&&text!==undefined)&&(<Text style={{fontSize:11,color:"#333",...(textStyle||{})}}>{text}</Text>)}</View>);}
`
  );
  zip.folder("assets")?.file(".gitkeep", "");
  zip.file(".watchmanconfig", '{ "ignore_dirs": ["node_modules"] }');
}

function rnStyleFromDrawable(d: Drawable) {
  const style: Record<string, any> = {
    position: "absolute", left: d.x, top: d.y, width: d.w, height: d.h, padding: 4,
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
