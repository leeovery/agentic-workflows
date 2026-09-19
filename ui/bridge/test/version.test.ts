import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { handshake, pendingMigrations } from '../src/version.js';

let dir: string;
let enginePath: string;

function gitEnv() {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-test-'));
  // The engine "install" — a git checkout with a version tag, migration dir
  // laid out like the product: skills/workflow-engine/scripts + skills/workflow-migrate.
  enginePath = path.join(dir, '.claude', 'skills', 'workflow-engine', 'scripts');
  fs.mkdirSync(enginePath, { recursive: true });
  const migrations = path.join(dir, '.claude', 'skills', 'workflow-migrate', 'scripts', 'migrations');
  fs.mkdirSync(migrations, { recursive: true });
  fs.writeFileSync(path.join(migrations, '001-first.sh'), '');
  fs.writeFileSync(path.join(migrations, '002-second.cjs'), '');
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'add', '-A'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'install'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'tag', 'v0.7.13'], { env: gitEnv() });
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('version handshake', () => {
  it('reads the product version from the git tag and reports full mode when current', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.state', 'migrations'), '001\n002\n');
    const h = handshake(dir, enginePath);
    expect(h.productVersion).toBe('v0.7.13');
    expect(h.supported).toBe(true);
    expect(h.pendingMigrations).toEqual([]);
    expect(h.mode).toBe('full');
    expect(h.bannerReasons).toEqual([]);
  });

  it('degrades to read-only with pending migrations named', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.state', 'migrations'), '001\n');
    const h = handshake(dir, enginePath);
    expect(h.pendingMigrations).toEqual(['002']);
    expect(h.mode).toBe('read-only');
    expect(h.bannerReasons.some((r) => r.includes('pending migration'))).toBe(true);
  });

  it('a pre-migration repo (workflows but no log) is read-only with ALL migrations pending', () => {
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    const { pending, logFound } = pendingMigrations(dir, enginePath);
    expect(logFound).toBe(false);
    expect(pending).toEqual(['001', '002']);
    expect(handshake(dir, enginePath).mode).toBe('read-only');
  });

  it('a project without .workflows/ has nothing pending (valid empty state)', () => {
    const { pending } = pendingMigrations(dir, enginePath);
    expect(pending).toEqual([]);
  });

  it('an unsupported version degrades to read-only', () => {
    execFileSync('git', ['-C', dir, 'tag', '-d', 'v0.7.13'], { env: gitEnv() });
    execFileSync('git', ['-C', dir, 'tag', 'v9.9.9'], { env: gitEnv() });
    fs.mkdirSync(path.join(dir, '.workflows', '.state'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.state', 'migrations'), '001\n002\n');
    const h = handshake(dir, enginePath);
    expect(h.supported).toBe(false);
    expect(h.mode).toBe('read-only');
  });

  it('an untagged install reports version unknown and degrades', () => {
    execFileSync('git', ['-C', dir, 'tag', '-d', 'v0.7.13'], { env: gitEnv() });
    const h = handshake(dir, enginePath);
    expect(h.productVersion).toBeNull();
    expect(h.versionSource).toBe('unknown');
    expect(h.mode).toBe('read-only');
  });
});
