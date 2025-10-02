import React from "react";
import { DrawableNode } from "../lib/figma-types";
import { Box } from "./Box";

function renderNode(node: DrawableNode): React.ReactNode {
  const { x, y, width, height, children, ...rest } = node;

  const style: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: width,
    height: height,
    background: (rest.fill as any)?.color || "transparent",
    border: rest.stroke
      ? `${rest.stroke.weight}px solid ${rest.stroke.color}`
      : "none",
    borderRadius:
      rest.corners?.uniform ||
      (rest.corners
        ? `${rest.corners.topLeft}px ${rest.corners.topRight}px ${rest.corners.bottomRight}px ${rest.corners.bottomLeft}px`
        : undefined),
    boxShadow: rest.effects?.map((e) => e.boxShadow).join(", ") || undefined,
  };

  if (node.type === "TEXT" && node.text) {
    if (node.text.color != null) style.color = node.text.color;
    if (node.text.fontSize != null) style.fontSize = node.text.fontSize;
    if (node.text.fontFamily != null) style.fontFamily = node.text.fontFamily;
    if (node.text.textDecoration != null) style.textDecoration = node.text.textDecoration;
  }

  return (
    <Box key={node.id} style={style} dataName={node.name} isText={node.type === "TEXT"} text={node.text?.characters ?? undefined}>
      {children && children.length > 0 && children.map(renderNode)}
    </Box>
  );
}

export function RenderTree({ nodes }: { nodes: DrawableNode[] }) {
  if (!nodes) {
    return null;
  }
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "auto",
      }}
    >
      {nodes.map(renderNode)}
    </div>
  );
}
