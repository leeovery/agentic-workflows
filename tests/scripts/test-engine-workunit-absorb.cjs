'use strict';

const { describe, it, afterEach } = require('node:test');
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

/** The absorbable feature: discussion, research, an import, a seed. */
function featureManifest(overrides = {}) {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z' }],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-02T10:00:00Z' }],
    phases: {
      research: { items: { exploration: { status: 'completed' }, 'edge-cases': { status: 'in-progress' } } },
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
    },
    ...overrides,
  };
}

/** The target epic — carries a research-topic collision and a dismissed name. */
function epicManifest(overrides = {}) {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    imports: [{ path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z' }],
    phases: {
      discovery: {
        items: { 'fee-model': { routing: 'discussion', source: 'discovery', summary: 'Fees' } },
        dismissed: ['dead-idea'],
      },
      research: { items: { exploration: { status: 'completed' } } },
    },
    ...overrides,
  };
}

/**
 * A hermetic skills layout (real engine scripts, stub
 * knowledge CLI) beside a git-repo project carrying the feature and the epic.
 */
function setupFixture({ feature = featureManifest(), epic = epicManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-absorb-'));
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
  writeFile(project, '.workflows/auth-flow/manifest.json', JSON.stringify(feature, null, 2) + '\n');
  writeFile(project, '.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n');
  writeFile(project, '.workflows/auth-flow/research/exploration.md', '# Exploration\n');
  writeFile(project, '.workflows/auth-flow/research/edge-cases.md', '# Edge Cases\n');
  writeFile(project, '.workflows/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(project, '.workflows/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(project, '.workflows/payments/manifest.json', JSON.stringify(epic, null, 2) + '\n');
  writeFile(project, '.workflows/payments/research/exploration.md', '# Epic exploration\n');
  writeFile(project, '.workflows/payments/imports/roadmap.md', '# Roadmap\n');
  // A file-only collision in the epic's imports dir — dedupe must dodge it.
  writeFile(project, '.workflows/payments/imports/notes.md', '# Epic notes\n');
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

function knowledgeCalls(fix) {
  const log = path.join(fix.project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
}

function shortHead(fix) {
  return git(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** Every file under `.workflows/`, rel path → content — the pristine check. */
function treeSnapshot(fix) {
  /** @type {Record<string, string>} */
  const files = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files[path.relative(fix.project, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(path.join(fix.project, '.workflows'));
  return {
    files,
    commits: git(fix.project, ['rev-list', '--count', 'HEAD']).trim(),
    status: git(fix.project, ['status', '--porcelain']),
  };
}

const ABSORB = ['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'auth'];

describe('engine workunit absorb — happy path', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('moves everything, mirrors statuses, deletes the feature, commits all three pathspecs once', () => {
    fix = setupFixture();
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    fs.mkdirSync(path.join(fix.project, '.workflows', '.cache', 'auth-flow'), { recursive: true });
    fs.writeFileSync(path.join(fix.project, '.workflows', '.cache', 'auth-flow', 'scratch.json'), '{}');
    const res = engine(fix, ABSORB);
    assert.strictEqual(fs.existsSync(path.join(fix.project, '.workflows', '.cache', 'auth-flow')), false, "absorbed feature's cache purged");

    assert.deepStrictEqual(res, {
      ok: true,
      feature: 'auth-flow',
      epic: 'payments',
      topic: 'auth',
      discussion: { path: 'discussion/auth.md', status: 'completed' },
      research: [
        { from: 'exploration', topic: 'exploration-auth-flow', status: 'completed' },
        { from: 'edge-cases', topic: 'edge-cases', status: 'in-progress' },
      ],
      imports: [{ path: 'imports/notes-2.md' }],
      seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea' }],
      routing: 'research',
      committed: shortHead(fix),
      warnings: [],
    });

    // Files landed at their epic identities; the feature directory is gone.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/auth.md'), 'utf8'), '# Discussion\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/research/exploration-auth-flow.md'), 'utf8'), '# Exploration\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/research/edge-cases.md'), 'utf8'), '# Edge Cases\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/notes-2.md'), 'utf8'), '# Notes\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/seeds/seed.md'), 'utf8'), '# Seed\n');
    // The epic's own colliding files are untouched.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/research/exploration.md'), 'utf8'), '# Epic exploration\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/notes.md'), 'utf8'), '# Epic notes\n');
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')));

    // Epic manifest: statuses mirrored, entries carry their ORIGINAL
    // timestamps (and seed provenance), map item lands backfill-shaped.
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items, { auth: { status: 'completed' } });
    assert.deepStrictEqual(m.phases.research.items, {
      exploration: { status: 'completed' },
      'exploration-auth-flow': { status: 'completed' },
      'edge-cases': { status: 'in-progress' },
    });
    assert.deepStrictEqual(m.imports, [
      { path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-01T09:00:00Z' },
    ]);
    assert.deepStrictEqual(m.seeds, [
      { path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-02T10:00:00Z' },
    ]);
    assert.deepStrictEqual(m.phases.discovery.items.auth, { routing: 'research', source: 'discovery' });

    // Registration removed; the epic's stays.
    const project = JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'epic' } });

    // ONE commit staging all three pathspecs — feature deletion, epic,
    // project manifest — with the engine-owned message.
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '2');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(auth-flow): absorb into payments');
    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/auth-flow/manifest.json'), 'feature deletion staged');
    assert.ok(staged.includes('.workflows/payments/discussion/auth.md'), 'epic addition staged');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest staged');
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    // KB: feature chunks removed, moved artifacts indexed at epic identities —
    // completed phase artifacts only, imports and seeds always.
    assert.deepStrictEqual(knowledgeCalls(fix), [
      'remove --work-unit auth-flow',
      'index .workflows/payments/discussion/auth.md',
      'index .workflows/payments/research/exploration-auth-flow.md',
      'index .workflows/payments/imports/notes-2.md',
      'index .workflows/payments/seeds/seed.md',
    ]);
  });

  it('discussion-only feature: routing discussion, in-progress status mirrored, no phase-artifact indexing', () => {
    const feature = featureManifest({
      imports: undefined,
      seeds: undefined,
      phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } },
    });
    delete feature.imports;
    delete feature.seeds;
    fix = setupFixture({ feature });
    const res = engine(fix, ABSORB);

    assert.strictEqual(res.routing, 'discussion');
    assert.deepStrictEqual(res.discussion, { path: 'discussion/auth.md', status: 'in-progress' });
    assert.deepStrictEqual(res.research, []);
    assert.deepStrictEqual(res.imports, []);
    assert.deepStrictEqual(res.seeds, []);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items, { auth: { status: 'in-progress' } });
    assert.deepStrictEqual(m.phases.discovery.items.auth, { routing: 'discussion', source: 'discovery' });
    // In-progress discussion is not indexed — only the feature removal runs.
    assert.deepStrictEqual(knowledgeCalls(fix), ['remove --work-unit auth-flow']);
  });

  it('KB failures are warnings, never blocks — the absorb still lands and commits', () => {
    fix = setupFixture();
    const res = engine(fix, ABSORB, { STUB_KNOWLEDGE_EXIT: '1' });

    assert.strictEqual(res.warnings.length, 5, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge remove failed/);
    assert.match(res.warnings[4], /knowledge index \(seeds\/seed\.md\) failed/);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')));
  });
});

describe('engine workunit absorb — guards refuse loudly, both work units pristine', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  /** Assert the refusal leaves every `.workflows/` byte identical, no commit. */
  function refusedPristine(args, pattern) {
    const before = treeSnapshot(fix);
    const err = engineFails(fix, args);
    assert.match(err.error, pattern);
    assert.deepStrictEqual(treeSnapshot(fix), before);
    return err;
  }

  it('refuses self-absorption, unknown units, and wrong work types', () => {
    fix = setupFixture();
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'auth-flow', '--topic', 'auth'], /cannot absorb "auth-flow" into itself/);
    refusedPristine(['workunit', 'absorb', 'ghost', '--into', 'payments', '--topic', 'auth'], /manifest not found/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'ghost', '--topic', 'auth'], /manifest not found/);
    refusedPristine(['workunit', 'absorb', 'payments', '--into', 'payments', '--topic', 'auth'], /cannot absorb "payments" into itself/);
    refusedPristine(['workunit', 'absorb', 'payments', '--into', 'auth-flow', '--topic', 'auth'], /not a feature \(work_type: epic\)/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'auth-flow2', '--topic', 'auth'], /manifest not found/);
  });

  it('refuses a feature target that is not an epic and an epic that is not in-progress', () => {
    fix = setupFixture({ epic: epicManifest({ status: 'completed' }) });
    refusedPristine(ABSORB, /epic "payments" is not in-progress \(status: completed\)/);
  });

  it('refuses a feature with no discussion — item or file', () => {
    const feature = featureManifest({ phases: { research: { items: { exploration: { status: 'completed' } } } } });
    fix = setupFixture({ feature });
    refusedPristine(ABSORB, /has no discussion — absorb moves the discussion in/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    fix = setupFixture();
    fs.rmSync(path.join(fix.project, '.workflows/auth-flow/discussion/auth-flow.md'));
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'drop file']);
    refusedPristine(ABSORB, /discussion file missing on disk/);
  });

  it('refuses specification-or-beyond work on the feature', () => {
    const withSpec = featureManifest();
    withSpec.phases.specification = { items: { 'auth-flow': { status: 'in-progress' } } };
    fix = setupFixture({ feature: withSpec });
    refusedPristine(ABSORB, /has specification work — absorb is only for features before specification/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    const withPlan = featureManifest();
    withPlan.phases.planning = { items: {} };
    fix = setupFixture({ feature: withPlan });
    refusedPristine(ABSORB, /has planning work/);
  });

  it('refuses an illegal or colliding topic name — map item, dismissed, discussion item, file on disk', () => {
    const epic = epicManifest();
    epic.phases.discussion = { items: { 'session-model': { status: 'completed' } } };
    fix = setupFixture({ epic });
    writeFile(fix.project, '.workflows/payments/discussion/on-disk.md', '# Orphan\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'orphan']);

    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'bad.name'], /not a legal topic name/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'fee-model'], /already on payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'dead-idea'], /was dismissed from payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'session-model'], /discussion topic "session-model" already exists/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'on-disk'], /discussion\/on-disk\.md already exists/);
  });

  it('closes the crash window: a research file missing on disk leaves both units pristine', () => {
    fix = setupFixture();
    fs.rmSync(path.join(fix.project, '.workflows/auth-flow/research/edge-cases.md'));
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'drop research file']);
    refusedPristine(ABSORB, /research file missing on disk: \.workflows\/auth-flow\/research\/edge-cases\.md/);
    // Validation refused before ANY move — the discussion is still the
    // feature's, the epic gained nothing, no KB call ran.
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/auth-flow/discussion/auth-flow.md')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/discussion/auth.md')));
    assert.deepStrictEqual(knowledgeCalls(fix), []);
  });

  it('refuses malformed tracked entries — deletion follows, so skipping would lose the file', () => {
    const feature = featureManifest();
    feature.imports.push({ path: 'evil/../secrets.md', imported_at: '2026-06-01T09:00:00Z' });
    fix = setupFixture({ feature });
    refusedPristine(ABSORB, /malformed imports entry/);
  });

  it('refuses a corrupt project manifest before anything moves', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/manifest.json', '{ corrupt\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'corrupt']);
    refusedPristine(ABSORB, /not valid JSON/);
  });

  it('rejects missing flags and extra positionals', () => {
    fix = setupFixture();
    assert.match(engineFails(fix, ['workunit', 'absorb', 'auth-flow', '--into', 'payments']).error, /Usage: engine workunit absorb/);
    assert.match(engineFails(fix, ['workunit', 'absorb', 'auth-flow', '--topic', 'auth']).error, /Usage: engine workunit absorb/);
    assert.match(engineFails(fix, ['workunit', 'absorb']).error, /Usage: engine workunit absorb/);
    assert.match(engineFails(fix, ['workunit', 'absorb', 'auth-flow', 'payments', '--into', 'payments', '--topic', 'auth']).error, /Usage: engine workunit absorb/);
  });
});
