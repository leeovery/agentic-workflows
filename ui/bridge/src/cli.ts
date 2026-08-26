// bridge CLI — phase-0 §5. `bridge --project <path>` streams live domain
// events from a real repo; `bridge --replay <fixture>` streams a converted
// stage; `bridge convert ...` builds fixture v0 from a terminal-driven session.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DomainEvent } from '@workflow-ui/shared';
import { discoverEngine, EngineAdapter } from './engine.js';
import { handshake, type Handshake } from './version.js';
import { buildSpine } from './spine.js';
import { Watcher } from './watch.js';
import { openDb, type Db } from './db.js';
import { EventStore } from './store.js';
import { BridgeServer, type HealthState } from './server.js';
import { Replayer } from './replay.js';
import { convertTranscript, snapshotWorld } from './convert.js';
import { logger } from './log.js';
import type { RawEvent } from './derive.js';

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

const WIDTH = 65; // every engine invocation pins WORKFLOWS_DISPLAY_WIDTH

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
  const stateDir = arg('state-dir') ?? path.join(projectRoot, '.workflows', '.cache', '.bridge-state');
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

  const server = new BridgeServer({
    port: Number(arg('port') ?? '4870'),
    store,
    db,
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

  const engine = enginePath ? new EngineAdapter(projectRoot, enginePath, WIDTH) : undefined;

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
      store.onEpochChange(spine.epoch, spine.tip, () => false);
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
    // live-only: watch from the current tree with no durable layer.
    const { snapshotTree } = await import('./snapshot.js');
    watcher = new Watcher(projectRoot, project, 'live-only', { tree: {}, snap: snapshotTree(projectRoot), head: gitHead(projectRoot) }, engine);
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
    store.onEpochChange(spine.epoch, spine.tip, (sha) => {
      try {
        execFileSync('git', ['-C', projectRoot, 'cat-file', '-e', sha], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    });
    const stored = store.append(spine.events);
    watcher!.setEpoch(spine.epoch);
    server.control({ control: 'epoch-changed', epoch: spine.epoch, reason });
    logger.warn('epoch changed — clients must full-resync', { reason, epoch: spine.epoch, events: stored.length });
  });
  watcher.start();

  const shutdown = async () => {
    logger.info('shutting down');
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
    port: Number(arg('port') ?? '4870'),
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
  if (!fs.existsSync(path.join(out, 'answers.json'))) {
    fs.writeFileSync(path.join(out, 'answers.json'), '{}\n');
  }
  console.log(`fixture written: ${out} (${journal.length} journal records)`);
}

const mode = process.argv[2];
if (mode === 'convert') {
  runConvert();
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
  console.error('usage: bridge --project <path> | bridge --replay <fixture> [--offline] | bridge convert ...');
  process.exit(2);
}
