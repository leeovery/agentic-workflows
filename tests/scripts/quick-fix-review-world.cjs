'use strict';

// ---------------------------------------------------------------------------
// What the suites of a quick-fix's review share
// (test-engine-quick-fix-review.cjs, test-engine-board-quick-fix-review.cjs):
// its one area (`AREA`) and the finding round 1's first reader of the change
// makes, which fix task 2.1 fixes (`FOUND`); the world, `twoFixesBuilt`
// (quick-fix-world.cjs) with the fixes recorded and finish's checklist
// closed — the close reached — built once and copied (`closeReached`); and
// the review's steps as a conversation takes them (`reviewSteps`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { ok, okSections, sectionOf, writeState, createFile, layout, fixtureFrom } = require('./engine-harness.cjs');
const { UNIT, twoFixesBuilt, fixesRecorded, fixDone, fixFile, asGone } = require('./quick-fix-world.cjs');
const { reportText } = require('./review-world.cjs');

/** The quick-fix's one area, by its name in the layout. */
const AREA = '1-the-change';

/** The finding round 1's first reader of the change makes, and the fix task 2.1 that fixes it. */
const FOUND = Object.freeze({ area: AREA, scope: 'in', call: 'bug', text: 'The docs still say --color.', from: [`${AREA}-a#1`], fix: '2.1' });

const closeReached = fixtureFrom('quick-fix-review-', (dir) => {
  twoFixesBuilt(dir);
  asGone((as) => fixesRecorded(dir, 2, as));
});

/**
 * The review's steps as the conversation `as` gives takes them, in the
 * project `dir` names: a payload file beside the project; the review phase
 * entered, its DATA lines; a round's reports; round 1 recorded failing on
 * the docs, its fix task 2.1 written in the review's first fix phase —
 * asked for and entered first (`firstRoundFailed`), or once entered
 * (`firstRoundRecorded`); fix task 2.1 started, then done as a fix is
 * built, its change committed through the door and pushed to the
 * quick-fix's pull request; and round 2 entered, its reads named, every
 * report passing, and recorded.
 * @param {() => string} dir @param {() => Record<string, any>} as
 */
function reviewSteps(dir, as) {
  /** @param {string[]} args */
  const run = (args) => ok(dir(), args, as());

  /** @param {string} name @param {unknown} content */
  function payload(name, content) {
    const file = path.join(path.dirname(dir()), name);
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
  }

  const entered = () => sectionOf(okSections(dir(), ['enter', 'review', UNIT], as()).sections, 'DATA').split('\n').filter(Boolean);

  /** Every report a round's reads ask for written, each passing but those `found` gives findings. @param {number} round @param {string[]} reads @param {Record<string, string[]>} [found] */
  function reported(round, reads, found = {}) {
    for (const name of reads.flatMap((read) => (read === 'tests' ? ['tests-a'] : [`${read}-a`, `${read}-b`]))) {
      writeState(dir(), layout.unit(UNIT, 'review', `round-${round}`, `${name}.md`), reportText(found[name] ?? []));
    }
  }

  function firstRoundRecorded() {
    reported(1, [AREA, 'tests'], { [`${AREA}-a`]: [`bug: ${FOUND.text}`] });
    run(['task', 'phase', UNIT, '2', '--title', 'The review\'s fixes, round 1']);
    run(['task', 'create', UNIT, '2', '--file', writeState(dir(), layout.cache('review-fix.md'), fixFile(1, 'Name the flag in the docs').replace('- 1.S1 ', '- '))]);
    run(['review', 'round', UNIT, '--file', payload('round-1.json', { can_now: ['Pass --colour.'], findings: [FOUND] })]);
  }

  function firstRoundFailed() {
    run(['review', 'ask', UNIT]);
    entered();
    firstRoundRecorded();
  }

  const fixTaskStarted = () => run(['task', 'start', UNIT, '2.1']);

  function fixTaskDone() {
    createFile(dir(), 'docs/flag.md', '--colour\n');
    run(['commit', '--paths', 'docs/flag.md', '--task', UNIT, '2.1', '-m', `fix(${UNIT}): name the flag in the docs`]);
    run(['land', 'open', UNIT, '2.1']);
    fixDone(dir(), '2.1', as());
  }

  function fixTaskBuilt() {
    fixTaskStarted();
    fixTaskDone();
  }

  function secondRoundPassed() {
    entered();
    run(['review', 'reads', UNIT, AREA, 'tests']);
    reported(2, [AREA, 'tests']);
    return run(['review', 'round', UNIT, '--file', payload('round-2.json', { can_now: ['Pass --colour, and read it in the docs.'], findings: [] })]);
  }

  return { payload, entered, reported, firstRoundRecorded, firstRoundFailed, fixTaskStarted, fixTaskDone, fixTaskBuilt, secondRoundPassed };
}

module.exports = { AREA, FOUND, closeReached, reviewSteps };
