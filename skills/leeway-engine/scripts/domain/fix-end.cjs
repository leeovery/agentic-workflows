'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how a quick-fix's fix opens and ends — `land open`,
// `task done` and `task close` of one of its fixes, phase 1's (landing.cjs,
// task-verbs.cjs) — and how its set lands, so its close meets only two
// shapes of fix: one done, holding work of its own, opened or landed, and
// recorded; and one closed, holding nothing that lands (finish.cjs).
//
// A fix's landing is read alone, never through its phase's merge state nor
// its pull request's, as a person's merge by hand on the host, by any
// method and into any branch, leaves it: landed where the branch it lands
// on, as the host has it, holds its change — named there, or its own work
// merging there changing nothing — whether or not its branch is left;
// opened where its pull request is, merged elsewhere or not; or neither
// (`taskLandings`, landing.cjs). Its reads go in order: closed, then
// landed, then opened, then in flight. A fix's own work is its commits
// through the door, on its branch past the branch the repository lands on,
// on that branch once landed, or, its branch gone, wherever the repository
// holds them (`ownWork`, fix-branch.cjs).
//
// - Open is refused, on every driver alike, for a fix closed, which lands
//   nothing, as `land open` is the one verb that puts a fix in its stack —
//   refused first; for a fix landed, naming its done; and while the fix is
//   laid on an earlier fix not closed — its branch holding a commit of that
//   fix's own (`laidBeneath`) — neither opened nor landed, naming the
//   lowest such fix's opening, so no pull request carries a fix below it,
//   which could then never open, end or close. A fix opens alone
//   (landing.cjs, `LandingTask`): one laid on a fix landed, or left once its
//   stack was merged by hand, opens onto the branch the repository lands on
//   as the host has it, any merge back it then asks for made through the
//   door under the fix.
// - Done takes a fix holding work of its own — one holding none, met
//   already or with nothing to change, is closed as met, the refusal naming
//   `task close` — landed, whether or not its branch is left, or opened,
//   else refused naming `land open`; and, for one opened, where its pull
//   request records what it holds, its branch as it stands: one moved past
//   it is refused with the driver's way back, the branch kept, put back
//   where it opened and its change past that a task of its own
//   (`movedSinceOpening`, landing.cjs). A fix landed is never asked whether
//   its branch moved: what landed is what the branch it lands on holds. So
//   each fix is done once it lands.
// - The door takes a fix done, not yet landed, a commit that finishes a
//   merge back of the branch the fixes land on, as the host has it or here
//   (`takesMergeBack`) — the merge back the landing asks for, which changes
//   none of the fix's own work.
// - Close takes a fix neither landed nor opened, whether or not its branch
//   is left, as one landed or opened stands in what lands, nor holding work
//   a later fix not closed is laid on (`laidOn`, fix-branch.cjs) — refused otherwise,
//   naming the reversal: a change landed, opened to land, or built on lands
//   as it is, and is given up as any landed change is, by a fix of its own
//   whose commit through the door reverts it. A fix closed that was
//   recorded has its record taken out of `summary.md` and the fixes
//   recorded, written for the close's own commit (quick-fix-record.cjs,
//   `takeOutRecord`), and the knowledge base brought in line once it is
//   made.
// - `land phase` of its fixes' phase and `land finish` are refused while a
//   fix is neither done nor closed, naming each.
//
// Every refusal is made before anything moves, opening on the verb — the
// landing's own among them, which open on `land` where it makes them.
// Nothing here touches a task that is no quick-fix's fix.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { quickFixBuild, FIXES_PHASE } = require('./derivations.cjs');
const { shownTask, taskName } = require('./task-id.cjs');
const { trackedPhase, ENDED } = require('./task-verbs.cjs');
const { taskLandings, movedSinceOpening } = require('./landing.cjs');
const { ownWork, mergingLanding, laidOn, laidBeneath, closedFixes } = require('./fix-branch.cjs');
const { takeOutRecord, indexSummary } = require('./quick-fix-record.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */

/** Whether the task is a quick-fix's fix. @param {string} cwd @param {TaskRef} ref */
const isFix = (cwd, ref) => ref.phase === FIXES_PHASE.number && quickFixBuild(loadWorkUnitManifest(cwd, ref.unit));

/**
 * The fix as the tracker holds it, with the set's fixes; null where the
 * tracker lacks it, or holds it ended, which the verb's own read refuses.
 * @param {string} cwd @param {TaskRef} ref
 */
function fixStanding(cwd, ref) {
  const fixes = trackedPhase(cwd, ref.unit, ref.phase).tasks ?? [];
  const fix = fixes.find((held) => held.ref.n === ref.n);
  return fix === undefined || ENDED.includes(fix.status) ? null : { fixes, fix };
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

/** The fix's landing (`taskLandings`), as a verb reads it. @param {string} cwd @param {TaskDetail} fix @param {string} said */
const landingOf = (cwd, fix, said) => asLanding(said, () => taskLandings(cwd, fix.ref.unit)(fix).state);

/**
 * Refuse a quick-fix's fix opened where it is closed, or landed, naming its
 * done; or laid on an earlier fix not closed that is neither opened nor
 * landed, naming the lowest such fix's opening.
 * @param {string} cwd @param {TaskRef} ref
 */
function refuseOpening(cwd, ref) {
  if (!isFix(cwd, ref)) return;
  const fixes = trackedPhase(cwd, ref.unit, ref.phase).tasks ?? [];
  if (closedFixes(fixes).includes(ref.n)) throw new Error(`land: ${taskName(ref)} is closed — a fix closed lands nothing`);
  const landing = taskLandings(cwd, ref.unit);
  const fix = fixes.find((held) => held.ref.n === ref.n);
  if (fix !== undefined && landing(fix).state === 'landed') {
    throw new Error(fix.status === 'done'
      ? `land: ${taskName(ref)} has landed, and is done — nothing of it is left to open`
      : `land: ${taskName(ref)} has landed — a fix is done once it lands: task done ${ref.unit} ${shownTask(ref)}`);
  }
  const beneath = laidBeneath(cwd, ref, fixes);
  const unopened = fixes.filter((held) => beneath.includes(held.ref.n) && landing(held).state === null).sort((a, b) => a.ref.n - b.ref.n).map((held) => shownTask(held.ref));
  if (unopened.length === 0) return;
  throw new Error(`land: ${taskName(ref)} is laid on ${unopened.join(', ')}, not opened to land — a fix opens after each fix it is laid on: land open ${ref.unit} ${unopened[0]}`);
}

/**
 * Refuse a quick-fix's fix done while it holds no work of its own, naming
 * its close as met; is neither landed nor opened, naming its opening; or
 * its branch has moved past what its pull request holds, naming the
 * driver's way back.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseUndone(cwd, ref, said) {
  const standing = isFix(cwd, ref) ? fixStanding(cwd, ref) : null;
  if (standing === null) return;
  const { fix } = standing;
  const shown = shownTask(ref);
  if (!ownWork(cwd, ref)) {
    throw new Error(`${said}: ${taskName(ref)} holds no commit of its own — a fix met already, or with nothing to change, is closed as met: task close ${ref.unit} ${shown} --reason <why>`);
  }
  const state = landingOf(cwd, fix, said);
  if (state === null) throw new Error(`${said}: ${taskName(ref)} is not opened to land as its branch stands — a fix is done once it lands: land open ${ref.unit} ${shown}`);
  if (state === 'landed') return;
  const moved = asLanding(said, () => movedSinceOpening(cwd, ref.unit, fix, { said, then: 'mark it done again' }));
  if (moved !== null) throw new Error(moved);
}

/** The later fixes laid on a fix's work, as a refusal names them. @param {number[]} later @param {TaskRef} ref */
function laidWords(later, ref) {
  const tasks = later.map((n) => shownTask({ ...ref, n }));
  return `holds work of its own that task${tasks.length === 1 ? '' : 's'} ${tasks.join(', ')} ${tasks.length === 1 ? 'is' : 'are'} laid on`;
}

/** What a fix's landing makes of its close, as the refusal says it. @type {Record<string, string>} */
const HELD_AS = { landed: 'has landed', opened: 'is opened to land' };

/**
 * Refuse a quick-fix's fix closed while it has landed or is opened to land,
 * whatever its own work reads, or holds work a later fix not closed is laid
 * on, naming the reversal.
 * @param {string} cwd @param {TaskRef} ref @param {string} said the verb, as its refusal opens
 */
function refuseHeld(cwd, ref, said) {
  const standing = isFix(cwd, ref) ? fixStanding(cwd, ref) : null;
  if (standing === null) return;
  const { fixes, fix } = standing;
  const later = laidOn(cwd, ref, fixes);
  const state = landingOf(cwd, fix, said);
  const why = [...(state === null ? [] : [HELD_AS[state]]), ...(later.length > 0 ? [laidWords(later, ref)] : [])];
  if (why.length === 0) return;
  const lands = state === 'landed' ? 'so it is done' : 'so it lands as it is, done once it lands';
  throw new Error(
    `${said}: ${taskName(ref)} ${why.join(', and ')} — ${lands}, and its change is given up as a landed change is, `
    + `by a fix of its own whose commit through the door reverts it: task create ${ref.unit} ${FIXES_PHASE.number} --file <task.md>`,
  );
}

/**
 * Refuse a quick-fix's set landed — `land phase` of its fixes' phase, or
 * `land finish` — while a fix is neither done nor closed, naming each.
 * @param {string} cwd @param {string} unit @param {number} [phase] the phase landed, every phase for `land finish`
 */
function refuseUnended(cwd, unit, phase = FIXES_PHASE.number) {
  const manifest = manifestOf(stateRoot(cwd), unit);
  if (phase !== FIXES_PHASE.number || manifest === null || !quickFixBuild(manifest)) return;
  const open = (trackedPhase(cwd, unit, phase).tasks ?? []).filter(({ status }) => !ENDED.includes(status)).map(({ ref }) => shownTask(ref));
  if (open.length === 0) return;
  const [named, are] = open.length === 1 ? [`task ${open[0]}`, 'is'] : [`tasks ${open.join(', ')}`, 'are'];
  throw new Error(`land: ${unit} lands once each of its fixes is done or closed — ${named} ${are} neither: task done ${unit} ${open[0]}, or task close ${unit} ${open[0]} --reason <why>`);
}

/**
 * Whether the door takes a commit under a quick-fix's fix done: one that
 * finishes a merge back of the branch the fixes land on, as the host has it
 * or here (`mergingLanding`), which the landing asks for, while the fix has
 * not landed.
 * @param {string} cwd @param {TaskRef} ref
 */
function takesMergeBack(cwd, ref) {
  if (!isFix(cwd, ref) || !mergingLanding(cwd)) return false;
  const fix = (trackedPhase(cwd, ref.unit, ref.phase).tasks ?? []).find((held) => held.ref.n === ref.n);
  return fix?.status === 'done' && taskLandings(cwd, ref.unit)(fix).state !== 'landed';
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

module.exports = { isFix, refuseOpening, refuseUndone, refuseHeld, refuseUnended, takesMergeBack, closedRecord, recordReindexed };
