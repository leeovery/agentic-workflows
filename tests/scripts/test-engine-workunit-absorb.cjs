'use strict';

// ---------------------------------------------------------------------------
// `workunit absorb` (domain/workunit-absorb.cjs; 18.3.5): a feature merged
// into an in-progress epic as a new topic and deleted, in one transaction —
// its topic folder, imports, seeds, assets and spikes moved, each under the
// landing's dedupe with the links a rename broke rewritten, its phase items
// carried whole, its mailbox and its roadmap sources following, the
// knowledge base re-synced, one commit; the screens before and after it;
// and every refusal leaving both units as they were. What it does to the
// ledger is test-engine-workunit-absorb-ledger.cjs's.
//
// Layer: verb. World: absorb-world.cjs's feature and epic, a project of
// each test's own, or one built once and copied where a test's material
// costs commits.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, stateGit, output, unreadableKnowledge, indexedFiles, commitAll, fixtureFrom } = require('./engine-harness.cjs');
const { holdsWriterLock } = require('../../skills/leeway-engine/scripts/kernel/manifest-io.cjs');
const {
  ABSORB, writeFile, featureManifest, epicManifest, fillFixture, setupFixture, copyFixture, engine, engineFails, inEpic, readManifest, shortHead, headFiles, treeSnapshot,
} = require('./absorb-world.cjs');

/** Index each file as it stands, so the store holds chunks a transaction can remove. */
function indexFiles(fix, files) {
  for (const file of files) output(fix.project, ['knowledge', 'index', path.join(fix.project, '.leeway', file)]);
}

/** The feature's own indexed artifacts — its discussion is never indexed (9.2.2). */
const FEATURE_FILES = [
  'auth-flow/imports/notes.md',
  'auth-flow/seeds/seed.md',
];

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
    assert.match(out, /Experiments: {2}2 experiment\(s\)/, 'a series E1, E1.1, E2 is two experiments — subs never count');
    assert.match(out, /Seed: {9}1 file\(s\) \(origin\)/);
    assert.match(out, /Imports: {6}1 file\(s\)/);
    assert.match(out, /• Move experiment series to epic/);
    assert.match(out, /• Remove feature work unit and directory/);
    assert.match(engineFails(fix, ['render', 'absorb-summary', 'payments', '--into', 'payments', '--topic', 'auth']).error,
      /"payments" is not a feature/);
  });

  it('moves everything, mirrors statuses, deletes the feature, commits all three pathspecs once', (t) => {
    fix = setupFixture();
    indexFiles(fix, [...FEATURE_FILES, 'payments/imports/roadmap.md']);
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    writeFile(fix.project, '.leeway/.cache/auth-flow/discussion/auth-flow/review-1.md', 'scratch\n');
    writeFile(fix.project, '.leeway/.cache/.set-aside/auth-flow/round-1/put-1/src/draft.md', 'put back\n');
    const marks = path.join(fix.project, '.leeway/.cache/.marks');
    writeFile(fix.project, '.leeway/.cache/.marks/auth-flow.json', '{"shown":[]}\n');
    writeFile(fix.project, '.leeway/.cache/.marks/payments.json', '{"shown":[]}\n');
    const rmSync = fs.rmSync;
    /** @type {boolean[][]} */
    const lockedAsRemoved = [];
    t.mock.method(fs, 'rmSync', (/** @type {string} */ target, /** @type {fs.RmOptions} */ opts) => {
      if (target.endsWith(path.join('.marks', 'auth-flow.json'))) lockedAsRemoved.push([holdsWriterLock(path.join(fix.project, '.leeway')), fs.existsSync(`${target}.lock`)]);
      return rmSync(target, opts);
    });
    const codeHead = git(fix.project, ['rev-parse', 'HEAD']);
    const stateCommits = Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']));
    const res = engine(fix, ABSORB);
    assert.strictEqual(fs.existsSync(path.join(fix.project, '.leeway/.cache/auth-flow')), false,
      "the absorbed feature's scratch cache is purged with it");
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/.cache/.set-aside/auth-flow/round-1/put-1/src/draft.md'), 'utf8'), 'put back\n',
      'what its review\'s put back set aside outlives it');
    assert.deepStrictEqual([fs.readdirSync(marks), lockedAsRemoved], [['payments.json'], [[true, true]]],
      "the absorbed feature's last-looked mark goes with it, under the mark's lock taken inside the writer lock, and the epic's stays");

    assert.deepStrictEqual(res, {
      ok: true,
      feature: 'auth-flow',
      epic: 'payments',
      topic: 'auth',
      discussion: { path: inEpic(fix, 'topics/auth/log.md'), status: 'completed' },
      imports: [{ path: inEpic(fix, 'imports/notes-2.md') }],
      renamed_imports: [{ from: 'notes.md', to: 'notes-2.md' }],
      assets: [],
      renamed_assets: [],
      spikes: [],
      renamed_spikes: [],
      seeds: [{ path: inEpic(fix, 'seeds/seed.md'), source: 'inbox:idea' }],
      committed: shortHead(fix),
      warnings: [],
    });
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.ledger.jsonl')), 'a feature holding no ledger line writes no carry, and needs no conversation');
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'seeds,imports']);
    assert.match(receipt, new RegExp([
      'Absorbed into Epic',
      '',
      'Topic "Auth" added to Payments\\.',
      '',
      '  • Discussion: moved',
      '  • Seed: moved',
      '  • Imports: moved',
      '  • Feature: removed',
    ].join('\\n')));

    // Files landed at their epic identities; the feature directory is gone.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md'), 'utf8'), '# Discussion\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/imports/notes-2.md'), 'utf8'), '# Notes\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/seeds/seed.md'), 'utf8'), '# Seed\n');
    // The epic's own colliding files are untouched.
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/imports/notes.md'), 'utf8'), '# Epic notes\n');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/auth-flow')));

    // Epic manifest: statuses mirrored, entries carry their ORIGINAL
    // timestamps (and seed provenance), map item lands backfill-shaped.
    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items, { auth: { status: 'completed' } });
    assert.strictEqual(res.experiment, undefined, 'a feature with no series reports none');
    assert.strictEqual(m.phases.experiment, undefined, 'a feature with no series lands no experiment phase');
    assert.match(engineFails(fix, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--experiments', '2']).error,
      /no experiment series "auth" on "payments"/);
    assert.deepStrictEqual(m.imports, [
      { path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' },
    ]);
    assert.deepStrictEqual(m.seeds, [
      { path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-02T10:00:00Z' },
    ]);
    assert.deepStrictEqual(m.phases.discovery.items.auth, { source: 'discovery' });

    // Registration removed; the epic's stays.
    const project = JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway/manifest.json'), 'utf8'));
    assert.deepStrictEqual(project.work_units, { payments: { work_type: 'epic' } });

    // ONE state commit staging all three pathspecs — feature deletion, epic,
    // project manifest — with the engine-owned message; none in the code tree.
    assert.strictEqual(Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD'])), stateCommits + 1);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']), codeHead);
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(auth-flow): absorb into payments');
    const staged = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('auth-flow/manifest.json'), 'feature deletion staged');
    assert.ok(staged.includes('payments/topics/auth/log.md'), 'epic addition staged');
    assert.ok(staged.includes('manifest.json'), 'project manifest staged');
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    // KB: feature chunks removed, the moved imports and seeds indexed at their
    // epic identities — the discussion never — and the epic's own chunks left
    // standing.
    assert.deepStrictEqual(indexedFiles(fix.project), [
      'payments/imports/notes-2.md',
      'payments/imports/roadmap.md',
      'payments/seeds/seed.md',
    ]);
  });

  it('an in-progress discussion alone: its status mirrored, a map row written for it, nothing indexed', () => {
    const feature = featureManifest({
      imports: undefined,
      seeds: undefined,
      phases: { discussion: { items: { 'auth-flow': { status: 'in-progress' } } } },
    });
    delete feature.imports;
    delete feature.seeds;
    fix = setupFixture({ feature });
    indexFiles(fix, ['payments/imports/roadmap.md']);
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.discussion, { path: inEpic(fix, 'topics/auth/log.md'), status: 'in-progress' });
    assert.deepStrictEqual(res.imports, []);
    assert.deepStrictEqual(res.seeds, []);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items, { auth: { status: 'in-progress' } });
    assert.deepStrictEqual(m.phases.discovery.items.auth, { source: 'discovery' });
    assert.deepStrictEqual(indexedFiles(fix.project), ['payments/imports/roadmap.md']);
  });

  it('a phase item travels key-complete — whatever a feature item carries, the epic item carries', () => {
    const feature = featureManifest();
    Object.assign(feature.phases.discussion.items['auth-flow'], {
      awaiting_experiments: [], future_field: { any: 'shape' }, another_field: 7,
    });
    fix = setupFixture({ feature });
    engine(fix, ABSORB);

    const m = readManifest(fix, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items.auth, feature.phases.discussion.items['auth-flow']);
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
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/problem.md', '# Problem\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/design.md', '# Design\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/report.md', '# Report\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/data/deliveries.csv', 'evt,count\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/E1.1-sandbox-only/problem.md', '# Sub problem\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E2-retry-window/problem.md', '# Problem 2\n');
    commitAll(fix.project, 'series');

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.experiment, {
      path: inEpic(fix, 'topics/auth/experiments'),
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
      'topics/auth/experiments/E1-webhook-dup-rate/problem.md',
      'topics/auth/experiments/E1-webhook-dup-rate/design.md',
      'topics/auth/experiments/E1-webhook-dup-rate/report.md',
      'topics/auth/experiments/E1-webhook-dup-rate/data/deliveries.csv',
      'topics/auth/experiments/E1-webhook-dup-rate/E1.1-sandbox-only/problem.md',
      'topics/auth/experiments/E2-retry-window/problem.md',
    ]) {
      assert.ok(fs.existsSync(path.join(fix.project, '.leeway/payments', rel)), `moved: ${rel}`);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/auth-flow')));

    // The store holds exactly the indexed moves — no experiment file.
    assert.deepStrictEqual(indexedFiles(fix.project), [
      'payments/imports/notes-2.md',
      'payments/seeds/seed.md',
    ]);

    // The receipt names the moved series by its top-level count — E1, E1.1,
    // E2 is two experiments, never three; a non-count refuses.
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'seeds,imports', '--experiments', '2']);
    assert.match(receipt, /• Discussion: moved\n {2}• Experiments: 2 moved\n {2}• Seed: moved/);
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
        discussion: { items: { 'auth-flow': { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] } } },
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
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/problem.md', '# Problem\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E2-retry-window/problem.md', '# Problem 2\n');
    commitAll(fix.project, 'series');

    // The holder-named discussion item lands at the topic name for the
    // wait's release join — same-name absorb keeps it.
    engine(fix, ['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'auth-flow']);

    assert.deepStrictEqual(readManifest(fix, 'payments').phases.discussion.items['auth-flow'],
      { status: 'in-progress', awaiting_experiments: ['E1', 'E2'] },
      'the discussion wait travels untouched');

    // The release edge survives the move: a conclusion at the epic address
    // releases the moved holder.
    const concluded = engine(fix, ['experiment', 'conclude', 'payments', 'auth-flow', 'E1', '--verdict', 'held']);
    assert.deepStrictEqual(concluded.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: ['E2'] }]);
    assert.deepStrictEqual(readManifest(fix, 'payments').phases.discussion.items['auth-flow'].awaiting_experiments, ['E2']);
  });

  it('KB failures are warnings, never blocks — the absorb still lands and commits', () => {
    fix = setupFixture();
    unreadableKnowledge(fix.project);
    const res = engine(fix, ABSORB);

    assert.strictEqual(res.warnings.length, 3, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge remove failed: loadStore: corrupted store file at /);
    assert.match(res.warnings[2], /^knowledge index \(seeds\/seed\.md\) failed: loadStore: corrupted store file at /);
    assert.strictEqual(res.committed, shortHead(fix));
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/auth-flow')));

    // The absorb both removes and indexes, so its advisory names neither.
    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'seeds,imports', '--warn']);
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
      { path: 'imports/screen.png', imported_at: '2026-06-03T09:00:00Z', origin: 'roadmap' },
      { path: 'imports/brief.md', imported_at: '2026-06-04T09:00:00Z', origin: 'discovery' },
    ];
    return feature;
  }

  function setupImporting() {
    fix = setupFixture({ feature: importingFeature() });
    writeFile(fix.project, '.leeway/auth-flow/imports/screen.png', 'png bytes\n');
    writeFile(fix.project, '.leeway/auth-flow/imports/brief.md', '# Brief\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md',
      '# Discussion\n\nSee ![the ask](../../imports/notes.md) and ![the screen](../../imports/screen.png).\nAlso ../../imports/brief.md.\n');
    // The epic's own document links its own same-named file — untouched.
    writeFile(fix.project, '.leeway/payments/topics/fee-model/brief.md',
      '# Fees\n\n![epic notes](../../imports/notes.md)\n');
    commitAll(fix.project, 'importing feature');
  }

  it('re-aims a feature-session origin at the topic and leaves every other origin alone', () => {
    setupImporting();
    engine(fix, ABSORB);

    assert.deepStrictEqual(readManifest(fix, 'payments').imports, [
      { path: 'imports/roadmap.md', imported_at: '2026-05-01T08:00:00Z', origin: 'discovery' },
      { path: 'imports/notes-2.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discussion/auth' },
      { path: 'imports/screen.png', imported_at: '2026-06-03T09:00:00Z', origin: 'roadmap' },
      { path: 'imports/brief.md', imported_at: '2026-06-04T09:00:00Z', origin: 'discovery' },
    ]);
  });

  it('rewrites the links its own rename broke, in the documents it moved and nowhere else', () => {
    setupImporting();
    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, [{ from: 'notes.md', to: 'notes-2.md' }]);

    const read = (rel) => fs.readFileSync(path.join(fix.project, rel), 'utf8');
    // The renamed import's link follows it; the unrenamed ones are untouched.
    assert.match(read('.leeway/payments/topics/auth/log.md'), /!\[the ask\]\(\.\.\/\.\.\/imports\/notes-2\.md\)/);
    assert.match(read('.leeway/payments/topics/auth/log.md'), /!\[the screen\]\(\.\.\/\.\.\/imports\/screen\.png\)/);
    assert.match(read('.leeway/payments/topics/auth/log.md'), /Also \.\.\/\.\.\/imports\/brief\.md\./);
    // The epic's own document names the epic's own notes.md — never rewritten.
    assert.match(read('.leeway/payments/topics/fee-model/brief.md'), /!\[epic notes\]\(\.\.\/\.\.\/imports\/notes\.md\)/);
  });

  it('a link already naming the landed file is left as it is — the substitution is exact', () => {
    setupImporting();
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md',
      '# Discussion\n\n../../imports/notes.md and ../../imports/notes-2.md and ../../imports/notes.md.png\n');
    commitAll(fix.project, 'mixed links');
    engine(fix, ABSORB);

    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md'), 'utf8'),
      '# Discussion\n\n../../imports/notes-2.md and ../../imports/notes-2.md and ../../imports/notes.md.png\n');
  });

  it('indexes the markdown moves alone, and the receipt names the renames', () => {
    setupImporting();
    engine(fix, ABSORB);

    assert.deepStrictEqual(indexedFiles(fix.project), [
      'payments/imports/brief.md',
      'payments/imports/notes-2.md',
      'payments/seeds/seed.md',
    ]);
    const render = (renamed) => output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth',
        '--moved', 'seeds,imports', '--renamed', renamed]);
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
    writeFile(fix.project, '.leeway/auth-flow/imports/notes-2.md', '# Second notes\n');
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md',
      '# Discussion\n\n![first](../../imports/notes.md) and ![second](../../imports/notes-2.md)\n');
    commitAll(fix.project, 'colliding imports');

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, [
      { from: 'notes.md', to: 'notes-2.md' },
      { from: 'notes-2.md', to: 'notes-2-2.md' },
    ]);
    // One pass over both renames: a sequential rewrite would carry the first
    // link onto the second's new name.
    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md'), 'utf8'),
      '# Discussion\n\n![first](../../imports/notes-2.md) and ![second](../../imports/notes-2-2.md)\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/imports/notes-2.md'), 'utf8'), '# Notes\n');
    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/imports/notes-2-2.md'), 'utf8'), '# Second notes\n');
  });

  it('a link closing a sentence, its full stop after it, is rewritten — the dot ends the name', () => {
    setupImporting();
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md', '# Discussion\n\nThe ask is in ../../imports/notes.md.\n');
    commitAll(fix.project, 'a sentence');
    engine(fix, ABSORB);

    assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md'), 'utf8'),
      '# Discussion\n\nThe ask is in ../../imports/notes-2.md.\n');
  });

  it("a prose mention of the product's own src/imports path is not a link — never rewritten", () => {
    setupImporting();
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md',
      '# Discussion\n\n![the ask](../../imports/notes.md)\n\nThe bundle reads src/imports/notes.md at build time.\n');
    commitAll(fix.project, 'prose mention');
    engine(fix, ABSORB);

    assert.strictEqual(
      fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md'), 'utf8'),
      '# Discussion\n\n![the ask](../../imports/notes-2.md)\n\nThe bundle reads src/imports/notes.md at build time.\n');
  });

  it('reports no renames when nothing collided', () => {
    const feature = featureManifest();
    feature.imports = [{ path: 'imports/unique.md', imported_at: '2026-06-01T09:00:00Z', origin: 'discovery' }];
    fix = setupFixture({ feature });
    writeFile(fix.project, '.leeway/auth-flow/imports/unique.md', '# Unique\n');
    commitAll(fix.project, 'unique import');

    const res = engine(fix, ABSORB);
    assert.deepStrictEqual(res.renamed_imports, []);
    assert.deepStrictEqual(res.imports, [{ path: inEpic(fix, 'imports/unique.md') }]);
  });
});

describe('engine workunit absorb — the mailbox follows its topic', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Message file → content: two messages waiting for the feature's topic, numbering gapped by an earlier answer. */
  const MESSAGES = {
    '001-token-rotation.md': 'Token rotation\n\nRotate on every refresh.\n',
    '003-lockout-window.md': 'Lockout window\n\nHow long a lockout holds.\n',
  };

  function setupWithMessages() {
    fix = setupFixture();
    for (const [name, content] of Object.entries(MESSAGES)) writeFile(fix.project, `.leeway/auth-flow/topics/auth-flow/mail/${name}`, content);
    commitAll(fix.project, 'waiting messages');
  }

  it('moves the mailbox under the new topic, names and contents intact, and the engine reads it there', () => {
    setupWithMessages();
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.mail_moved, { path: inEpic(fix, 'topics/auth/mail'), count: 2 });
    for (const [name, content] of Object.entries(MESSAGES)) {
      assert.strictEqual(fs.readFileSync(path.join(fix.project, '.leeway/payments/topics/auth/mail', name), 'utf8'), content, `moved intact: ${name}`);
    }
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/auth-flow')), 'the feature directory is gone');
    assert.deepStrictEqual(engine(fix, ['topic', 'mailbox', 'payments', 'auth']).files,
      Object.keys(MESSAGES).map((name) => inEpic(fix, `topics/auth/mail/${name}`)));
  });

  it("the move rides the absorb's one commit — nothing left dirty", () => {
    setupWithMessages();
    const commits = Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim());
    engine(fix, ABSORB);

    assert.strictEqual(Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim()), commits + 1);
    const staged = stateGit(fix.project, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).trim().split('\n');
    for (const name of Object.keys(MESSAGES)) {
      assert.ok(staged.includes(`auth-flow/topics/auth-flow/mail/${name}`), `deletion staged: ${name}`);
      assert.ok(staged.includes(`payments/topics/auth/mail/${name}`), `landing staged: ${name}`);
    }
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '');
  });

  it('an empty mailbox moves no message — no field rides the response', () => {
    fix = setupFixture();
    fs.mkdirSync(path.join(fix.project, '.leeway/auth-flow/topics/auth-flow/mail'), { recursive: true });
    const res = engine(fix, ABSORB);

    assert.strictEqual(res.mail_moved, undefined);
    assert.deepStrictEqual(engine(fix, ['topic', 'mailbox', 'payments', 'auth']).files, []);
  });
});

/**
 * The world the material's tests start from, built once and copied: the
 * feature's topic folder with a brief, a waiting message and an experiment
 * record, each linking its assets and spikes; its assets, a dot-named one
 * among them; its spikes, one with its twin in the cache; and the epic
 * holding an asset of one's name and a spike of one's slug.
 */
const materialWorld = fixtureFrom('engine-wu-absorb-material-', (template) => {
  const feature = featureManifest();
  feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'dup-rate', status: 'running' } } } } };
  fillFixture(template, { feature });
  writeFile(template, '.leeway/auth-flow/topics/auth-flow/log.md',
    '# Discussion\n\n![flow](../../assets/flow.png) and ../../assets/diagrams/login.svg\nThe probe: ../../spikes/001-token-probe/notes.md\n');
  writeFile(template, '.leeway/auth-flow/topics/auth-flow/brief.md', '# Brief\n\nSee ../../assets/flow.png for the flow.\n');
  writeFile(template, '.leeway/auth-flow/topics/auth-flow/mail/001-rollback.md', 'Rollback\n\nWho owns it?\n');
  writeFile(template, '.leeway/auth-flow/topics/auth-flow/experiments/E1-dup-rate/report.md', '# Report\n\n![flow](../../../../assets/flow.png)\n');
  writeFile(template, '.leeway/auth-flow/assets/flow.png', 'feature png\n');
  writeFile(template, '.leeway/auth-flow/assets/diagrams/login.svg', '<svg/>\n');
  writeFile(template, '.leeway/auth-flow/assets/.draft.png', 'tooling state\n');
  writeFile(template, '.leeway/auth-flow/spikes/001-token-probe/notes.md', '# Token probe\n');
  writeFile(template, '.leeway/auth-flow/spikes/002-retry-bench/bench.md', '# Retry bench\n');
  writeFile(template, '.leeway/.cache/auth-flow/spikes/001-token-probe/out.log', 'built\n');
  writeFile(template, '.leeway/payments/assets/flow.png', 'epic png\n');
  writeFile(template, '.leeway/payments/spikes/001-token-probe/notes.md', '# The epic\'s own probe\n');
  writeFile(template, '.leeway/payments/topics/fee-model/brief.md', '# Fees\n\n![flow](../../assets/flow.png)\n');
  commitAll(template, 'material');
});

describe('engine workunit absorb — the topic folder, the assets and the spikes follow the material', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const read = (rel) => fs.readFileSync(path.join(fix.project, '.leeway', rel), 'utf8');

  it('the consent screen names everything the absorb moves — the brief, the waiting mail, the assets but a dot-named one, the spikes', () => {
    fix = copyFixture(materialWorld);
    const summary = output(fix.project, ['render', 'absorb-summary', 'auth-flow', '--into', 'payments', '--topic', 'auth']);

    assert.match(summary, /Mail: {9}1 message\(s\) waiting\n {2}Experiments: {2}1 experiment\(s\)\n {2}Seed: {9}1 file\(s\) \(origin\)\n {2}Imports: {6}1 file\(s\)\n {2}Assets: {7}2 file\(s\)\n {2}Spikes: {7}2 spike\(s\)\n/);
    assert.ok(summary.includes([
      '  • Move discussion log to epic',
      '  • Move brief to epic',
      '  • Move waiting message(s) to epic',
      '  • Move experiment series to epic',
      '  • Move seed file(s) to epic',
      '  • Move import file(s) to epic',
      '  • Move asset(s) to epic',
      '  • Move spike(s) to epic',
    ].join('\n')));
  });

  it('moves the topic folder whole — its brief beside its log — in the absorb\'s one commit', () => {
    fix = copyFixture(materialWorld);
    engine(fix, ABSORB);

    assert.strictEqual(read('payments/topics/auth/brief.md'), '# Brief\n\nSee ../../assets/flow-2.png for the flow.\n');
    const staged = headFiles(fix, ['--no-renames']);
    assert.ok(staged.includes('auth-flow/topics/auth-flow/brief.md') && staged.includes('payments/topics/auth/brief.md'), 'the brief\'s move is committed');
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '');
  });

  it('moves the assets under the dedupe, rewriting the links its rename broke in every document of the moved folder, a dot-named one going with the feature', () => {
    fix = copyFixture(materialWorld);
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual([res.assets, res.renamed_assets], [
      [{ path: inEpic(fix, 'assets/diagrams') }, { path: inEpic(fix, 'assets/flow-2.png') }],
      [{ from: 'flow.png', to: 'flow-2.png' }],
    ]);
    assert.deepStrictEqual([read('payments/assets/flow-2.png'), read('payments/assets/diagrams/login.svg'), read('payments/assets/flow.png')],
      ['feature png\n', '<svg/>\n', 'epic png\n'], 'the feature\'s assets land beside the epic\'s, which are untouched');
    assert.deepStrictEqual(fs.readdirSync(path.join(fix.project, '.leeway/payments/assets')).sort(), ['diagrams', 'flow-2.png', 'flow.png']);
    assert.strictEqual(read('payments/topics/auth/experiments/E1-dup-rate/report.md'), '# Report\n\n![flow](../../../../assets/flow-2.png)\n');
    assert.strictEqual(read('payments/topics/fee-model/brief.md'), '# Fees\n\n![flow](../../assets/flow.png)\n', 'the epic\'s own document names the epic\'s own asset');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/auth-flow')));
  });

  it('moves the spikes under their numbers, a slug the epic\'s spikes hold suffixed and its links rewritten, each twin in the cache with it — and the receipt names them', () => {
    fix = copyFixture(materialWorld);
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual([res.spikes, res.renamed_spikes], [
      [{ path: inEpic(fix, 'spikes/001-token-probe-2') }, { path: inEpic(fix, 'spikes/002-retry-bench') }],
      [{ from: '001-token-probe', to: '001-token-probe-2' }],
    ]);
    assert.deepStrictEqual([read('payments/spikes/001-token-probe-2/notes.md'), read('payments/spikes/002-retry-bench/bench.md'), read('payments/spikes/001-token-probe/notes.md')],
      ['# Token probe\n', '# Retry bench\n', '# The epic\'s own probe\n']);
    assert.strictEqual(read('.cache/payments/spikes/001-token-probe-2/out.log'), 'built\n');
    assert.strictEqual(read('payments/topics/auth/log.md'),
      '# Discussion\n\n![flow](../../assets/flow-2.png) and ../../assets/diagrams/login.svg\nThe probe: ../../spikes/001-token-probe-2/notes.md\n');

    const receipt = output(fix.project, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'seeds,imports,assets,spikes', '--renamed', 'flow.png:flow-2.png']);
    assert.ok(receipt.includes([
      '  • Seed: moved',
      '  • Imports: moved',
      '  • Assets: moved',
      '  • Spikes: moved',
      '  • Renamed: flow.png → flow-2.png (links rewritten)',
    ].join('\n')));
    assert.match(engineFails(fix, ['render', 'absorb-receipt', 'payments', '--topic', 'auth', '--moved', 'mail']).error,
      /--moved entries must be seeds, imports, assets, spikes, got "mail"/);
  });

  it('a feature with no assets and no spikes moves none, and the epic gains no folder for them', () => {
    fix = setupFixture();
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual([res.assets, res.renamed_assets, res.spikes, res.renamed_spikes], [[], [], [], []]);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/payments/assets')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/payments/spikes')));
  });
});

describe('engine workunit absorb — roadmap sources follow the material', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const readProject = () => JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway/manifest.json'), 'utf8'));

  /** The fixture plus a roadmap holding `items`, and the files their sources name outside the feature. */
  function setupRoadmap(items, { feature } = {}) {
    fix = setupFixture(feature ? { feature } : {});
    writeFile(fix.project, '.leeway/auth-flow/discovery/session-001.md', '# Discovery\n');
    writeFile(fix.project, '.leeway/.product/sessions/session-001.md', '# Roadmap session\n');
    const project = readProject();
    project.roadmap = { horizons: ['v1'], items };
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify(project, null, 2) + '\n');
    commitAll(fix.project, 'roadmap');
  }

  /** Every source the roadmap records names a file on disk. */
  function assertSourcesOnDisk() {
    for (const [name, item] of Object.entries(readProject().roadmap.items)) {
      for (const source of item.sources || []) {
        assert.ok(fs.existsSync(path.join(fix.project, '.leeway', source)), `${name}: ${source} is on disk`);
      }
    }
  }

  it("a waiting item's discussion source names the moved discussion", () => {
    setupRoadmap({ sso: { horizon: 'v1', summary: 'single sign-on', kind: 'idea', origin: 'park:auth-flow', sources: ['auth-flow/topics/auth-flow/log.md'] } });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_sources_rewritten, [
      { item: 'sso', from: 'auth-flow/topics/auth-flow/log.md', to: 'payments/topics/auth/log.md' },
    ]);
    assert.strictEqual(res.roadmap_sources_dropped, undefined);
    assert.strictEqual(res.roadmap_reaimed, undefined, 'a waiting item has no join to re-aim');
    assert.deepStrictEqual(readProject().roadmap.items.sso,
      { horizon: 'v1', summary: 'single sign-on', kind: 'idea', origin: 'park:auth-flow', sources: ['payments/topics/auth/log.md'] });
    assertSourcesOnDisk();
  });

  it("a joined item's sources follow, and its join is re-aimed as before", () => {
    setupRoadmap({ login: {
      horizon: 'v1', summary: 'log in', kind: 'idea', origin: 'harvest',
      sources: ['auth-flow/seeds/seed.md', 'auth-flow/topics/auth-flow/log.md'],
      pulled_to: { work_unit: 'auth-flow' },
    } });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_reaimed, ['login']);
    const item = readProject().roadmap.items.login;
    assert.deepStrictEqual(item.pulled_to, { work_unit: 'payments', topic: 'auth' });
    assert.deepStrictEqual(item.sources, ['payments/seeds/seed.md', 'payments/topics/auth/log.md'], 'order kept');
    assertSourcesOnDisk();
  });

  it('a mixed feature: its idea\'s join takes the epic topic, its bug\'s and quick-fix\'s the epic alone — they ride as material, never topics', () => {
    setupRoadmap({
      login: { horizon: 'v1', summary: 'log in', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'auth-flow' } },
      'token-leak': { horizon: 'v1', summary: 'a token leaks', kind: 'bug', origin: 'harvest', pulled_to: { work_unit: 'auth-flow' } },
      typo: { horizon: 'v1', summary: 'a typo', kind: 'quick-fix', origin: 'harvest', pulled_to: { work_unit: 'auth-flow' } },
    });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_reaimed, ['login', 'token-leak', 'typo']);
    const items = readProject().roadmap.items;
    assert.deepStrictEqual(items.login.pulled_to, { work_unit: 'payments', topic: 'auth' });
    assert.deepStrictEqual(items['token-leak'].pulled_to, { work_unit: 'payments' });
    assert.deepStrictEqual(items.typo.pulled_to, { work_unit: 'payments' });
  });

  it('an import source takes the name the dedupe gave it; a seed and an experiment record follow theirs', () => {
    const feature = featureManifest();
    feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'dup-rate', status: 'running' } } } } };
    setupRoadmap({ webhooks: { horizon: 'v1', summary: 'webhooks', kind: 'idea', origin: 'harvest', sources: [
      'auth-flow/imports/notes.md',
      'auth-flow/seeds/seed.md',
      'auth-flow/topics/auth-flow/experiments/E1-dup-rate/problem.md',
    ] } }, { feature });
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-dup-rate/problem.md', '# Problem\n');
    commitAll(fix.project, 'series');
    engine(fix, ABSORB);

    assert.deepStrictEqual(readProject().roadmap.items.webhooks.sources, [
      'payments/imports/notes-2.md',
      'payments/seeds/seed.md',
      'payments/topics/auth/experiments/E1-dup-rate/problem.md',
    ]);
    assertSourcesOnDisk();
  });

  it('a source naming a moved folder follows it — the topic\'s and the assets\', and a file within each', () => {
    setupRoadmap({ flows: { horizon: 'v1', summary: 'flows', kind: 'idea', origin: 'harvest', sources: [
      'auth-flow/topics/auth-flow',
      'auth-flow/topics/auth-flow/brief.md',
      'auth-flow/assets',
      'auth-flow/assets/diagrams/login.svg',
    ] } });
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/brief.md', '# Brief\n');
    writeFile(fix.project, '.leeway/auth-flow/assets/diagrams/login.svg', '<svg/>\n');
    commitAll(fix.project, 'brief and assets');
    engine(fix, ABSORB);

    assert.deepStrictEqual(readProject().roadmap.items.flows.sources, [
      'payments/topics/auth',
      'payments/topics/auth/brief.md',
      'payments/assets',
      'payments/assets/diagrams/login.svg',
    ]);
    assertSourcesOnDisk();
  });

  it('a source nothing moved goes with the feature — the sources field too, once empty', () => {
    setupRoadmap({
      lone: { horizon: 'v1', summary: 'lone', kind: 'idea', origin: 'park:auth-flow', sources: ['auth-flow/discovery/session-001.md'] },
      mixed: { horizon: 'v1', summary: 'mixed', kind: 'idea', origin: 'harvest', sources: [
        'auth-flow/discovery/session-001.md',
        '.product/sessions/session-001.md',
        'auth-flow/topics/auth-flow/log.md',
      ] },
    });
    const res = engine(fix, ABSORB);

    assert.deepStrictEqual(res.roadmap_sources_dropped, [
      { item: 'lone', source: 'auth-flow/discovery/session-001.md' },
      { item: 'mixed', source: 'auth-flow/discovery/session-001.md' },
    ]);
    const items = readProject().roadmap.items;
    assert.deepStrictEqual(items.lone, { horizon: 'v1', summary: 'lone', kind: 'idea', origin: 'park:auth-flow' });
    assert.deepStrictEqual(items.mixed.sources, ['.product/sessions/session-001.md', 'payments/topics/auth/log.md']);
    assertSourcesOnDisk();
  });

  it("a source outside the feature is untouched — a sibling unit sharing the name's prefix included", () => {
    const outside = ['.product/sessions/session-001.md', 'payments/imports/roadmap.md', 'auth-flow-v2/discussion/auth-flow-v2.md'];
    setupRoadmap({ other: { horizon: 'v1', summary: 'other', kind: 'idea', origin: 'harvest', sources: outside } });
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
    setupRoadmap({ sso: { horizon: 'v1', summary: 'single sign-on', kind: 'idea', origin: 'park:auth-flow', sources: ['auth-flow/topics/auth-flow/log.md'] } });
    const commits = Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim());
    engine(fix, ABSORB);

    assert.strictEqual(Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim()), commits + 1);
    const staged = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json'));
    const committed = JSON.parse(stateGit(fix.project, ['show', 'HEAD:manifest.json']));
    assert.deepStrictEqual(committed.roadmap.items.sso.sources, ['payments/topics/auth/log.md']);
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '');
  });
});

describe('engine workunit absorb — guards refuse loudly, both work units pristine', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Assert the refusal leaves every `.leeway/` byte identical, no commit. */
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

  it('refuses a feature with no discussion — item or log', () => {
    const feature = featureManifest({ phases: { experiment: { items: { 'auth-flow': { status: 'in-progress', experiments: {} } } } } });
    fix = setupFixture({ feature });
    refusedPristine(ABSORB, /has no discussion — absorb moves the discussion in/);
    fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

    fix = setupFixture();
    fs.rmSync(path.join(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md'));
    commitAll(fix.project, 'drop file');
    refusedPristine(ABSORB, /discussion log missing on disk/);
  });

  it('refuses an illegal or colliding topic name — map item, title, dismissed, discussion item, a folder on disk', () => {
    const epic = epicManifest();
    epic.phases.discovery.items['fee-model'].title = 'billing';
    epic.phases.discussion = { items: { 'session-model': { status: 'completed' } } };
    fix = setupFixture({ epic });
    writeFile(fix.project, '.leeway/payments/topics/on-disk/mail/001-stray.md', 'Stray\n');
    commitAll(fix.project, 'orphan');

    // The map's own rule, so the row the absorb lands is never refused
    // once the material has moved.
    for (const name of ['bad.name', 'auth ', 'Auth']) {
      refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', name], /is not a topic name — a lowercase slug/);
    }
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'fee-model'], /already on payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'billing'], /"fee-model" on the map goes by "billing"/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'dead-idea'], /was dismissed from payments's discovery map/);
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'session-model'], /discussion topic "session-model" already exists/);
    // The topic folder moves whole, so nothing it holds merges into a folder there.
    refusedPristine(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'on-disk'], /\.leeway\/payments\/topics\/on-disk already exists — pick a different name/);
  });

  it('refuses an experiment series already at the topic in the epic', () => {
    const feature = featureManifest({
      phases: {
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
        experiment: { items: { 'auth-flow': { status: 'completed', experiments: { E1: { slug: 'webhook-dup-rate', status: 'concluded', verdict: 'held' } } } } },
      },
    });
    const epic = epicManifest();
    epic.phases.experiment = { items: { auth: { status: 'completed', experiments: { E1: { slug: 'other', status: 'concluded', verdict: 'stands' } } } } };
    fix = setupFixture({ feature, epic });
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/problem.md', '# Problem\n');
    commitAll(fix.project, 'series');
    refusedPristine(ABSORB, /experiment topic "auth" already exists in payments/);
  });

  it('the discussion lands at the topic name — a renamed absorb keeps every experiment join intact', () => {
    // The wait's release edge and the register both address
    // `phases.experiment.items.{topic}` — the discussion landing at the topic
    // name is what keeps the join true after a renamed absorb.
    const feature = featureManifest();
    feature.phases.discussion.items['auth-flow'] = { status: 'in-progress', awaiting_experiments: ['E1'] };
    feature.phases.experiment = { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'webhook-dup-rate', status: 'running' } } } } };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.leeway/auth-flow/topics/auth-flow/experiments/E1-webhook-dup-rate/problem.md', '# Problem\n');
    commitAll(fix.project, 'series');
    engine(fix, ABSORB);
    assert.deepStrictEqual(readManifest(fix, 'payments').phases.discussion.items.auth,
      { status: 'in-progress', awaiting_experiments: ['E1'] });
    assert.ok(fs.existsSync(path.join(fix.project, '.leeway/payments/topics/auth/experiments/E1-webhook-dup-rate/problem.md')),
      'the series lands at the topic name on disk too');
    // The join holds end to end: the conclusion at the epic address releases
    // the moved wait.
    const concluded = engine(fix, ['experiment', 'conclude', 'payments', 'auth', 'E1', '--verdict', 'held']);
    assert.deepStrictEqual(concluded.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
  });

  it('refuses a foreign-named experiment series — deletion follows, so a silent skip would lose it', () => {
    const feature = featureManifest();
    feature.phases.experiment = { items: { stray: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.leeway/auth-flow/topics/stray/experiments/E1-x/problem.md', '# P\n');
    commitAll(fix.project, 'foreign series');
    refusedPristine(ABSORB, /experiment item "stray" not named after it — a feature's experiment is single and self-named/);
  });

  it('refuses a foreign-named discussion item — the same guard covers every moved phase', () => {
    const feature = featureManifest();
    feature.phases.discussion.items.tangent = { status: 'completed' };
    fix = setupFixture({ feature });
    writeFile(fix.project, '.leeway/auth-flow/discussion/tangent.md', '# Tangent\n');
    commitAll(fix.project, 'foreign discussion item');
    refusedPristine(ABSORB, /discussion item "tangent" not named after it — a feature's discussion is single and self-named/);
  });

  it('closes the crash window: a discussion log missing on disk leaves both units pristine', () => {
    fix = setupFixture();
    indexFiles(fix, FEATURE_FILES);
    fs.rmSync(path.join(fix.project, '.leeway/auth-flow/topics/auth-flow/log.md'));
    commitAll(fix.project, 'drop discussion log');
    refusedPristine(ABSORB, /discussion log missing on disk/);
    // Validation refused before ANY move — the imports are still the
    // feature's, the epic gained nothing, and the store holds the feature's
    // chunks as it did: none removed, none indexed at the epic.
    assert.ok(fs.existsSync(path.join(fix.project, '.leeway/auth-flow/imports/notes.md')));
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/payments/topics/auth/log.md')));
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
    writeFile(fix.project, '.leeway/manifest.json', '{ corrupt\n');
    commitAll(fix.project, 'corrupt');
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
