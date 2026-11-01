'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's loop (11.7.6, 11.S11, E3, E4) — the writer writes,
// the spec lands, a pass of its reviewer reviews what changed, and its report
// goes back to the writer through the records; the review stops when a pass
// changes nothing. Read by the land (spec-land.cjs), the reviewer's and the
// writer's briefs (brief-records.cjs) and ready to build's `review-settled`
// (checklist.cjs).
//
// What changed, one comparison (`changedSince`): a section's own text is the
// title and introduction, everything before the first area; a part's text;
// an area's from its heading to its first part, with its block of
// scenarios. Its print is the SHA-256 of that text, by address; a section
// changed where its print differs or is new, and one gone where it is no
// longer there. A section's order, and the blank lines between sections,
// change none (E4).
//
// The passes it reads as reported are those whose report the agent store
// took in (agent-state.cjs), reading as a spec review's report reads
// (spec-report.cjs), each with the findings it was taken in with, never its
// report read again; a pass refused, or abandoned in flight, is ignored
// whole, its report never read, whenever it lands. A pass still in flight,
// bound to a land, holds the review until its report is taken in or it is
// abandoned — one whose agent returned without writing its report reads as
// running while Claude's process lives, so the way on names abandoning it.
//
// What waits, one function (`outstanding`):
// - for the writer: every current entry made at the unit's own level at the
//   spec after the ledger's mark the last committed take kept — after the
//   first land's, before any take, none before either — and every reported
//   pass with a `rewrite` finding that take did not carry;
// - to be surfaced: every `gap` or `fact` finding of a reported pass that
//   the agent store has neither surfaced — raised (11.7.2) or replaced
//   (11.7.9) — nor declined, its pass acknowledged with it and then
//   incorporated.
//
// The loop's states, and what reads them:
// - The writer's brief draws what waits for it — the entries, and each such
//   report verbatim — and keeps a pending take: the ledger's mark and every
//   pass reported by then (`.cache/{unit}/specification/taking.json`). A
//   brief again before a land draws all the last committed take left.
// - `spec land` keeps the land — each section's print, an order-free digest
//   of them identifying it, and the ledger's mark at the first land
//   (`landed.json`) — and commits the pending take (`taken.json`), a land
//   of the spec unchanged among them; it answers what changed since the
//   spec the state branch held.
// - The reviewer's brief binds its pass to the last land, and reads what
//   changed since the land the latest reported pass reviewed — every
//   section where none has; with nothing changed it names what waits.
// - A gap waits while a question asked at the unit's own level at the spec
//   is open (11.7.2); it holds the writer's brief until the person answers.
// - The review has settled where (a) the latest reported pass reviewed the
//   spec as it stands — nothing changed since its land — (c) no gap waits,
//   and (d) nothing waits: no pass in flight, nothing for the writer and
//   nothing to be surfaced. A writer taking the findings and landing the
//   spec unchanged settles it; one changing a section sends it to a pass.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { writeJsonAtomic, isObject } = require('../kernel/manifest-io.cjs');
const { specSections, scenarioBlocks, specIntroduction, readSpec } = require('./spec-sections.cjs');
const { ID_FACTS, foldLedger, factsOf, questionStands } = require('./ledger-fold.cjs');
const { markOf, lineOf } = require('./ledger-moves.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { UNIT_PHASE, reportedPasses, passesInFlight } = require('./agent-state.cjs');

/** The address of a spec's title and introduction among its sections. */
const INTRODUCTION = 'introduction';

/** A spec's print: each section's hash by address, and an order-free digest of them. @typedef {{digest: string, sections: Record<string, string>}} Print */
/** What a land keeps: the print of the spec it landed, and the ledger's mark at the first land. @typedef {Print & {first_mark: string|null}} Landed */
/** A take: the ledger's mark as the writer's brief was issued, and every pass reported by then. @typedef {{ledger_mark: string|null, passes: string[]}} Taken */
/** @typedef {ReturnType<typeof reportedPasses>[number]} Pass */
/** A finding waiting to be surfaced: its pass, its id and lane, and whether its pass is acknowledged. @typedef {{pass: string, id: string, lane: string, acknowledged: boolean}} Finding */
/** What waits: the entries' full ids and the passes, for the writer, and the findings to be surfaced, each in order. @typedef {{entries: string[], passes: Pass[], surface: Finding[]}} Outstanding */

/** @param {string} text */
const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** Where a unit's spec keeps `file`. @param {string} cwd @param {string} unit @param {string} file */
const kept = (cwd, unit, file) => statePath(cwd, '.cache', unit, UNIT_PHASE, file);

/** @param {string} file @param {unknown} record */
function keep(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, record);
}

/** `file` read as JSON, null where it is missing or does not read. @param {string} file @returns {unknown} */
function readKept(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The ledger's facts, by id. @param {string} cwd @param {string[]} warnings */
const ledgerFacts = (cwd, warnings) => foldLedger(stateRoot(cwd), ID_FACTS, warnings);

/**
 * Each section's own text, by address, in the spec's order: the title and
 * introduction; a part's text; an area's to its first part, with its block
 * of scenarios after it.
 * @param {string} text @returns {Map<string, string>}
 */
function ownTexts(text) {
  const sections = [...specSections(text).values()];
  const scenarios = scenarioBlocks(text);
  return new Map([[INTRODUCTION, specIntroduction(text)], ...sections.map(({ address, level, text: whole }) => {
    if (level === 3) return /** @type {[string, string]} */ ([address, whole]);
    const first = sections.find((part) => part.level === 3 && part.address.startsWith(`${address}.`));
    const own = first === undefined ? whole : whole.slice(0, whole.indexOf(`\n${first.text}`)).trimEnd();
    return /** @type {[string, string]} */ ([address, scenarios.has(address) ? `${own}\n\n${scenarios.get(address)}` : own]);
  })]);
}

/** Each section's print, by address, in the spec's order. @param {string} text */
const sectionPrints = (text) => new Map([...ownTexts(text)].map(([address, own]) => [address, hashOf(own)]));

/** A spec's print. @param {string} text @returns {Print} */
function printOf(text) {
  const prints = sectionPrints(text);
  return { digest: hashOf(JSON.stringify([...prints].sort(([a], [b]) => a.localeCompare(b)))), sections: Object.fromEntries(prints) };
}

/** Addresses in the spec's order, each number compared as a number. @param {string} a @param {string} b */
function byAddress(a, b) {
  const [x, y] = [a, b].map((address) => address.split('.').map(Number));
  return x[0] - y[0] || (x[1] ?? 0) - (y[1] ?? 0);
}

/**
 * The sections of `text` changed since the print `before`: each whose print
 * differs or that it lacked, in the spec's order — every one where `before`
 * holds none — then each it held that `text` does not.
 * @param {Record<string, string>} before @param {string} text
 * @returns {{changed: string[], removed: string[]}}
 */
function changedSince(before, text) {
  const now = sectionPrints(text);
  return {
    changed: [...now].filter(([address, print]) => before[address] !== print).map(([address]) => address),
    removed: Object.keys(before).filter((address) => !now.has(address)).sort(byAddress),
  };
}

/** Whether `text` reads as the print `before`, nothing changed and nothing gone. @param {Record<string, string>} before @param {string} text */
function unchangedSince(before, text) {
  const { changed, removed } = changedSince(before, text);
  return changed.length === 0 && removed.length === 0;
}

/**
 * The last land's record, null where this checkout keeps none or it does
 * not read as one — a land since keeps it afresh.
 * @param {string} cwd @param {string} unit @returns {Landed|null}
 */
function lastLand(cwd, unit) {
  const read = readKept(kept(cwd, unit, 'landed.json'));
  return isObject(read) && typeof read.digest === 'string' && isObject(read.sections) ? /** @type {Landed} */ (read) : null;
}

/**
 * Keep the print of the spec just landed, with the ledger's mark at the
 * first land; what a landing the ledger's read finished said pushed to
 * `warnings`.
 * @param {string} cwd @param {string} unit @param {string} text @param {string[]} warnings
 */
function recordLand(cwd, unit, text, warnings) {
  const first = lastLand(cwd, unit);
  /** @type {Landed} */
  const landed = { ...printOf(text), first_mark: first === null ? markOf(ledgerFacts(cwd, warnings)) : first.first_mark };
  keep(kept(cwd, unit, 'landed.json'), landed);
  if (fs.existsSync(kept(cwd, unit, 'taking.json'))) fs.renameSync(kept(cwd, unit, 'taking.json'), kept(cwd, unit, 'taken.json'));
}

/** The last committed take, null where none is kept. @param {string} cwd @param {string} unit @returns {Taken|null} */
function lastTaken(cwd, unit) {
  const read = readKept(kept(cwd, unit, 'taken.json'));
  return isObject(read) && Array.isArray(read.passes) ? /** @type {Taken} */ (read) : null;
}

/** The latest pass whose report is in, or none. @param {string} cwd @param {string} unit @returns {Pass|undefined} */
const latestReported = (cwd, unit) => reportedPasses(cwd, unit).pop();

/**
 * Keep a writer's brief's pending take: the ledger's mark, and every pass
 * reported by then; the land that follows commits it.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 */
function recordTaking(cwd, unit, warnings) {
  /** @type {Taken} */
  const taking = { ledger_mark: markOf(ledgerFacts(cwd, warnings)), passes: reportedPasses(cwd, unit).map(({ id }) => id) };
  keep(kept(cwd, unit, 'taking.json'), taking);
}

/** Whether a pass declined a finding: acknowledged with it, then incorporated. @param {Pass} pass @param {string} id */
const declined = (pass, id) => pass.status === 'incorporated' && pass.acknowledged.includes(id);

/**
 * What waits: for the writer, every current entry made at the unit's own
 * level at the spec after the mark the last committed take kept — the
 * first land's before any take, none before either — and every reported
 * pass with a `rewrite` finding that take did not carry; to be surfaced,
 * every `gap` or `fact` finding neither surfaced nor declined.
 * @param {string} cwd @param {string} unit @param {string[]} warnings @returns {Outstanding}
 */
function outstanding(cwd, unit, warnings) {
  const taken = lastTaken(cwd, unit);
  const land = taken === null ? lastLand(cwd, unit) : null;
  const entries = withUnitEntries(cwd, unit, warnings, ({ folded, entries: current }) => {
    const since = taken !== null ? lineOf(folded.facts, taken.ledger_mark) : land !== null ? lineOf(folded.facts, land.first_mark) : Infinity;
    return [...current.keys()].filter((id) => {
      const made = factsOf(folded, id);
      return made.unit === unit && made.phase === UNIT_PHASE && made.place.number > since;
    });
  });
  const read = reportedPasses(cwd, unit);
  return {
    entries,
    passes: read.filter(({ id, findings }) => findings.some(({ lane }) => lane === 'rewrite') && !(taken?.passes.includes(id) ?? false)),
    surface: read.flatMap((pass) => pass.findings
      .filter(({ id, lane }) => lane !== 'rewrite' && !pass.surfaced.includes(id) && !declined(pass, id))
      .map(({ id, lane }) => ({ pass: pass.id, id, lane, acknowledged: pass.status === 'acknowledged' }))),
  };
}

/**
 * The land a pass of the unit's review is issued on, and the spec's text:
 * the spec as it last landed. Refused where this checkout holds no land of
 * it, or `spec.md` reads otherwise than it landed.
 * @param {string} cwd @param {string} unit @returns {{land: Landed, text: string}}
 */
function reviewedSpec(cwd, unit) {
  const text = readSpec(cwd, unit);
  const land = lastLand(cwd, unit);
  if (land === null) throw new Error(`brief: this checkout holds no land of ${unit}'s spec — a land is kept in the checkout's own cache, so engine spec land ${unit} lands it here before its review`);
  if (!unchangedSince(land.sections, text)) throw new Error(`brief: ${unit}'s spec.md has changed since it landed — engine spec land ${unit} lands it before its review`);
  return { land, text };
}

/**
 * The sections a pass reads of the spec's `text`: those changed since the
 * land the latest reported pass reviewed — every one where none has
 * reported — with that pass's id, null where none has.
 * @param {string} cwd @param {string} unit @param {string} text
 * @returns {{changed: string[], removed: string[], since: string|null}}
 */
function sectionsToReview(cwd, unit, text) {
  const last = latestReported(cwd, unit);
  return { ...changedSince(last?.land.sections ?? {}, text), since: last?.id ?? null };
}

/**
 * The gaps waiting on the person: the current questions asked at the unit's
 * own level at the spec and still open, by short id, in the ledger's order.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 * @returns {string[]}
 */
function waitingGaps(cwd, unit, warnings) {
  return withUnitEntries(cwd, unit, warnings, ({ folded, entries }) => [...entries].flatMap(([id, { short, kind, stands }]) => {
    const asked = kind === 'question' && stands.unit === unit && stands.topic === null && factsOf(folded, id).phase === UNIT_PHASE;
    return asked && questionStands(folded, id) === 'open' ? [short] : [];
  }));
}

/**
 * A finding's way to surfacing, its pass acknowledged first where it is not.
 * @param {Finding} finding @param {number} at @param {Finding[]} all
 */
function surfacing({ pass, id, lane, acknowledged }, at, all) {
  const first = all.findIndex((other) => other.pass === pass) === at;
  return `${first && !acknowledged ? `${pass} acknowledged, then ` : ''}the ${lane} ${id} of ${pass} ${lane === 'gap' ? 'raised' : 'replaced'}`;
}

/** A pass in flight's way on, by where it stands. @type {Readonly<Record<'landed'|'running'|'lost', (id: string) => string>>} */
const IN_FLIGHT = Object.freeze({
  landed: (id) => `${id}'s report is in, and agent scan takes it in`,
  running: (id) => `${id} is still running, and the review waits for its report — if its agent has returned without writing its report, agent incorporate abandons it, and another pass is dispatched`,
  lost: (id) => `${id} was lost with the process that dispatched it, and agent incorporate abandons it`,
});

/**
 * What the review waits on, past a pass that reviewed the spec as it
 * stands, said as the way on; null where nothing waits: a gap waiting on
 * the person; else each pass in flight, the findings waiting to be
 * surfaced, and what waits for the writer.
 * @param {string} cwd @param {string} unit @param {string[]} warnings @returns {string|null}
 */
function waitingOn(cwd, unit, warnings) {
  const gaps = waitingGaps(cwd, unit, warnings);
  if (gaps.length > 0) return `${gaps.length === 1 ? `the gap ${gaps[0]}, asked at the spec, waits` : `the gaps ${gaps.join(', ')}, asked at the spec, wait`} on the person, and the writer's brief follows the answer`;
  const { entries, passes, surface } = outstanding(cwd, unit, warnings);
  const forWriter = [
    ...(passes.length === 0 ? [] : [`the report of ${passes.map(({ id }) => id).join(', ')}`]),
    ...(entries.length === 0 ? [] : [`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} made at the spec`]),
  ];
  const ways = [
    ...passesInFlight(cwd, unit).map(({ id, stands }) => IN_FLIGHT[stands](id)),
    ...(surface.length === 0 ? [] : [`the review's findings wait to be surfaced: ${surface.map(surfacing).join(', ')}`]),
    ...(forWriter.length === 0 ? [] : [`the writer's brief carries what waits for it, and the spec's land takes it: ${forWriter.join(', and ')}`]),
  ];
  return ways.length === 0 ? null : ways.join('; ');
}

/**
 * Whether the unit's review has settled: the latest pass that reported
 * reviewed the spec as it stands, no pass is in flight, and nothing waits
 * on the person, for the writer or to be surfaced.
 * @param {string} cwd @param {string} unit @param {string[]} warnings
 */
function reviewSettled(cwd, unit, warnings) {
  const latest = latestReported(cwd, unit);
  if (latest === undefined) return false;
  let unchanged;
  try {
    unchanged = unchangedSince(latest.land.sections, readSpec(cwd, unit));
  } catch {
    return false;
  }
  return unchanged && waitingOn(cwd, unit, warnings) === null;
}

module.exports = {
  ownTexts, printOf, changedSince, recordLand, lastLand, recordTaking, outstanding, reviewedSpec, sectionsToReview, waitingGaps, waitingOn, reviewSettled,
};
