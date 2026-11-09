'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's review run, once asked for at its close (19.S23): a fix
// task of its round built on the quick-fix's one branch through the door, a
// later round passing and handing back to the close, whose checklist then
// carries the review passed and whose yes lands the fixes and the fix task
// in one commit (19.5.15); a question asked in it still open holding the
// close (19.5.25); a round passing with a nit handing back once its fix
// task is done or closed, or once the note its builder left is answered;
// `land finish` refused while the review asked for has not passed; a merge
// by hand of the fixes leaving the review's fix task still to land, the
// close's yes saying it merges; and its phases and tasks drawn as a
// quick-fix's (build-screens.cjs). Its ask, entry and briefs:
// test-engine-quick-fix-review.cjs.
//
// Layer: git. World: quick-fix-review-world.cjs, the close reached, built
// once and copied. Each test's conversation keeps its records in a config
// folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, okSections, output, sectionOf, git, statePath, layout, writeState, createFile, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, BRANCH } = require('./quick-fix-world.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { CLOSE, closeReached: world, quickFixReview } = require('./quick-fix-review-world.cjs');

let dir = ''; // the project
const {
  as, run, refused, payload, entered, firstRoundFailed, fixTaskBuilt, nitRoundPassed, nitTaskBuilt, secondRoundPassed, closeMenu,
} = quickFixReview(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('19.S23: the review asked for runs over the quick-fix\'s record and its change-set, and the close is still its finish gate', () => {
  it('asked for and not yet entered, the close\'s yes, land phase and land finish each refused until the review phase is over, nothing landed', () => {
    dir = world();
    run(['review', 'ask', UNIT]);
    const main = git(dir, ['rev-parse', 'main']).trim();
    const over = `${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`;

    assert.deepStrictEqual([refused(['finish', 'yes', UNIT]), refused(['land', 'phase', UNIT, '1']), refused(['land', 'finish', UNIT]), git(dir, ['rev-parse', 'main']).trim()], [
      `finish yes: ${over}`, `land: ${over}`, `land: ${over}`, main,
    ]);
  });

  it('a round\'s fix task built on the quick-fix\'s branch through the door; the round that passes hands back to the close, its checklist carrying the review passed, its yes landing the fixes and the fix task in one commit, land phase refused as land finish is while it goes on', () => {
    dir = world();
    firstRoundFailed();
    const reviewing = refused(['render', 'finish', UNIT]);
    const landing = refused(['land', 'finish', UNIT]);
    const phaseLanding = refused(['land', 'phase', UNIT, '1']);
    fixTaskBuilt();
    const passed = secondRoundPassed();
    const review = run(['checklist', 'show', 'finish', UNIT]).items.find((/** @type {{key: string}} */ { key }) => key === 'review-passed');
    const menu = closeMenu();
    const main = git(dir, ['rev-parse', 'main']).trim();
    const closed = run(['finish', 'yes', UNIT]);

    assert.deepStrictEqual([reviewing, landing, phaseLanding], [
      `render finish: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 2 — enter review ${UNIT}`,
      `land: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 2 — enter review ${UNIT}`,
      `land: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 2 — enter review ${UNIT}`,
    ]);
    assert.deepStrictEqual([passed.ends, passed.next, review.state], [true, { kind: 'engine', argv: ['render', 'finish', UNIT] }, 'done']);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(statePath(dir, layout.unit(UNIT, 'review', 'round-1.json')), 'utf8')).scenarios.map((/** @type {{scenario: string}} */ { scenario }) => scenario), ['1.S1', '2.S1']);
    assert.deepStrictEqual(menu.split('\n').filter((line) => line.startsWith('**')).slice(1), [
      '**`y/yes`** → Close it — merge its pull request and mark it complete',
      '**Ask**   → Ask about the change before it closes',
    ]);
    assert.deepStrictEqual([closed.landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), git(dir, ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm), git(dir, ['rev-list', '--count', `${main}..main`]).trim()], [
      [['1.1', '1.2', '2.1']], [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`, `Task: ${UNIT}-2-1`], '1',
    ]);
  });

  it('a question asked in its review still open holds the close\'s yes, land finish and land phase, naming it and its raise again at the review\'s place; answered, the yes lands (19.5.25)', () => {
    dir = world();
    firstRoundFailed();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const asked = ask(`${UNIT}.review`, 'Does the man page spell it --colour?');
    fixTaskBuilt();
    secondRoundPassed();
    closeMenu();
    const held = [refused(['finish', 'yes', UNIT]), refused(['land', 'finish', UNIT]), refused(['land', 'phase', UNIT, '1'])];
    decide(`${UNIT}.review`, asked, 'The man page is generated from the help.');

    for (const error of held) assert.match(error, new RegExp(`${UNIT} closes once each question asked in it is answered — \\S+ Does the man page spell it --colour\\?: raise it again for the person to answer, raise ${UNIT}\\.review --answers \\S+$`));
    assert.deepStrictEqual(run(['finish', 'yes', UNIT]).landed.map((/** @type {{merged: string[]}} */ { merged }) => merged), [['1.1', '1.2', '2.1']]);
  });

  it('with a fix task in flight, enters the review again in the same conversation, in a new one and through the recovery note, the task in flight in each, the note re-reading its record', () => {
    dir = world();
    firstRoundFailed();
    run(['task', 'start', UNIT, '2.1']);
    const again = entered();
    createFile(dir, '.claude/skills/leeway-review-process/SKILL.md', '# The review\n');
    const note = output(dir, ['conversation', 'position', 'sess-1'], as());
    const fresh = sectionOf(okSections(dir, ['enter', 'review', UNIT], { env: { ...as().env, CLAUDE_CODE_SESSION_ID: 'sess-2' } }).sections, 'DATA').split('\n');

    const inFlight = 'in flight: task 2.1, no builder dispatched here — its builder and pair go afresh on its branch';
    assert.deepStrictEqual([again.includes(inFlight), note.split('\n').includes(inFlight), fresh.includes(inFlight)], [true, true, true]);
    assert.doesNotMatch(note, /could not be read/);
    assert.ok(note.split('\n').includes(`- ${statePath(dir, layout.unit(UNIT, 'summary.md'))}`), 'the quick-fix\'s record re-read in full, as the spec is');
  });

  it('a round that passes with a nit to fix hands back to nothing while its fix task waits; its fix task done hands back to the close', () => {
    dir = world();
    const passed = nitRoundPassed();
    const done = nitTaskBuilt();

    assert.deepStrictEqual([passed.passed, passed.ends, passed.next], [true, true, undefined]);
    assert.deepStrictEqual(done.next, CLOSE);
  });

  it('its nit\'s fix task closed hands back to the close, as one done does', () => {
    dir = world();
    nitRoundPassed();
    run(['task', 'start', UNIT, '3.1']);

    assert.deepStrictEqual(run(['task', 'close', UNIT, '3.1', '--reason', 'The help names it once, as the docs do.']).next, CLOSE);
  });

  it('its nit\'s fix task\'s builder leaving a note, the task done hands back to nothing, and review notes, answering the note, to the close', () => {
    dir = world();
    nitRoundPassed();
    const note = run(['task', 'note', UNIT, '--file', writeState(dir, layout.cache('note.md'), 'The man page spells it --color too.')]).number;
    const done = nitTaskBuilt();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(`${UNIT}.review`, ask(`${UNIT}.review`, 'Is the man page this change\'s?'), 'Dropped: the man page is generated.');
    const answered = run(['review', 'notes', UNIT, '--file', payload('notes.json', {
      findings: [{ area: 'notes', scope: 'out', call: 'nit', text: 'The man page spells it --color.', from: [`notes#${note}`], drop: 'The man page is generated.', ledger: call }],
    })]);

    assert.deepStrictEqual([done.next, answered.next], [undefined, CLOSE]);
  });

  it('its phases and tasks are a quick-fix\'s: its fixes, then its review\'s fix phase, the marker naming its review\'s round and no position', () => {
    dir = world();
    firstRoundFailed();
    const progress = output(dir, ['render', 'build-progress', UNIT], as());

    assert.ok(progress.includes('**`□ Quick-fix review (the review\'s fixes, round 1)`**\n'), progress);
    assert.match(progress, /Phase 1 of 1 · the fixes +\[closed\]\n.*1\.1 Spell the flag --colour +\[done\]/);
    assert.match(progress, /Phase 2 · the review's fixes, round 1 +\[written\]\n.*2\.1 Name the flag in the docs +\[not started\]/);
  });

  it('a merge by hand of the fixes before the review\'s fix task lands leaves the close\'s yes merging its pull request, the fix task still to land', () => {
    dir = world();
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['merge', '-q', '--squash', BRANCH]);
    git(dir, ['commit', '-q', '-m', 'Spell it the British way']);
    git(dir, ['switch', '-q', BRANCH]);
    firstRoundFailed();
    fixTaskBuilt();
    secondRoundPassed();

    assert.strictEqual(closeMenu().split('\n').find((line) => line.startsWith('**`y/yes`**')), '**`y/yes`** → Close it — merge its pull request and mark it complete');
  });
});
