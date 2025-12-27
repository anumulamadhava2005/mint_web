const fs = require('fs');
const path = require('path');
const SNAP = path.join(__dirname, '../public/live/snapshots/1760711769510.json');
const raw = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const roots = raw.payload && raw.payload.roots ? raw.payload.roots : [];

function getAbsAndSize(n) {
  const abs = n.absoluteBoundingBox ?? {};
  const ax = Number(n.ax ?? abs.x ?? n.x ?? 0);
  const ay = Number(n.ay ?? abs.y ?? n.y ?? 0);
  const w = Math.round(n.w ?? n.width ?? abs.width ?? 0);
  const h = Math.round(n.h ?? n.height ?? abs.height ?? 0);
  return { ax, ay, w, h };
}

function normalizeCommon(n, ax, ay, w, h) {
  const out = Object.assign({}, n);
  out.ax = ax; out.ay = ay; out.w = w; out.h = h;
  out.width = out.width ?? w; out.height = out.height ?? h;
  if (out.absoluteBoundingBox) delete out.absoluteBoundingBox;
  return out;
}

function mapNoRef(node, manifestMap, parentAbsX, parentAbsY, isRoot=false) {
  const { ax, ay, w, h } = getAbsAndSize(node);
  const mapped = normalizeCommon(node, ax, ay, w, h);
  if (isRoot || (parentAbsX == null && parentAbsY == null)) {
    mapped.x = 0; mapped.y = 0;
  } else {
    mapped.x = Math.round(ax - (parentAbsX || 0));
    mapped.y = Math.round(ay - (parentAbsY || 0));
  }
  mapped.children = Array.isArray(node.children) ? node.children.map(c => mapNoRef(c, manifestMap, ax, ay)) : [];
  return mapped;
}

function findNodeById(arr, id) {
  for (const n of arr || []) {
    if (String(n.id) === String(id)) return n;
    if (n.children) {
      const f = findNodeById(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

const rect = findNodeById(roots, 'rect_mj8rny16');
console.log('Original rect:', rect ? { id: rect.id, x: rect.x, y: rect.y, ax: rect.ax, ay: rect.ay } : 'not found');
if (rect && rect.children) {
  console.log('Original children positions (first 2):');
  rect.children.slice(0,2).forEach(ch => console.log({ id: ch.id, x: ch.x, y: ch.y, ax: ch.ax, ay: ch.ay }));
}

// Normalize whole roots as publish route does for no-reference
const mappedRoots = roots.map(r => mapNoRef(r, {}, undefined, undefined, true));
const mappedRect = findNodeById(mappedRoots, 'rect_mj8rny16');
console.log('\nMapped rect:', mappedRect ? { id: mappedRect.id, x: mappedRect.x, y: mappedRect.y, ax: mappedRect.ax, ay: mappedRect.ay } : 'not found');
if (mappedRect && mappedRect.children) {
  console.log('Mapped children positions (first 2):');
  mappedRect.children.slice(0,2).forEach(ch => console.log({ id: ch.id, x: ch.x, y: ch.y, ax: ch.ax, ay: ch.ay }));
}

// Also show an example path: show root that contains rect and its ax/ay
function findParentOf(arr, id) {
  for (const n of arr || []) {
    if (n.children && n.children.some(c => String(c.id) === String(id))) return n;
    const deeper = findParentOf(n.children || [], id);
    if (deeper) return deeper;
  }
  return null;
}
const parent = findParentOf(roots, 'rect_mj8rny16');
console.log('\nFound parent (raw):', parent ? { id: parent.id, ax: parent.ax, ay: parent.ay, x: parent.x, y: parent.y } : 'none');

// process.exit(0);

// --- Simulate commit-side normalization (ensureAbsolutePositions + normalizePositions)
function ensureAbsolutePositions(nodes, parentAx = 0, parentAy = 0) {
  return nodes.map(n => {
    const copy = Object.assign({}, n);
    // Compute candidate absolute positions but do NOT overwrite stored ax/ay
    const candidateAx = copy.x != null ? Number(parentAx) + Number(copy.x) : (copy.ax != null ? Number(copy.ax) : parentAx);
    const candidateAy = copy.y != null ? Number(parentAy) + Number(copy.y) : (copy.ay != null ? Number(copy.ay) : parentAy);
    // Keep original ax/ay intact on the copy
    // Use candidateAx/candidateAy for child recursion
    if (Array.isArray(copy.children) && copy.children.length) {
      copy.children = ensureAbsolutePositions(copy.children, candidateAx, candidateAy);
    }
    return copy;
  });
}

function normalizePositions(nodes, parentX = 0, parentY = 0, isRoot = true) {
  return nodes.map(node => {
    const normalized = Object.assign({}, node);
    const absX = Number(node.ax ?? node.absoluteBoundingBox?.x ?? node.x ?? 0);
    const absY = Number(node.ay ?? node.absoluteBoundingBox?.y ?? node.y ?? 0);
    if (isRoot) {
      normalized.x = 0; normalized.y = 0;
    } else {
      normalized.x = Math.round(absX - parentX);
      normalized.y = Math.round(absY - parentY);
    }
    if (Array.isArray(normalized.children) && normalized.children.length) {
      normalized.children = normalizePositions(normalized.children, absX, absY, false);
    }
    return normalized;
  });
}

const absFixed = ensureAbsolutePositions(roots);

// Per-root normalization: set root.x/y = 0 and compute each child's x/y relative to its immediate parent
function normalizeRootAndChildren(root) {
  const copy = Object.assign({}, root);
  const rootAx = Number(root.ax ?? root.x ?? 0);
  const rootAy = Number(root.ay ?? root.y ?? 0);
  copy.x = 0;
  copy.y = 0;

  function normChildren(node, parentAx, parentAy) {
    if (!node.children || !Array.isArray(node.children)) return;
    node.children = node.children.map((c) => {
      const child = Object.assign({}, c);
      const absX = Number(child.ax ?? child.x ?? 0);
      const absY = Number(child.ay ?? child.y ?? 0);
      // If the child is a FRAME, treat it as its own origin: set local x/y = 0
      if (child.type === 'FRAME') {
        child.x = 0;
        child.y = 0;
      } else {
        // compute and set local x/y relative to parent; do not modify ax/ay
        child.x = Math.round(absX - parentAx);
        child.y = Math.round(absY - parentAy);
      }
      if (child.children && Array.isArray(child.children)) {
        normChildren(child, absX, absY);
      }
      return child;
    });
  }

  normChildren(copy, rootAx, rootAy);
  copy.w = copy.w ?? copy.width;
  copy.h = copy.h ?? copy.height;
  return copy;
}

const normalizedRootsPerRoot = absFixed.map(r => normalizeRootAndChildren(r));
const simRect = findNodeById(normalizedRootsPerRoot, 'rect_mj8rny16');
console.log('\nSimulated commit-normalized rect (per-root):', simRect ? { id: simRect.id, x: simRect.x, y: simRect.y, ax: simRect.ax, ay: simRect.ay } : 'not found');
if (simRect && simRect.children) {
  console.log('Simulated normalized children (first 2, per-root):');
  simRect.children.slice(0,2).forEach(ch => console.log({ id: ch.id, x: ch.x, y: ch.y, ax: ch.ax, ay: ch.ay }));
}

// --- Simulate stripLargeData and JSON serialization as commit does
function stripLargeData(nodes) {
  return nodes.map(node => {
    const stripped = Object.assign({}, node);
    if (stripped.dataSource && stripped.dataSource.lastResponse) {
      stripped.dataSource = Object.assign({}, stripped.dataSource);
      delete stripped.dataSource.lastResponse;
    }
    if (stripped.children && Array.isArray(stripped.children)) {
      stripped.children = stripLargeData(stripped.children);
    }
    return stripped;
  });
}

try {
  const toSend = stripLargeData(normalizedRootsPerRoot);
  const s = JSON.stringify({ rawRoots: toSend });
  console.log('\nSerialization OK, bytes:', Buffer.byteLength(s, 'utf8'));
} catch (e) {
  console.error('\nSerialization failed:', e && e.message ? e.message : e);
}
