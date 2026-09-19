// Read-only API tests — served against the restored mid-discussion fixture
// world, so every assertion runs on real engine-produced state.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { restoreWorld } from '../src/convert.js';
import { buildSpine } from '../src/spine.js';
import { EngineAdapter, discoverEngine } from '../src/engine.js';
import { openDb, type Db } from '../src/db.js';
import { EventStore } from '../src/store.js';
import { BridgeServer } from '../src/server.js';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'mid-discussion');
const PORT = 4891;

let tmp: string;
let world: string;
let db: Db;
let engine: EngineAdapter | undefined;
let server: BridgeServer;

async function get(p: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`);
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'api-test-'));
  world = restoreWorld(path.join(FIXTURE, 'worlds', '0'), path.join(tmp, 'w'));
  const enginePath = discoverEngine(world);
  engine = enginePath ? new EngineAdapter(world, enginePath, 65) : undefined;
  db = openDb(path.join(tmp, 'state'));
  const store = new EventStore(db, 'w');
  const spine = await buildSpine(world, 'w', engine);
  store.setMeta(spine.epoch, spine.tip);
  store.append(spine.events);
  server = new BridgeServer({
    port: PORT,
    store,
    db,
    health: () => ({}) as any,
    api: {
      projectRoot: world,
      engine: engine ?? null,
      store,
      knowledgePath: path.join(world, '.claude', 'skills', 'workflow-knowledge', 'scripts', 'knowledge.cjs'),
    },
  });
  await server.listen();
}, 60_000);

afterAll(() => {
  server?.close();
  engine?.stop();
  db?.sqlite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('read-only API', () => {
  it('lobby joins engine detail, knowledge state, and the durable tier', async () => {
    const { status, body } = await get('/api/lobby');
    expect(status).toBe(200);
    expect(body.empty).toBe(false);
    expect(body.detail.features.work_units[0].name).toBe('rate-limiting');
    expect(body.knowledge.state).toBe('ready');
    expect(body.overviewRender).toContain('Rate Limiting');
    // The restored cache overlay carries a pending review report — the
    // durable tier must surface it (the overnight case, spec 5).
    expect(body.durable.rows.some((r: any) => r.kind === 'report-pending')).toBe(true);
    expect(body.durable.counts['rate-limiting']).toBeGreaterThan(0);
  });

  it('channel view: spine holds only admissible types, drawer carries commits + artifacts', async () => {
    const { status, body } = await get('/api/channel/rate-limiting');
    expect(status).toBe(200);
    expect(body.workType).toBe('feature');
    // This world's discussion is still in flight — nothing has completed, so
    // the spine is legitimately empty (the admissible set excludes creation
    // and machinery). What matters: nothing inadmissible ever appears.
    for (const e of body.spine) {
      expect(['phase.completed', 'workunit.status-changed', 'workunit.removed']).toContain(e.type);
    }
    expect(body.drawer.some((e: any) => e.type === 'commit.landed')).toBe(true);
    expect(body.drawer.some((e: any) => e.type === 'artifact.updated')).toBe(true);
    // Commits never leak onto the spine (intent 5 / I3).
    expect(body.spine.some((e: any) => e.type === 'commit.landed')).toBe(false);
    expect(body.embed).toContain('PIPELINE');
    expect(body.artifacts.some((a: any) => a.path.includes('discussion/rate-limiting.md'))).toBe(true);
  });

  it('artifact route serves unit markdown and refuses traversal', async () => {
    const ok = await get('/api/artifact/rate-limiting?path=discussion/rate-limiting.md');
    expect(ok.status).toBe(200);
    expect(ok.body.content).toContain('Rate Limiting');
    expect(ok.body.phase).toBe('discussion');

    const traversal = await get('/api/artifact/rate-limiting?path=../../src/client.js');
    expect(traversal.status).toBe(400);
    const nonMd = await get('/api/artifact/rate-limiting?path=manifest.json');
    expect(nonMd.status).toBe(400);
  });

  it('unknown unit 404s; writes without a token are refused', async () => {
    expect((await get('/api/channel/nope')).status).toBe(404);
    const post = await fetch(`http://127.0.0.1:${PORT}/api/lobby`, { method: 'POST' });
    expect(post.status).toBe(401); // the trust boundary: no token, no mutation
    const put = await fetch(`http://127.0.0.1:${PORT}/api/lobby`, { method: 'PUT' });
    expect(put.status).toBe(405);
  });

  it('epic channel answers with engine-lifecycle threads (the round-7 500 regression)', async () => {
    // Materialise an epic in the (disposable) world — lifecycles then come
    // from the engine's own buildDiscoveryMap.
    fs.mkdirSync(path.join(world, '.workflows', 'payments'), { recursive: true });
    fs.writeFileSync(
      path.join(world, '.workflows', 'payments', 'manifest.json'),
      JSON.stringify({
        name: 'payments',
        work_type: 'epic',
        status: 'in-progress',
        phases: {
          discovery: { items: { 'billing-model': { source: 'discovery', routing: 'discussion' } } },
          discussion: { items: { 'billing-model': { status: 'in-progress' } } },
        },
      }),
    );
    const { status, body } = await get('/api/channel/payments');
    expect(status).toBe(200);
    expect(body.workType).toBe('epic');
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].name).toBe('billing-model');
    expect(typeof body.threads[0].lifecycle).toBe('string');
    expect(body.threads[0].lifecycle.length).toBeGreaterThan(0);
  });

  it('refuses a percent-encoded traversal in the work-unit segment (both routes)', async () => {
    const channel = await get('/api/channel/%2e%2e%2f%2e%2e%2fsrc');
    expect(channel.status).toBe(400);
    const artifact = await get('/api/artifact/%2e%2e%2f%2e%2e%2fsrc?path=x.md');
    expect(artifact.status).toBe(400);
    const dotName = await get('/api/channel/..');
    expect([400, 404]).toContain(dotName.status);
  });

  it('never serves a symlinked artifact and never lists one', async () => {
    const secret = path.join(tmp, 'secret.md');
    fs.writeFileSync(secret, 'outside the repo');
    const link = path.join(world, '.workflows', 'rate-limiting', 'discussion', 'leak.md');
    fs.symlinkSync(secret, link);
    try {
      const res = await get('/api/artifact/rate-limiting?path=discussion/leak.md');
      expect([400, 404]).toContain(res.status);
      const chan = await get('/api/channel/rate-limiting');
      expect(chan.body.artifacts.some((a: any) => a.path.includes('leak'))).toBe(false);
    } finally {
      fs.unlinkSync(link);
    }
  });
});
