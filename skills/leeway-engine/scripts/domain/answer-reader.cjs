'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the reader (16.19.1) — the row the person's own words pick
// among those they were shown, read by the separate Claude call
// (kernel/claude-call), never by the Claude they said them to.
//
// - What it reads: the question the person was asked, the rows it offered,
//   each by its key and whole as the person saw it, and what they said in
//   place of a pick: free text at a gate, naming no row (gate.cjs) — each
//   row its word, its label and its tail, then any detail beneath it; or
//   their own words answering a raise (raise.cjs) — each row of Claude's
//   its answer, then what the person would notice with it.
// - What it answers: the key of the one row the words take as offered;
//   none where they pick no row — a question, a thought, a request — name
//   several, or change or add to the one they name. An answer naming a key
//   the rows lack fits the call's schema no more than any other misfit, so
//   it reads as none.
// - The words reach the call on its stdin and go nowhere else: what the
//   engine keeps of them is the row's key alone (16.13.3).
// - The call: Opus (16.19.6). At a gate the person waits on it before
//   Claude can take up what they said, and a read missed costs one count,
//   so it runs at effort low and is given up after 15 s. On a raise a
//   misread lands a departure, so it runs at effort high, within the time
//   the one-decision check takes (ledger-one-decision.cjs). Null where it
//   fails in any way, its time passing among them, so the answer stands as
//   free text with no row read (16.19.8).
// - A reading feeds the counts alone: what the answer leads to is the
//   same whatever it reads (6.6.2).
// ---------------------------------------------------------------------------

const claudeCall = require('../kernel/claude-call.cjs');
const { TIMEOUT_MS } = require('./ledger-one-decision.cjs');

/** A row as the reader is shown it: its key, and its words, a line or more. @typedef {{key: string, text: string}} Offered */
/** What the person was asked, and what they said in place of a pick. @typedef {{question: string, rows: Offered[], words: string}} Asked */
/** How hard a read thinks, and how long it may take. @typedef {{effort: string, timeoutMs: number}} Pace */
/** A gate's row as the gate shown keeps it (surfaces.cjs). @typedef {{key: string, word: string|null, head: string, tail: string|null, detail: string|null}} GateRow */
/** A raise's row of Claude's (raise.cjs). @typedef {{key: string, name: string, text: string, notice: string}} RaiseRow */

const MODEL_ASKED = 'opus';

/** A read at a gate. @type {Readonly<Pace>} */
const AT_A_GATE = Object.freeze({ effort: 'low', timeoutMs: 15000 });

/** A read on a raise. @type {Readonly<Pace>} */
const ON_A_RAISE = Object.freeze({ effort: 'high', timeoutMs: TIMEOUT_MS });

// The answer naming no row: words with a space in them, which no row's key
// holds (trust-events.cjs).
const NONE = 'none of them';

const PROMPT = [
  'Each request is a question put to a person, the options it offered them, each by its key, and the reply they gave in their own words instead of picking one. Say which option the reply picks.',
  '',
  `Answer the key of the one option the reply takes as it was offered. Answer "${NONE}" where the reply picks no option — a question, a thought, a request — names several, or changes, narrows or adds to the option it names.`,
  '',
  'Judge from the text alone; where it does not say, read it as a careful reader would.',
].join('\n');

/** The answer, the key of one of `keys` or none. @param {string[]} keys */
function schemaOf(keys) {
  return {
    type: 'object',
    properties: { row: { type: 'string', enum: [...keys, NONE] } },
    required: ['row'],
    additionalProperties: false,
  };
}

/**
 * What the call reads: the question, the rows by their keys, each line
 * past a row's first indented beneath it, and the reply.
 * @param {Asked} asked
 */
function askedText({ question, rows, words }) {
  return [
    `The question: ${question}`,
    `The options:\n${rows.map(({ key, text }) => `- ${key}: ${text.split('\n').join('\n  ')}`).join('\n')}`,
    `The reply: ${words}`,
  ].join('\n\n');
}

/**
 * The key of the row the person's words pick among those they were shown,
 * as the separate call reads them at `pace`; null where they pick none, or
 * the call fails in any way.
 * @param {Asked} asked @param {Pace} pace
 * @returns {string|null}
 */
function readAnswer(asked, { effort, timeoutMs }) {
  const keys = asked.rows.map(({ key }) => key);
  const answered = claudeCall.askClaude({
    system: PROMPT, schema: schemaOf(keys), model: MODEL_ASKED, effort, input: askedText(asked), timeoutMs,
  });
  if ('cannot' in answered) return null;
  const { row } = /** @type {{row: string}} */ (answered.answer);
  return row === NONE ? null : row;
}

/** A gate's row as the person saw it: its word, its label and its tail, then its detail. @param {GateRow} row @returns {Offered} */
function gateOffered({ key, word, head, tail, detail }) {
  const line = [word, head, tail].filter((part) => part !== null).join(' — ');
  return { key, text: detail === null ? line : `${line}\n${detail}` };
}

/** A raise's row as the person saw it: its answer, then what they would notice. @param {RaiseRow} row @returns {Offered} */
function raiseOffered({ key, name, text, notice }) {
  return { key, text: `${text}\nWhat you'd notice — ${name}: ${notice}` };
}

/**
 * The row the person's free text picks among a gate's `rows`, read at a
 * gate's pace; null for none.
 * @param {string} question @param {GateRow[]} rows @param {string} words
 */
function readAtGate(question, rows, words) {
  return readAnswer({ question, rows: rows.map(gateOffered), words }, AT_A_GATE);
}

/**
 * The row of Claude's the person's own words pick, read at a raise's pace;
 * null for none.
 * @param {string} question @param {RaiseRow[]} rows @param {string} words
 */
function readOnRaise(question, rows, words) {
  return readAnswer({ question, rows: rows.map(raiseOffered), words }, ON_A_RAISE);
}

module.exports = { PROMPT, AT_A_GATE, ON_A_RAISE, readAtGate, readOnRaise };
