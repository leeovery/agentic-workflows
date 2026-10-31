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
// - Claude's payload — the proposed product-record lines, the record's lines it
//   withdraws, and the new-topic candidates — is staged in the topic's cache
//   with `--file`, against the close it was drawn for, and nothing reaches the
//   ledger or the map before the person's yes (8.9.7). A line widens a decision
//   on the topic's map into a rule for the product: an entry of its own at the
//   unit's level, off the topic's map — a question in the wording of the one
//   the decision answers, relying on it, and the line answering that question,
//   relying on the decision too — so neither the map nor the screen changes as
//   it lands. Each line takes its ids as staged, so a yes run again after a
//   kill lands no line twice; and a decision the product record widens already
//   takes no second line, so a restage after that kill, or after a reopen,
//   lands none twice either; nor does a payload widen one decision twice. A
//   line widening a decision that replaced one a line of the record widens
//   lands as the person's replacement of that line, at the same yes (8.9.2),
//   the screen showing the text it replaces; and the yes refuses while a line
//   of the record widens a decision of the topic replaced since and nothing
//   staged replaces or withdraws it, so the record never holds two rules for
//   one call. A withdrawal takes a line of the record widening a decision of
//   the topic out of the record, the screen showing the text it withdraws: it
//   lands as the person's replacement of that line by the decision the widened
//   one now stands as, at the unit's level and not for the product (8.9.2), so
//   the line leaves the product record and its trail stays. A restage keeps the
//   strike of every candidate it still names. Candidates are an epic's alone,
//   each checked by the map's own rules for adding a topic (discovery-map.cjs).
//   The screen draws from the staged payload again without `--file`, the calls
//   listed with `--calls`.
// - What the person decided is shown apart from the rows carried over,
//   which never pass as theirs (21.6.5), and from Claude's calls, counted by
//   the kind each decision carries; a call the labeller has not reached is
//   counted as unlabelled (16.11).
// - Each departure the person made on the topic that this machine logged —
//   an answer that stood over Claude's lean, or a keep (16.10.1) — is asked
//   its verdict there, one at a time, in the ledger's order, until each has
//   one, a skip among them (16.10.2, 16.10.6); none asked where none was
//   made (16.10.5). The count is of the departures this close asks: one
//   given its verdict before it is not among them. The verdict is
//   `verdict give … --at decided`.
// - The decided gate never learns: it stops in every position (3.2.3), and
//   its name is `decided` for good (16.11.9). Its yes, `decided yes`, stands
//   on the screen as drawn: the close the payload was staged against, and
//   no verdict still to ask. Every line and every candidate not struck is
//   checked against the ledger and the map as they stand, by the checks
//   their landing makes, before anything is written, so a refused yes
//   writes nothing. Then it lands each line — its question, then the
//   person's product-wide decision answering it (by the person, their own,
//   moving no one: their yes over Claude's line) — each through the
//   ledger's lock with its commit, a line or withdrawal its first run
//   landed passing its check and landing nothing again; then, in one
//   manifest save and its commit, adds the candidates not struck to the
//   epic's map, each its source the topic, marks the topic
//   decided, and records that the yes took the close. Each withdrawal lands
//   as the lines do, after them. The staged payload goes. It
//   answers what comes next: an epic's menu, else today's specification
//   (9.7.6 waits on 29.15).
// - `decided strike <n>` strikes the n-th candidate, numbered as the screen
//   shows them, in the staged payload alone, and answers the screen again
//   as what comes next (P8); `decided unstrike <n>` undoes it, for a person
//   who keeps the candidate after all.
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
const { factsOf, productOf, notCurrent, currentsOf } = require('./ledger-fold.cjs');
const { readShown, answerMap } = require('./ledger-read.cjs');
const { departureRow } = require('./ledger-verdicts.cjs');
const { landRaised, checkRaised } = require('./ledger-write.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { itemOf, topicTitle } = require('./derivations.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { decidedClose, takeDecidedClose } = require('./checklist.cjs');
const { checkBatchEntries, addBatchTo } = require('./discovery-map.cjs');
const { runningAgents } = require('./agent-state.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { rowStanding, answersOn, claudesCalls, handedTag, topicAddress } = require('./topic-map.cjs');
const { decidedScreen, strikePick, waitAgents } = require('./projections/decided.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./topic-map.cjs').Row} Row */
/** @typedef {import('./projections/decided.cjs').DecidedView} DecidedView */

/**
 * A product-record line as staged: the ids its question and it land as, its
 * text and why, the decision it widens by full id, its question's wording,
 * and the product-record line it replaces — the one widening a decision
 * this one replaced — by full id and text, null where it replaces none.
 * @typedef {{id: string, question: string, asks: string, text: string, why: string, widens: string, replaces: {id: string, text: string}|null}} StagedLine
 */

/**
 * A product-record line withdrawn, as staged: the id its withdrawal lands
 * as, the line by full id and text, why, and the decision the one it widens
 * now stands as, by full id and text.
 * @typedef {{id: string, line: string, text: string, why: string, now: {id: string, text: string}}} StagedWithdrawal
 */

/** A new-topic candidate as staged, struck or standing. @typedef {{name: string, reason: string, struck: boolean}} StagedCandidate */

/**
 * Claude's payload as staged in the topic's cache, against the close it was
 * drawn for.
 * @typedef {{closed: string, lines: StagedLine[], withdrawals: StagedWithdrawal[], candidates: StagedCandidate[]}} Staged
 */

const PHASE = 'discussion';
const DECIDED_USAGE = [
  'decided yes <work-unit> <topic>',
  'decided strike <work-unit> <topic> <n>',
  'decided unstrike <work-unit> <topic> <n>',
].join('\n');

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

/** Refuses an object whose keys are not `keys`, with any of `optional`. @param {unknown} v @param {string} what @param {string[]} keys @param {string[]} [optional] */
function shaped(v, what, keys, optional = []) {
  const given = isObject(v) ? Object.keys(v) : null;
  if (given === null || !keys.every((key) => given.includes(key)) || !given.every((key) => keys.includes(key) || optional.includes(key))) {
    throw new Error(`${what} must be {${[...keys, ...optional.map((key) => `${key}?`)].join(', ')}}`);
  }
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
 * The product-record line standing that widens one of `decisions`: a
 * product-wide decision, current, relying on it. Undefined where none does.
 * @param {Shower} shower @param {string[]} decisions full ids
 */
function lineWidening(shower, decisions) {
  return productOf(shower.folded).decisions.find((id) => factsOf(shower.folded, id).relies_on.some((d) => decisions.includes(d)));
}

/** The decisions `decision` replaced, along its chain, nearest first. @param {Shower} shower @param {string} decision a full id */
function replacedBy(shower, decision) {
  const earlier = [];
  for (let at = factsOf(shower.folded, decision).replaces; at !== null; at = factsOf(shower.folded, at).replaces) earlier.push(at);
  return earlier;
}

/**
 * Refused where a product-record line standing widens `decision` already:
 * a line widened it before — at an earlier yes, or one killed after the
 * line landed. Else the line standing that widens a decision `decision`
 * replaced, which a line widening it replaces (8.9.2), or null.
 * @param {Shower} shower @param {string} decision a full id
 * @returns {StagedLine['replaces']}
 */
function lineReplaced(shower, decision) {
  const widened = lineWidening(shower, [decision]);
  if (widened !== undefined) throw new Error(`${shower.short(widened)} widens it for the product already — "${shower.show(widened).text}"`);
  const earlier = lineWidening(shower, replacedBy(shower, decision));
  return earlier === undefined ? null : { id: earlier, text: /** @type {string} */ (shower.show(earlier).text) };
}

/**
 * A line as Claude's payload gives it, staged, its ids minted, replacing
 * the line that widens a decision `widens` replaced: refused where it is
 * not `{text, why, widens}`, `widens` names no decision on the map, or the
 * product record widens that decision already.
 * @param {Shower} shower @param {Row[]} rows @param {unknown} given @param {number} at
 * @returns {StagedLine}
 */
function stagedLine(shower, rows, given, at) {
  const what = `line ${at + 1}`;
  const { text, why, widens } = shaped(given, what, ['text', 'why', 'widens']);
  if (!filled(text) || !filled(why) || !filled(widens)) throw new Error(`${what}'s text, why and widens are each a non-empty string`);
  let decision;
  let asks;
  let replaces;
  try {
    decision = resolveId(widens, shower.folded.facts.keys());
    if (factsOf(shower.folded, decision).kind !== 'decision') throw new Error(`${widens} is no decision`);
    asks = questionOn(shower, rows, decision);
    replaces = lineReplaced(shower, decision);
  } catch (err) {
    throw new Error(`${what} widens ${widens}: ${messageOf(err)}`);
  }
  return { id: newId(), question: newId(), asks, text, why, widens: decision, replaces };
}

/**
 * A withdrawal as Claude's payload gives it, staged, its id minted: refused
 * where it is not `{line, why}`, or `line` names no line of the product
 * record widening a decision of the topic.
 * @param {Shower} shower @param {string} unit @param {string} topic @param {unknown} given @param {number} at
 * @returns {StagedWithdrawal}
 */
function stagedWithdrawal(shower, unit, topic, given, at) {
  const what = `withdrawal ${at + 1}`;
  const { line, why } = shaped(given, what, ['line', 'why']);
  if (!filled(line) || !filled(why)) throw new Error(`${what}'s line and why are each a non-empty string`);
  const { folded } = shower;
  let id;
  try {
    id = resolveId(line, folded.facts.keys());
  } catch (err) {
    throw new Error(`${what} withdraws ${line}: ${messageOf(err)}`);
  }
  if (!productOf(folded).decisions.includes(id)) throw new Error(`${what} withdraws ${line}: ${line} is no line of the product record`);
  const widened = factsOf(folded, id).relies_on.find((d) => factsOf(folded, d).unit === unit && factsOf(folded, d).topic === topic);
  const [now] = widened === undefined ? [] : currentsOf(folded, widened);
  if (now === undefined) throw new Error(`${what} withdraws ${line}: it widens no decision of ${topic} standing`);
  return { id: newId(), line: id, text: /** @type {string} */ (shower.show(id).text), why, now: { id: now, text: /** @type {string} */ (shower.show(now).text) } };
}

/**
 * Refused where one record line is withdrawn twice, or withdrawn and
 * replaced by a line at once.
 * @param {Shower} shower @param {StagedLine[]} lines @param {StagedWithdrawal[]} withdrawals
 */
function checkWithdrawn(shower, lines, withdrawals) {
  withdrawals.forEach(({ line }, i) => {
    const first = withdrawals.findIndex((w) => w.line === line);
    if (first < i) throw new Error(`withdrawal ${i + 1} withdraws ${shower.short(line)}, as withdrawal ${first + 1} does`);
    const replacing = lines.findIndex(({ replaces }) => replaces?.id === line);
    if (replacing >= 0) throw new Error(`withdrawal ${i + 1} withdraws ${shower.short(line)}, which line ${replacing + 1} replaces — a record line is replaced or withdrawn`);
  });
}

/** How a candidate dismissed from the map is re-added: by the person, on the map. */
const RE_ADD = 'the person re-adds it on the map';

/**
 * The candidates as the map adds them: each a topic from this one, its
 * reason its summary.
 * @param {{name: string, reason: string}[]} candidates
 */
function mapEntries(candidates) {
  return candidates.map(({ name, reason }) => ({ name, summary: reason }));
}

/**
 * Refused, in the words of `said`, where the epic's map would refuse to add
 * the candidates as it stands — by the map's own rules, writing nothing.
 * @param {Record<string, any>} manifest @param {string} topic @param {{name: string, reason: string}[]} candidates @param {string} said
 */
function checkCandidates(manifest, topic, candidates, said) {
  if (candidates.length === 0) return;
  const entries = mapEntries(candidates);
  checkBatchEntries(entries, said);
  addBatchTo(structuredClone(manifest), entries, said, { source: `topic:${topic}`, reAdd: RE_ADD });
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
  const { lines, candidates, withdraws = [] } = shaped(parsed, 'the payload', ['lines', 'candidates'], ['withdraws']);
  if (!Array.isArray(lines) || !Array.isArray(candidates) || !Array.isArray(withdraws)) throw new Error('the payload\'s lines, withdraws and candidates are each a list');
  const widened = lines.map((line, i) => stagedLine(shower, rows, line, i));
  widened.forEach(({ widens }, i) => {
    const first = widened.findIndex((line) => line.widens === widens);
    if (first < i) throw new Error(`line ${i + 1} widens ${shower.short(widens)}, as line ${first + 1} does — a decision takes one line`);
  });
  const withdrawals = withdraws.map((given, i) => stagedWithdrawal(shower, unit, topic, given, i));
  checkWithdrawn(shower, widened, withdrawals);
  /** @type {Staged} */
  const staged = {
    closed,
    lines: widened,
    withdrawals,
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
 * topic this machine logged never given a verdict here or anywhere, a skip
 * among them; with where it stands among the departures this close asks —
 * those given none before it closed.
 * Null where none waits.
 * @param {Shower} shower @param {string} root @param {string} unit @param {string} topic @param {string} closed
 * @returns {DecidedView['verdict']}
 */
function verdictAsked(shower, root, unit, topic, closed) {
  const { folded } = shower;
  const evidence = evidenceOf(root);
  const askedBefore = (/** @type {string} */ id) => (evidence.asked.get(id) ?? Infinity) < Date.parse(closed);
  const departures = [...folded.facts.keys()].filter((id) => {
    const facts = factsOf(folded, id);
    return evidence.departures.has(id) && facts.unit === unit && facts.topic === topic && !askedBefore(id);
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
 * the topic's map rows, what the person decided and what was carried over,
 * how many rows went on, Claude's calls with the kind each carries, and the
 * verdict asked.
 * @param {Shower} shower @param {string} root @param {string} unit @param {string} topic @param {string} closed when the checklist closed
 */
function recordSide(shower, root, unit, topic, closed) {
  const rows = /** @type {Row[]} */ (answerMap(shower, { unit, topic }, root).questions);
  const textsOf = (/** @type {string} */ standing) => rows.filter((row) => rowStanding(row) === standing).map((row) => row.text);
  const calls = claudesCalls(rows).map(({ answer, question }) => ({
    question,
    answer: answer.text,
    kind: /** @type {string|null} */ (shower.show(resolveId(answer.id, shower.folded.facts.keys())).kind),
    handed: handedTag(answer),
  }));
  return { rows, decided: textsOf('yours'), carried: textsOf('carried'), moved: textsOf('moved').length, calls, verdict: verdictAsked(shower, root, unit, topic, closed) };
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
    return readShown(root, warnings, (shower) => then({ shower, root, manifest, closed, skips, side: recordSide(shower, root, unit, topic, closed) }));
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
        title: topicTitle(manifest, topic),
        decided: side.decided,
        carried: side.carried,
        moved: side.moved,
        calls: side.calls,
        listed: calls !== undefined,
        lines: staged.lines.map(({ text, replaces }) => ({ text, replaces: replaces?.text ?? null })),
        withdrawals: staged.withdrawals.map(({ text, why }) => ({ text, why })),
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
  return running.length === 0 ? '' : waitAgents(unit, topic, topicTitle(manifest, topic), running.map(({ kind }) => kind));
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
 * The raises a staged line lands as, at the unit's level, the person's
 * product-wide decision relying on the decision it widens: its question
 * and the decision answering it; or, where it replaces a line, the
 * replacement of that line, the person's change of mind (8.9.2).
 * @param {string} unit @param {StagedLine} line
 * @returns {import('./ledger-write.cjs').Raised[]}
 */
function lineRaises(unit, { id, question, asks, text, why, widens, replaces }) {
  const place = { unit, phase: PHASE, topic: null };
  const common = { said: 'decided yes', place, logs: null, checkRead: () => {} };
  const decision = { by: 'person', who_moved_whom: 'none', given: 'own', text, why, product_wide: true };
  if (replaces !== null) {
    return [{ ...common, lands: 'replace', linked: { replaces: replaces.id, reason: 'changed-mind', cause: null, relies_on: [widens] }, content: { ...decision, drops: [replaces.text] }, id }];
  }
  return [
    { ...common, lands: 'ask', linked: { relies_on: [widens] }, content: { by: 'claude', who_moved_whom: 'none', text: asks }, id: question },
    { ...common, lands: 'decide', linked: { answers: question, relies_on: [widens] }, content: decision, id },
  ];
}

/**
 * The raise a staged withdrawal lands as, at the unit's level: the
 * person's replacement of the line by the decision the one it widens now
 * stands as, not for the product (8.9.2).
 * @param {string} unit @param {StagedWithdrawal} withdrawal
 * @returns {import('./ledger-write.cjs').Raised}
 */
function withdrawalRaise(unit, { id, line, text, why, now }) {
  return {
    said: 'decided yes',
    place: { unit, phase: PHASE, topic: null },
    lands: 'replace',
    linked: { replaces: line, reason: 'changed-mind', cause: null, relies_on: [now.id] },
    content: { by: 'person', who_moved_whom: 'none', given: 'own', text: now.text, why, product_wide: false, drops: [text] },
    id,
    logs: null,
    checkRead: () => {},
  };
}

/**
 * Refused where a product-record line standing relies on a decision of the
 * topic replaced since and nothing staged replaces or withdraws it: the
 * rule it states is widened afresh from the replacement or withdrawn, or
 * the record holds two.
 * @param {Shower} shower @param {string} unit @param {string} topic @param {Staged} staged
 */
function checkReplacedLines(shower, unit, topic, { lines, withdrawals }) {
  const { folded } = shower;
  const replacedHere = (/** @type {string} */ id) => {
    const facts = factsOf(folded, id);
    return facts.unit === unit && facts.topic === topic && 'replaced_by' in (notCurrent(folded, id) ?? {});
  };
  const covered = (/** @type {string} */ id) => lines.some((line) => line.replaces?.id === id) || withdrawals.some((w) => w.line === id);
  const left = productOf(folded).decisions.find((id) => factsOf(folded, id).relies_on.some(replacedHere) && !covered(id));
  if (left !== undefined) {
    throw new Error(`the product record's line ${shower.short(left)}, "${shower.show(left).text}", widens a decision of ${topic} replaced since, and nothing staged replaces or withdraws it — a line widening the replacement, or a withdrawal of the line, is staged with --file`);
  }
}

/**
 * Refused where a staged line or withdrawal could not land as the ledger
 * stands — the decision it widens or the line it replaces no longer
 * current — by the link check its first landing makes, writing nothing;
 * the unit taking writes is the topic's own check (`openTopic`).
 * @param {string} cwd @param {string} unit @param {Staged} staged @param {string[]} warnings
 */
function checkLines(cwd, unit, { lines, withdrawals }, warnings) {
  const firsts = [
    ...lines.map((line, at) => ({ what: `line ${at + 1}`, raised: lineRaises(unit, line)[0] })),
    ...withdrawals.map((withdrawal, at) => ({ what: `withdrawal ${at + 1}`, raised: withdrawalRaise(unit, withdrawal) })),
  ];
  for (const { what, raised } of firsts) {
    try {
      checkRaised(cwd, raised, warnings);
    } catch (err) {
      throw new Error(`${what} cannot land — ${messageOf(err).replace(/^decided yes: /, '')}; it is staged again with --file`);
    }
  }
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
  const staged = onClosedTopic(cwd, unit, topic, ({ shower, closed, side }) => {
    const ready = stagedFor(cwd, unit, topic, closed);
    if (side.verdict !== null) throw new Error('a verdict is still to ask — render decided asks each before the yes');
    checkReplacedLines(shower, unit, topic, ready);
    return ready;
  });
  const added = staged.candidates.filter(({ struck }) => !struck);
  checkCandidates(loadWorkUnitManifest(cwd, unit), topic, added, 'the candidates');
  checkLines(cwd, unit, staged, warnings);
  const lines = staged.lines.map((line) => lineRaises(unit, line).map((raised) => landRaised(cwd, raised, warnings).landed.id).at(-1));
  const withdrawn = staged.withdrawals.map((withdrawal) => landRaised(cwd, withdrawalRaise(unit, withdrawal), warnings).landed.id);
  const at = new Date().toISOString();
  const manifest = withWorkUnitLock(cwd, unit, () => {
    const fresh = loadWorkUnitManifest(cwd, unit);
    if (added.length > 0) addBatchTo(fresh, mapEntries(added), 'the candidates', { source: `topic:${topic}`, reAdd: RE_ADD });
    fresh.phases[PHASE].items[topic].status = 'completed';
    takeDecidedClose(fresh, topic, at);
    saveWorkUnitManifest(cwd, unit, fresh);
    return fresh;
  });
  const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `decided(${unit}): ${topic}`, warnings);
  fs.rmSync(stagedFile(cwd, unit, topic), { force: true });
  /** @type {Record<string, unknown>} */
  const result = { unit, topic, decided: at, lines, withdrawn, candidates: added.map(({ name }) => name), committed: outcome.committed, next: nextAfter(manifest, unit) };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/**
 * `decided strike|unstrike <unit> <topic> <n>`: the n-th candidate struck,
 * or its strike undone, in the staged payload, answering the screen as
 * what comes next.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} n @param {boolean} struck
 */
function decidedStrike(cwd, unit, topic, n, struck) {
  openTopic(cwd, unit, topic);
  const { closed } = decidedClose(cwd, unit, topic);
  const staged = stagedFor(cwd, unit, topic, closed);
  const at = /^[1-9][0-9]*$/.test(n) ? Number(n) : 0;
  const candidate = staged.candidates[at - 1];
  if (candidate === undefined) throw new Error(`there is no candidate ${n} — the candidates are 1 to ${staged.candidates.length}`);
  if (candidate.struck === struck) throw new Error(`"${candidate.name}" is ${struck ? 'struck already' : 'not struck'}`);
  candidate.struck = struck;
  writeJsonAtomic(stagedFile(cwd, unit, topic), staged);
  return { unit, topic, [struck ? 'struck' : 'unstruck']: candidate.name, next: { kind: 'engine', argv: ['render', 'decided', `${unit}.${topic}`] } };
}

/**
 * `decided <yes|strike|unstrike> …`: the verb's answer, every refusal
 * opening on its command.
 * @param {string} cwd @param {string[]} argv
 * @returns {Record<string, unknown>}
 */
function runDecidedVerb(cwd, [verb, ...args]) {
  const usage = () => new Error(`Usage: ${DECIDED_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
  if (verb === 'yes' && args.length === 2) return refusing('decided yes', () => decidedYes(cwd, args[0], args[1]));
  if ((verb === 'strike' || verb === 'unstrike') && args.length === 3) return refusing(`decided ${verb}`, () => decidedStrike(cwd, args[0], args[1], args[2], verb === 'strike'));
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
