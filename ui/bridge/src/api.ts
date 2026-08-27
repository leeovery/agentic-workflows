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
import { buildStructure } from './structure.js';
import { fileTimeline, whatMoved } from './history.js';
import { buildTelemetry } from './telemetry.js';
import { planDag } from './plan-dag.js';
import { checkToken } from './auth.js';
import type { SessionManager } from './sessions.js';
import type { Db } from './db.js';
import { HUMAN_SENTINEL } from './db.js';
import { SPINE_EVENT_TYPES } from '@workflow-ui/shared';

export type ApiDeps = {
  projectRoot: string;
  engine: EngineAdapter | null;
  store: EventStore | null;
  knowledgePath: string | null; // knowledge.cjs of the installed product
  sessions?: SessionManager | null;
  token?: string;
  readOnlyMirror?: { host: string } | null; // lease not held — no writes
  db?: Db | null; // cursors + read-refs (Phase 3)
  digests?: () => unknown; // lobby digest strip provider (Phase 3)
  markActivity?: (sig: { appConnected?: boolean; focusedThread?: string | null; interaction?: boolean }) => void;
  isEscalated?: (gateId: string) => boolean; // Phase 3 escalation join for the queue
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
    if (url.pathname === '/api/digests') {
      send(res, 200, { strip: deps.digests ? deps.digests() : [] });
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
        asks: t.asks.map((a) => ({ ordinal: a.ordinal, gateId: a.gateId, answered: a.answered, kind: a.detection.kind, turn: a.turn })),
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
    const history = url.pathname.match(/^\/api\/history\/([^/]+)$/);
    if (history) {
      const wu = decodeURIComponent(history[1]!);
      if (!validUnitName(wu)) {
        send(res, 400, { error: 'work unit name refused' });
        return true;
      }
      const rel = url.searchParams.get('path') ?? '';
      // Same containment as artifactView: realpath the target inside the
      // unit's own dir (single-sourced check, round-10).
      const base = path.resolve(deps.projectRoot, '.workflows', wu);
      const full = path.resolve(base, rel);
      if (!full.startsWith(base + path.sep) || !rel.endsWith('.md')) {
        send(res, 400, { error: 'artifact path refused' });
        return true;
      }
      send(res, 200, { timeline: fileTimeline(deps.projectRoot, path.join('.workflows', wu, rel)) });
      return true;
    }
    if (url.pathname === '/api/roadmap') {
      await roadmapView(res, deps);
      return true;
    }
    const plan = url.pathname.match(/^\/api\/plan\/([^/]+)\/([^/]+)$/);
    if (plan) {
      const wu = decodeURIComponent(plan[1]!);
      const topic = decodeURIComponent(plan[2]!);
      if (!validUnitName(wu) || !validUnitName(topic)) {
        send(res, 400, { error: 'name refused' });
        return true;
      }
      const manifest = deps.engine?.readUnitManifest(wu) ?? null;
      const format = manifest ? planFormatOf(deps.projectRoot, manifest) : 'local-markdown';
      send(res, 200, { dag: planDag(deps.projectRoot, wu, topic, format) });
      return true;
    }
    send(res, 404, { error: 'unknown api route' });
    return true;
  } catch (err) {
    send(res, 500, { error: String((err as Error).message ?? err) });
    return true;
  }
}

// HEAD changes rarely relative to artifact GETs — cache it briefly so a burst
// of reads (or an SSE reconnect storm) doesn't shell out per request on the
// event-loop thread (round-9 hardening).
let headCache: { sha: string | null; at: number; root: string } | null = null;
function headSha(projectRoot: string): string | null {
  const now = Date.now();
  if (headCache && headCache.root === projectRoot && now - headCache.at < 2000) return headCache.sha;
  let sha: string | null = null;
  try {
    sha = execFileSync('git', ['-C', projectRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    sha = null;
  }
  headCache = { sha, at: now, root: projectRoot };
  return sha;
}

function readRef(db: Db, projectRoot: string, artifact: string): { sha: string; state: string } | null {
  const row = db.sqlite
    .prepare('SELECT sha, state FROM artifact_read_refs WHERE human_id = ? AND project = ? AND artifact = ?')
    .get(HUMAN_SENTINEL, path.basename(path.resolve(projectRoot)), artifact) as { sha: string; state: string } | undefined;
  return row ?? null;
}

function recordReadRef(db: Db, projectRoot: string, wu: string, rel: string): void {
  const sha = headSha(projectRoot);
  if (!sha) return;
  const artifact = `${wu}/${rel}`;
  db.sqlite
    .prepare(
      `INSERT INTO artifact_read_refs (human_id, project, artifact, sha, state, rendered_at)
       VALUES (?, ?, ?, ?, 'current', ?)
       ON CONFLICT(human_id, project, artifact) DO UPDATE SET sha = excluded.sha, state = 'current', rendered_at = excluded.rendered_at`,
    )
    .run(HUMAN_SENTINEL, path.basename(path.resolve(projectRoot)), artifact, sha, new Date().toISOString());
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

async function roadmapView(res: http.ServerResponse, deps: ApiDeps): Promise<void> {
  // The roadmap surface — horizons + items + lifecycle + origin + sessions,
  // all from the engine's own roadmapState (via startDetail). Read-and-navigate.
  const detail = deps.engine ? ((await deps.engine.call('startDetail')) as any) : null;
  const rm = detail?.roadmap ?? null;
  if (!rm || !rm.exists) {
    send(res, 200, { exists: false });
    return;
  }
  send(res, 200, {
    exists: true,
    horizons: rm.horizons ?? [],
    items: rm.items ?? [],
    totals: rm.totals ?? {},
    sessions: rm.session_logs ?? [],
    activeSession: rm.active_session ?? null,
  });
}

async function queueView(res: http.ServerResponse, deps: ApiDeps): Promise<void> {
  const snap = snapshotTree(deps.projectRoot);
  if (deps.engine) await attachDerived(snap, deps.engine);
  // Build order per epic (spec item `order` fields) — the queue's within-epic
  // tie-break (spec 5 clause 4).
  const buildOrder: Record<string, Record<string, number>> = {};
  for (const [name, unit] of Object.entries(snap.units)) {
    const items = (unit.manifest as any)?.phases?.specification?.items ?? {};
    for (const [topic, item] of Object.entries<any>(items)) {
      if (typeof item?.order === 'number') {
        (buildOrder[name] ??= {})[topic] = item.order;
      }
    }
  }
  const rows = buildQueue(durableRows(snap, deps.projectRoot), deps.sessions ?? null, deps.store, buildOrder, deps.isEscalated);
  send(res, 200, { rows });
}

async function handleMutation(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  const body = await readBody(req);

  // Advance the artifact read-ref — a deliberate, focused view, not a side
  // effect of every GET (round-10 finding).
  const read = url.pathname.match(/^\/api\/artifact\/([^/]+)\/read$/);
  if (read && deps.db) {
    const wu = decodeURIComponent(read[1]!);
    const rel = String(body.path ?? '');
    if (validUnitName(wu) && rel.endsWith('.md') && !rel.split('/').includes('..')) {
      recordReadRef(deps.db, deps.projectRoot, wu, rel);
      send(res, 200, { ok: true });
    } else {
      send(res, 400, { error: 'artifact path refused' });
    }
    return;
  }

  // Activity signalling needs no session manager (a read-only mirror still
  // reports focus for suppression).
  if (url.pathname === '/api/activity') {
    deps.markActivity?.({
      appConnected: body.appConnected !== false,
      focusedThread: (body.focusedThread as string | null) ?? null,
      interaction: body.interaction === true,
    });
    send(res, 200, { ok: true });
    return;
  }

  if (!deps.sessions) {
    send(res, 503, { error: 'session manager unavailable' });
    return;
  }

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

  // The spine — the Phase 0 pure function's stored output (durable), plus the
  // live gate refs for this unit joined from the session projections (gates
  // are ephemeral, not durable events, so they're joined here, not stored).
  const all = store ? store.readFrom(0) : [];
  const spine: unknown[] = all.filter(
    (e) => (SPINE_EVENT_TYPES as readonly string[]).includes(e.type) && e.address.workUnit === wu,
  );
  if (deps.sessions) {
    for (const s of deps.sessions.list()) {
      const g = s.openGate;
      if (g && g.state === 'open' && g.address.workUnit === wu) {
        spine.push({
          id: g.id,
          type: 'gate.opened',
          ts: g.openedAt,
          address: g.address,
          payload: { card: g },
          live: true,
        });
      }
    }
  }
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

  // Presence — the engine's own scan (research/discussion heartbeats; other
  // phases have none and that is labelled, never inferred as absence of work).
  let presence: unknown[] = [];
  if (engine) {
    const scan = (await engine.scanPresence(wu).catch(() => null)) as { sessions?: unknown[] } | null;
    presence = scan?.sessions ?? [];
  }

  // Delivery telemetry (Phase 5) — one surface per implementation topic, all
  // from the manifest per the source inventory. Dep-blocked comes from the
  // engine's own derivation (never re-derived here); agent activity from the
  // live agent store scan.
  const allEvents = store ? store.readFrom(0) : [];
  const telemetry: unknown[] = [];
  const implItems = manifest.phases?.implementation?.items ?? {};
  let depBlockedByTopic: Record<string, { topic: string; reason?: string }[]> = {};
  if (workType === 'epic' && engine) {
    const detail = (await engine.epicDetailFor(manifest).catch(() => null)) as any;
    for (const p of detail?.phases?.planning ?? []) {
      if (Array.isArray(p.deps_blocking) && p.deps_blocking.length > 0) {
        depBlockedByTopic[p.name] = p.deps_blocking.map((d: any) => ({ topic: d.topic ?? String(d), reason: d.reason }));
      }
    }
  }
  const agentCounts = countAgents(projectRoot, wu);
  for (const topic of Object.keys(implItems)) {
    const t = buildTelemetry(wu, topic, manifest, depBlockedByTopic[topic] ?? [], allEvents, agentCounts[topic] ?? 0);
    if (t) telemetry.push(t);
  }

  send(res, 200, {
    name: wu,
    workType,
    status: manifest.status ?? 'in-progress',
    spine,
    drawer,
    threads,
    embed,
    artifacts,
    presence,
    telemetry,
    planFormat: planFormatOf(deps.projectRoot, manifest),
  });
}

/** The topic's plan format: topic-level override, else project default. */
function planFormatOf(projectRoot: string, manifest: Record<string, any>): string {
  const topicFmt = Object.values(manifest.phases?.planning?.items ?? {}).find((i: any) => i?.format)?.['format'];
  if (topicFmt) return String(topicFmt);
  try {
    const proj = JSON.parse(fs.readFileSync(path.join(projectRoot, '.workflows', 'manifest.json'), 'utf8'));
    return String(proj?.defaults?.plan_format ?? 'local-markdown');
  } catch {
    return 'local-markdown';
  }
}

/** Count in-flight background agents per topic from the cache agent store. */
function countAgents(projectRoot: string, wu: string): Record<string, number> {
  const out: Record<string, number> = {};
  const base = path.join(projectRoot, '.workflows', '.cache', wu);
  let phases: string[];
  try {
    phases = fs.readdirSync(base).filter((n) => !n.startsWith('.'));
  } catch {
    return out;
  }
  for (const phase of phases) {
    let topics: string[];
    try {
      topics = fs.readdirSync(path.join(base, phase)).filter((n) => !n.startsWith('.'));
    } catch {
      continue;
    }
    for (const topic of topics) {
      let state: any;
      try {
        state = JSON.parse(fs.readFileSync(path.join(base, phase, topic, 'state.json'), 'utf8'));
      } catch {
        continue;
      }
      const inflight = Object.values(state?.agents ?? {}).filter((a: any) => a?.status === 'in-flight').length;
      if (inflight > 0) out[topic] = (out[topic] ?? 0) + inflight;
    }
  }
  return out;
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
    // Size cap — an artifact is human-scale prose; refuse a runaway file
    // rather than reading it wholesale into memory (round-10 hardening).
    if (fs.statSync(realFull).size > 4 * 1024 * 1024) {
      send(res, 413, { error: 'artifact too large' });
      return;
    }
    content = fs.readFileSync(realFull, 'utf8');
  } catch {
    send(res, 404, { error: 'artifact not found' });
    return;
  }
  // The what-moved ribbon reads the ref BEFORE this view overwrites it.
  const phase = rel.split('/')[0] ?? '';
  const artifactKey = `${wu}/${rel}`;
  const priorRef = deps.db ? readRef(deps.db, deps.projectRoot, artifactKey) : null;
  const moved = priorRef
    ? whatMoved(deps.projectRoot, path.join('.workflows', wu, rel), priorRef.sha, priorRef.state)
    : { state: 'none' as const };

  // Structure (manifest-owned or heading-keyed) and claim chips. Derive the
  // topic from the artifact's path — for an epic it differs from the work
  // unit. Two layouts: a nested `{phase}/{topic}/{file}.md` (spec, review,
  // brief) and a FLAT `{phase}/{topic}.md` (discussion, investigation).
  const parts = rel.split('/');
  const topic =
    parts.length >= 3
      ? parts[1]!
      : parts.length === 2
        ? parts[1]!.replace(/\.md$/, '')
        : wu;
  const manifest = deps.engine?.readUnitManifest(wu) ?? null;
  // The work unit's review report, if one exists — the claim-verification badge
  // source (best-effort; never bridge execution).
  let reviewReport: string | null = null;
  try {
    reviewReport = fs.readFileSync(path.join(base, '..', 'review', topic, 'report.md'), 'utf8');
  } catch {
    reviewReport = null;
  }
  const structure = buildStructure(phase, topic, manifest, content, reviewReport);

  // The read-ref is NOT recorded here — a background SSE-driven refetch would
  // otherwise silently mark an artifact "read" moments after a change lands.
  // The SPA advances the ref via POST /api/read only on a genuine, focused
  // view (round-10 finding).
  send(res, 200, { workUnit: wu, path: rel, phase, content, structure, whatMoved: moved });
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
