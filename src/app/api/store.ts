type SnapshotPayload = {
  roots: any[];
  manifest: Record<string, string>;
  refW: number;
  refH: number;
  version: number;
  timestamp: number;
};

const snapshots = new Map<string, SnapshotPayload>();
// subscribers: fileKey -> Set of send functions (msg: string) => void
const subscribers = new Map<string, Set<(msg: string) => void>>();

// Persist snapshot, increment version, broadcast to subscribers
export function setSnapshot(fileKey: string, payload: { roots: any[]; manifest: Record<string, string>; refW: number; refH: number; }) {
  const existing = snapshots.get(fileKey);
  const nextVersion = (existing?.version || 0) + 1;
  const snap: SnapshotPayload = {
    roots: payload.roots,
    manifest: payload.manifest || {},
    refW: payload.refW,
    refH: payload.refH,
    version: nextVersion,
    timestamp: Date.now(),
  };
  snapshots.set(fileKey, snap);
  broadcastVersion(fileKey, nextVersion);
  return snap;
}

export function getSnapshot(fileKey: string) {
  return snapshots.get(fileKey) ?? null;
}

export function addSubscriber(fileKey: string, sendFn: (msg: string) => void) {
  let set = subscribers.get(fileKey);
  if (!set) {
    set = new Set();
    subscribers.set(fileKey, set);
  }
  set.add(sendFn);
  return () => {
    set!.delete(sendFn);
    if (set!.size === 0) subscribers.delete(fileKey);
  };
}

function broadcastVersion(fileKey: string, version: number) {
  const set = subscribers.get(fileKey);
  if (!set) return;
  const data = JSON.stringify({ version });
  for (const send of Array.from(set)) {
    try {
      // SSE payload (client expects event 'version')
      send(`event: version\n`);
      send(`data: ${data}\n\n`);
    } catch (e) {
      // ignore individual subscriber failures
    }
  }
}

// Exported for tests / direct use if needed
export function _debug_dump() {
  return { snapshots: Array.from(snapshots.entries()), subscriberCounts: Array.from(subscribers.entries()).map(([k, s]) => [k, s.size]) };
}
