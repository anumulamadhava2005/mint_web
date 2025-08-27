/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/figma/me/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const access = req.cookies.get("figma_access")?.value;
  if (!access) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.figma.com/v1/me", {
      headers: { Authorization: `Bearer ${access}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
