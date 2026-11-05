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
// - Claude's recap of the hunt, `{"hunt": "<one paragraph>"}`, is staged in
//   the topic's cache with `--file`, against the root cause and the fix as
//   they stand, and when it was staged; the screen draws from it again
//   without `--file`, refused where nothing is staged, or it was staged
//   before the root cause or the fix changed. The screen shows the recap,
//   the symptoms in the person's words from the log, the root cause told
//   against them and the fix direction (19.4.23); each departure the person
//   made in the investigation that this machine logged is asked its verdict
//   there first, one at a time — `verdict give … --at conclusion` — none
//   asked where none was made (16.10.5, 16.10.11); then the conclude gate:
//   yes, keep going, and a comment.
// - The yes stands on the screen as drawn: what is staged was staged
//   against the root cause and the fix as they stand, and no verdict is
//   still to ask. Then, under the writer lock, in one manifest save, it
//   completes the investigation's item and stamps its close, `concluded_at`,
//   the instant (P2) — what the board dates the investigation by, its
//   standing read from the item as every phase's is — and commits it, the
//   log riding along; the staged recap goes. It answers `next`, the handoff
//   into the spec.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { carrying } = require('./ledger.cjs');
const { mapOf } = require('./ledger-fold.cjs');
const { readShown } = require('./ledger-read.cjs');
const { verdictAsked } = require('./ledger-verdicts.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { mailboxDepth, topicTitle } = require('./derivations.cjs');
const { validationFor } = require('./agent-state.cjs');
const { huntOf, huntEntries, openInvestigation } = require('./investigation-log.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { phaseSkill } = require('./handoff.cjs');
const { filled, shaped, readPayload, stage, stagedAt, refusing } = require('./staged-payload.cjs');
const { concludeScreen } = require('./projections/investigation.cjs');

/** @typedef {import('./investigation-log.cjs').Rested} Rested */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */

const PHASE = 'investigation';
const CONCLUDE_USAGE = 'investigation conclude <bugfix>';
const SURFACE_USAGE = 'render conclude <bugfix> [--file <recap.json>]';

/**
 * Claude's recap as staged: when, the recap, and the root cause and the fix
 * it was drawn against, by full id.
 * @typedef {{at: string, hunt: string, root_cause: string, fix: string}} Staged
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
 * where it stands. @type {Readonly<Record<string, (unit: string, id: string) => string>>}
 */
const WAITING = Object.freeze({
  running: (unit, id) => `${id} is still running — the conclude waits for its report`,
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
 * The validation not yet taken in since the entries it rests on were made,
 * refused with the way on: the one dispatched since, by where it stands,
 * or, where none was, its dispatch, its brief and its report taken in.
 * @param {string} cwd @param {string} unit @param {UnitView} view
 * @param {(typeof VALIDATIONS)[number]} validation @param {{rootCause: Rested, fix: Rested}} rests
 */
function assertValidated(cwd, unit, { folded }, { kind, of, since, what, logged }, rests) {
  const line = Math.max(...since.map((at) => folded.facts.get(rests[at].id)?.place.number ?? Infinity));
  const validation = validationFor(cwd, unit, kind, folded.facts, line);
  if (validation?.stands === 'taken-in') return;
  const named = `the ${what} ${rests[of].short}`;
  if (validation !== null) throw new Error(`${named} is being validated — ${WAITING[validation.stands](unit, validation.id)}`);
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
  return readShown(root, warnings, (shower) => verdictAsked(shower, root, (facts) => facts.unit === unit && facts.phase === PHASE, at));
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

/** Claude's recap read from `file`, refused out of its shape. @param {string} cwd @param {string} file */
function recapOf(cwd, file) {
  const { hunt } = shaped(readPayload(cwd, file), 'the recap', ['hunt']);
  if (!filled(hunt) || /[\r\n]/.test(hunt)) throw new Error('the recap\'s hunt is one paragraph of words, not empty');
  return hunt.trim();
}

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
        : stage(stagedFile(cwd, unit), { at: new Date().toISOString(), hunt: recapOf(cwd, file), root_cause: rootCause.id, fix: fix.id });
      return concludeScreen({
        unit,
        title: topicTitle(manifest, unit),
        hunt: staged.hunt,
        symptoms: hunt.symptoms.map(({ text }) => text),
        rootCause: rootCause.text,
        fix: fix.text,
        verdict: verdictOf(cwd, unit, staged.at, warnings),
      });
    } catch (err) {
      throw carrying(err, warnings);
    }
  });
}

/**
 * `investigation conclude <bugfix>`: the conclude gate's yes, closing the
 * investigation and handing the work into its spec.
 * @param {string} cwd @param {string} unit
 */
function concludeInvestigation(cwd, unit) {
  /** @type {string[]} */
  const warnings = [];
  const concludedAt = new Date().toISOString();
  try {
    const { rootCause, fix } = closing(cwd, unit, 'investigation conclude', warnings);
    const staged = stagedFor(cwd, unit, rootCause, fix);
    if (verdictOf(cwd, unit, staged.at, warnings) !== null) throw new Error(`a verdict is still to ask — engine render conclude ${unit} asks each before the yes`);
    const manifest = withWorkUnitLock(cwd, unit, () => {
      const fresh = loadWorkUnitManifest(cwd, unit);
      Object.assign(fresh.phases[PHASE].items[unit], { status: 'completed', concluded_at: concludedAt });
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

module.exports = { CONCLUDE_USAGE, concludeSurface, runInvestigationVerb };
