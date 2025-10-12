/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";

export function Box({
  style,
  dataName,
  text,
  isText,
  children,
  onClick,
}: {
  style: React.CSSProperties;
  dataName: string;
  text?: string | "";
  isText: boolean;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  // Respect any padding already computed into style; default to 4 only if none provided
  const hasPad =
    style.padding != null ||
    style.paddingLeft != null ||
    style.paddingRight != null ||
    style.paddingTop != null ||
    style.paddingBottom != null;

  const innerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: isText ? "inline-flex" : "flex",
    alignItems: "center",
    justifyContent: isText ? "flex-start" : "center",
    overflow: "visible",
    textAlign: isText ? "left" : "center",
    ...(hasPad ? {} : { padding: 4 }),
  };

  // Derive paragraph spacing if the caller provided it via style.paragraphSpacing
  const paraGap =
    (style as any).paragraphSpacing != null
      ? Number((style as any).paragraphSpacing)
      : 0;

  const textStyle: React.CSSProperties = {
    ...(paraGap ? { marginBottom: paraGap } : {}),
    // Keep text from expanding container when explicit width is set
    maxWidth: "100%",
  };

  return (
    <div style={style} data-name={dataName} onClick={onClick}>
      <div style={innerStyle}>
        {isText && text !== "" && text !== undefined ? (
          <div style={textStyle}>{text}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
