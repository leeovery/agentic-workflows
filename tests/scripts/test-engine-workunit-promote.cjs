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

/**
 * The promotable epic: a completed spec whose sources span two discussions
 * (files on disk) and a superseded source spec (no discussion file).
 */
function epicManifest(overrides = {}) {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'payments overhaul',
    phases: {
      discussion: {
        items: {
          'cache-invalidation': { status: 'completed' },
          'ttl-policy': { status: 'completed' },
          'fee-model': { status: 'completed' },
        },
      },
      specification: {
        items: {
          'caching-strategy': {
            status: 'completed',
            date: '2026-07-01',
            sources: {
              'cache-invalidation': { status: 'incorporated' },
              'ttl-policy': { status: 'incorporated' },
              'old-spec': { status: 'incorporated' },
            },
          },
          'old-spec': { status: 'superseded', superseded_by: 'caching-strategy' },
        },
      },
    },
    ...overrides,
  };
}

/**
 * A hermetic skills layout (real engine scripts, stub knowledge CLI) beside a
 * git-repo project carrying the epic.
 */
function setupFixture({ epic = epicManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-promote-'));
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
    work_units: { payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.workflows/payments/manifest.json', JSON.stringify(epic, null, 2) + '\n');
  writeFile(project, '.workflows/payments/discussion/cache-invalidation.md', '# Cache Invalidation\n');
  writeFile(project, '.workflows/payments/discussion/ttl-policy.md', '# TTL Policy\n');
  writeFile(project, '.workflows/payments/discussion/fee-model.md', '# Fee Model\n');
  writeFile(project, '.workflows/payments/specification/caching-strategy/specification.md', '# Caching Spec\n');
  writeFile(project, '.workflows/payments/specification/caching-strategy/review-input-tracking-c1.md', 'status: complete\n');
  writeFile(project, '.workflows/payments/specification/old-spec/specification.md', '# Old Spec\n');
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

const PROMOTE = ['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'caching', '--description', 'Caching policy for the platform'];

describe('engine workunit promote — happy path', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  it('moves the spec and source discussions, completes the cc unit, marks promoted, commits all three pathspecs once', () => {
    fix = setupFixture();
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    const res = engine(fix, PROMOTE);

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'payments',
      topic: 'caching-strategy',
      cc_work_unit: 'caching',
      cc_status: 'completed',
      discussions: [
        { name: 'cache-invalidation', path: 'discussion/cache-invalidation.md' },
        { name: 'ttl-policy', path: 'discussion/ttl-policy.md' },
      ],
      specification: { path: 'specification/caching/specification.md' },
      status: 'promoted',
      promoted_to: 'caching',
      committed: shortHead(fix),
      warnings: [],
    });

    // The spec directory moved whole — tracking file included — and the
    // source discussions landed at their cc identities; the epic keeps
    // everything else.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/caching/specification/caching/specification.md'), 'utf8'), '# Caching Spec\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/caching/specification/caching/review-input-tracking-c1.md'), 'utf8'), 'status: complete\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/caching/discussion/cache-invalidation.md'), 'utf8'), '# Cache Invalidation\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/caching/discussion/ttl-policy.md'), 'utf8'), '# TTL Policy\n');
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/specification/caching-strategy')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/discussion/cache-invalidation.md')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/discussion/ttl-policy.md')));
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/fee-model.md'), 'utf8'), '# Fee Model\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/specification/old-spec/specification.md'), 'utf8'), '# Old Spec\n');

    // The cc manifest is the canonical document, already completed, with
    // origin provenance; moved discussions register completed; topic = work
    // unit name for the spec item.
    assert.deepStrictEqual(readManifest(fix, 'caching'), {
      name: 'caching',
      work_type: 'cross-cutting',
      status: 'completed',
      created: today(),
      description: 'Caching policy for the platform',
      completed_at: today(),
      source_work_unit: 'payments',
      source_topic: 'caching-strategy',
      phases: {
        discussion: {
          items: {
            'cache-invalidation': { status: 'completed' },
            'ttl-policy': { status: 'completed' },
          },
        },
        specification: { items: { caching: { status: 'completed', date: today() } } },
      },
    });

    // Epic manifest: the spec item carries promoted + promoted_to with its
    // other fields preserved; discussion items are untouched (the files
    // moved — git history is provenance).
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.specification.items['caching-strategy'], {
      status: 'promoted',
      date: '2026-07-01',
      sources: {
        'cache-invalidation': { status: 'incorporated' },
        'ttl-policy': { status: 'incorporated' },
        'old-spec': { status: 'incorporated' },
      },
      promoted_to: 'caching',
    });
    assert.deepStrictEqual(m.phases.specification.items['old-spec'], { status: 'superseded', superseded_by: 'caching-strategy' });
    assert.deepStrictEqual(Object.keys(m.phases.discussion.items).sort(), ['cache-invalidation', 'fee-model', 'ttl-policy']);

    // Both registrations present.
    const project = JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, {
      payments: { work_type: 'epic' },
      caching: { work_type: 'cross-cutting' },
    });

    // ONE commit staging all three pathspecs — epic, cc unit, project
    // manifest — with the prose's message.
    assert.strictEqual(git(fix.project, ['rev-list', '--count', 'HEAD']).trim(), '2');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'spec(payments): promote caching-strategy to cross-cutting work unit');
    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/payments/manifest.json'), 'epic manifest staged');
    assert.ok(staged.includes('.workflows/caching/specification/caching/specification.md'), 'cc addition staged');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest staged');
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    // KB: moved artifacts indexed at their cc identities, the epic's old
    // chunks removed — per discussion, then the spec.
    assert.deepStrictEqual(knowledgeCalls(fix), [
      'index .workflows/caching/discussion/cache-invalidation.md',
      'remove --work-unit payments --phase discussion --topic cache-invalidation',
      'index .workflows/caching/discussion/ttl-policy.md',
      'remove --work-unit payments --phase discussion --topic ttl-policy',
      'index .workflows/caching/specification/caching/specification.md',
      'remove --work-unit payments --phase specification --topic caching-strategy',
    ]);
  });

  it('spec without sources: only the spec moves — no discussion phase in the cc unit', () => {
    const epic = epicManifest();
    delete epic.phases.specification.items['caching-strategy'].sources;
    fix = setupFixture({ epic });
    const res = engine(fix, PROMOTE);

    assert.deepStrictEqual(res.discussions, []);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/caching/discussion')));
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/cache-invalidation.md'), 'utf8'), '# Cache Invalidation\n');
    assert.deepStrictEqual(readManifest(fix, 'caching').phases, {
      specification: { items: { caching: { status: 'completed', date: today() } } },
    });
    assert.deepStrictEqual(knowledgeCalls(fix), [
      'index .workflows/caching/specification/caching/specification.md',
      'remove --work-unit payments --phase specification --topic caching-strategy',
    ]);
  });

  it('a source without a discussion file is not a discussion — skipped, never refused', () => {
    const epic = epicManifest();
    epic.phases.specification.items['caching-strategy'].sources = {
      'cache-invalidation': { status: 'incorporated' },
      'old-spec': { status: 'incorporated' },
    };
    fix = setupFixture({ epic });
    const res = engine(fix, PROMOTE);
    assert.deepStrictEqual(res.discussions, [{ name: 'cache-invalidation', path: 'discussion/cache-invalidation.md' }]);
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/ttl-policy.md'), 'utf8'), '# TTL Policy\n');
  });

  it('KB failures are warnings, never blocks — the promotion still lands and commits', () => {
    fix = setupFixture();
    const res = engine(fix, PROMOTE, { STUB_KNOWLEDGE_EXIT: '1' });

    assert.strictEqual(res.warnings.length, 6, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index \(discussion\/cache-invalidation\) failed/);
    assert.match(res.warnings[5], /knowledge remove \(specification\/caching-strategy\) failed/);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.strictEqual(readManifest(fix, 'caching').status, 'completed');
    assert.strictEqual(readManifest(fix, 'payments').phases.specification.items['caching-strategy'].status, 'promoted');
  });
});

describe('engine workunit promote — guards refuse loudly, everything pristine', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true }); });

  /** Assert the refusal leaves every `.workflows/` byte identical, no commit, no cc unit. */
  function refusedPristine(args, pattern) {
    const before = treeSnapshot(fix);
    const err = engineFails(fix, args);
    assert.match(err.error, pattern);
    assert.deepStrictEqual(treeSnapshot(fix), before);
    assert.deepStrictEqual(knowledgeCalls(fix), []);
    return err;
  }

  it('refuses unknown work units, non-epics, and closed epics', () => {
    fix = setupFixture();
    refusedPristine(['workunit', 'promote', 'ghost', 'caching-strategy', '--to', 'caching', '--description', 'd'], /manifest not found/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    fix = setupFixture({ epic: epicManifest({ work_type: 'feature' }) });
    refusedPristine(PROMOTE, /not an epic \(work_type: feature\) — only epic specifications promote/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    fix = setupFixture({ epic: epicManifest({ status: 'completed' }) });
    refusedPristine(PROMOTE, /epic "payments" is not in-progress \(status: completed\)/);
  });

  it('refuses a missing, incomplete, or already-promoted specification item', () => {
    fix = setupFixture();
    refusedPristine(['workunit', 'promote', 'payments', 'ghost-topic', '--to', 'caching', '--description', 'd'], /no specification item "ghost-topic"/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    const inProgress = epicManifest();
    inProgress.phases.specification.items['caching-strategy'].status = 'in-progress';
    fix = setupFixture({ epic: inProgress });
    refusedPristine(PROMOTE, /not completed \(status: in-progress\) — only a completed specification promotes/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    const promoted = epicManifest();
    promoted.phases.specification.items['caching-strategy'].status = 'promoted';
    promoted.phases.specification.items['caching-strategy'].promoted_to = 'existing-cc';
    fix = setupFixture({ epic: promoted });
    refusedPristine(PROMOTE, /already promoted \(to "existing-cc"\)/);
  });

  it('refuses a spec artifact missing on disk', () => {
    fix = setupFixture();
    fs.rmSync(path.join(fix.project, '.workflows/payments/specification/caching-strategy/specification.md'));
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'drop spec file']);
    refusedPristine(PROMOTE, /specification file missing on disk: \.workflows\/payments\/specification\/caching-strategy\/specification\.md/);
  });

  it('refuses illegal cc names — dots/slashes, phase names, reserved names', () => {
    fix = setupFixture();
    refusedPristine(['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'bad.name', '--description', 'd'], /must not contain dots or slashes/);
    refusedPristine(['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'research', '--description', 'd'], /conflicts with a phase name/);
    refusedPristine(['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'project', '--description', 'd'], /is reserved/);
  });

  it('refuses a taken cc name — directory on disk, or registration only', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/caching/manifest.json', '{}\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'existing unit']);
    refusedPristine(PROMOTE, /work unit "caching" already exists \(\.workflows\/caching\)/);
    fs.rmSync(fix.root, { recursive: true, force: true });

    fix = setupFixture();
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify({
      work_units: { payments: { work_type: 'epic' }, caching: { work_type: 'feature' } },
    }, null, 2) + '\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'registration only']);
    refusedPristine(PROMOTE, /work unit "caching" is already registered in the project manifest/);
  });

  it('refuses a malformed source name before anything renames', () => {
    const epic = epicManifest();
    epic.phases.specification.items['caching-strategy'].sources['../escape'] = { status: 'incorporated' };
    fix = setupFixture({ epic });
    refusedPristine(PROMOTE, /malformed source name \("\.\.\/escape"\)/);
  });

  it('refuses a corrupt project manifest before anything moves', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/manifest.json', '{ corrupt\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'corrupt']);
    refusedPristine(PROMOTE, /not valid JSON/);
  });

  it('rejects missing flags and extra positionals', () => {
    fix = setupFixture();
    assert.match(engineFails(fix, ['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'caching']).error, /Usage: engine workunit promote/);
    assert.match(engineFails(fix, ['workunit', 'promote', 'payments', 'caching-strategy', '--description', 'd']).error, /Usage: engine workunit promote/);
    assert.match(engineFails(fix, ['workunit', 'promote', 'payments', '--to', 'caching', '--description', 'd']).error, /Usage: engine workunit promote/);
    assert.match(engineFails(fix, ['workunit', 'promote', 'payments', 'caching-strategy', 'extra', '--to', 'caching', '--description', 'd']).error, /Usage: engine workunit promote/);
    assert.match(engineFails(fix, ['workunit', 'promote']).error, /Usage: engine workunit promote/);
  });
});

describe('engine workunit promote — source shape guard', () => {
  it('refuses array-shaped sources — silent no-move is never an option', () => {
    const epic = epicManifest();
    epic.phases.specification.items['caching-strategy'].sources =
      [{ topic: 'cache-invalidation', status: 'incorporated' }];
    const fix = setupFixture({ epic });
    try {
      const err = engineFails(fix, ['workunit', 'promote', 'payments', 'caching-strategy', '--to', 'caching-policy', '--description', 'x']);
      assert.match(err.error, /array-shaped sources/);
      assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/caching-policy')), 'nothing created on refusal');
    } finally {
      fs.rmSync(fix.root, { recursive: true, force: true });
    }
  });
});
