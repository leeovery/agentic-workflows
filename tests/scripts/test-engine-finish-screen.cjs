'use strict';

// ---------------------------------------------------------------------------
// Finish's screen (leeway-engine/scripts/domain/finish.cjs, drawn by
// domain/projections/finish.cjs): `engine render finish <unit>`, standing on
// finish's close — every checklist item skipped on the way, with its reason,
// read from the manifest by a later conversation (6.S23, 6.S32), no measure
// (17.S2), each call the person changed in the build and the review phase
// asked its verdict before the gate (14.S9, 16.S35) and nothing added where
// they changed none (16.10.5), questions about what was built invited, then
// yes and a comment; and the units it refuses, `land finish` refusing each
// as it does. Every refusal writes and commits nothing. A quick-fix's close
// is test-engine-quick-fix-close.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { sectionOf, keywordOnlyKnowledge, layout, commitAll } = require('./engine-harness.cjs');
const {
  UNIT, calls, reviewCall, useWorld, env, finishClosed, readManifest, writeState, ok, assert,
} = require('./review-world.cjs');
const { reviewPassed, finishReady, finishHelpers } = require('./finish-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { screen, refused } = finishHelpers(() => dir);

/** The person's replacement of Claude's call `entry`, at `at`, standing over its lean: its short id. @param {string} at @param {string} entry @param {string} text */
const overruled = (at, entry, text) => ok(dir, ['ledger', 'replace', at, '--replaces', entry, '--reason', 'changed-mind'], {
  env: env(), stdin: JSON.stringify({ by: 'person', text, why: 'The person wants it so.', drops: ['the call'] }),
}).id;

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
