// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

async function exchangeCodeForToken(code: string) {
  console.log("[OAuth] Exchanging code with Figma API...");
  console.log("[OAuth] client_id:", process.env.FIGMA_CLIENT_ID);
  console.log("[OAuth] redirect_uri:", process.env.FIGMA_REDIRECT_URI);
  
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
  console.log("[OAuth] Token response status:", tokenRes.status);
  console.log("[OAuth] Token response:", JSON.stringify(json));
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

  console.log("[OAuth Callback] code:", code ? "present" : "missing");
  console.log("[OAuth Callback] state:", state);
  console.log("[OAuth Callback] cookieState:", cookieState);

  if (!code || !state || state !== cookieState) {
    console.log("[OAuth Callback] State mismatch or missing code");
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    console.log("[OAuth Callback] Exchanging code for token...");
    const tokens = await exchangeCodeForToken(code);
    console.log("[OAuth Callback] Token exchange successful");

  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log("[OAuth Callback] Redirecting to:", redirectUrl + "/#projects");
  const res = NextResponse.redirect(new URL("/#projects", redirectUrl));
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.delete("oauth_state");
    res.cookies.set("figma_access", tokens.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, tokens.expires_in - 60),
    });
    if (tokens.refresh_token) {
      res.cookies.set("figma_refresh", tokens.refresh_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // ~30 days
      });
    }
    return res;
  } catch (e) {
    console.error("[OAuth Callback] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
