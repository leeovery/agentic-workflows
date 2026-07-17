'use strict';

// `knowledge init --keyword-only` — the non-interactive project init boot
// self-serves with. Spawns the src CLI entry against isolated temp projects
// (bundle currency is test-knowledge-build.sh's concern).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '../../src/knowledge/index.js');

let root;
let project;
let fakeHome;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-init-'));
  project = path.join(root, 'project');
  fs.mkdirSync(path.join(project, '.workflows'), { recursive: true });
  // Isolate from the developer's real ~/.config/workflows.
  fakeHome = path.join(root, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function run(args, cwd = project) {
  return spawnSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: fakeHome, OPENAI_API_KEY: '' },
  });
}

function kbPath(...rest) {
  return path.join(project, '.workflows', '.knowledge', ...rest);
}

describe('knowledge init --keyword-only', () => {
  it('initialises a fresh project: dir, empty config, empty store, keyword-only metadata', () => {
    const res = run(['init', '--keyword-only']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.match(res.stdout, /initialised keyword-only/);

    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(kbPath('config.json'), 'utf8')),
      { knowledge: {} }
    );
    assert.ok(fs.existsSync(kbPath('store.msp')));
    const meta = JSON.parse(fs.readFileSync(kbPath('metadata.json'), 'utf8'));
    assert.strictEqual(meta.provider, null);
    assert.strictEqual(meta.model, null);
    assert.strictEqual(meta.dimensions, null);
    assert.deepStrictEqual(meta.pending, []);

    // The store check now passes — the whole point of the auto-init.
    const check = run(['check']);
    assert.strictEqual(check.status, 0);
    assert.strictEqual(check.stdout.trim(), 'ready');
  });

  it('is idempotent: a second run is an already-initialised no-op', () => {
    assert.strictEqual(run(['init', '--keyword-only']).status, 0);
    const before = fs.readFileSync(kbPath('store.msp'));

    const res = run(['init', '--keyword-only']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(res.stdout.trim(), 'already-initialised');
    assert.ok(before.equals(fs.readFileSync(kbPath('store.msp'))), 'store untouched');
  });

  it('requires the --keyword-only flag', () => {
    const res = run(['init']);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /Usage: knowledge init --keyword-only/);
  });

  it('fills in only the missing files on a partial init, preserving the existing config', () => {
    fs.mkdirSync(kbPath(), { recursive: true });
    fs.writeFileSync(kbPath('config.json'), '{"knowledge":{"similarity_threshold":0.5}}\n');

    const res = run(['init', '--keyword-only']);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(kbPath('config.json'), 'utf8')),
      { knowledge: { similarity_threshold: 0.5 } }
    );
    assert.ok(fs.existsSync(kbPath('store.msp')));
    assert.ok(fs.existsSync(kbPath('metadata.json')));
  });

  it('refuses the unrecoverable partial state: store present, metadata missing', () => {
    fs.mkdirSync(kbPath(), { recursive: true });
    fs.writeFileSync(kbPath('store.msp'), 'orphan-store\n');

    const res = run(['init', '--keyword-only']);
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /store\.msp is present but metadata\.json is missing/);
    assert.match(res.stderr, /knowledge rebuild/);
    assert.ok(!fs.existsSync(kbPath('metadata.json')), 'nothing written');
  });

  it('creates .workflows/.knowledge at cwd when no .workflows exists yet', () => {
    const bare = path.join(root, 'bare');
    fs.mkdirSync(bare, { recursive: true });

    const res = run(['init', '--keyword-only'], bare);
    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(path.join(bare, '.workflows', '.knowledge', 'store.msp')));
  });
});
