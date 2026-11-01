'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's land (11.1.4, 11.4, 6.3.13) — `spec land <unit>`,
// the one route by which a unit's `spec.md` reaches the state branch. The
// spec's writer writes the file in its place, open to Claude until the spec
// is concluded (layout-hook.cjs); the verb reads it, checks it, and commits
// it with the files it links.
//
// It refuses, every refusal opening `spec land: `, writing and committing
// nothing, so the file stands as written for the writer's next dispatch: a
// unit the project lacks; a concluded spec — the build begun on it — which is
// never corrected (11.9.1); a unit `enter specification` refuses, in its
// words (spec-entry.cjs) — one not in progress, a topic not yet settled, a
// quick-fix, a cross-cutting unit; an epic owing the sweep before its spec,
// more than one of its topics live, whose sweep is not taken (sweep.cjs,
// 8.10.3); a unit with no `spec.md`; a spec its
// grammar cannot read (spec-sections.cjs, `specStatements`), naming every
// fault, one per line; while the person's review page is open, a number the
// page holds changed (spec-review.cjs, 11.11.3); and a commit git refuses. A
// statement or a screen that does not trace refuses nothing: the land answers
// it, with why (spec-trace.cjs), for the spec's review to take up (11.4.2),
// and ready to build's `statements-traced` stays open while one does.
//
// It answers how many statements the spec holds, each invented line, and
// the sections changed since the spec the state branch holds, as the spec's
// loop reads a change (spec-passes.cjs): each section whose own text differs
// or that it lacked, then each the spec no longer holds; every one at the
// first land. It runs under the writer lock (engine.cjs) and
// commits `spec.md`, with each file it links that is on disk in a unit's or
// the product's assets or spikes (log-links.cjs), pushed. Once committed, it
// keeps the print of the spec it landed, with the ledger's mark at the first
// land, for the spec's loop (spec-passes.cjs).
//
// What it would refuse of `spec.md` as written is answered without landing,
// for the writer's brief: none where no `spec.md` is written.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { SPEC_FILE, specPath, readSpec, specStatements } = require('./spec-sections.cjs');
const { specStanding, specEntryRefusal } = require('./spec-entry.cjs');
const { inventedLines } = require('./spec-trace.cjs');
const { logLinks } = require('./log-links.cjs');
const { commitStateScoped, noteCommitOutcome } = require('./commit.cjs');
const { heldNumberFaults, holdNumbers } = require('./spec-review.cjs');
const { sweepApplies, sweepTaken } = require('./sweep.cjs');
const { printOf, changedSince, recordLand } = require('./spec-passes.cjs');

const SPEC_USAGE = 'spec land <work-unit>';

/** @typedef {import('./spec-trace.cjs').Invented} Invented */
/**
 * @typedef {{
 *   unit: string, statements: number, invented: Invented[], changed: string[],
 *   committed: string|null, warnings?: string[], note?: string,
 * }} Landed
 */

/** @param {string} reason @returns {never} */
function refuse(reason) {
  throw new Error(`spec land: ${reason}`);
}

/**
 * Why the unit's spec cannot land, before it is read, or null.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function unitRefusal(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) return `there is no work unit "${unit}"`;
  if (specStanding(cwd, unit) === 'concluded') return `${unit}'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger`;
  const entry = specEntryRefusal(cwd, unit);
  if (entry !== null) return entry;
  return sweepApplies(manifest) && !sweepTaken(cwd, unit)
    ? `${unit}'s sweep is not taken — it runs before the spec lands: engine brief sweep ${unit}, then engine sweep take ${unit}`
    : null;
}

/**
 * The sections changed since `landed`, the spec the state branch holds:
 * each of `text`'s changed, in the spec's order, then each of its that
 * `text` lacks — every one of `text`'s where it holds none, or one its
 * sections cannot read.
 * @param {string|null} landed @param {string} text @returns {string[]}
 */
function changedSections(landed, text) {
  /** @type {Record<string, string>} */
  let before = {};
  try {
    if (landed !== null) before = printOf(landed).sections;
  } catch { /* a spec committed by another route than the land: every section changed */ }
  const { changed, removed } = changedSince(before, text);
  return [...changed, ...removed];
}

/** `fn`'s answer, its refusal the land's. @template T @param {() => T} fn @returns {T} */
function refusing(fn) {
  try {
    return fn();
  } catch (err) {
    return refuse(messageOf(err));
  }
}

/**
 * The unit's `spec.md`, its lines, and the spec the state branch holds,
 * checked as the land checks them before its commit; refused as the land
 * refuses them.
 * @param {string} cwd @param {string} unit
 */
function checkedSpec(cwd, unit) {
  const refused = unitRefusal(cwd, unit);
  if (refused !== null) refuse(refused);
  const text = refusing(() => readSpec(cwd, unit));
  const lines = refusing(() => specStatements(text));
  const landed = isolatedGit(stateRoot(cwd)).tryRun(['show', `HEAD:${unit}/${SPEC_FILE}`]);
  const held = heldNumberFaults(cwd, unit, landed, lines);
  if (held.length > 0) refuse(held.join('\n'));
  return { text, lines, landed };
}

/**
 * What `spec land` would refuse of the unit's `spec.md` as written, as it
 * says it; null where none is written or it would land, a commit git would
 * refuse aside.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function landRefusal(cwd, unit) {
  if (!fs.existsSync(specPath(cwd, unit))) return null;
  try {
    checkedSpec(cwd, unit);
    return null;
  } catch (err) {
    return messageOf(err);
  }
}

/**
 * Land the unit's `spec.md`: check it, trace it, and commit it with the
 * files it links.
 * @param {string} cwd @param {string} unit @returns {Landed}
 */
function landSpec(cwd, unit) {
  const { text, lines, landed } = checkedSpec(cwd, unit);
  const root = stateRoot(cwd);
  const rel = `${unit}/${SPEC_FILE}`;
  /** @type {string[]} */
  const warnings = [];
  const invented = inventedLines(cwd, unit, lines, warnings);
  const changed = changedSections(landed, text);
  const outcome = refusing(() => commitStateScoped(cwd, rel, `spec(${unit}): landed`, { kept: logLinks(root, [rel]) }));
  holdNumbers(cwd, unit, landed, lines);
  recordLand(cwd, unit, text, warnings);
  /** @type {Landed} */
  const result = { unit, statements: lines.filter(({ kind }) => kind === 'statement').length, invented, changed, committed: outcome.committed };
  warnings.push(...outcome.warnings);
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, { ...outcome, failed: false });
  return result;
}

module.exports = { SPEC_USAGE, landSpec, landRefusal, unitRefusal };
