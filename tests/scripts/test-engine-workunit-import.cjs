'use strict';

// `engine workunit import` — the mid-session landing: a file the user shares
// after the opener, copied into the work unit's one imports home with the
// origin of the session that took it, indexed when it is markdown, committed
// confined to the imports directory and the manifest.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REAL_SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');

// Hermetic git: no user/system config leaks into fixtures or the engine's
// spawned git subprocesses.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// Stub knowledge CLI: records each invocation to knowledge-calls.log in the
// project cwd; failure is env-driven.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
fs.appendFileSync('knowledge-calls.log', process.argv.slice(2).join(' ') + '\\n');
if (process.env.STUB_KNOWLEDGE_EXIT) {
  process.stderr.write('kb exploded\\n');
  process.exit(parseInt(process.env.STUB_KNOWLEDGE_EXIT, 10));
}
process.exit(0);
`;

/** The importing work unit: a feature mid-research. */
function featureManifest(overrides = {}) {
  return {
    name: 'ledger',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'ledger work',
    phases: { research: { items: { ledger: { status: 'in-progress' } } } },
    ...overrides,
  };
}

function setupFixture({ feature = featureManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-import-'));
  const skills = path.join(root, 'skills');
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);

  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);
  // The cache is session machinery — never staged (migration 049's gitignore).
  writeFile(project, '.workflows/.gitignore', '.cache/\n.manifest.json.*.tmp\n');
  writeFile(project, '.workflows/manifest.json', JSON.stringify({
    work_units: { ledger: { work_type: 'feature' } },
  }, null, 2) + '\n');
  writeFile(project, `.workflows/${feature.name}/manifest.json`, JSON.stringify(feature, null, 2) + '\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);

  return {
    root,
    project,
    engine: path.join(skills, 'workflow-engine/scripts/engine.cjs'),
    env: { CLAUDE_CODE_SESSION_ID: 'import-session', CLAUDE_PID: String(process.pid) },
  };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(fix, args, env = {}) {
  const out = execFileSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...fix.env, ...env },
  });
  return JSON.parse(out.trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(fix, args, env = {}) {
  const res = spawnSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...fix.env, ...env },
  });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows', wu, 'manifest.json'), 'utf8'));
}

function knowledgeCalls(fix) {
  const log = path.join(fix.project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
}

function shortHead(fix) {
  return git(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const FROM_RESEARCH = ['--from', 'research/ledger'];

describe('engine workunit import — happy path', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('lands a binary and a markdown source, records the origin, indexes the markdown alone, commits once', () => {
    writeFile(fix.project, 'shots/Dockset 05 Material.JPEG', 'jpeg bytes\n');
    writeFile(fix.project, 'notes/Onboarding Notes.txt', 'plain notes\n');
    const res = engine(fix, ['workunit', 'import', 'ledger',
      'shots/Dockset 05 Material.JPEG', 'notes/Onboarding Notes.txt', ...FROM_RESEARCH]);

    assert.deepStrictEqual(res, {
      ok: true,
      op: 'import',
      imports: [
        { path: 'imports/dockset-05-material.jpeg', origin: 'research/ledger' },
        { path: 'imports/onboarding-notes.md', origin: 'research/ledger' },
      ],
      skipped_imports: [],
      committed: shortHead(fix),
    });

    const entries = readManifest(fix, 'ledger').imports;
    assert.deepStrictEqual(Object.keys(entries[0]), ['path', 'imported_at', 'origin']);
    assert.match(entries[0].imported_at, ISO_SECONDS);
    assert.deepStrictEqual(entries.map((e) => e.origin), ['research/ledger', 'research/ledger']);

    // Copied, source untouched, mode pinned.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/ledger/imports/dockset-05-material.jpeg'), 'utf8'), 'jpeg bytes\n');
    assert.ok(fs.existsSync(path.join(fix.project, 'shots/Dockset 05 Material.JPEG')));

    // Only the markdown landing is knowledge-base material.
    assert.deepStrictEqual(knowledgeCalls(fix), ['index .workflows/ledger/imports/onboarding-notes.md']);

    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(ledger): import 2 file(s) for research/ledger');
  });

  it('lands every copy 0644, whatever the source carried', () => {
    writeFile(fix.project, 'shots/locked.png', 'png bytes\n');
    fs.chmodSync(path.join(fix.project, 'shots/locked.png'), 0o600);
    engine(fix, ['workunit', 'import', 'ledger', 'shots/locked.png', ...FROM_RESEARCH]);

    const mode = fs.statSync(path.join(fix.project, '.workflows/ledger/imports/locked.png')).mode & 0o777;
    assert.strictEqual(mode, 0o644, `landed mode ${mode.toString(8)}`);
  });

  it('a bare discovery origin lands the same way', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', '--from', 'discovery']);

    assert.deepStrictEqual(res.imports, [{ path: 'imports/brief.md', origin: 'discovery' }]);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(ledger): import 1 file(s) for discovery');
  });

  it('commits the imports directory and the manifest and nothing else dirty', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    writeFile(fix.project, '.workflows/ledger/research/ledger.md', '# Research — a peer session mid-write\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);

    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged.sort(), ['.workflows/ledger/imports/brief.md', '.workflows/ledger/manifest.json']);
    const status = git(fix.project, ['status', '--porcelain']);
    assert.match(status, /\?\? unrelated\.txt/);
    assert.match(status, /\?\? \.workflows\/ledger\/research\//);
  });

  it('appends to an existing imports array across calls', () => {
    writeFile(fix.project, 'notes/one.md', 'one\n');
    writeFile(fix.project, 'notes/two.png', 'two\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/one.md', '--from', 'discovery']);
    engine(fix, ['workunit', 'import', 'ledger', 'notes/two.png', ...FROM_RESEARCH]);

    assert.deepStrictEqual(readManifest(fix, 'ledger').imports.map((e) => [e.path, e.origin]), [
      ['imports/one.md', 'discovery'],
      ['imports/two.png', 'research/ledger'],
    ]);
  });
});

describe('engine workunit import — names', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('dedupes against the directory and the batch, suffixing the stem', () => {
    writeFile(fix.project, 'a/shot.png', 'one\n');
    writeFile(fix.project, 'b/SHOT.png', 'two\n');
    const first = engine(fix, ['workunit', 'import', 'ledger', 'a/shot.png', 'b/SHOT.png', ...FROM_RESEARCH]);
    assert.deepStrictEqual(first.imports.map((i) => i.path), ['imports/shot.png', 'imports/shot-2.png']);

    writeFile(fix.project, 'c/shot.png', 'three\n');
    const second = engine(fix, ['workunit', 'import', 'ledger', 'c/shot.png', ...FROM_RESEARCH]);
    assert.deepStrictEqual(second.imports.map((i) => i.path), ['imports/shot-3.png']);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/ledger/imports/shot.png'), 'utf8'), 'one\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/ledger/imports/shot-3.png'), 'utf8'), 'three\n');
  });

  it('skips a dotfile source and reports it; a call whose every source skips refuses', () => {
    writeFile(fix.project, 'notes/.env', 'SECRET=1\n');
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/.env', 'notes/good.md', ...FROM_RESEARCH]);
    assert.deepStrictEqual(res.skipped_imports, ['notes/.env']);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/good.md', origin: 'research/ledger' }]);

    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'notes/.env', ...FROM_RESEARCH]);
    assert.match(err.error, /nothing to land/);
    assert.strictEqual(readManifest(fix, 'ledger').imports.length, 1, 'the refused call recorded nothing');
  });
});

describe('engine workunit import — refusals leave nothing behind', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('a missing path fails the whole call with missing_imports — nothing copied', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const err = engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', 'notes/ghost.png', ...FROM_RESEARCH]);

    assert.match(err.error, /import path\(s\) not found/);
    assert.deepStrictEqual(err.missing_imports, ['notes/ghost.png']);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/ledger/imports')));
    assert.strictEqual(readManifest(fix, 'ledger').imports, undefined);
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.deepStrictEqual(knowledgeCalls(fix), []);
  });

  it('refuses an unknown work unit', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ghost-unit', 'notes/good.md', ...FROM_RESEARCH]).error,
      /manifest not found/);
  });

  it('refuses a work unit that is not in-progress', () => {
    fix = setupFixture({ feature: featureManifest({ status: 'completed' }) });
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', ...FROM_RESEARCH]).error,
      /not in-progress \(status: completed\) — imports land in active work/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/ledger/imports')));
  });

  it('refuses an origin outside the vocabulary', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    for (const origin of ['planning/ledger', 'research', 'research/led.ger', 'research/a/b', 'research/', '']) {
      assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', '--from', origin]).error,
        /is not an import origin|Usage: engine workunit import/, `origin "${origin}" was not refused`);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/ledger/imports')));
  });

  it('refuses missing arguments with usage', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const usage = /Usage: engine workunit import/;
    assert.match(engineFails(fix, ['workunit', 'import']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md']).error, usage);
  });

  it('refuses a malformed imports node before any file is copied', () => {
    fix = setupFixture({ feature: featureManifest({ imports: 'corrupt' }) });
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    assert.match(engineFails(fix, ['workunit', 'import', 'ledger', 'notes/good.md', ...FROM_RESEARCH]).error,
      /imports is malformed/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/ledger/imports')));
  });
});

describe('engine workunit import — the derived tail', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('a knowledge failure warns and the commit still lands', () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    const res = engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH], { STUB_KNOWLEDGE_EXIT: '1' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index \(imports\/brief\.md\) failed: kb exploded/);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.strictEqual(readManifest(fix, 'ledger').imports.length, 1, 'the manifest write is the source of truth');
  });

  it("beats presence on the origin's topic — a bare discovery origin beats nothing", () => {
    writeFile(fix.project, 'notes/brief.md', '# Brief\n');
    writeFile(fix.project, 'notes/other.md', '# Other\n');
    engine(fix, ['workunit', 'import', 'ledger', 'notes/brief.md', ...FROM_RESEARCH]);
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/.cache/ledger/research/ledger/presence')),
      "the landing session's own topic is beaten");

    fs.rmSync(path.join(fix.project, '.workflows/.cache/ledger'), { recursive: true, force: true });
    engine(fix, ['workunit', 'import', 'ledger', 'notes/other.md', '--from', 'discovery']);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/.cache/ledger')),
      'discovery names no topic — nothing to beat');
  });
});
