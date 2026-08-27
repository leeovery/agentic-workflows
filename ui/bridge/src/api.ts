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
import { SPINE_EVENT_TYPES } from '@workflow-ui/shared';
import { Identity, SENTINEL_HUMAN, AUTH_COOKIE, type Human } from './identity.js';
import { CaptureRunner, type CaptureKind } from './capture.js';
import {
  assignOwnerOnOpen,
  claimGate,
  reassignChannel,
  ensureChannelDefault,
  recordSessionDriver,
  noteOwnerActivity,
  ownerInfo,
  mayAnswer,
  externallyResolvedAt,
} from './ownership.js';
import { beatViewing, humansViewing, inferredWorkingSessions } from './presence-humans.js';
import {
  addComment,
  listComments,
  markTargetRead,
  unreadForGate,
  countForGate,
  type CommentTarget,
} from './comments.js';

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
  // Phase 6 multiplayer.
  identity?: Identity | null; // human resolution + GitHub member check
  capture?: CaptureRunner | null; // the ephemeral capture-gesture runner
  project?: string; // the project name (presence/comment scoping)
  stuckMs?: number; // T_stuck for owner-inactivity (config.stuckHours)
};

// The current human for a request. Absent identity (or a read-only mirror
// without it) resolves to the Phase 0 sentinel — single-user stays zero-config.
function currentHuman(deps: ApiDeps, req: http.IncomingMessage): Human {
  return deps.identity ? deps.identity.resolve(req.headers.cookie) : SENTINEL_HUMAN;
}

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
    if (url.pathname === '/api/captures') {
      send(res, 200, { failed: deps.capture ? deps.capture.list() : [] });
      return true;
    }
    if (url.pathname === '/api/token') {
      // Same-origin pages only (Host+Origin checked upstream) — hands the
      // SPA its bearer token for mutating calls.
      send(res, 200, { token: deps.token ?? null });
      return true;
    }
    if (url.pathname === '/api/whoami') {
      const human = currentHuman(deps, req);
      send(res, 200, {
        mode: deps.identity?.mode ?? 'single',
        human: { id: human.id, name: human.name, member: human.member, sentinel: human.sentinel, githubLogin: human.githubLogin },
        repo: deps.identity?.mode === 'github' ? deps.identity.repo : undefined,
      });
      return true;
    }
    if (url.pathname === '/api/comments') {
      const target = commentTargetFromQuery(url);
      if (!target || !deps.db) {
        send(res, 400, { error: 'a gateId or artifact target is required' });
        return true;
      }
      const viewer = currentHuman(deps, req);
      send(res, 200, { comments: listComments(deps.db, deps.project ?? '', target, viewer.id) });
      return true;
    }
    if (url.pathname === '/api/queue') {
      await queueView(res, deps, currentHuman(deps, req));
      return true;
    }
    if (url.pathname === '/api/digests') {
      send(res, 200, { strip: deps.digests ? deps.digests() : [] });
      return true;
    }
    if (url.pathname === '/api/sessions') {
      send(res, 200, { sessions: publicSessions(deps, currentHuman(deps, req)) });
      return true;
    }
    const thread = url.pathname.match(/^\/api\/session\/([^/]+)\/thread$/);
    if (thread && deps.sessions) {
      const t = deps.sessions.transcript(decodeURIComponent(thread[1]!));
      const row = deps.sessions.get(decodeURIComponent(thread[1]!));
      const viewer = currentHuman(deps, req);
      send(res, 200, {
        state: row?.state ?? 'dead',
        openGate: row?.openGate ? gateWithOwnership(deps, row.openGate, viewer) : null,
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
      await channelView(res, deps, wu, currentHuman(deps, req));
      return true;
    }
    const artifact = url.pathname.match(/^\/api\/artifact\/([^/]+)$/);
    if (artifact) {
      const wu = decodeURIComponent(artifact[1]!);
      if (!validUnitName(wu)) {
        send(res, 400, { error: 'work unit name refused' });
        return true;
      }
      artifactView(res, deps, wu, url.searchParams.get('path') ?? '', currentHuman(deps, req).id);
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
      const format = manifest ? planFormatOf(deps.projectRoot, manifest, topic) : 'local-markdown';
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

function readRef(db: Db, projectRoot: string, artifact: string, humanId: string): { sha: string; state: string } | null {
  const row = db.sqlite
    .prepare('SELECT sha, state FROM artifact_read_refs WHERE human_id = ? AND project = ? AND artifact = ?')
    .get(humanId, path.basename(path.resolve(projectRoot)), artifact) as { sha: string; state: string } | undefined;
  return row ?? null;
}

function recordReadRef(db: Db, projectRoot: string, wu: string, rel: string, humanId: string): void {
  const sha = headSha(projectRoot);
  if (!sha) return;
  const artifact = `${wu}/${rel}`;
  db.sqlite
    .prepare(
      `INSERT INTO artifact_read_refs (human_id, project, artifact, sha, state, rendered_at)
       VALUES (?, ?, ?, ?, 'current', ?)
       ON CONFLICT(human_id, project, artifact) DO UPDATE SET sha = excluded.sha, state = 'current', rendered_at = excluded.rendered_at`,
    )
    .run(humanId, path.basename(path.resolve(projectRoot)), artifact, sha, new Date().toISOString());
}

/** A comment target from ?gateId= or ?artifact= (mutually exclusive). */
function commentTargetFromQuery(url: URL): CommentTarget | null {
  const gateId = url.searchParams.get('gateId');
  if (gateId && /^[0-9a-f]{16}$/.test(gateId)) return { gateId };
  const artifact = url.searchParams.get('artifact');
  if (artifact) return { artifact };
  return null;
}

/**
 * The confirm mode ('tap' | 'typed') of a gate BY id — from the holder's live
 * card when it matches, else the durable ledger's stored card. Independent of
 * how the holder was resolved, so the typed-confirm attestation guard can't be
 * sidestepped via the bridgeSessionId fallback (round-13).
 */
function confirmModeOf(deps: ApiDeps, holder: { openGate: { id: string; confirm?: string } | null }, gateId: string): string | undefined {
  if (holder.openGate?.id === gateId) return holder.openGate.confirm;
  if (!deps.db) return undefined;
  const row = deps.db.sqlite.prepare('SELECT card FROM gate_ledger WHERE gate_id = ?').get(gateId) as { card: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.card)?.confirm;
  } catch {
    return undefined;
  }
}

/**
 * Materialize a chat attachment into the gitignored cache so the session's Read
 * tool can pick it up by path (Phase-7 follow-up). This is the ONE place the
 * bridge writes under `.workflows/` — a narrow, deliberate exception to the
 * "bridge writes nothing to .workflows/" rule, justified because the file is
 * transient, gitignored (`.cache/`), user-input-in-transit (not bridge state),
 * and lives in the purpose-built purgeable cache. Hardened as a file-upload
 * sink: the name is sanitized to a basename of a safe charset, a random prefix
 * prevents collision/overwrite/guessing, the decoded size is capped, and the
 * final path is realpath-confined under `.cache/`.
 */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export function writeAttachment(
  projectRoot: string,
  opts: { name: string; dataBase64: string; workUnit?: string; bridgeSessionId?: string },
): { path: string } | { error: string; status: number } {
  // Decode + size-cap first (reject a runaway before touching disk).
  let buf: Buffer;
  try {
    buf = Buffer.from(opts.dataBase64, 'base64');
  } catch {
    return { error: 'invalid attachment data', status: 400 };
  }
  if (buf.length === 0) return { error: 'empty attachment', status: 400 };
  if (buf.length > MAX_ATTACHMENT_BYTES) return { error: 'attachment too large (max 10MB)', status: 413 };

  // Sanitize the name to a bare basename of a safe charset — no traversal, no
  // path separators, no leading dot. Length-capped; a default if it empties out.
  const raw = path.basename(String(opts.name ?? '')).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  const safe = (raw || 'file').slice(0, 80);
  const unique = `${crypto.randomUUID().slice(0, 8)}-${safe}`;

  // Target dir under the gitignored cache; keyed by work unit when present, else
  // by the session (lobby/shaping). Both segments are validated.
  const wu = opts.workUnit;
  if (wu && !validUnitName(wu)) return { error: 'work unit name refused', status: 400 };
  const bs = opts.bridgeSessionId;
  if (bs && !/^bs-[a-z0-9-]{1,40}$/i.test(bs)) return { error: 'session id refused', status: 400 };
  const cacheRoot = path.resolve(projectRoot, '.workflows', '.cache');
  const dir = wu
    ? path.join(cacheRoot, wu, 'attachments')
    : path.join(cacheRoot, '.uploads', bs ?? 'lobby');

  // Realpath containment: the resolved target must stay under `.cache/` even
  // after symlink resolution of any existing ancestor.
  const full = path.resolve(dir, unique);
  if (full !== path.join(dir, unique) || !full.startsWith(cacheRoot + path.sep)) {
    return { error: 'attachment path refused', status: 400 };
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    const realDir = fs.realpathSync(dir);
    if (!realDir.startsWith(fs.realpathSync(cacheRoot) + path.sep) && realDir !== fs.realpathSync(cacheRoot)) {
      return { error: 'attachment path refused', status: 400 };
    }
    fs.writeFileSync(full, buf, { flag: 'wx' }); // wx: never clobber (random prefix makes collision ~nil)
  } catch {
    return { error: 'could not store attachment', status: 500 };
  }
  return { path: path.relative(projectRoot, full) };
}

/** A comment target from a POST body (gateId or artifact). */
function bodyCommentTarget(body: Record<string, unknown>): CommentTarget | null {
  const gateId = body.gateId ? String(body.gateId) : '';
  if (/^[0-9a-f]{16}$/.test(gateId)) return { gateId };
  if (body.artifact) return { artifact: String(body.artifact) };
  return null;
}

function publicSessions(deps: ApiDeps, viewer: Human): unknown[] {
  if (!deps.sessions) return [];
  return deps.sessions.list().map((s) => ({
    bridgeSessionId: s.bridgeSessionId,
    address: s.address,
    state: s.state,
    // Enrich the open card with ownership + unread + external-resolution so the
    // queue overlay (which reads this route) shows the same ceremony as the
    // thread — a watcher's read-only state, the unread block (round-12 G4).
    openGate: s.openGate ? gateWithOwnership(deps, s.openGate, viewer) : null,
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

/**
 * The ownership + comment overlay for a gate card, for `viewer`. Returns the
 * card with owner/stuck/unread/canAnswer sibling fields the SPA reads to route
 * submit/watch and badge the card. Never mutates the card's engine-derived core.
 */
/** Durable resolving signals (phase.completed / workunit.status-changed) for a
 *  work unit — the "answered outside the UI" join source, read once per card. */
function externalResolutionOf(deps: ApiDeps, card: any): string | undefined {
  if (!deps.store || !card.address?.workUnit) return undefined;
  const durable = deps.store
    .readFrom(0)
    .filter(
      (e) =>
        (e.type === 'phase.completed' || e.type === 'workunit.status-changed') &&
        e.address.workUnit === card.address.workUnit,
    );
  return externallyResolvedAt(card, durable as any) ?? undefined;
}

function gateWithOwnership(deps: ApiDeps, card: any, viewer: Human): any {
  if (!deps.db) return card;
  const stuckMs = deps.stuckMs ?? 24 * 3600 * 1000;
  const unread = unreadForGate(deps.db, deps.project ?? '', card.id, viewer.id);
  const commentCount = countForGate(deps.db, deps.project ?? '', card.id);
  // "Answered outside the UI" applies on EVERY surface that shows the card
  // (thread, queue, channel) — not only the channel spine (round-12 G2).
  const extAt = externalResolutionOf(deps, card);
  const extFields = extAt ? { state: 'resolved-externally', resolvedExternallyAt: extAt } : {};
  // Ownership chrome is meaningful only with more than one human. In single-user
  // mode identity stays invisible (deliverable 1, zero-config) — no owner badge,
  // no watcher state, everyone can answer (round-12 intent finding). Comments
  // still attach (a solo user auto-reads their own, so unread is always 0).
  if (deps.identity?.mode !== 'github') {
    return { ...card, canAnswer: true, unreadComments: unread, commentCount, ...extFields };
  }
  const escalated = deps.isEscalated?.(card.id) ?? false;
  const info = ownerInfo(deps.db, card.id, { escalated, now: Date.now(), stuckMs });
  const perm = mayAnswer(deps.db, card.id, viewer.id, { escalated, now: Date.now(), stuckMs });
  return {
    ...card,
    owner: { id: info.ownerId, name: info.ownerName, stuck: info.stuck, isYou: info.ownerId === viewer.id },
    canAnswer: perm.ok,
    watching: !perm.ok,
    unreadComments: unread,
    commentCount,
    ...extFields,
  };
}

async function queueView(res: http.ServerResponse, deps: ApiDeps, viewer: Human): Promise<void> {
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
  // Overlay ownership + unread onto live (gate-bearing) rows. A stuck gate
  // surfaces in EVERYONE's queue (the "stuck — claim?" chip); a watcher's row
  // is marked so the SPA shows read-only. Ownership chrome is multiplayer-only
  // (single-user stays zero-config); unread still shows (0 in single-user).
  if (deps.db) {
    const stuckMs = deps.stuckMs ?? 24 * 3600 * 1000;
    const multiplayer = deps.identity?.mode === 'github';
    for (const row of rows as any[]) {
      if (row.tier !== 'live' || !row.gateId) continue;
      row.unreadComments = unreadForGate(deps.db, deps.project ?? '', row.gateId, viewer.id);
      if (!multiplayer) continue;
      const escalated = deps.isEscalated?.(row.gateId) ?? false;
      const info = ownerInfo(deps.db, row.gateId, { escalated, now: Date.now(), stuckMs });
      const perm = mayAnswer(deps.db, row.gateId, viewer.id, { escalated, now: Date.now(), stuckMs });
      row.owner = { id: info.ownerId, name: info.ownerName, isYou: info.ownerId === viewer.id };
      row.stuck = info.stuck;
      row.watching = !perm.ok;
    }
  }
  // Spec 5 default view = mine + unowned + stuck. In multiplayer, a live gate
  // owned by SOMEONE ELSE and not stuck is not in YOUR needs-you queue (round-12
  // G6). Single-user keeps everything (no ownership overlay ran). Durable rows
  // are never owner-filtered. `watching` is exactly others'-owned-non-stuck.
  const filtered =
    deps.identity?.mode === 'github'
      ? (rows as any[]).filter((r) => r.tier !== 'live' || !r.watching)
      : rows;
  send(res, 200, { rows: filtered });
}

async function handleMutation(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  // Attachment upload — read with a larger cap than other routes (a 10MB file's
  // base64 is ~14MB), handled BEFORE the generic 1MB readBody would destroy it.
  if (url.pathname === '/api/attachments') {
    const big = await readBody(req, MAX_ATTACHMENT_BYTES * 2);
    const result = writeAttachment(deps.projectRoot, {
      name: String(big.name ?? ''),
      dataBase64: String(big.dataBase64 ?? ''),
      workUnit: big.workUnit ? String(big.workUnit) : undefined,
      bridgeSessionId: big.bridgeSessionId ? String(big.bridgeSessionId) : undefined,
    });
    if ('error' in result) send(res, result.status, { error: result.error });
    else send(res, 200, result);
    return;
  }

  const body = await readBody(req);
  const human = currentHuman(deps, req);

  // Membership gate (github mode): "push access to the origin repo = member".
  // A non-member is a read-only WATCHER — they may sign out, but not answer,
  // claim, comment, or capture. UI-side routing only (the engine enforces
  // nothing; a member with terminal access always bypasses the UI). Single-user
  // is always the sentinel member, so this never fires there (round-12 D2).
  if (
    deps.identity?.mode === 'github' &&
    !human.member &&
    !['/api/login', '/api/logout', '/api/activity'].includes(url.pathname)
  ) {
    send(res, 403, { error: 'you have no push access to the origin repo — read-only watcher' });
    return;
  }

  // Advance the artifact read-ref — a deliberate, focused view, not a side
  // effect of every GET (round-10 finding). Per-human (Phase 6 multiplayer).
  const read = url.pathname.match(/^\/api\/artifact\/([^/]+)\/read$/);
  if (read && deps.db) {
    const wu = decodeURIComponent(read[1]!);
    const rel = String(body.path ?? '');
    if (validUnitName(wu) && rel.endsWith('.md') && !rel.split('/').includes('..')) {
      recordReadRef(deps.db, deps.projectRoot, wu, rel, human.id);
      send(res, 200, { ok: true });
    } else {
      send(res, 400, { error: 'artifact path refused' });
    }
    return;
  }

  // Activity signalling needs no session manager (a read-only mirror still
  // reports focus for suppression). It also beats the human's VIEWING presence
  // (Phase 6) — the channel is the focused thread (or '' for the lobby).
  if (url.pathname === '/api/activity') {
    deps.markActivity?.({
      appConnected: body.appConnected !== false,
      focusedThread: (body.focusedThread as string | null) ?? null,
      interaction: body.interaction === true,
    });
    if (deps.db && deps.project) {
      beatViewing(deps.db, deps.project, human.id, String(body.focusedThread ?? ''));
    }
    send(res, 200, { ok: true });
    return;
  }

  // --- Phase 6 auth (github mode) ------------------------------------------
  if (url.pathname === '/api/login') {
    if (!deps.identity) {
      send(res, 503, { error: 'auth unavailable' });
      return;
    }
    const result = await deps.identity.login(String(body.githubLogin ?? ''), body.token ? String(body.token) : undefined);
    if ('error' in result) {
      send(res, 400, { error: result.error });
      return;
    }
    // HttpOnly, SameSite=Strict, Path=/ — the cookie never reaches script and
    // never rides a cross-site request. Not Secure: the bridge is localhost.
    res.setHeader(
      'set-cookie',
      `${AUTH_COOKIE}=${result.cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`,
    );
    // A successful login is a successful login (200) — a non-member is
    // authenticated as a WATCHER, not rejected. Membership gates nothing at the
    // process level (it never can — the record has no owner); it only steers the
    // UI's own routing and the badge. Returning 403 with a working cookie was a
    // cosmetic contradiction (round-12): the non-member had a live session
    // regardless. The `member` flag + `warning` carry the truth.
    send(res, 200, {
      human: { id: result.human.id, name: result.human.name, member: result.human.member },
      ...(result.human.member ? {} : { warning: `${result.human.name} has no push access to the origin repo — you're a watcher` }),
    });
    return;
  }
  if (url.pathname === '/api/logout') {
    deps.identity?.logout(req.headers.cookie);
    res.setHeader('set-cookie', `${AUTH_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    send(res, 200, { ok: true });
    return;
  }

  // --- Phase 6 comments (never push; the ceremony gates the confirm) --------
  if (url.pathname === '/api/comments' && deps.db) {
    const target = commentTargetFromQuery(url) ?? (bodyCommentTarget(body));
    const bodyText = String(body.body ?? '').trim();
    if (!target || bodyText === '') {
      send(res, 400, { error: 'a target and non-empty body are required' });
      return;
    }
    const id = addComment(deps.db, deps.project ?? '', human.id, target, bodyText);
    send(res, 200, { id });
    return;
  }
  if (url.pathname === '/api/comments/read' && deps.db) {
    const target = bodyCommentTarget(body);
    if (!target) {
      send(res, 400, { error: 'a target is required' });
      return;
    }
    markTargetRead(deps.db, deps.project ?? '', target, human.id);
    send(res, 200, { ok: true });
    return;
  }

  // --- Phase 6 gate ownership (routing, not authority) ----------------------
  const claim = url.pathname.match(/^\/api\/gate\/([0-9a-f]{16})\/claim$/);
  if (claim && deps.db) {
    claimGate(deps.db, claim[1]!, human.id);
    send(res, 200, { ok: true, ownerId: human.id });
    return;
  }
  const claimChannel = url.pathname.match(/^\/api\/channel\/([^/]+)\/claim$/);
  if (claimChannel && deps.db) {
    const wu = decodeURIComponent(claimChannel[1]!);
    if (!validUnitName(wu)) {
      send(res, 400, { error: 'work unit name refused' });
      return;
    }
    reassignChannel(deps.db, deps.project ?? '', wu, human.id);
    send(res, 200, { ok: true, ownerId: human.id });
    return;
  }

  // --- Phase 6 capture gesture ---------------------------------------------
  if (url.pathname === '/api/capture') {
    if (!deps.capture) {
      send(res, 503, { error: 'capture unavailable (read-only mirror)' });
      return;
    }
    const kind = String(body.kind ?? 'idea') as CaptureKind;
    const payload = String(body.payload ?? '').trim();
    if (!['idea', 'bug', 'quickfix', 'roadmap'].includes(kind) || payload === '') {
      send(res, 400, { error: 'a kind and non-empty payload are required' });
      return;
    }
    // The route AWAITS the ephemeral session; the SPA has already shown its
    // optimistic toast, so this response is the reconcile. A failure is a
    // durable row, not an error the user must catch.
    // The bridge stamps the authenticated author onto provenance — so the
    // captured file's body carries the "who" on the happy path, not only when
    // the client happens to send it (round-12 G5). Client-supplied author is
    // overridden (attribution is the bridge's to assert, not the payload's).
    const clientProv = (body.provenance as any) ?? {};
    const result = await deps.capture.run({
      kind,
      payload,
      provenance: { source: 'bridge', ...clientProv, author: human.name },
      humanId: human.id,
    });
    send(res, 200, result);
    return;
  }
  const retry = url.pathname.match(/^\/api\/capture\/([^/]+)\/retry$/);
  if (retry && deps.capture) {
    send(res, 200, await deps.capture.retry(decodeURIComponent(retry[1]!)));
    return;
  }
  const discardCap = url.pathname.match(/^\/api\/capture\/([^/]+)\/discard$/);
  if (discardCap && deps.capture) {
    deps.capture.discard(decodeURIComponent(discardCap[1]!));
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
    // Record the launching human — the primary input to gate-ownership
    // precedence ("a gate a named human launched belongs to that human").
    if (deps.db) recordSessionDriver(deps.db, row.bridgeSessionId, human.id);
    // And seed the channel default owner (first-write-wins) so a gate this
    // session raises falls to a real owner even before anyone claims it.
    if (deps.db && deps.project && address.workUnit) ensureChannelDefault(deps.db, deps.project, address.workUnit, human.id);
    // A gate that opened synchronously on start gets its owner assigned now.
    if (deps.db && deps.project && row.openGate) assignOwnerOnOpen(deps.db, deps.project, row.openGate);
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
    // UI-origin attestation for typed-confirm gates (Phase 7 §1 / SEP-1865). In
    // an MCP host, tool arguments are MODEL-produced unless a UI gesture
    // originates the call — so a prompt injection could otherwise synthesize the
    // confirmation string for a never-auto gate. A typed-confirm answer is
    // accepted ONLY with an explicit `ui-gesture` attestation; a plain model
    // tool call (no attestation) is rejected with a deep link to the SPA. The
    // SPA answer is always a real gesture and attests. This is the SINGLE
    // enforcement point — the MCP server renders these read-only, and the bridge
    // is the backstop (the negative parity test targets exactly this). The gate's
    // confirm mode is looked up BY gateId (from the live card or the ledger) so
    // the guard never depends on how `holder` was resolved (round-13).
    const gateConfirm = confirmModeOf(deps, holder, gateId);
    if (gateConfirm === 'typed' && body.attestation !== 'ui-gesture') {
      send(res, 403, {
        error: 'this decision requires a typed confirmation from a UI gesture — answer it in the app',
        deepLink: `/s/${holder.bridgeSessionId}`,
        needsAttestation: true,
      });
      return;
    }
    // Ownership routing (UI-side, never process authority): a watcher's submit
    // is refused unless the owner is stuck. The engine enforces none of this —
    // a terminal answer bypasses it entirely (and resolves the card externally).
    if (deps.db) {
      const stuckMs = (deps.stuckMs ?? 24 * 3600 * 1000);
      const perm = mayAnswer(deps.db, gateId, human.id, {
        escalated: deps.isEscalated?.(gateId) ?? false,
        now: Date.now(),
        stuckMs,
      });
      if (!perm.ok) {
        send(res, 403, { error: perm.reason ?? 'not the gate owner' });
        return;
      }
      // The comment ceremony: a sign-off cannot be finalised over UNSEEN
      // comments on the gate (the walkthrough caught a blocking concern signed
      // over unseen). The human must open the thread (mark read) first.
      const unread = unreadForGate(deps.db, deps.project ?? '', gateId, human.id);
      if (unread > 0) {
        send(res, 409, { error: `${unread} unread comment${unread > 1 ? 's' : ''} on this gate — read them before answering`, unreadComments: unread });
        return;
      }
      noteOwnerActivity(deps.db, gateId, human.id);
    }
    // Provenance for the durable ledger: an MCP-host answer is recorded as
    // `mcp`, an SPA answer as `ui` — the audit trail can tell them apart even
    // though the answer is byte-identical (round-13). The MCP client sends
    // `via: 'mcp'`; the SPA sends nothing.
    const via = body.via === 'mcp' ? 'mcp' : 'ui';
    const result = await deps.sessions.answer(holder.bridgeSessionId, gateId, text, via);
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

function readBody(req: http.IncomingMessage, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > maxBytes) req.destroy();
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
    // Failed captures — a durable lobby row ("N captures failed — retry"), the
    // payload retained until it succeeds or is discarded (never a lost toast).
    failedCaptures: deps.capture ? deps.capture.list() : [],
    roadmap: roadmap?.exists
      ? { horizons: roadmap.horizons ?? [], totals: roadmap.totals ?? {}, itemCount: roadmap.totals?.items ?? 0 }
      : null,
    baseline: baseline ? { status: baseline.status ?? 'none' } : null,
  });
}

async function channelView(res: http.ServerResponse, deps: ApiDeps, wu: string, viewer: Human): Promise<void> {
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
    // gateWithOwnership carries owner/unread AND the "answered outside the UI"
    // join (round-12 G2 — every surface, not just the spine).
    for (const s of deps.sessions.list()) {
      const g = s.openGate;
      if (g && g.state === 'open' && g.address.workUnit === wu) {
        spine.push({
          id: g.id,
          type: 'gate.opened',
          ts: g.openedAt,
          address: g.address,
          payload: { card: gateWithOwnership(deps, g, viewer) },
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
  // Phase 6 presence, the two honest kinds: humans VIEWING (UI heartbeat) and
  // best-effort INFERRED working sessions for the non-heartbeat phases
  // (labelled inferred, never presented as certain).
  const humansHere = deps.db && deps.project ? humansViewing(deps.db, deps.project, wu, Date.now(), viewer.id) : [];
  const inferred = inferredWorkingSessions(projectRoot, wu, Date.now());

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
  const agentCounts = countAgents(projectRoot, wu, 'implementation');
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
    humansViewing: humansHere,
    inferredSessions: inferred,
    // Channel-wide agent activity (any phase) — deep-dives/perspectives in
    // research/discussion show here, not only implementation (round-11).
    agentsReading: countAgentsAllPhases(projectRoot, wu),
    telemetry,
    planFormat: planFormatOf(deps.projectRoot, manifest, workType === 'epic' ? undefined : wu),
  });
}

/**
 * The plan format for a SPECIFIC topic (its planning item's `format`), falling
 * back to the project default. `format` is per-topic — resolving it globally
 * would apply one topic's adapter to another (round-11 defect).
 */
function planFormatOf(projectRoot: string, manifest: Record<string, any>, topic?: string): string {
  const items = manifest.phases?.planning?.items ?? {};
  const item = topic ? items[topic] : undefined;
  if (item?.format) return String(item.format);
  try {
    const proj = JSON.parse(fs.readFileSync(path.join(projectRoot, '.workflows', 'manifest.json'), 'utf8'));
    return String(proj?.defaults?.plan_format ?? 'local-markdown');
  } catch {
    return 'local-markdown';
  }
}

/**
 * Count in-flight background agents for a work unit, keyed by (phase, topic).
 * The delivery telemetry only counts the IMPLEMENTATION phase's agents so a
 * stale discussion/review agent never inflates an unrelated topic's chip
 * (round-11 defect — was keyed by topic only). Returns per-topic counts
 * scoped to `phaseFilter`.
 */
function countAgents(projectRoot: string, wu: string, phaseFilter: string): Record<string, number> {
  const out: Record<string, number> = {};
  const base = path.join(projectRoot, '.workflows', '.cache', wu, phaseFilter);
  let topics: string[];
  try {
    topics = fs.readdirSync(base).filter((n) => !n.startsWith('.'));
  } catch {
    return out;
  }
  for (const topic of topics) {
    let state: any;
    try {
      state = JSON.parse(fs.readFileSync(path.join(base, topic, 'state.json'), 'utf8'));
    } catch {
      continue;
    }
    const inflight = Object.values(state?.agents ?? {}).filter((a: any) => a?.status === 'in-flight').length;
    if (inflight > 0) out[topic] = inflight;
  }
  return out;
}

/** All in-flight agents across the work unit (any phase) — the channel-wide
 *  "N reading" chip, so research/discussion deep-dives/perspectives show too. */
function countAgentsAllPhases(projectRoot: string, wu: string): number {
  const base = path.join(projectRoot, '.workflows', '.cache', wu);
  let total = 0;
  let phases: string[];
  try {
    phases = fs.readdirSync(base).filter((n) => !n.startsWith('.'));
  } catch {
    return 0;
  }
  for (const phase of phases) for (const [t, n] of Object.entries(countAgents(projectRoot, wu, phase))) { void t; total += n; }
  return total;
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

function artifactView(res: http.ServerResponse, deps: ApiDeps, wu: string, rel: string, humanId: string): void {
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
  const priorRef = deps.db ? readRef(deps.db, deps.projectRoot, artifactKey, humanId) : null;
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
