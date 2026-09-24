// UI-native state — phase-0 §8. Workflow truth stays on disk; anything here is
// veneer (cursors, read refs, session-id maps, gate ledger, comments, digests,
// push ledger). Schema pinned now to spare Phases 3/4/6 migrations.
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import fs from 'node:fs';
import path from 'node:path';

// The single-user sentinel row Phase 6's auth maps onto (S7).
export const HUMAN_SENTINEL = 'local-human';

export const humans = sqliteTable('humans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sentinel: integer('sentinel', { mode: 'boolean' }).notNull().default(false),
  // Phase 6: the GitHub login this human authenticated as (null for the
  // sentinel). Membership = push access to the origin repo, re-checked at login.
  githubLogin: text('github_login'),
});

// Phase 6 auth sessions — a signed cookie references one of these rows. The
// member verdict is cached here at login (spec: "checked via the GitHub API at
// login, cached per auth session"); it never re-hits GitHub per request.
export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(), // the cookie value (random, opaque)
  humanId: text('human_id').notNull(),
  githubLogin: text('github_login'),
  member: integer('member', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
});

// Phase 6: which human launched/drives a bridge session — the primary input to
// gate-ownership precedence ("a gate raised by a session a named human launched
// or is driving belongs to that human"). UI-side routing only; the workflow
// process has no concept of it.
export const sessionDrivers = sqliteTable('session_drivers', {
  bridgeSessionId: text('bridge_session_id').primaryKey(),
  humanId: text('human_id').notNull(),
});

// Phase 6: the last time an owner touched a gate (opened its card, drafted).
// Owner-inactivity past T_stuck (config.stuckHours, 24h) surfaces the gate in
// everyone's queue with a "stuck — claim?" chip.
export const gateOwnerActivity = sqliteTable('gate_owner_activity', {
  gateId: text('gate_id').primaryKey(),
  ownerId: text('owner_id'),
  lastActivityAt: text('last_activity_at').notNull(),
});

// Phase 6: the channel default owner — "first authenticated human to open the
// channel" (first-write-wins), the ownership fallback when no session driver
// claims a gate. Reassignable per channel.
export const channelDefaults = sqliteTable(
  'channel_defaults',
  {
    project: text('project').notNull(),
    channel: text('channel').notNull(),
    ownerId: text('owner_id').notNull(),
    claimedAt: text('claimed_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.project, t.channel] })],
);

// Phase 6: humans currently VIEWING a channel (UI presence) — a heartbeat with
// a TTL. Distinct from workflow session heartbeats (sessions WORKING). Replaces
// Phase 3's provisional single-signal activity for the humans-viewing strip.
export const humanPresence = sqliteTable(
  'human_presence',
  {
    humanId: text('human_id').notNull(),
    project: text('project').notNull(),
    channel: text('channel').notNull(), // work unit, or '' for the lobby/global
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.humanId, t.project, t.channel] })],
);

// Phase 6: a capture gesture whose ephemeral session FAILED — retained UI-side
// as a durable lobby row ("N captures failed — retry"), never a vanishing
// toast. The payload is kept so a retry needs nothing from the user.
export const failedCaptures = sqliteTable('failed_captures', {
  id: text('id').primaryKey(),
  project: text('project').notNull(),
  humanId: text('human_id').notNull(),
  kind: text('kind').notNull(), // idea | bug | quickfix
  payload: text('payload').notNull(),
  provenance: text('provenance', { mode: 'json' }), // { source, gateId?, artifact?, messageSeq? }
  error: text('error'),
  failedAt: text('failed_at').notNull(),
});

// Phase 6: which comments a human has SEEN — the unread-on-the-confirm ceremony
// derives from (comments on this gate) minus (this human's reads).
export const commentReads = sqliteTable(
  'comment_reads',
  {
    humanId: text('human_id').notNull(),
    commentId: integer('comment_id').notNull(),
    readAt: text('read_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.humanId, t.commentId] })],
);

// Cursors are (epoch, seq) pairs — epoch change invalidates (spec 3).
export const streamCursors = sqliteTable(
  'stream_cursors',
  {
    humanId: text('human_id').notNull(),
    project: text('project').notNull(),
    channel: text('channel').notNull(),
    epoch: text('epoch').notNull(),
    seq: integer('seq').notNull(),
  },
  (t) => [primaryKey({ columns: [t.humanId, t.project, t.channel] })],
);

// Phase 4's diff base: HEAD at render. `state` flips to 'history-rewritten'
// when an epoch change makes the sha unreachable (visible degradation).
export const artifactReadRefs = sqliteTable(
  'artifact_read_refs',
  {
    humanId: text('human_id').notNull(),
    project: text('project').notNull(),
    artifact: text('artifact').notNull(),
    sha: text('sha').notNull(),
    state: text('state').notNull().default('current'), // current | history-rewritten
    renderedAt: text('rendered_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.humanId, t.project, t.artifact] })],
);

// The session-id map — explicitly blessed UI-native state (spec 2).
export const sessions = sqliteTable('sessions', {
  bridgeSessionId: text('bridge_session_id').primaryKey(),
  sdkSessionId: text('sdk_session_id'),
  bridgeId: text('bridge_id').notNull(),
  project: text('project').notNull(),
  address: text('address', { mode: 'json' }).notNull(),
  startedAt: text('started_at').notNull(),
  lastEventAt: text('last_event_at'),
  state: text('state').notNull().default('live'), // live | idle-at-ask | stalled | errored | dead
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
});

export const gateLedger = sqliteTable('gate_ledger', {
  gateId: text('gate_id').primaryKey(),
  bridgeSessionId: text('bridge_session_id').notNull(),
  askOrdinal: integer('ask_ordinal').notNull(),
  card: text('card', { mode: 'json' }).notNull(),
  state: text('state').notNull(),
  ownerId: text('owner_id'),
  openedAt: text('opened_at').notNull(),
  resolvedAt: text('resolved_at'),
  resolution: text('resolution', { mode: 'json' }),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  humanId: text('human_id').notNull(),
  project: text('project').notNull(),
  gateId: text('gate_id'),
  artifact: text('artifact'),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
  // Comments ride the durable counter (EVENTS.md `comment.added`).
  seq: integer('seq'),
});

export const digests = sqliteTable('digests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  project: text('project').notNull(),
  channel: text('channel').notNull(),
  emittedAt: text('emitted_at').notNull(),
  body: text('body', { mode: 'json' }).notNull(),
});

// Durable push ledger (spec 5): a bridge restart re-pushes nothing.
export const pushLedger = sqliteTable(
  'push_ledger',
  {
    rowKey: text('row_key').notNull(), // queue row id / drain id
    kind: text('kind').notNull(), // push | alert | drain-announce
    decidedAt: text('decided_at').notNull(),
    contentHash: text('content_hash').notNull().default(''),
  },
  (t) => [primaryKey({ columns: [t.rowKey, t.kind] })],
);

// Durable event log: seq assigned once, persisted, never re-assigned; a
// restart continues the counter (spec 3).
export const eventLog = sqliteTable(
  'event_log',
  {
    project: text('project').notNull(),
    epoch: text('epoch').notNull(),
    seq: integer('seq').notNull(),
    eventId: text('event_id').notNull(),
    body: text('body', { mode: 'json' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.project, t.seq] })],
);

export const projectMeta = sqliteTable('project_meta', {
  project: text('project').primaryKey(),
  epoch: text('epoch').notNull(),
  lastSeq: integer('last_seq').notNull().default(-1),
  spineTip: text('spine_tip'),
});

const DDL = `
CREATE TABLE IF NOT EXISTS humans (id TEXT PRIMARY KEY, name TEXT NOT NULL, sentinel INTEGER NOT NULL DEFAULT 0, github_login TEXT);
CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, human_id TEXT NOT NULL, github_login TEXT, member INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS session_drivers (bridge_session_id TEXT PRIMARY KEY, human_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gate_owner_activity (gate_id TEXT PRIMARY KEY, owner_id TEXT, last_activity_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS channel_defaults (project TEXT NOT NULL, channel TEXT NOT NULL, owner_id TEXT NOT NULL, claimed_at TEXT NOT NULL, PRIMARY KEY (project, channel));
CREATE TABLE IF NOT EXISTS human_presence (human_id TEXT NOT NULL, project TEXT NOT NULL, channel TEXT NOT NULL, last_seen_at TEXT NOT NULL, PRIMARY KEY (human_id, project, channel));
CREATE TABLE IF NOT EXISTS failed_captures (id TEXT PRIMARY KEY, project TEXT NOT NULL, human_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, provenance TEXT, error TEXT, failed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS comment_reads (human_id TEXT NOT NULL, comment_id INTEGER NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY (human_id, comment_id));
CREATE TABLE IF NOT EXISTS stream_cursors (human_id TEXT NOT NULL, project TEXT NOT NULL, channel TEXT NOT NULL, epoch TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (human_id, project, channel));
CREATE TABLE IF NOT EXISTS artifact_read_refs (human_id TEXT NOT NULL, project TEXT NOT NULL, artifact TEXT NOT NULL, sha TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'current', rendered_at TEXT NOT NULL, PRIMARY KEY (human_id, project, artifact));
CREATE TABLE IF NOT EXISTS sessions (bridge_session_id TEXT PRIMARY KEY, sdk_session_id TEXT, bridge_id TEXT NOT NULL, project TEXT NOT NULL, address TEXT NOT NULL, started_at TEXT NOT NULL, last_event_at TEXT, state TEXT NOT NULL DEFAULT 'live', input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS gate_ledger (gate_id TEXT PRIMARY KEY, bridge_session_id TEXT NOT NULL, ask_ordinal INTEGER NOT NULL, card TEXT NOT NULL, state TEXT NOT NULL, owner_id TEXT, opened_at TEXT NOT NULL, resolved_at TEXT, resolution TEXT);
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, human_id TEXT NOT NULL, project TEXT NOT NULL, gate_id TEXT, artifact TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL, seq INTEGER);
CREATE TABLE IF NOT EXISTS digests (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT NOT NULL, channel TEXT NOT NULL, emitted_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_ledger (row_key TEXT NOT NULL, kind TEXT NOT NULL, decided_at TEXT NOT NULL, content_hash TEXT NOT NULL DEFAULT '', PRIMARY KEY (row_key, kind));
CREATE TABLE IF NOT EXISTS event_log (project TEXT NOT NULL, epoch TEXT NOT NULL, seq INTEGER NOT NULL, event_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (project, seq));
CREATE INDEX IF NOT EXISTS event_log_by_id ON event_log (project, event_id);
CREATE TABLE IF NOT EXISTS project_meta (project TEXT PRIMARY KEY, epoch TEXT NOT NULL, last_seq INTEGER NOT NULL DEFAULT -1, spine_tip TEXT);
`;

export type Db = { sqlite: Database.Database; orm: BetterSQLite3Database };

export function openDb(stateDir: string, file = 'bridge.db'): Db {
  fs.mkdirSync(stateDir, { recursive: true });
  const sqlite = new Database(path.join(stateDir, file));
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(DDL);
  // A pre-Phase-6 db has `humans` without github_login — CREATE TABLE IF NOT
  // EXISTS won't add it. Guarded ALTER (SQLite has no ADD COLUMN IF NOT EXISTS).
  const humanCols = sqlite.prepare("PRAGMA table_info('humans')").all() as { name: string }[];
  if (!humanCols.some((c) => c.name === 'github_login')) {
    sqlite.exec('ALTER TABLE humans ADD COLUMN github_login TEXT');
  }
  sqlite
    .prepare('INSERT OR IGNORE INTO humans (id, name, sentinel) VALUES (?, ?, 1)')
    .run(HUMAN_SENTINEL, 'You');
  return { sqlite, orm: drizzle(sqlite) };
}
