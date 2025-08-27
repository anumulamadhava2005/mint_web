// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.FIGMA_CLIENT_ID!;
  const redirectUri = encodeURIComponent(process.env.FIGMA_REDIRECT_URI!);
  const state = crypto.randomUUID();
  const scope = encodeURIComponent("file_read"); // minimal scope for reading files/frames

  const url =
    `https://www.figma.com/oauth?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}&scope=${scope}` +
    `&state=${state}&response_type=code`;

  const res = NextResponse.redirect(url);
  // short-lived state cookie to prevent CSRF
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
