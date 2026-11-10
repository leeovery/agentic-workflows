'use strict';

// ---------------------------------------------------------------------------
// Finish (leeway-engine/scripts/domain/finish.cjs, its screen
// domain/projections/finish.cjs, its engine items domain/finish-checks.cjs):
// finish's checklist (6.4.10) — the review phase over, read from its
// rounds' records, only where the unit has a review phase, no question
// waiting on the person, and the unit's records indexed, only where the
// checkout's knowledge base is set up, each the engine's; Claude's items
// worked in its own order, one skipped, and the close (2.S2); `engine
// render finish <unit>`, standing on that close — every checklist item
// skipped on the way, with its reason, read from the manifest by a later
// conversation (6.S23, 6.S32), no measure (17.S2), each call the person
// changed in the build and the review phase asked its verdict before the
// gate (14.S9, 16.S35) and nothing added where they changed none (16.10.5),
// questions about what was built invited, then yes and a comment; and the
// units it refuses, `land finish` refusing each as it does. Every refusal
// writes and commits nothing. The yes is test-engine-finish-yes.cjs's, and
// a quick-fix's close test-engine-quick-fix-close.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { sectionOf, callAsync, keywordOnlyKnowledge, layout, commitAll } = require('./engine-harness.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const {
  UNIT, EVERY, calls, reviewCall, useWorld, env, enter, reported, recorded, fixPhaseWritten, taskMade, fixBuilt, fixClosed, reviewPassed, finishClosed, finishReady, readManifest, writeState, stateGit, ok, assert,
} = require('./review-world.cjs');
const { finishHelpers } = require('./finish-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { screen, refused } = finishHelpers(() => dir);

/** A checklist verb, which must succeed. @param {string[]} args */
const checklist = (args) => ok(dir, ['checklist', ...args], { env: env() });

/** Finish's items, a line each: key, who checks it, where it stands, and its way on where it names one. @param {string} [unit] */
const items = (unit = UNIT) => checklist(['show', 'finish', unit]).items.map((/** @type {any} */ { key, by, state, way }) => `${key} ${by} ${state}${way === undefined ? '' : ` — ${way}`}`);

/** The person's replacement of Claude's call `entry`, at `at`, standing over its lean: its short id. @param {string} at @param {string} entry @param {string} text */
const overruled = (at, entry, text) => ok(dir, ['ledger', 'replace', at, '--replaces', entry, '--reason', 'changed-mind'], {
  env: env(), stdin: JSON.stringify({ by: 'person', text, why: 'The person wants it so.', drops: ['the call'] }),
}).id;

describe('finish\'s checklist (6.4.10, 2.S2)', () => {
  it('reads the review phase passed from its rounds\' records — open in round 1 with the way in, open while a task of a passing round\'s fix phase waits, one written beyond its findings among them, done once each is built or closed — never marked', () => {
    const before = items();
    enter();
    reported(1, EVERY, { '2-refunds-a': ['nit: A refund\'s label is terse.'] });
    fixPhaseWritten(3, [['Word the label', '§2.1']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-a#1'], fix: '3.1' }] });
    taskMade(3, 'Mail the receipt', '§1.2');
    const waiting = items();
    fixBuilt(3, 1, 'Word the label', 'main', 'src/label.js');
    const beyond = items();
    fixClosed(3, 2);

    assert.deepStrictEqual([before, waiting, beyond, items()], [
      [`review-passed engine open — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`, 'questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
      [`review-passed engine open — ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.1 not started, task 3.2 not started`, 'questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
      [`review-passed engine open — ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.2 not started`, 'questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
      ['review-passed engine done', 'questions-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
    ]);
    assert.strictEqual(refused(['checklist', 'done', 'finish', UNIT, 'review-passed']), 'checklist done: review-passed is the engine\'s to check, never marked — it reads done once it holds');
  });

  it('12.13.22: holds the unit open while a question of it waits on the person, wherever it was raised, naming each and the stop — a close made before one was raised standing at neither the gate nor the yes', async () => {
    finishReady();
    const asks = 'Should a refund name its card?';
    const asked = ok(dir, ['ledger', 'ask', `${UNIT}.review`], { env: env(), stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: asks }) }).id;
    const raised = await callAsync(dir, ['raise', `${UNIT}.review`, '--answers', asked], { env: env(), stdin: JSON.stringify({ ...leaningCall('A refund names it.', 'A refund names none.'), question: asks }) });
    assert.strictEqual(raised.code, 0, raised.stderr);
    const { parked } = JSON.parse(raised.stdout.split('\n')[0]);

    assert.deepStrictEqual([items()[1], refused(['render', 'finish', UNIT]), refused(['finish', 'yes', UNIT]), refused(['land', 'finish', UNIT])], [
      `questions-answered engine open — ${parked}, ${asks} — the unit never finishes over a question waiting on the person: stop for them, render build-stop ${UNIT}, and take each once they are ready to discuss it`,
      'render finish: finish has items open since its close: questions-answered — they are worked, and it is closed again',
      'finish yes: finish has items open since its close: questions-answered — they are worked, and it is closed again',
      'land: finish has items open since its close: questions-answered — they are worked, and it is closed again',
    ]);
  });

  it('names the review\'s entry refusal as the way on where the review cannot be entered yet, and holds no review item for a quick-fix, but its notes answered', () => {
    assert.deepStrictEqual([items('half')[0], items('tweak')], [
      'review-passed engine open — half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      ['questions-answered engine done', 'notes-answered engine done', 'inbox-closed claude open', 'build-log-closed claude open'],
    ]);
  });

  it('reads the records indexed only where the knowledge base is set up: open, naming each record the store does not hold as it stands, done once the unit is indexed', async () => {
    const unset = items();
    keywordOnlyKnowledge(dir);
    const open = checklist(['show', 'finish', UNIT]).items.at(-1);
    assert.strictEqual((await callAsync(dir, ['knowledge', 'index', '--work-unit', UNIT], { env: env() })).code, 0);

    assert.deepStrictEqual([unset.length, open, items().at(-1)], [4, {
      key: 'records-indexed', text: 'the records indexed', by: 'engine', state: 'open',
      way: `the knowledge base does not hold .knowledge/records/${UNIT}.md as it stands — knowledge index --work-unit ${UNIT}`,
    }, 'records-indexed engine done']);
  });

  it('ends each of Claude\'s items done or skipped in its own order, its reason recorded, and the close recorded on the unit\'s manifest — Claude\'s marks and the close alone, each write committed alone', () => {
    reviewPassed();
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const marks = {
      'build-log-closed': checklist(['done', 'finish', UNIT, 'build-log-closed']),
      'inbox-closed': checklist(['skip', 'finish', UNIT, 'inbox-closed', '--reason', 'No inbox item was resolved.']),
    };
    const closing = checklist(['close', 'finish', UNIT]);

    const stored = (/** @type {any} */ { state, reason, at }) => (reason === undefined ? { state, at } : { state, reason, at });
    assert.deepStrictEqual(readManifest(dir, UNIT).checklists.finish, { items: Object.fromEntries(Object.entries(marks).map(([key, mark]) => [key, stored(mark)])), closed: closing.closed });
    assert.deepStrictEqual(stateGit(dir, ['log', '--reverse', '--format=%s', `${before}..HEAD`]).trim().split('\n'), [
      `checklist(${UNIT}): finish build-log-closed done`, `checklist(${UNIT}): finish inbox-closed skipped`, `checklist(${UNIT}): finish closed`,
    ]);
    assert.deepStrictEqual([...new Set(stateGit(dir, ['log', '--format=', '--name-only', `${before}..HEAD`]).trim().split('\n'))], [layout.manifest(UNIT)]);
  });
});

describe('render finish (14.5.1)', () => {
  it('14.S9, 6.S23, 6.S32, 17.S2: draws every skip on the way with its reason, read by a later conversation, no measure, and, nothing changed by the person, no verdict — then questions invited, the yes running finish and a comment', () => {
    finishReady();
    const out = screen('later-session');

    assert.strictEqual(sectionOf(out, 'DISPLAY: finish'), [
      'Pay — finish',
      '',
      '  ⚑ Skipped at phase 1\'s start: shared design settled — One task',
      '    alone.',
      '  ⚑ Skipped at finish: resolved inbox items closed — No inbox',
      '    item was resolved.',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: finish'), [
      '· · · · · · · · · · · ·',
      'Ask me anything about what was built first — I answer it before we finish.',
      '',
      '**`◆ Finish the work?`**',
      '',
      '**`y/yes`**   → Land what still stands, and complete the work',
      '**Comment** → Ask about what was built, or tell me what to change',
      '',
    ].join('\n'));
    assert.deepStrictEqual(ok(dir, ['gate', 'finish', '--pick', 'y'], { env: env('later-session') }).next, { kind: 'engine', argv: ['finish', 'yes', UNIT] });
  });

  it('16.S35: asks a verdict on each call the person changed in the build and the review phase, one at a time, at finish, before the gate — a change at the spec never asked here — the yes refused until each is given', () => {
    finishReady();
    const retry = overruled(`${UNIT}.implementation`, calls.retry, 'A charge is retried once.');
    overruled(`${UNIT}.specification`, calls.copy, 'The receipt names the brand.');
    const dropped = overruled(`${UNIT}.review`, reviewCall('The expiry finding is filed.', 'It is out of the change.'), 'The expiry finding is dropped.');
    const first = screen();
    const yes = refused(['finish', 'yes', UNIT]);
    const landing = refused(['land', 'finish', UNIT]);
    const { argv } = ok(dir, ['gate', 'verdict', '--pick', 'n'], { env: env() }).next;
    ok(dir, ['verdict', 'give', retry, 'nothing', '--at', 'finish'], { env: env() });
    const second = screen();
    ok(dir, ['verdict', 'give', dropped, 'nothing', '--at', 'finish'], { env: env() });

    assert.match(sectionOf(first, 'DISPLAY: finish'), /\n\nYOUR VERDICT \(1 of 2 calls you changed\)\n {2}└─ How often is a charge retried\?\n {8}My answer: A charge is retried twice\.\n {8}Yours: A charge is retried once\.\n$/);
    assert.match(sectionOf(second, 'DISPLAY: finish'), /\n\nYOUR VERDICT \(2 of 2 calls you changed\)\n {2}└─ Is this finding filed or dropped\?\n {8}My answer: The expiry finding is filed\.\n {8}Yours: The expiry finding is dropped\.\n$/);
    assert.ok(![first, second].some((shown) => shown.includes('MENU: finish')), 'the gate waits on the verdicts');
    assert.deepStrictEqual([yes, landing, argv[2].startsWith(retry), argv.filter((_, at) => at !== 2)], [
      'finish yes: a verdict is still to ask — render finish asks each before the yes', 'land: a verdict is still to ask — render finish asks each before the yes', true, ['verdict', 'give', 'nothing', '--at', 'finish'],
    ]);
    assert.match(screen(), /=== MENU: finish /);
  });

  it('refuses a unit the project lacks, one not in progress, one built under the old plan, a build not begun, its review phase not over, a checklist open, and an engine item failing since its close, writing nothing — land finish refusing each as it does', () => {
    /** Its refusal of the unit, and land finish's. @param {string} unit */
    const both = (unit) => [refused(['render', 'finish', unit]), refused(['land', 'finish', unit])];
    const reviewing = both(UNIT);
    reviewPassed();
    const open = both(UNIT);
    finishClosed();
    keywordOnlyKnowledge(dir);
    const stale = both(UNIT);
    writeState(dir, layout.manifest('half'), JSON.stringify({ ...readManifest(dir, 'half'), status: 'completed' }, null, 2));
    commitAll(dir, 'half completed');

    assert.deepStrictEqual([both('nope'), both('half'), both('old'), both('fresh'), reviewing, open, stale], [
      'there is no work unit "nope" — the start menu lists the work in progress',
      'half is completed — new work starts from the start menu',
      'old was built under the old plan, and its build is entered once the reshape\'s 29.17 migration has cut it',
      'fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      `${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`,
      `finish is open — its items are worked, then it is closed: checklist close finish ${UNIT}`,
      'finish has items open since its close: records-indexed — they are worked, and it is closed again',
    ].map((said) => [`render finish: ${said}`, `land: ${said}`]));
  });
});
