// CLI composition smoke tests — the entrypoint wiring the reviews found
// untested: boot on a pending-migration repo produces the read-only banner
// state over a real HTTP surface, not events.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BRIDGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4890;

let dir: string;
let child: ChildProcess | null = null;

function gitEnv() {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  };
}

async function waitForHealth(port: number, ms = 20_000): Promise<any> {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      return await res.json();
    } catch {
      if (Date.now() - start > ms) throw new Error('bridge never answered /health');
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  // An "installed product" with one migration the project has not run.
  const engine = path.join(dir, '.claude', 'skills', 'workflow-engine', 'scripts');
  fs.mkdirSync(engine, { recursive: true });
  fs.writeFileSync(path.join(engine, 'lib.cjs'), 'module.exports = {};\n');
  const migrations = path.join(dir, '.claude', 'skills', 'workflow-migrate', 'scripts', 'migrations');
  fs.mkdirSync(migrations, { recursive: true });
  fs.writeFileSync(path.join(migrations, '001-x.cjs'), '');
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'add', '-A'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'seed'], { env: gitEnv() });
  execFileSync('git', ['-C', dir, 'tag', 'v0.7.13'], { env: gitEnv() });
});

afterAll(() => {
  child?.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('bridge CLI', () => {
  it('a pending-migration repo boots read-only: banner reasons, zero events, no watcher writes', async () => {
    const stateDir = path.join(dir, 'state');
    child = spawn(
      'node',
      ['--import', 'tsx', path.join(BRIDGE, 'src', 'cli.ts'), '--project', dir, '--state-dir', stateDir, '--port', String(PORT)],
      { cwd: BRIDGE, stdio: 'ignore' },
    );
    const health = await waitForHealth(PORT);
    expect(health.bridgeMode).toBe('read-only');
    expect(health.bannerReasons.some((r: string) => r.includes('pending migration'))).toBe(true);
    expect(health.eventsStored).toBe(0);

    const events = await fetch(`http://127.0.0.1:${PORT}/events`, {
      signal: AbortSignal.timeout(1500),
    })
      .then((r) => r.text())
      .catch((e) => (String(e).includes('Timeout') || String(e).includes('abort') ? '' : Promise.reject(e)));
    expect(events).not.toContain('"type"');

    // The bridge never wrote into .workflows/.
    const entries = fs.readdirSync(path.join(dir, '.workflows'));
    expect(entries).toEqual([]);
  }, 40_000);

  it('a cross-origin POST to /replay/step-shaped routes is refused', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/replay/step`, {
      method: 'POST',
      headers: { origin: 'http://evil.example' },
    });
    // In live mode the route doesn't exist (404); the point is it never 204s
    // for a cross-origin caller.
    expect([403, 404]).toContain(res.status);
  });
});
