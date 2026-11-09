'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how a quick-fix's tasks open and end — `land open`, `task
// done` and `task close` of any task of its build, its fixes and the fix
// tasks of a review asked for at its close (landing.cjs, task-verbs.cjs) —
// and when it lands, so its close meets only two shapes of task: one done,
// holding work of its own, in its pull requests or landed, and, for a fix,
// recorded; and one closed, holding none (finish.cjs).
//
// A task's landing is read in every repository the quick-fix touches, each
// against the branch it lands on as the host has it, whether or not the
// quick-fix's branch there is left (`quickFixLanding`, landing.cjs), as a
// person's merge of a pull request by hand, by any method, leaves it:
// landed where its newest commit of its own is on that branch, in a pull
// request merged, or its change there, merging it changing nothing — named
// there, where the repository holds no commit of its own — and in the pull
// request where the one open holds that commit. Its own work is a commit
// of its own through the door (commit-task.cjs), on the quick-fix's branch
// or wherever the repository keeps it, or its change landed; it has landed
// once it has in every repository it holds work in.
//
// - Open is refused for a task closed, which lands nothing — refused first,
//   as `land open` is the one verb that puts a task in a pull request — and
//   for one landed, naming its done, or saying it is done.
// - Done takes a task holding work of its own, in every repository it holds
//   work in landed or in the pull request open there — its newest commit
//   committed and in it — refused where it holds none, met already or with
//   nothing to change, naming its close as met; where its commit is not on
//   the branch, as a branch cut again leaves one that did not apply there,
//   naming its change made again there through the door (`remade`,
//   fix-branch.cjs); and where its newest commit is not in the pull request,
//   naming `land open`, which pushes it (`undoneRefusal`, done's one rule).
// - Close takes a task holding no work of its own, met already or given up
//   before its commit; one holding any, landed or not, in any repository,
//   is refused, naming the reversal: its change lands as it is, given up as
//   a landed change is, by a fix of its own whose commit through the door
//   reverts it — one its pair failed in its last round landing only once
//   its review is settled (`task settle`, task-account.cjs), which the
//   refusal names first. A fix closed that was recorded — by a move's close
//   (`closeForMove`, task-verbs.cjs), which refuses none — has its record
//   taken out of `summary.md` and the fixes recorded, written for the
//   close's own commit (quick-fix-record.cjs, `takeOutRecord`), and the
//   knowledge base brought in line once it is made.
// - `land phase` and `land finish` are refused while a task is neither done
//   nor closed, naming each; and, its branches readied, while a task done
//   holds work neither landed nor on the quick-fix's branch — as a branch
//   cut again leaves a commit that did not apply there — or none at all,
//   naming its change made again through the door (`refuseLeftOff`), which
//   takes a commit under a task done so though it has ended (`remakesDone`).
//
// Every refusal is made before anything moves, opening on the verb — the
// landing's own among them, which open on `land` where it makes them.
// Nothing here touches a task of a unit that is no quick-fix.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { quickFixBuild, buildLength, FIXES_PHASE } = require('./derivations.cjs');
const { shownTask, taskName } = require('./task-id.cjs');
const { trackedPhase, trackedBuild, ENDED } = require('./task-verbs.cjs');
const { quickFixLanding } = require('./landing.cjs');
const { short: shortSha } = require('./landing-git.cjs');
const { taskRounds, pairPassed } = require('./round-report.cjs');
const { remade } = require('./fix-branch.cjs');
const { takeOutRecord, indexSummary } = require('./quick-fix-record.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./landing.cjs').QuickFixLanding} QuickFixLanding */
/** @typedef {import('./landing.cjs').RepoLanding} RepoLanding */

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
 * Refuse a quick-fix's task opened where it is closed, or landed wherever
 * it holds work — naming its done, or saying it is done.
 * @param {string} cwd @param {TaskRef} ref @param {QuickFixLanding} read the opening's
 */
function refuseOpening(cwd, ref, read) {
  if (!ofQuickFix(cwd, ref.unit)) return;
  const task = trackedOf(cwd, ref);
  if (task === undefined) return;
  if (task.status === 'closed') throw new Error(`land: ${taskName(ref)} is closed — a fix closed lands nothing`);
  if (!read.task(ref).landed) return;
  throw new Error(task.status === 'done'
    ? `land: ${taskName(ref)} has landed, and is done — nothing of it is left to open`
    : `land: ${taskName(ref)} has landed — a fix is done once it lands: task done ${ref.unit} ${shownTask(ref)}`);
}

/** A repository as a refusal names it: its folder, or nothing for the project's own. @param {RepoLanding} held */
const inWords = (held) => (held.ctx.repo === '.' ? '' : ` in ${held.ctx.repo}`);

/**
 * Where a task's work is neither landed nor on the quick-fix's branch, as
 * a branch cut again leaves a commit that did not apply there: the first
 * repository so, and the task's newest commit it holds — or null where
 * none is so.
 * @param {QuickFixLanding} read @param {TaskRef} ref
 * @returns {{held: RepoLanding, found: string|null}|null}
 */
function leftOffAt(read, ref) {
  const off = read.task(ref).each.find(({ task }) => !task.landed && task.own === null);
  return off === undefined ? null : { held: off.read, found: off.task.found };
}

/** Whether a task's work is gone: neither held anywhere nor landed. @param {QuickFixLanding} read @param {TaskRef} ref */
const workGone = (read, ref) => !read.task(ref).held;

/**
 * What done of a quick-fix's task not yet ended stands on, each in turn
 * (the header's), in every repository it holds work in: the refusal of
 * the first it fails, or null.
 * @param {string} cwd @param {TaskRef} ref
 * @returns {string|null}
 */
function undoneRefusal(cwd, ref) {
  const shown = shownTask(ref);
  const landing = quickFixLanding(cwd, ref.unit);
  landing.refuseClosed();
  const read = landing.task(ref);
  if (!read.held) return `${taskName(ref)} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${ref.unit} ${shown} --reason <why>`;
  const off = leftOffAt(landing, ref);
  if (off !== null) {
    return `${taskName(ref)}'s commit ${shortSha(/** @type {string} */ (off.found))} is not on ${landing.branch}${inWords(off.held)} — make its change again there through the door: ${remade(ref, off.found)}`;
  }
  const out = read.each.find(({ read: held, task }) => !task.landed && !held.inPull(task));
  if (out !== undefined) {
    return `${taskName(ref)}'s newest commit${inWords(out.read)} is not in ${ref.unit}'s pull request — a task is done once it is committed and in it: land open ${ref.unit} ${shown} pushes it`;
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
 * or not, in any repository, naming the reversal.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseHeld(cwd, ref, said) {
  if (!standing(cwd, ref)) return;
  const read = asLanding(said, () => {
    const landing = quickFixLanding(cwd, ref.unit);
    landing.refuseClosed();
    return landing.task(ref);
  });
  if (!read.held) return;
  const failed = read.landed ? undefined : taskRounds(cwd, ref).at(-1);
  const lands = read.landed ? 'it has landed, so it is done'
    : failed !== undefined && !pairPassed(failed) ? `its pair failed it in round ${failed.round}, so it lands once its review is settled, task settle ${ref.unit} ${shownTask(ref)} --file <why.md>, then done once it is in ${ref.unit}'s pull request`
      : `it lands as it is with ${ref.unit}'s pull request, done once it is in it`;
  throw new Error(
    `${said}: ${taskName(ref)} holds work of its own — ${lands}, and its change is given up as a landed change is, `
    + `by a fix of its own whose commit through the door reverts it: task create ${ref.unit} ${ref.phase} --file <task.md>`,
  );
}

/**
 * Refuse a quick-fix landed while a task done holds work that is neither
 * landed nor on the quick-fix's branch (`leftOffAt`), or none at all,
 * naming its change made again there through the door, which takes a task
 * done so (`remakesDone`).
 * @param {string} cwd @param {QuickFixLanding} read the landing's, its branches readied
 */
function refuseLeftOff(cwd, read) {
  const { unit } = read.project;
  for (const { ref, status } of trackedBuild(cwd, unit, buildLength(loadWorkUnitManifest(cwd, unit))).tasks) {
    if (status !== 'done') continue;
    const off = leftOffAt(read, ref);
    if (off === null && !workGone(read, ref)) continue;
    const where = off === null
      ? 'holds no commit the repository keeps, and has not landed'
      : `holds ${shortSha(/** @type {string} */ (off.found))}, which is neither landed nor on ${read.branch}${inWords(off.held)}`;
    throw new Error(`land: ${unit} lands once each task done is landed or in its pull request — ${taskName(ref)} ${where} — make its change again there through the door, then land again: ${remade(ref, off?.found ?? null)}`);
  }
}

/**
 * Whether a commit under a quick-fix's task done goes through the door
 * though the task has ended: its work neither landed nor on the
 * quick-fix's branch, or gone (`refuseLeftOff`), its change made again
 * there.
 * @param {string} cwd @param {TaskRef} ref
 */
function remakesDone(cwd, ref) {
  if (!ofQuickFix(cwd, ref.unit) || trackedOf(cwd, ref)?.status !== 'done') return false;
  const read = quickFixLanding(cwd, ref.unit);
  return leftOffAt(read, ref) !== null || workGone(read, ref);
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

module.exports = { refuseOpening, refuseUndone, refuseHeld, refuseLeftOff, remakesDone, closedRecord, recordReindexed };
