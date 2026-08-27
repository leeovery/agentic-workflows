// The attention coordinator — the runtime that binds the pure policy
// (attention.ts), the durable notifier (notifier.ts), escalation
// (escalation.ts), the lane extractor (lanes.ts), and the digest builder
// (digest.ts) to live bridge state. Owns: gate-open → ceremony → notify;
// report-landing → lane ceremony; the escalation clock; the morning roll-up;
// the lobby digest strip; the bridge watchdog heartbeat.
import path from 'node:path';
import fs from 'node:fs';
import type { Db } from './db.js';
import type { SessionManager } from './sessions.js';
import type { EventStore } from './store.js';
import type { EngineAdapter } from './engine.js';
import { snapshotTree } from './snapshot.js';
import { attachDerived } from './spine.js';
import { durableRows } from './durable.js';
import { buildQueue, type QueueRow } from './queue.js';
import { readReportLanes } from './lanes.js';
import { findingCeremony, gateCeremony, type ActivityContext } from './attention.js';
import { Notifier, type NotifierConfig, type Delivered } from './notifier.js';
import { EscalationTracker } from './escalation.js';
import { buildDigest, lobbyStrip, type Digest } from './digest.js';
import { logger } from './log.js';
import crypto from 'node:crypto';

export type ActivitySignal = {
  appConnected: boolean;
  focusedThread: string | null; // "wu/topic" the human is looking at
  lastInteractionAt: number;
};

export class AttentionCoordinator {
  private notifier: Notifier;
  private escalation: EscalationTracker;
  private activity: ActivitySignal = { appConnected: false, focusedThread: null, lastInteractionAt: 0 };
  private leftRowAt = new Map<string, number>();
  private digests = new Map<string, Digest>();
  private lastMorningRollupDay = '';
  private timer: NodeJS.Timeout | null = null;
  private seenReports = new Map<string, string>(); // report path → last content hash

  constructor(
    private db: Db,
    readonly project: string,
    private deps: {
      projectRoot: string;
      store: EventStore;
      sessions: SessionManager | null;
      engine: EngineAdapter | null;
      config: NotifierConfig & { escalationMinutes: number; graceMinutes: number; morningHour: number };
    },
    deliver: (d: Delivered) => void,
  ) {
    this.notifier = new Notifier(db, project, deps.config, deliver);
    this.escalation = new EscalationTracker(deps.config.escalationMinutes * 60_000, deps.config.graceMinutes * 60_000);
    if (deps.sessions) {
      deps.sessions.on('gate', (ev: any) => this.onGate(ev));
    }
  }

  markActivity(sig: Partial<ActivitySignal>): void {
    const now = Date.now();
    this.activity = { ...this.activity, ...sig, lastInteractionAt: now };
    this.escalation.markActive(now);
  }

  private activeContext(rowKeyThread: string | null): ActivityContext {
    const now = Date.now();
    const appConnected = this.activity.appConnected && now - this.activity.lastInteractionAt < 90_000;
    return {
      appConnected,
      engagedThread: appConnected && this.activity.focusedThread !== null && this.activity.focusedThread === rowKeyThread,
      inGrace: false,
      quietHours: this.notifier.inQuietHours(new Date(now)),
    };
  }

  private threadKey(a: { workUnit?: string; topic?: string }): string | null {
    return a.workUnit ? `${a.workUnit}/${a.topic ?? a.workUnit}` : null;
  }

  /** A gate opened / resolved — drive ceremony. */
  private onGate(ev: { type: string; card?: any; bridgeSessionId?: string }): void {
    if (ev.type === 'gate.opened' && ev.card) {
      const card = ev.card;
      this.escalation.observeOpen(card.id, Date.parse(card.openedAt) || Date.now());
      const ctx = this.activeContext(this.threadKey(card.address));
      const blocksWithNothingElse = this.sessionHasOnlyThisPending(ev.bridgeSessionId, card.id);
      const ceremony = gateCeremony(card.kind, card.gateType, card.confirm, {
        ...ctx,
        escalated: this.escalation.isEscalated(card.id),
        blocksWithNothingElse,
      });
      const wu = card.address.workUnit ?? 'lobby';
      this.notifier.notify(
        { rowKey: `${wu}:${card.id}`, ceremony, contentHash: card.id },
        card.question ?? 'A gate is waiting on you',
        new Date(),
      );
    } else if (ev.type === 'gate.resolved' || ev.type === 'gate.answered') {
      // resolution carries gateId, not a card
    }
  }

  private sessionHasOnlyThisPending(bridgeSessionId: string | undefined, gateId: string): boolean {
    if (!this.deps.sessions || !bridgeSessionId) return true;
    const s = this.deps.sessions.get(bridgeSessionId);
    return !!s && s.openGate?.id === gateId;
  }

  /** Report-landing: scan cache for background-agent reports and apply lane ceremony. */
  scanReports(): void {
    const cacheRoot = path.join(this.deps.projectRoot, '.workflows', '.cache');
    for (const report of this.findReports(cacheRoot)) {
      const lanes = readReportLanes(report.path);
      if (!lanes.present) continue;
      const hash = crypto.createHash('sha256').update(JSON.stringify(lanes.counts)).digest('hex').slice(0, 12);
      if (this.seenReports.get(report.path) === hash) continue;
      this.seenReports.set(report.path, hash);
      const ctx = this.activeContext(`${report.wu}/${report.topic}`);
      const ceremony = findingCeremony(lanes, ctx);
      this.notifier.notify(
        { rowKey: `${report.wu}:report:${report.topic}`, ceremony, contentHash: hash },
        `Background review returned findings in ${report.topic}`,
        new Date(),
      );
    }
  }

  private findReports(cacheRoot: string): { path: string; wu: string; topic: string }[] {
    const out: { path: string; wu: string; topic: string }[] = [];
    for (const wu of safeReaddir(cacheRoot)) {
      for (const phase of safeReaddir(path.join(cacheRoot, wu))) {
        for (const topic of safeReaddir(path.join(cacheRoot, wu, phase))) {
          const dir = path.join(cacheRoot, wu, phase, topic);
          for (const f of safeReaddir(dir)) {
            if (f.endsWith('.md') && /review|report|analysis|deep-dive/.test(f)) {
              out.push({ path: path.join(dir, f), wu, topic });
            }
          }
        }
      }
    }
    return out;
  }

  /** The escalation clock + report scan + morning roll-up, on a timer. */
  start(): void {
    this.timer = setInterval(() => this.tick(), 30_000);
    this.timer.unref?.();
  }

  tick(now = Date.now()): void {
    this.scanReports();
    // Escalation: open gates idle past T_esc push regardless of kind.
    if (this.deps.sessions) {
      for (const gid of this.escalation.dueForEscalation(now, this.leftRowAt)) {
        this.escalation.markEscalated(gid, now);
        const s = this.deps.sessions.list().find((x) => x.openGate?.id === gid);
        if (s?.openGate) {
          const wu = s.openGate.address.workUnit ?? 'lobby';
          this.notifier.notify(
            { rowKey: `${wu}:${gid}`, ceremony: this.activeContext(null).quietHours ? 'digest' : 'push', contentHash: `esc:${gid}`, escalated: true },
            `A session has been waiting ${this.deps.config.escalationMinutes}m: ${s.openGate.question ?? ''}`,
            new Date(now),
          );
        }
      }
    }
    // Morning roll-up: once per day at the configured hour, drain accrued.
    const d = new Date(now);
    const dayKey = d.toISOString().slice(0, 10);
    if (d.getHours() >= this.deps.config.morningHour && this.lastMorningRollupDay !== dayKey) {
      this.lastMorningRollupDay = dayKey;
      this.notifier.drainAccrued(d, 'waiting');
    }
    this.rebuildDigests(now);
  }

  private rebuildDigests(now: number): void {
    const snap = snapshotTree(this.deps.projectRoot);
    const queue = buildQueue(durableRows(snap, this.deps.projectRoot), this.deps.sessions, this.deps.store);
    const since = new Date(now - 24 * 3600_000).toISOString();
    const events = this.deps.store.readFrom(0);
    for (const wu of Object.keys(snap.units)) {
      this.digests.set(
        wu,
        buildDigest(wu, events, queue as QueueRow[], null, since, new Date(now).toISOString()),
      );
    }
  }

  lobbyStrip(): Omit<Digest, 'waiting'>[] {
    return lobbyStrip([...this.digests.values()]);
  }

  /** A gate closed — stop its escalation clock. */
  onGateClosed(gateId: string): void {
    this.escalation.observeClosed(gateId);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
  } catch {
    return [];
  }
}

export type { Delivered };
export { logger as attentionLogger };
