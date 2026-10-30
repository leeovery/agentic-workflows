'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's close (9.7) — the decided screen, `render decided`,
// and the answers its gates lead to, `decided yes|strike`; and the wait for
// the topic's agents still running, `render wait-agents` (9.7.8). Its
// screens are drawn by projections/decided.cjs.
//
// - The screen shows once the topic's `decided` checklist is closed, every
//   engine item holding still and the close not taken by an earlier yes
//   (checklist.cjs): a topic a message set back in progress (10.2.7) is
//   worked afresh and closed again before its gate shows again. It refuses
//   a unit not in progress and a topic whose discussion is not in progress.
// - Claude's payload — the proposed product-record lines and the new-topic
//   candidates — is staged in the topic's cache with `--file`, against the
//   close it was drawn for, and nothing reaches the ledger or the map
//   before the person's yes (8.9.7). A line widens a decision on the
//   topic's map into a rule for the product: an entry of its own at the
//   unit's level, off the topic's map — a question in the wording of the
//   one the decision answers, relying on it, and the line answering that
//   question, relying on the decision too — so neither the map nor the
//   screen changes as it lands. Each line takes its ids as staged, so a yes
//   run again after a kill lands no line twice; a restage keeps the strike
//   of every candidate it still names. Candidates are an epic's alone, each
//   checked by the map's own rules for adding a topic (discovery-map.cjs).
//   The screen draws from the staged payload again without `--file`, the
//   calls listed with `--calls`.
// - Claude's calls are counted by the kind each decision carries; a call
//   the labeller has not reached is counted as unlabelled (16.11).
// - Each departure the person made on the topic that this machine logged —
//   an answer that stood over Claude's lean, or a keep (16.10.1) — is asked
//   its verdict there, one at a time, in the ledger's order, until each has
//   one, a skip among them (16.10.2, 16.10.6); none asked where none was
//   made (16.10.5). The verdict is `verdict give … --at decided`.
// - The decided gate never learns: it stops in every position (3.2.3), and
//   its name is `decided` for good (16.11.9). Its yes, `decided yes`, stands
//   on the screen as drawn: the close the payload was staged against, and
//   no verdict still to ask. Every line and every candidate not struck is
//   checked against the ledger and the map as they stand, by the checks
//   their landing makes, before anything is written, so a refused yes
//   writes nothing. Then it lands each line — its question, then the
//   person's product-wide decision answering it (by the person, their own,
//   moving no one: their yes over Claude's line) — each through the
//   ledger's lock with its commit; then, in one manifest save and its
//   commit, adds the candidates not struck to the epic's map, each routed
//   to discussion from the topic, marks the topic decided, and records
//   that the yes took the close. The staged payload goes. It
//   answers what comes next: an epic's menu, else today's specification
//   (9.7.6 waits on 29.15).
// - `decided strike <n>` strikes the n-th candidate, numbered as the screen
//   shows them, in the staged payload alone, and answers the screen again
//   as what comes next (P8).
// - The wait for agents shows only while one of the topic's agents is
//   running, and is empty otherwise; a report that lands after the session
//   left is taken in at the next entry (enter.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { carrying } = require('./ledger.cjs');
const { newId, resolveId } = require('./ledger-ids.cjs');
const { factsOf, isLive } = require('./ledger-fold.cjs');
const { readShown, answerMap } = require('./ledger-read.cjs');
const { departureRow } = require('./ledger-verdicts.cjs');
const { landRaised, checkRaised } = require('./ledger-write.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { itemOf } = require('./derivations.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { decidedClose, takeDecidedClose } = require('./checklist.cjs');
const { checkBatchEntries, addBatchTo } = require('./discovery-map.cjs');
const { runningAgents } = require('./agent-state.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');
const { INDEXED_ARTIFACTS } = require('./knowledge/artifacts.cjs');
const { closedBy, answersOn, claudesCalls, topicAddress } = require('./topic-map.cjs');
const { decidedScreen, strikePick, waitAgents } = require('./projections/decided.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./topic-map.cjs').Row} Row */
/** @typedef {import('./projections/decided.cjs').DecidedView} DecidedView */

/**
 * A product-record line as staged: the ids its question and it land as, its
 * text and why, the decision it widens by full id, and its question's
 * wording.
 * @typedef {{id: string, question: string, asks: string, text: string, why: string, widens: string}} StagedLine
 */

/** A new-topic candidate as staged, struck or standing. @typedef {{name: string, reason: string, struck: boolean}} StagedCandidate */

/**
 * Claude's payload as staged in the topic's cache, against the close it was
 * drawn for.
 * @typedef {{closed: string, lines: StagedLine[], candidates: StagedCandidate[]}} Staged
 */

const PHASE = 'discussion';
const DECIDED_USAGE = [
  'decided yes <work-unit> <topic>',
  'decided strike <work-unit> <topic> <n>',
].join('\n');
const DECIDED_STANDS = ['answered', 'merged', 'question-set-aside'];

/** Where the topic's staged payload sits in its cache. @param {string} cwd @param {string} unit @param {string} topic */
function stagedFile(cwd, unit, topic) {
  return statePath(cwd, '.cache', unit, PHASE, topic, 'decided.json');
}

/** A refusal opening on the command that refused, what it carries kept. @param {string} said @param {unknown} err */
function refusedAs(said, err) {
  const refused = err instanceof Error ? err : new Error(messageOf(err));
  if (!refused.message.startsWith(`${said}: `)) refused.message = `${said}: ${refused.message}`;
  return refused;
}

/**
 * The unit's manifest, its topic's discussion in progress: refused for a
 * unit not in progress, a topic with no discussion, and one decided already
 * or not under way.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {Record<string, any>}
 */
function openTopic(cwd, unit, topic) {
  const manifest = unitInProgress(cwd, unit);
  const status = itemOf(manifest, PHASE, topic)?.status;
  if (status === undefined) throw new Error(`${unit} has no discussion of "${topic}"`);
  if (status === 'completed') throw new Error(`${topic} is decided already — a message to it sets it back in progress`);
  if (status !== 'in-progress') throw new Error(`${topic}'s discussion is ${status}, not in progress`);
  return manifest;
}

/** A non-empty string. @param {unknown} v @returns {v is string} */
function filled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** Refuses an object whose keys are not exactly `keys`. @param {unknown} v @param {string} what @param {string[]} keys */
function shaped(v, what, keys) {
  if (!isObject(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) throw new Error(`${what} must be {${keys.join(', ')}}`);
  return /** @type {Record<string, unknown>} */ (v);
}

/**
 * The wording of the map's question a line's decision answers there, by the
 * decision's short id: refused where the decision is on no row of the map,
 * or stands alone, its question set aside.
 * @param {Shower} shower @param {Row[]} rows @param {string} decision a full id
 */
function questionOn(shower, rows, decision) {
  const short = shower.short(decision);
  const row = rows.find((r) => answersOn(r).some((a) => a.id === short));
  if (row === undefined) throw new Error(`${short} is no decision on the topic's map`);
  if (row.stands === 'question-set-aside') throw new Error(`${short}'s question is set aside, so there is no question for its line to answer`);
  return row.text;
}

/**
 * A line as Claude's payload gives it, staged, its ids minted: refused
 * where it is not `{text, why, widens}` or `widens` names no decision on
 * the map.
 * @param {Shower} shower @param {Row[]} rows @param {unknown} given @param {number} at
 * @returns {StagedLine}
 */
function stagedLine(shower, rows, given, at) {
  const what = `line ${at + 1}`;
  const { text, why, widens } = shaped(given, what, ['text', 'why', 'widens']);
  if (!filled(text) || !filled(why) || !filled(widens)) throw new Error(`${what}'s text, why and widens are each a non-empty string`);
  let decision;
  let asks;
  try {
    decision = resolveId(widens, shower.folded.facts.keys());
    if (factsOf(shower.folded, decision).kind !== 'decision') throw new Error(`${widens} is no decision`);
    asks = questionOn(shower, rows, decision);
  } catch (err) {
    throw new Error(`${what} widens ${widens}: ${messageOf(err)}`);
  }
  return { id: newId(), question: newId(), asks, text, why, widens: decision };
}

/** How a candidate dismissed from the map is re-added: by the person, on the map. */
const RE_ADD = 'the person re-adds it on the map';

/**
 * The candidates as the map adds them: each a topic routed to discussion
 * from this one, its reason its summary.
 * @param {string} topic @param {{name: string, reason: string}[]} candidates
 */
function mapEntries(topic, candidates) {
  return candidates.map(({ name, reason }) => ({ name, routing: PHASE, summary: reason, source: `topic:${topic}` }));
}

/**
 * Refused, in the words of `said`, where the epic's map would refuse to add
 * the candidates as it stands — by the map's own rules, writing nothing.
 * @param {Record<string, any>} manifest @param {string} topic @param {{name: string, reason: string}[]} candidates @param {string} said
 */
function checkCandidates(manifest, topic, candidates, said) {
  if (candidates.length === 0) return;
  const entries = mapEntries(topic, candidates);
  checkBatchEntries(entries, said);
  addBatchTo(structuredClone(manifest), entries, said, RE_ADD);
}

/**
 * The candidates as Claude's payload gives them, staged: an epic's alone,
 * each `{name, reason}` the map can take, struck where the candidate of
 * that name staged before was.
 * @param {Record<string, any>} manifest @param {string} topic @param {unknown[]} given @param {StagedCandidate[]} before
 * @returns {StagedCandidate[]}
 */
function stagedCandidates(manifest, topic, given, before) {
  if (given.length > 0 && manifest.work_type !== 'epic') throw new Error(`a ${manifest.work_type} has no map to add a topic to — candidates are an epic's`);
  const candidates = given.map((candidate, at) => {
    const what = `candidate ${at + 1}`;
    const { name, reason } = shaped(candidate, what, ['name', 'reason']);
    if (!filled(name) || !filled(reason)) throw new Error(`${what}'s name and reason are each a non-empty string`);
    return { name, reason };
  });
  checkCandidates(manifest, topic, candidates, 'the candidates');
  const struck = new Set(before.filter((candidate) => candidate.struck).map(({ name }) => name));
  return candidates.map(({ name, reason }) => ({ name, reason, struck: struck.has(name) }));
}

/**
 * Claude's payload read from `file`, checked against the map and the unit,
 * and staged in the topic's cache against `closed`.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} file
 * @param {{shower: Shower, rows: Row[], manifest: Record<string, any>, closed: string}} at
 * @returns {Staged}
 */
function stage(cwd, unit, topic, file, { shower, rows, manifest, closed }) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  } catch (err) {
    throw new Error(`the payload ${file} cannot be read as JSON — ${messageOf(err)}`);
  }
  const { lines, candidates } = shaped(parsed, 'the payload', ['lines', 'candidates']);
  if (!Array.isArray(lines) || !Array.isArray(candidates)) throw new Error('the payload\'s lines and candidates are each a list');
  /** @type {Staged} */
  const staged = {
    closed,
    lines: lines.map((line, i) => stagedLine(shower, rows, line, i)),
    candidates: stagedCandidates(manifest, topic, candidates, stagedBefore(cwd, unit, topic)),
  };
  fs.mkdirSync(path.dirname(stagedFile(cwd, unit, topic)), { recursive: true });
  writeJsonAtomic(stagedFile(cwd, unit, topic), staged);
  return staged;
}

/**
 * The candidates staged for the topic, whatever close they were drawn for:
 * none where nothing is.
 * @param {string} cwd @param {string} unit @param {string} topic
 * @returns {StagedCandidate[]}
 */
function stagedBefore(cwd, unit, topic) {
  const file = stagedFile(cwd, unit, topic);
  return fs.existsSync(file) ? /** @type {Staged} */ (JSON.parse(fs.readFileSync(file, 'utf8'))).candidates : [];
}

/**
 * The payload staged for the topic's close: refused where none is, or it
 * was staged against an earlier close.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} closed
 * @returns {Staged}
 */
function stagedFor(cwd, unit, topic, closed) {
  const file = stagedFile(cwd, unit, topic);
  if (!fs.existsSync(file)) throw new Error(`nothing is staged for ${topic} — render decided ${unit}.${topic} --file <payload.json> stages Claude's lines and candidates`);
  const staged = /** @type {Staged} */ (JSON.parse(fs.readFileSync(file, 'utf8')));
  if (staged.closed !== closed) throw new Error(`what is staged for ${topic} was drawn for an earlier close — it is staged again with --file`);
  return staged;
}

/**
 * The departure the decided screen asks its verdict of: the first on the
 * topic this machine logged, live, never given a verdict here or anywhere,
 * a skip among them; with where it stands among the topic's departures.
 * Null where none waits.
 * @param {Shower} shower @param {string} root @param {string} unit @param {string} topic
 * @returns {DecidedView['verdict']}
 */
function verdictAsked(shower, root, unit, topic) {
  const { folded } = shower;
  const evidence = evidenceOf(root);
  const departures = [...folded.facts.keys()].filter((id) => {
    const facts = factsOf(folded, id);
    return evidence.departures.has(id) && isLive(folded, id) && facts.unit === unit && facts.topic === topic;
  });
  const waiting = departures.filter((id) => !evidence.asked.has(id));
  if (waiting.length === 0) return null;
  const [entry] = waiting;
  const row = departureRow(shower, entry);
  const facts = factsOf(folded, entry);
  const decision = facts.event === 'kept' ? /** @type {string} */ (facts.entry) : entry;
  const question = shower.show(/** @type {string} */ (factsOf(folded, decision).answers)).text;
  return {
    entry,
    at: departures.length - waiting.length + 1,
    of: departures.length,
    question: /** @type {string} */ (question),
    lean: /** @type {string|null} */ (row.lean),
    yours: /** @type {string} */ (row.text),
  };
}

/**
 * The record's side of the decided screen, read in one pass of the ledger:
 * the topic's map rows, what the person decided, Claude's calls with the
 * kind each carries, and the verdict asked.
 * @param {Shower} shower @param {string} root @param {string} unit @param {string} topic
 */
function recordSide(shower, root, unit, topic) {
  const rows = /** @type {Row[]} */ (answerMap(shower, { unit, topic }, root).questions);
  const decided = rows.filter((row) => DECIDED_STANDS.includes(row.stands) && closedBy(answersOn(row)).tag === 'yours').map((row) => row.text);
  const calls = claudesCalls(rows).map(({ answer, question }) => ({
    question,
    answer: answer.text,
    kind: /** @type {string|null} */ (shower.show(resolveId(answer.id, shower.folded.facts.keys())).kind),
  }));
  return { rows, decided, calls, verdict: verdictAsked(shower, root, unit, topic) };
}

/**
 * What the decided screen needs, refused where it cannot show: the topic
 * open, its checklist closed and the close not taken, and the record read;
 * and `then`, given what it read, the payload staged or read back.
 * @template T
 * @param {string} cwd @param {string} unit @param {string} topic
 * @param {(read: {shower: Shower, root: string, manifest: Record<string, any>, closed: string, skips: import('./checklist.cjs').Skip[], side: ReturnType<typeof recordSide>}) => T} then
 * @returns {T}
 */
function onClosedTopic(cwd, unit, topic, then) {
  /** @type {string[]} */
  const warnings = [];
  try {
    const manifest = openTopic(cwd, unit, topic);
    const { closed, skips } = decidedClose(cwd, unit, topic);
    const root = stateRoot(cwd);
    return readShown(root, warnings, (shower) => then({ shower, root, manifest, closed, skips, side: recordSide(shower, root, unit, topic) }));
  } catch (err) {
    throw carrying(err, warnings);
  }
}

/**
 * `render decided <unit>.<topic> [--file <payload.json>] [--calls]`: the
 * decided screen, Claude's payload staged from `--file` or read back as
 * staged, its calls listed with `--calls`.
 * @param {string} cwd @param {{dotpath?: string, file?: string, calls?: string}} args
 * @returns {string}
 */
function decidedSurface(cwd, { dotpath, file, calls }) {
  try {
    const { unit, topic } = topicAddress(stateRoot(cwd), dotpath, 'decided');
    return onClosedTopic(cwd, unit, topic, ({ shower, manifest, closed, skips, side }) => {
      const staged = file === undefined ? stagedFor(cwd, unit, topic, closed) : stage(cwd, unit, topic, file, { shower, rows: side.rows, manifest, closed });
      return decidedScreen({
        unit,
        topic,
        decided: side.decided,
        calls: side.calls,
        listed: calls !== undefined,
        lines: staged.lines.map((line) => line.text),
        candidates: staged.candidates,
        skips: skips.map(({ text, reason }) => ({ text, reason })),
        verdict: side.verdict,
      });
    });
  } catch (err) {
    throw refusedAs('render decided', err);
  }
}

/**
 * `render decided-strike <unit>.<topic>`: the pick of the candidate to
 * strike, from the staged payload, where more than one stands.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function decidedStrikeSurface(cwd, { dotpath }) {
  try {
    const { unit, topic } = topicAddress(stateRoot(cwd), dotpath, 'decided-strike');
    openTopic(cwd, unit, topic);
    const { closed } = decidedClose(cwd, unit, topic);
    const { candidates } = stagedFor(cwd, unit, topic, closed);
    if (candidates.filter(({ struck }) => !struck).length < 2) throw new Error('the pick is for more than one candidate standing — the decided gate strikes a lone one itself');
    return strikePick({ unit, topic, candidates });
  } catch (err) {
    throw refusedAs('render decided-strike', err);
  }
}

/**
 * `render wait-agents <unit>.<topic>`: the wait for the topic's agents still
 * running, or nothing where none is.
 * @param {string} cwd @param {{dotpath?: string}} args
 * @returns {string}
 */
function waitAgentsSurface(cwd, { dotpath }) {
  const { unit, topic, manifest } = topicAddress(stateRoot(cwd), dotpath, 'wait-agents');
  if (itemOf(manifest, PHASE, topic) === undefined) throw new Error(`render wait-agents: ${unit} has no discussion of "${topic}"`);
  const running = runningAgents(cwd, unit, PHASE, topic);
  return running.length === 0 ? '' : waitAgents(topic, running.map(({ kind }) => kind));
}

/**
 * What comes after a topic is decided: an epic's menu; else, until a
 * feature's decided is its ready to build (29.15), today's specification.
 * @param {Record<string, any>} manifest @param {string} unit
 * @returns {import('./projections/surfaces.cjs').Next}
 */
function nextAfter(manifest, unit) {
  return manifest.work_type === 'epic'
    ? { kind: 'handoff', skill: 'leeway-continue-epic', args: [unit, PHASE, 'completed'] }
    : { kind: 'handoff', skill: 'leeway-specification-process', args: [manifest.work_type, unit] };
}

/**
 * The two raises a staged line lands as, at the unit's level: its question,
 * relying on the decision it widens, and the person's product-wide
 * decision answering it.
 * @param {string} unit @param {StagedLine} line
 * @returns {[import('./ledger-write.cjs').Raised, import('./ledger-write.cjs').Raised]}
 */
function lineRaises(unit, { id, question, asks, text, why, widens }) {
  const place = { unit, phase: PHASE, topic: null };
  const common = { said: 'decided yes', place, logs: null, checkRead: () => {} };
  return [
    { ...common, lands: 'ask', linked: { relies_on: [widens] }, content: { by: 'claude', who_moved_whom: 'none', text: asks }, id: question },
    { ...common, lands: 'decide', linked: { answers: question, relies_on: [widens] }, content: { by: 'person', who_moved_whom: 'none', given: 'own', text, why, product_wide: true }, id },
  ];
}

/**
 * Refused where a staged line could not land as the ledger stands — the
 * decision it widens no longer current, or the unit no longer taking
 * writes — by the check its question's landing makes, writing nothing.
 * @param {string} cwd @param {string} unit @param {StagedLine[]} lines @param {string[]} warnings
 */
function checkLines(cwd, unit, lines, warnings) {
  lines.forEach((line, at) => {
    try {
      checkRaised(cwd, lineRaises(unit, line)[0], warnings);
    } catch (err) {
      throw new Error(`line ${at + 1} cannot land — ${messageOf(err).replace(/^decided yes: /, '')}; it is staged again with --file`);
    }
  });
}

/**
 * `decided yes <unit> <topic>`: the person's yes at the decided gate,
 * everything it writes checked before any of it is written.
 * @param {string} cwd @param {string} unit @param {string} topic
 */
function decidedYes(cwd, unit, topic) {
  if (handedSession() === null) throw new Error('no conversation to write in — Claude Code hands every command it runs a session id, and this one has none');
  /** @type {string[]} */
  const warnings = [];
  const staged = onClosedTopic(cwd, unit, topic, ({ closed, side }) => {
    const ready = stagedFor(cwd, unit, topic, closed);
    if (side.verdict !== null) throw new Error('a verdict is still to ask — render decided asks each before the yes');
    return ready;
  });
  const added = staged.candidates.filter(({ struck }) => !struck);
  checkCandidates(loadWorkUnitManifest(cwd, unit), topic, added, 'the candidates');
  checkLines(cwd, unit, staged.lines, warnings);
  const lines = staged.lines.map((line) => lineRaises(unit, line).map((raised) => landRaised(cwd, raised, warnings).landed.id)[1]);
  const at = new Date().toISOString();
  const manifest = withWorkUnitLock(cwd, unit, () => {
    const fresh = loadWorkUnitManifest(cwd, unit);
    if (added.length > 0) addBatchTo(fresh, mapEntries(topic, added), 'the candidates', RE_ADD);
    fresh.phases[PHASE].items[topic].status = 'completed';
    takeDecidedClose(fresh, topic, at);
    saveWorkUnitManifest(cwd, unit, fresh);
    return fresh;
  });
  const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `decided(${unit}): ${topic}`, warnings);
  const artifact = INDEXED_ARTIFACTS[PHASE];
  if (artifact) syncKnowledge(cwd, [{ index: artifact(unit, topic) }], warnings);
  fs.rmSync(stagedFile(cwd, unit, topic), { force: true });
  /** @type {Record<string, unknown>} */
  const result = { unit, topic, decided: at, lines, candidates: added.map(({ name }) => name), committed: outcome.committed, next: nextAfter(manifest, unit) };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/**
 * `decided strike <unit> <topic> <n>`: the n-th candidate struck in the
 * staged payload, answering the screen as what comes next.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} n
 */
function decidedStrike(cwd, unit, topic, n) {
  openTopic(cwd, unit, topic);
  const { closed } = decidedClose(cwd, unit, topic);
  const staged = stagedFor(cwd, unit, topic, closed);
  const at = /^[1-9][0-9]*$/.test(n) ? Number(n) : 0;
  const candidate = staged.candidates[at - 1];
  if (candidate === undefined) throw new Error(`there is no candidate ${n} — the candidates are 1 to ${staged.candidates.length}`);
  if (candidate.struck) throw new Error(`"${candidate.name}" is struck already`);
  candidate.struck = true;
  writeJsonAtomic(stagedFile(cwd, unit, topic), staged);
  return { unit, topic, struck: candidate.name, next: { kind: 'engine', argv: ['render', 'decided', `${unit}.${topic}`] } };
}

/**
 * `decided <yes|strike> …`: the verb's answer, every refusal opening on its
 * command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runDecidedVerb(cwd, [verb, ...args]) {
  const usage = () => new Error(`Usage: ${DECIDED_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
  if (verb === 'yes' && args.length === 2) return refusing('decided yes', () => decidedYes(cwd, args[0], args[1]));
  if (verb === 'strike' && args.length === 3) return refusing('decided strike', () => decidedStrike(cwd, args[0], args[1], args[2]));
  throw usage();
}

/**
 * `answer`'s answer, its refusal opening on `said`.
 * @param {string} said @param {() => Record<string, unknown>} answer
 */
function refusing(said, answer) {
  try {
    return answer();
  } catch (err) {
    throw refusedAs(said, err);
  }
}

module.exports = { DECIDED_USAGE, runDecidedVerb, decidedSurface, decidedStrikeSurface, waitAgentsSurface };
