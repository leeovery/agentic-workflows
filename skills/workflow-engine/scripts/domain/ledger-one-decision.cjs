'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the one-decision check (5.5.2, 5.5.3, 16.19.8) — whether a
// decision holds one rule, judged as it is written by the separate Claude
// call (kernel/claude-call), never by the Claude writing it.
//
// - What it reads: the entry's own content — its answer, why, and what it
//   rules out — and nothing else: not the question, the topic or the
//   session.
// - When: a decision `ledger decide` writes, and one `ledger replace` writes
//   in place of a decision, before the writer lock, so no peer waits on the
//   call; and each row of a raise as it is drawn (raise.cjs), as the decision
//   it would land as — its answer, and the other rows as what it rules out,
//   its why not given until the person answers — every row's call put at
//   once (`judgeDecisionAsync`). The raise's answer makes no call: the entry
//   it lands, whose why no call read, lands unchecked, for the late check.
// - What follows: one rule, and the entry lands checked. Several, and the
//   write is refused, nothing appended, naming the rules found and the
//   question, so the writer splits it, each part answering the question the
//   whole answered (5.3.13). Where the call cannot run, or fails in any way,
//   the entry lands unchecked, for the late check at the next start
//   (ledger-late-check.cjs): a check never stops an entry being recorded.
// - The call runs on Opus (16.19.6), at the effort the measured raw call ran
//   (`trust/label_raw.py`).
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const claudeCall = require('../kernel/claude-call.cjs');

/** @typedef {import('../kernel/claude-call.cjs').CannotRun} CannotRun */
/** @typedef {import('./ledger-write.cjs').Request} Request */

const PROMPT = [
  'Each request is one entry from a project\'s decision ledger: a decision made while building software, given as its answer, why it was made, and what it rules out. An entry should hold one rule: one decision, which stands, or is replaced, as a whole. List the rules this entry holds.',
  '',
  'Two statements are separate rules when either could be changed or replaced while the other still stands. A rule together with its details, its reason, its limits and the alternatives it rejects is one rule. The why and what the entry rules out explain and bound the answer; they hold a rule of their own only where they decide something the answer does not.',
  '',
  'Judge from the entry\'s text alone; where it does not say, read it as a careful reader would. Return each rule the entry holds as one self-contained sentence in the entry\'s own terms, in the order the entry gives them: one sentence where it holds one rule.',
].join('\n');

/** The rules the entry holds, each a sentence: one, or several. */
const SCHEMA = Object.freeze({
  type: 'object',
  properties: { rules: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 } },
  required: ['rules'],
  additionalProperties: false,
});

const MODEL = 'opus';
const EFFORT = 'high';
const TIMEOUT_MS = 60000;

/**
 * What the call reads of a decision: its answer, why — null where it is not
 * given yet — and what it rules out.
 * @param {Record<string, unknown>} content
 * @returns {string}
 */
function entryText({ text, why, rules_out: rulesOut }) {
  const ruled = /** @type {string[]} */ (rulesOut);
  return [
    `The answer: ${text}`,
    why === null ? 'Why: not given' : `Why: ${why}`,
    ruled.length === 0 ? 'What it rules out: nothing named' : `What it rules out:\n${ruled.map((r) => `- ${r}`).join('\n')}`,
  ].join('\n\n');
}

/** @typedef {{rules: string[]}|{cannot: CannotRun, detail: string}} Judged */

/** The call's question of a decision's content. @param {Record<string, unknown>} content @returns {import('../kernel/claude-call.cjs').Ask} */
function askOf(content) {
  return { system: PROMPT, schema: SCHEMA, model: MODEL, effort: EFFORT, input: entryText(content), timeoutMs: TIMEOUT_MS };
}

/** The rules the call's answer names, or why it cannot run. @param {import('../kernel/claude-call.cjs').Answer} answered @returns {Judged} */
function rulesOf(answered) {
  if ('cannot' in answered) return answered;
  return { rules: /** @type {{rules: string[]}} */ (answered.answer).rules };
}

/**
 * The rules a decision holds, as the separate call judges them from its own
 * content; or why the call cannot run — a call that throws among them.
 * @param {Record<string, unknown>} content
 * @returns {Judged}
 */
function judgeDecision(content) {
  try {
    return rulesOf(claudeCall.askClaude(askOf(content)));
  } catch (err) {
    return { cannot: 'failed', detail: messageOf(err) };
  }
}

/**
 * `judgeDecision` answering later, so several decisions are judged at once.
 * @param {Record<string, unknown>} content
 * @returns {Promise<Judged>}
 */
async function judgeDecisionAsync(content) {
  try {
    return rulesOf(await claudeCall.askClaudeAsync(askOf(content)));
  } catch (err) {
    return { cannot: 'failed', detail: messageOf(err) };
  }
}

/**
 * The entries a decision's links name, by short id: the question it answers,
 * and, for a replacement, the entry it replaces.
 * @typedef {{answers: string, replaces: string|null}} Named
 */

/**
 * The refusal of an entry holding several rules: nothing appended, the rules
 * named, and how to split it — each part answering the question the whole
 * answered.
 * @param {string} verb @param {Named} named @param {string[]} rules
 * @returns {Error}
 */
function holdsSeveral(verb, { answers, replaces }, rules) {
  const listed = rules.map((rule, i) => `  ${i + 1}. ${rule}`).join('\n');
  const split = replaces === null
    ? `decide each as its own entry answering ${answers}`
    : `replace ${replaces} with one of them, and decide each other as its own entry answering ${answers}`;
  const err = new Error(`ledger ${verb}: the decision holds ${rules.length} rules, and an entry holds one — nothing appended. Split it: ${split}:\n${listed}`);
  return Object.assign(err, { payload: { rules } });
}

/**
 * A decision as asked, with the one-decision check's result riding on it:
 * one holding one rule lands checked; one the call cannot judge lands
 * unchecked, as asked. Refuses a decision holding several rules, naming the
 * entries its links name.
 * @param {Request} request @param {Named} named
 * @returns {Request}
 */
function checkOneDecision(request, named) {
  const judged = judgeDecision(request.content);
  if ('cannot' in judged) return request;
  if (judged.rules.length > 1) throw holdsSeveral(request.verb, named, judged.rules);
  return { ...request, unchecked: false };
}

module.exports = { PROMPT, SCHEMA, judgeDecision, judgeDecisionAsync, checkOneDecision };
