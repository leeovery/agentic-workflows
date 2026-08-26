// Watcher integration: live snapshot diffs between commits, durable
// increments on HEAD movement, live-layer superseding, epoch-change signal on
// non-fast-forward movement.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { buildSpine } from '../src/spine.js';
import { Watcher } from '../src/watch.js';
import type { RawEvent } from '../src/derive.js';

let dir: string;
let watcher: Watcher | null = null;

function sh(args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-08-26T10:00:00Z',
      GIT_COMMITTER_DATE: '2026-08-26T10:00:00Z',
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
}

function write(rel: string, content: string): void {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function manifest(status: string, itemStatus: string): string {
  return JSON.stringify({
    name: 'auth-flow',
    work_type: 'feature',
    status,
    phases: { discussion: { items: { 'auth-flow': { status: itemStatus } } } },
  });
}

function waitFor<T>(collect: () => T | undefined, ms = 8000, step = 100): Promise<T> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const v = collect();
      if (v !== undefined) return resolve(v);
      if (Date.now() - start > ms) return reject(new Error('waitFor timeout'));
      setTimeout(tick, step);
    };
    tick();
  });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-test-'));
  sh(['init', '-q', '-b', 'main']);
  write('.workflows/auth-flow/manifest.json', manifest('in-progress', 'in-progress'));
  sh(['add', '-A']);
  sh(['commit', '-q', '-m', 'seed']);
});

afterEach(async () => {
  await watcher?.close();
  watcher = null;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function startWatcher(): Promise<{ live: RawEvent[]; durable: RawEvent[]; epochChanges: string[] }> {
  const spine = await buildSpine(dir, 'demo');
  const head = sh(['rev-parse', 'HEAD']).trim();
  watcher = new Watcher(dir, 'demo', spine.epoch, { tree: spine.lastTree, snap: spine.lastSnapshot, head });
  const live: RawEvent[] = [];
  const durable: RawEvent[] = [];
  const epochChanges: string[] = [];
  watcher.on('live', (es: RawEvent[]) => live.push(...es));
  watcher.on('durable', (es: RawEvent[]) => durable.push(...es));
  watcher.on('epoch-change', ({ reason }: { reason: string }) => epochChanges.push(reason));
  watcher.start();
  return { live, durable, epochChanges };
}

describe('Watcher', () => {
  it('emits live events for uncommitted manifest changes, then durable on commit supersedes', async () => {
    const { live, durable } = await startWatcher();

    write('.workflows/auth-flow/manifest.json', manifest('in-progress', 'completed'));
    const liveDone = await waitFor(() =>
      live.find((e) => e.type === 'phase.completed' && e.live === true),
    );
    expect(liveDone.payload).toEqual({ phase: 'discussion', topic: 'auth-flow' });
    expect(liveDone.seq).toBeUndefined();

    sh(['add', '-A']);
    sh(['commit', '-q', '-m', 'feat: discussion concluded']);
    const durableDone = await waitFor(() =>
      durable.find((e) => e.type === 'phase.completed'),
    );
    expect(durableDone.live).toBeUndefined();
    const commitLanded = await waitFor(() => durable.find((e) => e.type === 'commit.landed'));
    expect((commitLanded.payload as any).subject).toBe('feat: discussion concluded');
    expect((commitLanded.payload as any).scope).toEqual(['auth-flow']);
  });

  it('signals epoch-change on non-fast-forward HEAD movement instead of emitting removals', async () => {
    const { durable, epochChanges } = await startWatcher();
    sh(['checkout', '-q', '-b', 'other']);
    write('.workflows/other-unit/manifest.json', JSON.stringify({ name: 'other-unit', work_type: 'feature', status: 'in-progress' }));
    sh(['add', '-A']);
    sh(['commit', '-q', '-m', 'other work']);
    await waitFor(() => (durable.some((e) => e.type === 'workunit.created') ? true : undefined));
    // Jump back — a non-fast-forward movement (mass disappearance).
    sh(['checkout', '-q', 'main']);
    await waitFor(() => (epochChanges.length > 0 ? true : undefined));
    expect(durable.some((e) => e.type === 'workunit.removed')).toBe(false);
  });
});
