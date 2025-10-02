"use client"

import type React from "react"

export function Box({
  style,
  dataName,
  text,
  isText,
  children,
  onClick,
}: {
  style: React.CSSProperties
  dataName: string
  text?: string | ""
  isText: boolean
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement>
}) {
  const innerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: isText ? "flex-start" : "center",
    overflow: "hidden",
    textAlign: isText ? "left" : "center",
    boxSizing: "border-box",
    padding: 4,
  }

  const textStyle: React.CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  }

  return (
    <div style={style} data-name={dataName} onClick={onClick}>
      <div style={innerStyle}>
        {isText && text ? <div style={textStyle}>{text}</div> : null}
        {children}
      </div>
    </div>
  )
}
