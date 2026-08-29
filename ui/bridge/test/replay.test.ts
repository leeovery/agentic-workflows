// Replay semantics (spec 4, Phase 0 form) — unit-tested against a
// test-local synthetic journal (test code, not a committed fixture; recorded
// fixtures are never hand-edited).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Replayer } from '../src/replay.js';

let dir: string;

function makeFixture(records: unknown[], answers: Record<string, unknown> = {}): string {
  const f = path.join(dir, 'fx');
  fs.rmSync(f, { recursive: true, force: true });
  fs.mkdirSync(f, { recursive: true });
  fs.writeFileSync(
    path.join(f, 'meta.json'),
    JSON.stringify({
      productVersion: 'v0.0.0-test',
      recordedAt: 't',
      width: 65,
      entryPrompt: '/workflow-start',
      description: 'synthetic',
      moments: [],
    }),
  );
  fs.writeFileSync(path.join(f, 'transcript.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(f, 'answers.json'), JSON.stringify(answers));
  return f;
}

// A mid-flight capture: ends on an assistant-side tail (a pending gate),
// outcome interrupted — the mid-discussion fixture's shape.
const midFlight = [
  { record: 'meta', bridgeSessionId: 'bs', width: 65, entryPrompt: '/workflow-start', recordedAt: 't' },
  { record: 'user', text: '/workflow-start' },
  { record: 'assistant', text: 'menu shown' },
  { record: 'turn-end', turn: 1 },
  { record: 'user', text: '2' },
  { record: 'assistant', text: 'continuing' },
  { record: 'turn-end', turn: 2 },
  { record: 'user', text: 'rate limiting please' },
  { record: 'assistant', text: 'pending gate emitted' },
  { record: 'turn-end', turn: 3 },
  { record: 'result', outcome: 'interrupted' },
];

// A completed session recording.
const completed = [...midFlight.slice(0, -1), { record: 'result', outcome: 'completed' }];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Replayer', () => {
  it('pauses at each answer boundary and ends PAUSED at the final boundary of a mid-flight capture', async () => {
    const r = new Replayer(makeFixture(midFlight), { paceMs: 0 });
    const pauses: any[] = [];
    r.on('paused', (p) => {
      pauses.push(p);
      if (!p.final) r.step();
    });
    await r.run();
    expect(pauses.map((p) => p.final)).toEqual([false, false, true]);
    expect(r.status().state).toBe('paused'); // never 'ended' — Phase 2 adopt continues
  });

  it('a completed-session recording ends ended, not paused', async () => {
    const r = new Replayer(makeFixture(completed), { paceMs: 0 });
    r.on('paused', (p) => {
      if (!p.final) r.step();
    });
    await r.run();
    expect(r.status().state).toBe('ended');
  });

  it('offline mode consumes scripted answers and still ends paused at the final boundary', async () => {
    const r = new Replayer(
      makeFixture(midFlight, { 'turn:2': { answer: '2', matchMode: 'key' } }),
      { paceMs: 0, offline: true },
    );
    const pauses: any[] = [];
    r.on('paused', (p) => pauses.push(p));
    await r.run();
    expect(pauses).toEqual([{ atTurn: 4, final: true }]);
    expect(r.status().state).toBe('paused');
  });

  it('offline mode fails the run on an answer mismatch (exact)', async () => {
    const r = new Replayer(
      makeFixture(midFlight, { 'turn:2': { answer: '3', matchMode: 'exact' } }),
      { paceMs: 0, offline: true },
    );
    await expect(r.run()).rejects.toThrow(/answer mismatch/);
  });

  it('streams every record including the pending-gate tail', async () => {
    const r = new Replayer(makeFixture(midFlight), { paceMs: 0 });
    const seen: string[] = [];
    r.on('record', (rec) => seen.push(rec.record));
    r.on('paused', (p) => {
      if (!p.final) r.step();
    });
    await r.run();
    expect(seen).toEqual(midFlight.map((r: any) => r.record));
  });
});
