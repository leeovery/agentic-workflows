'use strict';

// ---------------------------------------------------------------------------
// The quick-fix's merge by hand mid-set, shared by the landing conformance
// suites that run it (test-engine-landing-conformance-quick-fix-by-hand*.cjs,
// -left-off.cjs): fix 1.2 started and committed through the door, fixes 1.1
// and 1.2 recorded and the close made, and the day itself — the quick-fix's
// pull request merged by hand by one of a driver's side's ways while 1.2 is
// in flight (`mergedMidSet`), its names `MID_SET`'s, each suite running it
// under them. Names no driver and no tool.
// ---------------------------------------------------------------------------

const assert = require('node:assert');

const { ok, refuses, git, createFile } = require('./engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, createFix, checklistClosed } = require('./quick-fix-world.cjs');

const HELP = SET[1];

/** What the days read a driver by: `quickFixConformance`'s answer. @typedef {ReturnType<typeof import('./quick-fix-world.cjs').quickFixConformance>} Conformance */

/**
 * The steps of a day run on a driver: fix 1.2 started; its change committed
 * through the door, its text given; and fixes 1.1 and 1.2 recorded and the
 * close made, its answer.
 * @param {Conformance} conf
 */
function steps({ as, record }) {
  return {
    /** @param {string} at */
    started: (at) => {
      createFix(at, 2, HELP.title, as());
      ok(at, ['task', 'start', UNIT, '1.2'], as());
    },
    /** @param {string} at @param {string} text */
    committed: (at, text) => {
      createFile(at, HELP.file, text);
      ok(at, ['commit', '--paths', HELP.file, '--task', UNIT, '1.2', '-m', `fix(${UNIT}): ${HELP.title.toLowerCase()}`], as());
    },
    /** @param {string} at */
    closed: (at) => {
      record(at, 1);
      record(at, 2);
      checklistClosed(at, as());
      return ok(at, ['finish', 'yes', UNIT], as());
    },
  };
}

/** The day's names: on the driver `name`, merged by the side's way `how`, and its test's. */
const MID_SET = {
  /** @param {string} name @param {string} how */
  title: (name, how) => `the ${name} landing driver's quick-fix, its pull request merged by hand mid-set by ${how} (R12, R14)`,
  test: 'reads the fix it landed as done and landed; a fix in flight across it, committed after, opens a pull request of its own holding its commit alone past the branch it lands on as the host has it — the branch cut again from there, its commit replayed, where the merge left the fix landed past it — and lands alone at the close',
};

/**
 * The day on a driver, its pull request merged by hand mid-set by `merge`:
 * the fix it landed read as done and landed; a fix in flight across it,
 * committed after, opening a pull request of its own holding its commit
 * alone past the branch it lands on as the host has it — the branch cut
 * again from there, its commit replayed, where the merge left the fix landed
 * past it — and landing alone at the close.
 * @param {Conformance} conf @param {(dir: string, branch: string) => void} merge
 */
function mergedMidSet(conf, merge) {
  const { side, as, project, built, landed } = conf;
  const { started, committed, closed } = steps(conf);
  const at = project();
  built(at, 1);
  const first =git(at, ['rev-parse', BRANCH]).trim();
  started(at);
  merge(at, BRANCH);
  committed(at, HELP.text);
  const left = git(at, ['rev-parse', '--short', BRANCH]).trim();
  const opening = refuses(at, ['land', 'open', UNIT, '1.1'], as()).error;
  const opened = ok(at, ['land', 'open', UNIT, '1.2'], as());
  const host = side.defaultTip(at);
  const reached = git(at, ['merge-base', first, host]).trim() === first;
  const past = git(at, ['log', '--format=%(trailers:key=Leeway-Task,valueonly)', `${host}..${BRANCH}`]).split('\n').filter(Boolean);
  ok(at, ['task', 'done', UNIT, '1.2'], as());
  const close = closed(at);

  assert.strictEqual(opening, `land: task 1.1 of ${UNIT} has landed, and is done — nothing of it is left to open`);
  const cut = opened.cut_again?.map((/** @type {any} */ { repo, from, replayed }) => ({ repo, from, replayed }));
  assert.deepStrictEqual([past, cut], [[`${UNIT}-1-2`], reached ? undefined : [{ repo: '.', from: left, replayed: ['1.2'] }]]);
  assert.deepStrictEqual([close.landed.map((/** @type {any} */ { merged }) => merged), landed(at).at(-1)], [[['1.2']], [`fix(${UNIT}): ${DESCRIPTION}`, [HELP.file]]]);
}

module.exports = { HELP, MID_SET, steps, mergedMidSet };
