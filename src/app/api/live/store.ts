// app/api/live/store.ts

export type SnapshotPayload = {
  roots: any[];                    // Drawable tree produced by your editor
  manifest: Record<string, string>; // imageRef -> signed URL
  refW: number;
  refH: number;
};

export type Snapshot = {
  version: number;
  payload: SnapshotPayload;
};

const byKey = new Map<string, Snapshot>();
let lastKey: string | null = null;

// SSE client registry per fileKey
const clients = new Map<string, Set<WritableStreamDefaultWriter>>();

export function getSnapshot(fileKey: string): Snapshot | null {
  return byKey.get(fileKey) ?? null;
}

export function getLastKey(): string | null {
  return lastKey;
}

export function setSnapshot(fileKey: string, payload: SnapshotPayload) {
  const prev = byKey.get(fileKey);
  const snap: Snapshot = { version: (prev?.version ?? 0) + 1, payload };
  byKey.set(fileKey, snap);
  lastKey = fileKey;
  broadcast(fileKey, snap.version);
  return snap;
}

export function addClient(fileKey: string, writer: WritableStreamDefaultWriter) {
  if (!clients.has(fileKey)) clients.set(fileKey, new Set());
  clients.get(fileKey)!.add(writer);
}

export function removeClient(fileKey: string, writer: WritableStreamDefaultWriter) {
  clients.get(fileKey)?.delete(writer);
}

function broadcast(fileKey: string, version: number) {
  const set = clients.get(fileKey);
  if (!set || set.size === 0) return;
  const enc = new TextEncoder();
  const line = enc.encode(`event: version\ndata: ${JSON.stringify({ version })}\n\n`);
  for (const w of [...set]) {
    w.write(line).catch(() => {
      set.delete(w);
    });
  }
}
