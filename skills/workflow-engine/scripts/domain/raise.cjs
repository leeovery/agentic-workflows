'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a raise (6.1.5, 16.9) — a call Claude has a lean on, put
// through the decision point (decision-point.cjs) and drawn for the person
// by the engine (projections/raise.cjs), never by prose alone (16.9.1).
//
// - The draw: `raise <unit>.<phase>[.<topic>] --answers <question>
//   [--relies-on <id> …]`, Claude's call on stdin as one JSON object: the
//   question as the person reads it; its rows, each `{key, name, text,
//   notice}` — the key, a short name for what the person would notice, the
//   answer's text and what they would notice; the lean, a row's key; why
//   Claude leans so; the sort, `one` or `several` (16.3.7); the mechanism,
//   behind the screen's toggle; and whether the answer is product-wide.
//   Every field is one line of text but the sort and the mark; nothing else
//   is taken.
// - It refuses, drawing nothing: no session; no state; a place or a link
//   `ledger decide` refuses, read and checked by that code before any lock
//   (ledger-write.cjs), since the answer lands as that decision; a call of
//   another shape; fewer than two rows; a key the trust log cannot key, one
//   two rows share, or `t` or `e`, which are the screen's; a lean naming no
//   row; and a row holding several rules. Each row is judged as the entry it
//   would land as — its answer, the other rows what it rules out, its why
//   not given yet — by the one-decision check (ledger-one-decision.cjs),
//   every row's call put at once; a row the call cannot judge is drawn,
//   named in the seal as unchecked, for its entry to land unchecked.
// - The seal (16.1.2): the call as given, sealed before the person answers,
//   so its lean cannot change — `raise-shown.json` in the conversation's
//   folder (conversation.cjs), each raise drawn there by its id, with a
//   version of its own: the call; the place; the question it answers and
//   the entries it relies on, by full id; the id, minted at the draw, which
//   is the id its entry lands as; the menu it is declared as, `raise —
//   <id>`; the rows the check could not judge; the decision point's reason;
//   when it was shown; its answer, null until given; and how many times the
//   person did not follow it. It is written before the command answers, and
//   one that cannot be written refuses the raise. A raise of a question the
//   conversation holds an open seal for — the same place and the same
//   question — draws that seal, the call it is given set aside: the pick is
//   measured against the first lean. The layout hook refuses Claude's own
//   writes to it (layout-hook.cjs).
// - The decision point's answer is the response's, with its reason. An ask
//   draws the screen; a proceed or a blind ask is refused until it is built.
// - A raise is no gate (gate.cjs): drawing it clears the gate shown.
// - `raise show <id> [--technical]` draws a raise again from its seal
//   alone, never from Claude's words; `--technical` shows the mechanism.
// - Neither takes the writer lock: each writes the conversation's folder
//   alone.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { newId } = require('./ledger-ids.cjs');
const { decisionUsage, decisionPlaced } = require('./ledger-write.cjs');
const { judgeDecisionAsync } = require('./ledger-one-decision.cjs');
const { type, TEXT, FLAG, oneOf } = require('./event-fields.cjs');
const { KEY } = require('./trust-events.cjs');
const { RAISE_SHOWN, raiseMenu, clearGateShown } = require('./gate.cjs');
const decisionPoint = require('./decision-point.cjs');

/** @typedef {import('./event-fields.cjs').Type} Type */
/** @typedef {import('./decision-point.cjs').Decision} Decision */
/** @typedef {{key: string, name: string, text: string, notice: string}} Row */
/**
 * Claude's call, as the draw takes it on stdin.
 * @typedef {{question: string, rows: Row[], lean: string, why: string, sort: 'one'|'several', mechanism: string, product_wide: boolean}} Call
 */
/** @typedef {{unit: string, phase: string, topic: string|null}} Place */
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
 * @property {string[]} unchecked the rows the one-decision check could not judge
 * @property {string} reason
 * @property {string} at when it was shown
 * @property {Record<string, unknown>|null} answered
 * @property {number} didnt_follow
 */

const SEAL_VERSION = 1;
const SAID = 'raise';
const DRAW_USAGE = `${decisionUsage(SAID)}   (the call as JSON on stdin)`;
const SHOW_USAGE = 'raise show <id> [--technical]';
const RAISE_USAGE = `${DRAW_USAGE}\n${SHOW_USAGE}`;
// The screen's own keys: the mechanism's toggle and "I don't follow".
const SCREEN_KEYS = ['t', 'e'];

const LINE = type('one line of text', (v) => TEXT.test(v) && !/[\r\n]/.test(/** @type {string} */ (v)));
const ROWS = type('a list of rows', Array.isArray);

/** What a row holds, each field's type. @type {Readonly<Record<string, Type>>} */
const ROW_FIELDS = Object.freeze({ key: KEY, name: LINE, text: LINE, notice: LINE });

/** What the call holds, each field's type. @type {Readonly<Record<string, Type>>} */
const CALL_FIELDS = Object.freeze({
  question: LINE, rows: ROWS, lean: KEY, why: LINE, sort: oneOf('one', 'several'), mechanism: LINE, product_wide: FLAG,
});

/**
 * Refuse a value of `fields`' shape that holds a field it does not, lacks
 * one, or holds one of another type, saying where.
 * @param {Record<string, unknown>} value @param {Readonly<Record<string, Type>>} fields @param {string} at
 */
function checkFields(value, fields, at) {
  const names = Object.keys(fields);
  const stray = Object.keys(value).find((name) => !Object.hasOwn(fields, name));
  if (stray !== undefined) throw new Error(`raise: ${at} has no field ${stray} — it holds ${names.join(', ')}`);
  for (const name of names) {
    if (!Object.hasOwn(value, name)) throw new Error(`raise: ${at} needs ${name}`);
    if (!fields[name].test(value[name])) throw new Error(`raise: ${at}'s ${name} is not ${fields[name].is}`);
  }
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
    checkFields(row, ROW_FIELDS, `the call's rows[${i}]`);
    if (SCREEN_KEYS.includes(row.key)) throw new Error(`raise: the call's rows[${i}] takes the key ${row.key}, which the screen keeps for itself — ${SCREEN_KEYS.join(' and ')} are its own`);
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
  let call;
  try {
    call = JSON.parse(stdin);
  } catch (err) {
    throw new Error(`raise: the call comes on stdin as a JSON object, and stdin holds no JSON — ${messageOf(err)}`);
  }
  if (!isObject(call)) throw new Error(`raise: the call comes on stdin as a JSON object, not ${JSON.stringify(call)}`);
  checkFields(call, CALL_FIELDS, 'the call');
  checkRows(/** @type {Call} */ (call));
  return /** @type {Call} */ (call);
}

/**
 * A row as the entry it would land as, for the one-decision check: its
 * answer, the other rows as what it rules out, and no why until the person
 * answers.
 * @param {Call} call @param {Row} row
 */
function entryOf(call, row) {
  return { text: row.text, why: null, rules_out: call.rows.filter((other) => other !== row).map((other) => other.text) };
}

/**
 * Every row judged by the one-decision check, the calls put at once. Answers
 * the keys of the rows the call could not judge; refuses where any row holds
 * several rules, naming each such row and its rules.
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
  return call.rows.filter((_, i) => 'cannot' in judged[i]).map((row) => row.key);
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
 * Keep `seal` beside the conversation's other raises. Refuses the raise
 * where it cannot be written.
 * @param {string} session @param {Record<string, unknown>} seals @param {Seal} seal
 */
function keepSeal(session, seals, seal) {
  const file = sealFile(session);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeJsonAtomic(file, { ...seals, [seal.id]: seal });
  } catch (err) {
    throw new Error(`raise: the raise could not be sealed in the conversation's folder — nothing drawn: ${messageOf(err)}`);
  }
}

/** The calling conversation's session id; refuses a command handed none. @param {string} said */
function sessionOf(said) {
  const session = handedSession();
  if (session === null) throw new Error(`${said}: no conversation to raise it in — Claude Code hands every command it runs a session id, and this one has none`);
  return session;
}

/** What the decision point may answer that the draw does not build yet, and where it is built. */
const NOT_BUILT = Object.freeze({
  proceed: 'landing a call that proceeds is 29.5\'s slice 5.2',
  blind: 'asking blind is 29.19\'s',
});

/**
 * `raise <place> --answers <question> [--relies-on <id> …]`: the call on
 * stdin put through the decision point and, where it asks, sealed in the
 * conversation and drawn — or the conversation's open seal of the question
 * drawn again. Answers the decision, its reason and the seal to draw.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 * @returns {Promise<{decision: Decision, reason: string, seal: Seal, warnings: string[]}>}
 */
async function drawRaise(cwd, args, stdin) {
  const session = sessionOf(SAID);
  if (findStateRoot(cwd) === null) throw new Error('raise: there is no workflows state here — the question a raise answers is in the ledger, which the state holds');
  /** @type {string[]} */
  const warnings = [];
  const { at, linked } = decisionPlaced(cwd, args, SAID, `Usage: engine ${DRAW_USAGE}`, warnings);
  const call = callOf(stdin());
  const place = { unit: at.unit, phase: at.phase, topic: at.topic };
  const answers = /** @type {string} */ (linked.answers);
  const seals = readSeals(session);
  const kept = openSeal(seals, place, answers);
  if (kept !== null) {
    clearGateShown(session);
    return { decision: 'ask', reason: kept.reason, seal: kept, warnings };
  }
  const unchecked = await checkedRows(call);
  const { decision, reason } = decisionPoint.decide(call);
  if (decision !== 'ask') throw new Error(`raise: the decision point answered ${decision}, and ${NOT_BUILT[decision]}, not built yet — nothing drawn`);
  const id = newId();
  /** @type {Seal} */
  const seal = {
    v: SEAL_VERSION, id, menu: raiseMenu(id), place, answers, relies_on: /** @type {string[]} */ (linked.relies_on),
    call, unchecked, reason, at: new Date().toISOString(), answered: null, didnt_follow: 0,
  };
  keepSeal(session, seals, seal);
  clearGateShown(session);
  return { decision, reason, seal, warnings };
}

/**
 * The raise a prefix of its id names among the conversation's.
 * @param {Record<string, unknown>} seals @param {string} prefix
 * @returns {Seal}
 */
function sealNamed(seals, prefix) {
  const named = Object.keys(seals).filter((id) => id.startsWith(prefix));
  if (named.length === 0) throw new Error(`raise show: this conversation has drawn no raise ${prefix}`);
  if (named.length > 1) throw new Error(`raise show: "${prefix}" begins the ids of ${named.length} raises this conversation drew — give more of the id`);
  const seal = seals[named[0]];
  if (!isSeal(seal)) throw new Error(`raise show: ${named[0]} was sealed by a release this engine does not read`);
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
  const seal = sealNamed(readSeals(session), prefix);
  clearGateShown(session);
  return { seal, technical: flags.length === 1 };
}

/** Whether `raise` with `args` answers later: the draw, which waits on the one-decision check. @param {string[]} args */
function raiseWaits([verb]) {
  return verb !== 'show';
}

module.exports = { RAISE_USAGE, drawRaise, showRaise, raiseWaits };
