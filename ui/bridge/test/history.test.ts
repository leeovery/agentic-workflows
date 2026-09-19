import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileTimeline, whatMoved } from '../src/history.js';

let dir: string;
function git(...args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
  });
}
function write(rel: string, c: string) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), c);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  git('init', '-q', '-b', 'main');
  write('.workflows/wu/spec.md', '# v1\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'first');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('history lens', () => {
  it('lists a file timeline newest-first', () => {
    write('.workflows/wu/spec.md', '# v2\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'second');
    const t = fileTimeline(dir, '.workflows/wu/spec.md');
    expect(t).toHaveLength(2);
    expect(t[0]!.subject).toBe('second');
  });

  it('what-moved: unread diff from a recorded ref to HEAD', () => {
    const ref = git('rev-parse', 'HEAD').trim();
    write('.workflows/wu/spec.md', '# v1\n\n## Added\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'amend');
    const m = whatMoved(dir, '.workflows/wu/spec.md', ref, 'current');
    expect(m.state).toBe('unread');
    if (m.state === 'unread') expect(m.diff).toContain('Added');
  });

  it('what-moved: none when HEAD equals the ref', () => {
    const ref = git('rev-parse', 'HEAD').trim();
    expect(whatMoved(dir, '.workflows/wu/spec.md', ref, 'current').state).toBe('none');
  });

  it('what-moved: an unreachable/rewritten ref is LOST, never a wrong diff', () => {
    expect(whatMoved(dir, '.workflows/wu/spec.md', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'current').state).toBe('lost');
    const ref = git('rev-parse', 'HEAD').trim();
    expect(whatMoved(dir, '.workflows/wu/spec.md', ref, 'history-rewritten').state).toBe('lost');
  });

  it('rejects a leading-dash path (git-flag injection) and a non-hex ref', () => {
    expect(fileTimeline(dir, '--output=/tmp/x')).toEqual([]);
    expect(whatMoved(dir, '.workflows/wu/spec.md', '--upload-pack=evil', 'current').state).toBe('none');
    expect(whatMoved(dir, '-x', 'abc123def456', 'current').state).toBe('none');
  });
});
