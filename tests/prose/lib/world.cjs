'use strict';

// World builder — materialise a fixture into a live, parallel-safe fake
// project a walker agent can work in as if it were a real install:
//
//   1. copy the fixture snapshot in (unescaping .gitignore files),
//   2. copy the repo's current skills/ and agents/ to the installed
//      layout (.claude/skills, .claude/agents) so prose paths resolve,
//   3. git init + commit (hermetic identity — no user config leaks),
//   4. `knowledge setup --keyword-only` — re-derives the keyword index
//      from the snapshot's artifacts (the binary store is never
//      snapshotted), leaving every entry skill's knowledge gate green.
//
// Worlds run on the REAL clock: walker runs are live sessions, never
// byte-compared. Mutations during a walk land here and nowhere else.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const fixtures = require('./fixtures.cjs');

const WORLD_PREFIX = 'prose-world-';

function worldEnv() {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
}

function buildWorld(fixtureName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), WORLD_PREFIX));
  const env = worldEnv();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env });

  fixtures.materialiseSnapshot(fixtureName, dir);

  for (const layer of ['skills', 'agents']) {
    const src = path.join(fixtures.ROOT, layer);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(dir, '.claude', layer), { recursive: true });
    }
  }

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'prose@example.com');
  git('config', 'user.name', 'Prose World');
  git('config', 'commit.gpgsign', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', `world: ${fixtureName}`);

  const knowledge = path.join(dir, '.claude/skills/workflow-knowledge/scripts/knowledge.cjs');
  const setup = spawnSync('node', [knowledge, 'setup', '--keyword-only'],
    { cwd: dir, encoding: 'utf8', env });
  if (setup.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`knowledge setup failed in world:\nstdout: ${setup.stdout}\nstderr: ${setup.stderr}`);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'chore(knowledge): initialise store');

  return dir;
}

function destroyWorld(dir) {
  if (!path.basename(dir).startsWith(WORLD_PREFIX)) {
    throw new Error(`refusing to remove non-world directory: ${dir}`);
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

module.exports = { buildWorld, destroyWorld, WORLD_PREFIX };
