/* app/api/convert/core/geometry.ts */
import { Rect } from "./types";

export function rectContains(a: Rect, b: Rect) {
  return b.x >= a.x && b.y >= a.y && (b.x + b.w) <= (a.x + a.w) && (b.y + b.h) <= (a.y + a.h);
}
export function rectOverlaps(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
export function rectArea(r: Rect) { return r.w * r.h; }
