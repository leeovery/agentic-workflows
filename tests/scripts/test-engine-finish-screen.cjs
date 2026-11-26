'use strict';

// ---------------------------------------------------------------------------
// Finish's screen (ledger-engine/scripts/domain/finish.cjs, its screen
// domain/projections/finish.cjs): `engine render finish <unit>`, standing on
// finish's close — no checklist item skipped drawn, read by a later
// conversation, no measure (17.S2), no verdict asked of a call the person
// changed in the build or the review phase (14.S9, 16.S35), questions about
// what was built invited, then
// yes — saying it lands the unit's own branch on the default branch, for a
// unit with one (14.5.2, 14.S19) — and a comment; and the units it refuses, `land finish` refusing each
// as it does. Every refusal writes and commits nothing. The inbox items the
// unit closed are test-engine-finish-inbox.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { output, sectionOf, keywordOnlyKnowledge, layout, commitAll, git } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const {
  UNIT, calls, reviewCall, useWorld, env, reviewPassed, finishClosed, finishReady, readManifest, writeState, ok, assert,
} = require('./review-world.cjs');
const { finishHelpers } = require('./finish-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { screen, refused, checklist } = finishHelpers(() => dir);

/** The person's replacement of Claude's call `entry`, at `at`, standing over its lean: its short id. @param {string} at @param {string} entry @param {string} text */
const overruled = (at, entry, text) => ok(dir, ['ledger', 'replace', at, '--replaces', entry, '--reason', 'changed-mind'], {
  env: env(), stdin: JSON.stringify({ by: 'person', text, why: 'The person wants it so.', drops: ['the call'] }),
}).id;

describe('render finish (14.5.1)', () => {
  it('14.S9, 17.S2: draws no skip on the way, the skips kept on the manifest alone, read by a later conversation, no measure — then questions invited, the yes running finish and a comment', () => {
    reviewPassed();
    checklist(['skip', 'phase-start', UNIT, '1', 'design-settled', '--reason', 'One task alone.']);
    checklist(['skip', 'finish', UNIT, 'build-log-closed', '--reason', 'The build kept no log.']);
    checklist(['close', 'finish', UNIT]);
    const out = screen('later-session');

    assert.strictEqual(sectionOf(out, 'DISPLAY: finish'), 'Pay — finish\n');
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

  it('14.S19: for a unit with its own branch, the yes says it lands that branch on the default branch', () => {
    reviewPassed();
    git(dir, ['branch', `feat/${UNIT}`, 'main']);
    createManifest(dir, UNIT, { ...readManifest(dir, UNIT), build: { ...readManifest(dir, UNIT).build, branch: `feat/${UNIT}` } });
    finishClosed();

    assert.match(sectionOf(screen('later-session'), 'MENU: finish'), new RegExp(`^\\*\\*\`y/yes\`\\*\\*   → Land feat/${UNIT} on main, and complete the work$`, 'm'));
  });

  it('16.S35: asks no verdict of a call the person changed in the build or the review phase: each was owed as it was changed, and the screen draws its gate', () => {
    finishReady();
    overruled(`${UNIT}.implementation`, calls.retry, 'A charge is retried once.');
    overruled(`${UNIT}.review`, reviewCall('The expiry finding is filed.', 'It is out of the change.'), 'The expiry finding is dropped.');
    const out = screen();

    assert.deepStrictEqual([out.includes('VERDICT'), out.includes('MENU: finish')], [false, true]);
  });

  it('refuses a unit the project lacks, one not in progress, a build not begun, its review phase not over, a checklist open, and an engine item failing since its close, writing nothing — land finish refusing each as it does', () => {
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

    assert.deepStrictEqual([both('nope'), both('half'), both('fresh'), reviewing, open, stale], [
      'there is no work unit "nope" — the start menu lists the work in progress',
      'half is completed — new work starts from the start menu',
      'fresh\'s build has not begun — ready to build\'s yes begins it: render ready-to-build fresh',
      `${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`,
      `finish is open — its items are worked, then it is closed: checklist close finish ${UNIT}`,
      'finish has items open since its close: records-indexed — they are worked, and it is closed again',
    ].map((said) => [`render finish: ${said}`, `land: ${said}`]));
  });
});
