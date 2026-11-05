'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's record and close (leeway-engine/scripts/domain/
// quick-fix-record.cjs; finish.cjs, its screen projections/finish.cjs, its
// engine items finish-checks.cjs; fix-branch.cjs; knowledge/artifacts.cjs):
// `engine quick-fix record <qf> <task> --file <record.md>` — each fix's
// short record under its title in `summary.md`, at its place in the order
// the fixes land, kept by its task — two fixes of one title each recorded —
// committed with the fix recorded on the manifest and indexed, a query for
// one fix finding its own (19.5.6, 19.5.11, 19.5.17, 19.S38, 22.6.9), and
// every refusal writing nothing; `engine land open` refusing a fix laid on
// a fix closed since, naming the fix it is laid on now (7.2.3);
// finish's checklist holding the review passed only once the person asked
// for one (6.4.10, 6.S14), and the records indexed open while the store
// lacks summary.md as it stands; `engine render finish <qf>`, the close — refused
// while a fix has not ended or one done has no record; what running the
// product proved of each fix, its runs made through `verify setup` and
// `verify run`, or the one line saying the project has no way
// to run it (19.5.13, 19.S21, P9), its yes merging nothing where no fix is
// done; each call the person changed asked its
// verdict first, at the point `close` (16.S36, 19.S22); and `engine finish
// yes <qf>` — refused while the checkout holds changes not committed,
// landing nothing — landing the fixes through the local landing driver,
// putting the checkout back on the branch it lands on, completing the unit
// and naming the start menu, its folder then holding `build/` and
// `summary.md` alone of the work (4.S23), its record found once it is
// closed (22.S22). The set's landing as a chain, on every driver, GitHub's
// among them (19.S32), and the close standing on each fix done landed, a
// closed fix's work never landing, are
// test-engine-landing-conformance-quick-fix.cjs's.
//
// Layer: git. World: the quick-fix of quick-fix-world.cjs entered by a
// conversation gone since, its fixes 1.1 and 1.2 — 1.2 laid on 1.1 — each
// built, its pull request opened through the local driver and done, built
// once and copied; and that world with the project's verify setup made in
// fix 1.1, its scenario run there (`provenWorld`). Each test's
// conversation keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, callAsync, refusedPristine, sectionOf, git, stateGit, statePath, layout, writeState, readState, readManifest, fixtureFrom, cleanupFixture,
  keywordOnlyKnowledge, touched, createFile,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, quickFix, createFix, fixChanged, fixBuilt, recordFile, asGone, entered } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { NBSP } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const { closeScreen } = require(path.join(SCRIPTS, 'domain/projections/finish.cjs'));
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));

const FLAG = 'Spell the flag --colour';
const HELP = 'Spell the help --colour';
const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';

/** Fix `n`'s branch. @param {number} n @param {string} title */
const branchOf = (n, title) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', title);
const RECORDS = Object.freeze({
  1: { changed: 'The flag parser reads --colour.', why: 'The flag was spelt the American way.', leaves: 'Old scripts passing --color.' },
  2: { changed: 'The help page names --colour.\nIts example uses it too.', why: 'The help matched the old flag.', leaves: 'The man page.' },
  3: { changed: 'The flag\'s alias reads --colour.', why: 'The alias was missed.', leaves: 'Nothing.' },
});
const CRITERION = 'Given the help, when it is read, then it names --colour.';

const world = fixtureFrom('quick-fix-close-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    entered(dir, as);
    fixBuilt(dir, 1, FLAG, 'src/flag.js', 'const flag = \'colour\';\n', as);
    fixBuilt(dir, 2, HELP, 'src/help.js', 'const help = \'--colour\';\n', as);
  });
});

/**
 * The world as `world` builds it, but fix 1.1's change carrying the
 * project's verify setup, built through the verbs, and its scenario run
 * passing at its branch's tip before its pull request opens.
 */
const provenWorld = fixtureFrom('quick-fix-close-proven-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    entered(dir, as);
    createFix(dir, 1, FLAG, as);
    ok(dir, ['task', 'start', UNIT, '1.1'], as);
    createFile(dir, 'src/flag.js', 'const flag = \'colour\';\n');
    createFile(dir, 'verify/features.md', '# Features\n');
    createFile(dir, 'verify/drive.sh', '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n');
    fs.chmodSync(path.join(dir, 'verify', 'drive.sh'), 0o755);
    ok(dir, ['commit', '--paths', 'src/flag.js', 'verify/features.md', 'verify/drive.sh', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${FLAG}`], as);
    const setup = writeState(dir, layout.cache('verify-setup.json'), JSON.stringify({
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
    }));
    ok(dir, ['verify', 'setup', UNIT, '--file', setup, '--scenario', '1.S1'], as);
    ok(dir, ['verify', 'run', UNIT, '1.S1'], as);
    ok(dir, ['land', 'open', UNIT, '1.1'], as);
    ok(dir, ['task', 'done', UNIT, '1.1'], as);
    fixBuilt(dir, 2, HELP, 'src/help.js', 'const help = \'--colour\';\n', as);
  });
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-close-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The engine as this test's conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: env() }).error;

/** Fix `n`'s record written through the verb. @param {number} n */
const record = (n) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n])]);

/** The unit's `summary.md`. */
const summary = () => readState(dir, layout.unit(UNIT, 'summary.md'));

/** The records' headings in `summary.md`, in order. */
const headings = () => summary().split('\n').filter((line) => line.startsWith('## '));

/** Finish's checklist worked and closed, Claude's items done. */
function closed() {
  for (const key of ['inbox-closed', 'build-log-closed']) run(['checklist', 'done', 'finish', UNIT, key]);
  run(['checklist', 'close', 'finish', UNIT]);
}

/** Both fixes recorded and the close's checklist closed. */
function closeable() {
  record(1);
  record(2);
  closed();
}

/** The close as the conversation draws it. */
const screen = () => output(dir, ['render', 'finish', UNIT], { env: env() });

/** The store's chunks, each by its file and the heading it sits under. */
const chunked = () => store.allChunks(store.loadStore(knowledgeFiles(statePath(dir)).store)).map((chunk) => [chunk.source_file, chunk.heading_path]);

/** The branch the project's checkout has out. */
const branchOut = () => git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();

/** Finish's items, a line each: key, who checks it, where it stands, and its way on where it names one. */
const items = () => run(['checklist', 'show', 'finish', UNIT]).items.map((/** @type {any} */ { key, by, state, way }) => `${key} ${by} ${state}${way === undefined ? '' : ` — ${way}`}`);

describe('quick-fix record (19.5.6, 19.5.17)', () => {
  it('writes each fix\'s record into summary.md under its title, after the record before it, each section an item, and commits it with the fix recorded on the manifest', () => {
    dir = world();
    const first = record(1);
    const at = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const second = record(2);

    assert.deepStrictEqual(first, {
      ok: true, unit: UNIT, task: '1.1', id: `${UNIT}-1-1`, summary: statePath(dir, layout.unit(UNIT, 'summary.md')), committed: at.slice(0, first.committed.length),
    });
    assert.strictEqual(summary(), [
      `## ${FLAG}`, '', '- What changed: The flag parser reads --colour.', '- Why: The flag was spelt the American way.', '- Leaves out: Old scripts passing --color.', '',
      `## ${HELP}`, '', '- What changed: The help page names --colour.', '  Its example uses it too.', '- Why: The help matched the old flag.', '- Leaves out: The man page.', '',
    ].join('\n'));
    assert.deepStrictEqual([stateGit(dir, ['log', '-2', '--format=%s']).trim().split('\n'), touched(statePath(dir), 'HEAD'), second.task], [
      [`quick-fix(${UNIT}): record 1.2`, `quick-fix(${UNIT}): record 1.1`], [`M\t${layout.manifest(UNIT)}`, `M\t${layout.unit(UNIT, 'summary.md')}`], '1.2',
    ]);
  });

  it('writes a record at its fix\'s place in the set\'s order, a fix recorded after the one landing above it', () => {
    dir = world();
    record(2);
    record(1);

    assert.deepStrictEqual([headings(), readManifest(dir, UNIT).fixes.recorded], [[`## ${FLAG}`, `## ${HELP}`], [`${UNIT}-1-1`, `${UNIT}-1-2`]]);
  });

  it('keeps each record by its fix\'s task, so two fixes of one title are each recorded, the close counting both', () => {
    dir = world();
    fixBuilt(dir, 3, FLAG, 'src/alias.js', 'const alias = \'colour\';\n', { env: env() });
    closeable();
    record(3);
    screen();

    assert.deepStrictEqual(headings(), [`## ${FLAG}`, `## ${HELP}`, `## ${FLAG}`]);
  });

  it('refuses a unit that is no quick-fix, a task none of its fixes, a fix not started or closed, a second record of a fix, and a file that does not read as a record, every fault named, writing nothing', () => {
    dir = world();
    record(1);
    createFix(dir, 3, DOCS, { env: env() });
    createFix(dir, 4, MAN, { env: env() });
    run(['task', 'close', UNIT, '1.4', '--reason', 'The man page stays as it is.']);
    const file = recordFile(dir, 2, RECORDS[2]);
    const bad = writeState(dir, layout.cache('bad.md'), '# Docs\n\n## What changed\nThe docs.\n\n## Why\n\n## Leaves out\nNothing.\n');
    const shuffled = writeState(dir, layout.cache('shuffled.md'), '## Why\nBecause.\n\n## What changed\nThe docs.\n');

    assert.deepStrictEqual([
      refused(['quick-fix', 'record', 'other', '1.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '2.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.3', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.4', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.2', '--file', bad]),
      refused(['quick-fix', 'record', UNIT, '1.2', '--file', shuffled]),
      refused(['quick-fix', 'record', UNIT, '1.2']),
    ], [
      'quick-fix record: other is a feature, and only a quick-fix keeps a short record of each fix',
      `quick-fix record: task 2.1 of ${UNIT} is none of its fixes — a quick-fix's fixes are its phase 1, 1.n`,
      `quick-fix record: task 1.3 of ${UNIT} is not started — a fix's record is written once it is done: task done ${UNIT} 1.3`,
      `quick-fix record: task 1.4 of ${UNIT} is closed — a fix's record is written once it is done: task done ${UNIT} 1.4`,
      `quick-fix record: task 1.1 of ${UNIT}'s record is written already — ${UNIT}/summary.md holds it, under \`## ${FLAG}\``,
      `quick-fix record: ${bad} does not read as a fix's record — it holds a level-one heading — the fix's title heads its record in summary.md; it opens with \`## What changed\`; ## Why is empty`,
      `quick-fix record: ${shuffled} does not read as a fix's record — its sections are \`## What changed\`, \`## Why\`, \`## Leaves out\`, in that order, and no other at level two`,
      'Usage: engine quick-fix record <work-unit> <task> --file <record.md>',
    ]);
  });

  it('19.S38, 22.6.9: indexes summary.md where the knowledge base is set up, each fix\'s record its own chunk, so a query for one fix finds its record first', async () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    record(1);
    record(2);
    const res = await callAsync(dir, ['knowledge', 'query', 'help', 'page', '--phase', 'summary'], { env: env() });

    const passage = res.stdout.split('\n').slice(res.stdout.split('\n').findIndex((line) => line.startsWith('[summary | typo/.unit |')) + 1);

    assert.strictEqual(res.code, 0, res.stderr);
    assert.deepStrictEqual([chunked(), res.stdout.match(/^\[(\d+) results?\]$/m)?.[1], passage.slice(0, 2)], [
      [[layout.unit(UNIT, 'summary.md'), FLAG], [layout.unit(UNIT, 'summary.md'), HELP]], '1', [HELP, '- What changed: The help page names --colour.'],
    ]);
  });
});

describe('land open <quick-fix> <fix> on a fix closed since (7.2.3)', () => {
  it('refuses a fix laid on a fix closed since it was laid, naming the fix it is laid on now, never the closed one; its own commits rebased there, it opens', () => {
    dir = world();
    fixChanged(dir, 3, DOCS, 'docs/flags.md', '--colour\n', { env: env() });
    fixChanged(dir, 4, MAN, 'docs/man.md', '--colour\n', { env: env() });
    run(['task', 'close', UNIT, '1.3', '--reason', 'The docs stay as they are.']);
    const onClosed = refused(['land', 'open', UNIT, '1.4']);
    git(dir, ['rebase', '-q', '--onto', branchOf(2, HELP), branchOf(3, DOCS), branchOf(4, MAN)]);
    const opened = run(['land', 'open', UNIT, '1.4']);

    assert.strictEqual(onClosed, `land: task 1.4 of ${UNIT}'s branch ${branchOf(4, MAN)} holds ${branchOf(3, DOCS)}, the work of 1.3, closed — rebase its own commits onto ${branchOf(2, HELP)}, the branch it is laid on, leaving that work out, then open it again`);
    assert.deepStrictEqual(opened.repos.map((/** @type {any} */ { base }) => base), [branchOf(2, HELP)]);
  });
});

describe('finish\'s checklist for a quick-fix (6.4.10, 6.S14)', () => {
  it('holds no review item until the person asks for a review; asked, the review passed applies, open while the review cannot be entered', () => {
    dir = world();
    const unasked = items();
    const manifest = readManifest(dir, UNIT);
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, fixes: { ...manifest.fixes, review_asked: '2026-06-03T10:00:00Z' } }, null, 2));

    assert.deepStrictEqual([unasked, items()[0]], [
      ['questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
      `review-passed engine open — ${UNIT} is a quick-fix, whose review runs only once the person asks for one at its close — the review on request is built with the reshape's 29.15`,
    ]);
  });

  it('22.6.9: holds the records indexed open while the store lacks summary.md as it stands, done once the unit is indexed', async () => {
    dir = world();
    record(1);
    keywordOnlyKnowledge(dir);
    const open = items().at(-1);
    assert.strictEqual((await callAsync(dir, ['knowledge', 'index', '--work-unit', UNIT], { env: env() })).code, 0);

    assert.deepStrictEqual([open, items().at(-1)], [
      `records-indexed engine open — the knowledge base does not hold ${layout.unit(UNIT, 'summary.md')} as it stands — knowledge index --work-unit ${UNIT}`,
      'records-indexed engine done',
    ]);
  });
});

describe('render finish <quick-fix>: the close (19.5.8, 19.5.13)', () => {
  it('refuses while a fix has not ended, and while a fix done has no record, naming each, writing nothing', () => {
    dir = world();
    closed();
    const unrecorded = refused(['render', 'finish', UNIT]);
    record(1);
    createFix(dir, 3, 'Spell the docs --colour', { env: env() });

    assert.deepStrictEqual([unrecorded, refused(['render', 'finish', UNIT]), refused(['finish', 'yes', UNIT])], [
      `render finish: ${UNIT} closes once each fix done has its record — 1.1, 1.2 have none: quick-fix record ${UNIT} 1.1 --file <record.md>`,
      `render finish: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it lands, or closed with its reason`,
      `finish yes: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it lands, or closed with its reason`,
    ]);
  });

  it('19.S21: says what running the product proved of each fix, no review step on its checklist, and nothing changed by the person, no verdict — then the yes, a review asked for, and questions about the change', () => {
    dir = provenWorld();
    closeable();
    const out = screen();

    assert.strictEqual(sectionOf(out, 'DISPLAY: finish'), [
      'Typo — ready to close',
      '',
      `PROVEN BY RUNNING ${projectName(dir).toUpperCase()}`,
      `  ├─ ✓ ${CRITERION}`,
      '  └─ △ Not proven: Given the help, when it is read, then it names',
      '     --colour.',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: finish'), [
      '· · · · · · · · · · · ·',
      '**`◆ Close it?`**',
      '',
      '**`y/yes`**    → Close it — merge its pull requests and mark it',
      `${NBSP.repeat(11)}complete`,
      '**`r/review`** → Have it reviewed before it closes',
      '**Ask**      → Ask about the change before it closes',
      '',
    ].join('\n'));
    assert.deepStrictEqual(run(['gate', 'finish', '--pick', 'y']).next, { kind: 'engine', argv: ['finish', 'yes', UNIT] });
  });

  it('offers a yes that merges nothing, where no fix is done', () => {
    const view = { unit: UNIT, title: 'Typo', skips: [], verdict: null, warnings: [], aside: null, product: 'app', proven: null, fixes: 0 };
    assert.match(sectionOf(closeScreen(view), 'MENU: finish'), /\*\*`y\/yes`\*\* {4}→ Close it — mark it complete\n/);
  });

  it('P9: says in one line that the project has no way to run the product, where no verify setup is recorded', () => {
    dir = world();
    closeable();
    assert.strictEqual(sectionOf(screen(), 'DISPLAY: finish'), `Typo — ready to close\n\nNothing was proven by running ${projectName(dir)} — the project has no way to run it\n`);
  });

  it('16.S36, 19.S22: asks a verdict on the call the person changed in it, at the close, before its gate — the yes refused until it is given', () => {
    dir = world();
    closeable();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(PLACE, ask(PLACE, 'Does --color still work?'), 'It stays as an alias.');
    ok(dir, ['ledger', 'replace', PLACE, '--replaces', call, '--reason', 'changed-mind'], {
      env: env(), stdin: JSON.stringify({ by: 'person', text: 'It is dropped.', why: 'The person wants it so.', drops: ['the alias'] }),
    });
    const first = screen();
    const yes = refused(['finish', 'yes', UNIT]);
    const { argv } = run(['gate', 'verdict', '--pick', 'n']).next;
    run(argv);

    assert.match(sectionOf(first, 'DISPLAY: finish'), /\n\nYOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Does --color still work\?\n {8}My answer: It stays as an alias\.\n {8}Yours: It is dropped\.\n$/);
    assert.ok(!first.includes('MENU: finish'), 'the gate waits on the verdict');
    assert.deepStrictEqual([yes, argv.filter((_, at) => at !== 2)], ['finish yes: a verdict is still to ask — render finish asks each before the yes', ['verdict', 'give', 'nothing', '--at', 'close']]);
    assert.match(screen(), /=== MENU: finish /);
  });
});

describe('finish yes <quick-fix> (19.5.15, 24.1.2)', () => {
  it('refuses while the checkout holds changes not committed, landing nothing; then lands the fixes, puts the checkout back on the branch it lands on, completes the unit and names the start menu — its folder holding build/ and summary.md, no topics/ and no spec.md (4.S23)', () => {
    dir = world();
    closeable();
    fs.writeFileSync(path.join(dir, 'src', 'stray.js'), 'stray\n');
    const dirty = refused(['finish', 'yes', UNIT]);
    const main = git(dir, ['rev-parse', 'main']).trim();
    fs.rmSync(path.join(dir, 'src', 'stray.js'));
    writeState(dir, layout.unit(UNIT, 'build', 'log.md'), '# The fixes\n');
    const done = run(['finish', 'yes', UNIT]);

    assert.strictEqual(dirty, `finish yes: ${UNIT}'s fixes were built in the project's own checkout, which holds changes not committed — src/stray.js — so nothing was landed: commit them or set them aside, then close it again`);
    assert.deepStrictEqual({ ...done, landed: done.landed.map((/** @type {any} */ { repo, into, phases }) => ({ repo, into, phases: phases.map((/** @type {any} */ { phase }) => phase) })) }, {
      ok: true, unit: UNIT, landed: [{ repo: '.', into: 'main', phases: [1] }], checkout: 'main', completed_at: readManifest(dir, UNIT).completed_at,
      committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway', args: [] },
    });
    assert.deepStrictEqual([branchOut(), git(dir, ['log', '--format=%s', `${main}..main`]).trim().split('\n'), fs.readFileSync(path.join(dir, 'src', 'help.js'), 'utf8')], [
      'main', [`fix(${UNIT}): ${HELP}`, `fix(${UNIT}): ${FLAG}`], 'const help = \'--colour\';\n',
    ]);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, fs.readdirSync(statePath(dir, UNIT)).sort()], ['completed', ['build', 'discovery', 'manifest.json', 'seeds', 'summary.md']]);
  });

  it('draws the close and completes the unit where its fixes landed already, as a yes stopped after its landing leaves them', () => {
    dir = world();
    closeable();
    run(['land', 'finish', UNIT]);
    screen();
    run(['finish', 'yes', UNIT]);

    assert.strictEqual(readManifest(dir, UNIT).status, 'completed');
  });

  it('22.S22: a closed quick-fix\'s short record is returned when the knowledge base is queried for what it changed, a bulk index after its close keeping it', async () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    closeable();
    run(['finish', 'yes', UNIT]);
    const reindexed = await callAsync(dir, ['knowledge', 'index'], { env: env() });
    const res = await callAsync(dir, ['knowledge', 'query', 'flag', 'parser'], { env: env() });

    assert.deepStrictEqual([reindexed.code, res.code], [0, 0], reindexed.stderr + res.stderr);
    assert.match(res.stdout, /The flag parser reads --colour\./);
  });
});
