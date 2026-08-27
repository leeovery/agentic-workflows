// bridge CLI — phase-0 §5. `bridge --project <path>` streams live domain
// events from a real repo; `bridge --replay <fixture>` streams a converted
// stage; `bridge convert ...` builds fixture v0 from a terminal-driven session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { BridgeConfig, DomainEvent } from '@workflow-ui/shared';
import { discoverEngine, EngineAdapter } from './engine.js';
import { handshake, type Handshake } from './version.js';
import { buildSpine } from './spine.js';
import { Watcher } from './watch.js';
import { openDb, type Db } from './db.js';
import { EventStore } from './store.js';
import { BridgeServer, type HealthState } from './server.js';
import { acquireLease, releaseLease } from './lease.js';
import { loadOrMintToken } from './auth.js';
import { generateAllowlist } from './allowlist.js';
import { SessionManager, SdkDriver } from './sessions.js';
import { AttentionCoordinator } from './attention-coordinator.js';
import { Identity } from './identity.js';
import { CaptureRunner } from './capture.js';
import { assignOwnerOnOpen } from './ownership.js';
import { Replayer } from './replay.js';
import { convertTranscript, deriveAnswers, snapshotWorld } from './convert.js';
import { Journal } from './journal.js';
import { logger } from './log.js';
import type { RawEvent } from './derive.js';

// Web-push delivery sink. In the prototype, push subscriptions live in the
// db and delivery is best-effort; an undelivered push is logged on the
// observability floor so "left closed with confidence" degrades to badge +
// digest prominence, never silence (phase-3 risk).
function deliverWebPush(db: Db, d: { rowKey: string; kind: string; body: string }): void {
  // No real VAPID transport in the prototype; the delivery attempt is recorded
  // so an undelivered push is visible on the observability floor (phase-3 risk).
  db.sqlite
    .prepare(
      `INSERT INTO push_ledger (row_key, kind, decided_at, content_hash) VALUES (?, 'delivered', ?, ?)
       ON CONFLICT(row_key, kind) DO UPDATE SET decided_at = excluded.decided_at`,
    )
    .run(`delivery:${d.rowKey}`, new Date().toISOString(), d.body.slice(0, 40));
}

function loadBridgeId(stateDir: string): string {
  const p = path.join(stateDir, 'bridge-id');
  try {
    const id = fs.readFileSync(p, 'utf8').trim();
    if (id) return id;
  } catch {
    /* mint */
  }
  const id = `bridge-${crypto.randomBytes(6).toString('hex')}`;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(p, id);
  return id;
}

function defaultStateDir(projectRoot: string): string {
  const slug = path.basename(projectRoot).replace(/[^a-zA-Z0-9-]/g, '_');
  const hash = crypto.createHash('sha256').update(projectRoot).digest('hex').slice(0, 8);
  return path.join(os.homedir(), '.cache', 'workflow-bridge', `${slug}-${hash}`);
}

// Reachability check shared by BOTH epoch-change paths (boot-time mismatch
// and live non-fast-forward): a read ref is marked history-rewritten only
// when its sha is actually gone (EVENTS.md).
function gitReachable(dir: string): (sha: string) => boolean {
  return (sha) => {
    try {
      execFileSync('git', ['-C', dir, 'cat-file', '-e', sha], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
}

function gitHead(dir: string): string | null {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// Config file (phase-0 §5): ~/.config/workflow-bridge/config.json, overridden
// per-flag by argv. Defaults come from the shared schema.
function loadConfig(): BridgeConfig {
  const configPath = arg('config') ?? path.join(os.homedir(), '.config', 'workflow-bridge', 'config.json');
  let raw: unknown = {};
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    // Absent or unreadable → pure defaults; a malformed file must not boot a
    // silently different bridge.
    if (fs.existsSync(configPath)) {
      console.error(`config file unparseable, refusing to guess: ${configPath}`);
      process.exit(2);
    }
  }
  const parsed = BridgeConfig.safeParse(raw);
  if (!parsed.success) {
    console.error(`config file invalid: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`);
    process.exit(2);
  }
  return parsed.data;
}

const config = loadConfig();
// Every engine invocation pins WORKFLOWS_DISPLAY_WIDTH (renders are
// terminal-width-sensitive).
const WIDTH = config.displayWidth;

function validateOut(events: (RawEvent & { seq?: number })[]): void {
  // shared/ schemas validate every event both modes emit (done-means).
  for (const e of events) {
    const r = DomainEvent.safeParse(e);
    if (!r.success) {
      logger.error('event failed schema validation', { type: e.type, id: e.id, issues: r.error.issues.slice(0, 3) });
    }
  }
}

async function runLive(projectRoot: string): Promise<void> {
  projectRoot = path.resolve(projectRoot);
  const project = path.basename(projectRoot);
  // Bridge state is UI-native and lives OUT of tree — any write to
  // .workflows/ is out of scope for the bridge (phase-0 §out-of-scope), and
  // the engine's cache housekeeping must never meet bridge files.
  const stateDir = arg('state-dir') ?? defaultStateDir(projectRoot);
  const enginePath = arg('engine') ?? discoverEngine(projectRoot);

  let hs: Handshake;
  if (!enginePath) {
    hs = {
      productVersion: null,
      versionSource: 'unknown',
      supported: false,
      pendingMigrations: [],
      migrationsLogFound: false,
      shallow: false,
      mode: 'read-only',
      bannerReasons: ['no workflow-engine install found under .claude/skills/'],
    };
  } else {
    hs = handshake(projectRoot, enginePath);
  }
  logger.info('handshake', { ...hs });

  const db: Db = openDb(stateDir);
  const store = new EventStore(db, project);
  let epoch: string | null = null;
  let watcher: Watcher | null = null;

  // The engine adapter is created up front so the read-only API can still
  // serve engine-sourced state (details, renders) — reads only, no watcher.
  const engine = enginePath && hs.mode !== 'read-only' ? new EngineAdapter(projectRoot, enginePath, WIDTH) : undefined;
  const knowledgePath = enginePath
    ? path.resolve(enginePath, '..', '..', 'workflow-knowledge', 'scripts', 'knowledge.cjs')
    : null;

  // The trust boundary + the bridge lease. A bridge that cannot take the
  // lease runs as a read-only mirror with a banner — no sessions, no pushes.
  const token = loadOrMintToken(stateDir);
  const bridgeId = loadBridgeId(stateDir);
  let mirror: { host: string } | null = null;
  let sessions: SessionManager | null = null;
  let attention: AttentionCoordinator | null = null;
  let capture: CaptureRunner | null = null;
  // Identity resolves every request to a human. Single-user (default) is the
  // Phase 0 sentinel and needs nothing; github mode verifies push access with
  // the server's GITHUB_TOKEN (never in argv, never over chat).
  const identity = new Identity(db, config.auth, { serverToken: process.env.GITHUB_TOKEN });
  const stuckMs = config.notifications.stuckHours * 3600 * 1000;
  if (hs.mode === 'full') {
    const lease = acquireLease(projectRoot, bridgeId);
    if (!lease.held) {
      mirror = { host: lease.holder?.host ?? 'unknown' };
      hs.bannerReasons.push(`another bridge is driving this project${mirror.host ? ` from ${mirror.host}` : ''} — read-only mirror`);
      logger.warn('bridge lease not held — read-only mirror', { holder: lease.holder });
    } else {
      sessions = new SessionManager(db, new SdkDriver(arg('session-model')), {
        projectRoot,
        project,
        bridgeId,
        journalsDir: path.join(stateDir, 'journals'),
        allowedTools: generateAllowlist(projectRoot),
        displayWidth: WIDTH,
        enginePath,
      });
      sessions.restore();
      // Idle-timeout sweep (spec 2): retire sessions idle past 4h.
      const idleTimer = setInterval(() => sessions?.reapIdle(Date.now()), 10 * 60 * 1000);
      idleTimer.unref?.();

      // The capture-gesture runner — an ephemeral headless session per park,
      // fire-and-reconcile with a durable-failure lobby row. Only when driving
      // (a read-only mirror has no session authority). Least privilege: a
      // capture turn only writes one inbox file (`workflow-log-*` declares just
      // `Bash(mkdir -p)`; Write goes through canUseTool's project containment) —
      // so it gets a capture-scoped Bash allowlist, not the full session surface
      // (round-12 N3).
      capture = new CaptureRunner(db, new SdkDriver(arg('session-model')), {
        projectRoot,
        project,
        allowedTools: ['Bash(mkdir -p:*)'],
        displayWidth: WIDTH,
      });

      // The attention system (Phase 3): ceremony, escalation, digests. Push
      // delivery is the web-push sink; in the prototype it also logs on the
      // observability floor so an undelivered push is visible.
      attention = new AttentionCoordinator(
        db,
        project,
        {
          projectRoot,
          store,
          sessions,
          engine: engine ?? null,
          config: {
            rollupMinutes: config.notifications.rollupMinutes,
            quietStart: config.notifications.quietHours.start,
            quietEnd: config.notifications.quietHours.end,
            morningHour: config.notifications.morningHour,
            escalationMinutes: config.notifications.escalationMinutes,
            graceMinutes: config.notifications.graceMinutes,
          },
        },
        (d) => {
          logger.info('push', { rowKey: d.rowKey, kind: d.kind, body: d.body });
          deliverWebPush(db, d);
        },
      );
      attention.start();
    }
  }

  const server = new BridgeServer({
    port: Number(arg('port') ?? config.port),
    store,
    db,
    api: {
      projectRoot,
      engine: engine ?? null,
      store,
      knowledgePath: knowledgePath && fs.existsSync(knowledgePath) ? knowledgePath : null,
      sessions,
      token,
      readOnlyMirror: mirror,
      db,
      digests: () => attention?.lobbyStrip() ?? [],
      markActivity: (sig) => attention?.markActivity(sig),
      isEscalated: (gateId) => attention?.isEscalated(gateId) ?? false,
      identity,
      capture,
      project,
      stuckMs,
    },
    health: (): HealthState => ({
      ok: true,
      mode: 'live',
      bridgeMode: hs.mode,
      project,
      epoch,
      version: {
        productVersion: hs.productVersion,
        versionSource: hs.versionSource,
        supported: hs.supported,
        pendingMigrations: hs.pendingMigrations,
        shallow: hs.shallow,
      },
      bannerReasons: hs.bannerReasons,
      startedAt: '',
      eventsStored: (store.meta()?.lastSeq ?? -1) + 1,
    }),
  });
  await server.listen();

  if (hs.mode === 'read-only') {
    // Degraded: the banner state, not events (phase-0 done-means). /health
    // carries the reasons; no spine, no watcher, no writes to .workflows/.
    logger.warn('read-only mode — no event stream', { reasons: hs.bannerReasons });
    return;
  }

  if (hs.mode === 'live-only') {
    logger.warn('live-only mode — durable spine unavailable', { reasons: hs.bannerReasons });
  } else {
    const spine = await buildSpine(projectRoot, project, engine);
    epoch = spine.epoch;
    const prior = store.meta();
    if (prior && prior.epoch !== spine.epoch) {
      logger.warn('stored epoch differs — history changed since last run; full resync', {
        stored: prior.epoch,
        computed: spine.epoch,
      });
      store.onEpochChange(spine.epoch, spine.tip, gitReachable(projectRoot));
    } else if (!prior) {
      store.setMeta(spine.epoch, spine.tip);
    }
    const stored = store.append(spine.events);
    validateOut(stored.length > 0 ? stored : []);
    logger.info('historical spine built', { events: spine.events.length, newlyStored: stored.length, epoch });

    const head = (() => {
      try {
        return execFileSync('git', ['-C', projectRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      } catch {
        return null;
      }
    })();
    watcher = new Watcher(projectRoot, project, spine.epoch, { tree: spine.lastTree, snap: spine.lastSnapshot, head }, engine);
  }

  if (!watcher) {
    // live-only (shallow/grafted/partial clone): no durable layer exists —
    // the watcher only emits live diffs, and HEAD movement re-baselines.
    const { snapshotTree } = await import('./snapshot.js');
    watcher = new Watcher(
      projectRoot,
      project,
      'live-only',
      { tree: {}, snap: snapshotTree(projectRoot), head: gitHead(projectRoot) },
      engine,
      true,
    );
  }

  watcher.on('durable', (events: RawEvent[]) => {
    const stored = store.append(events);
    validateOut(stored);
    server.broadcast(stored);
  });
  watcher.on('live', (events: RawEvent[]) => {
    validateOut(events);
    server.broadcast(events);
  });
  watcher.on('epoch-change', async ({ reason }: { reason: string }) => {
    // Authoritative rebuild: recompute the spine, swap the epoch, re-baseline.
    const spine = await buildSpine(projectRoot, project, engine);
    epoch = spine.epoch;
    store.onEpochChange(spine.epoch, spine.tip, gitReachable(projectRoot));
    const stored = store.append(spine.events);
    watcher!.setEpoch(spine.epoch);
    server.control({ control: 'epoch-changed', epoch: spine.epoch, reason });
    logger.warn('epoch changed — clients must full-resync', { reason, epoch: spine.epoch, events: stored.length });
  });
  watcher.start();

  // Session/gate transitions ride the live layer (spec 3: the ledger is the
  // durable record; the stream carries freshness).
  if (sessions) {
    const mkLive = (type: string, address: Record<string, unknown>, payload: Record<string, unknown>) => ({
      id: crypto.createHash('sha256').update(`${type}\n${crypto.randomUUID()}`).digest('hex').slice(0, 16),
      epoch: epoch ?? 'live-only',
      live: true as const,
      ts: new Date().toISOString(),
      project,
      type,
      address,
      payload,
    });
    sessions.on('gate', (ev: { type: string; card?: any; gateId?: string; via?: string; bridgeSessionId: string }) => {
      // Assign the owner the moment a gate opens (precedence: session driver →
      // channel default). UI-side routing only; the engine never sees this.
      if (ev.type === 'gate.opened' && ev.card) assignOwnerOnOpen(db, project, ev.card);
      const payload = ev.card ? { card: ev.card } : { gateId: ev.gateId, via: ev.via ?? 'ui' };
      const type = ev.type === 'gate.opened' || ev.type === 'gate.answered' || ev.type === 'gate.resolved' ? ev.type : 'gate.resolved';
      server.broadcast([mkLive(type, ev.card?.address ?? {}, payload) as any]);
    });
    sessions.on('session', (ev: { type: string; bridgeSessionId: string; address?: any }) => {
      const type = ev.type === 'session.started' ? 'session.started' : 'session.ended';
      server.broadcast([mkLive(type, ev.address ?? {}, { address: ev.address ?? {}, bridgeSessionId: ev.bridgeSessionId }) as any]);
    });
  }

  const shutdown = async () => {
    logger.info('shutting down');
    releaseLease(projectRoot, bridgeId);
    await watcher?.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function runReplay(fixtureDir: string): Promise<void> {
  fixtureDir = path.resolve(fixtureDir);
  const replayer = new Replayer(fixtureDir, {
    paceMs: Number(arg('pace') ?? '30'),
    offline: flag('offline'),
  });
  const worldDir = replayer.restoreFirstWorld();

  // Point the watcher at the restored world — real code paths, not mocks.
  let watcher: Watcher | null = null;
  let store: EventStore | null = null;
  let epoch: string | null = null;
  if (worldDir) {
    const project = path.basename(worldDir);
    const enginePath = discoverEngine(worldDir);
    const engine = enginePath ? new EngineAdapter(worldDir, enginePath, WIDTH) : undefined;
    const db = openDb(path.join(worldDir, '.bridge-state'));
    store = new EventStore(db, project);
    const spine = await buildSpine(worldDir, project, engine);
    epoch = spine.epoch;
    store.setMeta(spine.epoch, spine.tip);
    store.append(spine.events);
    watcher = new Watcher(worldDir, project, spine.epoch, { tree: spine.lastTree, snap: spine.lastSnapshot, head: gitHead(worldDir) }, engine);
  }

  const server = new BridgeServer({
    port: Number(arg('port') ?? config.port),
    store,
    db: null,
    onReplayStep: () => replayer.step(),
    health: (): HealthState => ({
      ok: true,
      mode: 'replay',
      bridgeMode: 'full',
      project: replayer.meta.description ?? path.basename(fixtureDir),
      epoch,
      version: {
        productVersion: replayer.meta.productVersion,
        versionSource: 'git-tag',
        supported: true,
        pendingMigrations: [],
        shallow: false,
      },
      bannerReasons: [],
      replay: {
        state: replayer.status().state,
        atTurn: replayer.status().atTurn,
        fixture: replayer.status().fixture,
      },
      startedAt: '',
      eventsStored: (store?.meta()?.lastSeq ?? -1) + 1,
    }),
  });
  await server.listen();
  watcher?.on('live', (events: RawEvent[]) => server.broadcast(events));
  watcher?.on('durable', (events: RawEvent[]) => server.broadcast(store!.append(events)));
  watcher?.start();

  replayer.on('record', (rec) => server.control({ control: 'journal', record: rec }));
  replayer.on('paused', (info) => server.control({ control: 'replay-paused', ...info }));
  replayer.on('ended', () => server.control({ control: 'replay-ended' }));

  await replayer.run();
  const st = replayer.status();
  logger.info('replay finished streaming', { state: st.state, atTurn: st.atTurn });
  if (flag('exit-when-done')) {
    server.close();
    await watcher?.close();
    process.exit(0);
  }
}

function runConvert(): void {
  const sessionPath = arg('session');
  const out = arg('out');
  const projectDir = arg('world-from');
  if (!sessionPath || !out) {
    console.error('usage: bridge convert --session <session.jsonl> --out <fixtures/name> [--world-from <project>] [--entry-prompt <p>] [--product-version <v>]');
    process.exit(2);
  }
  fs.mkdirSync(out, { recursive: true });
  const journal = convertTranscript(sessionPath, {
    bridgeSessionId: `converted-${path.basename(out)}`,
    width: WIDTH,
    entryPrompt: arg('entry-prompt') ?? '/workflow-start',
    productVersion: arg('product-version'),
  });
  fs.writeFileSync(path.join(out, 'transcript.jsonl'), journal.map((r) => JSON.stringify(r)).join('\n') + '\n');
  if (projectDir) {
    snapshotWorld(path.resolve(projectDir), path.join(out, 'worlds', '0'));
  }
  const meta = {
    productVersion: arg('product-version') ?? 'unknown',
    recordedAt: new Date().toISOString(),
    width: WIDTH,
    entryPrompt: arg('entry-prompt') ?? '/workflow-start',
    description: arg('description') ?? path.basename(out),
    moments: [], // gateId↔world pairing arrives with Phase 2's ask markers
  };
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.writeFileSync(
    path.join(out, 'answers.json'),
    JSON.stringify(deriveAnswers(journal as Parameters<typeof deriveAnswers>[0]), null, 2) + '\n',
  );
  console.log(`fixture written: ${out} (${journal.length} journal records)`);
}

// bridge record-moment — the Phase 2 recorder's snapshot half (spec 4). The
// journal is always teed live by the session manager; this pairs a live
// session's journal with a world snapshot at a quiesced moment (the session
// must be idle-at-ask — no tool call in flight — which the caller ensures by
// snapshotting when the queue shows the gate open).
function runRecordMoment(): void {
  const project = arg('project');
  const sessionId = arg('session-id');
  const stateDir = arg('state-dir');
  const out = arg('out');
  const gateId = arg('gate-id') ?? '';
  if (!project || !sessionId || !stateDir || !out) {
    console.error('usage: bridge record-moment --project <p> --session-id <bs-…> --state-dir <dir> --out <fixtures/name> [--gate-id <id>]');
    process.exit(2);
  }
  const journalPath = path.join(stateDir, 'journals', `${sessionId}.jsonl`);
  if (!fs.existsSync(journalPath)) {
    console.error(`no journal at ${journalPath}`);
    process.exit(1);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(journalPath, path.join(out, 'transcript.jsonl'));
  snapshotWorld(path.resolve(project), path.join(out, 'worlds', '0'));
  const journal = new Journal(path.dirname(journalPath), sessionId).read();
  const meta = journal.find((r) => r.record === 'meta') as any;
  fs.writeFileSync(
    path.join(out, 'meta.json'),
    JSON.stringify(
      {
        productVersion: arg('product-version') ?? 'unknown',
        recordedAt: new Date().toISOString(),
        width: meta?.width ?? WIDTH,
        entryPrompt: meta?.entryPrompt ?? '/workflow-start',
        description: arg('description') ?? path.basename(out),
        moments: gateId ? [{ gateId, world: '0' }] : [],
      },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(path.join(out, 'answers.json'), JSON.stringify(deriveAnswers(journal), null, 2) + '\n');
  console.log(`recorded moment: ${out} (${journal.length} journal records, world snapshot @ ${gateId || 'no gate'})`);
}

// bridge mcp — the Phase 7 MCP server over stdio. A third client of a RUNNING
// bridge: it holds the install bearer token + a per-user auth cookie and proxies
// the frozen card schema + the answer round-trip into an MCP host. No new card
// logic, no new answer path.
async function runMcp(): Promise<void> {
  const { createMcpServer, runStdio } = await import('./mcp.js');
  const { HttpBridgeClient } = await import('./mcp-client.js');
  const baseUrl = arg('bridge-url') ?? `http://127.0.0.1:${config.port}`;
  // Secrets come from the environment, never argv (argv is world-readable via ps).
  const bearerToken = process.env.WORKFLOW_BRIDGE_TOKEN ?? '';
  const authCookie = process.env.WORKFLOW_BRIDGE_COOKIE;
  if (!bearerToken) {
    console.error('bridge mcp: set WORKFLOW_BRIDGE_TOKEN (the install token from the SPA) in the environment');
    process.exit(2);
  }
  const client = new HttpBridgeClient({ baseUrl, bearerToken, authCookie });
  const server = createMcpServer(client, { spaBaseUrl: baseUrl });
  runStdio(server);
}

const mode = process.argv[2];
if (mode === 'convert') {
  runConvert();
} else if (mode === 'record-moment') {
  runRecordMoment();
} else if (mode === 'mcp') {
  runMcp().catch((e) => {
    logger.error('mcp server failed', { error: String(e?.stack ?? e) });
    process.exit(1);
  });
} else if (arg('replay')) {
  runReplay(arg('replay')!).catch((e) => {
    logger.error('replay failed', { error: String(e?.stack ?? e) });
    process.exit(1);
  });
} else if (arg('project')) {
  runLive(arg('project')!).catch((e) => {
    logger.error('bridge failed', { error: String(e?.stack ?? e) });
    process.exit(1);
  });
} else {
  console.error(
    'usage: bridge --project <path> | bridge --replay <fixture> [--offline] | bridge convert ... | bridge record-moment ... | bridge mcp [--bridge-url <url>]',
  );
  process.exit(2);
}
