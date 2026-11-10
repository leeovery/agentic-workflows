'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's close (leeway-engine/scripts/domain/finish.cjs, its screen
// projections/finish.cjs, its engine items finish-checks.cjs): finish's
// checklist holding the review passed only once the person asked for one
// (6.4.10, 6.S14), its notes for later answered where none was, a question
// asked in its conversation still open, after a /clear as before it, named
// with the raise that asks it again (19.5.25), and the records indexed open
// while the store lacks summary.md as it stands; `engine render finish
// <qf>`, the close — refused while a fix has not ended, one done has no
// record or none its pair passed, and while a question asked in its
// conversation stands open; what running the product proved of each fix,
// its runs made through `verify setup` and `verify run` on the quick-fix's
// one branch, or the one line saying the project has no way to run it
// (19.5.13, 19.S21, P9); each fix's verdict from its pair, one the
// orchestrator settled said so; and each call the person changed asked its
// verdict first, at the point `close` (16.S36, 19.S22). Its yes is
// test-engine-quick-fix-close-yes.cjs's, its notes for later
// test-engine-quick-fix-close-notes.cjs's; a review asked for at the close
// is test-engine-quick-fix-review.cjs's; a fix's record is
// test-engine-quick-fix-record.cjs's, how a fix opens and is done
// test-engine-quick-fix-end.cjs's, a fix given up
// test-engine-quick-fix-given-up.cjs's.
//
// Layer: git. World: quick-fix-close-world.cjs — fixes 1.1 and 1.2 on the
// quick-fix's branch, each built through the local driver and done — built
// once and copied; and that world with the project's verify setup made in
// fix 1.1, its scenario run there (`provenWorld`). Each test's conversation
// keeps its records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, callAsync, okSectionsAsync, refusedPristine, sectionOf, layout, writeState, readManifest, fixtureFrom, cleanupFixture, keywordOnlyKnowledge, createFile,
} = require('./engine-harness.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const {
  UNIT, PLACE, FLAG, HELP, RECORDS, quickFix, createFix, fixBuilt, fixDone, recordFile, checklistClosed, asGone, entered,
} = require('./quick-fix-world.cjs');
const { RAISED, world, closeHelpers } = require('./quick-fix-close-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { closeScreen } = require(path.join(SCRIPTS, 'domain/projections/finish.cjs'));
const { roundReportPath } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { REVIEWER_LETTERS } = require(path.join(SCRIPTS, 'kernel/reviewers.cjs'));

const CRITERION = 'Given the help, when it is read, then it names --colour.';
const DOCS = 'Spell the docs --colour';
/** A pair's report failing the fix it reads. */
const FAILED = '# Review\n\n## Findings\n\n- bug: the docs still say --color\n  Scenario: the docs read\n\nVerdict: fail\n';

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
const {
  as, run, refused, record, closeable, screen, items,
} = closeHelpers(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('finish\'s checklist for a quick-fix (6.4.10, 6.S14)', () => {
  it('holds no review item until the person asks for a review, its notes answered at its close instead; asked, the review passed applies, open while the review goes on, and the review answers its notes', () => {
    dir = world();
    const unasked = items();
    const manifest = readManifest(dir, UNIT);
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, fixes: { ...manifest.fixes, review_asked: '2026-06-03T10:00:00Z' } }, null, 2));

    assert.deepStrictEqual([unasked, items()[0]], [
      ['questions-answered engine done', 'notes-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
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
    const view = { unit: UNIT, title: 'Typo', closed: [], skips: [], verdict: null, warnings: [], aside: null, product: 'app', proven: null, fixes: 0, pair: [], kept: [] };
    const out = closeScreen(view);

    assert.match(sectionOf(out, 'MENU: finish'), /\*\*`y\/yes`\*\* {4}→ Close it — mark it complete\n/);
    assert.match(sectionOf(out, 'DISPLAY: finish'), /^Typo — ready to close\n\nREVIEWED BY THE PAIR\n {2}No fix was done\.\n\n/);
  });

  it('19.5.13: draws each fix\'s verdict from its pair — one its pair failed, its review settled by the orchestrator, closes said as settled in its round', () => {
    dir = world();
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    createFile(dir, 'docs/flag.md', '--colour\n');
    run(['commit', '--paths', 'docs/flag.md', '--task', UNIT, '1.3', '-m', `fix(${UNIT}): spell the docs --colour`]);
    run(['land', 'open', UNIT, '1.3']);
    for (const letter of REVIEWER_LETTERS) writeState(dir, roundReportPath({ unit: UNIT, phase: 1, n: 3 }, 1, letter), FAILED);
    run(['task', 'settle', UNIT, '1.3', '--file', writeState(dir, layout.cache('why.md'), 'The docs are generated: the finding is the generator\'s.\n')]);
    fixDone(dir, '1.3', as());
    run(['quick-fix', 'record', UNIT, '1.3', '--file', recordFile(dir, 3, RECORDS[1])]);
    closeable();

    assert.match(sectionOf(screen(), 'DISPLAY: finish'), new RegExp(`\\nREVIEWED BY THE PAIR\\n {2}├─ ✓ 1\\.1 ${FLAG} · passed in round 1\\n {2}├─ ✓ 1\\.2 ${HELP} · passed in round 1\\n {2}└─ ✓ 1\\.3 ${DOCS} · settled in round 1\\n\\n`));
  });

  it('19.5.25: refuses while a question asked in its conversation stands open, after a /clear as before it, naming it and the raise that asks it again — its checklist\'s questions-answered held open over it, naming the same', async () => {
    dir = world();
    record(1);
    record(2);
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, RAISED.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: as().env, stdin: JSON.stringify(RAISED) });
    const fresh = { env: { ...as().env, CLAUDE_CODE_SESSION_ID: 'sess-cleared' } };
    const item = items().find((line) => line.startsWith('questions-answered'));

    assert.strictEqual(item, `questions-answered engine open — ${asked}, ${RAISED.question}, asked in the conversation and still open — raise it again for the person to answer: raise ${PLACE} --answers ${asked}`);
    assert.strictEqual(refusedPristine(dir, ['render', 'finish', UNIT], fresh).error,
      `render finish: ${UNIT} closes once each question asked in it is answered — ${asked} ${RAISED.question}: raise it again for the person to answer, raise ${PLACE} --answers ${asked}`);
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
