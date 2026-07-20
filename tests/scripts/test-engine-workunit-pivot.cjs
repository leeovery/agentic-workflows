'use strict';

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
// project cwd; failure is env-driven. The engine's KB behaviour must be
// deterministic in tests — the real CLI's success depends on the machine's
// knowledge configuration.
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

/** A feature manifest with completed artifacts, an import, and a seed. */
function featureManifest(overrides = {}) {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z' }],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-01T09:00:00Z' }],
    phases: {
      research: { items: { exploration: { status: 'completed' } } },
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
    },
    ...overrides,
  };
}

/**
 * A hermetic skills layout (real engine scripts, stub
 * knowledge CLI) beside a git-repo project carrying the feature.
 */
function setupFixture(manifest = featureManifest()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-pivot-'));
  const skills = path.join(root, 'skills');
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);

  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);

  writeFile(project, '.workflows/manifest.json', JSON.stringify({
    work_units: { 'auth-flow': { work_type: 'feature' }, payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.workflows/auth-flow/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  writeFile(project, '.workflows/auth-flow/research/exploration.md', '# Exploration\n');
  writeFile(project, '.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n');
  writeFile(project, '.workflows/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(project, '.workflows/auth-flow/seeds/seed.md', '# Seed\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);

  return { root, project, engine: path.join(skills, 'workflow-engine/scripts/engine.cjs') };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(fix, args, env = {}) {
  const out = execFileSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return JSON.parse(out.trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(fix, args, env = {}) {
  const res = spawnSync('node', [fix.engine, ...args], {
    cwd: fix.project,
    encoding: 'utf8',
    env: { ...process.env, ...env },
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

function readProjectManifest(fix) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'));
}

function knowledgeCalls(fix) {
  const log = path.join(fix.project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
}

function shortHead(fix) {
  return git(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** Snapshot of everything pivot may touch, for nothing-touched assertions. */
function snapshot(fix) {
  return {
    manifest: fs.readFileSync(path.join(fix.project, '.workflows/auth-flow/manifest.json'), 'utf8'),
    project: fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'),
    commits: git(fix.project, ['rev-list', '--count', 'HEAD']).trim(),
    status: git(fix.project, ['status', '--porcelain']),
  };
}

describe('engine workunit pivot — happy path', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('flips work_type in BOTH manifests, registers the backfill map item, re-indexes, commits', () => {
    fix = setupFixture();
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    const res = engine(fix, ['workunit', 'pivot', 'auth-flow']);

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'auth-flow',
      work_type: 'epic',
      routing: 'research',
      committed: shortHead(fix),
      warnings: [],
    });

    const m = readManifest(fix, 'auth-flow');
    assert.strictEqual(m.work_type, 'epic');
    // Backfill map item: routing + source only — no summary/description
    // (summary-backfill drafts them), never a status field.
    assert.deepStrictEqual(m.phases.discovery.items, {
      'auth-flow': { routing: 'research', source: 'discovery' },
    });
    // The project-manifest registration flips too; siblings untouched.
    assert.deepStrictEqual(readProjectManifest(fix).work_units, {
      'auth-flow': { work_type: 'epic' },
      payments: { work_type: 'epic' },
    });

    // One commit, engine-owned message, scoped to the two manifests.
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(auth-flow): pivot to epic');
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '2');
    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged.sort(), ['.workflows/auth-flow/manifest.json', '.workflows/manifest.json']);
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    // Chunk metadata carries work_type — pivot clears the unit's chunks then
    // re-indexes them in ONE scoped bulk spawn (was one spawn per artifact).
    // The bulk walk covers the same set (completed topics, imports, seeds, …).
    assert.deepStrictEqual(knowledgeCalls(fix), [
      'remove --work-unit auth-flow',
      'index --work-unit auth-flow',
    ]);
  });

  it('routes to discussion when the feature never did research', () => {
    const m = featureManifest();
    delete m.phases.research;
    fix = setupFixture(m);
    const res = engine(fix, ['workunit', 'pivot', 'auth-flow']);

    assert.strictEqual(res.routing, 'discussion');
    assert.deepStrictEqual(readManifest(fix, 'auth-flow').phases.discovery.items['auth-flow'], {
      routing: 'discussion',
      source: 'discovery',
    });
  });

  it('registers an unregistered legacy unit rather than skipping it', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'epic' } } }, null, 2) + '\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'drop registration']);

    engine(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.deepStrictEqual(readProjectManifest(fix).work_units['auth-flow'], { work_type: 'epic' });
  });

  it('KB failures are warnings, never blocks — the pivot still lands', () => {
    fix = setupFixture();
    const res = engine(fix, ['workunit', 'pivot', 'auth-flow'], { STUB_KNOWLEDGE_EXIT: '1' });

    assert.strictEqual(res.work_type, 'epic');
    // The clear + re-index are two spawns; both fail here → two warnings.
    assert.strictEqual(res.warnings.length, 2, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge remove failed/);
    assert.match(res.warnings[1], /knowledge index failed/);
    assert.strictEqual(readManifest(fix, 'auth-flow').work_type, 'epic');
    assert.strictEqual(res.committed, shortHead(fix));
  });
});

describe('engine workunit pivot — guards refuse loudly, nothing touched', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('refuses a non-feature work unit', () => {
    fix = setupFixture(featureManifest({ work_type: 'epic' }));
    const before = snapshot(fix);
    const err = engineFails(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.match(err.error, /not a feature \(work_type: epic\) — only features pivot to epics/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a completed or cancelled feature', () => {
    fix = setupFixture(featureManifest({ status: 'completed' }));
    const before = snapshot(fix);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow']).error, /not in-progress \(status: completed\) — reactivate it first/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a re-run: the topic is already on the discovery map', () => {
    const m = featureManifest();
    m.phases.discovery = { items: { 'auth-flow': { routing: 'research', source: 'discovery' } } };
    fix = setupFixture(m);
    const before = snapshot(fix);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow']).error, /already on the discovery map/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a corrupt project manifest before flipping anything', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/manifest.json', '{ corrupt\n');
    const err = engineFails(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.match(err.error, /not valid JSON/);
    assert.strictEqual(readManifest(fix, 'auth-flow').work_type, 'feature');
    assert.deepStrictEqual(knowledgeCalls(fix), []);
  });

  it('rejects unknown and missing work units, and extra args', () => {
    fix = setupFixture();
    assert.match(engineFails(fix, ['workunit', 'pivot', 'ghost']).error, /manifest not found/);
    assert.match(engineFails(fix, ['workunit', 'pivot']).error, /Usage: engine workunit pivot/);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow', 'extra']).error, /Usage: engine workunit pivot/);
  });
});
