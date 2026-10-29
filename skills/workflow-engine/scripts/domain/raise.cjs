'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a raise (6.1.5, 16.9) — a call Claude has a lean on, put
// through the decision point (decision-point.cjs) and drawn for the person
// by the engine (projections/raise.cjs), never by prose alone (16.9.1); and
// the person's answer to it, recorded by one command in the ledger and the
// trust log (16.13.3).
//
// - The draw: `raise <unit>.<phase>[.<topic>] --answers <question>
//   [--relies-on <id> …]`, Claude's call on stdin as one JSON object: the
//   question as the person reads it; its rows, each `{key, name, text,
//   notice}` — the key, a short name for what the person would notice, the
//   answer's text and what they would notice; the lean, a row's key; why
//   Claude leans so; the sort, `one` or `several` (16.3.7); the mechanism,
//   behind the screen's toggle; and whether the answer is product-wide.
//   Every field of text is one line but the mechanism, drawn as written;
//   nothing else is taken.
// - It refuses, drawing nothing: no session; no state; a place or a link
//   `ledger decide` refuses, read and checked by that code before any lock
//   (ledger-write.cjs), since the answer lands as that decision; a question
//   answered already, or merged into another's answer — after a `/clear` or
//   a compaction Claude can raise one again — whether or not the
//   conversation holds its seal; a call of another shape; fewer than two
//   rows; a key the trust log cannot key, one two rows share, or one that
//   is the screen's own word in any case (`t`, `e`, `technical`, `explain`,
//   `comment`); a lean naming no row; and a row holding several rules. The
//   one-decision check (ledger-one-decision.cjs) judges each row's answer
//   and what it rules out — the other rows — every row's call put at once;
//   the seal names the rows it judged to hold one rule, and a row the call
//   cannot judge is drawn all the same. The why is not judged with them, so
//   every entry a raise lands lands unchecked, for the late check to judge
//   whole at the next start (ledger-late-check.cjs): the seal's rows judged
//   are the record of what the draw judged, and no call is made at the
//   answer.
// - The seal (16.1.2): the call as given, sealed before the person answers,
//   so its lean cannot change — `raise-shown.json` in the conversation's
//   folder (conversation.cjs), each raise drawn there by its id, with a
//   version of its own: the call; the place; the question it answers and
//   the entries it relies on, by full id; the id, minted at the draw, which
//   is the id its entry lands as; the menu it is declared as, `raise —
//   <id>`; the rows whose answer and what it rules out the check judged one
//   rule; the decision point's reason; when it was shown; its answer once
//   given — when, the row's key, null for the person's own words, and how
//   it came — null until then; and how many times the person did not
//   follow it. It is written before the command answers, and one that
//   cannot be written refuses the raise. A raise of a question the
//   conversation holds an open seal for — the same place and the same
//   question — draws that seal, the call it is given set aside, and says it
//   kept it: the pick is measured against the first lean. A seal of another
//   version is never matched, and stays as written. The layout hook refuses
//   Claude's own writes to it (layout-hook.cjs).
// - The decision point's answer is the response's, with its reason. An ask
//   draws the screen. A proceed lands Claude's call, drawing nothing and
//   sealing nothing: Claude's decision answering the question — the lean
//   row's answer, the other rows what it rules out, and its why — through
//   the lock `ledger decide` lands through, the question checked open under
//   it, logged as a call carrying the sort. A blind ask is refused until it
//   is built.
// - A raise is no gate (gate.cjs): drawing it clears the gate shown.
// - `raise show <id> [--technical]` draws a raise again from its seal
//   alone, never from Claude's words; `--technical` shows the mechanism.
// - `raise answer <id> (--pick <key> | --own | --didnt-follow)`: the
//   person's answer, in the conversation that drew the raise, found by its
//   seal — the id or a prefix of it. A row picked, or the person's own
//   words, lands as the person's decision at the id the draw minted, where
//   the raise was drawn, answering its question and relying on what it
//   relies on: a pick's text is the row's, and what it rules out the other
//   rows'; their own words bring their text, and what they rule out where
//   Claude gives it, none else, since their words may blend rows. Claude's
//   account of the person's reason, the why, comes on stdin with either.
//   The sealed answer is the lean row's text; whether it is product-wide is
//   the call's; its kind is null until the labeller's (29.19).
// - Who moved whom is the engine's alone (5.3.10): a pick other than the
//   lean, and the person's own words, stood over it; a pick of the lean is
//   none, or the person come round to it where Claude says so on stdin. Any
//   other value given refuses the answer.
// - The same command lands the trust log's raise event (16.13.3,
//   ledger-write.cjs): the entry, the sort, the lean's key and the
//   answer's — null for the person's own words, free text, typed, its
//   reading null until the separate call reads it (16.19.1) — how it came,
//   whether the person didn't follow, no kind or label until the labeller's,
//   and no blocked build outside one (16.4.7); never a word of the
//   question, the rows or the why. An answer was pressed where the gate mod
//   announced itself and its last press sent that row from this raise's
//   menu after the raise was drawn (gate.cjs); anything else was typed.
// - Once (E3): under the writer lock, a ledger holding the minted id means
//   the raise is answered, and a rerun after a kill writes no second entry
//   and logs no second event; else the question must still be open, or
//   nothing is recorded, the person's answer staying in the conversation.
//   The seal is marked answered after the commit, and keeps the answer it
//   was first marked with, so the ledger, not the seal, says whether a
//   raise is answered.
// - "I don't follow" logs a raise event in the trust log alone — no entry,
//   no answer, no reading (16.9.3, 16.12.3) — and counts it on the seal;
//   the raise stays open, to be shown again.
// - The draw and `show` take no writer lock: each writes the conversation's
//   folder alone. The answer, and a proceed's landing, take it around their
//   ledger write, as `ledger` does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { newId, shortId } = require('./ledger-ids.cjs');
const { questionStands, answersOf } = require('./ledger-fold.cjs');
const { decisionUsage, decisionPlaced, landRaised, callLogged } = require('./ledger-write.cjs');
const { OVER_THE_LEAN, BACK_TO_THE_LEAN } = require('./ledger-verdicts.cjs');
const { judgeDecisionAsync } = require('./ledger-one-decision.cjs');
const { type, TEXT, FLAG, oneOf, listOf } = require('./event-fields.cjs');
const { KEY } = require('./trust-events.cjs');
const { record } = require('./trust-log.cjs');
const { RAISE_SHOWN, raiseMenu, clearGateShown, isPressed } = require('./gate.cjs');
const decisionPoint = require('./decision-point.cjs');

/** @typedef {import('./event-fields.cjs').Type} Type */
/** @typedef {import('./decision-point.cjs').Decision} Decision */
/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-write.cjs').Landed} Landed */
/** @typedef {{key: string, name: string, text: string, notice: string}} Row */
/**
 * Claude's call, as the draw takes it on stdin.
 * @typedef {{question: string, rows: Row[], lean: string, why: string, sort: 'one'|'several', mechanism: string, product_wide: boolean}} Call
 */
/** @typedef {import('./ledger-write.cjs').Place} Place */
/** @typedef {'pressed'|'typed'} Via */
/** The person's answer as the seal keeps it. @typedef {{at: string, answer: string|null, via: Via}} Answered */
/**
 * A raise as sealed in the conversation's folder.
 * @typedef {object} Seal
 * @property {number} v
 * @property {string} id the raise's, and its entry's
 * @property {string} menu the menu it is declared as
 * @property {Place} place
 * @property {string} answers the question's id
 * @property {string[]} relies_on
 * @property {Call} call
 * @property {string[]} rows_judged the rows whose answer and what it rules out the one-decision check judged one rule
 * @property {string} reason
 * @property {string} at when it was shown
 * @property {Answered|null} answered
 * @property {number} didnt_follow
 */
/**
 * What a draw did: the raise sealed and drawn, or the conversation's open
 * seal of the question drawn again; or Claude's call landed, the decision
 * point letting it proceed.
 * @typedef {{decision: 'ask', reason: string, seal: Seal, kept: boolean, warnings: string[]} | {decision: 'proceed', reason: string, landed: Landed}} Drawn
 */
/**
 * The person's answer as its entry and its event hold it: the entry's
 * text, why, what it rules out and who moved whom; the event's answer — the
 * row's key, null for the person's own words — whether it came as free
 * text, and how.
 * @typedef {{text: string, why: string, rules_out: string[], who_moved_whom: string, answer: string|null, with_text: boolean, via: Via}} Given
 */

const SEAL_VERSION = 1;
const SAID = 'raise';
const ANSWER_SAID = 'raise answer';
const DRAW_USAGE = `${decisionUsage(SAID)}   (the call as JSON on stdin)`;
const SHOW_USAGE = 'raise show <id> [--technical]';
const ANSWER_USAGE = 'raise answer <id> (--pick <key> | --own | --didnt-follow)   (a pick\'s or own words\' answer as JSON on stdin)';
const RAISE_USAGE = `${DRAW_USAGE}\n${SHOW_USAGE}\n${ANSWER_USAGE}`;
// The screen's own words, which no row's key may be in any case: the
// mechanism's toggle, "I don't follow", and the comment.
const SCREEN_KEYS = ['t', 'e', 'technical', 'explain', 'comment'];
// The word the screen's "I don't follow" row is sent as (projections/raise.cjs).
const EXPLAIN = 'explain';

const LINE = type('one line of text', (v) => TEXT.test(v) && !/[\r\n]/.test(/** @type {string} */ (v)));
const ROWS = type('a list of rows', Array.isArray);
// Who moved whom as stdin gives it: whatever it holds, the engine rules on it (`movedBy`).
const MOVED = type('who moved whom', () => true);

/** What a row holds, each field's type. @type {Readonly<Record<string, Type>>} */
const ROW_FIELDS = Object.freeze({ key: KEY, name: LINE, text: LINE, notice: LINE });

/** What the call holds, each field's type. @type {Readonly<Record<string, Type>>} */
const CALL_FIELDS = Object.freeze({
  question: LINE, rows: ROWS, lean: KEY, why: LINE, sort: oneOf('one', 'several'), mechanism: TEXT, product_wide: FLAG,
});

/**
 * What the answer on stdin holds, by how the person answered: the fields it
 * needs, and those it may give.
 * @type {Readonly<Record<'pick'|'own', {needs: Readonly<Record<string, Type>>, may: Readonly<Record<string, Type>>}>>}
 */
const ANSWER_FIELDS = Object.freeze({
  pick: { needs: { why: TEXT }, may: { who_moved_whom: MOVED } },
  own: { needs: { text: TEXT, why: TEXT }, may: { rules_out: listOf(TEXT) } },
});

/**
 * Refuse a value holding a field neither `fields` nor `optional` names,
 * lacking one of `fields`, or holding one of another type, `where` saying
 * where.
 * @param {Record<string, unknown>} value @param {Readonly<Record<string, Type>>} fields @param {string} where
 * @param {Readonly<Record<string, Type>>} [optional]
 */
function checkFields(value, fields, where, optional = {}) {
  const all = { ...fields, ...optional };
  const names = Object.keys(all);
  const stray = Object.keys(value).find((name) => !Object.hasOwn(all, name));
  if (stray !== undefined) throw new Error(`${where} has no field ${stray} — it holds ${names.join(', ')}`);
  for (const name of names) {
    if (!Object.hasOwn(value, name)) {
      if (Object.hasOwn(fields, name)) throw new Error(`${where} needs ${name}`);
    } else if (!all[name].test(value[name])) {
      throw new Error(`${where}'s ${name} is not ${all[name].is}`);
    }
  }
}

/**
 * Stdin's one JSON object, `what` it holds, refused in the words of `said`,
 * the command asking.
 * @param {string} stdin @param {string} said @param {string} what
 * @returns {Record<string, unknown>}
 */
function stdinObject(stdin, said, what) {
  let value;
  try {
    value = JSON.parse(stdin);
  } catch (err) {
    throw new Error(`${said}: ${what} comes on stdin as a JSON object, and stdin holds no JSON — ${messageOf(err)}`);
  }
  if (!isObject(value)) throw new Error(`${said}: ${what} comes on stdin as a JSON object, not ${JSON.stringify(value)}`);
  return value;
}

/**
 * Refuse rows that offer no choice — fewer than two — a row of another
 * shape, a key two rows share or the screen keeps, and a lean naming no row.
 * @param {Call} call
 */
function checkRows({ rows, lean }) {
  if (rows.length < 2) throw new Error(`raise: the call has ${rows.length} row${rows.length === 1 ? '' : 's'} — a raise offers the person a choice of two at least`);
  rows.forEach((row, i) => {
    if (!isObject(row)) throw new Error(`raise: the call's rows[${i}] is not a row — {${Object.keys(ROW_FIELDS).join(', ')}}`);
    checkFields(row, ROW_FIELDS, `raise: the call's rows[${i}]`);
    if (SCREEN_KEYS.includes(row.key.toLowerCase())) throw new Error(`raise: the call's rows[${i}] takes the key ${row.key}, which the screen keeps for itself — ${SCREEN_KEYS.join(', ')} are its own, in any case`);
    if (rows.findIndex((other) => other.key === row.key) !== i) throw new Error(`raise: the call's rows share the key ${row.key} — each row's key is its own`);
  });
  if (!rows.some((row) => row.key === lean)) throw new Error(`raise: the call leans to ${lean}, and no row has that key — its rows: ${rows.map((row) => row.key).join(', ')}`);
}

/**
 * The call on stdin, checked whole.
 * @param {string} stdin
 * @returns {Call}
 */
function callOf(stdin) {
  const call = stdinObject(stdin, SAID, 'the call');
  checkFields(call, CALL_FIELDS, 'raise: the call');
  checkRows(/** @type {Call} */ (call));
  return /** @type {Call} */ (call);
}

/** The row the call leans to. @param {Call} call @returns {Row} */
function leanRow({ rows, lean }) {
  return /** @type {Row} */ (rows.find((row) => row.key === lean));
}

/** The answers of the call's rows but `row`: what that row rules out. @param {Call} call @param {Row} row */
function othersOf(call, row) {
  return call.rows.filter((other) => other !== row).map((other) => other.text);
}

/**
 * What the one-decision check judges of a row: its answer, and the other
 * rows as what it rules out; the why comes with the person's answer.
 * @param {Call} call @param {Row} row
 */
function entryOf(call, row) {
  return { text: row.text, why: null, rules_out: othersOf(call, row) };
}

/**
 * Every row judged by the one-decision check, the calls put at once. Answers
 * the keys of the rows it judged to hold one rule; refuses where any row
 * holds several, naming each such row and its rules.
 * @param {Call} call
 * @returns {Promise<string[]>}
 */
async function checkedRows(call) {
  const judged = await Promise.all(call.rows.map((row) => judgeDecisionAsync(entryOf(call, row))));
  const several = call.rows.flatMap((row, i) => {
    const one = judged[i];
    return 'rules' in one && one.rules.length > 1 ? [{ row: row.key, rules: one.rules }] : [];
  });
  if (several.length > 0) {
    const listed = several.map(({ row, rules }) => `  row ${row}:\n${rules.map((rule, n) => `    ${n + 1}. ${rule}`).join('\n')}`).join('\n');
    const err = new Error(`raise: ${several.length === 1 ? `row ${several[0].row} holds` : `rows ${several.map((s) => s.row).join(', ')} each hold`} several rules, and the entry a row lands as holds one — nothing drawn. Make each row one answer to the question, and raise what else it decides as a question of its own:\n${listed}`);
    throw Object.assign(err, { payload: { several } });
  }
  return call.rows.filter((_, i) => 'rules' in judged[i]).map((row) => row.key);
}

/** The conversation's seals file. @param {string} session */
function sealFile(session) {
  return path.join(conversationDir(session), RAISE_SHOWN);
}

/**
 * Every raise sealed in the conversation, by id, each as written — a seal
 * another release wrote among them.
 * @param {string} session
 * @returns {Record<string, unknown>}
 */
function readSeals(session) {
  const file = sealFile(session);
  if (!fs.existsSync(file)) return {};
  let seals;
  try {
    seals = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`raise: the conversation's raises, ${file}, cannot be read — ${messageOf(err)}`);
  }
  if (!isObject(seals)) throw new Error(`raise: the conversation's raises, ${file}, hold no raise by its id`);
  return seals;
}

/** @param {unknown} value @returns {value is Seal} */
function isSeal(value) {
  return isObject(value) && value.v === SEAL_VERSION;
}

/**
 * The open seal of the question `answers` raised at `place`, or null.
 * @param {Record<string, unknown>} seals @param {Place} place @param {string} answers
 * @returns {Seal|null}
 */
function openSeal(seals, place, answers) {
  const open = Object.values(seals).find((seal) => isSeal(seal) && seal.answered === null && seal.answers === answers
    && seal.place.unit === place.unit && seal.place.phase === place.phase && seal.place.topic === place.topic);
  return /** @type {Seal|undefined} */ (open) ?? null;
}

/**
 * Write `seal` beside the conversation's other raises, as it now stands.
 * @param {string} session @param {Record<string, unknown>} seals @param {Seal} seal
 */
function writeSeal(session, seals, seal) {
  const file = sealFile(session);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { ...seals, [seal.id]: seal });
}

/**
 * Keep `seal` beside the conversation's other raises. Refuses the raise
 * where it cannot be written.
 * @param {string} session @param {Record<string, unknown>} seals @param {Seal} seal
 */
function keepSeal(session, seals, seal) {
  try {
    writeSeal(session, seals, seal);
  } catch (err) {
    throw new Error(`raise: the raise could not be sealed in the conversation's folder — nothing drawn: ${messageOf(err)}`);
  }
}

/**
 * Where the question `answers` is no longer open — answered, or merged into
 * another's answer — the question and what answers it, said; null while it
 * is open.
 * @param {string} answers @param {Folded} read
 * @returns {string|null}
 */
function notOpen(answers, read) {
  const stands = questionStands(read, answers);
  if (stands === 'open') return null;
  const short = (/** @type {string} */ id) => shortId(id, read.facts.keys());
  const by = answersOf(read, answers).map(short).join(', ');
  return `${short(answers)}, which is ${stands === 'merged' ? `merged into the answer ${by}` : `answered by ${by}`}`;
}

/**
 * Refuse a raise of a question that is no longer open, naming what answers
 * it.
 * @param {string} answers @param {Folded} read
 */
function checkOpen(answers, read) {
  const stands = notOpen(answers, read);
  if (stands !== null) throw new Error(`raise --answers names ${stands} — a raise asks an open question`);
}

/**
 * Refuse, under the writer lock, the answer to a raise whose question is no
 * longer open, naming what answers it: nothing is recorded.
 * @param {string} answers @param {Folded} read
 */
function checkStillOpen(answers, read) {
  const stands = notOpen(answers, read);
  if (stands !== null) throw new Error(`${ANSWER_SAID}: the raise answers ${stands} now — nothing recorded: a raise answers an open question, and the person's answer stays in the conversation`);
}

/** The calling conversation's session id; refuses a command handed none. @param {string} said */
function sessionOf(said) {
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no conversation to raise it in — Claude Code hands every command it runs a session id, and this one has none`);
  return session;
}

/**
 * Claude's call landed where the decision point lets it proceed: Claude's
 * decision answering the question — the lean row's answer, the other rows
 * what it rules out, and Claude's why — logged as a call carrying its sort.
 * @param {string} cwd @param {Place} place @param {import('./ledger-write.cjs').Linked} linked @param {Call} call @param {string[]} warnings
 * @returns {Landed}
 */
function proceeded(cwd, place, linked, call, warnings) {
  const lean = leanRow(call);
  return landRaised(cwd, {
    said: SAID,
    place,
    answers: /** @type {string} */ (linked.answers),
    relies_on: /** @type {string[]} */ (linked.relies_on),
    content: { by: 'claude', who_moved_whom: 'none', text: lean.text, why: call.why, rules_out: othersOf(call, lean), product_wide: call.product_wide },
    id: null,
    logs: callLogged(call.sort),
    checkLinked: (resolved, read) => checkOpen(/** @type {string} */ (resolved.answers), read),
  }, warnings);
}

/**
 * `raise <place> --answers <question> [--relies-on <id> …]`: the call on
 * stdin put through the decision point and, where it asks, sealed in the
 * conversation and drawn — or the conversation's open seal of the question
 * drawn again, said kept; where it proceeds, landed as Claude's.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 * @returns {Promise<Drawn>}
 */
async function drawRaise(cwd, args, stdin) {
  const session = sessionOf(SAID);
  if (findStateRoot(cwd) === null) throw new Error('raise: there is no workflows state here — the question a raise answers is in the ledger, which the state holds');
  /** @type {string[]} */
  const warnings = [];
  const { at, linked, read } = decisionPlaced(cwd, args, SAID, `Usage: engine ${DRAW_USAGE}`, warnings);
  const answers = /** @type {string} */ (linked.answers);
  checkOpen(answers, read);
  const call = callOf(stdin());
  const place = { unit: at.unit, phase: at.phase, topic: at.topic };
  const seals = readSeals(session);
  const kept = openSeal(seals, place, answers);
  if (kept !== null) {
    clearGateShown(session);
    return { decision: 'ask', reason: kept.reason, seal: kept, kept: true, warnings };
  }
  const judged = await checkedRows(call);
  const { decision, reason } = decisionPoint.decide(call);
  if (decision === 'proceed') return { decision, reason, landed: proceeded(cwd, place, linked, call, warnings) };
  if (decision === 'blind') throw new Error('raise: the decision point answered blind, and asking blind is 29.19\'s, not built yet — nothing drawn');
  const id = newId();
  /** @type {Seal} */
  const seal = {
    v: SEAL_VERSION, id, menu: raiseMenu(id), place, answers, relies_on: /** @type {string[]} */ (linked.relies_on),
    call, rows_judged: judged, reason, at: new Date().toISOString(), answered: null, didnt_follow: 0,
  };
  keepSeal(session, seals, seal);
  clearGateShown(session);
  return { decision, reason, seal, kept: false, warnings };
}

/**
 * The raise a prefix of its id names among the conversation's, refused in
 * the words of `said`, the command asking.
 * @param {Record<string, unknown>} seals @param {string} prefix @param {string} said
 * @returns {Seal}
 */
function sealNamed(seals, prefix, said) {
  const named = Object.keys(seals).filter((id) => id.startsWith(prefix));
  if (named.length === 0) throw new Error(`${said}: this conversation has drawn no raise ${prefix}`);
  if (named.length > 1) throw new Error(`${said}: "${prefix}" begins the ids of ${named.length} raises this conversation drew — give more of the id`);
  const seal = seals[named[0]];
  if (!isSeal(seal)) throw new Error(`${said}: ${named[0]} was sealed by a release this engine does not read`);
  return seal;
}

/**
 * `raise show <id> [--technical]`: a raise the conversation drew, from its
 * seal alone, the mechanism shown with `--technical`.
 * @param {string[]} args
 * @returns {{seal: Seal, technical: boolean}}
 */
function showRaise(args) {
  const [prefix, ...flags] = args;
  if (prefix === undefined || prefix === '' || prefix.startsWith('--') || flags.some((flag) => flag !== '--technical') || flags.length > 1) {
    throw new Error(`Usage: engine ${SHOW_USAGE}`);
  }
  const session = sessionOf('raise show');
  const seal = sealNamed(readSeals(session), prefix, 'raise show');
  clearGateShown(session);
  return { seal, technical: flags.length === 1 };
}

/**
 * `raise answer`'s argv read: the raise's id or a prefix of it, how the
 * person answered, and the row a pick names.
 * @param {string[]} args
 * @returns {{prefix: string, form: 'pick'|'own'|'didnt-follow', key: string|null}}
 */
function answerArgs(args) {
  const [prefix, flag, ...rest] = args;
  if (prefix !== undefined && prefix !== '' && !prefix.startsWith('--')) {
    if (flag === '--pick' && rest.length === 1 && rest[0] !== '' && !rest[0].startsWith('--')) return { prefix, form: 'pick', key: rest[0] };
    if (flag === '--own' && rest.length === 0) return { prefix, form: 'own', key: null };
    if (flag === '--didnt-follow' && rest.length === 0) return { prefix, form: 'didnt-follow', key: null };
  }
  throw new Error(`Usage: engine ${ANSWER_USAGE}`);
}

/**
 * How the person's answer `sent` came: pressed, where the mod's last press
 * sent it from this raise's menu after the raise was drawn; else typed.
 * @param {string} session @param {Seal} seal @param {string} sent
 * @returns {Via}
 */
function cameBy(session, seal, sent) {
  return isPressed(session, (declared) => declared === seal.menu, sent, seal.at) ? 'pressed' : 'typed';
}

/**
 * Who moved whom on the person's pick of `key` (5.3.10), the engine's
 * alone: the person stood over the lean where the row is not it; else none,
 * or the person came round to it where Claude says so. Refuses any other
 * value `given`.
 * @param {string} lean @param {string} key @param {unknown} given undefined where stdin gives none
 * @returns {string}
 */
function movedBy(lean, key, given) {
  if (key !== lean) {
    if (given !== undefined) throw new Error(`${ANSWER_SAID}: who_moved_whom is the engine's — row ${key} is not the lean, ${lean}, so the person's answer stood over it: ${OVER_THE_LEAN}`);
    return OVER_THE_LEAN;
  }
  if (given === undefined) return 'none';
  if (given !== BACK_TO_THE_LEAN) throw new Error(`${ANSWER_SAID}: on a pick of the lean who_moved_whom is none, which the engine gives, or ${BACK_TO_THE_LEAN} where the person came round to it — not ${JSON.stringify(given)}`);
  return BACK_TO_THE_LEAN;
}

/**
 * The answer on stdin, checked for how the person answered.
 * @param {'pick'|'own'} form @param {string} stdin
 * @returns {Record<string, any>}
 */
function answerOn(form, stdin) {
  const given = stdinObject(stdin, ANSWER_SAID, 'the answer');
  checkFields(given, ANSWER_FIELDS[form].needs, `${ANSWER_SAID}: the answer`, ANSWER_FIELDS[form].may);
  return given;
}

/**
 * The person's pick of the row `key`: its answer, the other rows what it
 * rules out, the why on stdin, who moved whom as the engine rules, and how
 * it came. Refuses a key that is no row.
 * @param {string} session @param {Seal} seal @param {string} key @param {string} stdin
 * @returns {Given}
 */
function picked(session, seal, key, stdin) {
  const { call } = seal;
  const row = call.rows.find((r) => r.key === key);
  if (row === undefined) throw new Error(`${ANSWER_SAID}: the raise has no row ${key} — its rows: ${call.rows.map((r) => r.key).join(', ')}`);
  const { why, who_moved_whom: moved } = answerOn('pick', stdin);
  return {
    text: row.text, why, rules_out: othersOf(call, row), who_moved_whom: movedBy(call.lean, key, moved),
    answer: key, with_text: false, via: cameBy(session, seal, key),
  };
}

/**
 * The person's own words: their text and why, and what they rule out where
 * Claude gives it — free text, typed, standing over the lean.
 * @param {string} stdin
 * @returns {Given}
 */
function ownWords(stdin) {
  const { text, why, rules_out: rulesOut = [] } = answerOn('own', stdin);
  return { text, why, rules_out: rulesOut, who_moved_whom: OVER_THE_LEAN, answer: null, with_text: true, via: 'typed' };
}

/**
 * The raise's event in the trust log: its entry, or null where the person
 * didn't follow; its sort; the lean's key and the answer's; how it came;
 * no kind or label until the labeller's, and no blocked build outside one.
 * @param {Seal} seal @param {{entry: unknown, answer: string|null, via: Via, with_text: boolean, didnt_follow: boolean}} answer
 */
function raiseEvent({ call }, { entry, answer, via, with_text: withText, didnt_follow: didntFollow }) {
  return {
    entry, kind: null, label: null, sort: call.sort, sealed: call.lean, answer,
    via, with_text: withText, reading: null, didnt_follow: didntFollow, blocked_build: null,
  };
}

/**
 * The person's answer landed as their decision at the raise's id, its raise
 * event with it, then the seal marked answered.
 * @param {string} cwd @param {string} session @param {Record<string, unknown>} seals @param {Seal} seal @param {Given} given
 * @returns {Landed & {raise: string}}
 */
function recordAnswer(cwd, session, seals, seal, given) {
  /** @type {string[]} */
  const warnings = [];
  const { text, why, rules_out: rulesOut, who_moved_whom: moved, answer, via, with_text: withText } = given;
  const landed = landRaised(cwd, {
    said: ANSWER_SAID,
    place: seal.place,
    answers: seal.answers,
    relies_on: seal.relies_on,
    content: { by: 'person', who_moved_whom: moved, text, why, rules_out: rulesOut, product_wide: seal.call.product_wide, sealed: leanRow(seal.call).text },
    id: seal.id,
    logs: ({ id }) => ({ type: 'raise', fields: raiseEvent(seal, { entry: id, answer, via, with_text: withText, didnt_follow: false }) }),
    checkLinked: (linked, read) => checkStillOpen(/** @type {string} */ (linked.answers), read),
  }, warnings);
  writeSeal(session, seals, { ...seal, answered: seal.answered ?? { at: new Date().toISOString(), answer, via } });
  return { raise: seal.id, ...landed };
}

/**
 * "I don't follow": a raise event in the trust log alone, and the count on
 * the seal; the raise stays open.
 * @param {string} cwd @param {string} session @param {Record<string, unknown>} seals @param {Seal} seal
 * @returns {{raise: string, open: true, warnings?: string[]}}
 */
function didntFollow(cwd, session, seals, seal) {
  /** @type {string[]} */
  const warnings = [];
  record('raise', raiseEvent(seal, { entry: null, answer: null, via: cameBy(session, seal, EXPLAIN), with_text: false, didnt_follow: true }), { cwd, warnings });
  writeSeal(session, seals, { ...seal, didnt_follow: seal.didnt_follow + 1 });
  return { raise: seal.id, open: true, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * `raise answer <id> (--pick <key> | --own | --didnt-follow)`: the
 * person's answer to a raise this conversation drew — a row, their own
 * words, or that they didn't follow.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 */
function answerRaise(cwd, args, stdin) {
  const { prefix, form, key } = answerArgs(args);
  const session = sessionOf(ANSWER_SAID);
  const seals = readSeals(session);
  const seal = sealNamed(seals, prefix, ANSWER_SAID);
  if (form === 'didnt-follow') return didntFollow(cwd, session, seals, seal);
  const given = form === 'pick' ? picked(session, seal, /** @type {string} */ (key), stdin()) : ownWords(stdin());
  return recordAnswer(cwd, session, seals, seal, given);
}

/** Whether `raise` with `args` answers later: the draw, which waits on the one-decision check. @param {string[]} args */
function raiseWaits([verb]) {
  return verb !== 'show' && verb !== 'answer';
}

module.exports = { RAISE_USAGE, drawRaise, showRaise, answerRaise, raiseWaits };
