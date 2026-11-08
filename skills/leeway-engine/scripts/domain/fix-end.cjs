'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how a quick-fix's tasks open and end — `land open`, `task
// done` and `task close` of any task of its build, its fixes and the fix
// tasks of a review asked for at its close (landing.cjs, task-verbs.cjs) —
// and when it lands, so its close meets only two shapes of task: one done,
// holding work of its own, in its one pull request or landed, and, for a
// fix, recorded; and one closed, holding none (finish.cjs).
//
// A task's landing is read against the branch the quick-fix lands on as the
// host has it, whether or not the quick-fix's branch is left
// (`quickFixLanding`, landing.cjs), as a person's merge of its pull request
// by hand, by any method, leaves it: landed where its newest commit of its
// own is on that branch, in a pull request merged, or its change there,
// merging it changing nothing — named there, where the repository holds no
// commit of its own — and in the pull request where the one open holds that
// commit. Its own work is a commit of its own through the door
// (commit-task.cjs), on the quick-fix's branch or wherever the repository
// keeps it, or its change landed.
//
// - Open is refused for a task closed, which lands nothing — refused first,
//   as `land open` is the one verb that puts a task in the pull request —
//   and for one landed, naming its done, or saying it is done.
// - Done takes a task holding work of its own, landed or in the pull
//   request open — its newest commit committed and in it — refused where it
//   holds none, met already or with nothing to change, naming its close as
//   met; where its commit is not on the branch, as a branch cut again
//   leaves one that did not apply there, naming its change made again
//   there through the door (`remade`, fix-branch.cjs); and where its newest
//   commit is not in the pull request, naming `land open`, which pushes it
//   (`undoneRefusal`, done's one rule).
// - Close takes a task holding no work of its own, met already or given up
//   before its commit; one holding any, landed or not, is refused, naming
//   the reversal: its change lands as it is, given up as a landed change
//   is, by a fix of its own whose commit through the door reverts it. A
//   fix closed that was recorded — by a move's close (`closeForMove`,
//   task-verbs.cjs), which refuses none — has its record taken out of
//   `summary.md` and the fixes recorded, written for the close's own
//   commit (quick-fix-record.cjs, `takeOutRecord`), and the knowledge base
//   brought in line once it is made.
// - `land phase` and `land finish` are refused while a task is neither done
//   nor closed, naming each.
//
// Every refusal is made before anything moves, opening on the verb — the
// landing's own among them, which open on `land` where it makes them.
// Nothing here touches a task of a unit that is no quick-fix.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { quickFixBuild, buildLength, FIXES_PHASE } = require('./derivations.cjs');
const { shownTask, taskName } = require('./task-id.cjs');
const { trackedPhase, trackedBuild, ENDED } = require('./task-verbs.cjs');
const { quickFixLanding } = require('./landing.cjs');
const { short: shortSha } = require('./landing-git.cjs');
const { remade } = require('./fix-branch.cjs');
const { takeOutRecord, indexSummary } = require('./quick-fix-record.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/** Whether the unit is built as a quick-fix, its every task on its one branch. @param {string} cwd @param {string} unit */
const ofQuickFix = (cwd, unit) => quickFixBuild(loadWorkUnitManifest(cwd, unit));

/** Whether the task is a quick-fix's fix, its phase 1's. @param {string} cwd @param {TaskRef} ref */
const isFix = (cwd, ref) => ref.phase === FIXES_PHASE.number && ofQuickFix(cwd, ref.unit);

/** The task as the tracker holds it, where it holds it. @param {string} cwd @param {TaskRef} ref */
const trackedOf = (cwd, ref) => (trackedPhase(cwd, ref.unit, ref.phase).tasks ?? []).find((held) => held.ref.n === ref.n);

/**
 * Whether the task is a quick-fix's not yet ended — false for a task the
 * tracker lacks, or holds ended, which the verb's own read refuses.
 * @param {string} cwd @param {TaskRef} ref
 */
function standing(cwd, ref) {
  if (!ofQuickFix(cwd, ref.unit)) return false;
  const task = trackedOf(cwd, ref);
  return task !== undefined && !ENDED.includes(task.status);
}

/**
 * A read of the landing for a verb's refusals, a refusal it makes opening
 * on that verb rather than on `land`.
 * @template T @param {string} said @param {() => T} read @returns {T}
 */
function asLanding(said, read) {
  try {
    return read();
  } catch (refusal) {
    if (refusal instanceof Error) refusal.message = `${said}: ${refusal.message.replace(/^land: /, '')}`;
    throw refusal;
  }
}

/**
 * Refuse a quick-fix's task opened where it is closed, or landed — naming
 * its done, or saying it is done.
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseOpening(cwd, ref) {
  if (!ofQuickFix(cwd, ref.unit)) return;
  const task = trackedOf(cwd, ref);
  if (task === undefined) return;
  if (task.status === 'closed') throw new Error(`land: ${taskName(ref)} is closed — a fix closed lands nothing`);
  if (!quickFixLanding(cwd, ref.unit).task(ref).landed) return;
  throw new Error(task.status === 'done'
    ? `land: ${taskName(ref)} has landed, and is done — nothing of it is left to open`
    : `land: ${taskName(ref)} has landed — a fix is done once it lands: task done ${ref.unit} ${shownTask(ref)}`);
}

/**
 * What done of a quick-fix's task not yet ended stands on, each in turn
 * (the header's): the refusal of the first it fails, or null.
 * @param {string} cwd @param {TaskRef} ref
 * @returns {string|null}
 */
function undoneRefusal(cwd, ref) {
  const shown = shownTask(ref);
  const landing = quickFixLanding(cwd, ref.unit);
  const read = landing.task(ref);
  if (!read.held) return `${taskName(ref)} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${ref.unit} ${shown} --reason <why>`;
  if (!read.landed && read.own === null) {
    return `${taskName(ref)}'s commit ${shortSha(/** @type {string} */ (read.found))} is not on ${landing.branch} — make its change again there through the door: ${remade(ref, /** @type {string} */ (read.found))}`;
  }
  if (!read.landed && !landing.inPull(read)) {
    return `${taskName(ref)}'s newest commit is not in ${ref.unit}'s pull request — a task is done once it is committed and in it: land open ${ref.unit} ${shown} pushes it`;
  }
  return null;
}

/**
 * Refuse a quick-fix's task done as its end refuses it (`undoneRefusal`).
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseUndone(cwd, ref, said) {
  if (!standing(cwd, ref)) return;
  const refusal = asLanding(said, () => undoneRefusal(cwd, ref));
  if (refusal !== null) throw new Error(`${said}: ${refusal}`);
}

/**
 * Refuse a quick-fix's task closed while it holds work of its own, landed
 * or not, naming the reversal.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseHeld(cwd, ref, said) {
  if (!standing(cwd, ref)) return;
  const read = asLanding(said, () => quickFixLanding(cwd, ref.unit).task(ref));
  if (!read.held) return;
  const lands = read.landed ? 'it has landed, so it is done' : `it lands as it is with ${ref.unit}'s pull request, done once it is in it`;
  throw new Error(
    `${said}: ${taskName(ref)} holds work of its own — ${lands}, and its change is given up as a landed change is, `
    + `by a fix of its own whose commit through the door reverts it: task create ${ref.unit} ${ref.phase} --file <task.md>`,
  );
}

/**
 * Refuse a quick-fix landed — `land phase` or `land finish` — while a task
 * of its build is neither done nor closed, naming each.
 * @param {string} cwd @param {string} unit
 */
function refuseUnended(cwd, unit) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (manifest === null || !quickFixBuild(manifest)) return;
  const open = trackedBuild(cwd, unit, buildLength(manifest)).tasks.filter(({ status }) => !ENDED.includes(status)).map(({ ref }) => shownTask(ref));
  if (open.length === 0) return;
  const [named, are] = open.length === 1 ? [`task ${open[0]}`, 'is'] : [`tasks ${open.join(', ')}`, 'are'];
  throw new Error(`land: ${unit} lands once each of its tasks is done or closed — ${named} ${are} neither: task done ${unit} ${open[0]}, or task close ${unit} ${open[0]} --reason <why>`);
}

/**
 * A quick-fix's fix's record taken out as it closes, where it holds one
 * (`takeOutRecord`): the state files written, for the close's own commit;
 * none for any other task.
 * @param {string} cwd @param {TaskRef} ref @returns {string[]}
 */
function closedRecord(cwd, ref) {
  return isFix(cwd, ref) ? takeOutRecord(cwd, ref) : [];
}

/**
 * The knowledge base brought in line with `summary.md` once a close that
 * took a record out of it is committed (`indexSummary`): what that warned
 * of.
 * @param {string} cwd @param {TaskRef} ref @param {string[]} written the files the close wrote beside the tracker's store
 * @returns {{warnings?: string[]}}
 */
function recordReindexed(cwd, ref, written) {
  if (written.length === 0) return {};
  /** @type {string[]} */
  const warnings = [];
  indexSummary(cwd, ref.unit, warnings);
  return warnings.length > 0 ? { warnings } : {};
}

module.exports = { refuseOpening, refuseUndone, refuseHeld, refuseUnended, closedRecord, recordReindexed };
