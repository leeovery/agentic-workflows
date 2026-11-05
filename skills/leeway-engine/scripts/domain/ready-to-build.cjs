'use strict';

// ---------------------------------------------------------------------------
// Domain ring: ready to build (11.8), the spec's gate — the screen, `render
// ready-to-build <unit> [--page] [--calls]`; the person's pick, `ready-to-build
// yes <unit> --position auto|step [--marks <file>]`, which concludes the spec
// and begins the build; and the build's position switched after it,
// `workunit position <unit> auto|step` (3.3.6). Its screen is drawn by
// projections/ready-to-build.cjs.
//
// - The screen stands on the landed spec alone (spec-landed.cjs), refused
//   while `spec.md` holds changes that have not landed. It shows once ready
//   to build's checklist is closed and nothing has landed or been cut since,
//   every engine item holding still (checklist.cjs, E12). It refuses a unit
//   `enter specification` refuses (spec-entry.cjs) — one the project lacks,
//   one not in progress, a quick-fix, a unit of a retired type, topics not
//   settled; a unit keeping the old spec's items, which never reaches this
//   gate, the migration's cut for built units carrying it across (29.17);
//   and a unit whose build has begun, the gate raised once per spec
//   (11.8.1).
// - It shows the short outline, the landed spec's areas; the phase cut, read
//   from the manifest (11.S31); Claude's calls at the spec — the current
//   decisions of Claude's made there — counted by kind; and every checklist
//   item skipped. Each departure the person made among the spec's gap
//   answers that this machine logged is asked its verdict there, one at a
//   time, until each has one (16.10.11); then the gate offers the build's
//   position, auto first and recommended, nothing preselected (3.3.9), the
//   review page where the session can publish one (`--page`, 11.11.11), the
//   calls, and a comment. While the review page is open (spec-review.cjs)
//   its foot counts, by the marks last stored, the lines the person ticked,
//   those carrying Claude's tick they let stand, and those passing without
//   review (11.11.7); its review row reads the comments, and its picks take
//   the marks read back into `.cache/{unit}/specification/read-back.json`.
// - The yes stands on the screen as drawn: the close it shows and no
//   verdict still to ask. While the page is open it takes the page's marks,
//   read back fresh — nothing on the page reaches Claude by itself (11.11.5)
//   — and settles the review on them in one call (`settleReview`), storing
//   them first: a comment waiting for Claude refuses the yes, listing each,
//   the marks staying stored (11.11.8); else the review's record is written.
//   With no page open it takes no marks and writes no record (11.S22). Then
//   it writes `build: {position}` on the unit's manifest — the first pick of
//   the position, its record the gate's answer (E14) — concluding the spec
//   (P7), and commits the manifest with the record, if any, a failed commit
//   retried in the unit's scope, which holds both. Its `next` hands off
//   into the build, whatever the unit's type (24.1.2).
// - A switch of position is stated intent (3.3.7): `workunit position`
//   writes the build's new position and logs a `position-switch` event in
//   the trust log, and commits the manifest. It refuses a unit whose build
//   has not begun — its position is chosen at ready to build — and a switch
//   to the position the build is in.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { BUILD_POSITIONS } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { claudesCall } = require('./ledger-events.cjs');
const { isCurrent } = require('./ledger-fold.cjs');
const { readShown } = require('./ledger-read.cjs');
const { verdictAsked } = require('./ledger-verdicts.cjs');
const { buildBegun, itemTitle, phaseItems, topicTitles, cutPhases } = require('./derivations.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { knownUnit, noUnit, unitClosure } = require('./topic-standing.cjs');
const { specEntryRefusal } = require('./spec-entry.cjs');
const { specReading } = require('./spec-sections.cjs');
const { readyClose } = require('./checklist.cjs');
const { pageOpen, readBackFile, reviewStates, settleReview } = require('./spec-review.cjs');
const { handedTag } = require('./topic-map.cjs');
const { record } = require('./trust-log.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { refusing, stands } = require('./staged-payload.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { readyToBuildScreen } = require('./projections/ready-to-build.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./projections/ready-to-build.cjs').ReadyView} ReadyView */
/** @typedef {import('./spec-review.cjs').Waiting} Waiting */
/** @typedef {(typeof BUILD_POSITIONS)[number]} Position */

const PHASE = 'specification';

const READY_TO_BUILD_USAGE = 'ready-to-build yes <work-unit> --position auto|step [--marks <file>]';
const POSITION_USAGE = 'workunit position <work-unit> auto|step';

/**
 * Why ready to build cannot show for the unit before its checklist is read,
 * or null: a unit its spec's entry refuses, one keeping the old spec's
 * items, or one whose build has begun.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function unitRefusal(cwd, unit) {
  const entry = specEntryRefusal(cwd, unit);
  if (entry !== null) return entry;
  const manifest = /** @type {Record<string, any>} */ (manifestOf(stateRoot(cwd), unit));
  if (phaseItems(manifest, PHASE).length > 0) {
    return `${unit} keeps its spec in the old form, which never comes to ready to build — the migration's cut for built units carries it across (29.17)`;
  }
  return buildBegun(manifest)
    ? `ready to build has passed for ${unit} — its build began in ${manifest.build.position}, and its position switches through workunit position ${unit} auto|step`
    : null;
}

/**
 * Claude's calls at the spec: the current decisions of Claude's made there,
 * each with the question it answers.
 * @param {Shower} shower @param {string} unit
 * @returns {import('./projections/closing.cjs').ShownCall[]}
 */
function callsAtSpec(shower, unit) {
  const { folded } = shower;
  return [...folded.facts].flatMap(([id, facts]) => {
    if (facts.kind !== 'decision' || facts.unit !== unit || facts.phase !== PHASE || !claudesCall(facts) || !isCurrent(folded, id)) return [];
    const shown = shower.show(id);
    return [{
      question: facts.answers === null ? null : /** @type {string} */ (shower.show(facts.answers).text),
      answer: /** @type {string} */ (shown.text),
      kind: /** @type {string|null} */ (shown.kind ?? null),
      handed: handedTag({ given: facts.given ?? undefined }),
    }];
  });
}

/**
 * The close the screen stands on, refused where ready to build cannot show:
 * the unit's own refusals, then its checklist's close (`readyClose`).
 * @param {string} cwd @param {string} unit
 */
function readyStanding(cwd, unit) {
  const refused = unitRefusal(cwd, unit);
  if (refused !== null) throw new Error(refused);
  return readyClose(cwd, unit);
}

/** Whether ready to build's screen draws, as `render ready-to-build` stands on it: what the board lists waiting on the person's yes. @param {string} cwd @param {string} unit */
const readyDraws = (cwd, unit) => stands(() => readyStanding(cwd, unit));

/**
 * What the screen and the yes stand on, refused where ready to build
 * cannot show: the unit's manifest, its checklist's close and skips, the
 * landed spec the close seals, and, read in one pass of the ledger, Claude's
 * calls at the spec and the verdict asked.
 * @param {string} cwd @param {string} unit
 */
function standing(cwd, unit) {
  const { closed, skips, warnings, landed } = readyStanding(cwd, unit);
  const root = stateRoot(cwd);
  try {
    const read = readShown(root, warnings, (shower) => ({
      calls: callsAtSpec(shower, unit),
      verdict: verdictAsked(shower, root, (facts) => facts.unit === unit && facts.phase === PHASE, closed),
    }));
    return { manifest: loadWorkUnitManifest(cwd, unit), skips, warnings, landed, ...read };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * The open review page's counts by the marks last stored: the lines ticked,
 * those carrying Claude's tick let stand, and the rest of the spec's.
 * @param {string} cwd @param {string} unit @returns {ReadyView['review']}
 */
function reviewCounts(cwd, unit) {
  const held = reviewStates(cwd, unit).filter(({ state }) => state !== 'removed');
  const ticked = held.filter(({ state }) => state === 'approved' || state === 'approved-after-comment').length;
  const claudes = held.filter(({ state }) => state === 'claudes-tick').length;
  return { ticked, claudes, other: held.length - ticked - claudes };
}

/**
 * `render ready-to-build <unit> [--page] [--calls]`: the screen, the review
 * row offered with `--page`, Claude's calls listed with `--calls`.
 * @param {string} cwd @param {{dotpath?: string, page?: string, calls?: string}} args
 * @returns {string}
 */
function readyToBuildSurface(cwd, { dotpath: unit = '', page, calls }) {
  return refusing('render ready-to-build', () => {
    const ready = standing(cwd, unit);
    const { headings } = specReading(ready.landed);
    const open = pageOpen(cwd, unit);
    return readyToBuildScreen({
      unit,
      title: itemTitle(topicTitles(ready.manifest), 'specification', unit),
      calls: ready.calls,
      listed: calls !== undefined,
      outline: headings.filter(({ kind }) => kind === 'area').map(({ number, title }) => ({ number: /** @type {string} */ (number), title })),
      phases: cutPhases(ready.manifest).map((/** @type {any} */ { name, scenarios, sections }) => ({ name, scenarios: scenarios.length, sections })),
      skips: ready.skips.map(({ text, reason }) => ({ text, reason })),
      verdict: ready.verdict,
      page: page !== undefined,
      review: open ? reviewCounts(cwd, unit) : null,
      readBack: readBackFile(cwd, unit),
    });
  });
}

/** A comment waiting for Claude as the yes's refusal lists it: its line, and the person's last word. @param {Waiting} waiting */
function waitingLine({ number, conversation }) {
  return `  ${number}: "${/** @type {{text: string}} */ (conversation.at(-1)).text}"`;
}

/**
 * Where the work goes once the build has begun: into the build (24.1.2).
 * @param {Record<string, any>} manifest @returns {import('./projections/surfaces.cjs').Next}
 */
function nextAfterYes(manifest) {
  return { kind: 'handoff', skill: phaseSkill('implementation'), args: [manifest.work_type, manifest.name] };
}

/**
 * `ready-to-build yes <unit> --position auto|step [--marks <file>]`: the
 * person's pick, concluding the spec and beginning the build in the
 * position picked.
 * @param {string} cwd @param {string} unit @param {string} position @param {string} [marks] absolute or from cwd
 */
function readyToBuildYes(cwd, unit, position, marks) {
  const ready = standing(cwd, unit);
  if (ready.verdict !== null) throw new Error('a verdict is still to ask — render ready-to-build asks each before the yes');
  if (marks !== undefined && !pageOpen(cwd, unit)) throw new Error(`${unit}'s review page is not open, so the yes takes no marks — the build starts with no review recorded`);
  const settled = settleReview(cwd, unit, marks);
  if (settled.waiting.length > 0) {
    throw new Error(`a comment on the review page waits for Claude, so the build does not start — Claude answers each beneath its line, then shows ready to build again:\n${settled.waiting.map(waitingLine).join('\n')}`);
  }
  const manifest = withWorkUnitLock(cwd, unit, () => {
    const fresh = loadWorkUnitManifest(cwd, unit);
    fresh.build = { position };
    saveWorkUnitManifest(cwd, unit, fresh);
    return fresh;
  });
  const { warnings } = ready;
  const outcome = commitStateTail(cwd, [`${unit}/manifest.json`, ...(settled.record === null ? [] : [settled.record])], `ready-to-build(${unit}): ${position}`, warnings);
  /** @type {Record<string, unknown>} */
  const result = { unit, position, record: settled.record, committed: outcome.committed, next: nextAfterYes(manifest) };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, unit);
  return result;
}

/**
 * `workunit position <unit> auto|step`: the build's position switched, as
 * the person stated it.
 * @param {string} cwd @param {string} unit @param {Position} to
 */
function switchPosition(cwd, unit, to) {
  const known = knownUnit(cwd, unit);
  if (known === null) throw new Error(noUnit(unit));
  const closure = unitClosure(known);
  if (closure !== null) throw new Error(closure);
  if (!buildBegun(known)) throw new Error(`${unit}'s build has not begun — its position is chosen at ready to build`);
  if (known.build.position === to) throw new Error(`${unit}'s build is in ${to} already`);
  withWorkUnitLock(cwd, unit, () => {
    const fresh = loadWorkUnitManifest(cwd, unit);
    fresh.build.position = to;
    saveWorkUnitManifest(cwd, unit, fresh);
  });
  /** @type {string[]} */
  const warnings = [];
  record('position-switch', { unit, to }, { cwd, warnings });
  const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `build(${unit}): position ${to}`, warnings);
  /** @type {Record<string, unknown>} */
  const result = { unit, position: to, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/** The position named, refused where it is none of the build's. @param {string|undefined} given @param {string} usage @returns {Position} */
function positionOf(given, usage) {
  if (!BUILD_POSITIONS.includes(/** @type {Position} */ (given))) throw new Error(`Usage: engine ${usage} — the position is ${BUILD_POSITIONS.join(' or ')}`);
  return /** @type {Position} */ (given);
}

/**
 * `ready-to-build yes …`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runReadyToBuildVerb(cwd, [verb, ...args], opts) {
  const flags = Object.keys(opts).filter((flag) => flag !== 'marks').join();
  if (verb !== 'yes' || args.length !== 1 || flags !== 'position') throw new Error(`Usage: engine ${READY_TO_BUILD_USAGE}`);
  const position = positionOf(opts.position, READY_TO_BUILD_USAGE);
  return refusing('ready-to-build yes', () => readyToBuildYes(cwd, args[0], position, opts.marks));
}

/**
 * `workunit position <unit> auto|step`: the verb's answer, its refusal
 * opening on its command.
 * @param {string} cwd @param {string[]} args
 * @returns {Record<string, unknown>}
 */
function runPositionVerb(cwd, args) {
  if (args.length !== 2) throw new Error(`Usage: engine ${POSITION_USAGE}`);
  const to = positionOf(args[1], POSITION_USAGE);
  return refusing('workunit position', () => switchPosition(cwd, args[0], to));
}

module.exports = { READY_TO_BUILD_USAGE, POSITION_USAGE, readyToBuildSurface, readyDraws, runReadyToBuildVerb, runPositionVerb };
