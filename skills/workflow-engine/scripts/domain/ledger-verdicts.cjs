'use strict';

// ---------------------------------------------------------------------------
// Domain ring: departures and the verdict queue (5.8.10, 16.10) — a
// projection of the ledger, never a file — and its read verb,
// `ledger verdicts`.
//
// - Who moved whom says whose answer stood, measured against Claude's lean
//   (5.1.1): `none`, the person's answer was Claude's lean from the start;
//   `claude-moved-person`, the person came round to it;
//   `person-moved-claude`, the person's answer stood over it — an amendment,
//   an overrule, a blind answer differing from the sealed one (16.10.10), a
//   call overruled when shown.
// - A departure is an answer that amends or overrules Claude's lean
//   (16.10.1): a decision the person made whose answer stood over the lean.
//   The person's replacement of a decision, for a changed mind or a
//   mistake, stands over the lean where the entry it replaces held it —
//   Claude's own call, or the person's answer that was the lean or came
//   round to it: a later reversal, or a call overruled when shown — and the
//   engine says so where the writer leaves it out. Where that entry stood
//   over the lean, it comes back round to the lean or gives a third answer
//   still against it: only its writer can tell, so the writer says which,
//   and never that it was the lean from the start. For a new fact or
//   another topic's decision it is new information, never a departure. Nor
//   does an entry Claude made ever stand over its own lean. The write verbs
//   hold every entry to this as it is written (ledger-write.cjs), so the
//   ledger's line says it.
// - The queue: every departure made in a live place, current or replaced
//   since — it happened, and its verdict is owed — less those the trust log
//   holds a verdict on (16.10.9), read through `trustLog.verdicts` alone,
//   which holds none until the trust log is built (29.4). Each shows
//   Claude's lean beside it: the sealed answer of the nearest entry down its
//   chain that holds one, or the answer of the nearest that held the lean,
//   past the person's own earlier departures.
// ---------------------------------------------------------------------------

const { factsOf, standingOf, isLive } = require('./ledger-fold.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */

const OVER_THE_LEAN = 'person-moved-claude';
const BACK_TO_THE_LEAN = 'claude-moved-person';

/** Who moved whom on an entry never standing over the lean. */
const NOT_OVER = Object.freeze(['none', BACK_TO_THE_LEAN]);

/** Who moved whom on the person's replacement of their own departure: a return to the lean, or a third answer still against it. */
const AFTER_A_DEPARTURE = Object.freeze([BACK_TO_THE_LEAN, OVER_THE_LEAN]);

/** The reasons a replacement disagrees with what it replaces, and what each of the others brings instead. */
const DISAGREEING = Object.freeze(['changed-mind', 'was-wrong']);
const NEW_INFORMATION = Object.freeze({ 'new-fact': 'a new fact', 'other-topic': 'another topic\'s decision' });

/** Whether an entry held Claude's lean: Claude's own call, which never stands over it, or the person's answer that was the lean or came round to it. @param {IdFacts} facts */
function heldTheLean({ who_moved_whom: moved }) {
  return moved !== OVER_THE_LEAN;
}

/**
 * The values who moved whom may take on an entry, and why, by who made it
 * and, for the person's replacement of a decision, its reason and the entry
 * it replaces; null where the departure rule leaves it to the writer.
 * @param {unknown} by @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {{moves: readonly string[], why: string}|null}
 */
function ruleFor(by, reason, replaced) {
  if (by === 'claude') return { moves: NOT_OVER, why: 'an entry Claude made never stands over its own lean' };
  if (replaced === null || replaced.kind !== 'decision') return null;
  if (!DISAGREEING.includes(/** @type {string} */ (reason))) {
    const brings = NEW_INFORMATION[/** @type {keyof typeof NEW_INFORMATION} */ (reason)];
    return { moves: NOT_OVER, why: `a replacement for ${brings} brings new information, never the person standing over Claude's lean` };
  }
  if (heldTheLean(replaced)) {
    return { moves: [OVER_THE_LEAN], why: 'the person replacing an answer that held Claude\'s lean, for a changed mind or a mistake, stands over it' };
  }
  return { moves: AFTER_A_DEPARTURE, why: 'the person replacing an answer that stood over Claude\'s lean, for a changed mind or a mistake, comes back round to it or stands over it still' };
}

/**
 * Who moved whom where the departure rule allows one value alone, for the
 * engine to set where the writer leaves it out; null where it allows more.
 * @param {Record<string, unknown>} content the entry's, its maker among it
 * @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {string|null}
 */
function derivedMove({ by }, reason, replaced) {
  const rule = ruleFor(by, reason, replaced);
  return rule !== null && rule.moves.length === 1 ? rule.moves[0] : null;
}

/**
 * Why who moved whom cannot stand on an entry as written, or null where it
 * can: a value the departure rule does not allow.
 * @param {Record<string, unknown>} content the entry's, its maker and who moved whom among it
 * @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {string|null}
 */
function movedRefusal({ by, who_moved_whom: moved }, reason, replaced) {
  const rule = ruleFor(by, reason, replaced);
  return rule === null || rule.moves.includes(/** @type {string} */ (moved)) ? null : `${rule.why}: ${rule.moves.join(' or ')}`;
}

/**
 * Whether an entry is a departure (16.10.1): a decision whose answer stood
 * over Claude's lean — the person's, as a decision is the person's or
 * Claude's, and Claude's never stands over its own.
 * @param {Folded} folded @param {string} id
 */
function isDeparture(folded, id) {
  const { kind, who_moved_whom: moved } = factsOf(folded, id);
  return kind === 'decision' && moved === OVER_THE_LEAN;
}

/**
 * The trust log as the verdict queue reads it: the full ids of the
 * departures it holds a verdict on — nothing, a fix later or a real loss; a
 * skip leaves one waiting (16.10.1). None until the trust log is built
 * (29.4).
 */
const trustLog = {
  /** @param {string} _root the project's state root @returns {ReadonlySet<string>} */
  verdicts: (_root) => new Set(),
};

/**
 * The verdict queue: every departure made in a live place that `judged`
 * holds no verdict on, in the ledger's order.
 * @param {Folded} folded @param {ReadonlySet<string>} judged
 * @returns {string[]}
 */
function queueOf(folded, judged) {
  return [...folded.facts.keys()].filter((id) => isDeparture(folded, id) && isLive(folded, id) && !judged.has(id));
}

/**
 * Claude's lean beside a departure: the sealed answer of the nearest entry
 * down its chain that holds one, or the answer of the nearest that held the
 * lean, past the person's own earlier departures; null where none did.
 * @param {Shower} shower @param {string} id
 * @returns {unknown}
 */
function leanOf({ folded, show }, id) {
  for (let at = /** @type {string|null} */ (id); at !== null; at = factsOf(folded, at).replaces) {
    const { sealed, text } = show(at);
    if (typeof sealed === 'string') return sealed;
    if (heldTheLean(factsOf(folded, at))) return text;
  }
  return null;
}

/**
 * `ledger verdicts`: the departures waiting on a verdict, each with where it
 * stands and Claude's lean.
 * @param {Shower} shower @param {import('./ledger-read.cjs').Place} _place @param {string} root
 */
function answerVerdicts(shower, _place, root) {
  return {
    departures: queueOf(shower.folded, trustLog.verdicts(root)).map((id) => ({
      ...shower.show(id), standing: standingOf(shower.folded, id), lean: leanOf(shower, id),
    })),
  };
}

module.exports = { trustLog, derivedMove, movedRefusal, answerVerdicts };
