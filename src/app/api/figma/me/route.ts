// app/api/figma/me/route.ts
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

  if (!tokenRes.ok) {
    throw new Error("Failed to refresh token");
  }

  return await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };
}

export async function GET(req: NextRequest) {
  let accessToken = req.cookies.get("figma_access")?.value;
  const refreshToken = req.cookies.get("figma_refresh")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Try with existing access token
    let response = await fetch("https://api.figma.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status === 401 && refreshToken) {
      // Access token expired, try to refresh
      console.log("Access token expired, attempting refresh...");
      try {
        const newTokens = await refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;

        // Try again with new access token
        response = await fetch("https://api.figma.com/v1/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        // If successful, update cookies with new tokens
        if (response.ok) {
          const res = NextResponse.json(await response.json());
          res.cookies.set("figma_access", newTokens.access_token, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: Math.max(60, newTokens.expires_in - 60),
          });
          if (newTokens.refresh_token) {
            res.cookies.set("figma_refresh", newTokens.refresh_token, {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: 60 * 60 * 24 * 30, // ~30 days
            });
          }
          return res;
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // Fall through to delete cookies below
      }
    }

    if (!response.ok) {
      // Token still invalid or refresh failed
      const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
      res.cookies.delete("figma_access");
      res.cookies.delete("figma_refresh");
      return res;
    }

    const userData = await response.json();
    return NextResponse.json(userData);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}