'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's close (leeway-engine/scripts/domain/finish.cjs, its screen
// projections/finish.cjs, its engine items finish-checks.cjs): finish's
// checklist holding the review passed only once the person asked for one
// (6.4.10, 6.S14), and the records indexed open while the store lacks
// summary.md as it stands; `engine render finish <qf>`, the close — refused
// while a fix has not ended or one done has no record; what running the
// product proved of each fix, its runs made through `verify setup` and
// `verify run` on the quick-fix's one branch, or the one line saying the
// project has no way to run it (19.5.13, 19.S21, P9), its yes merging the
// quick-fix's one pull request where a fix done is still to land, saying so
// where they have landed, and merging nothing where no fix is done; each
// call the person changed asked its verdict first, at the point `close`
// (16.S36, 19.S22); and
// `engine finish yes <qf>` — refused while a question Claude raised in its
// conversation stands open in its ledger, after a /clear as before it
// (19.5.25), and while the checkout holds changes not committed, landing
// nothing — landing the pull request through the local
// landing driver as one commit, its fixes in the order they were done
// (19.5.17), putting the checkout back on the branch it
// lands on, completing the unit and naming the start menu, its folder then
// holding `build/` and `summary.md` alone of the work (4.S23), its record
// found once it is closed (22.S22). A review asked for at the close is
// test-engine-quick-fix-review.cjs's; a fix's record is
// test-engine-quick-fix-record.cjs's, how a fix opens and is done
// test-engine-quick-fix-end.cjs's, a fix given up
// test-engine-quick-fix-given-up.cjs's; the landing as one pull request, on
// every driver, GitHub's among them (19.S38),
// test-engine-landing-conformance-quick-fix.cjs's.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2 on the quick-fix's branch, each built through the local driver and
// done — built once and copied; and that world with the project's verify
// setup made in fix 1.1, its scenario run there (`provenWorld`). Each
// test's conversation keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, callAsync, okSectionsAsync, refusedPristine, sectionOf, git, stateGit, statePath, layout, writeState, readManifest, fixtureFrom, cleanupFixture, keywordOnlyKnowledge, createFile,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const {
  UNIT, PLACE, DESCRIPTION, FLAG, HELP, RECORDS, quickFix, createFix, fixBuilt, fixDone, recordFile, twoFixesBuilt, checklistClosed, asGone, entered,
} = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { closeScreen } = require(path.join(SCRIPTS, 'domain/projections/finish.cjs'));
const { roundReportPath } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { REVIEWER_LETTERS } = require(path.join(SCRIPTS, 'kernel/reviewers.cjs'));

const CRITERION = 'Given the help, when it is read, then it names --colour.';

/** Claude's call raised in the quick-fix's conversation, as the raise suites make one. */
const RAISED = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

const world = fixtureFrom('quick-fix-close-', twoFixesBuilt);

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
    fixDone(dir, '1.1', as);
    fixBuilt(dir, 2, HELP, 'src/help.js', 'const help = \'--colour\';\n', as);
  });
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-close-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, as()).error;

/** Fix `n`'s record written through the verb. @param {number} n */
const record = (n) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n])]);

/** Both fixes recorded and the close's checklist closed. */
function closeable() {
  record(1);
  record(2);
  checklistClosed(dir, as());
}

/** The close as the conversation draws it. */
const screen = () => output(dir, ['render', 'finish', UNIT], as());

/** The yes's words, as the close's gate offers it. */
const yesRow = () => sectionOf(screen(), 'MENU: finish').split('\n').find((line) => line.startsWith('**`y/yes`**'));

/** The branch the project's checkout has out. */
const branchOut = () => git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();

/** Finish's items, a line each: key, who checks it, where it stands, and its way on where it names one. */
const items = () => run(['checklist', 'show', 'finish', UNIT]).items.map((/** @type {any} */ { key, by, state, way }) => `${key} ${by} ${state}${way === undefined ? '' : ` — ${way}`}`);

describe('finish\'s checklist for a quick-fix (6.4.10, 6.S14)', () => {
  it('holds no review item until the person asks for a review; asked, the review passed applies, open while the review goes on', () => {
    dir = world();
    const unasked = items();
    const manifest = readManifest(dir, UNIT);
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, fixes: { ...manifest.fixes, review_asked: '2026-06-03T10:00:00Z' } }, null, 2));

    assert.deepStrictEqual([unasked, items()[0]], [
      ['questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
      `review-passed engine open — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`,
    ]);
  });

  it('22.6.9: holds the records indexed open while the store lacks summary.md as it stands, done once the unit is indexed', async () => {
    dir = world();
    record(1);
    keywordOnlyKnowledge(dir);
    const open = items().at(-1);
    assert.strictEqual((await callAsync(dir, ['knowledge', 'index', '--work-unit', UNIT], as())).code, 0);

    assert.deepStrictEqual([open, items().at(-1)], [
      `records-indexed engine open — the knowledge base does not hold ${layout.unit(UNIT, 'summary.md')} as it stands — knowledge index --work-unit ${UNIT}`,
      'records-indexed engine done',
    ]);
  });
});

describe('render finish <quick-fix>: the close (19.5.8, 19.5.13)', () => {
  it('refuses while a fix has not ended, and while a fix done has no record, naming each, writing nothing — land finish as the close refuses', () => {
    dir = world();
    checklistClosed(dir, as());
    const unrecorded = refused(['render', 'finish', UNIT]);
    const landing = refused(['land', 'finish', UNIT]);
    record(1);
    createFix(dir, 3, 'Spell the docs --colour', as());

    assert.deepStrictEqual([unrecorded, landing, refused(['render', 'finish', UNIT]), refused(['finish', 'yes', UNIT])], [
      `render finish: ${UNIT} closes once each fix done has its record — 1.1, 1.2 have none: quick-fix record ${UNIT} 1.1 --file <record.md>`,
      `land: ${UNIT} closes once each fix done has its record — 1.1, 1.2 have none: quick-fix record ${UNIT} 1.1 --file <record.md>`,
      `render finish: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it is committed, in ${UNIT}'s pull request and passed by its pair, or closed with its reason`,
      `finish yes: ${UNIT} closes once each of its fixes has ended — 1.3 is not started: each is done once it is committed, in ${UNIT}'s pull request and passed by its pair, or closed with its reason`,
    ]);
  });

  it('19.5.22: refuses a fix done whose pair has passed no round of it, as one marked done in the tracker by hand leaves it, naming its pair — land finish as the close refuses', () => {
    dir = world();
    closeable();
    for (const letter of REVIEWER_LETTERS) writeState(dir, roundReportPath({ unit: UNIT, phase: 1, n: 2 }, 2, letter), '# Review\n\n## Findings\n\n- bug: the help still says --color\n  Scenario: the help read\n\nVerdict: fail\n');
    const said = `${UNIT} closes once its pair has passed each fix done — 1.2 has no round its pair passed: its pair reads it, engine brief reviewer ${UNIT} 1.2 --letter a, and b`;

    assert.deepStrictEqual([refused(['render', 'finish', UNIT]), refused(['land', 'finish', UNIT])], [`render finish: ${said}`, `land: ${said}`]);
  });

  it('19.S21: says what running the product proved of each fix, no review step on its checklist, and nothing changed by the person, no verdict — then the yes, a review asked for, and questions about the change', () => {
    dir = provenWorld();
    closeable();
    const out = screen();

    assert.strictEqual(sectionOf(out, 'DISPLAY: finish'), [
      'Typo — ready to close',
      '',
      'REVIEWED BY THE PAIR',
      `  ├─ ✓ 1.1 ${FLAG} · passed in round 1`,
      `  └─ ✓ 1.2 ${HELP} · passed in round 1`,
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
      '**`y/yes`**    → Close it — merge its pull request and mark it complete',
      '**`r/review`** → Have the whole change reviewed before it closes',
      '**Ask**      → Ask about the change before it closes',
      '',
    ].join('\n'));
    assert.deepStrictEqual(run(['gate', 'finish', '--pick', 'y']).next, { kind: 'engine', argv: ['finish', 'yes', UNIT] });
  });

  it('offers a yes that merges nothing, where no fix is done', () => {
    const view = { unit: UNIT, title: 'Typo', skips: [], verdict: null, warnings: [], aside: null, product: 'app', proven: null, fixes: 0, pair: [] };
    const out = closeScreen(view);

    assert.match(sectionOf(out, 'MENU: finish'), /\*\*`y\/yes`\*\* {4}→ Close it — mark it complete\n/);
    assert.match(sectionOf(out, 'DISPLAY: finish'), /^Typo — ready to close\n\nREVIEWED BY THE PAIR\n {2}No fix was done\.\n\n/);
  });

  it('19.5.13: draws each fix\'s verdict from its pair, a round the orchestrator settled said as settled', () => {
    const view = { unit: UNIT, title: 'Typo', skips: [], verdict: null, warnings: [], aside: null, product: 'app', proven: null, fixes: 2, pair: [{ task: '1.1', title: FLAG, round: 1, settled: false }, { task: '1.2', title: HELP, round: 3, settled: true }] };

    assert.match(sectionOf(closeScreen(view), 'DISPLAY: finish'), new RegExp(`^Typo — ready to close\\n\\nREVIEWED BY THE PAIR\\n {2}├─ ✓ 1\\.1 ${FLAG} · passed in round 1\\n {2}└─ ✓ 1\\.2 ${HELP} · settled in round 3\\n\\n`));
  });

  it('P9: says in one line that the project has no way to run the product, where no verify setup is recorded', () => {
    dir = world();
    closeable();
    assert.strictEqual(sectionOf(screen(), 'DISPLAY: finish'), [
      'Typo — ready to close', '', 'REVIEWED BY THE PAIR', `  ├─ ✓ 1.1 ${FLAG} · passed in round 1`, `  └─ ✓ 1.2 ${HELP} · passed in round 1`, '',
      `Nothing was proven by running ${projectName(dir)} — the project has no way to run it`, '',
    ].join('\n'));
  });

  it('16.S36, 19.S22: asks a verdict on the call the person changed in it, at the close, before its gate — the yes refused until it is given', () => {
    dir = world();
    closeable();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(PLACE, ask(PLACE, 'Does --color still work?'), 'It stays as an alias.');
    ok(dir, ['ledger', 'replace', PLACE, '--replaces', call, '--reason', 'changed-mind'], {
      ...as(), stdin: JSON.stringify({ by: 'person', text: 'It is dropped.', why: 'The person wants it so.', drops: ['the alias'] }),
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
  it('refuses while the checkout holds changes not committed, landing nothing — land finish and land phase as it does; then lands the fixes, puts the checkout back on the branch it lands on, completes the unit and names the start menu — its folder holding build/ and summary.md, no topics/ and no spec.md (4.S23)', () => {
    dir = world();
    closeable();
    fs.writeFileSync(path.join(dir, 'src', 'stray.js'), 'stray\n');
    const main = git(dir, ['rev-parse', 'main']).trim();
    const dirty = [refused(['finish', 'yes', UNIT]), refused(['land', 'finish', UNIT]), refused(['land', 'phase', UNIT, '1']), git(dir, ['rev-parse', 'main']).trim()];
    fs.rmSync(path.join(dir, 'src', 'stray.js'));
    const done = run(['finish', 'yes', UNIT]);

    const stray = `${UNIT}'s tasks were built in the project's own checkout, which holds changes not committed — src/stray.js — so nothing was landed: commit them or set them aside, then close it again`;
    assert.deepStrictEqual(dirty, [`finish yes: ${stray}`, `land: ${stray}`, `land: ${stray}`, main]);
    assert.deepStrictEqual({ ...done, landed: done.landed.map((/** @type {any} */ { repo, into, merged }) => ({ repo, into, merged })) }, {
      ok: true, unit: UNIT, landed: [{ repo: '.', into: 'main', merged: ['1.1', '1.2'] }], checkout: 'main', completed_at: readManifest(dir, UNIT).completed_at,
      committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway', args: [] },
    });
    assert.deepStrictEqual([branchOut(), git(dir, ['log', '--format=%s', `${main}..main`]).trim(), fs.readFileSync(path.join(dir, 'src', 'help.js'), 'utf8')], [
      'main', `fix(${UNIT}): ${DESCRIPTION}`, 'const help = \'--colour\';\n',
    ]);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, fs.readdirSync(statePath(dir, UNIT)).sort()], ['completed', ['build', 'discovery', 'manifest.json', 'seeds', 'summary.md']]);
  });

  it('19.5.25: never lands over a question Claude raised in its conversation still open in its ledger, after a /clear as before it — land finish and land phase as it does — naming it and the raise that asks it again; raised again and answered, it lands', async () => {
    dir = world();
    closeable();
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, RAISED.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: as().env, stdin: JSON.stringify(RAISED) });
    const fresh = { env: { ...as().env, CLAUDE_CODE_SESSION_ID: 'sess-cleared' } };
    const main = git(dir, ['rev-parse', 'main']).trim();
    const open = [
      refusedPristine(dir, ['finish', 'yes', UNIT], fresh).error, refusedPristine(dir, ['land', 'finish', UNIT], fresh).error,
      refusedPristine(dir, ['land', 'phase', UNIT, '1'], fresh).error, git(dir, ['rev-parse', 'main']).trim(),
    ];
    const { res } = await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: fresh.env, stdin: JSON.stringify(RAISED) });
    ok(dir, ['raise', 'answer', res.raise, '--pick', '1'], { ...fresh, stdin: JSON.stringify({ why: 'Old scripts keep working.' }) });
    const done = ok(dir, ['finish', 'yes', UNIT], fresh);

    const said = `${UNIT} closes once each question asked in it is answered — ${asked} ${RAISED.question}: raise it again for the person to answer, raise ${PLACE} --answers ${asked}`;
    assert.deepStrictEqual(open, [`finish yes: ${said}`, `land: ${said}`, `land: ${said}`, main]);
    assert.deepStrictEqual([done.landed.map(({ merged }) => merged), readManifest(dir, UNIT).status], [[['1.1', '1.2']], 'completed']);
  });

  it('19.5.17: squashes the fixes in the order they were done, as their records were written, never by their numbers', () => {
    dir = world();
    record(2);
    record(1);
    checklistClosed(dir, as());
    const landed = run(['land', 'finish', UNIT]);

    assert.deepStrictEqual([landed.repos.map((/** @type {any} */ { merged }) => merged), git(dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [
      [['1.2', '1.1']], [`Task: ${UNIT}-1-2`, `Task: ${UNIT}-1-1`],
    ]);
  });

  it('draws the close and completes the unit where its fixes landed already, as a yes stopped after its landing leaves them, its yes saying they have landed', () => {
    dir = world();
    closeable();
    run(['land', 'finish', UNIT]);
    const row = yesRow();
    run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([row, readManifest(dir, UNIT).status], ['**`y/yes`**    → Close it — its fixes have landed, so mark it complete', 'completed']);
  });

  it('22.S22: a closed quick-fix\'s short record is returned when the knowledge base is queried for what it changed, a bulk index after its close keeping it', async () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    closeable();
    run(['finish', 'yes', UNIT]);
    const reindexed = await callAsync(dir, ['knowledge', 'index'], as());
    const res = await callAsync(dir, ['knowledge', 'query', 'flag', 'parser'], as());

    assert.deepStrictEqual([reindexed.code, res.code], [0, 0], reindexed.stderr + res.stderr);
    assert.match(res.stdout, /The flag parser reads --colour\./);
  });
});
