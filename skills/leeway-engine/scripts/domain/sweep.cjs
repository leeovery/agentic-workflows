'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the sweep's report (8.10.3–8.10.5, 11.2.2) — what the sweep
// before the spec found across an epic's records, written by its agent
// (`leeway-sweep`, briefed by `brief sweep <unit>`) as JSON in the unit's
// spec cache, `.cache/{unit}/specification/sweep.json`, beside the cut's
// staged cut. One sweep per spec: the report a later dispatch writes
// replaces the last. Its three parts, each a list, maybe empty:
// - `candidates`, work no topic owns that holds a call the person would
//   make (8.10.5), each `{name, reason, brief, from_roadmap?}`: the topic it
//   would land as, why it falls between the topics, its brief's text —
//   what it is, where it was read, why it matters and its open questions
//   (8.10.10) — and the waiting roadmap item it takes in, where it takes
//   one (8.1.6). They come to the person on approve the map (8.10.9,
//   approve-map.cjs), which checks them against the map as it stands;
// - `messages`, work that only carries a decision into other topics, each
//   `{topic, text}`: the topic, by its name or title, and the message, its
//   first line its title. Each goes by `topic send --from
//   {unit}.specification` (mail.cjs), on no screen (8.S50);
// - `builder_calls`, the calls the person would leave, each `{call, why}`,
//   kept here for the spec's writer.
// The report reads where it holds that shape and nothing else, each text
// non-empty; it is read whole or refused, naming every fault. Ready to
// build's sweep-run holds once the unit has a report that reads
// (checklist.cjs). The cache is local: a report a cleanse takes is
// written again by the next sweep.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');

/** @typedef {{name: string, reason: string, brief: string, from_roadmap?: string}} SweepCandidate */
/** @typedef {{topic: string, text: string}} SweepMessage */
/** @typedef {{call: string, why: string}} BuilderCall */
/** @typedef {{candidates: SweepCandidate[], messages: SweepMessage[], builder_calls: BuilderCall[]}} SweepReport */

/**
 * Each part of the report: the fields each of its items holds, and those an item may leave out.
 * @type {Readonly<Record<keyof SweepReport, {item: string, fields: string[], optional: string[]}>>}
 */
const PARTS = Object.freeze({
  candidates: { item: 'candidate', fields: ['name', 'reason', 'brief'], optional: ['from_roadmap'] },
  messages: { item: 'message', fields: ['topic', 'text'], optional: [] },
  builder_calls: { item: 'builder call', fields: ['call', 'why'], optional: [] },
});

/** The parts, in the order the report holds them. */
const PART_NAMES = /** @type {Array<keyof SweepReport>} */ (Object.keys(PARTS));

/** Where the sweep's agent writes its report for a unit. @param {string} cwd @param {string} unit */
function sweepPath(cwd, unit) {
  return statePath(cwd, '.cache', unit, 'specification', 'sweep.json');
}

/** A non-empty string. @param {unknown} value */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * The faults of one item of a part: another shape, a field missing or
 * another besides, a text empty — a message's first line among them, its
 * title.
 * @param {keyof SweepReport} part @param {unknown} item @param {number} at
 * @returns {string[]}
 */
function itemFaults(part, item, at) {
  const { item: what, fields, optional } = PARTS[part];
  const named = `${what} ${at + 1}`;
  const shape = `{${[...fields, ...optional.map((field) => `${field}?`)].join(', ')}}`;
  if (!isObject(item)) return [`${named} is ${shape}`];
  const given = Object.keys(item);
  const faults = [
    ...fields.filter((field) => !given.includes(field)).map((field) => `${named} has no ${field}`),
    ...given.filter((field) => !fields.includes(field) && !optional.includes(field)).map((field) => `${named} holds ${field}, which a ${what} has not — it is ${shape}`),
    ...given.filter((field) => fields.includes(field) || optional.includes(field)).filter((field) => !filled(item[field])).map((field) => `${named}'s ${field} is a non-empty string`),
  ];
  if (part === 'messages' && filled(item.text) && String(item.text).split('\n', 1)[0].trim() === '') faults.push(`${named}'s text opens on a blank line — a message's first line is its title`);
  return faults;
}

/**
 * The faults of the report as parsed: another shape, or any part's.
 * @param {unknown} report @returns {string[]}
 */
function reportFaults(report) {
  if (!isObject(report)) return [`it is {${PART_NAMES.join(', ')}}, each a list`];
  const extra = Object.keys(report).filter((key) => !PART_NAMES.includes(/** @type {keyof SweepReport} */ (key)));
  return [
    ...extra.map((key) => `it holds ${key}, which the report has not — it is {${PART_NAMES.join(', ')}}`),
    ...PART_NAMES.flatMap((part) => {
      const items = report[part];
      if (!Array.isArray(items)) return [`${part} is a list`];
      return items.flatMap((item, at) => itemFaults(part, item, at));
    }),
  ];
}

/**
 * The unit's sweep report, null where none is written; refused where it does
 * not read, naming every fault.
 * @param {string} cwd @param {string} unit
 * @returns {SweepReport|null}
 */
function readSweep(cwd, unit) {
  const file = sweepPath(cwd, unit);
  if (!fs.existsSync(file)) return null;
  /** @type {unknown} */
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`the sweep's report, ${file}, is not JSON`);
  }
  const faults = reportFaults(report);
  if (faults.length > 0) throw new Error(`the sweep's report, ${file}, does not read —\n${faults.join('\n')}`);
  return /** @type {SweepReport} */ (report);
}

/** Whether the unit has a sweep report that reads. @param {string} cwd @param {string} unit */
function hasSweepReport(cwd, unit) {
  try {
    return readSweep(cwd, unit) !== null;
  } catch {
    return false;
  }
}

module.exports = { sweepPath, readSweep, hasSweepReport };
