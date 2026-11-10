'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the labeller (16.11, 16.19) — the kind of a question Claude
// put, read by the separate Claude call (kernel/claude-call), never by the
// Claude that wants to proceed (16.11.8).
//
// - What it reads: Claude's words alone (16.11.2) — the question, and the
//   answers Claude offered: a raise's rows, each its answer and what the
//   person would notice; Claude's own decision's answer and what it rules
//   out. A decision of the person's, or one carried over, gives its question
//   alone, its answer being theirs. Never the person's reply, nor anything
//   else of the person's or the project's.
// - What it asks: the twelve questions the release ships
//   (`content/trust/questions.json`, 16.16.1), in the measured wording
//   (`trust/questions.v3.json`) with no block describing the projects, one
//   question of Claude's a call.
// - The call: Sonnet (16.19.6), at the effort the measured raw call ran
//   (`trust/label_raw.py`), as long as the one-decision check it runs beside
//   may take — put beside the work a raise's draw waits on (`labelledBeside`),
//   or started beside a decision's check, which is waited on synchronously
//   (`startLabel`, kernel/claude-call.cjs `startClaude`).
// - The label (16.11.5, 16.19.11): the twelve answers, true or false, in
//   16.11.2's order, and the labeller that wrote them, by the full id of the
//   model that answered. Null where the call fails in any way, or names no
//   model by an id the trust log keys, so the question asks (16.19.8).
// - What the engine reads of a label: its kind, composed in code (16.11.3);
//   whether a later change would reach beyond the piece, the hard-to-undo
//   mark (16.11.7); whether Claude could find the answer out (16.11.7); and
//   danger, read from its own question whatever the kind (16.5.1).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const claudeCall = require('../kernel/claude-call.cjs');
const { MODEL } = require('./event-fields.cjs');
const { TIMEOUT_MS } = require('./ledger-one-decision.cjs');

/** A label: the labeller's model id, and its twelve answers in 16.11.2's order. @typedef {{labeller: string, answers: boolean[]}} Label */
/** @typedef {import('./event-fields.cjs').Kind} Kind */

const QUESTIONS_FILE = path.join(__dirname, '..', '..', 'content', 'trust', 'questions.json');

// 16.11.2's order, the order a label's answers are kept in.
const ORDER = Object.freeze(['process', 'checkable', 'user_sees', 'looks', 'words', 'flow', 'scope', 'contract', 'danger', 'hard_to_undo', 'one_is_wrong', 'internals']);

const MODEL_ASKED = 'sonnet';
const EFFORT = 'high';

const PREAMBLE = 'Each request is a question or a choice Claude, an AI coding assistant, put to the person it works for while building software with them, with the answers Claude offered where it gave them. Answer every question below about it. Judge from the text alone; where it does not say, answer as a careful reader would assume. Each question is answered on its own: do not let one answer decide another.';

/** The twelve answers, each true or false, by its question's key. */
const SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.fromEntries(ORDER.map((key) => [key, { type: 'boolean' }])),
  required: ORDER,
  additionalProperties: false,
});

/** @type {string|null} */
let prompt = null;

/** The call's system prompt: the preamble, then each question as the release ships it. */
function promptOf() {
  if (prompt !== null) return prompt;
  /** @type {{id: string, q: string, true: string, false: string}[]} */
  const questions = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  const listed = questions.map((q) => `- ${q.id}: ${q.q}\n    true: ${q.true}\n    false: ${q.false}`).join('\n');
  prompt = `${PREAMBLE}\n\nThe questions, each answered true or false:\n${listed}\n\nReturn a boolean for every question.`;
  return prompt;
}

/**
 * What the call reads of a question Claude put: its words, then each answer
 * Claude offered, where it offered any.
 * @param {string} question @param {string[]} answers
 */
function questionText(question, answers) {
  if (answers.length === 0) return question;
  return `${question}\n\nThe answers offered:\n${answers.map((answer) => `- ${answer}`).join('\n')}`;
}

/**
 * The label a call answered, or null where it could not run or names no
 * model the trust log can key.
 * @param {import('../kernel/claude-call.cjs').Answer} answered
 * @returns {Label|null}
 */
function labelOf(answered) {
  if ('cannot' in answered || answered.model === null || !MODEL.test(answered.model)) return null;
  const given = /** @type {Record<string, boolean>} */ (answered.answer);
  return { labeller: answered.model, answers: ORDER.map((key) => given[key]) };
}

/** The call's question of the text `questionText` gives. @param {string} text @returns {import('../kernel/claude-call.cjs').Ask} */
function askOf(text) {
  return { system: promptOf(), schema: SCHEMA, model: MODEL_ASKED, effort: EFFORT, input: text, timeoutMs: TIMEOUT_MS };
}

/**
 * The label of the question `text` holds (`questionText`), put to the
 * separate call: null where it fails.
 * @param {string} text
 * @returns {Promise<Label|null>}
 */
async function labelAsync(text) {
  return labelOf(await claudeCall.askClaudeAsync(askOf(text)));
}

/**
 * The label of the question `text` holds, its call started now: `wait()`
 * blocks until it answers, null where it fails or outlives its time.
 * @param {string} text
 * @returns {{wait: () => Label|null}}
 */
function startLabel(text) {
  const started = claudeCall.startClaude(askOf(text));
  return { wait: () => labelOf(started.wait()) };
}

/**
 * `work`, and the label of `text` put at once beside it: both awaited
 * whatever `work` does, so a refusal never leaves the label's call running.
 * @template T
 * @param {Promise<T>} work @param {string} text
 * @returns {Promise<{done: T, label: Label|null}>}
 */
async function labelledBeside(work, text) {
  const labelling = labelAsync(text);
  try {
    return { done: await work, label: await labelling };
  } finally {
    await labelling;
  }
}

/** The answer to the question `key` names. @param {boolean[]} answers @param {string} key */
function said(answers, key) {
  return answers[ORDER.indexOf(key)];
}

// 16.11.3: the first of these a question answers yes to is its kind.
const AHEAD = Object.freeze(['process', 'danger', 'contract', 'scope']);
// Then, for what a user sees, the first of these yes, else behaviour.
const SEEN = Object.freeze([['looks', 'look'], ['words', 'words']]);

/**
 * The kind twelve answers compose, as `trust/kinds.py` `compose()` does
 * (16.11.3, 16.11.4).
 * @param {boolean[]} answers
 * @returns {Kind}
 */
function compose(answers) {
  const ahead = AHEAD.find((key) => said(answers, key));
  if (ahead !== undefined) return /** @type {Kind} */ (ahead);
  if (!said(answers, 'user_sees')) return 'internals';
  return /** @type {Kind} */ (SEEN.find(([key]) => said(answers, key))?.[1] ?? 'behaviour');
}

/** A label's kind, null for none. @param {Label|null} label @returns {Kind|null} */
function kindOf(label) {
  return label === null ? null : compose(label.answers);
}

/** Whether a later change would reach beyond the piece (Q10), null for no label. @param {Label|null} label */
function hardToUndo(label) {
  return label === null ? null : said(label.answers, 'hard_to_undo');
}

/** Whether Claude could find the answer out (Q2), null for no label. @param {Label|null} label */
function checkable(label) {
  return label === null ? null : said(label.answers, 'checkable');
}

/** Whether an option could lose data or weaken security (Q9), null for no label. @param {Label|null} label */
function danger(label) {
  return label === null ? null : said(label.answers, 'danger');
}

/** What a decision's line holds of its label: its kind and the hard-to-undo mark, each null for none. @param {Label|null} label */
function labelFields(label) {
  return { kind: kindOf(label), hard_to_undo: hardToUndo(label) };
}

module.exports = { ORDER, SCHEMA, promptOf, questionText, labelAsync, startLabel, labelledBeside, compose, kindOf, hardToUndo, checkable, danger, labelFields };
