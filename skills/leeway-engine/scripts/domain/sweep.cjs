'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the sweep's report and its taking (8.10.3–8.10.5, 11.2.2).
//
// The report is what the sweep before the spec found across an epic's
// records, written by its agent (`leeway-sweep`, briefed by `brief sweep
// <unit>`) as JSON in the unit's spec cache,
// `.cache/{unit}/specification/sweep.json`, beside the cut's staged cut. Its
// three parts, each a list, maybe empty:
// - `candidates`, work no topic owns that holds a call the person would
//   make (8.10.5), each `{name, reason, brief, from_roadmap?}`: the topic it
//   would land as, why it falls between the topics, its brief's text —
//   what it is, where it was read, why it matters and its open questions
//   (8.10.10) — and the waiting roadmap item it takes in, where it takes
//   one (8.1.6);
// - `messages`, work that only carries a decision into other topics, each
//   `{topic, text}`: the topic, by its name or title, and the message, its
//   first line its title; `sent`, the message's path in the state, is the
//   take's mark that it went, so a take run again sends it never twice;
// - `builder_calls`, the calls the person would leave, each `{call, why}`.
// The report reads where it holds that shape and nothing else, each text
// non-empty; it is read whole or refused, naming every fault. Once taken,
// nothing reads it again.
//
// `sweep take` (sweep-take.cjs) takes the report in once, and records what
// it took in the unit's state, `{unit}/sweep-taken.json`, committed: the
// candidates whole, which the map after the sweep is drawn from
// (approve-map.cjs), and the builder's calls, each given its id, `call-N`
// in the report's order — a form no ledger id takes, which holds letters and
// digits alone (ledger-ids.cjs) — by which a spec line left to the builder
// cites the call (11.4.4): the spec's writer is briefed with them, and its
// trace resolves a builder's cite against them (`builderCalls`). One sweep
// for the spec: the record standing is the sweep run, never the cache. A
// candidate waits on the person until approve the map answers it — taken
// onto the map or struck from it, each on the unit's manifest
// (`candidatesWaiting`). The sweep's step is done once it is taken and no
// candidate waits: ready to build's sweep-run (checklist.cjs), and the
// spec's land and the writer's brief, refused until then (`sweepWait`), read
// it. The sweep is owed by an epic with more than one live topic
// (`sweepApplies`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { liveTopics } = require('./ledger-units.cjs');
const { dismissedNames } = require('./derivations.cjs');

/** @typedef {{name: string, reason: string, brief: string, from_roadmap?: string}} SweepCandidate */
/** @typedef {{topic: string, text: string, sent?: string}} SweepMessage */
/** @typedef {{call: string, why: string}} BuilderCall */
/** A builder's call as the sweep taken records it, with its id. @typedef {BuilderCall & {id: string}} RecordedCall */
/** @typedef {{candidates: SweepCandidate[], messages: SweepMessage[], builder_calls: BuilderCall[]}} SweepReport */
/** @typedef {{candidates: SweepCandidate[], builder_calls: RecordedCall[]}} SweepTaken */

/**
 * Each part of the report: the fields each of its items holds, and those an item may leave out.
 * @type {Readonly<Record<keyof SweepReport, {item: string, fields: string[], optional: string[]}>>}
 */
const PARTS = Object.freeze({
  candidates: { item: 'candidate', fields: ['name', 'reason', 'brief'], optional: ['from_roadmap'] },
  messages: { item: 'message', fields: ['topic', 'text'], optional: ['sent'] },
  builder_calls: { item: 'builder call', fields: ['call', 'why'], optional: [] },
});

/** The parts, in the order the report holds them. */
const PART_NAMES = /** @type {Array<keyof SweepReport>} */ (Object.keys(PARTS));

/** The record of the sweep taken, state-relative. @param {string} unit */
const takenRel = (unit) => `${unit}/sweep-taken.json`;

/** A builder's call's id, by its place in the report. @param {number} at */
const callId = (at) => `call-${at + 1}`;

/** Whether a cite has a builder's call's form, which no ledger id has. @param {string} cite */
const isCallId = (cite) => /^call-[1-9][0-9]*$/.test(cite);

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

/** Where the record of the unit's sweep taken stands. @param {string} cwd @param {string} unit */
function takenPath(cwd, unit) {
  return statePath(cwd, takenRel(unit));
}

/** The record of the unit's sweep taken, null where it is not. @param {string} cwd @param {string} unit @returns {SweepTaken|null} */
function readTaken(cwd, unit) {
  const file = takenPath(cwd, unit);
  return fs.existsSync(file) ? /** @type {SweepTaken} */ (JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
}

/** The calls the sweep left to the builder, each with its id, as the sweep taken records them; none before it is taken, or where no sweep is owed. @param {string} cwd @param {string} unit @returns {RecordedCall[]} */
function builderCalls(cwd, unit) {
  return readTaken(cwd, unit)?.builder_calls ?? [];
}

/** Whether the unit's sweep is taken. @param {string} cwd @param {string} unit */
function sweepTaken(cwd, unit) {
  return fs.existsSync(takenPath(cwd, unit));
}

/** Whether the unit owes a sweep before its spec: an epic with more than one live topic. @param {Record<string, any>} manifest */
function sweepApplies(manifest) {
  return manifest.work_type === 'epic' && liveTopics(manifest.name, manifest).length > 1;
}

/**
 * The names of the sweep's candidates waiting on the person: neither on the
 * unit's map, taken there, nor struck from it — none before the sweep is taken.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {string[]}
 */
function candidatesWaiting(cwd, manifest) {
  const taken = readTaken(cwd, manifest.name);
  if (taken === null) return [];
  const items = manifest.phases?.discovery?.items ?? {};
  const struck = new Set(dismissedNames(manifest));
  return taken.candidates.map(({ name }) => name).filter((name) => !Object.hasOwn(items, name) && !struck.has(name));
}

/**
 * What the spec waits on of the sweep, as the way on, or null: an owed sweep
 * not taken, or its candidates waiting on approve the map.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {string|null}
 */
function sweepWait(cwd, manifest) {
  const unit = manifest.name;
  if (sweepApplies(manifest) && !sweepTaken(cwd, unit)) return `${unit}'s sweep is not taken — it runs before the spec lands: engine brief sweep ${unit}, then engine sweep take ${unit}`;
  const waiting = candidatesWaiting(cwd, manifest);
  return waiting.length === 0 ? null : `${unit}'s sweep found calls waiting on the person — ${waiting.join(', ')} — taken or struck at approve the map: engine render approve-map ${unit} --sweep`;
}

module.exports = { takenRel, callId, isCallId, sweepPath, readSweep, builderCalls, takenPath, readTaken, sweepTaken, sweepApplies, candidatesWaiting, sweepWait };
