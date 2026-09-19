// Fixture goldens (spec 4 / phase-0 §6): the committed mid-discussion fixture
// restores, its spine reproduces the committed golden byte-for-byte, its
// journal validates against the shared schemas, and offline replay ends
// paused at the final recorded user-turn boundary.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { restoreWorld } from '../src/convert.js';
import { buildSpine } from '../src/spine.js';
import { Replayer } from '../src/replay.js';
import { JournalRecord, FixtureMeta, DomainEvent } from '@workflow-ui/shared';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
  'mid-discussion',
);

let tmp: string;
let world: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-test-'));
  world = restoreWorld(path.join(FIXTURE, 'worlds', '0'), path.join(tmp, 'w'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('mid-discussion fixture', () => {
  it('meta validates and records the product version and width pin', () => {
    const meta = FixtureMeta.parse(JSON.parse(fs.readFileSync(path.join(FIXTURE, 'meta.json'), 'utf8')));
    expect(meta.productVersion).toBe('v0.7.13');
    expect(meta.width).toBe(65);
    expect(meta.entryPrompt).toBe('/workflow-start');
  });

  it('every journal record validates against the shared schema', () => {
    const lines = fs
      .readFileSync(path.join(FIXTURE, 'transcript.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(100);
    for (const l of lines) expect(() => JournalRecord.parse(JSON.parse(l))).not.toThrow();
  });

  it('the world restores with the mid-session cache overlay (report with lanes)', () => {
    const report = path.join(world, '.workflows', '.cache', 'rate-limiting', 'discussion', 'rate-limiting', 'review-001.md');
    expect(fs.existsSync(report)).toBe(true);
    expect(fs.readFileSync(report, 'utf8')).toContain('**Lane:**');
    const manifest = JSON.parse(fs.readFileSync(path.join(world, '.workflows', 'rate-limiting', 'manifest.json'), 'utf8'));
    expect(manifest.work_type).toBe('feature');
  });

  it('spine(world) reproduces the committed golden event list (durable layer)', async () => {
    const golden = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'spine-golden-0.json'), 'utf8'));
    const spine = await buildSpine(world, 'mid-discussion');
    expect(spine.epoch).toBe(golden.epoch);
    expect(JSON.parse(JSON.stringify(spine.events))).toEqual(golden.events);
    for (const e of spine.events) {
      // Durable events validate once seq is assigned by the store.
      expect(() => DomainEvent.parse({ ...e, seq: 0 })).not.toThrow();
    }
  });

  it('offline replay streams the stage and ends paused at the final user-turn boundary', async () => {
    const r = new Replayer(FIXTURE, { paceMs: 0, offline: true });
    const pauses: any[] = [];
    r.on('paused', (p) => pauses.push(p));
    await r.run();
    expect(r.status().state).toBe('paused');
    expect(pauses.at(-1)?.final).toBe(true);
  }, 30_000);
});
