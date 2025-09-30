/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

async function refreshAccessToken(refreshToken: string) {
  const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(JSON.stringify(json));
  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };
}

export async function GET(req: NextRequest) {
  let accessToken = req.cookies.get("figma_access")?.value;
  const refreshToken = req.cookies.get("figma_refresh")?.value;

  try {
    // If no access token, try refreshing
    if (!accessToken && refreshToken) {
      const tokens = await refreshAccessToken(refreshToken);
      accessToken = tokens.access_token;

      // update cookies and return success response
      const response = NextResponse.json({ 
        message: "Token refreshed successfully",
        accessToken: tokens.access_token 
      });
      response.cookies.set("figma_access", tokens.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(60, tokens.expires_in - 60),
      });
      if (tokens.refresh_token) {
        response.cookies.set("figma_refresh", tokens.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return response;
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "No valid Figma session, please re-authenticate" },
        { status: 401 }
      );
    }

    // Call Figma API
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("fileUrl");
    const nodeId = searchParams.get("nodeId"); // optional

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing fileUrl query param" }, { status: 400 });
    }

    // Extract file key from URL
    const match = fileUrl.match(/\/design\/([a-zA-Z0-9]+)\//);
    if (!match) {
      return NextResponse.json({ error: "Invalid Figma file URL" }, { status: 400 });
    }
    const fileKey = match[1];

    // Build API URL
    const apiUrl = nodeId
      ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`
      : `https://api.figma.com/v1/files/${fileKey}`;

    const resp = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`Figma API error ${resp.status}:`, err);
      return NextResponse.json({ status: resp.status, err }, { status: resp.status });
    }

    let data;
    try {
      data = await resp.json();
    } catch (parseError) {
      console.error("Failed to parse Figma API response as JSON:", parseError);
      const responseText = await resp.text();
      console.error("Response text:", responseText);
      return NextResponse.json({ 
        error: "Invalid JSON response from Figma API", 
        details: responseText.substring(0, 200) 
      }, { status: 500 });
    }

    // Extract properties: support both payload shapes
    // files/:key returns { document, components, componentSets, styles, ... }
    // files/:key/nodes returns { nodes: { [id]: { document, components, ... } } }
    let extractedTree: unknown[] = [];
    if (data?.document) {
      extractedTree = buildHierarchy(data.document as FigmaNode);
    } else if (data?.nodes) {
      // Merge all returned node subtrees
      const mergedRoots: FigmaNode[] = [];
      Object.values(data.nodes).forEach((entry: any) => {
        if (entry && entry.document) {
          mergedRoots.push(entry.document);
        }
      });
      extractedTree = mergedRoots.flatMap(buildHierarchy);
    }

    // Return both raw JSON and extracted properties
    return NextResponse.json({
      raw: data,
      extracted: extractedTree,
    });

  } catch (err) {
    console.error("Error fetching frames:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Style extraction helpers
type Paint = {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
  imageRef?: string;
};

type Effect = {
  type: string;
  visible?: boolean;
  radius?: number;
  offset?: { x: number; y: number };
  color?: { r: number; g: number; b: number; a?: number };
  spread?: number;
  blendMode?: string;
  innerShadow?: boolean;
};

type FigmaNode = {
  id?: string;
  name?: string;
  type?: string;
  fills?: Paint[] | null;
  backgrounds?: Paint[] | null;
  strokes?: Paint[] | null;
  strokeWeight?: number | null;
  strokeAlign?: string | null;
  dashPattern?: number[] | null;
  effects?: Effect[] | null;
  topLeftRadius?: number | null;
  topRightRadius?: number | null;
  bottomRightRadius?: number | null;
  bottomLeftRadius?: number | null;
  rectangleCornerRadii?: number[] | null;
  cornerRadius?: number | null;
  style?: Record<string, unknown> | null;
  styleOverrideTable?: Record<string, unknown> | null;
  fontSize?: number | null;
  fontName?: string | { family: string; style: string } | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  textDecoration?: string | null;
  textCase?: string | null;
  characters?: string | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  children?: FigmaNode[];
};

function to255(v: number) { return Math.round((v ?? 0) * 255); }
function rgba(c?: { r: number; g: number; b: number; a?: number }, fallbackOpacity?: number) {
  if (!c) return undefined;
  const a = typeof c.a === "number" ? c.a : (typeof fallbackOpacity === "number" ? fallbackOpacity : 1);
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${+a.toFixed(3)})`;
}

function extractFill(paints?: Paint[] | null) {
  if (!paints || paints.length === 0) return null;
  const p = paints.find((pp) => pp?.visible !== false) || paints[0];
  if (!p) return null;
  if (p.type === "SOLID") {
    return { type: "SOLID", color: rgba(p.color, p.opacity) };
  }
  if (p.type && p.type.startsWith("GRADIENT")) {
    const stops = (p.gradientStops || []).map((s) => ({ position: s.position, color: rgba(s.color) }));
    return { type: p.type, stops };
  }
  if (p.type === "IMAGE") {
    return { type: "IMAGE", imageRef: p.imageRef || null };
  }
  return { type: p.type };
}

function extractStroke(node: FigmaNode) {
  const strokes: Paint[] = node?.strokes || [];
  if (!strokes.length) return null;
  const first = strokes.find((pp) => pp?.visible !== false) || strokes[0];
  return {
    color: rgba(first?.color, first?.opacity),
    weight: node?.strokeWeight ?? null,
    align: node?.strokeAlign ?? null, // INSIDE | OUTSIDE | CENTER
    dashPattern: node?.dashPattern ?? null,
  };
}

function extractCorners(node: FigmaNode) {
  const tl = node?.topLeftRadius ?? node?.rectangleCornerRadii?.[0] ?? null;
  const tr = node?.topRightRadius ?? node?.rectangleCornerRadii?.[1] ?? null;
  const br = node?.bottomRightRadius ?? node?.rectangleCornerRadii?.[2] ?? null;
  const bl = node?.bottomLeftRadius ?? node?.rectangleCornerRadii?.[3] ?? null;
  const uniform = node?.cornerRadius ?? null;
  return { uniform, topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
}

function extractEffects(node: FigmaNode) {
  const eff: Effect[] = node?.effects || [];
  if (!eff.length) return [];
  return eff
    .filter((e) => e?.visible !== false)
    .map((e) => {
      const kind = e.type;
      const color = rgba(e.color);
      const x = e.offset?.x ?? 0;
      const y = e.offset?.y ?? 0;
      const blur = e.radius ?? 0;
      const spread = (e as { spread?: number }).spread ?? 0;
      const inset = kind === "INNER_SHADOW";
      return { type: kind, boxShadow: `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color || "rgba(0,0,0,0.2)"}` };
    });
}

function extractTextStyles(node: FigmaNode) {
  if (node?.type !== "TEXT") return null;
  const fontSize = node?.fontSize ?? (node?.style && typeof node.style === 'object' && 'fontSize' in node.style ? node.style.fontSize as number : null) ?? null;
  const fontName = node?.fontName ?? (node?.style && typeof node.style === 'object' && 'fontFamily' in node.style ? node.style.fontFamily as string : null) ?? null;
  const fontFamily = fontName && typeof fontName === "object" ? fontName.family : (node?.style && typeof node.style === 'object' && 'fontFamily' in node.style ? node.style.fontFamily as string : null) ?? null;
  const fontStyle = fontName && typeof fontName === "object" ? fontName.style : (node?.style && typeof node.style === 'object' && 'fontPostScriptName' in node.style ? node.style.fontPostScriptName as string : null) ?? null;
  const lineHeight = node?.lineHeight ?? (node?.style && typeof node.style === 'object' && 'lineHeightPx' in node.style ? node.style.lineHeightPx as number : null) ?? (node?.style && typeof node.style === 'object' && 'lineHeightPercent' in node.style ? node.style.lineHeightPercent as number : null) ?? null;
  const letterSpacing = node?.letterSpacing ?? (node?.style && typeof node.style === 'object' && 'letterSpacing' in node.style ? node.style.letterSpacing as number : null) ?? null;
  const textDecoration = node?.textDecoration ?? (node?.style && typeof node.style === 'object' && 'textDecoration' in node.style ? node.style.textDecoration as string : null) ?? null;
  const textCase = node?.textCase ?? (node?.style && typeof node.style === 'object' && 'textCase' in node.style ? node.style.textCase as string : null) ?? null;
  return {
    fontSize,
    fontFamily,
    fontStyle,
    lineHeight,
    letterSpacing,
    textDecoration,
    textCase,
    characters: node?.characters ?? null,
  };
}

function nodeSummary(node: FigmaNode) {
  const bb = node?.absoluteBoundingBox || null;
  const fill = extractFill(node?.fills || node?.backgrounds);
  const stroke = extractStroke(node);
  const corners = extractCorners(node);
  const effects = extractEffects(node);
  const text = extractTextStyles(node);

  return {
    id: node?.id,
    name: node?.name,
    type: node?.type,
    absoluteBoundingBox: bb,
    fill,
    stroke,
    corners,
    effects,
    text,
  };
}

function buildHierarchy(root: FigmaNode): unknown[] {
  const result: unknown[] = [];
  const walk:any = (n: FigmaNode) => {
    if (!n) return null;

    const visualTypes = new Set([
      "FRAME", "RECTANGLE", "ELLIPSE", "VECTOR", "POLYGON", "STAR", "LINE",
      "COMPONENT", "INSTANCE", "GROUP", "TEXT", "SECTION", "SHAPE_WITH_TEXT",
    ]);

    if (!visualTypes.has(n?.type || "")) {
      if (n.children) {
        return n.children.flatMap(walk);
      }
      return null;
    }

    const summary: any = nodeSummary(n);
    if (n.children) {
      const children = n.children.flatMap(walk).filter(Boolean);
      if (children.length > 0) {
        summary.children = children;
      }
    }

    return summary;
  };

  if (root.children) {
    result.push(...root.children.flatMap(walk).filter(Boolean));
  } else {
    result.push(walk(root));
  }

  return result.filter(Boolean);
}