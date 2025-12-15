export type FillStyle =
  | {
      type: string;
      color?: string;
      stops?: Array<{ position: number; color: string }>;
      imageRef?: string | null;
      fit?: "cover" | "contain" | "fill" | null;
      opacity?: number | null;
    }
  | null;

export type StrokeStyle =
  | {
      color?: string;
      weight?: number | null;
      align?: string | null;
      dashPattern?: number[] | null;
    }
  | null;

export type Corners = {
  uniform?: number | null;
  topLeft?: number | null;
  topRight?: number | null;
  bottomRight?: number | null;
  bottomLeft?: number | null;
} | null;

export type EffectStyle = { type: string; boxShadow?: string } | null;

export type TextStyle = {
  fontSize?: number | null;
  fontFamily?: string | null;
  fontStyle?: string | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  textDecoration?: string | null;
  textCase?: string | null;
  characters?: string | null;
  color?: string | null;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | null;
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM" | null;
  paragraphSpacing?: number | null;
  paragraphIndent?: number | null;
} | null;

export type NodeInput = {
  id: string;
  name: string;
  type: string;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  children?: NodeInput[];
  characters?: string;
  textContent?: string | null;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  corners?: Corners;
  effects?: Array<Exclude<EffectStyle, null>> | null;
  text?: TextStyle;
  // High priority visual features
  opacity?: number | null;
  blendMode?: string | null;
  rotation?: number | null;
  clipsContent?: boolean | null;
  fills?: FillStyle[] | null;
  strokes?: StrokeStyle[] | null;
};

export type DrawableNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: DrawableNode[];
  textContent?: string | null;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  corners?: Corners;
  effects?: Array<Exclude<EffectStyle, null>> | null;
  text?: TextStyle;
  // High priority visual features
  opacity?: number | null;
  blendMode?: string | null;
  rotation?: number | null;
  clipsContent?: boolean | null;
  fills?: FillStyle[] | null;
  strokes?: StrokeStyle[] | null;
};

export type ReferenceFrame = {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
