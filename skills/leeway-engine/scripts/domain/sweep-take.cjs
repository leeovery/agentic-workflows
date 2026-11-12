'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the sweep taken (8.10.3–8.10.5, 8.10.9) — `sweep take
// <unit>`, the one door by which the sweep's report (sweep.cjs) reaches the
// work, once, before the spec is written.
//
// It reads the report whole and checks it against the unit as it stands
// before anything goes: each message not yet sent goes to a live topic of
// the unit, named by its key or its title, and each candidate lands as
// `topic add-batch` would land it — a name that is no topic's or stands
// twice, one on the map, one struck from it before (8.10.11), or beside a
// waiting roadmap item it does not take in (8.1.6), is refused. Then it
// sends each message not yet sent from `{unit}.specification`, through
// mail's own send, which reopens a decided topic (10.2.7) and draws no
// report (mail.cjs); marks each in the report as it goes, so a take killed
// part-way and run again sends none twice; records the sweep taken,
// committed — the candidates whole, and the builder's calls, each with its
// id (sweep.cjs) — and stages the candidates for approve the map
// (approve-map.cjs).
//
// What comes next: approve the map, drawn from the sweep taken, where it
// found a candidate; else the epic's menu where a message reopened a topic;
// else the spec carries on.
//
// It refuses, every refusal opening `sweep take: ` and sending nothing: a
// unit not in progress or no epic; one past its spec, whose map is closed
// (P3); one whose live topics are not every one decided, or that has one
// live topic alone, which owes no sweep; a sweep taken already, one sweep
// for the spec; no report, or one that does not read; and a message or a
// candidate that does not hold. `sweepRefusal` answers the report's own
// refusals, read without writing, for the sweep's next brief.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { computeTopicLifecycle, itemOf, topicKey, noTopicRefusal } = require('./derivations.cjs');
const { assertBeforeSpec, topicsSettled } = require('./spec-standing.cjs');
const { sendMessage } = require('./mail.cjs');
const { isLive, checkCandidates, stageSwept } = require('./approve-map.cjs');
const { takenRel, callId, sweepPath, readSweep, sweepTaken, sweepApplies } = require('./sweep.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { refusing } = require('./staged-payload.cjs');
const { ontoEpic } = require('./topic-leave.cjs');

const SWEEP_USAGE = 'sweep take <work-unit>';

/** @typedef {import('./sweep.cjs').SweepReport} SweepReport */
/** @typedef {import('./sweep.cjs').SweepMessage} SweepMessage */

/**
 * The faults of the messages not yet sent: each goes to a live topic of the
 * unit, named by its key or its title.
 * @param {Record<string, any>} manifest @param {SweepMessage[]} messages
 * @returns {string[]}
 */
function messageFaults(manifest, messages) {
  return messages.flatMap(({ topic: said, sent }, at) => {
    if (sent !== undefined) return [];
    const key = topicKey(manifest, said);
    if (!itemOf(manifest, 'discovery', key)) return [`message ${at + 1}: ${noTopicRefusal(manifest, said)}`];
    return isLive(manifest, key) ? [] : [`message ${at + 1} goes to "${said}", which is ${computeTopicLifecycle(manifest, key).lifecycle} — a message goes to a live topic`];
  });
}

/**
 * The report held to the unit as it stands, refused naming its faults: a
 * message to a topic that is not live, then a candidate that could not land.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {SweepReport} report
 */
function checkReport(cwd, unit, manifest, report) {
  const faults = messageFaults(manifest, report.messages);
  if (faults.length > 0) throw new Error(`the sweep's messages do not hold —\n${faults.join('\n')}`);
  checkCandidates(cwd, unit, manifest, report.candidates);
}

/**
 * What the take refuses of the unit's sweep report, as it says it, read
 * without writing: null where no report is written or it would be taken in.
 * @param {string} cwd @param {string} unit
 * @returns {string|null}
 */
function sweepRefusal(cwd, unit) {
  try {
    const report = readSweep(cwd, unit);
    if (report !== null) checkReport(cwd, unit, loadWorkUnitManifest(cwd, unit), report);
    return null;
  } catch (err) {
    return messageOf(err);
  }
}

/**
 * The epic's manifest, its sweep owed and not yet taken: refused for a unit
 * not in progress or no epic, one past its spec, one whose topics are not
 * every one decided or that has one live topic alone, and a sweep taken.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function owingSweep(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  if (manifest.work_type !== 'epic') throw new Error(`${unit} is a ${manifest.work_type} — a sweep reads across an epic's topics`);
  assertBeforeSpec(cwd, manifest, 'sweep');
  if (sweepTaken(cwd, unit)) throw new Error(`${unit}'s sweep is taken already — one sweep for the spec (8.10.3)`);
  if (!topicsSettled(manifest)) throw new Error(`${unit}'s live topics are not every one decided — the sweep reads them once they are (8.10.3)`);
  if (!sweepApplies(manifest)) throw new Error(`${unit} has one live topic — a sweep reads between topics, so there is none to take`);
  return manifest;
}

/** A message's slug, from its title: a kebab-case slug, or its place where its title spells none. @param {string} text @param {number} at */
function slugOf(text, at) {
  const slug = text.split('\n', 1)[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48).replace(/^-+|-+$/g, '');
  return slug === '' ? `sweep-message-${at + 1}` : slug;
}

/**
 * Send each message not yet sent from the unit's spec, marking it in the
 * report once it lands. Answers each send's answer, in the report's order.
 * @param {string} cwd @param {string} unit @param {SweepReport} report
 * @returns {Record<string, any>[]}
 */
function sendMessages(cwd, unit, report) {
  const scratch = statePath(cwd, '.cache', unit, 'specification', 'sweep-message.md');
  return report.messages.flatMap((message, at) => {
    if (message.sent !== undefined) return [];
    fs.writeFileSync(scratch, message.text.endsWith('\n') ? message.text : `${message.text}\n`);
    const sent = sendMessage(cwd, unit, message.topic, { from: `${unit}.specification`, contentFile: scratch, slug: slugOf(message.text, at) });
    message.sent = path.relative(stateRoot(cwd), String(sent.message_path));
    writeJsonAtomic(sweepPath(cwd, unit), report);
    return [sent];
  });
}

/** What comes after the take. @param {string} unit @param {boolean} candidates @param {Record<string, any>} manifest as the sends left it */
function nextAfterTake(unit, candidates, manifest) {
  if (candidates) return { kind: 'engine', argv: ['render', 'approve-map', unit, '--sweep'] };
  return topicsSettled(manifest) ? { kind: 'continue' } : ontoEpic(unit);
}

/**
 * `sweep take <unit>`: the sweep's report checked, its messages sent, the
 * sweep taken recorded and committed, and its candidates staged.
 * @param {string} cwd @param {string} unit
 * @returns {Record<string, unknown>}
 */
function takeSweep(cwd, unit) {
  const manifest = owingSweep(cwd, unit);
  const report = readSweep(cwd, unit);
  if (report === null) throw new Error(`${unit} has no sweep report — the sweep writes it, briefed by engine brief sweep ${unit}`);
  checkReport(cwd, unit, manifest, report);
  const sends = sendMessages(cwd, unit, report);
  fs.mkdirSync(statePath(cwd, unit), { recursive: true });
  writeJsonAtomic(statePath(cwd, takenRel(unit)), {
    candidates: report.candidates,
    builder_calls: report.builder_calls.map((call, at) => ({ id: callId(at), ...call })),
  });
  /** @type {string[]} */
  const warnings = sends.flatMap((sent) => sent.warnings ?? []);
  const outcome = commitStateTail(cwd, [takenRel(unit)], `sweep(${unit}): taken`, warnings);
  const after = loadWorkUnitManifest(cwd, unit);
  if (report.candidates.length > 0) stageSwept(cwd, unit, after);
  /** @type {Record<string, unknown>} */
  const result = {
    unit,
    sent: sends.map(({ topic, message_path: message }) => ({ topic, message })),
    reopened: sends.filter((sent) => sent.reopened === true).map(({ topic }) => topic),
    candidates: report.candidates.map(({ name }) => name),
    committed: outcome.committed,
    next: nextAfterTake(unit, report.candidates.length > 0, after),
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * `sweep take <unit>`: the verb's answer, its refusal opening on its command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runSweepVerb(cwd, argv) {
  if (argv.length !== 2 || argv[0] !== 'take') throw new Error(`Usage: engine ${SWEEP_USAGE}`);
  return refusing('sweep take', () => takeSweep(cwd, argv[1]));
}

module.exports = { SWEEP_USAGE, runSweepVerb, sweepRefusal };
