/* app/api/convert/builders/flutter.ts */
import JSZip from "jszip";
import { Drawable, ReferenceFrame } from "../core/types";
import { readme, flutterPubspec } from "../shared/styles";

export function buildFlutter(zip: JSZip, name: string, d: Drawable[], ref: ReferenceFrame | null) {
  zip.file("pubspec.yaml", flutterPubspec(name));
  const items = d.map((b) => ({
    x: b.x, y: b.y, w: b.w, h: b.h, name: b.name,
    text: b.text?.characters ?? b.textRaw ?? null,
    isText: String(b.type).toUpperCase() === "TEXT",
    bg: b.fill?.type === "SOLID" ? b.fill.color ?? null : null,
    borderWidth: b.stroke?.weight ?? null, borderColor: b.stroke?.color ?? null,
    radius: b.corners?.uniform ?? null,
  }));
  const itemsJson = JSON.stringify(items);
  const container = ref ? { w: Math.round(ref.width), h: Math.round(ref.height) } : null;
  zip.folder("lib")!.file(
    "main.dart",
    `import 'package:flutter/material.dart';
void main()=>runApp(const MyApp());
class MyApp extends StatelessWidget{const MyApp({super.key});@override Widget build(BuildContext context){return MaterialApp(home: Scaffold(body:${container ? `SizedBox(width:${container.w}.0,height:${container.h}.0, child: Stack(children: buildBoxes()))` : `Stack(children: buildBoxes())`},),);}}
List<Widget> buildBoxes(){const items=${itemsJson};return items.map((b){return Positioned(left:(b["x"] as num).toDouble(),top:(b["y"] as num).toDouble(),width:(b["w"] as num).toDouble(),height:(b["h"] as num).toDouble(),child: Container(padding: const EdgeInsets.all(4),decoration: BoxDecoration(color: Colors.white,border:(b["borderWidth"]!=null&&b["borderColor"]!=null)?Border.all(color: const Color(0xFF3B82F6),width:(b["borderWidth"] as num).toDouble()):null,borderRadius:(b["radius"]!=null)?BorderRadius.circular((b["radius"] as num).toDouble()):null,),child: Column(crossAxisAlignment: CrossAxisAlignment.start,children:[if(b["text"]!=null) Text(b["text"] as String,style: const TextStyle(fontSize:11,color: Color(0xFF333333))),],),),);}).toList();}`
  );
  zip.file("README.md", readme(name, "flutter"));
}
