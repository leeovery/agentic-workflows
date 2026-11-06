'use strict';

// ---------------------------------------------------------------------------
// Domain ring: finish (14.5), the authority gate after the review phase's
// report — the screen, `render finish <unit>`, and the person's yes,
// `finish yes <unit>`, which lands what stands and completes the unit. Its
// screen is drawn by projections/finish.cjs.
//
// - The screen stands on finish's checklist closed, every engine item
//   holding still — the review phase over among them (checklist.cjs,
//   `finishClose`; finish-checks.cjs). It refuses a unit the project lacks
//   or holds not in progress, and one the build's entry refuses: a
//   quick-fix, a unit built under the old plan, a build not begun
//   (build-entry.cjs).
// - It shows every checklist item skipped on the way, with its reason,
//   read from the unit's manifest (6.4.5, 6.4.12); then asks, one at a
//   time, the verdict of each departure this machine logged in the build
//   and the review phase — the person's answer at `{unit}.implementation`
//   or `{unit}.review` standing over Claude's lean — given at the verdict
//   point `finish` (16.10.3, ledger-verdicts.cjs); then invites questions
//   about what was built, answered before finishing (14.5.1); and what the
//   review's put backs set aside, where they set aside anything, said to
//   stay until the person removes it. What its
//   reads warned of — a knowledge base set up that does not read among it
//   (finish-checks.cjs) — is said on the screen, and on the yes's answer.
// - The yes stands on the screen as drawn: the close it shows and no
//   verdict still to ask. It lands every phase still standing (`land
//   finish`, landing.cjs) — the review phase's fix phases, numbered past
//   the cut, after every other (7.2.6) — a refusal there leaving the unit
//   as it was, with its way on; then completes the unit
//   (workunit-lifecycle.cjs). It answers where the work goes (24.1.2), a
//   handoff each: an epic's menu, its review completed; the start menu,
//   `/leeway`, for every other type.
// ---------------------------------------------------------------------------

const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { readShown } = require('./ledger-read.cjs');
const { verdictAsked } = require('./ledger-verdicts.cjs');
const { itemTitle, topicTitles, buildRefusal } = require('./derivations.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { finishClose } = require('./checklist.cjs');
const { landFinish } = require('./landing.cjs');
const { completeWorkUnit } = require('./workunit-lifecycle.cjs');
const { refusing, stands } = require('./staged-payload.cjs');
const { READERS, readersDone } = require('./scratch.cjs');
const { finishScreen } = require('./projections/finish.cjs');
const { setAsideHeld } = require('./review-phase.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */

const FINISH_USAGE = 'finish yes <work-unit>';

/**
 * The close the screen stands on, refused where finish cannot show: the
 * unit's own refusals, then its checklist's close (`finishClose`).
 * @param {string} cwd @param {string} unit
 */
function finishStanding(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  const refused = buildRefusal(manifest);
  if (refused !== null) throw new Error(refused);
  return { manifest, ...finishClose(cwd, unit) };
}

/** Whether finish's screen draws, as `render finish` stands on it: what the board lists waiting on the person. @param {string} cwd @param {string} unit */
const finishDraws = (cwd, unit) => stands(() => finishStanding(cwd, unit));

/**
 * What the screen and the yes stand on, refused where finish cannot show:
 * the unit's manifest, the skips its close shows, and the verdict asked of
 * the first departure in the build still owed one.
 * @param {string} cwd @param {string} unit
 */
function standing(cwd, unit) {
  const { manifest, closed, skips, warnings } = finishStanding(cwd, unit);
  const root = stateRoot(cwd);
  try {
    const verdict = readShown(root, warnings, (shower) => verdictAsked(shower, root, (facts) => (facts.unit === unit && BUILD_PHASES.includes(facts.phase) ? closed : null)));
    return { manifest, skips, warnings, verdict };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `render finish <unit>`: the screen.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function finishSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render finish', () => {
    const { manifest, skips, verdict, warnings } = standing(cwd, unit);
    return finishScreen({
      unit,
      title: itemTitle(topicTitles(manifest), 'review', unit),
      skips: skips.map(({ checklist, text, reason }) => ({ checklist, text, reason })),
      verdict,
      warnings,
      aside: setAsideHeld(cwd, unit),
    });
  });
}

/** Where the work goes once the unit is finished (24.1.2): an epic's menu, its review completed; else the start menu. @param {Record<string, any>} manifest @returns {Next} */
function nextAfterFinish(manifest) {
  return manifest.work_type === 'epic' ? { kind: 'handoff', skill: 'leeway-continue-epic', args: [manifest.name, 'review', 'completed'] } : { kind: 'handoff', skill: 'leeway', args: [] };
}

/**
 * Every phase still standing landed, refused while a verdict waits, a
 * refusal carrying what finish's standing warned.
 * @param {string} cwd @param {string} unit @param {{verdict: unknown, warnings: string[]}} standing
 */
function landStanding(cwd, unit, { verdict, warnings }) {
  try {
    if (verdict !== null) throw new Error('a verdict is still to ask — render finish asks each before the yes');
    return landFinish(cwd, unit);
  } catch (err) {
    throw carrying(err, warnings);
  }
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
  const result = { unit, landed: landed.repos, completed_at: completed.completed_at, committed: completed.committed, next: nextAfterFinish(manifest) };
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

module.exports = { FINISH_USAGE, finishSurface, finishDraws, runFinishVerb };
