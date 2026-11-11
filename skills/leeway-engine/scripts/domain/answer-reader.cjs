'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the reader (16.19.1) — the row the person's own words pick
// among those they were shown, read by the separate Claude call
// (kernel/claude-call), never by the Claude they said them to.
//
// - What it reads: the question the person was asked, the rows it offered,
//   each by its key with its words, and what they said in place of a pick:
//   free text at a gate, naming no row (gate.cjs), or their own words
//   answering a raise (raise.cjs).
// - What it answers: the key of the one row the words take as offered;
//   none where they pick no row — a question, a thought, a request — name
//   several, or change or add to the one they name. An answer naming a key
//   the rows lack fits the call's schema no more than any other misfit, so
//   it reads as none.
// - The words reach the call on its stdin and go nowhere else: what the
//   engine keeps of them is the row's key alone (16.13.3).
// - The call: Opus (16.19.6), at the effort and within the time the
//   one-decision check takes (ledger-one-decision.cjs). Null where it fails
//   in any way, so the answer stands as free text with no row read
//   (16.19.8).
// - A reading feeds the counts alone: what the answer leads to is the
//   same whatever it reads (6.6.2).
// ---------------------------------------------------------------------------

const claudeCall = require('../kernel/claude-call.cjs');
const { TIMEOUT_MS } = require('./ledger-one-decision.cjs');

/** A row as the reader is shown it: its key, and its words. @typedef {{key: string, text: string}} Offered */
/** What the person was asked, and what they said in place of a pick. @typedef {{question: string, rows: Offered[], words: string}} Asked */

const MODEL_ASKED = 'opus';
const EFFORT = 'high';

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

/** What the call reads: the question, the rows by their keys, and the reply. @param {Asked} asked */
function askedText({ question, rows, words }) {
  return [
    `The question: ${question}`,
    `The options:\n${rows.map(({ key, text }) => `- ${key}: ${text}`).join('\n')}`,
    `The reply: ${words}`,
  ].join('\n\n');
}

/**
 * The key of the row the person's words pick among those they were shown,
 * as the separate call reads them; null where they pick none, or the call
 * fails in any way.
 * @param {Asked} asked
 * @returns {string|null}
 */
function readAnswer(asked) {
  const keys = asked.rows.map(({ key }) => key);
  const answered = claudeCall.askClaude({
    system: PROMPT, schema: schemaOf(keys), model: MODEL_ASKED, effort: EFFORT, input: askedText(asked), timeoutMs: TIMEOUT_MS,
  });
  if ('cannot' in answered) return null;
  const { row } = /** @type {{row: string}} */ (answered.answer);
  return row === NONE ? null : row;
}

module.exports = { PROMPT, readAnswer };
