// Read-only API for the SPA (Phase 1 — the mirror). Every state claim is
// traceable to an engine value: details and lifecycles come from the engine
// host (lib.cjs), renders are the engine's own projections, spine/drawer come
// from the durable event store, waiting counts from the durable tier. No
// route writes anything, anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type http from 'node:http';
import type { EngineAdapter } from './engine.js';
import type { EventStore } from './store.js';
import { snapshotTree } from './snapshot.js';
import { attachDerived } from './spine.js';
import { durableRows, durableCounts } from './durable.js';
import { buildQueue } from './queue.js';
import { checkToken } from './auth.js';
import type { SessionManager } from './sessions.js';
import { SPINE_EVENT_TYPES } from '@workflow-ui/shared';

export type ApiDeps = {
  projectRoot: string;
  engine: EngineAdapter | null;
  store: EventStore | null;
  knowledgePath: string | null; // knowledge.cjs of the installed product
  sessions?: SessionManager | null;
  token?: string;
  readOnlyMirror?: { host: string } | null; // lease not held — no writes
};

type Json = Record<string, unknown>;

function send(res: http.ServerResponse, status: number, body: Json): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

// The wu route segment is decoded AFTER the URL parser ran, so a
// percent-encoded slash or dot-segment survives to here — validate the
// decoded name before it touches any path or engine call. A work-unit name
// is a single path segment, nothing more.
function validUnitName(wu: string): boolean {
  return wu.length > 0 && !/[/\\\0]/.test(wu) && wu !== '.' && wu !== '..' && !wu.startsWith('.');
}

/** The knowledge-gate state — the product's own check verb, read-only. */
function knowledgeState(projectRoot: string, knowledgePath: string | null): { state: string } {
  if (!knowledgePath) return { state: 'unknown' };
  try {
    const out = execFileSync('node', [knowledgePath, 'check'], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return { state: out.startsWith('ready') ? 'ready' : 'not-ready' };
  } catch {
    return { state: 'not-ready' };
  }
}

const UNIT_GROUPS: Record<string, string> = {
  epics: 'epic',
  features: 'feature',
  bugfixes: 'bugfix',
  quick_fixes: 'quick-fix',
  cross_cutting: 'cross-cutting',
};

export async function handleApi(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ApiDeps,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/')) return false;
  if (req.method !== 'GET') {
    // Mutating routes: bearer token (the trust boundary) + a driving lease.
    if (req.method !== 'POST') {
      send(res, 405, { error: 'method not allowed' });
      return true;
    }
    if (!deps.token || !checkToken(req, url, deps.token)) {
      send(res, 401, { error: 'token required' });
      return true;
    }
    if (deps.readOnlyMirror) {
      send(res, 409, { error: `read-only mirror — driven from ${deps.readOnlyMirror.host}` });
      return true;
    }
    await handleMutation(url, req, res, deps);
    return true;
  }
  try {
    if (url.pathname === '/api/lobby') {
      await lobby(res, deps);
      return true;
    }
    if (url.pathname === '/api/token') {
      // Same-origin pages only (Host+Origin checked upstream) — hands the
      // SPA its bearer token for mutating calls.
      send(res, 200, { token: deps.token ?? null });
      return true;
    }
    if (url.pathname === '/api/queue') {
      await queueView(res, deps);
      return true;
    }
    if (url.pathname === '/api/sessions') {
      send(res, 200, { sessions: publicSessions(deps) });
      return true;
    }
    const thread = url.pathname.match(/^\/api\/session\/([^/]+)\/thread$/);
    if (thread && deps.sessions) {
      const t = deps.sessions.transcript(decodeURIComponent(thread[1]!));
      const row = deps.sessions.get(decodeURIComponent(thread[1]!));
      send(res, 200, {
        state: row?.state ?? 'dead',
        openGate: row?.openGate ?? null,
        lastError: row?.lastError,
        records: t.records,
        asks: t.asks.map((a) => ({ ordinal: a.ordinal, gateId: a.gateId, answered: a.answered, kind: a.detection.kind })),
      });
      return true;
    }
    const channel = url.pathname.match(/^\/api\/channel\/([^/]+)$/);
    if (channel) {
      const wu = decodeURIComponent(channel[1]!);
      if (!validUnitName(wu)) {
        send(res, 400, { error: 'work unit name refused' });
        return true;
      }
      await channelView(res, deps, wu);
      return true;
    }
    const artifact = url.pathname.match(/^\/api\/artifact\/([^/]+)$/);
    if (artifact) {
      const wu = decodeURIComponent(artifact[1]!);
      if (!validUnitName(wu)) {
        send(res, 400, { error: 'work unit name refused' });
        return true;
      }
      artifactView(res, deps, wu, url.searchParams.get('path') ?? '');
      return true;
    }
    send(res, 404, { error: 'unknown api route' });
    return true;
  } catch (err) {
    send(res, 500, { error: String((err as Error).message ?? err) });
    return true;
  }
}

function publicSessions(deps: ApiDeps): unknown[] {
  if (!deps.sessions) return [];
  return deps.sessions.list().map((s) => ({
    bridgeSessionId: s.bridgeSessionId,
    address: s.address,
    state: s.state,
    openGate: s.openGate,
    lastError: s.lastError,
  }));
}

async function queueView(res: http.ServerResponse, deps: ApiDeps): Promise<void> {
  const snap = snapshotTree(deps.projectRoot);
  if (deps.engine) await attachDerived(snap, deps.engine);
  const rows = buildQueue(durableRows(snap, deps.projectRoot), deps.sessions ?? null, deps.store);
  send(res, 200, { rows });
}

async function handleMutation(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  if (!deps.sessions) {
    send(res, 503, { error: 'session manager unavailable' });
    return;
  }
  const body = await readBody(req);

  if (url.pathname === '/api/session/start') {
    const address = (body.address ?? {}) as { workUnit?: string; topic?: string; phase?: string };
    const entryPrompt = typeof body.entryPrompt === 'string' && body.entryPrompt.trim() !== ''
      ? body.entryPrompt
      : '/workflow-start';
    const row = await deps.sessions.start(address, entryPrompt);
    send(res, 200, {
      bridgeSessionId: row.bridgeSessionId,
      state: row.state,
      openGate: row.openGate,
      lastError: row.lastError,
    });
    return;
  }

  const answer = url.pathname.match(/^\/api\/gate\/([0-9a-f]{16})\/answer$/);
  if (answer) {
    const gateId = answer[1]!;
    const text = String(body.text ?? '');
    if (text.trim() === '') {
      send(res, 400, { error: 'empty answer' });
      return;
    }
    const holder = deps.sessions.list().find((s) => s.openGate?.id === gateId)
      ?? deps.sessions.list().find((s) => s.bridgeSessionId === body.bridgeSessionId);
    if (!holder) {
      send(res, 404, { error: 'no session holds this gate' });
      return;
    }
    const result = await deps.sessions.answer(holder.bridgeSessionId, gateId, text, 'ui');
    const row = deps.sessions.get(holder.bridgeSessionId);
    send(res, result.ok ? 200 : 409, {
      ...result,
      session: row ? { state: row.state, openGate: row.openGate, lastError: row.lastError } : null,
    });
    return;
  }

  const end = url.pathname.match(/^\/api\/session\/([^/]+)\/end$/);
  if (end) {
    await deps.sessions.end(decodeURIComponent(end[1]!));
    send(res, 200, { ok: true });
    return;
  }

  send(res, 404, { error: 'unknown mutation' });
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

async function lobby(res: http.ServerResponse, deps: ApiDeps): Promise<void> {
  const { projectRoot, engine } = deps;
  const hasWorkflows = fs.existsSync(path.join(projectRoot, '.workflows'));
  if (!hasWorkflows) {
    send(res, 200, { empty: true, reason: 'no-workflows' });
    return;
  }
  const detail = engine ? ((await engine.call('startDetail')) as Json) : null;
  const overview = engine ? await engine.call<string>('renderStartOverview').catch(() => null) : null;

  const snap = snapshotTree(projectRoot);
  if (engine) await attachDerived(snap, engine);
  const rows = durableRows(snap, projectRoot);

  // Roadmap and baseline come from the engine's own startDetail derivations
  // (roadmapState / baselineState) — never re-derived from the raw manifest.
  const roadmap = (detail as any)?.roadmap ?? null;
  const baseline = (detail as any)?.baseline ?? null;

  send(res, 200, {
    empty: false,
    detail,
    overviewRender: overview,
    knowledge: knowledgeState(projectRoot, deps.knowledgePath),
    durable: { counts: durableCounts(rows), rows },
    roadmap: roadmap?.exists
      ? { horizons: roadmap.horizons ?? [], totals: roadmap.totals ?? {}, itemCount: roadmap.totals?.items ?? 0 }
      : null,
    baseline: baseline ? { status: baseline.status ?? 'none' } : null,
  });
}

async function channelView(res: http.ServerResponse, deps: ApiDeps, wu: string): Promise<void> {
  const { projectRoot, engine, store } = deps;
  const manifestPath = path.join(projectRoot, '.workflows', wu, 'manifest.json');
  let manifest: any = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    send(res, 404, { error: `no such work unit: ${wu}` });
    return;
  }
  const workType: string = manifest.work_type ?? 'feature';

  // The spine — the Phase 0 pure function's stored output, filtered to the
  // admissible set (gates arrive with Phase 2).
  const all = store ? store.readFrom(0) : [];
  const spine = all.filter(
    (e) => (SPINE_EVENT_TYPES as readonly string[]).includes(e.type) && e.address.workUnit === wu,
  );
  // The activity drawer: commits touching this unit + its artifact updates.
  const drawer = all.filter(
    (e) =>
      (e.type === 'commit.landed' && ((e.payload as any).scope ?? []).includes(wu)) ||
      (e.type === 'artifact.updated' && e.address.workUnit === wu),
  );

  // Threads: epics get one per discovery-map topic (engine lifecycle);
  // single-topic types get the unit's own thread.
  let threads: unknown[] = [];
  if (workType === 'epic' && engine) {
    // buildDiscoveryMap answers { map, summary, needs_sequencing } — the
    // rows live under .map (the round-7 epic-500 fix, now pinned by test).
    const result = (await engine.call('discoveryMap', { name: wu }).catch(() => null)) as {
      map?: any[];
    } | null;
    threads = (result?.map ?? []).map((t) => ({
      name: t.name,
      lifecycle: t.lifecycle,
      phase: t.current_phase ?? null,
      cues: {
        triageParked: t.triage_parked ?? false,
        reconcilePending: t.reconcile_pending ?? false,
      },
    }));
  } else {
    threads = [{ name: wu, lifecycle: manifest.status, phase: null, cues: {} }];
  }

  // Engine render embed — dashboards for epics, the pipeline status otherwise.
  let embed: string | null = null;
  if (engine) {
    embed =
      workType === 'epic'
        ? await engine.call<string>('renderEpicDashboard', { name: wu }).catch(() => null)
        : await engine.call<string>('renderWorkUnitStatus', { type: workType, name: wu }).catch(() => null);
  }

  // Artifact listing for navigation (unit-scoped, markdown only).
  const artifacts = listUnitArtifacts(projectRoot, wu);

  send(res, 200, {
    name: wu,
    workType,
    status: manifest.status ?? 'in-progress',
    spine,
    drawer,
    threads,
    embed,
    artifacts,
  });
}

function listUnitArtifacts(projectRoot: string, wu: string): { path: string; phase: string }[] {
  const base = path.join(projectRoot, '.workflows', wu);
  const out: { path: string; phase: string }[] = [];
  const walk = (rel: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(base, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      // A hostile repo can commit symlinks (mode 120000) — never follow one,
      // in either direction: a linked "artifact" would serve its target.
      if (e.isSymbolicLink()) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.md')) out.push({ path: r, phase: r.split('/')[0] ?? '' });
    }
  };
  walk('');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function artifactView(res: http.ServerResponse, deps: ApiDeps, wu: string, rel: string): void {
  // Path safety: the artifact must resolve inside the unit's own directory —
  // lexically AND after resolving symlinks (a hostile repo can commit a .md
  // symlink pointing anywhere on the host).
  const base = path.resolve(deps.projectRoot, '.workflows', wu);
  const full = path.resolve(base, rel);
  if (!full.startsWith(base + path.sep) || !full.endsWith('.md')) {
    send(res, 400, { error: 'artifact path refused' });
    return;
  }
  let content: string;
  try {
    const realBase = fs.realpathSync(base);
    const realFull = fs.realpathSync(full);
    if (!realFull.startsWith(realBase + path.sep)) {
      send(res, 400, { error: 'artifact path refused' });
      return;
    }
    content = fs.readFileSync(realFull, 'utf8');
  } catch {
    send(res, 404, { error: 'artifact not found' });
    return;
  }
  send(res, 200, { workUnit: wu, path: rel, phase: rel.split('/')[0] ?? '', content });
}

// ---------------------------------------------------------------------------
// Static SPA serving (app/dist) with an SPA fallback.
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

export function serveStatic(url: URL, res: http.ServerResponse, distDir: string): boolean {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) return false;
  let rel = url.pathname === '/' ? '/index.html' : url.pathname;
  let full = path.resolve(distDir, '.' + rel);
  if (!full.startsWith(path.resolve(distDir) + path.sep) && full !== path.resolve(distDir, 'index.html')) {
    return false;
  }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    // SPA fallback for client routes.
    full = path.join(distDir, 'index.html');
    rel = '/index.html';
  }
  const type = MIME[path.extname(full)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(fs.readFileSync(full));
  return true;
}
