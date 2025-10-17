// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const res = NextResponse.redirect(redirectUrl);

  // Clear authentication cookies
  res.cookies.set("figma_access", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });

  res.cookies.set("figma_refresh", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });

  return res;
}