// Version handshake + migration posture — phase-0 §4. The bridge NEVER runs
// migrations; outside the supported range, or on a repo with pending
// migrations, it degrades to read-only raw-embed mode with a banner. Until the
// proposed read-only currency verb lands (UPSTREAM.md #2), version comes from
// the install's git tag and pending-migrations from diffing
// .workflows/.state/migrations against the migrations directory — fragile,
// flagged as such, replaced when the verb ships.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Supported product range for this bridge build (prototype: the minor it was
// developed against).
export const SUPPORTED_RANGE = { min: [0, 7, 0] as const, maxExclusive: [0, 8, 0] as const };

export type Handshake = {
  productVersion: string | null; // e.g. "v0.7.13"
  versionSource: 'git-tag' | 'unknown';
  supported: boolean;
  pendingMigrations: string[];
  migrationsLogFound: boolean;
  shallow: boolean;
  mode: 'full' | 'read-only' | 'live-only';
  bannerReasons: string[];
};

function parseVersion(tag: string): [number, number, number] | null {
  const m = tag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! - b[i]!;
  }
  return 0;
}

export function readProductVersion(enginePath: string): { version: string | null; source: 'git-tag' | 'unknown' } {
  // The engine lives inside the installed product; describe its containing repo.
  try {
    const out = execFileSync('git', ['-C', enginePath, 'describe', '--tags', '--abbrev=0'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return { version: out, source: 'git-tag' };
  } catch {
    // Not a git checkout (e.g. a copied install) — no version signal yet.
  }
  return { version: null, source: 'unknown' };
}

export function pendingMigrations(projectRoot: string, enginePath: string): { pending: string[]; logFound: boolean } {
  // Migration scripts ship next to the engine in the installed product.
  const migrationsDir = path.resolve(enginePath, '..', '..', 'workflow-migrate', 'scripts', 'migrations');
  let available: string[] = [];
  try {
    available = fs
      .readdirSync(migrationsDir)
      .map((f) => f.match(/^(\d+)/)?.[1])
      .filter((id): id is string => Boolean(id));
  } catch {
    return { pending: [], logFound: false };
  }
  const logPath = path.join(projectRoot, '.workflows', '.state', 'migrations');
  let recorded = new Set<string>();
  let logFound = false;
  try {
    recorded = new Set(
      fs
        .readFileSync(logPath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );
    logFound = true;
  } catch {
    // No log: a pre-migration repo iff it has workflow state at all.
    if (!fs.existsSync(path.join(projectRoot, '.workflows'))) {
      return { pending: [], logFound: false };
    }
  }
  const pending = [...new Set(available)].filter((id) => !recorded.has(id)).sort();
  return { pending, logFound };
}

/**
 * Shallow, grafted, or partial clones break manifest@C-parent at the history
 * boundary (EVENTS.md) — all three degrade to live-only mode.
 */
export function isShallow(projectRoot: string): boolean {
  const git = (args: string[]): string => {
    try {
      return execFileSync('git', ['-C', projectRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return '';
    }
  };
  if (git(['rev-parse', '--is-shallow-repository']) === 'true') return true;
  // Grafted history: legacy grafts file or replace refs.
  const gitDir = git(['rev-parse', '--git-dir']);
  if (gitDir && fs.existsSync(path.join(path.resolve(projectRoot, gitDir), 'info', 'grafts'))) return true;
  if (git(['replace', '--format=%(refname)', '-l']) !== '') return true;
  // Partial clone: a promisor filter on any remote.
  if (git(['config', '--get-regexp', String.raw`remote\..*\.partialclonefilter`]) !== '') return true;
  return false;
}

export function handshake(projectRoot: string, enginePath: string): Handshake {
  const { version, source } = readProductVersion(enginePath);
  const parsed = version ? parseVersion(version) : null;
  const supported =
    parsed !== null && cmp(parsed, SUPPORTED_RANGE.min) >= 0 && cmp(parsed, SUPPORTED_RANGE.maxExclusive) < 0;
  const { pending, logFound } = pendingMigrations(projectRoot, enginePath);
  const shallow = isShallow(projectRoot);

  const bannerReasons: string[] = [];
  if (!supported) {
    bannerReasons.push(
      version
        ? `product version ${version} outside supported range`
        : 'product version unknown (no git tag found at the engine install)',
    );
  }
  if (pending.length > 0) {
    bannerReasons.push(`${pending.length} pending migration(s) — run /workflow-start in a session to migrate`);
  }
  if (shallow) bannerReasons.push('shallow clone — history incomplete, durable spine unavailable');

  let mode: Handshake['mode'] = 'full';
  if (!supported || pending.length > 0) mode = 'read-only';
  else if (shallow) mode = 'live-only';

  return {
    productVersion: version,
    versionSource: source,
    supported,
    pendingMigrations: pending,
    migrationsLogFound: logFound,
    shallow,
    mode,
    bannerReasons,
  };
}
