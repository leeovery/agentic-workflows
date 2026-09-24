// Project snapshots — the input to event derivation. A snapshot can be built
// from the working tree (live layer) or from a git commit (durable layer, via
// git plumbing). The derivation (derive.ts) is a pure diff of two snapshots.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export type Manifest = Record<string, any>;

export type DerivedViews = {
  // From the engine's epicDetail join — never re-derived by the bridge.
  specBlocked: { name: string; by: string[] }[];
  depBlocked: { name: string; holders: string[] }[];
};

export type UnitSnap = {
  manifest: Manifest;
  derived?: DerivedViews;
};

export type Snapshot = {
  registry: Manifest | null; // .workflows/manifest.json
  units: Record<string, UnitSnap>;
  // .workflows-relative artifact path → content hash (git blob sha for
  // commit snapshots, sha256 for tree snapshots — layers never compare).
  artifacts: Record<string, string>;
  // "{wu}/{phase}/{topic}" → queue file count; keys also exist (count from
  // files, possibly 0) for `status: triaged` manifest stubs — both named
  // sources of triage.changed.
  triage: Record<string, number>;
  inbox: Record<string, number>; // type → live item count (never .archived)
};

const INBOX_TYPES = ['ideas', 'bugs', 'quickfixes'];

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function isArtifactPath(rel: string): boolean {
  // Judgment-written workflow artifacts: markdown under .workflows/, excluding
  // machine state and the inbox (inbox has its own event).
  if (!rel.endsWith('.md')) return false;
  const [head] = rel.split('/');
  if (head === '.inbox' || head === '.state' || head === '.cache' || head === '.knowledge') return false;
  return true;
}

function triageKeyFromPath(rel: string): string | null {
  // {wu}/{phase}/.triage/{topic}/{file}
  const parts = rel.split('/');
  const i = parts.indexOf('.triage');
  if (i === 2 && parts.length >= 5) return `${parts[0]}/${parts[1]}/${parts[3]}`;
  return null;
}

function collectTriageStubs(units: Record<string, UnitSnap>, triage: Record<string, number>): void {
  for (const [name, u] of Object.entries(units)) {
    const phases = u.manifest?.phases ?? {};
    for (const [phase, data] of Object.entries<any>(phases)) {
      const items = data?.items ?? {};
      for (const [topic, item] of Object.entries<any>(items)) {
        if (item?.status === 'triaged') {
          const key = `${name}/${phase}/${topic}`;
          if (!(key in triage)) triage[key] = 0;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Working-tree snapshot (live layer)
// ---------------------------------------------------------------------------

export function snapshotTree(projectRoot: string): Snapshot {
  const wf = path.join(projectRoot, '.workflows');
  const snap: Snapshot = { registry: null, units: {}, artifacts: {}, triage: {}, inbox: {} };
  if (!fs.existsSync(wf)) return snap;

  snap.registry = readJson(path.join(wf, 'manifest.json'));

  for (const entry of fs.readdirSync(wf, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('.')) continue;
    const m = readJson(path.join(wf, name, 'manifest.json'));
    if (m) snap.units[name] = { manifest: m };
  }

  for (const rel of walkFiles(wf)) {
    if (rel.startsWith('.cache/') || rel.startsWith('.knowledge/')) continue;
    if (isArtifactPath(rel)) {
      snap.artifacts[rel] = sha256(fs.readFileSync(path.join(wf, rel), 'utf8'));
    }
    const tk = triageKeyFromPath(rel);
    if (tk) snap.triage[tk] = (snap.triage[tk] ?? 0) + 1;
    const ip = rel.match(/^\.inbox\/([^/]+)\/[^/]+$/);
    if (ip && INBOX_TYPES.includes(ip[1]!)) snap.inbox[ip[1]!] = (snap.inbox[ip[1]!] ?? 0) + 1;
  }
  collectTriageStubs(snap.units, snap.triage);
  return snap;
}

// ---------------------------------------------------------------------------
// Commit snapshot (durable layer) — git plumbing, no checkout.
// ---------------------------------------------------------------------------

export function git(projectRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', projectRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** `.workflows`-relative path → blob sha at a commit. */
export function lsWorkflowsTree(projectRoot: string, sha: string): Record<string, string> {
  let out: string;
  try {
    out = git(projectRoot, ['ls-tree', '-r', '-z', sha, '--', '.workflows']);
  } catch {
    return {};
  }
  const map: Record<string, string> = {};
  for (const rec of out.split('\0')) {
    if (!rec) continue;
    // "<mode> blob <sha>\t<path>"
    const tab = rec.indexOf('\t');
    if (tab < 0) continue;
    const meta = rec.slice(0, tab).split(/\s+/);
    const p = rec.slice(tab + 1);
    if (meta[1] !== 'blob') continue;
    map[p.replace(/^\.workflows\//, '')] = meta[2]!;
  }
  return map;
}

export function showBlob(projectRoot: string, blobSha: string): string {
  return git(projectRoot, ['cat-file', 'blob', blobSha]);
}

/**
 * Build a commit snapshot from a tree listing, reusing parsed manifests from a
 * previous snapshot when the blob is unchanged (the spine walks sequentially).
 */
export function snapshotCommit(
  projectRoot: string,
  tree: Record<string, string>,
  prev?: { tree: Record<string, string>; snap: Snapshot },
): Snapshot {
  const snap: Snapshot = { registry: null, units: {}, artifacts: {}, triage: {}, inbox: {} };

  const readManifestBlob = (rel: string): Manifest | null => {
    const blob = tree[rel];
    if (!blob) return null;
    try {
      return JSON.parse(showBlob(projectRoot, blob));
    } catch {
      return null;
    }
  };

  if (prev && tree['manifest.json'] && prev.tree['manifest.json'] === tree['manifest.json']) {
    snap.registry = prev.snap.registry;
  } else {
    snap.registry = readManifestBlob('manifest.json');
  }

  for (const rel of Object.keys(tree)) {
    const m = rel.match(/^([^./][^/]*)\/manifest\.json$/);
    if (m) {
      const name = m[1]!;
      if (prev && prev.tree[rel] === tree[rel] && prev.snap.units[name]) {
        snap.units[name] = { manifest: prev.snap.units[name]!.manifest };
      } else {
        const parsed = readManifestBlob(rel);
        if (parsed) snap.units[name] = { manifest: parsed };
      }
      continue;
    }
    if (isArtifactPath(rel)) snap.artifacts[rel] = tree[rel]!;
    const tk = triageKeyFromPath(rel);
    if (tk) snap.triage[tk] = (snap.triage[tk] ?? 0) + 1;
    const ip = rel.match(/^\.inbox\/([^/]+)\/[^/]+$/);
    if (ip && INBOX_TYPES.includes(ip[1]!)) snap.inbox[ip[1]!] = (snap.inbox[ip[1]!] ?? 0) + 1;
  }
  collectTriageStubs(snap.units, snap.triage);
  return snap;
}

function readJson(p: string): Manifest | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function* walkFiles(root: string, rel = ''): Generator<string> {
  const dir = path.join(root, rel);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* walkFiles(root, r);
    else if (e.isFile()) yield r;
  }
}
