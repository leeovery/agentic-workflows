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
// words (spec-entry.cjs) — a topic not yet settled, a quick-fix, a
// cross-cutting unit; a unit with no `spec.md`; and a spec its grammar
// cannot read (spec-sections.cjs, `specStatements`), naming every fault. A
// statement that does not trace refuses nothing: the land answers it, with
// why (spec-trace.cjs), for the spec's review to take up (11.4.2), and ready
// to build's `statements-traced` stays open while one does.
//
// It answers how many statements the spec holds, each invented one, and the
// sections changed since the last land: each area and part whose text
// differs from the spec the state branch holds, or that it lacked — every
// one at the first land. It runs under the writer lock (engine.cjs) and
// commits `spec.md`, with each file it links that is on disk in a unit's or
// the product's assets or spikes (log-links.cjs), pushed.
// ---------------------------------------------------------------------------

const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { SPEC_FILE, readSpec, specSections, specStatements } = require('./spec-sections.cjs');
const { specStanding, specEntryRefusal } = require('./spec-entry.cjs');
const { inventedStatements } = require('./spec-trace.cjs');
const { logLinks } = require('./log-links.cjs');
const { commitStateScoped, noteCommitOutcome } = require('./commit.cjs');

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
  if (workUnitNameRefusal(unit) !== null || manifestOf(stateRoot(cwd), unit) === null) return `there is no work unit "${unit}"`;
  if (specStanding(cwd, unit) === 'concluded') return `${unit}'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger`;
  return specEntryRefusal(cwd, unit);
}

/**
 * The sections of `text` changed since `landed`, the spec the state branch
 * holds: each whose text differs or that it lacked, in the spec's order —
 * every one where it holds none, or one its sections cannot read.
 * @param {string|null} landed @param {string} text @returns {string[]}
 */
function changedSections(landed, text) {
  let before = new Map();
  try {
    if (landed !== null) before = specSections(landed);
  } catch { /* a spec committed by another route than the land: every section changed */ }
  return [...specSections(text).values()].filter(({ address, text: now }) => before.get(address)?.text !== now).map(({ address }) => address);
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
 * Land the unit's `spec.md`: check it, trace it, and commit it with the
 * files it links.
 * @param {string} cwd @param {string} unit @returns {Landed}
 */
function landSpec(cwd, unit) {
  const refused = unitRefusal(cwd, unit);
  if (refused !== null) refuse(refused);
  const text = refusing(() => readSpec(cwd, unit));
  const { statements } = refusing(() => specStatements(text));
  const root = stateRoot(cwd);
  const rel = `${unit}/${SPEC_FILE}`;
  /** @type {string[]} */
  const warnings = [];
  const invented = inventedStatements(cwd, unit, statements, warnings);
  const changed = changedSections(isolatedGit(root).tryRun(['show', `HEAD:${rel}`]), text);
  const outcome = refusing(() => commitStateScoped(cwd, rel, `spec(${unit}): landed`, { kept: logLinks(root, [rel]) }));
  /** @type {Landed} */
  const result = { unit, statements: statements.length, invented, changed, committed: outcome.committed };
  warnings.push(...outcome.warnings);
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, { ...outcome, failed: false });
  return result;
}

module.exports = { SPEC_USAGE, landSpec };
