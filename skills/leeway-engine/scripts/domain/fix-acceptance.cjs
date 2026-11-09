'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's fixes' acceptance in their own words — what a
// review asked for at its close holds the change against, where a build's
// review holds it against its spec (19.5.14, 19.5.24, 14.2.4): the area
// pair's and the test surface's briefs (brief-records.cjs), and the
// scenarios a round records and its report words (review-round.cjs,
// review-change.cjs), and the checks the board words from the fixes as it
// read them (`acceptanceOf`, board-review.cjs). The fixes are its phase 1's tasks the tracker holds
// not closed, a fix closed landing nothing; each criterion of a fix's
// acceptance scenarios stands as its task file words it (task-file.cjs),
// its scenario the id it opens with, `{n}.S{k}`, where it opens with one.
// The review's own fix tasks are no fix of the quick-fix's: their phases,
// past phase 1, are the review's.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { FIXES_PHASE } = require('./derivations.cjs');
const { trackedPhase } = require('./task-verbs.cjs');
const { criteriaTexts, criterionWords, criterionScenario } = require('./task-file.cjs');
const { shownTask } = require('./task-id.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */

/**
 * A fix's criterion: the scenario it opens with, null where it opens with
 * none, and its words, that id taken off.
 * @typedef {{scenario: string|null, words: string}} Criterion
 */
/** A fix and its acceptance, each criterion in its own words. @typedef {{fix: TaskDetail, criteria: Criterion[]}} FixAcceptance */

/** A criterion as its fix's acceptance words it. @param {string} text @returns {Criterion} */
const criterionOf = (text) => ({ scenario: criterionScenario(text), words: criterionWords(text) });

/** Each of `fixes` not closed, in order, with its acceptance. @param {TaskDetail[]} fixes @returns {FixAcceptance[]} */
const acceptanceOf = (fixes) => fixes.filter(({ status }) => status !== 'closed').map((fix) => ({ fix, criteria: criteriaTexts(fix.text).map(criterionOf) }));

/**
 * Each of the quick-fix's fixes not closed, in order, with its acceptance,
 * read from the tracker under the state's lock.
 * @param {string} cwd @param {string} unit @returns {FixAcceptance[]}
 */
const fixAcceptance = (cwd, unit) => acceptanceOf(withStateLock(stateRoot(cwd), () => trackedPhase(cwd, unit, FIXES_PHASE.number).tasks ?? []));

/** A fix as a line names it: its id and title. @param {TaskDetail} fix */
const fixNamed = (fix) => `fix ${shownTask(fix.ref)} ${fix.title}`;

/**
 * Each scenario the fixes' acceptance names, in order, with its wording and
 * the fix it is of.
 * @param {FixAcceptance[]} acceptance @returns {{scenario: string, wording: string, fix: TaskDetail}[]}
 */
function fixScenarios(acceptance) {
  return acceptance.flatMap(({ fix, criteria }) => criteria.flatMap(({ scenario, words }) => (scenario === null ? [] : [{ scenario, wording: words, fix }])));
}

module.exports = { fixAcceptance, acceptanceOf, fixScenarios, fixNamed };
