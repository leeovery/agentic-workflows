'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the measures read over each project named, the calling one
// where none is — computed alone, never kept, and never drawn on a gate the
// person reads (17.2.2):
// - `measures findings [--project <path>]…`, review findings per phase
//   (17.1.5, 17.2.4), this repo's authors' (17.2.1): where each gap was
//   found, so the authors see where the build cuts corners;
// - `measures bugs [--project <path>]…`, bugs found after review (17.1.6),
//   the product's: answered beside the findings per phase over the same
//   projects, in one call, since findings falling while bugs after review
//   rise reads as the reviews weakening (17.3.1).
//
// Each phase of the pipeline, in its order, counts the gaps its reviews
// found:
// - discussion's reviews and closing pass, and the spec's review: every
//   question a review asked on the ledger (5.3.9), by the phase it is
//   tagged with (5.2.3). The spec's review routes its findings other ways
//   too — a fact found wrong replaced, a gap that changes a decision raised
//   as its replacement — but a replacement is the person's or Claude's on
//   the ledger, never marked the review's, so neither is counted; a
//   rewrite is a matter of writing, no gap, and never reaches the ledger;
// - the task writer: every question Claude asked in the build on no task —
//   a gap the writer met comes back in its status before any task holds
//   it, and reaches the ledger as Claude's question, where a builder's
//   names its task (P3). A review's question there is the phase review's,
//   counted with the build's pairs, and the person's is theirs; the
//   consolidation agent's and the orchestrator's own questions on no task
//   are Claude's too, which nothing on the ledger tells apart, so they
//   count here;
// - the build's pairs: every reviewer's report of a task's round and of a
//   phase review (round-report.cjs), its findings by call, its rounds — a
//   task's round, or a phase's review whole, however many areas it was
//   split into — and those that failed, any report of it failing;
// - the review phase: every round recorded (review-phase.cjs), its findings
//   by call, its rounds and those that failed.
// A report that does not read is passed over and named, so the counts say
// what they stand on.
//
// A bug found after review is a bugfix unit whose investigation's conclude
// recorded the unit whose code it fixes and found that unit's review phase
// ended then, a round of its passed or settled (14.6.3) — judged at the
// conclude, the one moment that knows it, never when the count is read
// (bug-records.cjs, investigation-conclude.cjs). The bugs are counted by
// area, each project's own, an area known folded for case and spacing by
// its first spelling, then by the unit fixed. Left out: a bug in code no
// unit built, since no review ran on it; and one concluded before its
// unit's review ended, since no review had ended on it, whatever that
// review did later. A cancelled bugfix counts,
// one moved to another type does not, and a reopened investigation's record
// stands until it concludes again (bug-records.cjs).
//
// How a review's findings split across its lanes (17.1.3, P11), the
// product's measure the matrix shows (17.2.1, projections/matrix.cjs): each
// question a review asked on the project's ledger, still live, by what
// settled it — apply, merged into what the record already held, a decision
// or a finding (5.5.5); route, moved to another topic, or to the roadmap as
// later; walked, answered by the person, their "your call" and "don't care"
// among it, since each was asked them; decide, settled by Claude's own call.
// A move routes it however it is answered after, as a merge applies it;
// one still open is in no lane yet. An answer is read by its first entry,
// how the finding was settled at the review — a later replacement is an
// overrule, counted where the trust log counts it — as it stands decided
// through the person's latest keep on it, a call of Claude's they kept
// walked (ledger-fold.cjs, `decidedNow`); and one carried over by the
// migration by who made it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { listWorkUnitManifests } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { foldLedger, ID_FACTS, factsOf, isLive, questionStands, decidedNow } = require('./ledger-fold.cjs');
const { decidedBy } = require('./ledger-events.cjs');
const { readReport } = require('./round-report.cjs');
const { recordedRounds } = require('./review-phase.cjs');
const { byName, areaKey, bugRecords, areaSpellings } = require('./bug-records.cjs');
const { refusing } = require('./staged-payload.cjs');

/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** A review's lane (16.2.2). @typedef {'apply'|'decide'|'walked'|'route'} Lane */
/** @typedef {'serious'|'bug'|'nit'} Call */
/** What a phase's reviews found: how many findings, and, where its reviews run in rounds, the findings by call, the rounds and those failed. @typedef {{phase: string, findings: number, calls?: Record<Call, number>, rounds?: number, failed?: number}} PhaseFindings */
/** A round as the count reads it: its findings' calls, and whether it failed. @typedef {{calls: string[], failed: boolean}} CountedRound */
/** The bugs found after review in one area of a project: how many, and by the unit fixed. @typedef {{project: string, area: string|null, count: number, fixed: Array<{unit: string, bugfixes: string[]}>}} AreaBugs */

const MEASURES = Object.freeze(['findings', 'bugs']);
const MEASURES_USAGE = `measures ${MEASURES.join('|')} [--project <path>]…`;

/** A phase's place among the ledger's questions: whether a question is one of its findings. @type {ReadonlyArray<[string, (facts: IdFacts) => boolean]>} */
const LEDGER_PHASES = Object.freeze([
  ['discussion', (facts) => facts.by === 'review' && facts.phase === 'discussion'],
  ['specification', (facts) => facts.by === 'review' && facts.phase === 'specification'],
  ['task-writer', (facts) => facts.by === 'claude' && facts.phase === 'implementation' && facts.task === null],
]);

/** The files of a folder whose names `pattern` takes, in name order; none where it is not there. @param {string} folder @param {RegExp} pattern */
function filesIn(folder, pattern) {
  return fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => pattern.test(name)).sort() : [];
}

/** The folders a folder holds, in name order. @param {string} folder */
const foldersIn = (folder) => filesIn(folder, /./).filter((name) => fs.statSync(path.join(folder, name)).isDirectory());

/**
 * Reviewers' reports grouped into rounds: each group's reports read, a
 * report that does not read named in `unread` and passed over.
 * @param {string[][]} groups absolute paths @param {string[]} unread
 * @returns {CountedRound[]}
 */
function readRounds(groups, unread) {
  return groups.flatMap((files) => {
    const read = files.flatMap((file) => {
      try {
        return [readReport(fs.readFileSync(file, 'utf8'))];
      } catch (err) {
        unread.push(`${file} — ${messageOf(err)}`);
        return [];
      }
    });
    return read.length === 0 ? [] : [{ calls: read.flatMap(({ findings }) => findings.map(({ call }) => call)), failed: read.some(({ verdict }) => verdict === 'fail') }];
  });
}

/** Files grouped by what `key` takes of each name. @param {string} folder @param {string[]} names @param {(name: string) => string} key */
function groupedBy(folder, names, key) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const name of names) groups.set(key(name), [...(groups.get(key(name)) ?? []), path.join(folder, name)]);
  return [...groups.values()];
}

/** A unit's task rounds, and its phases' reviews each whole, each a group of reports. @param {string} root @param {string} unit @returns {string[][]} */
function buildGroups(root, unit) {
  const tasks = path.join(root, unit, 'build', 'tasks');
  const phases = path.join(root, unit, 'build', 'phases');
  return [
    ...foldersIn(tasks).flatMap((task) => groupedBy(path.join(tasks, task), filesIn(path.join(tasks, task), /^round-\d+-[a-z]\.md$/), (name) => name.replace(/-[a-z]\.md$/, ''))),
    ...foldersIn(phases).map((phase) => filesIn(path.join(phases, phase), /^.+-[a-z]\.md$/).map((name) => path.join(phases, phase, name))),
  ];
}

/** A unit's review rounds as the count reads them, a record that does not read named in `unread`. @param {string} cwd @param {string} unit @param {string[]} unread @returns {CountedRound[]} */
function reviewRounds(cwd, unit, unread) {
  try {
    return recordedRounds(cwd, unit).map(({ findings, passed }) => ({ calls: findings.map(({ call }) => call), failed: !passed }));
  } catch (err) {
    unread.push(messageOf(err));
    return [];
  }
}

/** Rounds counted: their findings, by call, the rounds and those failed. @param {string} phase @param {CountedRound[]} rounds @returns {PhaseFindings} */
function countRounds(phase, rounds) {
  const calls = rounds.flatMap((round) => round.calls);
  /** @type {Record<Call, number>} */
  const byCall = { serious: 0, bug: 0, nit: 0 };
  for (const call of calls) byCall[/** @type {Call} */ (call)] += 1;
  return { phase, findings: calls.length, calls: byCall, rounds: rounds.length, failed: rounds.filter(({ failed }) => failed).length };
}

/**
 * A project's bugs found after review, by area — no area named last — then
 * by the unit fixed.
 * @param {string} project @param {Array<Record<string, any>>} manifests
 * @returns {AreaBugs[]}
 */
function bugsByArea(project, manifests) {
  const records = bugRecords(manifests);
  const spelt = areaSpellings(records);
  const found = records.flatMap(({ bugfix, fixes, after_review: after, area }) => (
    fixes !== null && after ? [{ bugfix, fixes, area: area === null ? null : String(spelt.get(areaKey(area))) }] : []));
  const named = [...new Set(found.flatMap(({ area }) => (area === null ? [] : [area])))].sort(byName);
  const areas = found.some(({ area }) => area === null) ? [...named, null] : named;
  return areas.map((area) => {
    const inArea = found.filter((bug) => bug.area === area);
    const units = [...new Set(inArea.map(({ fixes }) => fixes))].sort(byName);
    return {
      project, area, count: inArea.length, fixed: units.map((unit) => ({ unit, bugfixes: inArea.filter(({ fixes }) => fixes === unit).map(({ bugfix }) => bugfix).sort(byName) })),
    };
  });
}

/**
 * What one project's reviews found, phase by phase, and the bugs found
 * after them.
 * @param {string} cwd the project @param {string[]} unread @param {string[]} warnings
 * @returns {{questions: IdFacts[], build: CountedRound[], review: CountedRound[], bugs: AreaBugs[]}}
 */
function projectFindings(cwd, unread, warnings) {
  const root = stateRoot(cwd);
  const manifests = listWorkUnitManifests(root);
  const units = manifests.map(({ name }) => /** @type {string} */ (name));
  return {
    questions: [.../** @type {Map<string, IdFacts>} */ (foldLedger(root, ID_FACTS, warnings)).values()].filter((facts) => facts.event === 'asked'),
    build: units.flatMap((unit) => readRounds(buildGroups(root, unit), unread)),
    review: units.flatMap((unit) => reviewRounds(cwd, unit, unread)),
    bugs: bugsByArea(cwd, manifests),
  };
}

/**
 * `measures findings`: review findings per phase over the projects named,
 * the calling one where none is; `measures bugs` the bugs found after
 * review beside them.
 * @param {string} cwd @param {string} measure @param {string[]} projects absolute or from cwd
 */
function measured(cwd, measure, projects) {
  const named = (projects.length === 0 ? [cwd] : projects).map((project) => path.resolve(cwd, project));
  /** @type {string[]} */
  const unread = [];
  /** @type {string[]} */
  const warnings = [];
  const found = named.map((project) => projectFindings(project, unread, warnings));
  const questions = found.flatMap((each) => each.questions);
  /** @type {PhaseFindings[]} */
  const phases = [
    ...LEDGER_PHASES.map(([phase, holds]) => ({ phase, findings: questions.filter(holds).length })),
    countRounds('build', found.flatMap((each) => each.build)),
    countRounds('review', found.flatMap((each) => each.review)),
  ];
  return {
    projects: named,
    ...(measure === 'bugs' ? { bugs: found.flatMap((each) => each.bugs) } : {}),
    phases,
    ...(unread.length > 0 ? { unread } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// The lanes, in the order the matrix lists them.
const LANES = Object.freeze(/** @type {Lane[]} */ (['apply', 'decide', 'walked', 'route']));
// Who decided an answer the person was asked, as `decidedBy` names them.
const ASKED = new Set(['person', 'your-call', 'dont-care']);

/**
 * The lane a review's finding went to (the header's), by its question's
 * first entry, as it stands decided through the person's latest keep
 * (`decidedNow`); null while it is open.
 * @param {Folded} folded @param {string} question
 * @returns {Lane|null}
 */
function laneOf(folded, question) {
  const stands = questionStands(folded, question);
  if (stands === 'merged') return 'apply';
  if (factsOf(folded, question).moves.some((move) => isLive(folded, move))) return 'route';
  if (stands !== 'answered') return null;
  const answer = decidedNow(folded, /** @type {string} */ (factsOf(folded, factsOf(folded, question).root).answered_by.find((id) => isLive(folded, id))));
  const by = decidedBy(answer);
  return ASKED.has(by) || (by === 'carried' && answer.by === 'person') ? 'walked' : 'decide';
}

/**
 * How the review findings on the folded ledger split across the lanes (the
 * header's): each lane's count.
 * @param {Folded} folded
 * @returns {Record<Lane, number>}
 */
function findingsSplit(folded) {
  const split = /** @type {Record<Lane, number>} */ (Object.fromEntries(LANES.map((lane) => [lane, 0])));
  for (const [id, facts] of folded.facts) {
    if (facts.event !== 'asked' || facts.by !== 'review' || !isLive(folded, id)) continue;
    const lane = laneOf(folded, id);
    if (lane !== null) split[lane] += 1;
  }
  return split;
}

/**
 * `measures findings|bugs [--project <path>]…`: the verb's answer, its
 * refusal opening on its command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts @param {Record<string, string[]>} lists
 * @returns {Record<string, unknown>}
 */
function runMeasuresVerb(cwd, positional, opts, lists) {
  const [measure] = positional;
  if (positional.length !== 1 || !MEASURES.includes(measure) || Object.keys(opts).length > 0 || Object.keys(lists).some((flag) => flag !== 'project')) throw new Error(`Usage: engine ${MEASURES_USAGE}`);
  return refusing(`measures ${measure}`, () => measured(cwd, measure, lists.project ?? []));
}

module.exports = { MEASURES_USAGE, LANES, runMeasuresVerb, findingsSplit };
