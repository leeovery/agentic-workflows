'use strict';

// ---------------------------------------------------------------------------
// Domain ring: finish (14.5), the authority gate after the review phase's
// report, and a quick-fix's close, its finish gate (19.5.8, 19.5.13) — the
// screen, `render finish <unit>`, and the person's yes, `finish yes <unit>`,
// which lands what stands and completes the unit. Its screens are drawn by
// projections/finish.cjs.
//
// - The screen stands on finish's checklist closed, every engine item
//   holding still — the review phase over among them, where the unit has
//   one (checklist.cjs, `finishClose`; finish-checks.cjs). It refuses a unit
//   the project lacks or holds not in progress, and one the build's entry
//   refuses: a unit built under the old plan, a build by its cut not begun
//   (build-entry.cjs). A quick-fix's close stands besides on each of its
//   fixes ended and each done with its record written (quick-fix-record.cjs,
//   `recordedFixes`) — read off the unit's records alone, so the board
//   asking whether it draws never reaches the host — and the screen reads
//   whether its pull requests still hold a task done not landed, as a merge
//   by hand on the host, by any method, leaves them (landing.cjs,
//   `quickFixLanding`) — a fix task of a review asked for at the close
//   among them — the yes then merging them, else saying its fixes have
//   landed.
// - It shows every checklist item skipped on the way, with its reason,
//   read from the unit's manifest (6.4.5, 6.4.12); then asks, one at a
//   time, the verdict of each departure this machine logged in the build
//   and the review phase — the person's answer at `{unit}.implementation`
//   or `{unit}.review` standing over Claude's lean — given at the verdict
//   point `finish` (16.10.3, ledger-verdicts.cjs), a quick-fix's at its
//   close, `close` (16.10.4); where the person changed none, nothing
//   is added (16.10.5). Finish then invites questions about what was built,
//   answered before finishing (14.5.1); and what the review's put backs set
//   aside, where they set aside anything, said to stay until the person
//   removes it. A quick-fix's close says, under its title, what running the
//   product proved of each fix done, each scenario it names from its runs
//   at the quick-fix's branch's tip (build-screens.cjs, `ranOf`), or in one
//   line that the project has no way to run it, no verify setup recorded
//   (P9); then its gate, the yes — saying it merges its pull request, where
//   a fix done is still to land — a review asked for, and questions about
//   the change.
//   What its reads warned of — a knowledge base set up that does not read
//   among it (finish-checks.cjs) — is said on the screen, and on the yes's
//   answer.
// - The yes stands on the screen as drawn: the close it shows and no
//   verdict still to ask. A quick-fix's refuses first a project's checkout
//   holding changes not committed outside the state, naming each, its fixes
//   having been built there (fix-branch.cjs). It lands every phase still
//   standing (`land finish`, landing.cjs) — the review phase's fix phases,
//   numbered past the cut, after every other (7.2.6); a quick-fix's one pull
//   request, every task's commit squashed into one, or, where a merge by
//   hand landed it, the branch it lands on here brought up to the host's —
//   a refusal there leaving the unit as it was, with its way on; a
//   quick-fix's then puts the project's checkout back on the branch it
//   lands on; then
//   completes the unit (workunit-lifecycle.cjs). It answers where the work
//   goes (24.1.2), a handoff each: an epic's menu, its review completed;
//   the start menu, `/leeway`, for every other type.
// ---------------------------------------------------------------------------

const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { readShown } = require('./ledger-read.cjs');
const { verdictAsked, closeDepartures } = require('./ledger-verdicts.cjs');
const {
  itemTitle, topicTitles, buildRefusal, quickFixBuild, reviewAsked, buildLength,
} = require('./derivations.cjs');
const { trackedBuild } = require('./task-verbs.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { finishClose } = require('./checklist.cjs');
const { landFinish, quickFixLanding } = require('./landing.cjs');
const { completeWorkUnit } = require('./workunit-lifecycle.cjs');
const { refusing, stands } = require('./staged-payload.cjs');
const { READERS, readersDone } = require('./scratch.cjs');
const { finishScreen, closeScreen } = require('./projections/finish.cjs');
const { setAsideHeld } = require('./review-phase.cjs');
const { recordedFixes } = require('./quick-fix-record.cjs');
const { refuseDirtyClose, checkOutLanding } = require('./fix-branch.cjs');
const { ranOf } = require('./build-screens.cjs');
const { verifySetup } = require('./environment.cjs');
const { projectName } = require('./state-checks.cjs');
const { criteriaTexts } = require('./task-file.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./projections/build.cjs').Ran} Ran */

const FINISH_USAGE = 'finish yes <work-unit>';

/**
 * The close the screen stands on, refused where finish cannot show: the
 * unit's own refusals, a quick-fix's fixes not ended or not recorded, then
 * its checklist's close (`finishClose`) — read off the unit's records
 * alone — with a quick-fix's fixes done, null for any other unit.
 * @param {string} cwd @param {string} unit
 */
function finishStanding(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  const refused = buildRefusal(manifest);
  if (refused !== null) throw new Error(refused);
  if (!quickFixBuild(manifest)) return { manifest, fixes: null, ...finishClose(cwd, unit) };
  const fixes = recordedFixes(cwd, manifest);
  return { manifest, fixes, ...finishClose(cwd, unit) };
}

/** Whether finish's screen draws, as `render finish` stands on it: what the board lists waiting on the person, never reaching the host. @param {string} cwd @param {string} unit */
const finishDraws = (cwd, unit) => stands(() => finishStanding(cwd, unit));

/**
 * Whether a quick-fix's pull requests still hold a task done not landed,
 * as its close's screen says it (`quickFixLanding`): a fix, or a fix task
 * of the review asked for at its close, which lands with them in its one
 * pull request (19.5.15) — so a merge by hand of the fixes alone leaves
 * the yes merging that pull request still; false for any other unit.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest
 */
function stillToLand(cwd, unit, manifest) {
  const done = trackedBuild(cwd, unit, buildLength(manifest)).tasks.filter(({ status }) => status === 'done');
  if (done.length === 0) return false;
  const read = quickFixLanding(cwd, unit);
  return done.some(({ ref }) => !read.task(ref).landed);
}

/**
 * What the screen and the yes stand on, refused where finish cannot show:
 * the unit's manifest, a quick-fix's fixes done, the skips its close shows,
 * and the verdict asked of the first departure in the build still owed one.
 * @param {string} cwd @param {string} unit
 */
function standing(cwd, unit) {
  const { manifest, fixes, closed, skips, warnings } = finishStanding(cwd, unit);
  const root = stateRoot(cwd);
  const verdict = carryingAll(warnings, () => readShown(root, warnings, (shower) => verdictAsked(shower, root, closesIn(unit, closed))));
  return { manifest, fixes, skips, warnings, verdict };
}

/** What finish closes of a departure: the unit's work in the build's places, closed when its checklist did. @param {string} unit @param {string} closed */
const closesIn = (unit, closed) => (/** @type {import('./ledger-fold.cjs').IdFacts} */ facts) => (facts.unit === unit && BUILD_PHASES.includes(facts.phase) ? closed : null);

/**
 * The calls the person changed in the work finish closes, and the verdicts
 * on them still owed, as its screen asks them, the board reading the close
 * it waits on; null where the screen does not draw.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 * @returns {{changed: number, owed: number}|null}
 */
function closeVerdicts(cwd, unit, warnings) {
  /** @type {string|null} */
  let closed = null;
  if (!stands(() => ({ closed } = finishStanding(cwd, unit)))) return null;
  const root = stateRoot(cwd);
  return readShown(root, warnings, (shower) => {
    const { departures, waiting } = closeDepartures(shower.folded, root, closesIn(unit, /** @type {string} */ (closed)));
    return { changed: departures.length, owed: waiting.length };
  });
}

/**
 * What running the product proved of each fix done, a scenario a line, in
 * the fixes' order — null where the project has no way to run it, no verify
 * setup recorded (P9).
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskDetail[]} fixes
 * @returns {Ran[]|null}
 */
function provenOf(cwd, manifest, fixes) {
  if (verifySetup(cwd) === null) return null;
  return fixes.flatMap((fix) => ranOf(cwd, manifest, fix.ref, fix, criteriaTexts(fix.text)).ran ?? []);
}

/** `read`, a refusal it throws carrying what finish's standing warned. @template T @param {string[]} warnings @param {() => T} read @returns {T} */
function carryingAll(warnings, read) {
  try {
    return read();
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `render finish <unit>`: the screen — a quick-fix's, its close.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function finishSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render finish', () => {
    const { manifest, fixes, skips, verdict, warnings } = standing(cwd, unit);
    const view = {
      unit,
      title: itemTitle(topicTitles(manifest), 'review', unit),
      skips: skips.map(({ checklist, text, reason }) => ({ checklist, text, reason })),
      verdict,
      warnings,
      aside: setAsideHeld(cwd, unit),
    };
    if (fixes === null) return finishScreen(view);
    return closeScreen({
      ...view, product: projectName(cwd), proven: provenOf(cwd, manifest, fixes), fixes: fixes.length, landing: carryingAll(warnings, () => stillToLand(cwd, unit, manifest)), reviewed: reviewAsked(manifest),
    });
  });
}

/** Where the work goes once the unit is finished (24.1.2): an epic's menu, its review completed; else the start menu. @param {Record<string, any>} manifest @returns {Next} */
function nextAfterFinish(manifest) {
  return manifest.work_type === 'epic' ? { kind: 'handoff', skill: 'leeway-continue-epic', args: [manifest.name, 'review', 'completed'] } : { kind: 'handoff', skill: 'leeway', args: [] };
}

/**
 * Every phase still standing landed, refused while a verdict waits — for a
 * quick-fix, while the project's checkout holds changes not committed, and
 * the checkout then put back on the branch it lands on — a refusal carrying
 * what finish's standing warned.
 * @param {string} cwd @param {string} unit @param {{verdict: unknown, warnings: string[], fixes: TaskDetail[]|null}} standing
 * @returns {{repos: Record<string, any>[], warnings?: string[], checkout?: string}}
 */
function landStanding(cwd, unit, { verdict, warnings, fixes }) {
  return carryingAll(warnings, () => {
    if (verdict !== null) throw new Error('a verdict is still to ask — render finish asks each before the yes');
    if (fixes === null) return landFinish(cwd, unit);
    refuseDirtyClose(cwd, unit);
    const landed = landFinish(cwd, unit);
    const checkout = checkOutLanding(cwd, unit);
    return checkout === null ? landed : { ...landed, checkout };
  });
}

/**
 * `finish yes <unit>`: every phase still standing landed, the unit
 * completed.
 * @param {string} cwd @param {string} unit
 */
function finishYes(cwd, unit) {
  const stands = standing(cwd, unit);
  const { manifest, warnings } = stands;
  const landed = landStanding(cwd, unit, stands);
  readersDone(cwd, READERS.unit(unit));
  const completed = completeWorkUnit(cwd, unit, { message: `finish(${unit}): completed` });
  const said = [...warnings, ...(landed.warnings ?? []), ...completed.warnings];
  /** @type {Record<string, unknown>} */
  const result = { unit, landed: landed.repos, ...(landed.checkout === undefined ? {} : { checkout: landed.checkout }), completed_at: completed.completed_at, committed: completed.committed, next: nextAfterFinish(manifest) };
  if (completed.note !== undefined) result.note = completed.note;
  if (said.length > 0) result.warnings = said;
  return result;
}

/**
 * `finish yes <unit>`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runFinishVerb(cwd, [verb, ...args], opts) {
  if (verb !== 'yes' || args.length !== 1 || Object.keys(opts).length > 0) throw new Error(`Usage: engine ${FINISH_USAGE}`);
  return refusing('finish yes', () => finishYes(cwd, args[0]));
}

module.exports = { FINISH_USAGE, finishStanding, finishSurface, finishDraws, runFinishVerb, closeVerdicts };
