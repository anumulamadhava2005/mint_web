// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

async function exchangeCodeForToken(code: string) {
  const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
    // IMPORTANT: use api.figma.com/v1/oauth/token
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      redirect_uri: process.env.FIGMA_REDIRECT_URI!,
      code,
      grant_type: "authorization_code",
    }),
  });

  const json = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(JSON.stringify(json));
  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in: number; // seconds
    token_type: string;
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForToken(code);

    const res = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
    res.cookies.delete("oauth_state");
    res.cookies.set("figma_access", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, tokens.expires_in - 60),
    });
    if (tokens.refresh_token) {
      res.cookies.set("figma_refresh", tokens.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // ~30 days
      });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
