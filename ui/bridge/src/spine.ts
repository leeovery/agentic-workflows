// The historical spine — a pure function of (git log, manifest): for each
// first-parent commit touching .workflows/**, diff the manifest state against
// the previous such commit and emit durable events (specs/EVENTS.md). The
// watcher emits the same function's live increments, so a restart rebuilds an
// identical spine by construction. Net-effect semantics: merges/squashes
// attribute the branch's net evolution to one commit — stated, accepted.
import crypto from 'node:crypto';
import { deriveEvents, type RawEvent, eventId } from './derive.js';
import { git, lsWorkflowsTree, snapshotCommit, type Snapshot } from './snapshot.js';
import type { EngineAdapter } from './engine.js';

export type SpineCommit = { sha: string; ts: string; subject: string };

export function listSpineCommits(projectRoot: string): SpineCommit[] {
  let out: string;
  try {
    out = git(projectRoot, ['log', '--first-parent', '--reverse', '--format=%H%x00%aI%x00%s', '--', '.workflows']);
  } catch {
    return [];
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, ts, subject] = l.split('\0');
      return { sha: sha!, ts: ts!, subject: subject ?? '' };
    });
}

/** Attach engine-derived views (spec-blocked / dep-blocked) to epic units. */
export async function attachDerived(snap: Snapshot, engine: EngineAdapter): Promise<void> {
  for (const unit of Object.values(snap.units)) {
    if (unit.manifest?.work_type !== 'epic') continue;
    try {
      const detail = (await engine.epicDetailFor(unit.manifest)) as any;
      const specBlocked = (detail?.spec_blocked ?? []).map((r: any) => ({ name: r.name, by: r.by ?? [] }));
      const depBlocked = (detail?.phases?.planning ?? [])
        .filter((i: any) => Array.isArray(i.deps_blocking) && i.deps_blocking.length > 0)
        .map((i: any) => ({
          name: i.name,
          holders: i.deps_blocking.map((d: any) => d.topic ?? String(d)),
        }));
      unit.derived = { specBlocked, depBlocked };
    } catch {
      // An engine derivation failure degrades to no derived events for this
      // unit — never a bridge-side re-derivation (EVENTS.md).
    }
  }
}

export type SpineResult = {
  events: RawEvent[];
  epoch: string;
  tip: string | null;
  root: string | null;
  lastTree: Record<string, string>;
  lastSnapshot: Snapshot;
};

/**
 * Build the full durable stream from history. Events are emitted without seq
 * (the store assigns persistent sequence numbers) and stamped with the epoch
 * computed from the finished stream.
 */
export async function buildSpine(projectRoot: string, project: string, engine?: EngineAdapter): Promise<SpineResult> {
  const commits = listSpineCommits(projectRoot);
  const events: RawEvent[] = [];
  let prevTree: Record<string, string> = {};
  let prevSnap: Snapshot = { registry: null, units: {}, artifacts: {}, triage: {}, inbox: {} };

  for (const c of commits) {
    const tree = lsWorkflowsTree(projectRoot, c.sha);
    const snap = snapshotCommit(projectRoot, tree, { tree: prevTree, snap: prevSnap });
    if (engine) await attachDerived(snap, engine);

    const ctx = { project, epoch: '', ts: c.ts, disc: c.sha };
    events.push(...deriveEvents(prevSnap, snap, ctx));

    // commit.landed — every first-parent commit touching .workflows/**.
    const scope = commitScope(prevTree, tree);
    events.push({
      id: eventId('commit.landed', {}, c.sha),
      epoch: '',
      ts: c.ts,
      project,
      type: 'commit.landed',
      address: {},
      payload: { sha: c.sha, subject: c.subject, scope },
    });

    prevTree = tree;
    prevSnap = snap;
  }

  const root = commits.length > 0 ? commits[0]!.sha : null;
  const tip = commits.length > 0 ? commits[commits.length - 1]!.sha : null;
  const epoch = computeEpoch(root, tip, events);
  for (const e of events) e.epoch = epoch;
  return { events, epoch, tip, root, lastTree: prevTree, lastSnapshot: prevSnap };
}

/** epoch = sha256(rootCommitSha, spineTipSha, spineContentHash) — spec 3. */
export function computeEpoch(root: string | null, tip: string | null, events: RawEvent[]): string {
  const content = crypto
    .createHash('sha256')
    .update(events.map((e) => e.id).join('\n'))
    .digest('hex');
  return crypto
    .createHash('sha256')
    .update(`${root ?? ''}\n${tip ?? ''}\n${content}`)
    .digest('hex')
    .slice(0, 32);
}

function commitScope(prevTree: Record<string, string>, tree: Record<string, string>): string[] {
  const touched = new Set<string>();
  const all = new Set([...Object.keys(prevTree), ...Object.keys(tree)]);
  for (const p of all) {
    if (prevTree[p] === tree[p]) continue;
    const head = p.split('/')[0]!;
    if (!head.startsWith('.')) touched.add(head);
  }
  return [...touched].sort();
}
