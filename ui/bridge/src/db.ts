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
});

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
CREATE TABLE IF NOT EXISTS humans (id TEXT PRIMARY KEY, name TEXT NOT NULL, sentinel INTEGER NOT NULL DEFAULT 0);
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
  sqlite
    .prepare('INSERT OR IGNORE INTO humans (id, name, sentinel) VALUES (?, ?, 1)')
    .run(HUMAN_SENTINEL, 'You');
  return { sqlite, orm: drizzle(sqlite) };
}
