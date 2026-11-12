'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a bugfix investigation's close (19.4.23) — its conclude gate,
// `render conclude <bugfix> [--file <recap.json>]`, a learned process gate
// (19.4.19) drawn by projections/investigation.cjs, and its yes,
// `investigation conclude <bugfix>`, which closes the investigation and hands
// the work into its spec (24.1.2).
//
// - Both stand once the investigation can close, each refusal naming the way
//   on: a place whose investigation can take work and has started
//   (investigation-log.cjs, `openInvestigation`); the log's root cause and
//   its fix each resting on one of the unit's current entries, the fix the
//   answer of the fix direction's question (`huntEntries`); both validations
//   run and taken in since what each validates was made — the root cause's
//   since the root cause, the fix's since the fix and the root cause it is
//   checked against (26.4.10) — so either replaced since is validated again
//   (19.4.7, agent-state.cjs `validationFor`), one dispatched since and not
//   yet taken in named by where it stands, never dispatched again; no
//   question of the person's open at the place, no row of its map standing
//   open; and no mail waiting in the topic's mailbox.
// - A move of the bugfix to a feature (workunit-move.cjs) waits on the root
//   cause's validation as the conclude does, so the feature never starts
//   from a cause its validator would have broken (`assertMovable`): one
//   still running is what the move waits for.
// - Claude's recap of the hunt, `{"hunt": "<one paragraph>", "fixes"?,
//   "area"?}`, is staged in the topic's cache with `--file`, against the
//   root cause and the fix as they stand, and when it was staged; the
//   screen draws from it again without `--file`, refused where nothing is
//   staged, or it was staged before the root cause or the fix changed. The
//   screen shows the recap, the symptoms in the person's words from the
//   log, the root cause told against them and the fix direction (19.4.23);
//   each departure the person made in the investigation that this machine
//   logged is asked its verdict there first, one at a time — `verdict give
//   … --at conclusion` — none asked where none was made (16.10.5,
//   16.10.11); then the conclude gate: yes, keep going, and a comment. The
//   gate is drawn as the decision point steps it (investigation.cjs): run as
//   an automatic step, on its yes, no verdict is asked there, each waiting
//   in the verdict queue (16.10.11). Its
//   DATA names the areas this project's bugfixes have recorded, each as
//   first spelt (bug-records.cjs), so Claude names an area alike. While
//   the screen stands on what is staged, its yes waits on the person, as
//   the board lists it (`concludeDraws`).
// - What the bug is in, for the bugs found after review (17.1.6, 17.1.9),
//   is the recap's, drawn on no line of the screen (17.2.2): `fixes`, the
//   unit whose code it fixes — a unit of the project but this one — left
//   out where no unit built that code; and `area`, the area of the verify
//   setup's feature map it sits in, only where a verify setup is recorded.
//   The map is the product's, in its own words, so the area is Claude's
//   reading of it, one line of words, never checked against the map.
// - The yes stands on the screen as drawn: what is staged was staged
//   against the root cause and the fix as they stand, what the bug is in
//   still holds, and no verdict is still to ask — unless the gate runs as an
//   automatic step, the decision point asked again. Then, under the writer
//   lock, in one manifest save, it completes the investigation's item and
//   stamps its close, `concluded_at`, the instant (P2) — what the board
//   dates the investigation by, its standing read from the item as every
//   phase's is — with what the bug is in, as staged, none kept from an
//   earlier close: `fixes` and `area` where named and, with `fixes`,
//   `after_review`, whether that unit's review phase had ended — a round of
//   its passed or settled (14.6.3) — judged at the first conclude naming
//   that unit, the moment the bug was found: a later conclude naming the
//   same unit keeps it, one naming another unit judges it afresh, and one
//   naming none drops it with `fixes`. What the bug is in is checked again
//   here, a refusal naming the restage. It commits it, the log riding
//   along; the staged recap goes. It answers `next`, the handoff into the
//   spec.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, listWorkUnitManifests } = require('../kernel/manifest.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { mapOf } = require('./ledger-fold.cjs');
const { readShown } = require('./ledger-read.cjs');
const { verdictAsked } = require('./ledger-verdicts.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { mailboxDepth, topicTitle } = require('./derivations.cjs');
const { validationFor } = require('./agent-state.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { verifySetup } = require('./environment.cjs');
const { recordedRounds, endsReview } = require('./review-phase.cjs');
const { byName, bugRecords, areaSpellings } = require('./bug-records.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { huntOf, huntEntries, openInvestigation } = require('./investigation-log.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { filled, shaped, readPayload, stage, stagedAt, refusing, stands } = require('./staged-payload.cjs');
const { concludeScreen } = require('./projections/investigation.cjs');
const { investigationStep } = require('./investigation.cjs');

/** @typedef {import('./investigation-log.cjs').Rested} Rested */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */

const PHASE = 'investigation';
const CONCLUDE_USAGE = 'investigation conclude <bugfix>';
const SURFACE_USAGE = 'render conclude <bugfix> [--file <recap.json>]';

/**
 * What the bug is in: the unit whose code it fixes, and the feature map's
 * area, each where named.
 * @typedef {{fixes?: string, area?: string}} BugIn
 */

/**
 * Claude's recap as staged: when, the recap, what the bug is in, and the
 * root cause and the fix it was drawn against, by full id.
 * @typedef {{at: string, hunt: string, root_cause: string, fix: string} & BugIn} Staged
 */

/** Where the recap is staged, in the topic's cache. @param {string} cwd @param {string} unit */
const stagedFile = (cwd, unit) => statePath(cwd, '.cache', unit, PHASE, unit, 'conclude.json');

/**
 * Each validation, the entry of the hunt it validates, the entries it is
 * taken in since — the fix's checked against the root cause it rests on, so
 * a root cause replaced voids it (26.4.10) — and how a refusal names them.
 * @type {ReadonlyArray<{kind: string, of: 'rootCause'|'fix', since: ReadonlyArray<'rootCause'|'fix'>, what: string, logged: string}>}
 */
const VALIDATIONS = Object.freeze([
  { kind: 'root-cause-validation', of: 'rootCause', since: ['rootCause'], what: 'root cause', logged: 'it was logged' },
  { kind: 'fix-validation', of: 'fix', since: ['rootCause', 'fix'], what: 'fix', logged: 'it, or the root cause it rests on, was logged' },
]);

/**
 * A validation dispatched and still to be taken in, said as its way on by
 * where it stands, `waiter` what waits on it.
 * @type {Readonly<Record<string, (unit: string, id: string, waiter: string) => string>>}
 */
const WAITING = Object.freeze({
  running: (unit, id, waiter) => `${id} is still running — ${waiter} waits for its report`,
  lost: (unit, id) => `${id} was lost with the process that dispatched it — engine agent incorporate ${unit} ${PHASE} ${unit} ${id} abandons it, and another is dispatched`,
  landed: (unit, id) => `${id}'s report is in — engine agent scan ${unit} ${PHASE} ${unit} reads it in, then engine agent ack ${unit} ${PHASE} ${unit} ${id} with its findings, or --clean`,
  pending: (unit, id) => `${id}'s report is in — engine agent ack ${unit} ${PHASE} ${unit} ${id} with its findings, or --clean`,
  acknowledged: (unit, id) => `${id}'s findings are acknowledged — once each is acted on, engine agent incorporate ${unit} ${PHASE} ${unit} ${id} takes it in`,
});

/** An entry the hunt rests on, refused where it rests on none. @template {Rested} T @param {T|{fault: string}} entry @returns {T} */
function rested(entry) {
  if ('fault' in entry) throw new Error(entry.fault);
  return entry;
}

/**
 * Where a validation stands since the entries it rests on were made, as
 * `validationFor` reads it (agent-state.cjs); the board reads it alike.
 * @param {string} cwd @param {string} unit @param {UnitView['folded']} folded
 * @param {(typeof VALIDATIONS)[number]} validation @param {Partial<Record<'rootCause'|'fix', Rested>>} rests each entry it rests on
 */
function validationSince(cwd, unit, folded, { kind, since }, rests) {
  const line = Math.max(...since.map((at) => folded.facts.get(/** @type {Rested} */ (rests[at]).id)?.place.number ?? Infinity));
  return validationFor(cwd, unit, kind, folded.facts, line);
}

/**
 * The validation not yet taken in since the entries it rests on were made,
 * refused with the way on: the one dispatched since, by where it stands —
 * one still running named as what `waiter` waits for — or, where none was,
 * its dispatch, its brief and its report taken in.
 * @param {string} cwd @param {string} unit @param {UnitView} view
 * @param {(typeof VALIDATIONS)[number]} validation @param {Partial<Record<'rootCause'|'fix', Rested>>} rests each entry it rests on
 * @param {string} [waiter]
 */
function assertValidated(cwd, unit, { folded }, validation, rests, waiter = 'the conclude') {
  const { kind, of, what, logged } = validation;
  const standing = validationSince(cwd, unit, folded, validation, rests);
  if (standing?.stands === 'taken-in') return;
  const named = `the ${what} ${/** @type {Rested} */ (rests[of]).short}`;
  if (standing !== null) throw new Error(`${named} is being validated — ${WAITING[standing.stands](unit, standing.id, waiter)}`);
  throw new Error(`${named} has not been validated since ${logged} — both validations always run: engine agent dispatch ${unit} ${PHASE} ${unit} --kind ${kind}, its brief engine brief ${kind} ${unit} --agent <id>, and its report taken in`);
}

/** Refused while a question of the person's is open at the place. @param {string} unit @param {UnitView} view */
function assertQuestionsClosed(unit, { folded, entries, short }) {
  const open = mapOf(folded, unit, unit).filter(({ stands }) => stands === 'open');
  if (open.length === 0) return;
  const listed = open.map(({ id }) => `${short(id)} "${String(entries.get(id)?.line.text ?? '').replace(/\s+/g, ' ').trim()}"`).join(', ');
  throw new Error(`a question of the person's is open at the investigation — ${listed} — each is answered before it concludes`);
}

/**
 * Refuses a bugfix's move to a feature while the root cause logged has no
 * validation taken in since it was — one out, its report not taken in, or
 * none dispatched — so the feature never starts from a cause its validator
 * would have broken (19.4.7); none where no root cause is logged. What the
 * ledger's read said is pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 */
function assertMovable(cwd, unit, warnings) {
  const hunt = huntOf(cwd, unit, warnings);
  withUnitEntries(cwd, unit, warnings, (view) => {
    const { rootCause } = huntEntries(unit, view, hunt);
    if ('fault' in rootCause) return;
    try {
      assertValidated(cwd, unit, view, VALIDATIONS[0], { rootCause }, 'the move');
    } catch (err) {
      throw new Error(`${unit} moves to a feature once its root cause's validation is taken in, and ${messageOf(err)}`);
    }
  });
}

/**
 * What the conclude stands on, refused where the investigation cannot
 * close: its manifest, the hunt, and the root cause and the fix it rests
 * on; what the ledger's read said pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {string} said @param {string[]} warnings
 */
function closing(cwd, unit, said, warnings) {
  const manifest = openInvestigation(cwd, unit, said);
  const hunt = huntOf(cwd, unit, warnings);
  return withUnitEntries(cwd, unit, warnings, (view) => {
    const entries = huntEntries(unit, view, hunt);
    const rests = { rootCause: rested(entries.rootCause), fix: rested(entries.fix) };
    for (const validation of VALIDATIONS) assertValidated(cwd, unit, view, validation, rests);
    assertQuestionsClosed(unit, view);
    const waiting = mailboxDepth(stateRoot(cwd), unit, unit);
    if (waiting > 0) throw new Error(`${waiting} message(s) wait in its mailbox — raise and answer each first: engine topic mailbox ${unit} ${unit}`);
    return { manifest, hunt, ...rests };
  });
}

/**
 * The departure in the investigation still to be asked its verdict at this
 * close, staged at `at`, or null.
 * @param {string} cwd @param {string} unit @param {string} at @param {string[]} warnings
 */
function verdictOf(cwd, unit, at, warnings) {
  const root = stateRoot(cwd);
  return readShown(root, warnings, (shower) => verdictAsked(shower, root, (facts) => (facts.unit === unit && facts.phase === PHASE ? at : null)));
}

/**
 * The recap staged for the conclude, refused where none is or it was drawn
 * before the root cause or the fix changed.
 * @param {string} cwd @param {string} unit @param {Rested} rootCause @param {Rested} fix @returns {Staged}
 */
function stagedFor(cwd, unit, rootCause, fix) {
  const staged = /** @type {Staged} */ (stagedAt(stagedFile(cwd, unit), `nothing is staged for ${unit}'s conclude — engine render conclude ${unit} --file <recap.json> stages Claude's recap`));
  if (staged.root_cause !== rootCause.id || staged.fix !== fix.id) throw new Error(`the conclude was drawn before the root cause or the fix changed — it is staged again with engine render conclude ${unit} --file <recap.json>`);
  return staged;
}

/**
 * Whether the conclude's yes waits on the person, as `render conclude`
 * stands on it: its recap staged against the root cause and the fix as
 * they stand, the investigation able to close — what the board lists
 * waiting on the person.
 * @param {string} cwd @param {string} unit
 */
function concludeDraws(cwd, unit) {
  if (!fs.existsSync(stagedFile(cwd, unit))) return false;
  return stands(() => {
    const { rootCause, fix } = closing(cwd, unit, 'render conclude', []);
    stagedFor(cwd, unit, rootCause, fix);
  });
}

/** Whether a value is one line of words. @param {unknown} value @returns {value is string} */
const oneLine = (value) => filled(value) && !/[\r\n]/.test(value);

/**
 * What the bug is in, refused where the bugfix cannot record it: a unit the
 * project lacks, or this one; an area where no verify setup is recorded, or
 * past one line of words.
 * @param {string} cwd @param {string} unit @param {Record<string, unknown>} given @returns {BugIn}
 */
function bugIn(cwd, unit, { fixes, area }) {
  if (fixes !== undefined) {
    if (typeof fixes !== 'string' || workUnitNameRefusal(fixes) !== null || manifestOf(stateRoot(cwd), fixes) === null) {
      throw new Error(`there is no work unit "${fixes}" to fix — the recap's fixes names the unit whose code the bug is in, left out where no unit built it`);
    }
    if (fixes === unit) throw new Error(`${unit} cannot fix its own code — the recap's fixes names the unit whose code the bug is in`);
  }
  if (area !== undefined) {
    if (!oneLine(area)) throw new Error('the area is one line of words, an area of the verify setup\'s feature map');
    if (verifySetup(cwd) === null) throw new Error('no verify setup is recorded, so no feature map names an area — leave the area out');
  }
  return {
    ...(fixes === undefined ? {} : { fixes: /** @type {string} */ (fixes) }),
    ...(area === undefined ? {} : { area: /** @type {string} */ (area).trim() }),
  };
}

/**
 * Claude's recap read from `file`, refused out of its shape.
 * @param {string} cwd @param {string} unit @param {string} file @returns {{hunt: string} & BugIn}
 */
function recapOf(cwd, unit, file) {
  const { hunt, ...rest } = shaped(readPayload(cwd, file), 'the recap', ['hunt'], ['fixes', 'area']);
  if (!oneLine(hunt)) throw new Error('the recap\'s hunt is one paragraph of words, not empty');
  return { hunt: hunt.trim(), ...bugIn(cwd, unit, rest) };
}

/** The areas this project's bugfixes have recorded, each as first spelt. @param {string} cwd */
const recordedAreas = (cwd) => [...areaSpellings(bugRecords(listWorkUnitManifests(cwd))).values()].sort(byName);

/**
 * What the staged recap says the bug is in, as the yes checks it again,
 * a refusal naming the restage.
 * @param {string} cwd @param {string} unit @param {Staged} staged @returns {BugIn}
 */
function stagedBug(cwd, unit, staged) {
  try {
    return bugIn(cwd, unit, staged);
  } catch (err) {
    throw new Error(`${messageOf(err)} — engine render conclude ${unit} --file <recap.json> stages it again`);
  }
}

/**
 * What the yes keeps of the bug: what the recap named, and with a unit,
 * whether its review phase had ended when the bug was found — kept from the
 * earlier close where that named the same unit, else judged now.
 * @param {string} cwd @param {BugIn} bug @param {Record<string, unknown>} earlier the item as the last close left it
 */
function kept(cwd, bug, earlier) {
  if (bug.fixes === undefined) return bug;
  const after = earlier.fixes === bug.fixes && typeof earlier.after_review === 'boolean' ? earlier.after_review : recordedRounds(cwd, bug.fixes).some(endsReview);
  return { ...bug, after_review: after };
}

/**
 * The decision point's step on the conclude gate, a learned one (19.4.19),
 * on the showing its recap staged at `stagedAt` tells.
 * @param {string} cwd @param {string} unit @param {string} stagedAt
 */
const concludeStep = (cwd, unit, stagedAt) => investigationStep(cwd, unit, 'conclude gate', stagedAt);

/**
 * `render conclude <bugfix> [--file <recap.json>]`: the conclude, Claude's
 * recap staged from `--file` or read back as staged.
 * @param {string} cwd @param {{dotpath?: string, file?: string}} args @returns {string}
 */
function concludeSurface(cwd, { dotpath: unit = '', file }) {
  return refusing('render conclude', () => {
    if (unit === '') throw new Error(`Usage: engine ${SURFACE_USAGE}`);
    /** @type {string[]} */
    const warnings = [];
    try {
      const { manifest, hunt, rootCause, fix } = closing(cwd, unit, 'render conclude', warnings);
      const staged = file === undefined
        ? stagedFor(cwd, unit, rootCause, fix)
        : stage(stagedFile(cwd, unit), { at: new Date().toISOString(), ...recapOf(cwd, unit, file), root_cause: rootCause.id, fix: fix.id });
      const step = concludeStep(cwd, unit, staged.at);
      return concludeScreen({
        unit,
        title: topicTitle(manifest, unit),
        hunt: staged.hunt,
        symptoms: hunt.symptoms.map(({ text }) => text),
        rootCause: rootCause.text,
        fix: fix.text,
        verdict: step.step === 'automatic' ? null : verdictOf(cwd, unit, staged.at, warnings),
        areas: recordedAreas(cwd),
      }, step);
    } catch (err) {
      throw carrying(err, warnings);
    }
  });
}

/**
 * `investigation conclude <bugfix>`: the conclude gate's yes, closing the
 * investigation, keeping what the bug is in, and handing the work into its
 * spec.
 * @param {string} cwd @param {string} unit
 */
function concludeInvestigation(cwd, unit) {
  /** @type {string[]} */
  const warnings = [];
  const concludedAt = new Date().toISOString();
  try {
    const { rootCause, fix } = closing(cwd, unit, 'investigation conclude', warnings);
    const staged = stagedFor(cwd, unit, rootCause, fix);
    const bug = stagedBug(cwd, unit, staged);
    if (verdictOf(cwd, unit, staged.at, warnings) !== null && concludeStep(cwd, unit, staged.at).step !== 'automatic') {
      throw new Error(`a verdict is still to ask — engine render conclude ${unit} asks each before the yes`);
    }
    const manifest = withWorkUnitLock(cwd, unit, () => {
      const fresh = loadWorkUnitManifest(cwd, unit);
      const item = fresh.phases[PHASE].items[unit];
      const record = kept(cwd, bug, item);
      for (const field of ['fixes', 'area', 'after_review']) delete item[field];
      Object.assign(item, { status: 'completed', concluded_at: concludedAt, ...record });
      saveWorkUnitManifest(cwd, unit, fresh);
      return fresh;
    });
    fs.rmSync(stagedFile(cwd, unit), { force: true });
    const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `investigation(${unit}): conclude`, warnings);
    /** @type {Record<string, unknown>} */
    const result = {
      unit, concluded_at: concludedAt, committed: outcome.committed, next: { kind: 'handoff', skill: phaseSkill('specification'), args: [manifest.work_type, unit] },
    };
    if (warnings.length > 0) result.warnings = warnings;
    noteCommitOutcome(result, outcome, `${unit} --state`);
    return result;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `investigation conclude …`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runInvestigationVerb(cwd, [verb, ...args], opts) {
  if (verb !== 'conclude' || args.length !== 1 || Object.keys(opts).length > 0) throw new Error(`Usage: engine ${CONCLUDE_USAGE}`);
  return refusing('investigation conclude', () => concludeInvestigation(cwd, args[0]));
}

module.exports = { CONCLUDE_USAGE, VALIDATIONS, validationSince, assertMovable, concludeSurface, concludeDraws, runInvestigationVerb };
