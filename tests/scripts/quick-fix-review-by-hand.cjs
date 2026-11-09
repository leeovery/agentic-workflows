'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's review asked for after its pull request was merged by hand,
// shared by the landing conformance suites that run it
// (test-engine-landing-conformance-quick-fix-review-by-hand*.cjs): fixes 1.1
// and 1.2 built and recorded, the pull request merged by hand by one of a
// driver's side's ways, the review asked for at the close and entered —
// its change read by the landing's read by content (7.2.22), every fix
// landed, nothing refused (`mergedRead`); for the way a suite takes whole,
// then round 1 failing with fix task 2.1 (`firstRoundFailed`), built on the
// branch as the landing cuts it again, and round 2's brief reading the
// landing beside the fix task's work alone; a case on each shipped driver
// for each of the ways a suite picks from its side (`reviewedEachWay`);
// and the change a test-surface brief reads, landed and not
// (`changeRead`). Names no driver and no tool.
// ---------------------------------------------------------------------------

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, createFile, writeState, layout } = require('./engine-harness.cjs');
const { UNIT, BRANCH, SET, fixFile, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { reportText } = require('./review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

/** The quick-fix's one area, by its name in the layout. */
const AREA = '1-the-change';
/** The file fix task 2.1 changes. */
const DOCS = 'docs/flag.md';
/** The fixes' files, every one landed by the merge by hand. */
const FIXES = [SET[0].file, SET[1].file].sort();

/** What the day reads a driver by: `quickFixConformance`'s answer. @typedef {ReturnType<typeof import('./quick-fix-world.cjs').quickFixConformance>} Conformance */
/** A merge by hand, by its name on a driver's side. @typedef {[string, (dir: string, branch: string, into?: string) => void]} Way */

/**
 * What the change's commits section of a test-surface brief holds: each
 * part's heading, landed or not, and the paths its stat names.
 * @param {string} brief
 * @returns {{landed: string[], notLanded: string[]}}
 */
function partsOf(brief) {
  const section = brief.split('\n## In the project\'s repository\n')[1].split('\n## ')[0];
  const parts = section.split('\n### ').slice(1).map((part) => ({ landed: part.startsWith('Landed:'), paths: [...part.matchAll(/^ (\S+)\s+\|/gm)].map(([, file]) => file) }));
  return {
    landed: [...new Set(parts.filter((part) => part.landed).flatMap((part) => part.paths))].sort(),
    notLanded: parts.filter((part) => !part.landed).flatMap((part) => part.paths),
  };
}

/**
 * The change a test-surface brief issued now in the suite's conversation
 * reads (`partsOf`).
 * @param {Conformance} conf @param {string} at
 */
function changeRead({ as }, at) {
  const { id } = ok(at, ['brief', 'test-surface', UNIT, '--base', 'main'], as());
  return partsOf(fs.readFileSync(path.join(as().env.LEEWAY_CONFIG_DIR ?? '', 'conversations', 'sess-1', 'briefs', path.basename(briefPath('sess-1', id))), 'utf8'));
}

/** A payload file beside the project, outside its working tree. @param {string} at @param {string} name @param {unknown} content */
function payload(at, name, content) {
  const file = path.join(path.dirname(at), `${path.basename(at)}-${name}`);
  fs.writeFileSync(file, JSON.stringify(content));
  return file;
}

/** Every report of a round written, the change's first reader finding `found`. @param {string} at @param {number} round @param {string[]} found */
function reported(at, round, found) {
  for (const name of [`${AREA}-a`, `${AREA}-b`, 'tests-a']) writeState(at, layout.unit(UNIT, 'review', `round-${round}`, `${name}.md`), reportText(name === `${AREA}-a` ? found : []));
}

/**
 * The review entered, round 1 recorded failing on the
 * docs, its fix task 2.1 written in the review's first fix phase.
 * @param {Conformance} conf @param {string} at
 */
function firstRoundFailed({ as }, at) {
  const run = (/** @type {string[]} */ args) => ok(at, args, as());
  reported(at, 1, ['bug: The docs still say --color.']);
  run(['task', 'phase', UNIT, '2', '--title', 'The review\'s fixes, round 1']);
  run(['task', 'create', UNIT, '2', '--file', writeState(at, layout.cache('review-fix.md'), fixFile(1, 'Name the flag in the docs').replace('- 1.S1 ', '- '))]);
  run(['review', 'round', UNIT, '--file', payload(at, 'round-1.json', { can_now: ['Pass --colour.'], findings: [{ area: AREA, scope: 'in', call: 'bug', text: 'The docs still say --color.', from: [`${AREA}-a#1`], fix: '2.1' }] })]);
}

/**
 * Fixes 1.1 and 1.2 built and recorded, the pull request merged by hand by
 * `merge`, and the review asked for and entered: the project, and the
 * change its first brief reads.
 * @param {Conformance} conf @param {(dir: string, branch: string, into?: string) => void} merge
 */
function mergedRead(conf, merge) {
  const { as, record, built } = conf;
  const at = conf.project();
  built(at, 1);
  built(at, 2);
  record(at, 1);
  record(at, 2);
  merge(at, BRANCH, 'main');
  checklistClosed(at, as());
  ok(at, ['review', 'ask', UNIT], as());
  okSections(at, ['enter', 'review', UNIT], as());
  return { at, merged: changeRead(conf, at) };
}

/**
 * The day whole on the project `at` its first read left: round 1 failing,
 * fix task 2.1 built through the door, and round 2's brief: the change it
 * reads.
 * @param {Conformance} conf @param {string} at
 */
function fixTaskRead(conf, at) {
  const run = (/** @type {string[]} */ args) => ok(at, args, conf.as());
  firstRoundFailed(conf, at);
  run(['task', 'start', UNIT, '2.1']);
  createFile(at, DOCS, '--colour\n');
  run(['commit', '--paths', DOCS, '--task', UNIT, '2.1', '-m', `fix(${UNIT}): name the flag in the docs`]);
  run(['land', 'open', UNIT, '2.1']);
  run(['task', 'done', UNIT, '2.1']);
  okSections(at, ['enter', 'review', UNIT], conf.as());
  run(['review', 'reads', UNIT, AREA, 'tests']);
  return changeRead(conf, at);
}

/** The names of a case: on the driver `name`, merged by the side's way `how`, and its test's, the day whole or its first read. */
const AFTER_MERGE = {
  /** @param {string} name @param {string} how */
  title: (name, how) => `the ${name} landing driver's quick-fix, its pull request merged by hand by ${how} before its review is asked for (7.2.22, 19.5.14)`,
  read: 'the review reads the change through the landing\'s read by content — every fix landed, nothing not landed, never refused',
  whole: 'the review reads the change through the landing\'s read by content — every fix landed, nothing not landed, never refused — and its fix task, built on the branch as the landing cuts it again, is read as the one change not landed beside the landings',
};

/**
 * The cases: on each shipped landing driver, one for each of the ways
 * `pick` takes from its side, its worlds named from `prefix` — each its
 * suite's name and its test's, and the day to run: its first read, or,
 * `whole`, the day through round 2.
 * @param {string} prefix @param {(side: Conformance['side']) => Way[]} pick @param {boolean} whole
 * @returns {{suite: string, test: string, run: () => void}[]}
 */
function reviewedEachWay(prefix, pick, whole) {
  return listDrivers('landing').flatMap(({ name }) => {
    const conf = quickFixConformance(name, `${prefix}${name}-`);
    return pick(conf.side).map(([how, merge]) => ({
      suite: AFTER_MERGE.title(name, how),
      test: whole ? AFTER_MERGE.whole : AFTER_MERGE.read,
      run: () => {
        const { at, merged } = mergedRead(conf, merge);
        assert.deepStrictEqual(merged, { landed: FIXES, notLanded: [] });
        if (whole) assert.deepStrictEqual(fixTaskRead(conf, at), { landed: FIXES, notLanded: [DOCS] });
      },
    }));
  });
}

module.exports = { reviewedEachWay, changeRead, firstRoundFailed };
