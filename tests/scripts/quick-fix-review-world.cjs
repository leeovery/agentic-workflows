'use strict';

// ---------------------------------------------------------------------------
// What the suites of a quick-fix's review share
// (test-engine-quick-fix-review.cjs, -review-rounds.cjs and
// test-engine-board-quick-fix-review.cjs): its one area (`AREA`), the
// finding round 1's first reader of the change makes, which fix task 2.1
// fixes (`FOUND`), and where the review hands back once it is over, its
// close (`CLOSE`); the world, `twoFixesBuilt` (quick-fix-world.cjs) with
// the fixes recorded — the close reached — built once and copied
// (`closeReached`); the review's steps as a conversation takes them
// (`reviewSteps`); and the calls a suite's tests make in a conversation of
// their own, whose records they keep in a config folder of its own, through
// the review's rounds (`quickFixReview`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { ok, okSections, output, refusedPristine, sectionOf, writeState, createFile, layout, fixtureFrom } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, twoFixesBuilt, fixesRecorded, fixDone, fixFile, asGone } = require('./quick-fix-world.cjs');
const { reportText } = require('./review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

/** The quick-fix's one area, by its name in the layout. */
const AREA = '1-the-change';

/** The finding round 1's first reader of the change makes, and the fix task 2.1 that fixes it. */
const FOUND = Object.freeze({ area: AREA, scope: 'in', call: 'bug', text: 'The docs still say --color.', from: [`${AREA}-a#1`], fix: '2.1' });

/** Where a quick-fix's review hands back once it is over: its close. */
const CLOSE = Object.freeze({ kind: 'engine', argv: ['render', 'finish', UNIT] });

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
 * built, its change committed through the door, pushed to the quick-fix's
 * pull request and passed by its pair; round 2 entered, its reads named,
 * every report passing, and recorded; and round 2 passing with a nit
 * instead, its fix task 3.1 written, then built and done.
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

  /** Its answer. */
  function fixTaskDone() {
    createFile(dir(), 'docs/flag.md', '--colour\n');
    run(['commit', '--paths', 'docs/flag.md', '--task', UNIT, '2.1', '-m', `fix(${UNIT}): name the flag in the docs`]);
    run(['land', 'open', UNIT, '2.1']);
    return fixDone(dir(), '2.1', as());
  }

  function fixTaskBuilt() {
    fixTaskStarted();
    return fixTaskDone();
  }

  function secondRoundPassed() {
    entered();
    run(['review', 'reads', UNIT, AREA, 'tests']);
    reported(2, [AREA, 'tests']);
    return run(['review', 'round', UNIT, '--file', payload('round-2.json', { can_now: ['Pass --colour, and read it in the docs.'], findings: [] })]);
  }

  /** Round 1's fix task built, round 2 passing with a nit, its fix task 3.1 written: the round's answer. */
  function nitRoundPassed() {
    firstRoundFailed();
    fixTaskBuilt();
    entered();
    run(['review', 'reads', UNIT, AREA, 'tests']);
    reported(2, [AREA, 'tests'], { [`${AREA}-a`]: ['nit: The help could name the flag twice.'] });
    run(['task', 'phase', UNIT, '3', '--title', 'The review\'s fixes, round 2']);
    run(['task', 'create', UNIT, '3', '--file', writeState(dir(), layout.cache('review-nit.md'), fixFile(1, 'Name the flag twice').replace('- 1.S1 ', '- '))]);
    const nit = { area: AREA, scope: 'in', call: 'nit', text: 'The help could name the flag twice.', from: [`${AREA}-a#1`], fix: '3.1' };
    return run(['review', 'round', UNIT, '--file', payload('round-2.json', { can_now: ['Pass --colour.'], findings: [nit] })]);
  }

  /** The nit's fix task 3.1 built as a fix is, and done: its answer. */
  function nitTaskBuilt() {
    run(['task', 'start', UNIT, '3.1']);
    createFile(dir(), 'src/help.js', 'const help = \'--colour, --colour\';\n');
    run(['commit', '--paths', 'src/help.js', '--task', UNIT, '3.1', '-m', `fix(${UNIT}): name the flag twice`]);
    run(['land', 'open', UNIT, '3.1']);
    return fixDone(dir(), '3.1', as());
  }

  return {
    payload, entered, reported, firstRoundRecorded, firstRoundFailed, fixTaskStarted, fixTaskDone, fixTaskBuilt, secondRoundPassed, nitRoundPassed, nitTaskBuilt,
  };
}

/**
 * The calls a suite's tests make in their conversation, in the project
 * `at` names, and the review's steps taken there (`reviewSteps`).
 * @param {() => string} at
 */
function quickFixReview(at) {
  const config = useTempFolder('quick-fix-review-config-');

  /** This test's conversation, as a call's options. */
  const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

  /** A call that must succeed, in this test's conversation. @param {string[]} args */
  const run = (args) => ok(at(), args, as());

  /** A call's refusal, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(at(), args, as()).error;

  /** A brief issued in this conversation: its answer and its text. @param {string[]} args */
  function issued(args) {
    const res = run(['brief', ...args]);
    return { res, brief: fs.readFileSync(path.join(config(), 'conversations', 'sess-1', 'briefs', path.basename(briefPath('sess-1', res.id))), 'utf8') };
  }

  /** The close's gate as drawn. */
  const closeMenu = () => sectionOf(output(at(), ['render', 'finish', UNIT], as()), 'MENU: finish');

  return { as, run, refused, issued, closeMenu, ...reviewSteps(at, as) };
}

module.exports = { AREA, FOUND, CLOSE, closeReached, reviewSteps, quickFixReview };
