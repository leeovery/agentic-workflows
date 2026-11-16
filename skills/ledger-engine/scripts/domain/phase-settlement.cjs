'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the orchestrator's settlement of a phase review that failed
// (12.11.3, 13.10.1), as `task settle` settles a task's failed round
// (13.4.6). A phase review's fixes are tasks of the phase, each passed by
// its pair, with no phase review run again over them, so the orchestrator
// answers a failing review with a settlement: why, and the fix tasks it
// wrote for it, none where it judged the findings need none. The engine
// writes it alone, beside the review's reports, at
// `build/phases/phase-{N}/settlement.json`, and commits it with the reports
// it answers, so a second clone reads the review as this one does:
//
//   {"why": "…", "fixes": ["1.3"], "reports": {"review-a.md": "{print}", …}}
//
// A settlement answers the reports it was given, each by its file and the
// fingerprint of its text (round-report.cjs, `phaseReports`), so a report
// written since — one replaced, or a set added — leaves the review
// unsettled. It is judged by what the files hold, never by the order they
// were committed in, which a second clone's merge does not keep. Settling
// again, at any time, replaces it: a fix closed and another written in its
// place, or a fix found owed after a settlement naming none. What a
// settlement does to the phase's close is phase-checks.cjs's.
//
// `task settle <unit> --phase <N> --file <why> [--fixes <task>,…]` refuses,
// opening `task settle: ` and writing nothing: a unit the project lacks; a
// review not complete — none reported, a report of the count missing, or
// one that does not read; one every report passes; and each fix named that
// is no task of the phase, one the tracker lacks, or one it has closed —
// a fix known dead would leave the review open at once — every fault named;
// then no such file of the why, or one holding nothing. It runs under the
// writer lock (engine.cjs); a commit git refuses is a warning, the files
// written.
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { writeJsonAtomic, isObject, isStringList } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { parsePhase, parseShownTask, phaseName, shownTask } = require('./task-id.cjs');
const { trackedLists, givenText } = require('./task-verbs.cjs');
const { refusing } = require('./staged-payload.cjs');
const { READERS, readersDone } = require('./scratch.cjs');
const { phaseFolder, phaseReports } = require('./round-report.cjs');
const { refuserFor, committed } = require('./task-account.cjs');

/** @typedef {import('./round-report.cjs').PhaseReport} PhaseReport */
/** A phase review's settlement: why, its fix tasks by their ids, and the reports it answers, each by its file's name and its text's fingerprint. @typedef {{why: string, fixes: string[], reports: Record<string, string>}} Settlement */

/** A phase review's settlement, state-relative. @param {string} unit @param {number} phase */
function phaseSettlementPath(unit, phase) {
  return `${phaseFolder(unit, phase)}/settlement.json`;
}

/**
 * The phase review's settlement, null where there is none; refused where
 * it does not read as one.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {Settlement|null}
 */
function readSettlement(cwd, unit, phase) {
  const rel = phaseSettlementPath(unit, phase);
  const file = statePath(cwd, rel);
  if (!fs.existsSync(file)) return null;
  /** @type {any} */
  let held;
  try {
    held = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${rel} does not read as a settlement — ${messageOf(err)}`);
  }
  const fits = isObject(held) && typeof held.why === 'string' && isStringList(held.fixes) && isObject(held.reports) && isStringList(Object.values(held.reports));
  if (!fits) throw new Error(`${rel} does not read as a settlement — it holds {"why", "fixes", "reports"}`);
  return held;
}

/** Whether a settlement answers the reports as they stand: each given to it, with the same text. @param {Settlement} settlement @param {PhaseReport[]} reports */
function answers(settlement, reports) {
  return reports.every(({ file, print }) => settlement.reports[path.posix.basename(file)] === print);
}

/** The call that settles a phase's review, as a way on names it. @param {string} unit @param {number} phase */
const settleCall = (unit, phase) => `task settle ${unit} --phase ${phase} --file <why> [--fixes <task>,…]`;

/** A failed phase review no settlement answers, and the way on, as every surface says it. @param {string} unit @param {number} phase */
const unsettledWords = (unit, phase) => `phase ${phase}'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: ${settleCall(unit, phase)}`;

/**
 * Why a fix the settlement names cannot be one: no task's id, no task of
 * the phase, a task the tracker does not hold there, or one it has closed.
 * @param {string} unit @param {number} phase @param {string} fix @param {Map<string, string>} statuses the phase's tasks, shown, by status
 * @returns {string[]}
 */
function fixFaults(unit, phase, fix, statuses) {
  let ref;
  try {
    ref = parseShownTask(unit, fix);
  } catch (err) {
    return [messageOf(err)];
  }
  if (ref.phase !== phase) return [`--fixes names task ${fix}, which is no task of ${phaseName(unit, phase)}`];
  const status = statuses.get(shownTask(ref));
  if (status === undefined) return [`--fixes names task ${fix}, which the tracker does not hold in ${phaseName(unit, phase)}`];
  return status === 'closed' ? [`--fixes names task ${fix}, which the tracker has closed — a fix is a task still to be done`] : [];
}

/**
 * `task settle --phase`: the orchestrator's settlement of the phase's
 * failing review written, and committed (the header's).
 * @param {string} cwd @param {string} unit @param {string} given @param {string} file @param {string} [fixes] comma-joined
 */
function settlePhase(cwd, unit, given, file, fixes) {
  const said = 'task settle';
  const refuse = refuserFor(said);
  const phase = refusing(said, () => parsePhase(given));
  const { phases: [rows], warnings = [] } = refusing(said, () => withStateLock(stateRoot(cwd), () => trackedLists(cwd, unit, [phase])));
  const { faults, reports } = phaseReports(cwd, unit, phase);
  if (faults.length > 0) refuse(`${faults.join('; ')} — a phase review is settled once every reviewer of the count has reported it`);
  if (reports.every(({ verdict }) => verdict === 'pass')) refuse(`${phaseName(unit, phase)}'s review passed — only a failed review is settled`);
  const named = [...new Set((fixes ?? '').split(',').map((fix) => fix.trim()).filter((fix) => fix !== ''))];
  const statuses = new Map((rows ?? []).map(({ ref, status }) => [shownTask(ref), status]));
  const unfit = named.flatMap((fix) => fixFaults(unit, phase, fix, statuses));
  if (unfit.length > 0) refuse(unfit.join('; '));
  const why = refusing(said, () => givenText(cwd, file, 'settle by'));
  const rel = phaseSettlementPath(unit, phase);
  writeJsonAtomic(statePath(cwd, rel), {
    why, fixes: named, reports: Object.fromEntries(reports.map(({ file: report, print }) => [path.posix.basename(report), print])),
  });
  readersDone(cwd, READERS.phase(unit, phase));
  return committed(cwd, [rel, ...reports.map(({ file: report }) => report)], `task(${unit}): settle phase ${phase}'s review`, [...warnings], { phase, fixes: named });
}

module.exports = { readSettlement, answers, settleCall, unsettledWords, settlePhase };
