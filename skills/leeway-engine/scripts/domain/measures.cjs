'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the measures this repo's authors read (17.2.1) — `measures
// findings [--project <path>]…`, review findings per phase (17.1.5,
// 17.2.4), over each project named, the calling one where none is: where
// each gap was found, so the authors see where the build cuts corners.
// Read alone, never kept, and never drawn on a gate the person reads
// (17.2.2).
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
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { listWorkUnitManifests } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { foldLedger, ID_FACTS } = require('./ledger-fold.cjs');
const { readReport } = require('./round-report.cjs');
const { recordedRounds } = require('./review-phase.cjs');
const { refusing } = require('./staged-payload.cjs');

/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {'serious'|'bug'|'nit'} Call */
/** What a phase's reviews found: how many findings, and, where its reviews run in rounds, the findings by call, the rounds and those failed. @typedef {{phase: string, findings: number, calls?: Record<Call, number>, rounds?: number, failed?: number}} PhaseFindings */
/** A round as the count reads it: its findings' calls, and whether it failed. @typedef {{calls: string[], failed: boolean}} CountedRound */

const MEASURES_USAGE = 'measures findings [--project <path>]…';

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
 * What one project's reviews found, phase by phase.
 * @param {string} cwd the project @param {string[]} unread @param {string[]} warnings
 * @returns {{questions: IdFacts[], build: CountedRound[], review: CountedRound[]}}
 */
function projectFindings(cwd, unread, warnings) {
  const root = stateRoot(cwd);
  const units = listWorkUnitManifests(root).map(({ name }) => /** @type {string} */ (name));
  return {
    questions: [.../** @type {Map<string, IdFacts>} */ (foldLedger(root, ID_FACTS, warnings)).values()].filter((facts) => facts.event === 'asked'),
    build: units.flatMap((unit) => readRounds(buildGroups(root, unit), unread)),
    review: units.flatMap((unit) => reviewRounds(cwd, unit, unread)),
  };
}

/**
 * `measures findings`: review findings per phase over the projects named,
 * the calling one where none is.
 * @param {string} cwd @param {string[]} projects absolute or from cwd
 */
function reviewFindings(cwd, projects) {
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
  return { projects: named, phases, ...(unread.length > 0 ? { unread } : {}), ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * `measures findings [--project <path>]…`: the verb's answer, its refusal
 * opening on its command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts @param {Record<string, string[]>} lists
 * @returns {Record<string, unknown>}
 */
function runMeasuresVerb(cwd, positional, opts, lists) {
  if (positional.join() !== 'findings' || Object.keys(opts).length > 0 || Object.keys(lists).some((flag) => flag !== 'project')) throw new Error(`Usage: engine ${MEASURES_USAGE}`);
  return refusing('measures findings', () => reviewFindings(cwd, lists.project ?? []));
}

module.exports = { MEASURES_USAGE, runMeasuresVerb };
