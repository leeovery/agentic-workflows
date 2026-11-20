'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the engine checks of a build phase as it starts and
// closes (6.4.8, 6.4.9) — the engine's items of the phase checklists
// (checklist.cjs), worked out at each call and never kept (6.4.3); the
// refusal of `land phase` before the phase review passed (landing.cjs);
// what the build's standing reads of a phase (build-entry.cjs); and, in
// step, the lowest phase whose stack waits at its merge gate, which the
// build's and the review phase's entries put before what comes after it
// (review-entry.cjs, review-phase.cjs). A phase is one the unit's cut holds:
// the review phase's fix phases, numbered past it, have no checklists (P14).
//
// - Its tasks written: each of the phase's scenarios — a phase of the cut
//   names one at least — an acceptance scenario of exactly one task of it
//   not closed in the tracker (12.4.3); `task link` keeps each link where
//   it may run (12.6.4). A phase whose parent the migration adopted, its
//   tasks the old plan's, has its tasks written (21.8.8, `phaseAdopted`).
//   Open, it names its way on: each scenario held by no task, or by
//   several, naming them.
// - What it relies on done: an earlier phase closed and its stack merged,
//   since in step a phase closes with its stack waiting at its gate
//   (7.2.5); another unit completed (12.6.2). A phase relying on nothing
//   unfinished starts whenever Claude schedules it (12.7.5).
// - Its tasks passed: each task not closed passed by its pair — its last
//   round passed by every reviewer of the count, or settled (13.4.6,
//   round-report.cjs); rounds that do not read fail it, said as a warning.
// - Its phase review passed and its fixes landed: a report from every
//   reviewer of the count, of each set where the review was split by area
//   (13.1.4), every one read (round-report.cjs), passing; or, where one
//   failed, the orchestrator's settlement answering those reports, every
//   fix task it names done (13.10.1, phase-settlement.cjs) — one closed
//   naming the settlement given again as its way on. Wherever the review
//   is complete, has failed and the item reads open, its faults are the
//   fixes the phase owes, which the build's standing says.
// - Each scenario proven or reported not proven: proven by its runs at the
//   phase's tips (phase-stack.cjs, runs.cjs), else named in every report of
//   the phase review by a finding in its standing's words (15.4.3). A phase
//   with nothing built since the migration cut its unit has no stack: its
//   tips are the tip of the branch each repository lands on (landing.cjs,
//   `landingTips`). Tips that cannot be read prove nothing, said as a
//   warning.
// - Its notes consolidated: as notes.cjs reads the consolidation's record.
// - Its stack merged: every task not closed landed (task-landed.cjs), one at
//   least — or, in step, its merge waiting at its gate, every task not
//   closed in its stack, one at least: landed, or chained into it (7.2.4);
//   a task whose landing cannot be read so is not, said as a warning.
// - Phase 1's close also needs the verify setup recorded (12.3.3): a
//   refusal of the close, not an item, so the checklist lists 6.4.9's items
//   alone (6.S14).
//
// A task that landed before the migration cut the unit (`landedBefore`,
// derivations.cjs) was built and landed before Ledger: it counts as passed
// and landed, and only the tasks built since make the phase's stack. A
// phase with nothing built since — each task of it landed before or closed
// — passes its review with nothing to read (`nothingSince`).
//
// A call reads each thing once for all its checks (`Reading`): a phase's
// tasks, under the state's lock as every reader of the tracker takes it,
// since a read may commit the tracker's setting up; and what landed.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos, repoName } = require('../kernel/repos.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { manifestOf, finishedUnits } = require('./ledger-units.cjs');
const {
  phaseClosed, phaseBuilt, phaseAdopted, cutPhases, cutLength, landedBefore, hasLanded, builtSince, nothingBuiltSince,
} = require('./derivations.cjs');
const { trackedLists, trackedPhase } = require('./task-verbs.cjs');
const { holdsScenario, namesScenario } = require('./task-file.cjs');
const { taskPassed, phaseReports, reviewedNone } = require('./round-report.cjs');
const { readSettlement, answers, settleCall, unsettledWords } = require('./phase-settlement.cjs');
const { phaseStack, tipCommits } = require('./phase-stack.cjs');
const { runsOf } = require('./runs.cjs');
const { consolidationFaults } = require('./notes.cjs');
const { verifySetup } = require('./environment.cjs');
const { allChained, landingTips } = require('./landing.cjs');
const { unitLanded } = require('./task-landed.cjs');
const { dayBefore } = require('./dates.cjs');
const { phaseName, shownTask } = require('./task-id.cjs');
const { inWords } = require('./cut.cjs');

/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./round-report.cjs').PhaseReport} PhaseReport */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */

/**
 * What a call's checks read the unit by: the unit and its manifest, the
 * warnings its reads give, the call's own read of the project's
 * repositories where it keeps one for every unit it reads (`repos`), and
 * what it has read already, by what it is, kept for its other checks.
 * @typedef {{cwd: string, unit: string, manifest: Record<string, any>, warnings: string[], repos?: () => Repo[], reads: Map<string, any>}} Reading
 */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/** A phase review's reports read: what stands in the way of reading them all, and those read. @typedef {{faults: string[], reports: PhaseReport[]}} Reviewed */

/** @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {string[]} [warnings] @param {() => Repo[]} [repos] the call's read of the project's repositories @returns {Reading} */
const reading = (cwd, unit, manifest, warnings = [], repos) => ({ cwd, unit, manifest, warnings, repos, reads: new Map() });

/**
 * A reading whose tracker's answers are given, not read: each phase's tasks
 * whole, in order, null for one not written — a world shipped as files,
 * which no tracker holds.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {(TaskDetail[]|null)[]} phases
 * @returns {Reading}
 */
function trackerGiven(cwd, unit, manifest, phases) {
  const at = reading(cwd, unit, manifest);
  phases.forEach((tasks, i) => {
    at.reads.set(`list ${i + 1}`, tasks);
    at.reads.set(`tasks ${i + 1}`, tasks);
  });
  return at;
}

/**
 * What `read` answers, read once a call.
 * @template T @param {Reading} at @param {string} key @param {() => T} read @returns {T}
 */
function once(at, key, read) {
  if (!at.reads.has(key)) at.reads.set(key, read());
  return at.reads.get(key);
}

/** The project's repos, read once a call. @param {Reading} at @returns {Repo[]} */
const reposOf = (at) => once(at, 'repos', () => at.repos?.() ?? projectRepos(codeRoot(at.cwd)));

/**
 * `read` under the state's lock, as every reader of the tracker takes it,
 * the read's warnings joining the call's.
 * @template {{warnings?: string[]}} T @param {Reading} at @param {() => T} read @returns {T}
 */
function tracked(at, read) {
  const answer = withStateLock(stateRoot(at.cwd), read);
  at.warnings.push(...(answer.warnings ?? []));
  return answer;
}

/**
 * The lists of the phases named, in turn, null for one not written: those
 * not read yet in one read of the tracker.
 * @param {Reading} at @param {number[]} phases @returns {(TaskRow[]|null)[]}
 */
function phaseLists(at, phases) {
  const unread = phases.filter((phase) => !at.reads.has(`list ${phase}`));
  if (unread.length > 0) {
    const { phases: lists } = tracked(at, () => trackedLists(at.cwd, at.unit, unread));
    unread.forEach((phase, i) => at.reads.set(`list ${phase}`, lists[i]));
  }
  return phases.map((phase) => at.reads.get(`list ${phase}`));
}

/** A phase's tasks whole, null where it is not written. @param {Reading} at @param {number} phase @returns {TaskDetail[]|null} */
function phaseTasks(at, phase) {
  return once(at, `tasks ${phase}`, () => tracked(at, () => trackedPhase(at.cwd, at.unit, phase)).tasks);
}

/** Of a phase's tasks, those not closed: the phase's work. @template {TaskRow} T @param {T[]|null} tasks @returns {T[]} */
const live = (tasks) => (tasks ?? []).filter(({ status }) => status !== 'closed');

/** Whether the task landed before the migration cut the unit (`landedBefore`). @param {Reading} at @param {TaskRow} task */
const before = (at, { ref }) => once(at, 'landed before', () => landedBefore(at.manifest))(ref);

/** The phase's tasks not closed, by their rows. @param {Reading} at @param {number} phase */
const liveRows = (at, phase) => live(at.reads.get(`tasks ${phase}`) ?? phaseLists(at, [phase])[0]);

/** What has landed of the unit's tasks (task-landed.cjs), read once a call. @param {Reading} at @returns {import('./task-landed.cjs').UnitLanded} */
const landedOf = (at) => once(at, 'landed', () => unitLanded(at.cwd, at.unit, reposOf(at), dayBefore(at.manifest.created)));

/** Whether each of the unit's tasks has landed (`hasLanded`), read once a call. @param {Reading} at */
const landedTask = (at) => once(at, 'has landed', () => hasLanded(at.manifest, landedOf(at).landed));

/** Whether the phase's stack has merged: every task not closed landed, one at least — a phase built before the migration on the default branch already. @param {Reading} at @param {number} phase */
function phaseLanded(at, phase) {
  if (phaseBuilt(at.manifest, phase)) return true;
  const rows = liveRows(at, phase);
  const landed = landedTask(at);
  return rows.length > 0 && rows.every(({ ref }) => landed(ref));
}

/**
 * In step, the lowest phase up to `last` whose stack waits to merge — one
 * of the cut once closed, its stack then at its gate, or one of the
 * review's fixes, with a task not closed not landed — the one whose merge
 * may land first, each stack built on those below it (7.2.4, 7.2.6); null
 * in auto, and where none waits.
 * @param {Reading} at @param {number} last @returns {number|null}
 */
function mergeWaiting(at, last) {
  if (at.manifest.build?.position !== 'step') return null;
  const cut = cutLength(at.manifest);
  const phases = Array.from({ length: last }, (_, i) => i + 1);
  phaseLists(at, phases);
  const unmerged = (/** @type {number} */ phase) => liveRows(at, phase).length > 0 && !phaseLanded(at, phase);
  return phases.find((phase) => (phase > cut || phaseClosed(at.manifest, phase)) && unmerged(phase)) ?? null;
}

/** Each phase scenario not held by exactly one task not closed (12.4.3), with the tasks that hold it. @param {Reading} at @param {number} phase */
function misheld(at, phase) {
  const tasks = live(phaseTasks(at, phase));
  return cutPhases(at.manifest)[phase - 1].scenarios
    .map((scenario) => ({ scenario, holders: tasks.filter(({ text }) => holdsScenario(text, scenario)) }))
    .filter(({ holders }) => holders.length !== 1);
}

/** The phase's tasks written: each phase scenario held by exactly one task not closed (12.4.3), or the phase's parent adopted by the migration. @param {Reading} at @param {number} phase */
const tasksWritten = (at, phase) => phaseAdopted(at.manifest, phase) || misheld(at, phase).length === 0;

/** What stands between the phase and its tasks written: each scenario held by no task, or by several, with the way on. @param {Reading} at @param {number} phase */
function tasksWrittenWay(at, phase) {
  return misheld(at, phase).map(({ scenario, holders }) => (holders.length === 0
    ? `${scenario} is held by no task — write the one that holds it, task create ${at.unit} ${phase} --file <path>`
    : `${scenario} is held by tasks ${inWords(holders.map(({ ref }) => shownTask(ref)))} — close all but one of them, task close ${at.unit} <task> --reason <reason>`)).join('; ');
}

/** What the phase relies on done: an earlier phase closed and its stack merged, another unit completed (6.4.8). @param {Reading} at @param {number} phase */
function reliedOnDone(at, phase) {
  const finished = finishedUnits(stateRoot(at.cwd));
  return cutPhases(at.manifest)[phase - 1].relies_on.every((relied) => (typeof relied === 'number' ? phaseClosed(at.manifest, relied) && phaseLanded(at, relied) : finished(relied)));
}

/**
 * Whether a task's reviewers passed it — a one-line task once it is done,
 * which it was only once built (task-account.cjs), its own work on the
 * default branch after the phase merges; not where its
 * rounds do not read, said as a warning.
 * @param {Reading} at @param {{ref: import('./task-id.cjs').TaskRef, status: string}} row
 */
function passed(at, { ref, status }) {
  if (status === 'done' && reviewedNone(at.cwd, ref) !== null) return true;
  try {
    return taskPassed(at.cwd, ref);
  } catch (err) {
    at.warnings.push(messageOf(err));
    return false;
  }
}

/** Every task of the phase not closed, one at least, passed by its pair (13.4.6), or landed before the migration. @param {Reading} at @param {number} phase */
function tasksPassed(at, phase) {
  const rows = liveRows(at, phase);
  return rows.length > 0 && rows.every((row) => before(at, row) || passed(at, row));
}

/** Whether the phase has nothing built since the migration cut the unit (derivations.cjs, `nothingBuiltSince`). @param {Reading} at @param {number} phase */
const nothingSince = (at, phase) => nothingBuiltSince(at.manifest, liveRows(at, phase));

/** The phase review's reports, read once a call (round-report.cjs). @param {Reading} at @param {number} phase @returns {Reviewed} */
const reviewed = (at, phase) => once(at, `review ${phase}`, () => phaseReports(at.cwd, at.unit, phase));

/** Whether every report of a phase review passes. @param {PhaseReport[]} reports */
const allPass = (reports) => reports.every(({ verdict }) => verdict === 'pass');

/**
 * The phase review's settlement where it answers the reports as they stand,
 * read once a call; null where none does, and where it does not read, said
 * as a fault.
 * @param {Reading} at @param {number} phase @param {PhaseReport[]} reports @param {string[]} faults
 * @returns {import('./phase-settlement.cjs').Settlement|null}
 */
function answering(at, phase, reports, faults) {
  const settled = once(at, `settlement ${phase}`, () => {
    try {
      return readSettlement(at.cwd, at.unit, phase);
    } catch (err) {
      return messageOf(err);
    }
  });
  if (typeof settled === 'string') faults.push(settled);
  return settled !== null && typeof settled !== 'string' && answers(settled, reports) ? settled : null;
}

/**
 * What stands in the way of a fix the settlement names: nothing once it is
 * done; once closed, the settlement given again, naming the fixes that
 * stand.
 * @param {Reading} at @param {number} phase @param {string} fix @param {string|undefined} status
 * @returns {string[]}
 */
function fixFaults(at, phase, fix, status) {
  if (status === 'done') return [];
  const fault = `phase ${phase}'s review failed, and task ${fix}, a fix of it, is ${status}`;
  return [status === 'closed' ? `${fault} — settle it again, naming the fixes that stand: ${settleCall(at.unit, phase)}` : fault];
}

/**
 * What stands between the phase and its review passed with its fixes
 * landed (12.11.3, 13.10.1), none where nothing does: a report missing or
 * not reading; where one failed, no settlement answering it, or a fix it
 * names not done — each saying the way on.
 * @param {Reading} at @param {number} phase @returns {string[]}
 */
function phaseReviewFaults(at, phase) {
  if (nothingSince(at, phase)) return [];
  const { faults, reports } = reviewed(at, phase);
  if (faults.length > 0 || allPass(reports)) return faults;
  /** @type {string[]} */
  const unread = [];
  const settled = answering(at, phase, reports, unread);
  if (settled === null) {
    return [...unread, unsettledWords(at.unit, phase)];
  }
  const statuses = new Map(phaseLists(at, [phase])[0]?.map(({ ref, status }) => [shownTask(ref), status]) ?? []);
  return settled.fixes.flatMap((fix) => fixFaults(at, phase, fix, statuses.get(fix)));
}

/**
 * The fixes the phase's review owes, as `phase-review-passed` reads them —
 * its own faults, each saying the way on, wherever every report of the
 * count is in and read, one failed, and the item reads open: no settlement
 * answering it, or a fix it names not done, closed among them. None where
 * the review is not complete, or passed.
 * @param {Reading} at @param {number} phase @returns {string[]}
 */
function fixesOwed(at, phase) {
  const { faults, reports } = reviewed(at, phase);
  return faults.length > 0 || allPass(reports) ? [] : phaseReviewFaults(at, phase);
}

/** Each repository at the tip of the branch it lands on, named as a run names its commits. @param {Reading} at @returns {RepoCommit[]} */
function landingTipsOf(at) {
  const repos = reposOf(at);
  const tips = landingTips(at.cwd, at.unit, repos, repos);
  return repos.map((repo) => ({ repo: repoName(repo), commit: tips.get(repo.dir) ?? null }));
}

/**
 * The phase's tips, read once a call: its stack's, or, for a phase with
 * nothing built since the migration cut its unit, which no stack holds, its
 * landing branch's (`landingTipsOf`); null where they cannot be read, said
 * as a warning.
 * @param {Reading} at @param {number} phase @returns {RepoCommit[]|null}
 */
function phaseTips(at, phase) {
  return once(at, `tips ${phase}`, () => {
    try {
      return nothingSince(at, phase) ? landingTipsOf(at) : tipCommits(phaseStack(at.cwd, at.unit, phase, builtSince(at.manifest, phaseTasks(at, phase) ?? [])));
    } catch (err) {
      at.warnings.push(`${phaseName(at.unit, phase)}'s scenarios are judged at its tips, which cannot be read — ${messageOf(err)}`);
      return null;
    }
  });
}

/**
 * Each of the phase's scenarios neither proven at its tips nor named in
 * every report of its review by a finding in its standing's words (15.4.3),
 * with its standing; null where the tips cannot be read. Read once a call.
 * @param {Reading} at @param {number} phase @returns {{scenario: string, standing: string}[]|null}
 */
function unreported(at, phase) {
  return once(at, `unreported ${phase}`, () => {
    const tips = phaseTips(at, phase);
    if (tips === null) return null;
    const { faults, reports } = reviewed(at, phase);
    return cutPhases(at.manifest)[phase - 1].scenarios.flatMap((scenario) => {
      const { standing } = runsOf(at.cwd, at.unit, scenario, tips);
      if (standing === 'proven') return [];
      const says = (/** @type {string} */ text) => namesScenario(text, scenario) && text.toLowerCase().includes(standing);
      return faults.length === 0 && reports.every(({ findings }) => findings.some(({ text }) => says(text))) ? [] : [{ scenario, standing }];
    });
  });
}

/** Each of the phase's scenarios proven at its tips, or reported (`unreported`). @param {Reading} at @param {number} phase */
const scenariosReported = (at, phase) => unreported(at, phase)?.length === 0;

/** What stands between the phase and each scenario proven or reported, with the way on. @param {Reading} at @param {number} phase */
function scenariosWay(at, phase) {
  const left = unreported(at, phase);
  if (left === null) return `${phaseName(at.unit, phase)}'s tips cannot be read, as the warning says`;
  return left.map(({ scenario, standing }) => `${scenario} is ${standing} at the phase's tips — run it from a worktree at them, verify run ${at.unit} ${scenario}, or the phase review's reports each name it ${standing}`).join('; ');
}

/** The phase's notes consolidated, as notes.cjs reads the record (12.10). @param {Reading} at @param {number} phase */
const notesConsolidated = (at, phase) => consolidationFaults(at.cwd, at.unit, phase).length === 0;

/**
 * Whether every task of the phase built since the migration, one at least,
 * is in its stack: landed (`landedTask`), else chained into it (landing.cjs);
 * not where one cannot be read so, said as a warning.
 * @param {Reading} at @param {number} phase
 */
function chained(at, phase) {
  const tasks = builtSince(at.manifest, live(phaseTasks(at, phase)));
  const landed = landedTask(at);
  try {
    return tasks.length > 0 && allChained(at.cwd, at.unit, tasks.filter(({ ref }) => !landed(ref)));
  } catch (err) {
    at.warnings.push(messageOf(err));
    return false;
  }
}

/**
 * The phase's stack merged, or in step, where its merge waits at its gate,
 * holding every task of the phase (7.2.4).
 * @param {Reading} at @param {number} phase
 */
const stackMerged = (at, phase) => phaseLanded(at, phase) || (at.manifest.build?.position === 'step' && chained(at, phase));

/**
 * Why the phase's close is refused beyond its items, or null: phase 1's
 * before the verify setup is recorded (12.3.3), a setup that does not read
 * said as a warning.
 * @param {Reading} at @param {number} phase @returns {string|null}
 */
function closeRefusal(at, phase) {
  if (phase !== 1) return null;
  try {
    if (verifySetup(at.cwd) !== null) return null;
  } catch (err) {
    at.warnings.push(messageOf(err));
  }
  return `${phaseName(at.unit, phase)} closes once the verify setup is recorded — the first phase gets the product running and drivable: verify setup ${at.unit} --file <setup.json> --scenario <scenario>`;
}

/**
 * Why `land phase` refuses the phase, or null: for a phase the unit's cut
 * holds, its review not passed or its fixes not done (7.2.4, 12.11.3).
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string|null}
 */
function phaseReviewRefusal(cwd, unit, phase) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest === null ? null : reviewRefusalOf(reading(cwd, unit, manifest), phase);
}

/** Whether every task of the phase has landed, as the close reads it (`phaseLanded`): never for a unit the project lacks. @param {string} cwd @param {string} unit @param {number} phase */
function landedPhase(cwd, unit, phase) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  return manifest !== null && phaseLanded(reading(cwd, unit, manifest), phase);
}

/** `phaseReviewRefusal`, as a call reads the unit. @param {Reading} at @param {number} phase @returns {string|null} */
function reviewRefusalOf(at, phase) {
  if (phase > cutLength(at.manifest)) return null;
  const faults = phaseReviewFaults(at, phase);
  return faults.length === 0 ? null : `${phaseName(at.unit, phase)} merges once its phase review has passed and its fixes are done — ${faults.join('; ')}`;
}

module.exports = {
  reading, trackerGiven, once, reposOf, landedOf, phaseLists, phaseTasks, phaseLanded, mergeWaiting, fixesOwed, passed,
  tasksWritten, tasksWrittenWay, reliedOnDone, tasksPassed, phaseReviewFaults, scenariosReported, scenariosWay, notesConsolidated, stackMerged, closeRefusal, phaseReviewRefusal, reviewRefusalOf, landedPhase,
};
