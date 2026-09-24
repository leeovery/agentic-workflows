import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db, HUMAN_SENTINEL } from '../src/db.js';
import { EventStore } from '../src/store.js';
import type { RawEvent } from '../src/derive.js';

let dir: string;
let db: Db;
let store: EventStore;

function ev(id: string, type = 'commit.landed'): RawEvent {
  return {
    id,
    epoch: 'e1',
    ts: '2026-08-26T10:00:00Z',
    project: 'demo',
    type,
    address: {},
    payload: {},
  };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
  db = openDb(dir);
  store = new EventStore(db, 'demo');
  store.setMeta('e1', 'tip1');
});

afterEach(() => {
  db.sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('EventStore', () => {
  it('seeds the single-user sentinel human row', () => {
    const row = db.sqlite.prepare('SELECT * FROM humans WHERE id = ?').get(HUMAN_SENTINEL) as any;
    expect(row?.sentinel).toBe(1);
  });

  it('assigns monotonic seq once and skips duplicate ids (at-least-once, idempotent)', () => {
    const first = store.append([ev('a'.repeat(16)), ev('b'.repeat(16))]);
    expect(first.map((e) => e.seq)).toEqual([0, 1]);
    const second = store.append([ev('b'.repeat(16)), ev('c'.repeat(16))]);
    expect(second.map((e) => e.seq)).toEqual([2]);
    expect(store.readFrom(0)).toHaveLength(3);
  });

  it('a restart continues the counter', () => {
    store.append([ev('a'.repeat(16))]);
    db.sqlite.close();
    db = openDb(dir);
    const reopened = new EventStore(db, 'demo');
    const more = reopened.append([ev('d'.repeat(16))]);
    expect(more[0]?.seq).toBe(1);
  });

  it('epoch change invalidates cursors, marks unreachable read refs, keeps the counter', () => {
    store.append([ev('a'.repeat(16))]);
    db.sqlite
      .prepare('INSERT INTO stream_cursors (human_id, project, channel, epoch, seq) VALUES (?, ?, ?, ?, ?)')
      .run(HUMAN_SENTINEL, 'demo', 'auth-flow', 'e1', 0);
    db.sqlite
      .prepare('INSERT INTO artifact_read_refs (human_id, project, artifact, sha, rendered_at) VALUES (?, ?, ?, ?, ?)')
      .run(HUMAN_SENTINEL, 'demo', 'a.md', 'deadbeef', 'now');

    store.onEpochChange('e2', 'tip2', () => false);

    expect(db.sqlite.prepare('SELECT COUNT(*) as n FROM stream_cursors').get()).toEqual({ n: 0 });
    const ref = db.sqlite.prepare('SELECT state FROM artifact_read_refs').get() as any;
    expect(ref.state).toBe('history-rewritten');
    // Counter continues — the next event gets seq 1, never a reused 0.
    const next = store.append([ev('e'.repeat(16))]);
    expect(next[0]?.seq).toBe(1);
    expect(store.meta()?.epoch).toBe('e2');
  });

  it('reachable read refs stay current across an epoch change', () => {
    db.sqlite
      .prepare('INSERT INTO artifact_read_refs (human_id, project, artifact, sha, rendered_at) VALUES (?, ?, ?, ?, ?)')
      .run(HUMAN_SENTINEL, 'demo', 'a.md', 'cafebabe', 'now');
    store.onEpochChange('e2', 'tip2', (sha) => sha === 'cafebabe');
    const ref = db.sqlite.prepare('SELECT state FROM artifact_read_refs').get() as any;
    expect(ref.state).toBe('current');
  });
});
