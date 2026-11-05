'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how a quick-fix's fix ends — `task done` and `task close` of
// one of its fixes, phase 1's (task-verbs.cjs) — so its close meets only two
// shapes of fix: one done, holding work of its own, opened to land and
// recorded; and one closed, holding nothing that lands (finish.cjs).
//
// A fix's own work is a commit its branch holds past the branch it is laid
// on (`fixWork`, fix-branch.cjs). Done takes a fix holding work of its own —
// one holding none, met already or with nothing to change, is closed as met,
// the refusal naming `task close` — and opened to land as its branch
// stands, as the close reads it (`unchained`, landing.cjs), the refusal
// naming `land open`: so each fix is done once it lands. Close takes a fix
// holding no work of its own, and one holding work that is neither opened
// to land nor built on by a later fix not closed (`laidOn`, fix-branch.cjs)
// — refused otherwise, naming the reversal: a change opened to land, or
// built on, lands as it is, and is given up as any landed change is, by a
// fix of its own whose commit through the door reverts it. A fix closed
// that was recorded has its record taken out of `summary.md` and the fixes
// recorded, written for the close's own commit (quick-fix-record.cjs,
// `takeOutRecord`), and the knowledge base brought in line once it is
// made. Every refusal is made before anything moves, opening on the verb.
// Nothing here touches a task that is no quick-fix's fix.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { quickFixBuild, FIXES_PHASE } = require('./derivations.cjs');
const { shownTask, taskName } = require('./task-id.cjs');
const { trackedPhase, ENDED } = require('./task-verbs.cjs');
const { unchained } = require('./landing.cjs');
const { fixWork, laidOn } = require('./fix-branch.cjs');
const { takeOutRecord, indexSummary } = require('./quick-fix-record.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */

/** Whether the task is a quick-fix's fix. @param {string} cwd @param {TaskRef} ref */
const isFix = (cwd, ref) => ref.phase === FIXES_PHASE.number && quickFixBuild(loadWorkUnitManifest(cwd, ref.unit));

/**
 * The fix as the tracker holds it, with the set's fixes and its work
 * (`fixWork`); null where the tracker lacks it, or holds it ended, which
 * the verb's own read refuses.
 * @param {string} cwd @param {TaskRef} ref
 */
function fixStanding(cwd, ref) {
  const fixes = trackedPhase(cwd, ref.unit, ref.phase).tasks ?? [];
  const fix = fixes.find((held) => held.ref.n === ref.n);
  return fix === undefined || ENDED.includes(fix.status) ? null : { fixes, fix, work: fixWork(cwd, ref, fixes) };
}

/** Whether the fix is opened to land as its branch stands, as the close reads it. @param {string} cwd @param {TaskDetail} fix */
const opened = (cwd, fix) => unchained(cwd, fix.ref.unit, [fix]).length === 0;

/**
 * Refuse a quick-fix's fix done while it holds no work of its own, naming
 * its close as met, or is not opened to land as its branch stands, naming
 * its opening.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseUndone(cwd, ref, said) {
  const standing = isFix(cwd, ref) ? fixStanding(cwd, ref) : null;
  if (standing === null) return;
  const { fix, work } = standing;
  const shown = shownTask(ref);
  if (!work?.own) {
    throw new Error(`${said}: ${taskName(ref)} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${ref.unit} ${shown} --reason <why>`);
  }
  if (!opened(cwd, fix)) throw new Error(`${said}: ${taskName(ref)} is not opened to land as its branch stands — a fix is done once it lands: land open ${ref.unit} ${shown}`);
}

/** The later fixes laid on a fix, as a refusal names them. @param {number[]} later @param {TaskRef} ref */
function laidWords(later, ref) {
  const tasks = later.map((n) => shownTask({ ...ref, n }));
  return `task${tasks.length === 1 ? '' : 's'} ${tasks.join(', ')} ${tasks.length === 1 ? 'is' : 'are'} laid on it`;
}

/**
 * Refuse a quick-fix's fix closed while it holds work of its own that is
 * opened to land or built on by a later fix not closed, naming the
 * reversal.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseHeld(cwd, ref, said) {
  const standing = isFix(cwd, ref) ? fixStanding(cwd, ref) : null;
  if (standing === null) return;
  const { fixes, fix, work } = standing;
  if (!work?.own) return;
  const later = laidOn(cwd, ref, work, fixes);
  const why = [...(opened(cwd, fix) ? ['it is opened to land'] : []), ...(later.length > 0 ? [laidWords(later, ref)] : [])];
  if (why.length === 0) return;
  throw new Error(
    `${said}: ${taskName(ref)} holds work of its own, and ${why.join(', and ')} — so it lands as it is, done once it lands, and its change is given up as a landed change is, `
    + `by a fix of its own whose commit through the door reverts it: task create ${ref.unit} ${FIXES_PHASE.number} --file <task.md>`,
  );
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

module.exports = { refuseUndone, refuseHeld, closedRecord, recordReindexed };
