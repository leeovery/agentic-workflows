'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REAL_SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MANIFEST_CLI = path.join(__dirname, '../../skills/workflow-manifest/scripts/manifest.cjs');

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

/** A temp-dir project that is a real git repo with a `.workflows/` tree. */
function setupGitFixture(root) {
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);
  writeFile(project, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
  writeFile(project, '.workflows/.inbox/bugs/2026-06-02--login-loop.md', '# Login Loop\n');
  writeFile(project, '.workflows/.inbox/quickfixes/2026-06-03--typo-fix.md', '# Typo Fix\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);
  return project;
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

/**
 * A hermetic skills layout: the real engine scripts (plus the workflow-shared
 * scripts the domain ring requires) copied into a temp skills root, with a
 * stub knowledge.cjs sibling — exercising the engine's __dirname-relative
 * resolution exactly as installed.
 */
function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-create-'));
  const skills = path.join(root, 'skills');
  fs.cpSync(REAL_SCRIPTS, path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  fs.cpSync(path.join(__dirname, '../../skills/workflow-shared/scripts'), path.join(skills, 'workflow-shared/scripts'), { recursive: true });
  writeFile(skills, 'workflow-knowledge/scripts/knowledge.cjs', STUB_KNOWLEDGE);
  return {
    root,
    project: setupGitFixture(root),
    engine: path.join(skills, 'workflow-engine/scripts/engine.cjs'),
  };
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

const SESSION_LOG = '# Discovery Session 001\n\nDate: 2026-07-15\n\n## Exploration\n\nShaping prose.\n';
const LOG_STAGE = '.workflows/.cache/payments/discovery/session-001.md';

/** Stage the model-authored session log at the prescribed cache path. */
function stageLog(fix, content = SESSION_LOG) {
  writeFile(fix.project, LOG_STAGE, content);
}

/** The standard create argv with the staged log. */
function createArgs(workUnit, workType, extra = []) {
  return [
    'workunit', 'create', workUnit, workType,
    '--description', 'Payments overhaul',
    '--session-log-file', LOG_STAGE,
    ...extra,
  ];
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

function lastMessage(fix) {
  return git(fix.project, ['log', '-1', '--pretty=%s']).trim();
}

function commitCount(fix) {
  return git(fix.project, ['rev-list', '--count', 'HEAD']).trim();
}

const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

describe('engine workunit create — happy path', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('epic with imports and seeds: one transaction — manifest, files, log, marker, commit', () => {
    writeFile(fix.project, 'notes/My Design DOC.txt', 'design notes\n');
    const res = engine(fix, createArgs('payments', 'epic', [
      '--import', 'notes/My Design DOC.txt',
      '--seed', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
    ]));

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'payments',
      work_type: 'epic',
      created: true,
      imports: [{ path: 'imports/my-design-doc.txt.md' }],
      seeds: [{ path: 'seeds/2026-06-01-smart-retry.md', source: 'inbox:idea' }],
      skipped_imports: [],
      session_log: '.workflows/payments/discovery/sessions/session-001.md',
      committed: shortHead(fix),
      warnings: [],
    });

    const m = readManifest(fix, 'payments');
    assert.strictEqual(m.name, 'payments');
    assert.strictEqual(m.work_type, 'epic');
    assert.strictEqual(m.status, 'in-progress');
    assert.strictEqual(m.created, new Date().toISOString().slice(0, 10));
    assert.strictEqual(m.description, 'Payments overhaul');
    // Epic gets the active-session marker.
    assert.deepStrictEqual(m.phases, { discovery: { active_session: '001' } });
    assert.strictEqual(m.imports.length, 1);
    assert.strictEqual(m.imports[0].path, 'imports/my-design-doc.txt.md');
    assert.match(m.imports[0].imported_at, ISO_SECONDS);
    assert.deepStrictEqual(Object.keys(m.imports[0]), ['path', 'imported_at']);
    assert.strictEqual(m.seeds.length, 1);
    assert.deepStrictEqual(Object.keys(m.seeds[0]), ['path', 'source', 'seeded_at']);
    assert.strictEqual(m.seeds[0].path, 'seeds/2026-06-01-smart-retry.md');
    assert.strictEqual(m.seeds[0].source, 'inbox:idea');
    assert.match(m.seeds[0].seeded_at, ISO_SECONDS);

    // Registered in the project manifest, exactly as manifest.cjs init does.
    const project = JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'epic' } });

    // The session log is installed verbatim — engine never edits prose.
    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.workflows/payments/discovery/sessions/session-001.md'), 'utf8'),
      SESSION_LOG);

    // Import copied (source untouched), seed moved out of the inbox.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/my-design-doc.txt.md'), 'utf8'), 'design notes\n');
    assert.ok(fs.existsSync(path.join(fix.project, 'notes/My Design DOC.txt')));
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments/seeds/2026-06-01-smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));

    // Both landed files were KB-indexed.
    assert.deepStrictEqual(knowledgeCalls(fix), [
      'index .workflows/payments/imports/my-design-doc.txt.md',
      'index .workflows/payments/seeds/2026-06-01-smart-retry.md',
    ]);

    // One commit, engine-owned message, staging the work unit AND the seed's
    // inbox removal.
    assert.strictEqual(lastMessage(fix), 'discovery(payments): create work unit (epic)');
    assert.strictEqual(commitCount(fix), '2');
    const show = git(fix.project, ['show', '--no-renames', '--name-status', '--pretty=format:', 'HEAD']);
    assert.match(show, /^D\t\.workflows\/\.inbox\/ideas\/2026-06-01--smart-retry\.md$/m);
    assert.match(show, /^A\t\.workflows\/payments\/seeds\/2026-06-01-smart-retry\.md$/m);
    // The cache staging file is outside the commit scope.
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? \.workflows\/\.cache\//);
  });

  it('every non-epic work type creates without the active-session marker', () => {
    for (const workType of ['feature', 'bugfix', 'quick-fix', 'cross-cutting']) {
      const wu = `unit-${workType.replace('-', '')}`;
      writeFile(fix.project, `.workflows/.cache/${wu}/discovery/session-001.md`, SESSION_LOG);
      const res = engine(fix, [
        'workunit', 'create', wu, workType,
        '--description', 'One-liner',
        '--session-log-file', `.workflows/.cache/${wu}/discovery/session-001.md`,
      ]);

      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.created, true);
      assert.strictEqual(res.work_type, workType);
      const m = readManifest(fix, wu);
      assert.strictEqual(m.work_type, workType);
      assert.deepStrictEqual(m.phases, {});
      assert.ok(fs.existsSync(path.join(fix.project, `.workflows/${wu}/discovery/sessions/session-001.md`)));
      assert.strictEqual(lastMessage(fix), `discovery(${wu}): create work unit (${workType})`);
    }
  });

  it('no seeds: the inbox is not staged — unrelated inbox changes stay out of the commit', () => {
    writeFile(fix.project, '.workflows/.inbox/ideas/2026-06-09--unrelated.md', '# Unrelated\n');
    const res = engine(fix, createArgs('payments', 'feature'));

    assert.strictEqual(res.ok, true);
    const show = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    assert.ok(!show.includes('.inbox'), `inbox leaked into the commit:\n${show}`);
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? \.workflows\/\.inbox\/ideas\/2026-06-09--unrelated\.md/);
  });
});

describe('engine workunit create — manifest equivalence with manifest.cjs init', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('writes byte-identical manifest and project-manifest documents', () => {
    // Reference: the manifest CLI in a sibling project dir.
    const reference = path.join(fix.root, 'reference');
    fs.mkdirSync(reference, { recursive: true });
    execFileSync('node', [MANIFEST_CLI, 'init', 'payments', '--work-type', 'feature', '--description', 'Payments overhaul'], {
      cwd: reference,
      encoding: 'utf8',
    });

    engine(fix, createArgs('payments', 'feature'));

    const cliManifest = fs.readFileSync(path.join(reference, '.workflows/payments/manifest.json'), 'utf8');
    const engineManifest = fs.readFileSync(path.join(fix.project, '.workflows/payments/manifest.json'), 'utf8');
    assert.strictEqual(engineManifest, cliManifest);

    const cliProject = fs.readFileSync(path.join(reference, '.workflows/manifest.json'), 'utf8');
    const engineProject = fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8');
    assert.strictEqual(engineProject, cliProject);
  });
});

describe('engine workunit create — existing manifest reuse', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('reuses an existing manifest as-is: created false, fields preserved, landing still runs', () => {
    writeFile(fix.project, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments',
      work_type: 'epic',
      status: 'in-progress',
      created: '2026-01-01',
      description: 'Original description',
      custom_field: 'keep me',
      phases: { discovery: { items: { 'auth-flow': { routing: 'research' } } } },
    }, null, 2) + '\n');

    const res = engine(fix, createArgs('payments', 'epic', [
      '--seed', '.workflows/.inbox/bugs/2026-06-02--login-loop.md',
    ]));

    assert.strictEqual(res.created, false);
    const m = readManifest(fix, 'payments');
    // Never overwritten — the existing document survives untouched…
    assert.strictEqual(m.description, 'Original description');
    assert.strictEqual(m.created, '2026-01-01');
    assert.strictEqual(m.custom_field, 'keep me');
    assert.deepStrictEqual(m.phases.discovery.items, { 'auth-flow': { routing: 'research' } });
    // …with the transaction's additions layered in.
    assert.strictEqual(m.phases.discovery.active_session, '001');
    assert.strictEqual(m.seeds.length, 1);
    assert.strictEqual(m.seeds[0].source, 'inbox:bug');
    // The reuse branch never registers — no project manifest is conjured.
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/manifest.json')));
    assert.strictEqual(lastMessage(fix), 'discovery(payments): create work unit (epic)');
  });
});

describe('engine workunit create — import filename normalisation', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  /** @param {string[]} sources */
  function landImports(sources) {
    const args = createArgs('payments', 'feature', sources.flatMap((s) => ['--import', s]));
    return engine(fix, args);
  }

  it('lowercases, collapses punctuation and whitespace runs, forces .md', () => {
    writeFile(fix.project, 'notes/My Design DOC.txt', 'a\n');
    writeFile(fix.project, 'notes/UPPER.MD', 'b\n');
    writeFile(fix.project, 'notes/plain', 'c\n');
    writeFile(fix.project, 'notes/weird  name!!.md', 'd\n');
    const res = landImports([
      'notes/My Design DOC.txt',
      'notes/UPPER.MD',
      'notes/plain',
      'notes/weird  name!!.md',
    ]);

    assert.deepStrictEqual(res.imports, [
      { path: 'imports/my-design-doc.txt.md' },
      { path: 'imports/upper.md' },
      { path: 'imports/plain.md' },
      { path: 'imports/weird-name-.md' },
    ]);
    assert.deepStrictEqual(res.skipped_imports, []);
    for (const { path: rel } of res.imports) {
      assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments', rel)), `missing ${rel}`);
    }
  });

  it('rejects dotfiles: skipped and reported, not fatal', () => {
    writeFile(fix.project, 'notes/.env', 'SECRET=1\n');
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const res = landImports(['notes/.env', 'notes/good.md']);

    assert.deepStrictEqual(res.skipped_imports, ['notes/.env']);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/good.md' }]);
    assert.deepStrictEqual(readManifest(fix, 'payments').imports.map((e) => e.path), ['imports/good.md']);
    // The skipped file was never indexed.
    assert.deepStrictEqual(knowledgeCalls(fix), ['index .workflows/payments/imports/good.md']);
  });

  it('suffixes batch collisions — same source twice and distinct sources normalising alike', () => {
    writeFile(fix.project, 'notes/a b.md', 'one\n');
    writeFile(fix.project, 'notes/a  b.md', 'two\n');
    const res = landImports(['notes/a b.md', 'notes/a b.md', 'notes/a  b.md']);

    assert.deepStrictEqual(res.imports, [
      { path: 'imports/a-b.md' },
      { path: 'imports/a-b-2.md' },
      { path: 'imports/a-b-3.md' },
    ]);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/a-b-3.md'), 'utf8'), 'two\n');
  });

  it('suffixes directory collisions — a re-import lands beside the first, never over it', () => {
    writeFile(fix.project, 'notes/design.md', 'v1\n');
    landImports(['notes/design.md']);
    writeFile(fix.project, 'notes/design.md', 'v2\n');
    writeFile(fix.project, `.workflows/.cache/payments/discovery/session-001.md`, SESSION_LOG);
    const res = landImports(['notes/design.md']);

    assert.strictEqual(res.created, false);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/design-2.md' }]);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/design.md'), 'utf8'), 'v1\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/design-2.md'), 'utf8'), 'v2\n');
    assert.deepStrictEqual(readManifest(fix, 'payments').imports.map((e) => e.path), ['imports/design.md', 'imports/design-2.md']);
  });
});

describe('engine workunit create — seeds', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('derives the source tag from each inbox folder', () => {
    const res = engine(fix, createArgs('payments', 'epic', [
      '--seed', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '--seed', '.workflows/.inbox/bugs/2026-06-02--login-loop.md',
      '--seed', '.workflows/.inbox/quickfixes/2026-06-03--typo-fix.md',
    ]));

    assert.deepStrictEqual(res.seeds, [
      { path: 'seeds/2026-06-01-smart-retry.md', source: 'inbox:idea' },
      { path: 'seeds/2026-06-02-login-loop.md', source: 'inbox:bug' },
      { path: 'seeds/2026-06-03-typo-fix.md', source: 'inbox:quickfix' },
    ]);
    // All three moved out of the inbox.
    for (const folder of ['ideas', 'bugs', 'quickfixes']) {
      assert.deepStrictEqual(fs.readdirSync(path.join(fix.project, '.workflows/.inbox', folder)), []);
    }
    assert.deepStrictEqual(readManifest(fix, 'payments').seeds.map((e) => e.source), ['inbox:idea', 'inbox:bug', 'inbox:quickfix']);
  });

  it('rejects a seed outside the inbox — nothing touched', () => {
    writeFile(fix.project, 'notes/rogue.md', 'not an inbox item\n');
    const err = engineFails(fix, createArgs('payments', 'epic', ['--seed', 'notes/rogue.md']));

    assert.match(err.error, /not a live inbox path/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments')));
    assert.strictEqual(commitCount(fix), '1');
  });

  it('rejects a missing inbox file — nothing touched', () => {
    const err = engineFails(fix, createArgs('payments', 'epic', ['--seed', '.workflows/.inbox/ideas/2026-06-09--ghost.md']));

    assert.match(err.error, /inbox file not found/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments')));
  });
});

describe('engine workunit create — missing imports fail fast', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('reports every missing path in missing_imports — nothing touched', () => {
    writeFile(fix.project, 'notes/good.md', 'fine\n');
    const err = engineFails(fix, createArgs('payments', 'epic', [
      '--import', 'notes/good.md',
      '--import', 'notes/ghost.md',
      '--import', 'notes/phantom.md',
      '--seed', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
    ]));

    assert.match(err.error, /import path\(s\) not found/);
    assert.deepStrictEqual(err.missing_imports, ['notes/ghost.md', 'notes/phantom.md']);
    // No manifest, no copies, no seed move, no commit, no KB calls.
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments')));
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(commitCount(fix), '1');
    assert.deepStrictEqual(knowledgeCalls(fix), []);
  });
});

describe('engine workunit create — knowledge base is warn-don\'t-block', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('per-file indexing failures land in warnings; the transaction still commits', () => {
    writeFile(fix.project, 'notes/design.md', 'notes\n');
    const res = engine(fix, createArgs('payments', 'epic', [
      '--import', 'notes/design.md',
      '--seed', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
    ]), { STUB_KNOWLEDGE_EXIT: '1' });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.warnings.length, 2);
    assert.match(res.warnings[0], /knowledge index \(imports\/design\.md\) failed: kb exploded/);
    assert.match(res.warnings[1], /knowledge index \(seeds\/2026-06-01-smart-retry\.md\) failed: kb exploded/);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments/imports/design.md')));
    assert.strictEqual(lastMessage(fix), 'discovery(payments): create work unit (epic)');
  });
});

describe('engine workunit create — validation', () => {
  let fix;
  beforeEach(() => { fix = setupFixture(); stageLog(fix); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('rejects an illegal work type via the shared schema vocabulary', () => {
    const err = engineFails(fix, createArgs('payments', 'saga'));
    assert.match(err.error, /Invalid work_type "saga"\. Must be one of: epic, feature, bugfix, cross-cutting, quick-fix/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments')));
  });

  it('rejects illegal work-unit names — dots, slashes, phase names, reserved', () => {
    assert.match(engineFails(fix, createArgs('pay.ments', 'epic')).error, /must not contain dots or slashes/);
    assert.match(engineFails(fix, createArgs('../escape', 'epic')).error, /must not contain dots or slashes/);
    assert.match(engineFails(fix, createArgs('research', 'epic')).error, /conflicts with a phase name/);
    assert.match(engineFails(fix, createArgs('project', 'epic')).error, /is reserved/);
  });

  it('rejects a missing session-log file before any mutation', () => {
    const err = engineFails(fix, [
      'workunit', 'create', 'payments', 'epic',
      '--description', 'Payments overhaul',
      '--session-log-file', '.workflows/.cache/payments/discovery/ghost.md',
    ]);
    assert.match(err.error, /session log file not found/);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments')));
  });

  it('rejects missing arguments and unknown verbs with usage', () => {
    const usage = /Usage: engine workunit create/;
    assert.match(engineFails(fix, ['workunit', 'create']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'create', 'payments']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'create', 'payments', 'epic']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'create', 'payments', 'epic', '--description', 'x']).error, usage);
    assert.match(engineFails(fix, ['workunit', 'destroy', 'payments']).error, /Usage: engine workunit <create\|complete\|cancel\|reactivate>/);
  });
});

describe('engine workunit create — schema sharing', () => {
  it('validates work types through the shared schema module, never a local literal', () => {
    const src = fs.readFileSync(path.join(REAL_SCRIPTS, 'domain/workunit-create.cjs'), 'utf8');
    assert.ok(src.includes("require('../../../workflow-shared/scripts/manifest-schema.cjs')"),
      'workunit-create must require the shared schema');
    assert.ok(!/VALID_WORK_TYPES\s*=\s*\[/.test(src), 'no local copy of the work-type vocabulary');
  });
});
