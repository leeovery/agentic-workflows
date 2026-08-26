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
import { SPINE_EVENT_TYPES } from '@workflow-ui/shared';

export type ApiDeps = {
  projectRoot: string;
  engine: EngineAdapter | null;
  store: EventStore | null;
  knowledgePath: string | null; // knowledge.cjs of the installed product
};

type Json = Record<string, unknown>;

function send(res: http.ServerResponse, status: number, body: Json): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
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
    send(res, 405, { error: 'read-only surface' });
    return true;
  }
  try {
    if (url.pathname === '/api/lobby') {
      await lobby(res, deps);
      return true;
    }
    const channel = url.pathname.match(/^\/api\/channel\/([^/]+)$/);
    if (channel) {
      await channelView(res, deps, decodeURIComponent(channel[1]!));
      return true;
    }
    const artifact = url.pathname.match(/^\/api\/artifact\/([^/]+)$/);
    if (artifact) {
      artifactView(res, deps, decodeURIComponent(artifact[1]!), url.searchParams.get('path') ?? '');
      return true;
    }
    send(res, 404, { error: 'unknown api route' });
    return true;
  } catch (err) {
    send(res, 500, { error: String((err as Error).message ?? err) });
    return true;
  }
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

  const registry = snap.registry ?? {};
  const roadmap = (registry as any).roadmap ?? null;
  const baseline = (registry as any).baseline ?? null;

  send(res, 200, {
    empty: false,
    detail,
    overviewRender: overview,
    knowledge: knowledgeState(projectRoot, deps.knowledgePath),
    durable: { counts: durableCounts(rows), rows },
    roadmap: roadmap
      ? {
          horizons: roadmap.horizons ?? [],
          itemCount: Object.keys(roadmap.items ?? {}).length,
        }
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
    const map = (await engine.call('discoveryMap', { name: wu }).catch(() => [])) as any[];
    threads = map.map((t) => ({
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
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.md')) out.push({ path: r, phase: r.split('/')[0] ?? '' });
    }
  };
  walk('');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function artifactView(res: http.ServerResponse, deps: ApiDeps, wu: string, rel: string): void {
  // Path safety: the artifact must resolve inside the unit's own directory.
  const base = path.resolve(deps.projectRoot, '.workflows', wu);
  const full = path.resolve(base, rel);
  if (!full.startsWith(base + path.sep) || !full.endsWith('.md')) {
    send(res, 400, { error: 'artifact path refused' });
    return;
  }
  let content: string;
  try {
    content = fs.readFileSync(full, 'utf8');
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
