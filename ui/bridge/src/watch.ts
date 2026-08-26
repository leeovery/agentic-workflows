// The watcher — phase-0 §3. chokidar on .workflows/** plus git HEAD polling.
// Between commits, debounced snapshot diffs emit the live layer (live: true,
// bridge-local nonce discriminants). On HEAD movement, the spine function's
// increments emit the durable layer. Presence and the agent store are polled
// (live-layer only, by nature).
import chokidar, { type FSWatcher } from 'chokidar';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { deriveEvents, type RawEvent } from './derive.js';
import {
  git,
  lsWorkflowsTree,
  snapshotCommit,
  snapshotTree,
  type Snapshot,
} from './snapshot.js';
import { listSpineCommits, attachDerived, computeEpoch } from './spine.js';
import type { EngineAdapter } from './engine.js';
import { logger } from './log.js';

export type WatcherEvents = {
  durable: (events: RawEvent[]) => void;
  live: (events: RawEvent[]) => void;
  'epoch-change': (info: { epoch: string; reason: string }) => void;
};

const DEBOUNCE_MS = 400;
const HEAD_POLL_MS = 1500;
const PRESENCE_POLL_MS = 10_000;

export class Watcher extends EventEmitter {
  private fsWatcher: FSWatcher | null = null;
  private headTimer: NodeJS.Timeout | null = null;
  private presenceTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastHead: string | null = null;
  private lastCommitTree: Record<string, string> = {};
  private lastCommitSnap: Snapshot;
  private lastLiveSnap: Snapshot;
  private lastPresenceHash = '';
  private agentRows = new Map<string, string>(); // "wu/phase/topic/id" → status
  private closed = false;

  constructor(
    readonly projectRoot: string,
    readonly project: string,
    private epoch: string,
    seed: { tree: Record<string, string>; snap: Snapshot; head: string | null },
    private engine?: EngineAdapter,
  ) {
    super();
    this.lastCommitTree = seed.tree;
    this.lastCommitSnap = seed.snap;
    // The live baseline must be a TREE snapshot: commit snapshots hash
    // artifacts by git blob sha, tree snapshots by sha256 — the two never
    // compare. Dirt present at boot becomes baseline (the live layer is
    // reproduced approximately across restarts, per spec 3).
    this.lastLiveSnap = snapshotTree(projectRoot);
    this.lastHead = seed.head;
  }

  private readyPromise: Promise<void> | null = null;

  start(): void {
    const wf = path.join(this.projectRoot, '.workflows');
    this.fsWatcher = chokidar.watch(wf, {
      ignoreInitial: true,
      ignored: (p) => p.includes('/.knowledge/'),
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    this.fsWatcher.on('all', () => this.scheduleLiveDiff());
    this.readyPromise = new Promise((resolve) => this.fsWatcher!.once('ready', () => resolve()));
    // A change landing in the construct-to-ready gap is invisible to
    // chokidar — sweep once at readiness so it surfaces as a live diff.
    this.readyPromise.then(() => this.scheduleLiveDiff());
    this.headTimer = setInterval(() => this.pollHead().catch((e) => logger.error('head poll failed', { error: String(e) })), HEAD_POLL_MS);
    this.presenceTimer = setInterval(() => this.pollLiveState().catch(() => {}), PRESENCE_POLL_MS);
    logger.info('watcher started', { project: this.project });
  }

  private scheduleLiveDiff(): void {
    // Debounce on quiescence — engine commits land mid-transaction bursts.
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.liveDiff().catch((e) => logger.error('live diff failed', { error: String(e) }));
    }, DEBOUNCE_MS);
  }

  private async liveDiff(): Promise<void> {
    if (this.closed) return;
    const snap = snapshotTree(this.projectRoot);
    if (this.engine) await attachDerived(snap, this.engine);
    const ctx = {
      project: this.project,
      epoch: this.epoch,
      ts: new Date().toISOString(),
      disc: crypto.randomUUID(),
      live: true as const,
    };
    const events = deriveEvents(this.lastLiveSnap, snap, ctx);
    this.lastLiveSnap = snap;
    if (events.length > 0) this.emit('live', events);
  }

  private headSha(): string | null {
    try {
      return git(this.projectRoot, ['rev-parse', 'HEAD']).trim();
    } catch {
      return null;
    }
  }

  private async pollHead(): Promise<void> {
    if (this.closed) return;
    const head = this.headSha();
    if (!head || head === this.lastHead) return;

    const prevHead = this.lastHead;
    this.lastHead = head;

    let fastForward = false;
    if (prevHead) {
      try {
        git(this.projectRoot, ['merge-base', '--is-ancestor', prevHead, head]);
        fastForward = true;
      } catch {
        fastForward = false;
      }
    }

    if (!fastForward && prevHead) {
      // Non-fast-forward: rebase, force-move, branch switch, restore. Epoch
      // changes; a mass-disappearance diff is NOT interpreted as removals —
      // we re-baseline instead of diffing (spec 3).
      await this.rebaseline('non-fast-forward HEAD movement');
      return;
    }

    // Fast-forward: emit durable increments for each new spine commit.
    const commits = listSpineCommits(this.projectRoot);
    const startIdx = commits.findIndex((c) => c.sha === prevHead);
    const fresh = commits.filter((c, i) => {
      if (prevHead === null) return true;
      if (startIdx >= 0) return i > startIdx;
      // prevHead not itself a spine commit — take commits strictly after it.
      try {
        git(this.projectRoot, ['merge-base', '--is-ancestor', c.sha, prevHead]);
        return false;
      } catch {
        return true;
      }
    });
    for (const c of fresh) {
      const tree = lsWorkflowsTree(this.projectRoot, c.sha);
      const snap = snapshotCommit(this.projectRoot, tree, {
        tree: this.lastCommitTree,
        snap: this.lastCommitSnap,
      });
      if (this.engine) await attachDerived(snap, this.engine);
      const ctx = { project: this.project, epoch: this.epoch, ts: c.ts, disc: c.sha };
      const events = deriveEvents(this.lastCommitSnap, snap, ctx);
      const scope = new Set<string>();
      for (const p of new Set([...Object.keys(this.lastCommitTree), ...Object.keys(tree)])) {
        if (this.lastCommitTree[p] !== tree[p] && !p.split('/')[0]!.startsWith('.')) scope.add(p.split('/')[0]!);
      }
      events.push({
        id: crypto.createHash('sha256').update(`commit.landed\n//\n${c.sha}`).digest('hex').slice(0, 16),
        epoch: this.epoch,
        ts: c.ts,
        project: this.project,
        type: 'commit.landed',
        address: {},
        payload: { sha: c.sha, subject: c.subject, scope: [...scope].sort() },
      });
      this.lastCommitTree = tree;
      this.lastCommitSnap = snap;
      this.emit('durable', events);
      // Superseding: reset the live baseline to the post-commit tree so live
      // remnants don't re-emit (tree snapshot — hash spaces never mix).
      this.lastLiveSnap = snapshotTree(this.projectRoot);
    }
  }

  private async rebaseline(reason: string): Promise<void> {
    logger.warn('epoch change', { reason });
    const commits = listSpineCommits(this.projectRoot);
    const tip = commits.length ? commits[commits.length - 1]!.sha : null;
    let tree: Record<string, string> = {};
    let snap: Snapshot = { registry: null, units: {}, artifacts: {}, triage: {}, inbox: {} };
    if (tip) {
      tree = lsWorkflowsTree(this.projectRoot, tip);
      snap = snapshotCommit(this.projectRoot, tree);
      if (this.engine) await attachDerived(snap, this.engine);
    }
    this.lastCommitTree = tree;
    this.lastCommitSnap = snap;
    this.lastLiveSnap = snapshotTree(this.projectRoot);
    // The owner (bridge) rebuilds the spine and computes the new epoch; we
    // signal with a placeholder so the bridge can do the authoritative rebuild.
    this.emit('epoch-change', { epoch: '', reason });
  }

  setEpoch(epoch: string): void {
    this.epoch = epoch;
  }

  ready(): Promise<void> {
    return this.readyPromise ?? Promise.resolve();
  }

  /** Presence + agent-store polling — live-layer only, by nature. */
  private async pollLiveState(): Promise<void> {
    if (this.closed) return;
    const ts = new Date().toISOString();
    // Presence via the engine's own scanPresence.
    if (this.engine) {
      for (const unit of Object.keys(this.lastLiveSnap.units)) {
        try {
          const rows = (await this.engine.scanPresence(unit)) as unknown[];
          const hash = crypto.createHash('sha256').update(JSON.stringify(rows ?? [])).digest('hex').slice(0, 12);
          const key = `${unit}:${hash}`;
          if ((rows?.length ?? 0) > 0 && this.lastPresenceHash !== key) {
            this.lastPresenceHash = key;
            this.emit('live', [
              {
                id: crypto.createHash('sha256').update(`presence.changed\n${unit}//\n${hash}`).digest('hex').slice(0, 16),
                epoch: this.epoch,
                live: true as const,
                ts,
                project: this.project,
                type: 'presence.changed',
                address: { workUnit: unit },
                payload: { rows },
              },
            ]);
          }
        } catch {
          // presence is research/discussion only; other phases throw — fine.
        }
      }
    }
    // Agent store rows: .workflows/.cache/{wu}/{phase}/{topic}/state.json.
    const events: RawEvent[] = [];
    const cacheRoot = path.join(this.projectRoot, '.workflows', '.cache');
    for (const row of scanAgentRows(cacheRoot)) {
      const prev = this.agentRows.get(row.key);
      if (prev === row.status) continue;
      this.agentRows.set(row.key, row.status);
      const type = row.status === 'in-flight' ? 'agent.dispatched' : prev === 'in-flight' ? 'agent.returned' : null;
      if (!type) continue;
      events.push({
        id: crypto.createHash('sha256').update(`${type}\n${row.address.workUnit}/${row.address.topic}/${row.address.phase}\n${row.id}+${row.status}`).digest('hex').slice(0, 16),
        epoch: this.epoch,
        live: true as const,
        ts,
        project: this.project,
        type,
        address: row.address,
        payload: { agentType: row.agentType, id: row.id },
      });
    }
    if (events.length > 0) this.emit('live', events);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.headTimer) clearInterval(this.headTimer);
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    await this.fsWatcher?.close();
  }
}

function scanAgentRows(cacheRoot: string): {
  key: string;
  id: string;
  agentType: string;
  status: string;
  address: { workUnit: string; topic: string; phase: string };
}[] {
  const rows: ReturnType<typeof scanAgentRows> = [];
  let units: string[];
  try {
    units = fs.readdirSync(cacheRoot).filter((n) => !n.startsWith('.'));
  } catch {
    return rows;
  }
  for (const wu of units) {
    let phases: string[] = [];
    try {
      phases = fs.readdirSync(path.join(cacheRoot, wu)).filter((n) => !n.startsWith('.'));
    } catch {
      continue;
    }
    for (const phase of phases) {
      let topics: string[] = [];
      try {
        topics = fs.readdirSync(path.join(cacheRoot, wu, phase)).filter((n) => !n.startsWith('.'));
      } catch {
        continue;
      }
      for (const topic of topics) {
        const statePath = path.join(cacheRoot, wu, phase, topic, 'state.json');
        let state: any;
        try {
          state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        } catch {
          continue;
        }
        const agents = state?.agents ?? state?.rows ?? {};
        for (const [id, row] of Object.entries<any>(agents)) {
          rows.push({
            key: `${wu}/${phase}/${topic}/${id}`,
            id,
            agentType: row?.kind ?? row?.type ?? 'unknown',
            status: row?.status ?? 'unknown',
            address: { workUnit: wu, topic, phase },
          });
        }
      }
    }
  }
  return rows;
}
