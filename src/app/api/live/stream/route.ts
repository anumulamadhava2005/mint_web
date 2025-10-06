// app/api/live/stream/route.ts
import { NextRequest } from "next/server";
import { addSubscriber, getSnapshot } from "../../store";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fileKey = url.searchParams.get("fileKey");
  if (!fileKey) {
    return new Response(JSON.stringify({ error: "fileKey required" }), { status: 400, headers: CORS });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // helper to enqueue string
      const send = (s: string) => controller.enqueue(encoder.encode(s));

      // Register subscriber which enqueues into this stream
      const unsubscribe = addSubscriber(fileKey, (msg) => {
        try {
          send(msg);
        } catch {}
      });

      // Send initial comment + current version (if present) so clients can fetch immediately
      send(`: connected\n\n`);
      const snap = getSnapshot(fileKey);
      if (snap) {
        const data = JSON.stringify({ version: snap.version });
        send(`event: version\n`);
        send(`data: ${data}\n\n`);
      }

      // heartbeat to keep connection alive
      const iv = setInterval(() => {
        try {
          send(`: keepalive\n\n`);
        } catch {}
      }, 25000);

      // store cleanup on cancel
      (controller as any).oncancel = () => {
        clearInterval(iv);
        unsubscribe();
      };
    },
    cancel() {
      // cancel handled in start via oncancel
    },
  });

  const headers = {
    ...CORS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  return new Response(stream, { status: 200, headers });
}
