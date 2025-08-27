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

      // update cookies
      const res = NextResponse.next();
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
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
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
      ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`
      : `https://api.figma.com/v1/files/${fileKey}`;

    // Fetch from Figma
    const resp = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`, // ✅ use cookie token, not header
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ status: resp.status, err }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error("Error fetching frames:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
