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
//   word, its head, its tail and any detail beneath it, whether the engine
//   recommended it and what answering it leads to; each typed row by its
//   key with its label, whether the person answers it in words, and what it
//   leads to; the time it was drawn and the time its showing opened, a
//   learned gate's showing (learned-gates.cjs), and its answer once given. The engine's
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
//   text, naming no row, the person's words given with it. The separate
//   call reads the words against the gate's question and its rows, as the
//   person saw them, its typed rows never among them (answer-reader.cjs),
//   for the one they pick, and they are dropped: the event says only that the
//   answer was free text, and its reading, the row read from it, null where
//   they pick none or the call cannot read them (16.13.3, 16.19.1,
//   16.19.8). A reading leads nowhere: free text sets the gate aside
//   whatever it reads (6.6.2).
// - An answer was pressed where the gate mod announced itself to the
//   command and its record of the last press, `pressed.json`, names this
//   gate and this row, sent after the gate was shown — so a press that
//   answered an earlier showing never counts again. Anything else was
//   typed: with the mod off, every answer. A raise's answer is read the
//   same way, by the menu it is declared as (raise.cjs).
// - The recommended row is the engine's own, from the record, never the
//   caller's word.
// - A raise is no gate (16.9, raise.cjs). Its MENU is declared `raise — <id>`,
//   and the one rule on that name keeps it out: it is never recorded as the
//   gate shown, and `gate` refuses it, naming `raise answer`. Drawing one
//   clears the gate shown, so only one shows at a time (6.6.10).
// - A showing of a gate lasts from its drawing until a pick answers it — a
//   row, or a typed row that picks items — waiting for its answer, or set
//   aside by a reply that answered no row: free text, or a typed row the
//   person answers in words, a Comment or an Ask (6.6.2). Drawn again while
//   it lasts, the gate shown keeps the time the showing opened and the
//   showing it was drawn on, so the showing is one event under one id however
//   many replies it took, the first read (16.13.3), and a learned gate's
//   shows again (decision-point.cjs); the time it was drawn is this draw's,
//   so a press, or a proposal's yes (person-verbs.cjs), is told against the
//   screen the person answered. The gate drawn after a pick is a new
//   showing.
// - A learned gate run as an automatic step (learned-gates.cjs) is no answer
//   (E13): nothing is logged for it, it is never recorded as the gate shown,
//   and the command clears the gate shown before it, as a raise's draw does,
//   so `gate` refuses an answer to it.
// - `gate` refuses, logging nothing, with no session, no gate shown,
//   another gate's name, a key the gate lacks, free text with no words, and
//   a gate already answered; each before the words are read. It writes no
//   state: the trust log under the trust log's lock (trust-log.cjs), and
//   the record, marked answered. The event's id is drawn from the
//   conversation, the gate and when its showing opened, so a rerun after
//   a kill between the two logs the same event again, read once (16.13.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { conversationDir } = require('./conversation.cjs');
const { readAtGate } = require('./answer-reader.cjs');
const { idFrom } = require('./ledger-ids.cjs');
const { gateShown, gateStepped, gateSurfaceAnnounced } = require('./projections/surfaces.cjs');
const { record } = require('./trust-log.cjs');
const { SHOWN, RAISE_SHOWN, PRESSED } = require('./user-files.cjs');

/** @typedef {import('./projections/surfaces.cjs').Next} Next */
/** @typedef {import('./projections/surfaces.cjs').ShownOption} ShownOption */
/** @typedef {{key: string, label: string, prompt: boolean, next: Next|null}} ShownTypedRow */
/** @typedef {{at: string, picked: string|null, via: 'pressed'|'typed'}} Answered */
/**
 * @typedef {object} ShownRecord
 * @property {string} gate the gate's name
 * @property {string} question
 * @property {ShownOption[]} options
 * @property {ShownTypedRow[]} typed
 * @property {string} at when it was drawn
 * @property {string} opened when its showing was first drawn
 * @property {string|null} showing a learned gate's showing, null for any other
 * @property {Answered|null} answered
 */
/** A row picked, a typed row by its key, or free text: the person's words. @typedef {{pick: string} | {typed: string} | {words: string}} Answer */

const ENTRY_SEPARATOR = ' — ';
const RAISE = 'raise';

/** The gate a MENU declares, by its name: what comes before its first ` — `. @param {string} declared */
function nameOf(declared) {
  return declared.split(ENTRY_SEPARATOR)[0];
}

/** Whether a declared menu is a raise's, which is no gate. @param {string} declared */
function isRaise(declared) {
  return nameOf(declared) === RAISE;
}

/** The menu a raise is declared as, by its id. @param {string} id */
function raiseMenu(id) {
  return `${RAISE}${ENTRY_SEPARATOR}${id}`;
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
 * conversation was shown, on the showing the conversation holds open where
 * it holds one of that gate — or, where the MENU ran as an automatic step,
 * forget the one shown before it — run once the command is done. Never
 * throws.
 */
function recordGateShown() {
  const shown = gateShown();
  const session = handedSession();
  if (session === null) return;
  if (gateStepped()) {
    try {
      clearGateShown(session);
    } catch { /* the command stands without it */ }
    return;
  }
  if (shown === null || isRaise(shown.gate)) return;
  const gate = nameOf(shown.gate);
  try {
    const open = openShowing(session, gate);
    const at = new Date().toISOString();
    /** @type {ShownRecord} */
    const kept = {
      gate,
      question: shown.question,
      options: shown.options,
      typed: shown.typed.map(({ label, prompt, next }) => ({ key: typedKey(label), label, prompt, next })),
      at,
      opened: open?.opened ?? at,
      showing: open === null ? shown.showing : open.showing,
      answered: null,
    };
    const file = shownFile(session);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeJsonAtomic(file, kept);
  } catch { /* the command stands without it */ }
}

/**
 * The gate the conversation `session` was shown last, answered or not; null
 * where it was shown none.
 * @param {string} session @returns {ShownRecord|null}
 */
function lastShown(session) {
  const read = readJson(shownFile(session));
  return isObject(read) ? /** @type {ShownRecord} */ (read) : null;
}

/**
 * Whether the person's answer at the gate last shown in the conversation
 * `session` leads to the command `argv`: one of `gates`, shown no earlier
 * than `since` where given, and answered with the row whose next it is —
 * what a verb that writes only on the person's answer checks first.
 * @param {string} session @param {readonly string[]} gates @param {string[]} argv @param {string|null} since
 */
function answeredTo(session, gates, argv, since) {
  const shown = lastShown(session);
  if (shown === null || !gates.includes(shown.gate) || shown.answered === null) return false;
  if (since !== null && Date.parse(shown.at) < Date.parse(since)) return false;
  const { picked } = shown.answered;
  const next = [...shown.options, ...shown.typed].find((row) => row.key === picked)?.next;
  return next?.kind === 'engine' && next.argv.join('\0') === argv.join('\0');
}

/**
 * The gate `name`'s showing the conversation `session` holds open: the gate
 * shown, waiting for its answer or set aside by a reply that answered no
 * row; null where the gate shown is another, or a pick ended its showing.
 * @param {string} session @param {string} name @returns {ShownRecord|null}
 */
function openShowing(session, name) {
  const shown = lastShown(session);
  if (shown === null || shown.gate !== name) return null;
  if (shown.answered === null) return shown;
  const { picked } = shown.answered;
  return picked === null || shown.typed.some((t) => t.key === picked && t.prompt) ? shown : null;
}

/** Forget the gate the conversation `session` was shown. @param {string} session */
function clearGateShown(session) {
  fs.rmSync(shownFile(session), { force: true });
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
 * refusal naming the rows it has, or free text with no words.
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
  if ('words' in answer) {
    if (answer.words.trim() === '') throw new Error(`gate: free text at "${shown.gate}" comes with the person's words on stdin, read for the row they pick and dropped`);
    return null;
  }
  const row = shown.typed.find((t) => t.key === answer.typed);
  if (row) return row;
  throw new Error(`gate: "${shown.gate}" has no typed row ${answer.typed} — its typed rows: ${shown.typed.map((t) => t.key).join(', ') || 'none'}`);
}

/**
 * Whether the person pressed `answer` on a menu shown at `shownAt`: the mod
 * announced itself, and its last press sent that answer from a menu
 * `declared` accepts, after it was shown — a gate by its name, a raise by
 * the menu it is declared as.
 * @param {string} session @param {(declared: string) => boolean} declared @param {string} answer @param {string} shownAt
 */
function isPressed(session, declared, answer, shownAt) {
  if (!gateSurfaceAnnounced()) return false;
  const pressed = readJson(path.join(conversationDir(session), PRESSED));
  return isObject(pressed) && typeof pressed.gate === 'string' && declared(pressed.gate)
    && pressed.answer === answer && typeof pressed.at === 'string' && Date.parse(pressed.at) > Date.parse(shownAt);
}

/**
 * Whether the person pressed `row` on the gate `shown`: a press of this
 * gate, by its name, sending the row's word, or its key where it has none.
 * @param {string} session @param {ShownRecord} shown @param {ShownOption} row
 */
function pressedOnGate(session, shown, row) {
  return isPressed(session, (declared) => nameOf(declared) === shown.gate, row.word ?? row.key, shown.at);
}

/**
 * The person's answer at the gate `named` — by its name, or by the entry its
 * marker declares — logged to the trust log: the gate, the row picked or null
 * for free text and the row read from it, the row the engine recommended,
 * how it came, and what the row leads to; warnings where the log could not
 * be appended to.
 * @param {string} cwd @param {string} named @param {Answer} answer
 */
function answerGate(cwd, named, answer) {
  const name = nameOf(named);
  if (isRaise(name)) throw new Error('gate: a raise is no gate — answer it with raise answer <id>');
  const session = handedSession();
  if (session === null) throw new Error('gate: no conversation to answer in — Claude Code hands every command it runs a session id, and this one has none');
  const file = shownFile(session);
  const read = readJson(file);
  if (!isObject(read)) throw new Error('gate: no gate has been shown in this conversation — render the gate, then answer it');
  const shown = /** @type {ShownRecord} */ (read);
  if (shown.gate !== name) throw new Error(`gate: the gate shown is "${shown.gate}", not "${name}"`);
  if (shown.answered !== null) throw new Error(`gate: "${name}" is answered — render it again to answer it again`);
  const row = rowAnswered(shown, answer);
  const via = 'pick' in answer && pressedOnGate(session, shown, /** @type {ShownOption} */ (row)) ? 'pressed' : 'typed';
  const recommended = shown.options.find((o) => o.recommended)?.key ?? null;
  const picked = row?.key ?? null;
  const reading = 'words' in answer ? readAtGate(shown.question, shown.options, answer.words) : null;
  /** @type {string[]} */
  const warnings = [];
  const id = idFrom(session, name, shown.opened);
  record('gate', { gate: name, recommended, picked, via, with_text: row === null, reading, showing: shown.showing }, { cwd, warnings, id });
  writeJsonAtomic(file, { ...shown, answered: { at: new Date().toISOString(), picked, via } });
  return { gate: name, picked, recommended, via, next: row?.next ?? null, ...(warnings.length > 0 ? { warnings } : {}) };
}

module.exports = { SHOWN, PRESSED, RAISE_SHOWN, recordGateShown, answerGate, raiseMenu, clearGateShown, isPressed, lastShown, answeredTo, openShowing };
