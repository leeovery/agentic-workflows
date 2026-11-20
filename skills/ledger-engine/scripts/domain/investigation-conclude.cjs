'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a bugfix investigation's close (19.4.23), into its spec with
// no gate as a feature's discussion closes (11.2.1) — `investigation stage
// <bugfix> --file <recap.json>` — and its conclude at ready to build, one
// screen with the spec's (11.8.5, ready-to-build.cjs).
//
// - The close stands once the investigation can close, each refusal naming
//   the way on: a bugfix in progress whose investigation has started and not
//   concluded; the log's root cause and its fix each resting on one of the
//   unit's current entries, the fix the answer of the fix direction's
//   question (`huntEntries`); both validations run and taken in since what
//   each validates was made — the root cause's since the root cause, the
//   fix's since the fix and the root cause it is checked against (26.4.10)
//   — so either replaced since is validated again (19.4.7, agent-state.cjs
//   `validationFor`), one dispatched since and not yet taken in named by
//   where it stands, never dispatched again; no question of the person's
//   open at the place, no row of its map standing open; and no mail waiting
//   in the topic's mailbox.
// - A move of the bugfix to a feature (workunit-move.cjs) waits on the root
//   cause's validation as the close does, so the feature never starts from
//   a cause its validator would have broken (`assertMovable`): one still
//   running is what the move waits for.
// - Claude's recap of the hunt, `{"hunt": "<one paragraph>", "fixes"?,
//   "area"?}`, is kept with the close, marked in the checklist store as a
//   feature's decided close is, `checklists.conclusion.{unit}`: `closed`,
//   `voided?` and `taken?`, and the recap — the paragraph, the root cause
//   and the fix each by its full id, and what the bug is in — so a cancel,
//   which purges the cache, keeps it. Their words are the entries', which
//   never change, and the symptoms the log's, which nothing changes while
//   the close stands: a log write voids it, and the spec freezes the log.
//   The close is voided as the investigation goes on: a message delivered,
//   a question opened or an entry replaced at the investigation
//   (ledger-write.cjs), an entry put in the log (investigation-log.cjs), or
//   the investigation entered again (derivations.cjs, `voidTopicClose`) —
//   one voided while the spec's writer was out holds the spec it writes
//   back until it closes again (spec-standing.cjs). It is committed, and
//   answers the handoff into the spec.
// - Once the spec is written the investigation is frozen (spec-standing.cjs):
//   a change to the root cause or the fix is the spec's, replacing it at the
//   specification (11.8.5). Staged again then, the close is marked again with
//   no check of the hunt, as a feature's decided stage does: the root cause
//   and the fix are the unit's current entries the kept ones lead to, and it
//   carries on there to ready to build's screen. One that leads to another
//   unit's entry alone is refused, naming the replacement at the spec that
//   makes it the unit's again.
// - What the bug is in, for the bugs found after review (17.1.6, 17.1.9),
//   is the recap's, drawn on no line of the screen (17.2.2): `fixes`, the
//   unit whose code it fixes — a unit of the project but this one — left
//   out where no unit built that code; and `area`, the area of the verify
//   setup's feature map it sits in, only where a verify setup is recorded.
//   The map is the product's, in its own words, so the area is Claude's
//   reading of it, one line of words, never checked against the map, and
//   staged in the spelling the project's bugfixes first recorded it by
//   where one has (bug-records.cjs).
// - Ready to build stands on the close (`concludedClose`): the recap as
//   kept, refused where its root cause or its fix has been replaced since —
//   staged again, it is drawn again; it draws THE HUNT, Claude's recap, the
//   symptoms from the log, and the root cause told against them and the fix
//   direction in their entries' words, and asks each
//   departure the person made in the investigation that this machine logged
//   its verdict at the conclusion, one at a time (16.10.5, 16.10.11). Its
//   yes, checking what the bug is in again, a refusal naming the restage,
//   concludes the investigation in the manifest's one save
//   (`concludingYes`): it completes the investigation's item and stamps its
//   close, `concluded_at`, the instant (P2) — what the board dates the
//   investigation by — with what the bug is in, as staged, none kept from an
//   earlier conclude: `fixes` and `area` where named and, with `fixes`,
//   `after_review`, whether that unit's review phase had ended — a round of
//   its passed or settled (14.6.3) — judged at the first conclude naming
//   that unit, the moment the bug was found: a later conclude naming the
//   same unit keeps it, one naming another unit judges it afresh, and one
//   naming none drops it with `fixes`; and records the close as taken.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock, listWorkUnitManifests } = require('../kernel/manifest.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { mapOf, currentsOf } = require('./ledger-fold.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { mailboxDepth, itemOf, closedIntoSpec } = require('./derivations.cjs');
const { validationFor } = require('./agent-state.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { verifySetup } = require('./environment.cjs');
const { recordedRounds, endsReview } = require('./review-phase.cjs');
const { areaKey, bugRecords, areaSpellings } = require('./bug-records.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { huntOf, huntEntries, restedOn, standsNow } = require('./investigation-log.cjs');
const { unitInProgress, assertPhaseHeld } = require('./topic-standing.cjs');
const { specStanding } = require('./spec-standing.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { filled, shaped, readPayload, refusing } = require('./staged-payload.cjs');

/** @typedef {import('./investigation-log.cjs').Rested} Rested */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */
/** @typedef {import('./projections/investigation.cjs').RecapView} RecapView */

const PHASE = 'investigation';
const STAGE_USAGE = 'investigation stage <bugfix> --file <recap.json>';

/**
 * What the bug is in: the unit whose code it fixes, and the feature map's
 * area, each where named.
 * @typedef {{fixes?: string, area?: string}} BugIn
 */

/** What the recap was drawn on: the root cause and the fix, each by its full id. @typedef {{root_cause: string, fix: string}} DrawnOn */

/**
 * The close as the checklist store keeps it (the header's): when it was
 * marked, voided and taken, and Claude's recap with what it was drawn on.
 * @typedef {{closed: string, voided?: string, taken?: string, hunt: string} & DrawnOn & BugIn} Close
 */

/** The stage's call for the unit. @param {string} unit */
const stageCall = (unit) => `engine ${STAGE_USAGE.replace('<bugfix>', unit)}`;

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
function assertValidated(cwd, unit, { folded }, validation, rests, waiter = 'the close') {
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
  throw new Error(`a question of the person's is open at the investigation — ${listed} — each is answered before it closes`);
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
 * Refuses all but a bugfix in progress whose investigation has started and
 * not concluded.
 * @param {string} cwd @param {string} unit
 */
function assertOpen(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  assertPhaseHeld(manifest, PHASE);
  const status = itemOf(manifest, PHASE, unit)?.status;
  if (status === 'completed') throw new Error(`${unit}'s investigation has concluded`);
  if (status !== 'in-progress') throw new Error(`${unit}'s investigation has not started — engine enter investigation ${unit} starts it`);
}

/**
 * What the close is drawn on before the spec, refused where the
 * investigation cannot close (the header's).
 * @param {string} cwd @param {string} unit @param {string[]} warnings @returns {DrawnOn}
 */
function closing(cwd, unit, warnings) {
  const hunt = huntOf(cwd, unit, warnings);
  return withUnitEntries(cwd, unit, warnings, (view) => {
    const entries = huntEntries(unit, view, hunt);
    const rests = { rootCause: rested(entries.rootCause), fix: rested(entries.fix) };
    for (const validation of VALIDATIONS) assertValidated(cwd, unit, view, validation, rests);
    assertQuestionsClosed(unit, view);
    const waiting = mailboxDepth(stateRoot(cwd), unit, unit);
    if (waiting > 0) throw new Error(`${waiting} message(s) wait in its mailbox — raise and answer each first: engine topic mailbox ${unit} ${unit}`);
    return { root_cause: rests.rootCause.id, fix: rests.fix.id };
  });
}

/** The close the manifest keeps for the unit, or null where none is. @param {Record<string, any>} manifest @param {string} unit @returns {Close|null} */
const closeOf = (manifest, unit) => manifest.checklists?.conclusion?.[unit] ?? null;

/**
 * The unit's current entry the kept `id` leads to (`standsNow`), refused,
 * naming `what`, where it leads to another unit's alone: replaced there at
 * the unit's spec, it is the unit's again.
 * @param {string} unit @param {UnitView} view @param {string} id @param {string} what @returns {string}
 */
function nowOf(unit, view, id, what) {
  const now = standsNow(view, id);
  if (now !== null) return now.id;
  const elsewhere = view.short(currentsOf(view.folded, id).at(-1) ?? id);
  throw new Error(`${unit}'s ${what}, ${view.short(id)}, now stands as ${elsewhere}, another unit's entry — make it ${unit}'s at its spec: engine ledger replace ${unit}.specification --replaces ${elsewhere}`);
}

/**
 * What the close is drawn on once the spec is written (the header's): the
 * unit's current entries the kept root cause and fix lead to; refused where
 * nothing closed it.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {string[]} warnings @returns {DrawnOn}
 */
function respelt(cwd, unit, manifest, warnings) {
  const kept = closeOf(manifest, unit);
  if (kept === null) throw new Error(`${unit}'s investigation never closed into its spec — its close is staged before the spec is written`);
  return withUnitEntries(cwd, unit, warnings, (view) => ({ root_cause: nowOf(unit, view, kept.root_cause, 'root cause'), fix: nowOf(unit, view, kept.fix, 'fix') }));
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

/** The area in the spelling the project's bugfixes first recorded it by, where one has. @param {string} cwd @param {string} area */
const spelt = (cwd, area) => areaSpellings(bugRecords(listWorkUnitManifests(cwd))).get(areaKey(area)) ?? area;

/**
 * Claude's recap read from `file`, refused out of its shape, its area in
 * the spelling recorded.
 * @param {string} cwd @param {string} unit @param {string} file @returns {{hunt: string} & BugIn}
 */
function recapOf(cwd, unit, file) {
  const { hunt, ...rest } = shaped(readPayload(cwd, file), 'the recap', ['hunt'], ['fixes', 'area']);
  if (!oneLine(hunt)) throw new Error('the recap\'s hunt is one paragraph of words, not empty');
  const bug = bugIn(cwd, unit, rest);
  return { hunt: hunt.trim(), ...bug, ...(bug.area === undefined ? {} : { area: spelt(cwd, bug.area) }) };
}

/**
 * The bugfix's close as ready to build stands on it and draws it (the
 * header's), null for any other unit and a bugfix whose investigation has
 * not closed into its spec: when it closed, the recap as drawn, and the
 * close kept; refused where its root cause or its fix has been replaced
 * since it was staged.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string[]} warnings
 * @returns {{closed: string, recap: RecapView, staged: Close}|null}
 */
function concludedClose(cwd, manifest, warnings) {
  if (manifest.work_type !== 'bugfix' || !closedIntoSpec(manifest)) return null;
  const unit = manifest.name;
  const close = /** @type {Close} */ (closeOf(manifest, unit));
  const { symptoms } = huntOf(cwd, unit, warnings);
  return withUnitEntries(cwd, unit, warnings, (view) => {
    if (![close.root_cause, close.fix].every((id) => view.entries.has(id))) throw new Error(`the root cause or the fix has been replaced since the recap was staged — ${stageCall(unit)} stages it again`);
    const words = (/** @type {string} */ id) => restedOn(view, id).text;
    return {
      closed: close.closed,
      recap: { hunt: close.hunt, symptoms: symptoms.map(({ text }) => text), rootCause: words(close.root_cause), fix: words(close.fix) },
      staged: close,
    };
  });
}

/**
 * What the yes keeps of the bug: what the recap named, and with a unit,
 * whether its review phase had ended when the bug was found — kept from the
 * earlier conclude where that named the same unit, else judged now.
 * @param {string} cwd @param {BugIn} bug @param {Record<string, unknown>} earlier the item as the last conclude left it
 */
function kept(cwd, bug, earlier) {
  if (bug.fixes === undefined) return bug;
  const after = earlier.fixes === bug.fixes && typeof earlier.after_review === 'boolean' ? earlier.after_review : recordedRounds(cwd, bug.fixes).some(endsReview);
  return { ...bug, after_review: after };
}

/**
 * Ready to build's yes over a bugfix's close (the header's), what the bug
 * is in checked before anything is written. Answers its step, `take`, under
 * the writer lock before the manifest is saved: the investigation concluded
 * and its close recorded as taken.
 * @param {string} cwd @param {string} unit @param {Close} staged
 */
function concludingYes(cwd, unit, staged) {
  /** @type {BugIn} */
  let bug;
  try {
    bug = bugIn(cwd, unit, staged);
  } catch (err) {
    throw new Error(`${messageOf(err)} — ${stageCall(unit)} stages it again`);
  }
  return {
    /** @param {Record<string, any>} manifest @param {string} at */
    take: (manifest, at) => {
      const item = manifest.phases[PHASE].items[unit];
      const record = kept(cwd, bug, item);
      for (const field of ['fixes', 'area', 'after_review']) delete item[field];
      Object.assign(item, { status: 'completed', concluded_at: at, ...record });
      manifest.checklists.conclusion[unit].taken = at;
    },
  };
}

/**
 * `investigation stage <bugfix> --file <recap.json>`: the investigation
 * closed into its spec (the header's) — the close marked with Claude's
 * recap — answering the handoff into the spec, or, staged again once the
 * spec is written, carrying on there to ready to build's screen.
 * @param {string} cwd @param {string} unit @param {string} file
 */
function stageClose(cwd, unit, file) {
  /** @type {string[]} */
  const warnings = [];
  try {
    assertOpen(cwd, unit);
    const written = specStanding(cwd, unit) !== 'none';
    const drawn = written ? respelt(cwd, unit, loadWorkUnitManifest(cwd, unit), warnings) : closing(cwd, unit, warnings);
    const { hunt, ...bug } = recapOf(cwd, unit, file);
    const closed = new Date().toISOString();
    withWorkUnitLock(cwd, unit, () => {
      const fresh = loadWorkUnitManifest(cwd, unit);
      ((fresh.checklists ??= {}).conclusion ??= {})[unit] = { closed, hunt, ...drawn, ...bug };
      saveWorkUnitManifest(cwd, unit, fresh);
    });
    const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `investigation(${unit}): close`, warnings);
    /** @type {import('./projections/surfaces.cjs').Next} */
    const next = written ? { kind: 'continue' } : { kind: 'handoff', skill: phaseSkill('specification'), args: ['bugfix', unit] };
    /** @type {Record<string, unknown>} */
    const result = { unit, closed, ...bug, committed: outcome.committed, next };
    if (warnings.length > 0) result.warnings = warnings;
    noteCommitOutcome(result, outcome, `${unit} --state`);
    return result;
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `investigation stage …`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runInvestigationVerb(cwd, [verb, ...args], opts) {
  if (verb !== 'stage' || args.length !== 1 || Object.keys(opts).join() !== 'file') throw new Error(`Usage: engine ${STAGE_USAGE}`);
  return refusing('investigation stage', () => stageClose(cwd, args[0], opts.file));
}

module.exports = { STAGE_USAGE, VALIDATIONS, validationSince, assertMovable, concludedClose, concludingYes, runInvestigationVerb };
