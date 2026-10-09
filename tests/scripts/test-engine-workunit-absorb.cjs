'use strict';

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, okSections, refuses, output, keywordOnlyKnowledge, unreadableKnowledge, indexedFiles } = require('./engine-harness.cjs');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** The absorbable feature: discussion, research, an import, a seed. */
function featureManifest(overrides = {}) {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' }],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-02T10:00:00Z' }],
    phases: {
      research: { items: { 'auth-flow': { status: 'completed' } } },
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
    imports: [{ path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' }],
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

/** A git-repo project carrying the feature and the epic. */
function setupFixture({ feature = featureManifest(), epic = epicManifest() } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-absorb-'));
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init', '-q', '-b', 'main']);
  git(project, ['config', 'user.email', 'test@example.com']);
  git(project, ['config', 'user.name', 'Test']);
  git(project, ['config', 'commit.gpgsign', 'false']);

  // The knowledge directory is checkout-local, never committed.
  writeFile(project, '.workflows/.gitignore', '.knowledge/\n');
  keywordOnlyKnowledge(project);
  writeFile(project, '.workflows/manifest.json', JSON.stringify({
    work_units: { 'auth-flow': { work_type: 'feature' }, payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.workflows/auth-flow/manifest.json', JSON.stringify(feature, null, 2) + '\n');
  writeFile(project, '.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n');
  writeFile(project, '.workflows/auth-flow/research/auth-flow.md', '# Research\n');
  writeFile(project, '.workflows/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(project, '.workflows/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(project, '.workflows/payments/manifest.json', JSON.stringify(epic, null, 2) + '\n');
  writeFile(project, '.workflows/payments/research/exploration.md', '# Epic exploration\n');
  writeFile(project, '.workflows/payments/imports/roadmap.md', '# Roadmap\n');
  // A file-only collision in the epic's imports dir — dedupe must dodge it.
  writeFile(project, '.workflows/payments/imports/notes.md', '# Epic notes\n');
  git(project, ['add', '-A']);
  git(project, ['commit', '-q', '-m', 'init']);

  return { root, project };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(fix, args, env = {}) {
  const { res, sections } = okSections(fix.project, args, { env });
  engine.lastSections = sections;
  return res;
}
engine.lastSections = '';

/** Run the engine expecting failure; returns the parsed stderr JSON. */
const engineFails = (fix, args, env = {}) => refuses(fix.project, args, { env });

/** Index each file as it stands, so the store holds chunks a transaction can remove. */
function indexFiles(fix, files) {
  for (const file of files) output(fix.project, ['knowledge', 'index', file]);
}

/** The feature's own artifacts, indexed where it stands before the absorb. */
const FEATURE_FILES = [
  '.workflows/auth-flow/discussion/auth-flow.md',
  '.workflows/auth-flow/imports/notes.md',
  '.workflows/auth-flow/research/auth-flow.md',
  '.workflows/auth-flow/seeds/seed.md',
];

function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows', wu, 'manifest.json'), 'utf8'));
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
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('render absorb-summary derives the pre-confirm display from the feature manifest — top-level experiments only', () => {
    const feature = featureManifest();
    feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: {
      E1: { slug: 'x', status: 'concluded', verdict: 'held' },
      'E1.1': { slug: 'y', status: 'concluded', verdict: 'held' },
      E2: { slug: 'z', status: 'running' },
    } } } };
    fix = setupFixture({ feature });
    const out = output(fix.project, ['render', 'absorb-summary', 'auth-flow', '--into', 'payments', '--topic', 'auth']);
    assert.match(out, /DISPLAY: absorb summary/);
    assert.match(out, /Feature: {6}Auth Flow/);
    assert.match(out, /Target: {7}Payments/);
    assert.match(out, /Topic: {8}auth/);
    assert.match(out, /Discussion: {3}\[completed\]/);
    assert.match(out, /Research: {5}\[completed\]/);
    assert.match(out, /Experiments: {2}2 experiment\(s\)/, 'a series E1, E1.1, E2 is two experiments — subs never count');
    assert.match(out, /Seed: {9}1 file\(s\) \(origin\)/);
    assert.match(out, /Imports: {6}1 file\(s\)/);
    assert.match(out, /• Move experiment series to epic/);
    assert.match(out, /• Remove feature work unit and directory/);
    assert.match(engineFails(fix, ['render', 'absorb-summary', 'payments', '--into', 'payments', '--topic', 'auth']).error,
      /"payments" is not a feature/);
  });

  it('moves everything, mirrors statuses, deletes the feature, commits all three pathspecs once', () => {
    fix = setupFixture();
    indexFiles(fix, [...FEATURE_FILES, '.workflows/payments/research/exploration.md']);
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    writeFile(fix.project, '.workflows/.cache/auth-flow/discussion/auth-flow/review-1.md', 'scratch\n');
    const res = engine(fix, ABSORB);
    assert.strictEqual(fs.existsSync(path.join(fix.project, '.workflows/.cache/auth-flow')), false,
      "the absorbed feature's scratch cache is purged with it");

    assert.deepStrictEqual(res, {
      ok: true,
      feature: 'auth-flow',
      epic: 'payments',
      topic: 'auth',
      discussion: { path: 'discussion/auth.md', status: 'completed' },
      research: [
        { from: 'auth-flow', topic: 'auth', status: 'completed' },
      ],
      imports: [{ path: 'imports/notes-2.md' }],
      renamed_imports: [{ from: 'notes.md', to: 'notes-2.md' }],
      seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea' }],
      routing: 'research',
      committed: shortHead(fix),
      warnings: [],
    });
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'research,seeds,imports']);
    assert.match(receipt, new RegExp([
      'Absorbed into Epic',
      '',
      'Topic "Auth" added to Payments\\.',
      '',
      '  • Discussion: moved',
      '  • Research: moved',
      '  • Seed: moved',
      '  • Imports: moved',
      '  • Feature: removed',
    ].join('\\n')));

    // Files landed at their epic identities; the feature directory is gone.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/auth.md'), 'utf8'), '# Discussion\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/research/auth.md'), 'utf8'), '# Research\n');
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
    assert.strictEqual(res.experiment, undefined, 'a feature with no series reports none');
    assert.strictEqual(m.phases.experiment, undefined, 'a feature with no series lands no experiment phase');
    assert.match(engineFails(fix, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--experiments', '2']).error,
      /no experiment series "auth" on "payments"/);
    assert.deepStrictEqual(m.phases.research.items, {
      exploration: { status: 'completed' },
      auth: { status: 'completed' },
    });
    assert.deepStrictEqual(m.imports, [
      { path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' },
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
    // completed phase artifacts only, imports and seeds always — and the
    // epic's own chunks left standing.
    assert.deepStrictEqual(indexedFiles(fix.project), [
      '.workflows/payments/discussion/auth.md',
      '.workflows/payments/imports/notes-2.md',
      '.workflows/payments/research/auth.md',
      '.workflows/payments/research/exploration.md',
      '.workflows/payments/seeds/seed.md',
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
    indexFiles(fix, ['.workflows/auth-flow/discussion/auth-flow.md']);
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
    assert.deepStrictEqual(indexedFiles(fix.project), []);
  });

  it('a live reconcile flag travels with the absorbed discussion — research moves with it, so the flag stays true', () => {
    const feature = featureManifest();
    feature.phases.discussion.items['auth-flow'].reconcile_needed = 'research';
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.strictEqual(m.phases.discussion.items.auth.reconcile_needed, 'research');
    assert.strictEqual(m.phases.discussion.items.auth.status, feature.phases.discussion.items['auth-flow'].status);
  });

  it('dismissed grounds travel with the material — discussion and research alike', () => {
    const feature = featureManifest();
    feature.phases.discussion.items['auth-flow'].dismissed_grounds = ['token rotation is out of scope'];
    feature.phases.research.items['auth-flow'].dismissed_grounds = ['vendor pricing was already ruled out'];
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items.auth.dismissed_grounds, ['token rotation is out of scope']);
    // The research landed at the topic name — the grounds follow the
    // material to its new name.
    assert.deepStrictEqual(m.phases.research.items.auth.dismissed_grounds,
      ['vendor pricing was already ruled out']);
    assert.strictEqual(m.phases.research.items.exploration.dismissed_grounds, undefined,
      'the epic\'s own topic gains no field');
  });

  it('a phase item travels key-complete — whatever a feature item carries, the epic item carries', () => {
    const feature = featureManifest();
    Object.assign(feature.phases.discussion.items['auth-flow'], {
      subtopics: { rotation: { status: 'decided', parent: null } },
      dismissed_grounds: ['x'], reconcile_needed: 'research', awaiting_experiments: [], future_field: { any: 'shape' },
    });
    Object.assign(feature.phases.research.items['auth-flow'], {
      threads: { q: { question: 'Q?', status: 'open', origin: 'seed', parent: null } },
      dismissed_grounds: ['y'], another_field: 7,
    });
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(Object.keys(m.phases.discussion.items.auth).sort(), Object.keys(feature.phases.discussion.items['auth-flow']).sort());
    assert.deepStrictEqual(Object.keys(m.phases.research.items.auth).sort(), Object.keys(feature.phases.research.items['auth-flow']).sort());
    assert.deepStrictEqual(m.phases.discussion.items.auth.future_field, { any: 'shape' });
    assert.strictEqual(m.phases.research.items.auth.another_field, 7);
  });

  it('the Discussion Map travels whole — every subtopic, its state, its parent, at the new name', () => {
    const feature = featureManifest();
    const subtopics = {
      'token-rotation': { status: 'decided', parent: null },
      'refresh-window': { status: 'exploring', parent: 'token-rotation' },
      'session-pinning': { status: 'deferred', parent: null },
    };
    feature.phases.discussion.items['auth-flow'].subtopics = JSON.parse(JSON.stringify(subtopics));
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items.auth.subtopics, subtopics);
  });

  it('the thread register travels whole — every thread, its state, its origin, at the new name', () => {
    const feature = featureManifest();
    const threads = {
      'hosted-fields': { question: 'What does moving the checkout take?', status: 'open', origin: 'seed', parent: null },
      'capture-confirm': { question: 'Does capture confirmation change?', status: 'open', origin: 'user', parent: 'hosted-fields' },
      'second-provider': { question: 'A second provider?', status: 'parked', origin: 'conversation', parent: null, note: 'not this year' },
    };
    feature.phases.research.items['auth-flow'].threads = JSON.parse(JSON.stringify(threads));
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.research.items.auth.threads, threads);
    assert.strictEqual(m.phases.research.items.exploration.threads, undefined, 'the epic\'s own topic gains no register');
  });

  it('the experiment series travels whole — records, statuses, verdicts, directory', () => {
    const feature = featureManifest();
    feature.phases.experiment = {
      items: {
        'auth-flow': {
          status: 'in-progress',
          experiments: {
            E1: { slug: 'webhook-dup-rate', status: 'concluded', verdict: 'duplicates at 5% — idempotency built for v1' },
            'E1.1': { slug: 'sandbox-only', status: 'abandoned', reason: 'the sandbox export already covers it' },
            E2: { slug: 'retry-window', status: 'running' },
          },
        },
      },
    };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/problem.md', '# Problem\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/design.md', '# Design\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/report.md', '# Report\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/data/deliveries.csv', 'evt,count\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/E1.1-sandbox-only/problem.md', '# Sub problem\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E2-retry-window/problem.md', '# Problem 2\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'series']);

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.experiment, {
      path: 'experiment/auth',
      status: 'in-progress',
      experiments: ['E1', 'E1.1', 'E2'],
    });

    // The item travelled whole — derived status and every record, verdicts
    // and reasons included.
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.experiment.items, { auth: feature.phases.experiment.items['auth-flow'] });

    // The directory moved whole under the topic name — nested sub-experiment
    // and data extracts included; nothing remains behind.
    for (const rel of [
      'experiment/auth/E1-webhook-dup-rate/problem.md',
      'experiment/auth/E1-webhook-dup-rate/design.md',
      'experiment/auth/E1-webhook-dup-rate/report.md',
      'experiment/auth/E1-webhook-dup-rate/data/deliveries.csv',
      'experiment/auth/E1-webhook-dup-rate/E1.1-sandbox-only/problem.md',
      'experiment/auth/E2-retry-window/problem.md',
    ]) {
      assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments', rel)), `moved: ${rel}`);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')));

    // The store holds exactly the indexed-phase moves — no experiment file.
    assert.deepStrictEqual(indexedFiles(fix.project), [
      '.workflows/payments/discussion/auth.md',
      '.workflows/payments/imports/notes-2.md',
      '.workflows/payments/research/auth.md',
      '.workflows/payments/seeds/seed.md',
    ]);

    // The receipt names the moved series by its top-level count — E1, E1.1,
    // E2 is two experiments, never three; a non-count refuses.
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'research,seeds,imports', '--experiments', '2']);
    assert.match(receipt, /• Research: moved\n {2}• Experiments: 2 moved\n {2}• Seed: moved/);
    assert.match(engineFails(fix, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--experiments', '0']).error,
      /--experiments must be a positive experiment count/);

    // The continuation menu renders from the post-absorb state; the
    // feature's name travels as a flag — the unit itself is gone.
    const continuation = output(fix.project, ['render', 'absorb-continuation', 'payments', '--feature', 'auth-flow']);
    assert.match(continuation, /MENU: absorb continuation/);
    assert.match(continuation, /\*\*Auth Flow\*\* absorbed into \*\*Payments\*\*\./);
    assert.match(continuation, /\*\*`c\/continue`\*\* → Continue Payments as epic/);
    assert.match(continuation, /\*\*`b\/back`\*\*\s+→ Return to previous view/);
    assert.match(engineFails(fix, ['render', 'absorb-continuation', 'payments']).error,
      /--feature is required/);
  });

  it('a live evidence wait travels on its holder, and the release edge keeps holding in the epic', () => {
    const feature = featureManifest({
      phases: {
        research: { items: { 'auth-flow': { status: 'in-progress', awaiting_experiments: ['E1'], reconcile_needed: 'experiment' } } },
        discussion: { items: { 'auth-flow': { status: 'in-progress', awaiting_experiments: ['E2'] } } },
        experiment: {
          items: {
            'auth-flow': {
              status: 'in-progress',
              experiments: {
                E1: { slug: 'webhook-dup-rate', status: 'running' },
                E2: { slug: 'retry-window', status: 'running' },
              },
            },
          },
        },
      },
    });
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/research/auth-flow.md', '# Research\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/problem.md', '# Problem\n');
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E2-retry-window/problem.md', '# Problem 2\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'series']);

    // The holder-named research item must land at the topic name for the
    // wait's release join — same-name absorb keeps it.
    engine(fix, ['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'auth-flow']);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'],
      { status: 'in-progress', awaiting_experiments: ['E1'], reconcile_needed: 'experiment' },
      'the research wait and evidence flag travel untouched');
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'],
      { status: 'in-progress', awaiting_experiments: ['E2'] },
      'the discussion wait travels untouched');

    // The lock's semantics survive the move: completion still refuses, and a
    // conclusion at the epic address releases the moved holder.
    assert.match(engineFails(fix, ['topic', 'complete', 'payments', 'discussion', 'auth-flow']).error,
      /awaits experiment evidence \(E2\)/);
    const concluded = engine(fix, ['experiment', 'conclude', 'payments', 'auth-flow', 'E1', '--verdict', 'held']);
    assert.deepStrictEqual(concluded.released_waits, [{ phase: 'research', released: ['E1'], remaining: [] }]);
    assert.strictEqual(readManifest(fix, 'payments').phases.research.items['auth-flow'].awaiting_experiments, undefined);
  });

  it('KB failures are warnings, never blocks — the absorb still lands and commits', () => {
    fix = setupFixture();
    unreadableKnowledge(fix.project);
    const res = engine(fix, ABSORB);

    assert.strictEqual(res.warnings.length, 5, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge remove failed: loadStore: corrupted store file at /);
    assert.match(res.warnings[4], /^knowledge index \(seeds\/seed\.md\) failed: loadStore: corrupted store file at /);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')));

    // The absorb both removes and indexes, so its advisory names neither.
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'research,seeds,imports', '--warn']);
    assert.match(receipt, /  ⚑ Knowledge warning\n    The feature is absorbed\. The next start brings the knowledge base up to date\./);
  });
});

describe('engine workunit absorb — imports follow the material', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** The feature's imports: a linked markdown one that collides, a binary, an uncollided one. */
  function importingFeature() {
    const feature = featureManifest();
    feature.imports = [
      { path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discussion/auth-flow' },
      { path: 'imports/screen.png', imported_at: '2026-06-03T09:00:00Z', origin: 'research/auth-flow' },
      { path: 'imports/brief.md', imported_at: '2026-06-04T09:00:00Z', origin: 'discovery' },
    ];
    return feature;
  }

  function setupImporting() {
    fix = setupFixture({ feature: importingFeature() });
    writeFile(fix.project, '.workflows/auth-flow/imports/screen.png', 'png bytes\n');
    writeFile(fix.project, '.workflows/auth-flow/imports/brief.md', '# Brief\n');
    writeFile(fix.project, '.workflows/auth-flow/discussion/auth-flow.md',
      '# Discussion\n\nSee ![the ask](../imports/notes.md) and ![the screen](../imports/screen.png).\nAlso ../imports/brief.md.\n');
    writeFile(fix.project, '.workflows/auth-flow/research/auth-flow.md',
      '# Research\n\n![the ask](../imports/notes.md)\n');
    // The epic's own document links its own same-named file — untouched.
    writeFile(fix.project, '.workflows/payments/research/exploration.md',
      '# Epic exploration\n\n![epic notes](../imports/notes.md)\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'importing feature']);
  }

  it('re-aims a feature-session origin at the topic and leaves every other origin alone', () => {
    setupImporting();
    engine(fix, ABSORB);

    assert.deepStrictEqual(readManifest(fix, 'payments').imports, [
      { path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discussion/auth' },
      { path: 'imports/screen.png', imported_at: '2026-06-03T09:00:00Z', origin: 'research/auth' },
      { path: 'imports/brief.md', imported_at: '2026-06-04T09:00:00Z', origin: 'discovery' },
    ]);
  });

  it('rewrites the links its own rename broke, in the documents it moved and nowhere else', () => {
    setupImporting();
    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, [{ from: 'notes.md', to: 'notes-2.md' }]);

    const read = (rel) => fs.readFileSync(path.join(fix.project, rel), 'utf8');
    // The renamed import's link follows it; the unrenamed ones are untouched.
    assert.match(read('.workflows/payments/discussion/auth.md'), /!\[the ask\]\(\.\.\/imports\/notes-2\.md\)/);
    assert.match(read('.workflows/payments/discussion/auth.md'), /!\[the screen\]\(\.\.\/imports\/screen\.png\)/);
    assert.match(read('.workflows/payments/discussion/auth.md'), /Also \.\.\/imports\/brief\.md\./);
    assert.match(read('.workflows/payments/research/auth.md'), /!\[the ask\]\(\.\.\/imports\/notes-2\.md\)/);
    // The epic's own document names the epic's own notes.md — never rewritten.
    assert.match(read('.workflows/payments/research/exploration.md'), /!\[epic notes\]\(\.\.\/imports\/notes\.md\)/);
  });

  it('a link already naming the landed file is left as it is — the substitution is exact', () => {
    setupImporting();
    writeFile(fix.project, '.workflows/auth-flow/discussion/auth-flow.md',
      '# Discussion\n\n../imports/notes.md and ../imports/notes-2.md and ../imports/notes.md.png\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'mixed links']);
    engine(fix, ABSORB);

    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/auth.md'), 'utf8'),
      '# Discussion\n\n../imports/notes-2.md and ../imports/notes-2.md and ../imports/notes.md.png\n');
  });

  it('indexes the markdown moves alone, and the receipt names the renames', () => {
    setupImporting();
    engine(fix, ABSORB);

    assert.deepStrictEqual(indexedFiles(fix.project), [
      '.workflows/payments/discussion/auth.md',
      '.workflows/payments/imports/brief.md',
      '.workflows/payments/imports/notes-2.md',
      '.workflows/payments/research/auth.md',
      '.workflows/payments/seeds/seed.md',
    ]);
    const render = (renamed) => output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth',
        '--moved', 'research,seeds,imports', '--renamed', renamed]);
    assert.match(render('notes.md:notes-2.md'),
      /• Imports: moved\n {2}• Renamed: notes\.md → notes-2\.md \(links rewritten\)/);
    // A screenshot's own name is longer than the pane: the row wraps under
    // its text column rather than running off it.
    assert.ok(render('dockset-onboarding-permissions-ask.png:dockset-onboarding-permissions-ask-2.png').includes([
      '  • Renamed: dockset-onboarding-permissions-ask.png →',
      '    dockset-onboarding-permissions-ask-2.png (links rewritten)',
    ].join('\n')));
    assert.match(engineFails(fix, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--renamed', 'notes.md']).error,
      /--renamed entries are <from>:<to> pairs/);
  });

  it('renames two colliding imports in one pass — neither lands on the other\'s new name', () => {
    const feature = featureManifest();
    feature.imports = [
      { path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-02T09:00:00Z', origin: 'discovery' },
    ];
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/imports/notes-2.md', '# Second notes\n');
    writeFile(fix.project, '.workflows/auth-flow/discussion/auth-flow.md',
      '# Discussion\n\n![first](../imports/notes.md) and ![second](../imports/notes-2.md)\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'colliding imports']);

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, [
      { from: 'notes.md', to: 'notes-2.md' },
      { from: 'notes-2.md', to: 'notes-2-2.md' },
    ]);
    // One pass over both renames: a sequential rewrite would carry the first
    // link onto the second's new name.
    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/auth.md'), 'utf8'),
      '# Discussion\n\n![first](../imports/notes-2.md) and ![second](../imports/notes-2-2.md)\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/notes-2.md'), 'utf8'), '# Notes\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments/imports/notes-2-2.md'), 'utf8'), '# Second notes\n');
  });

  it("a prose mention of the product's own src/imports path is not a link — never rewritten", () => {
    setupImporting();
    writeFile(fix.project, '.workflows/auth-flow/discussion/auth-flow.md',
      '# Discussion\n\n![the ask](../imports/notes.md)\n\nThe bundle reads src/imports/notes.md at build time.\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'prose mention']);
    engine(fix, ABSORB);

    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.workflows/payments/discussion/auth.md'), 'utf8'),
      '# Discussion\n\n![the ask](../imports/notes-2.md)\n\nThe bundle reads src/imports/notes.md at build time.\n');
  });

  it('reports no renames when nothing collided', () => {
    const feature = featureManifest();
    feature.imports = [{ path: 'imports/unique.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' }];
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/imports/unique.md', '# Unique\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'unique import']);

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, []);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/unique.md' }]);
  });
});

describe('engine workunit absorb — mailboxes follow their documents', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Feature-relative message file → content: two messages waiting on the discussion (numbering gapped by an earlier drain), one on the research. */
  const QUEUED = {
    'discussion/.mailbox/auth-flow/001-token-rotation.md': '### Token rotation\n*From: billing · discussion · 2026-06-03*\n\nRotate on every refresh.\n',
    'discussion/.mailbox/auth-flow/003-lockout-window.md': '### Lockout window\n*From: billing · discussion · 2026-06-05*\n\nHow long a lockout holds.\n',
    'research/.mailbox/auth-flow/002-vendor-limits.md': '### Vendor limits\n*From: billing · research · 2026-06-04*\n\nWhat the vendor rate-limits.\n',
  };

  function setupQueued() {
    fix = setupFixture();
    for (const [rel, content] of Object.entries(QUEUED)) writeFile(fix.project, `.workflows/auth-flow/${rel}`, content);
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'waiting messages']);
  }

  it('moves each mailbox under the topic, names and contents intact, and the engine reads it there', () => {
    setupQueued();
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.mail_moved, [
      { phase: 'discussion', path: 'discussion/.mailbox/auth', count: 2 },
      { phase: 'research', path: 'research/.mailbox/auth', count: 1 },
    ]);
    for (const [rel, content] of Object.entries(QUEUED)) {
      const landed = rel.replace('/.mailbox/auth-flow/', '/.mailbox/auth/');
      assert.strictEqual(fs.readFileSync(path.join(fix.project, '.workflows/payments', landed), 'utf8'), content, `moved intact: ${landed}`);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')), 'the feature directory is gone');

    const discussionQueue = engine(fix, ['topic', 'mailbox', 'payments', 'discussion', 'auth']);
    assert.deepStrictEqual(discussionQueue.files, [
      '.workflows/payments/discussion/.mailbox/auth/001-token-rotation.md',
      '.workflows/payments/discussion/.mailbox/auth/003-lockout-window.md',
    ]);
    assert.deepStrictEqual(engine(fix, ['topic', 'mailbox', 'payments', 'research', 'auth']).files,
      ['.workflows/payments/research/.mailbox/auth/002-vendor-limits.md']);
  });

  it("the moves ride the absorb's one commit — nothing left dirty", () => {
    setupQueued();
    const commits = Number(git(fix.project, ['rev-list', '--count', 'HEAD']).trim());
    engine(fix, ABSORB);

    assert.strictEqual(Number(git(fix.project, ['rev-list', '--count', 'HEAD']).trim()), commits + 1);
    const staged = git(fix.project, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).trim().split('\n');
    for (const rel of Object.keys(QUEUED)) {
      assert.ok(staged.includes(`.workflows/auth-flow/${rel}`), `deletion staged: ${rel}`);
      assert.ok(staged.includes(`.workflows/payments/${rel.replace('/.mailbox/auth-flow/', '/.mailbox/auth/')}`), `landing staged: ${rel}`);
    }
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.workflows']), '');
  });

  it('a drained mailbox is no move — nothing lands in the epic and no field rides the response', () => {
    fix = setupFixture();
    fs.mkdirSync(path.join(fix.project, '.workflows/auth-flow/discussion/.mailbox/auth-flow'), { recursive: true });
    const res = engine(fix, ABSORB);

    assert.strictEqual(res.mail_moved, undefined);
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/discussion/.mailbox')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/auth-flow')));
  });
});

describe('engine workunit absorb — roadmap sources follow the material', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const readProject = () => JSON.parse(fs.readFileSync(path.join(fix.project, '.workflows/manifest.json'), 'utf8'));

  /** The fixture plus a roadmap holding `items`, and the files their sources name outside the feature. */
  function setupRoadmap(items, { feature } = {}) {
    fix = setupFixture(feature ? { feature } : {});
    writeFile(fix.project, '.workflows/auth-flow/discovery/sessions/session-001.md', '# Discovery\n');
    writeFile(fix.project, '.workflows/.roadmap/sessions/session-001.md', '# Roadmap session\n');
    const project = readProject();
    project.roadmap = { horizons: ['v1'], items };
    writeFile(fix.project, '.workflows/manifest.json', JSON.stringify(project, null, 2) + '\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'roadmap']);
  }

  /** Every source the roadmap records names a file on disk. */
  function assertSourcesOnDisk() {
    for (const [name, item] of Object.entries(readProject().roadmap.items)) {
      for (const source of item.sources || []) {
        assert.ok(fs.existsSync(path.join(fix.project, '.workflows', source)), `${name}: ${source} is on disk`);
      }
    }
  }

  it("a waiting item's discussion source names the moved discussion", () => {
    setupRoadmap({ sso: { horizon: 'v1', summary: 'single sign-on', origin: 'park:auth-flow', sources: ['auth-flow/discussion/auth-flow.md'] } });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_sources_rewritten, [
      { item: 'sso', from: 'auth-flow/discussion/auth-flow.md', to: 'payments/discussion/auth.md' },
    ]);
    assert.strictEqual(res.roadmap_sources_dropped, undefined);
    assert.strictEqual(res.roadmap_reaimed, undefined, 'a waiting item has no join to re-aim');
    assert.deepStrictEqual(readProject().roadmap.items.sso,
      { horizon: 'v1', summary: 'single sign-on', origin: 'park:auth-flow', sources: ['payments/discussion/auth.md'] });
    assertSourcesOnDisk();
  });

  it("a joined item's research and discussion sources follow, and its join is re-aimed as before", () => {
    setupRoadmap({ login: {
      horizon: 'v1', summary: 'log in', origin: 'harvest',
      sources: ['auth-flow/research/auth-flow.md', 'auth-flow/discussion/auth-flow.md'],
      pulled_to: { work_unit: 'auth-flow' },
    } });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_reaimed, ['login']);
    const item = readProject().roadmap.items.login;
    assert.deepStrictEqual(item.pulled_to, { work_unit: 'payments', topic: 'auth' });
    assert.deepStrictEqual(item.sources, ['payments/research/auth.md', 'payments/discussion/auth.md'], 'order kept');
    assertSourcesOnDisk();
  });

  it('an import source takes the name the dedupe gave it; a seed and an experiment record follow theirs', () => {
    const feature = featureManifest();
    feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'dup-rate', status: 'running' } } } } };
    setupRoadmap({ webhooks: { horizon: 'v1', summary: 'webhooks', origin: 'harvest', sources: [
      'auth-flow/imports/notes.md',
      'auth-flow/seeds/seed.md',
      'auth-flow/experiment/auth-flow/E1-dup-rate/problem.md',
    ] } }, { feature });
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-dup-rate/problem.md', '# Problem\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'series']);
    engine(fix, ABSORB);

    assert.deepStrictEqual(readProject().roadmap.items.webhooks.sources, [
      'payments/imports/notes-2.md',
      'payments/seeds/seed.md',
      'payments/experiment/auth/E1-dup-rate/problem.md',
    ]);
    assertSourcesOnDisk();
  });

  it('a source nothing moved goes with the feature — the sources field too, once empty', () => {
    setupRoadmap({
      lone: { horizon: 'v1', summary: 'lone', origin: 'park:auth-flow', sources: ['auth-flow/discovery/sessions/session-001.md'] },
      mixed: { horizon: 'v1', summary: 'mixed', origin: 'harvest', sources: [
        'auth-flow/discovery/sessions/session-001.md',
        '.roadmap/sessions/session-001.md',
        'auth-flow/discussion/auth-flow.md',
      ] },
    });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_sources_dropped, [
      { item: 'lone', source: 'auth-flow/discovery/sessions/session-001.md' },
      { item: 'mixed', source: 'auth-flow/discovery/sessions/session-001.md' },
    ]);
    const items = readProject().roadmap.items;
    assert.deepStrictEqual(items.lone, { horizon: 'v1', summary: 'lone', origin: 'park:auth-flow' });
    assert.deepStrictEqual(items.mixed.sources, ['.roadmap/sessions/session-001.md', 'payments/discussion/auth.md']);
    assertSourcesOnDisk();
  });

  it("a source outside the feature is untouched — a sibling unit sharing the name's prefix included", () => {
    const outside = ['.roadmap/sessions/session-001.md', 'payments/research/exploration.md', 'auth-flow-v2/discussion/auth-flow-v2.md'];
    setupRoadmap({ other: { horizon: 'v1', summary: 'other', origin: 'harvest', sources: outside } });
    const before = readProject().roadmap;
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(readProject().roadmap, before, 'the roadmap node is exactly as it was');
    for (const field of ['roadmap_reaimed', 'roadmap_sources_rewritten', 'roadmap_sources_dropped']) {
      assert.strictEqual(res[field], undefined, `${field} is absent when nothing moved on the roadmap`);
    }
  });

  it('no roadmap: nothing is written for one, and no roadmap field rides the response', () => {
    fix = setupFixture();
    const res = engine(fix, ABSORB);

    assert.strictEqual('roadmap' in readProject(), false, 'no node is born');
    for (const field of ['roadmap_reaimed', 'roadmap_sources_rewritten', 'roadmap_sources_dropped']) {
      assert.strictEqual(res[field], undefined);
    }
  });

  it("the rewrite rides the absorb's one commit — the project manifest committed, nothing left dirty", () => {
    setupRoadmap({ sso: { horizon: 'v1', summary: 'single sign-on', origin: 'park:auth-flow', sources: ['auth-flow/discussion/auth-flow.md'] } });
    const commits = Number(git(fix.project, ['rev-list', '--count', 'HEAD']).trim());
    engine(fix, ABSORB);

    assert.strictEqual(Number(git(fix.project, ['rev-list', '--count', 'HEAD']).trim()), commits + 1);
    const staged = git(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json'));
    const committed = JSON.parse(git(fix.project, ['show', 'HEAD:.workflows/manifest.json']));
    assert.deepStrictEqual(committed.roadmap.items.sso.sources, ['payments/discussion/auth.md']);
    assert.strictEqual(git(fix.project, ['status', '--porcelain', '--', '.workflows']), '');
  });
});

describe('engine workunit absorb — guards refuse loudly, both work units pristine', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

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
    fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

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
    fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

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
    // The schema's plain-name rule, not a dot/slash spelling: the topic is
    // substituted into every re-aimed import origin.
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'auth '], /not a legal topic name/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'fee-model'], /already on payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'dead-idea'], /was dismissed from payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'session-model'], /discussion topic "session-model" already exists/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'on-disk'], /discussion\/on-disk\.md already exists/);
  });

  it('refuses an experiment collision in the epic — item or directory on disk', () => {
    const withSeries = () => featureManifest({
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        experiment: { items: { 'auth-flow': { status: 'completed', experiments: { E1: { slug: 'webhook-dup-rate', status: 'concluded', verdict: 'held' } } } } },
      },
    });
    const epic = epicManifest();
    epic.phases.experiment = { items: { auth: { status: 'completed', experiments: { E1: { slug: 'other', status: 'concluded', verdict: 'stands' } } } } };
    fix = setupFixture({ feature: withSeries(), epic });
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/problem.md', '# Problem\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'series']);
    refusedPristine(ABSORB, /experiment topic "auth" already exists in payments/);
    fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

    fix = setupFixture({ feature: withSeries() });
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/problem.md', '# Problem\n');
    writeFile(fix.project, '.workflows/payments/experiment/auth/stray.md', '# Orphan dir\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'orphan series dir']);
    refusedPristine(ABSORB, /experiment\/auth already exists/);
  });

  it('refuses a mailbox already at the topic in the epic — the messages never merge into it', () => {
    fix = setupFixture();
    writeFile(fix.project, '.workflows/auth-flow/discussion/.mailbox/auth-flow/001-token-rotation.md', '### Token rotation\n');
    writeFile(fix.project, '.workflows/payments/discussion/.mailbox/auth/001-stray.md', '### Stray\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'mailbox collision']);
    refusedPristine(ABSORB, /\.workflows\/payments\/discussion\/\.mailbox\/auth already exists — pick a different name/);
  });

  it('the research lands at the topic name — a renamed absorb keeps every experiment join intact', () => {
    // The wait's release edge and the register both address
    // `phases.experiment.items.{topic}` — the research landing at the topic
    // name is what keeps the join true after a renamed absorb.
    const feature = featureManifest();
    feature.phases.research.items['auth-flow'].awaiting_experiments = ['E1'];
    feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'webhook-dup-rate', status: 'running' } } } } };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/experiment/auth-flow/E1-webhook-dup-rate/problem.md', '# Problem\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'series']);
    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.research,
      [{ from: 'auth-flow', topic: 'auth', status: 'completed' }]);
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.research.items.auth,
      { status: 'completed', awaiting_experiments: ['E1'] });
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/payments/research/auth.md')),
      'the research lands at the topic name on disk too');
    // The join holds end to end: the conclusion at the epic address releases
    // the moved wait.
    const concluded = engine(fix, ['experiment', 'conclude', 'payments', 'auth', 'E1', '--verdict', 'held']);
    assert.deepStrictEqual(concluded.released_waits, [{ phase: 'research', released: ['E1'], remaining: [] }]);
  });

  it('refuses a research collision on the topic name — item or file on disk', () => {
    const epic = epicManifest();
    epic.phases.research.items.auth = { status: 'completed' };
    fix = setupFixture({ epic });
    writeFile(fix.project, '.workflows/payments/research/auth.md', '# Epic auth research\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'epic auth research']);
    refusedPristine(ABSORB, /research topic "auth" already exists in payments — pick a different name/);
    fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

    fix = setupFixture();
    writeFile(fix.project, '.workflows/payments/research/auth.md', '# Orphan\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'orphan research file']);
    refusedPristine(ABSORB, /research\/auth\.md already exists — pick a different name/);
  });

  it('refuses a research item not named after the feature — single and self-named, and deletion follows', () => {
    const feature = featureManifest();
    feature.phases.research.items.exploration = { status: 'completed' };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/research/exploration.md', '# Exploration\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'foreign research item']);
    refusedPristine(ABSORB, /research item "exploration" not named after it — a feature's research is single and self-named/);
  });

  it('refuses a foreign-named experiment series — deletion follows, so a silent skip would lose it', () => {
    const feature = featureManifest();
    feature.phases.experiment = { items: { stray: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/experiment/stray/E1-x/problem.md', '# P\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'foreign series']);
    refusedPristine(ABSORB, /experiment item "stray" not named after it — a feature's experiment is single and self-named/);
  });

  it('refuses a foreign-named discussion item — the same guard covers every moved phase', () => {
    const feature = featureManifest();
    feature.phases.discussion.items.tangent = { status: 'completed' };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.workflows/auth-flow/discussion/tangent.md', '# Tangent\n');
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'foreign discussion item']);
    refusedPristine(ABSORB, /discussion item "tangent" not named after it — a feature's discussion is single and self-named/);
  });

  it('closes the crash window: a research file missing on disk leaves both units pristine', () => {
    fix = setupFixture();
    indexFiles(fix, FEATURE_FILES);
    fs.rmSync(path.join(fix.project, '.workflows/auth-flow/research/auth-flow.md'));
    git(fix.project, ['add', '-A']);
    git(fix.project, ['commit', '-q', '-m', 'drop research file']);
    refusedPristine(ABSORB, /research file missing on disk: \.workflows\/auth-flow\/research\/auth-flow\.md/);
    // Validation refused before ANY move — the discussion is still the
    // feature's, the epic gained nothing, and the store holds the feature's
    // chunks as it did: none removed, none indexed at the epic.
    assert.ok(fs.existsSync(path.join(fix.project, '.workflows/auth-flow/discussion/auth-flow.md')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.workflows/payments/discussion/auth.md')));
    assert.deepStrictEqual(indexedFiles(fix.project), FEATURE_FILES);
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
