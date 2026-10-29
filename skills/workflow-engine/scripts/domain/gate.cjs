'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the person's answer at a gate (6.6) — `engine gate`, which
// logs it to the trust log by the gate's name (3.2.6, 16.11.9) and answers
// with what the answered row leads to, performing none of it — and the
// record of the gate shown that it answers against.
//
// - The gate shown is the gate a command's MENU stated (surfaces.cjs),
//   kept in the calling conversation's folder (conversation.cjs) as
//   `gate-shown.json`: its name, its question, each row by its key with its
//   word, its head, whether the engine recommended it and what answering it
//   leads to, each typed row by its key with its label and what it leads
//   to, the time it was shown, and its answer once given. The engine's
//   dispatch and a skill's gateway write it once the command has answered,
//   never as the MENU is built; a command that states no gate, or fails,
//   leaves the last one standing. Nothing is kept for a command Claude
//   Code handed no session id; a record that cannot be written costs the
//   command nothing. It is kept for a conversation not yet marked as
//   running the workflows too, its folder made for it, so a gate before the
//   project has state is answered like any other. The layout hook refuses
//   Claude's own writes to it and to the mod's `pressed.json`
//   (layout-hook.cjs).
// - A gate's name is the one its MENU declares, up to its first ` — `: one
//   gate is one name, however many entries share it (`in-session gate — 3`
//   is `in-session gate`), and `gate` takes either. The name is never made
//   to fit: one the trust log cannot key refuses the answer
//   (trust-events.cjs). A typed row's key is its label's words, lowercase,
//   joined by hyphens: `comment`, `tell-me-what-to-change`, a span `1-4`.
// - An answer is a row picked by its key; a typed row, by its key; or free
//   text, naming no row. No text reaches the engine (16.13.3): what the
//   person typed stays in the conversation, and the event says only that
//   the answer was free text, its reading null until the separate call
//   reads it (16.19.1).
// - An answer was pressed where the gate mod announced itself to the
//   command and its record of the last press, `pressed.json`, names this
//   gate and this row, sent after the gate was shown — so a press that
//   answered an earlier showing never counts again. Anything else was
//   typed: with the mod off, every answer.
// - The recommended row is the engine's own, from the record, never the
//   caller's word.
// - `gate` refuses, logging nothing, with no session, no gate shown,
//   another gate's name, a key the gate lacks, and a gate already
//   answered. It writes no state: the trust log under the trust log's lock
//   (trust-log.cjs), and the record, marked answered. The event's id is
//   drawn from the conversation, the gate and when it was shown, so a
//   rerun after a kill between the two logs the same event again, read
//   once (16.13.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { conversationDir } = require('./conversation.cjs');
const { idFrom } = require('./ledger-ids.cjs');
const { gateShown, gateSurfaceAnnounced } = require('./projections/surfaces.cjs');
const { record } = require('./trust-log.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').ShownOption} ShownOption */
/** @typedef {{key: string, label: string, next: Next|null}} ShownTypedRow */
/** @typedef {{at: string, picked: string|null, via: 'pressed'|'typed'}} Answered */
/**
 * @typedef {object} ShownRecord
 * @property {string} gate the gate's name
 * @property {string} question
 * @property {ShownOption[]} options
 * @property {ShownTypedRow[]} typed
 * @property {string} at when it was shown
 * @property {Answered|null} answered
 */
/** @typedef {{pick: string} | {typed: string|null}} Answer */

const SHOWN = 'gate-shown.json';
// The gate mod's record of its last press (conversation.cjs).
const PRESSED = 'pressed.json';
const ENTRY_SEPARATOR = ' — ';

/** The gate a MENU declares, by its name: what comes before its first ` — `. @param {string} declared */
function nameOf(declared) {
  return declared.split(ENTRY_SEPARATOR)[0];
}

/** A typed row's key: its label's words, lowercase, joined by hyphens. @param {string} label */
function typedKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The record of the gate shown the conversation `session`. @param {string} session */
function shownFile(session) {
  return path.join(conversationDir(session), SHOWN);
}

/**
 * Record the gate the command's MENU stated as the gate the calling
 * conversation was shown — run once the command is done. Never throws.
 */
function recordGateShown() {
  const shown = gateShown();
  const session = handedSession();
  if (shown === null || session === null) return;
  /** @type {ShownRecord} */
  const kept = {
    gate: nameOf(shown.gate),
    question: shown.question,
    options: shown.options,
    typed: shown.typed.map(({ label, next }) => ({ key: typedKey(label), label, next })),
    at: new Date().toISOString(),
    answered: null,
  };
  try {
    const file = shownFile(session);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeJsonAtomic(file, kept);
  } catch { /* the command stands without it */ }
}

/** A JSON file's value; null where it is missing or no JSON. @param {string} file @returns {unknown} */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The row `answer` names on the gate `shown` — null for free text — or a
 * refusal naming the rows it has.
 * @param {ShownRecord} shown @param {Answer} answer
 * @returns {ShownOption|ShownTypedRow|null}
 */
function rowAnswered(shown, answer) {
  if ('pick' in answer) {
    const row = shown.options.find((o) => o.key === answer.pick);
    if (row) return row;
    const typed = shown.typed.some((t) => t.key === answer.pick) ? ` — ${answer.pick} is typed: --typed ${answer.pick}` : '';
    throw new Error(`gate: "${shown.gate}" has no row ${answer.pick} to pick — its rows: ${shown.options.map((o) => o.key).join(', ')}${typed}`);
  }
  if (answer.typed === null) return null;
  const row = shown.typed.find((t) => t.key === answer.typed);
  if (row) return row;
  throw new Error(`gate: "${shown.gate}" has no typed row ${answer.typed} — its typed rows: ${shown.typed.map((t) => t.key).join(', ') || 'none'}`);
}

/**
 * Whether the person pressed `row` on the gate `shown`: the mod announced
 * itself, and its last press was that row of this gate, after it was shown.
 * @param {string} session @param {ShownRecord} shown @param {ShownOption} row
 */
function isPressed(session, shown, row) {
  if (!gateSurfaceAnnounced()) return false;
  const pressed = readJson(path.join(conversationDir(session), PRESSED));
  return isObject(pressed) && typeof pressed.gate === 'string' && nameOf(pressed.gate) === shown.gate
    && pressed.answer === (row.word ?? row.key) && typeof pressed.at === 'string' && Date.parse(pressed.at) > Date.parse(shown.at);
}

/**
 * The person's answer at the gate `named` — by its name, or by the entry its
 * marker declares — logged to the trust log: the gate, the row picked or null
 * for free text, the row the engine recommended, how it came, and what the
 * row leads to; warnings where the log could not be appended to.
 * @param {string} cwd @param {string} named @param {Answer} answer
 */
function answerGate(cwd, named, answer) {
  const name = nameOf(named);
  const session = handedSession();
  if (session === null) throw new Error('gate: no conversation to answer in — Claude Code hands every command it runs a session id, and this one has none');
  const file = shownFile(session);
  const read = readJson(file);
  if (!isObject(read)) throw new Error('gate: no gate has been shown in this conversation — render the gate, then answer it');
  const shown = /** @type {ShownRecord} */ (read);
  if (shown.gate !== name) throw new Error(`gate: the gate shown is "${shown.gate}", not "${name}"`);
  if (shown.answered !== null) throw new Error(`gate: "${name}" is answered — render it again to answer it again`);
  const row = rowAnswered(shown, answer);
  const via = 'pick' in answer && isPressed(session, shown, /** @type {ShownOption} */ (row)) ? 'pressed' : 'typed';
  const recommended = shown.options.find((o) => o.recommended)?.key ?? null;
  const picked = row?.key ?? null;
  /** @type {string[]} */
  const warnings = [];
  const id = idFrom(session, name, shown.at);
  record('gate', { gate: name, recommended, picked, via, with_text: row === null, reading: null }, { cwd, warnings, id });
  writeJsonAtomic(file, { ...shown, answered: { at: new Date().toISOString(), picked, via } });
  return { gate: name, picked, recommended, via, next: row?.next ?? null, ...(warnings.length > 0 ? { warnings } : {}) };
}

module.exports = { SHOWN, PRESSED, recordGateShown, answerGate };
