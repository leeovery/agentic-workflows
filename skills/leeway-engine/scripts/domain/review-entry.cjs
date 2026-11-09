'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the review phase's row of the entry (enter.cjs) — `enter
// review <unit>`, at the work unit, as the build's is (build-entry.cjs),
// taking a unit whose build runs by its cut — and its recovery note
// (position.cjs), which re-reads what the entry reads (24.2.2).
//
// It refuses what the build's entry refuses — a unit built under the old
// plan, a build not begun — a quick-fix whose review the person has not
// asked for at its close (19.5.14) — a quick-fix asked for having no cut
// to finish, its fixes ended at its close — and a build not finished: the
// review phase starts once every phase of the cut has closed
// (`buildFinished`, 14.6.1), and the refusal names each phase not closed;
// in step, once each has merged too, its stack merging at its gate first
// (7.2.4), and the refusal names the gate of the lowest still waiting
// (`mergeWaiting`, phase-checks.cjs). The review phase's verbs refuse as
// it does.
// Another session holding the checkout's code stops it at the build's code
// gate, nothing written, and `--take` enters all the same (12.7.8, 12.S50).
//
// As the conversation arrives, every task the tracker holds in progress in
// a phase the build has written — a fix task, the review's fix phases built
// in the same loop (14.3.2) — is put in flight on its position, at the
// review phase, as the build's entry takes them over (build-entry.cjs,
// `takeInFlight`); and at round 1, the working tree outside `.leeway/` is
// snapshotted for it (review-phase.cjs) where no snapshot is held — what
// `review round` holds the tree to (14.1.5); a later round's is taken as
// `review reads` opens it. Entering again never takes one, so dirt met
// before a `/clear` still stops for the person.
//
// It answers, in its DATA: the round under review, or how the round that
// ended the phase did, and what is next; the spec's areas, each by its name
// in the layout and its title — a quick-fix's one, the change, its record
// and its change-set from the base (19.5.14); the areas the round reads, the test surface
// among them, or that a later round's are not yet named, with those it must
// take (14.3.3); each report of the round under review already in, reading
// as a reviewer's, so a return to the round briefs only the readers whose
// reports are not; the fix phase a failing round's fixes are under way in —
// the last round's while its fix tasks wait, else, once the round under
// review has its reads, its own, where its fix tasks are written (P14);
// each task of the last round's fix phase not yet done, its findings'
// fixes and any written there beyond them, and in step its fix phase
// waiting at its merge's gate once they are (14.6.2); each builder's note
// standing, `notes#{k}`, answered by the round under review or, once the
// round that ended the phase has its fix tasks done, on its own, with the
// notes' file (14.3.5); what the review's put backs set aside, the folder
// and each copy, while it holds anything; for a bugfix, the series the
// build recorded on the unfixed code — its scenario, its command, how its
// runs did and the commits they ran at, and each run's file — and, while
// round 1 is under review, the test's run on the unfixed code again, which
// that round waits on, or how those since the review began did
// (bug-proven.cjs, 15.5.6); the branch the unit's work lands on, each
// reader's base (task-base.cjs); each of the conversation's fix
// tasks in flight, and each question waiting on the person, as the build's
// entry gives them (12.13.7); each round's report; the spec — a
// quick-fix's record, `summary.md`, in its place; the unit's
// record, by its call; and the build's log. Its recovery note re-reads the
// same, the fix tasks in flight those of the conversation the note is for.
// ---------------------------------------------------------------------------

const { ENGINE_COMMAND, ENGINE_RUN, messageOf } = require('../kernel/call.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const {
  buildFinished, phaseClosed, buildRefusal, quickFixReviewRefusal, quickFixBuild, cutPhases, cutLength,
} = require('./derivations.cjs');
const { reading, reposOf, mergeWaiting } = require('./phase-checks.cjs');
const {
  codeHeld, buildLogOf, buildStanding, ownInFlight, inFlightLines, waitingLines, takeInFlight, readingOf,
} = require('./build-entry.cjs');
const { projectLandsOn } = require('./task-base.cjs');
const { waitingAndFreed } = require('./questions.cjs');
const { specPath } = require('./spec-sections.cjs');
const { summaryFile } = require('./knowledge/artifacts.cjs');
const { notesPath } = require('./notes.cjs');
const {
  reviewStanding, reportsIn, endedWords, readsWords, mergingWords, roundReportFile, openSnapshot, fixPhase, setAsideHeld,
} = require('./review-phase.cjs');
const {
  UNFIXED_ITEM, isBugfix, bugRuns, runVerb, rerunPassed,
} = require('./bug-proven.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./review-phase.cjs').ReviewStanding} ReviewStanding */
/** @typedef {import('./conversation.cjs').InFlight} InFlight */
/** @typedef {import('./phase-checks.cjs').Reading} Reading */

/**
 * Why the unit's review phase cannot be entered, with its way on, or null
 * where it can: the build's refusals, a quick-fix's — one asked for
 * entered — then a build not finished, then in step a stack of the cut
 * waiting at its merge gate.
 * @param {Reading} at @returns {string|null}
 */
function reviewRefusal(at) {
  const { manifest } = at;
  const refused = buildRefusal(manifest) ?? quickFixReviewRefusal(manifest);
  if (refused !== null || quickFixBuild(manifest)) return refused;
  const { name } = manifest;
  if (buildFinished(manifest)) {
    const merging = mergeWaiting(at, cutLength(manifest));
    return merging === null ? null : `${name} builds in step, and its review phase is entered once every phase of its cut has merged — ${mergingWords(name, merging)}`;
  }
  const open = cutPhases(manifest).map((_, at) => at + 1).filter((phase) => !phaseClosed(manifest, phase));
  return `${name}'s review phase starts once every phase of its cut has closed — phase${open.length === 1 ? '' : 's'} ${open.join(', ')} of ${cutLength(manifest)} ${open.length === 1 ? 'has' : 'have'} not: enter implementation ${name}`;
}

/**
 * Where the unit's review phase stands, refused where it cannot be entered,
 * or where `held` — `openRefusal` or `roundRefusal` (review-phase.cjs) —
 * says why the step asked for cannot be taken yet.
 * @param {Reading} at
 * @param {(unit: string, standing: ReviewStanding) => string|null} held
 * @returns {ReviewStanding}
 */
function reviewHeld(at, held) {
  const refused = reviewRefusal(at);
  if (refused !== null) throw new Error(refused);
  const standing = reviewStanding(at);
  const not = held(at.unit, standing);
  if (not !== null) throw new Error(not);
  return standing;
}

/** What is next once a round ended the phase: its fix tasks, its builders' notes, or finish. @param {ReviewStanding} standing */
function endedNext({ over, waiting }) {
  if (over) return 'finish is next';
  return waiting.length > 0 ? 'its fix tasks are built, then finish' : 'the notes its fix tasks\' builders left are answered, then finish';
}

/** The round line: the round under review, or how the round that ended the phase did and what is next. @param {string} unit @param {ReviewStanding} standing */
function roundWords(unit, standing) {
  if (!standing.ended) return `round ${standing.round}`;
  return `${endedWords(unit, standing).replace(`${unit}'s`, 'the')} — ${endedNext(standing)}`;
}

/** What the review's put backs set aside, its folder and each copy from there, a line; none where they set aside nothing. @param {string} cwd @param {string} unit @returns {Line[]} */
function asideLines(cwd, unit) {
  const aside = setAsideHeld(cwd, unit);
  return aside === null ? [] : [['set aside', `${aside.folder} — ${aside.paths.join(', ')}, kept there until the person removes them`]];
}

/** Each builder's note standing, a line each, and the notes' file where any stands. @param {string} cwd @param {string} unit @param {ReviewStanding} standing @returns {Line[]} */
const notesLines = (cwd, unit, { notes }) => (notes.length === 0 ? [] : [
  ...notes.map((item) => /** @type {Line} */ (['builder note', item])),
  ['notes', statePath(cwd, notesPath(unit))],
]);

/** The reads line, while a round waits to be read — in step, on its fix phase's merge too. @param {string} unit @param {ReviewStanding} standing @param {boolean} step */
function readsLine(unit, { round, required, reads }, step) {
  if (reads !== null) return readsWords(reads);
  const once = `round ${round - 1}'s fix tasks are done${step ? ' and their phase has merged' : ''}`;
  return `not yet named — once ${once}, review reads ${unit} names them from what those changed, among them ${readsWords(required)}`;
}

/**
 * The fix phase a failing round's fixes are under way in (P14): the last
 * round's, while its fix tasks wait; else, while the round under review has
 * its reads, its own, where its fix tasks are written; none once the review
 * phase has ended.
 * @param {Record<string, any>} manifest @param {ReviewStanding} standing @returns {string|null}
 */
function fixPhaseWords(manifest, { rounds, round, ended, waiting, reads }) {
  if (waiting.length > 0) return `phase ${fixPhase(manifest, rounds.length)}, where round ${rounds.length}'s fix tasks are built`;
  if (ended || reads === null) return null;
  return `phase ${fixPhase(manifest, round)}, where round ${round}'s fix tasks are written`;
}

/** An area as its line says it: the spec's by its section, a quick-fix's change by what it reads. @param {string} unit @param {Record<string, any>} manifest @param {import('./review-phase.cjs').Area} area */
function areaWords(unit, manifest, { name, number, title }) {
  return quickFixBuild(manifest) ? `${name} — ${title.toLowerCase()}: ${unit}'s record and its change-set from the base` : `${name} — §${number} ${title}`;
}

/** Where the review phase stands, a line each: the round, the areas, the reads, the reports in, the fix phase, the fix tasks waiting and, in step, their phase's merge. @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {ReviewStanding} standing @returns {Line[]} */
function standingLines(cwd, unit, manifest, standing) {
  const fixes = fixPhaseWords(manifest, standing);
  return [
    ['round', roundWords(unit, standing)],
    ...standing.areas.map((area) => /** @type {Line} */ (['area', areaWords(unit, manifest, area)])),
    ...(standing.ended ? [] : [/** @type {Line} */ (['reads', readsLine(unit, standing, manifest.build?.position === 'step')])]),
    ...reportsIn(cwd, unit, standing).map((file) => /** @type {Line} */ (['report in', file])),
    ...(fixes === null ? [] : [/** @type {Line} */ (['fix phase', fixes])]),
    ...standing.waiting.map((fix) => /** @type {Line} */ (['fix task waiting', fix])),
    ...(standing.merging === null ? [] : [/** @type {Line} */ (['merge waiting', mergingWords(unit, standing.merging)])]),
    ...notesLines(cwd, unit, standing),
    ...asideLines(cwd, unit),
  ];
}

/**
 * The conversation `session`'s fix tasks in flight, a line each, as the
 * build's entry gives them, its standing read only where one is; and the
 * questions waiting on the person, read from the ledger alone.
 * @param {Reading} at @param {InFlight[]} inFlight @param {string|null} session @returns {Line[]}
 */
function buildLines(at, inFlight, session) {
  const inFlightPart = inFlight.length === 0 ? [] : inFlightLines(at.cwd, session, buildStanding(at.cwd, at.unit, inFlight));
  return [...inFlightPart, ...waitingLines(waitingAndFreed(at.cwd, at.unit, at.warnings))];
}

/** The commits a series ran at, as a line names them. @param {import('./runs.cjs').RepoCommit[]} commits */
const commitsWords = (commits) => commits.map(({ repo, commit }) => `${repo === '.' ? 'the project' : repo} at ${commit === null ? 'no commit' : commit.slice(0, 7)}`).join(', ');

/** The build's series on the unfixed code, a line, then each of its runs by its file. @param {string} cwd @param {import('./runs.cjs').Series|null} series @returns {Line[]} */
function seriesLines(cwd, series) {
  if (series === null) return [['unfixed series', 'none — the build recorded no run of the reproducing test on the unfixed code']];
  const { scenario, command, failures, runs, commits } = series;
  return [
    ['unfixed series', `${scenario}, \`${command}\` — ${failures} of its ${runs.length} runs failing on the unfixed code, ${commitsWords(commits)}`],
    ...runs.map(({ file }) => /** @type {Line} */ (['unfixed run', statePath(cwd, file)])),
  ];
}

/** Round 1's run of the test on the unfixed code again: the call it waits on, or how those since the review began did. @param {string} unit @param {ReturnType<typeof bugRuns>} runs */
function rerunWords(unit, { series, reruns }) {
  if (reruns.length === 0) return `not yet — round 1 is recorded once the test runs on the unfixed code again, where it must fail: \`${ENGINE_COMMAND} ${runVerb(unit, series)}\``;
  const ran = `${reruns.length} since the review began`;
  return rerunPassed(reruns) ? `${ran}, one passing — ${UNFIXED_ITEM}, a finding round 1 carries, so it fails` : `${ran}, every one failing`;
}

/** A bugfix's lines (the header's): the build's series, and while round 1 is under review its run again; none for any other unit. @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {ReviewStanding} standing @returns {Line[]} */
function bugLines(cwd, unit, manifest, standing) {
  if (!isBugfix(manifest)) return [];
  const runs = bugRuns(cwd, unit, manifest);
  const series = seriesLines(cwd, runs.series);
  return standing.ended || standing.round !== 1 ? series : [...series, ['rerun', rerunWords(unit, runs)]];
}

/** The branch the unit's work lands on, each reader's base. @param {Reading} at @returns {Line} */
const baseLine = (at) => ['base', `${projectLandsOn(at.cwd)} — the branch the unit's work lands on, the --base of each reader's brief`];

/** Each round's report recorded, by its path. @param {string} cwd @param {string} unit @param {ReviewStanding} standing */
const roundReports = (cwd, unit, { rounds }) => rounds.map((_, at) => statePath(cwd, roundReportFile(unit, at + 1)));

/** The record's call. @param {string} unit */
const recordCall = (unit) => `${ENGINE_COMMAND} ledger record ${unit}`;

/** What the review holds the change against: the spec, or a quick-fix's own record, `summary.md`, it having none (19.5.14). @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @returns {Line} */
const heldAgainst = (cwd, unit, manifest) => (quickFixBuild(manifest) ? ['summary', statePath(cwd, summaryFile(unit))] : ['spec', specPath(cwd, unit)]);

/**
 * What the review phase reads at its entry (the header's), its fix tasks
 * in flight the conversation `session`'s.
 * @param {Reading} at @param {InFlight[]} inFlight @param {string|null} session @returns {Line[]}
 */
function reviewReads(at, inFlight, session) {
  const { cwd, unit, manifest } = at;
  const standing = reviewStanding(at);
  return [
    ...standingLines(cwd, unit, manifest, standing),
    ...bugLines(cwd, unit, manifest, standing),
    baseLine(at),
    ...buildLines(at, inFlight, session),
    ...roundReports(cwd, unit, standing).map((report) => /** @type {Line} */ (['round report', report])),
    heldAgainst(cwd, unit, manifest),
    ['record', `\`${recordCall(unit)}\``],
    ['build log', statePath(cwd, buildLogOf(unit))],
    ['engine', `\`${ENGINE_RUN}\` — the engine by its absolute path, for a call made from a task's worktree`],
  ];
}

/** The entry's reads the recovery note re-reads as documents; the record it re-reads by its call. */
const DOCUMENTS = new Set(['round report', 'notes', 'spec', 'summary', 'build log']);

/**
 * What the review phase's recovery note re-reads beside its skill: what the
 * entry reads — the record by its call; each round's report, the builders'
 * notes where any stands, the spec or a quick-fix's record, and the build's log; where the phase
 * stands, a line each, its fix tasks in flight those of the conversation
 * the note is for, `session` — or why that cannot be read, in its place.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {InFlight[]} inFlight @param {string} session
 * @returns {{calls: string[], documents: string[], lines: string[]}}
 */
function reviewRecovery(cwd, unit, manifest, inFlight, session) {
  const calls = [recordCall(unit)];
  try {
    const read = reviewReads(reading(cwd, unit, manifest), inFlight, session);
    return {
      calls,
      documents: read.filter(([key]) => DOCUMENTS.has(key)).map(([, value]) => value),
      lines: read.filter(([key]) => key !== 'record' && !DOCUMENTS.has(key)).map(([key, value]) => `${key}: ${value}`),
    };
  } catch (err) {
    return { calls, documents: [heldAgainst(cwd, unit, manifest)[1], statePath(cwd, buildLogOf(unit))], lines: [`Where the review phase stands could not be read: ${messageOf(err)}`] };
  }
}

/** The tasks in progress taken over, and round 1's snapshot taken as it opens, where none is held (the header's). @param {Entering} at */
function arriving(at) {
  takeInFlight(at);
  const read = readingOf(at);
  if (reviewStanding(read).rounds.length === 0) openSnapshot(at.cwd, at.unit, 1, reposOf(read));
}

/** @type {Entry} */
const REVIEW = Object.freeze({
  level: /** @type {const} */ ('unit'),
  standing: (at) => reviewRefusal(readingOf(at)),
  held: codeHeld,
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: (at) => reviewReads(readingOf(at), ownInFlight(at.unit), handedSession()),
  closes: arriving,
});

module.exports = { REVIEW, reviewRefusal, reviewHeld, reviewRecovery };
