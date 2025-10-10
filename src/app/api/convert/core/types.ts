/* app/api/convert/core/types.ts */

export type FillStyle = {
  type: string;
  color?: string;
  stops?: Array<{ position: number; color: string }>;
  imageRef?: string | null;
  fit?: "cover" | "contain" | "fill" | null;
  opacity?: number | null;
};

export type StrokeStyle = {
  color?: string | null;
  weight?: number | null;
  align?: "INSIDE" | "CENTER" | "OUTSIDE" | null;
  dashPattern?: number[] | null;
};

export type Corners = {
  uniform?: number | null;
  topLeft?: number | null;
  topRight?: number | null;
  bottomRight?: number | null;
  bottomLeft?: number | null;
};

export type EffectStyle = { type: string; boxShadow?: string };

export type TextStyle = {
  fontSize?: number | null;
  fontFamily?: string | null;
  fontStyle?: string | null;
  fontWeight?: number | string | null;
  lineHeight?: number | string | null;
  letterSpacing?: number | string | null;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | null;
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM" | null;
  paragraphSpacing?: number | null;
  paragraphIndent?: number | null;
  textDecoration?: string | null;
  textCase?: string | null;
  color?: string | null;
  characters?: string | null;
};

export type NodeInput = {
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

  // NEW: raw Figma paints (arrays)
  fills?: FillStyle[] | null;
  strokes?: StrokeStyle[] | null;

  // Legacy single paint (still honored if present)
  fill?: FillStyle | null;
  stroke?: StrokeStyle | null;

  corners?: Corners | null;
  effects?: EffectStyle[] | null;
  text?: TextStyle | null;
};

export type Drawable = {
  id: string; name: string; type: string;
  x: number; y: number; w: number; h: number;
  textRaw?: string | null;
  fill?: FillStyle | null; stroke?: StrokeStyle | null; corners?: Corners | null;
  effects?: EffectStyle[] | null; text?: TextStyle | null;
};

export type UXMeta = {
  scrollX?: boolean;
  snap?: boolean;
  snapAlign?: "start" | "center" | "end";
  wrapped?: boolean;
  peek?: boolean;
  elevate?: boolean;
  padL?: number;
  padR?: number;
};

export type DrawableNode = {
  id: string; name: string; type: string;
  ax: number; ay: number; x: number; y: number; w: number; h: number;
  textRaw?: string | null;
  fill?: FillStyle | null; stroke?: StrokeStyle | null; corners?: Corners | null;
  effects?: EffectStyle[] | null; text?: TextStyle | null;
  children: DrawableNode[];
  ux?: UXMeta;
};

export type ReferenceFrame = { id: string; x: number; y: number; width: number; height: number };
export type Payload = { target: string; fileName: string; nodes: NodeInput[]; referenceFrame?: ReferenceFrame | null };
export type Rect = { x: number; y: number; w: number; h: number };
