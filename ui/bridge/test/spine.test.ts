// Spine integration: build a synthetic .workflows/ git history and assert the
// derived durable stream — including the restart property (byte-equal event
// list) and epoch behaviour under history rewrites.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { buildSpine } from '../src/spine.js';

let dir: string;

function sh(args: string[], cwd = dir): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function write(rel: string, content: string): void {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function commit(msg: string): string {
  sh(['add', '-A']);
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', msg], {
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
  return sh(['rev-parse', 'HEAD']).trim();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-test-'));
  sh(['init', '-q', '-b', 'main']);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function seedHistory(): void {
  write('.workflows/manifest.json', JSON.stringify({ work_units: { 'auth-flow': {} } }));
  write(
    '.workflows/auth-flow/manifest.json',
    JSON.stringify({
      name: 'auth-flow',
      work_type: 'feature',
      status: 'in-progress',
      phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } },
    }),
  );
  commit('feat: start auth-flow');

  write('.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n\nSome substance.\n');
  commit('docs: discussion progress');

  write(
    '.workflows/auth-flow/manifest.json',
    JSON.stringify({
      name: 'auth-flow',
      work_type: 'feature',
      status: 'in-progress',
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'in-progress', sources: { 'auth-flow': { status: 'pending' } } } } },
      },
    }),
  );
  commit('feat: discussion concluded, spec started');
}

describe('buildSpine', () => {
  it('derives the durable stream from history with commit timestamps', async () => {
    seedHistory();
    const { events, epoch } = await buildSpine(dir, 'demo');
    const types = events.map((e) => e.type);
    expect(types).toContain('workunit.created');
    expect(types).toContain('artifact.updated');
    expect(types).toContain('phase.completed');
    expect(types.filter((t) => t === 'commit.landed')).toHaveLength(3);
    expect(epoch).toMatch(/^[0-9a-f]{32}$/);
    for (const e of events) {
      expect(e.ts).toBe('2026-08-26T10:00:00Z'); // introducing commit's author date
      expect(e.epoch).toBe(epoch);
      expect(e.live).toBeUndefined();
    }
    const created = events.find((e) => e.type === 'workunit.created');
    expect(created?.payload).toEqual({ workType: 'feature', name: 'auth-flow' });
  });

  it('restart rebuilds an identical spine (byte-equal event list)', async () => {
    seedHistory();
    const a = await buildSpine(dir, 'demo');
    const b = await buildSpine(dir, 'demo');
    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));
    expect(b.epoch).toBe(a.epoch);
  });

  it('a history rewrite changes the epoch', async () => {
    seedHistory();
    const before = await buildSpine(dir, 'demo');
    // Amend the tip — a non-fast-forward rewrite.
    write('.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n\nRewritten.\n');
    sh(['add', '-A']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '--amend', '-m', 'rewritten'], {
      env: { ...process.env, GIT_COMMITTER_DATE: '2026-08-26T11:00:00Z', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
    });
    const after = await buildSpine(dir, 'demo');
    expect(after.epoch).not.toBe(before.epoch);
  });

  it('net-effect semantics: a squashed branch attributes net evolution to one commit', async () => {
    seedHistory();
    // Simulate a branch whose intermediate states never hit first-parent
    // history: jump the item straight from in-progress to completed with a
    // reopen in between squashed away — only the net transition appears.
    write(
      '.workflows/auth-flow/manifest.json',
      JSON.stringify({
        name: 'auth-flow',
        work_type: 'feature',
        status: 'completed',
        phases: {
          discussion: { items: { 'auth-flow': { status: 'completed' } } },
          specification: { items: { 'auth-flow': { status: 'completed', sources: { 'auth-flow': { status: 'incorporated' } } } } },
        },
      }),
    );
    commit('squash: everything lands at once');
    const { events } = await buildSpine(dir, 'demo');
    const specEvents = events.filter((e) => e.type === 'phase.completed' && (e.payload as any).phase === 'specification');
    expect(specEvents).toHaveLength(1);
  });

  it('an empty repo yields an empty spine and a stable epoch', async () => {
    commit1EmptyRepo();
    const { events, epoch } = await buildSpine(dir, 'demo');
    expect(events).toEqual([]);
    expect(epoch).toMatch(/^[0-9a-f]{32}$/);
  });
});

function commit1EmptyRepo(): void {
  write('README.md', 'no workflows here');
  commit('init');
}
