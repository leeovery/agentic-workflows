'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where the ledger stood when an agent was dispatched, and what
// a topic has done since (9.8.14, 9.9.6), read from the folded ledger's
// facts (ledger-fold.cjs) in the ledger's order, the order its lines were
// written in (ledger.cjs). Pure.
//
// - A mark: the id of the ledger's last line when it was taken, null while
//   the ledger holds none. Every line after it came after the mark was
//   taken. A mark the ledger does not hold — read from a hand-edited cache
//   — sits before every line.
// - A topic's moves since a mark, which arm the background review's back-off
//   (9.8.14): the person's questions opened or closed on it, and Claude's
//   calls — each question asked on it but a review's finding (5.3.9) and
//   one Claude's own call answers; each decision made on it, a replaced
//   answer among them, the person's or Claude's alike, a review finding's
//   answer too; and each question moved, on the topic it left and on the
//   topic it went to. A rewording, a finding, a confirmation, a keep and a
//   merge move nothing.
// - A topic's last decision: where the latest decision made on it sits, a
//   replaced answer among them, which a gap review is measured against
//   (9.9.6); 0 where it has none.
// ---------------------------------------------------------------------------

/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {ReadonlyMap<string, IdFacts>} Facts */

/** The mark the ledger stands at: its last line's id, null where it holds none. @param {Facts} facts @returns {string|null} */
function markOf(facts) {
  let last = null;
  for (const id of facts.keys()) last = id;
  return last;
}

/** Where a mark sits: its line's number, 0 for none or one the ledger does not hold. @param {Facts} facts @param {unknown} mark */
function lineOf(facts, mark) {
  const held = typeof mark === 'string' ? facts.get(mark) : undefined;
  return held === undefined ? 0 : held.place.number;
}

/** The questions Claude's own calls answer, by the first wording of each. @param {Facts} facts @returns {Set<string>} */
function ownCallQuestions(facts) {
  /** @type {Set<string>} */
  const answered = new Set();
  for (const { kind, by, given, answers } of facts.values()) {
    const question = kind === 'decision' && by === 'claude' && given === 'own' && answers !== null ? facts.get(answers) : undefined;
    if (question !== undefined) answered.add(question.root);
  }
  return answered;
}

/**
 * The moves made on `topic` of `unit` since `mark`.
 * @param {Facts} facts @param {string} unit @param {string} topic @param {unknown} mark
 */
function movesSince(facts, unit, topic, mark) {
  const after = lineOf(facts, mark);
  const ownCalls = ownCallQuestions(facts);
  let moves = 0;
  for (const [id, fact] of facts) {
    if (fact.place.number > after && fact.unit === unit && isMove(id, fact, topic, ownCalls)) moves += 1;
  }
  return moves;
}

/**
 * Whether the line `id` is a move on `topic`.
 * @param {string} id @param {IdFacts} fact @param {string} topic @param {Set<string>} ownCalls
 */
function isMove(id, { event, kind, by, topic: madeOn, to }, topic, ownCalls) {
  const here = madeOn === topic;
  if (event === 'asked') return here && by !== 'review' && !ownCalls.has(id);
  if (event === 'moved') return here || to === topic;
  return kind === 'decision' && here;
}

/** Where the last decision made on `topic` of `unit` sits; 0 where none is. @param {Facts} facts @param {string} unit @param {string} topic */
function lastDecisionLine(facts, unit, topic) {
  let last = 0;
  for (const { kind, unit: madeIn, topic: madeOn, place } of facts.values()) {
    if (kind === 'decision' && madeIn === unit && madeOn === topic) last = Math.max(last, place.number);
  }
  return last;
}

module.exports = { markOf, lineOf, movesSince, lastDecisionLine };
