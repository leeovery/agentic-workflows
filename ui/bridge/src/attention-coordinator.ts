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
      deps.sessions.on('gate', (ev: any) => {
        if ((ev.type === 'gate.resolved' || ev.type === 'gate.answered') && ev.gateId) {
          this.escalation.observeClosed(ev.gateId);
        }
        this.onGate(ev);
      });
    }
  }

  /**
   * Activity from the SPA. A `heartbeat` keeps `appConnected` fresh but does
   * NOT re-arm escalation (a backgrounded tab pinging every 60s must not
   * silence a genuinely-stuck gate — reviewers' compound finding). Only a real
   * `interaction` (click/keydown) re-arms escalation and records where the
   * human just was, for navigation grace.
   */
  markActivity(sig: Partial<ActivitySignal> & { interaction?: boolean }): void {
    const now = Date.now();
    const prevThread = this.activity.focusedThread;
    this.activity = {
      appConnected: sig.appConnected ?? this.activity.appConnected,
      focusedThread: sig.focusedThread !== undefined ? sig.focusedThread : this.activity.focusedThread,
      lastInteractionAt: now,
    };
    if (sig.interaction) {
      this.escalation.markActive(now);
      // Leaving a thread starts its navigation grace.
      if (prevThread && prevThread !== this.activity.focusedThread) {
        for (const s of this.deps.sessions?.list() ?? []) {
          if (s.openGate && this.threadKey(s.openGate.address) === prevThread) {
            this.leftRowAt.set(s.openGate.id, now);
          }
        }
      }
    }
  }

  private activeContext(rowKeyThread: string | null, now = Date.now()): ActivityContext {
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
        ctx.quietHours,
      );
    } else if (ev.type === 'gate.resolved' || ev.type === 'gate.answered') {
      // resolution carries gateId, not a card
    }
  }

  private sessionHasOnlyThisPending(bridgeSessionId: string | undefined, gateId: string): boolean {
    if (!this.deps.sessions) return true;
    // "blocking a session with nothing else pending for THAT HUMAN" — no OTHER
    // open gate anywhere, and no durable waiting rows (single-user: the
    // sentinel human owns everything).
    const otherOpenGate = this.deps.sessions
      .list()
      .some((s) => s.openGate && s.openGate.state === 'open' && s.openGate.id !== gateId);
    if (otherOpenGate) return false;
    void bridgeSessionId;
    return true;
  }

  /** Report-landing: scan cache for background-agent reports and apply lane ceremony. */
  scanReports(now = Date.now()): void {
    const cacheRoot = path.join(this.deps.projectRoot, '.workflows', '.cache');
    for (const report of this.findReports(cacheRoot)) {
      const lanes = readReportLanes(report.path);
      if (!lanes.present) continue;
      // Content hash includes the file identity so two distinct reports (a
      // different phase, or a re-review) with the same lane shape never
      // collide on the ledger and suppress each other.
      const hash = crypto
        .createHash('sha256')
        .update(`${report.path}\n${JSON.stringify(lanes.counts)}`)
        .digest('hex')
        .slice(0, 12);
      if (this.seenReports.get(report.path) === hash) continue;
      this.seenReports.set(report.path, hash);
      const ctx = this.activeContext(`${report.wu}/${report.topic}`, now);
      const ceremony = findingCeremony(lanes, ctx);
      // The rowKey carries the phase so cross-phase reports for one topic are
      // distinct queue rows and distinct pushes.
      this.notifier.notify(
        { rowKey: `${report.wu}:report:${report.phase}:${report.topic}`, ceremony, contentHash: hash },
        `Background review returned findings in ${report.topic}`,
        new Date(now),
        ctx.quietHours,
      );
    }
  }

  private findReports(cacheRoot: string): { path: string; wu: string; phase: string; topic: string }[] {
    const out: { path: string; wu: string; phase: string; topic: string }[] = [];
    const MAX_BYTES = 2 * 1024 * 1024; // don't read runaway report files
    for (const wu of safeReaddir(cacheRoot)) {
      for (const phase of safeReaddir(path.join(cacheRoot, wu))) {
        for (const topic of safeReaddir(path.join(cacheRoot, wu, phase))) {
          const dir = path.join(cacheRoot, wu, phase, topic);
          for (const f of safeReaddir(dir)) {
            if (!(f.endsWith('.md') && /review|report|analysis|deep-dive/.test(f))) continue;
            const p = path.join(dir, f);
            try {
              if (fs.statSync(p).size > MAX_BYTES) continue;
            } catch {
              continue;
            }
            out.push({ path: p, wu, phase, topic });
          }
        }
      }
    }
    // Evict seen entries whose file no longer exists (work unit closed).
    const live = new Set(out.map((r) => r.path));
    for (const key of this.seenReports.keys()) if (!live.has(key)) this.seenReports.delete(key);
    return out;
  }

  /** The escalation clock + report scan + morning roll-up, on a timer. */
  start(): void {
    this.timer = setInterval(() => this.tick(), 30_000);
    this.timer.unref?.();
  }

  tick(now = Date.now()): void {
    this.scanReports(now);
    const quiet = this.notifier.inQuietHours(new Date(now));
    // Escalation: open gates idle past T_esc push regardless of kind.
    if (this.deps.sessions) {
      for (const gid of this.escalation.dueForEscalation(now, this.leftRowAt)) {
        this.escalation.markEscalated(gid, now);
        const s = this.deps.sessions.list().find((x) => x.openGate?.id === gid);
        if (s?.openGate) {
          const wu = s.openGate.address.workUnit ?? 'lobby';
          this.notifier.notify(
            { rowKey: `${wu}:${gid}`, ceremony: 'push', contentHash: `esc:${gid}`, escalated: true },
            `A session has been waiting ${this.deps.config.escalationMinutes}m: ${s.openGate.question ?? ''}`,
            new Date(now),
            quiet,
          );
        }
      }
    }
    // The morning roll-up: once per LOCAL day at the configured hour, drain
    // accrued (the overnight case). Local date — a UTC dayKey with a local
    // hour double-fired outside UTC (reviewers' finding).
    const d = new Date(now);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (d.getHours() >= this.deps.config.morningHour && this.lastMorningRollupDay !== dayKey) {
      this.lastMorningRollupDay = dayKey;
      this.notifier.drainAccrued(d, 'waiting');
    }
    // The intraday T_roll roll-up: outside quiet hours, fire accrued bursts
    // once they age past T_roll (so a collapsed escalation doesn't wait for
    // morning).
    this.notifier.maybeRollup(d, quiet);
    this.rebuildDigests(now);
  }

  private async rebuildDigests(now: number): Promise<void> {
    const snap = snapshotTree(this.deps.projectRoot);
    const queue = buildQueue(
      durableRows(snap, this.deps.projectRoot),
      this.deps.sessions,
      this.deps.store,
      this.buildOrders(snap),
      (gateId) => this.escalation.isEscalated(gateId),
    );
    const since = new Date(now - 24 * 3600_000).toISOString();
    const events = this.deps.store.readFrom(0);
    for (const [wu, unit] of Object.entries(snap.units)) {
      const next = await this.nextRender(wu, (unit.manifest as any)?.work_type ?? 'feature');
      this.digests.set(wu, buildDigest(wu, events, queue as QueueRow[], next, since, new Date(now).toISOString()));
    }
  }

  private buildOrders(snap: ReturnType<typeof snapshotTree>): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const [name, unit] of Object.entries(snap.units)) {
      const items = (unit.manifest as any)?.phases?.specification?.items ?? {};
      for (const [topic, item] of Object.entries<any>(items)) {
        if (typeof item?.order === 'number') (out[name] ??= {})[topic] = item.order;
      }
    }
    return out;
  }

  /** The engine's own next-phase surface, verbatim — never re-derived. */
  private async nextRender(wu: string, workType: string): Promise<string | null> {
    if (!this.deps.engine) return null;
    try {
      return workType === 'epic'
        ? await this.deps.engine.call<string>('renderEpicDashboard', { name: wu })
        : await this.deps.engine.call<string>('renderWorkUnitStatus', { type: workType, name: wu });
    } catch {
      return null;
    }
  }

  lobbyStrip(): Omit<Digest, 'waiting'>[] {
    return lobbyStrip([...this.digests.values()]);
  }

  isEscalated(gateId: string): boolean {
    return this.escalation.isEscalated(gateId);
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
