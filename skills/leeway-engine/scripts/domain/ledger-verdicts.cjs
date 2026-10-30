'use strict';

// ---------------------------------------------------------------------------
// Domain ring: departures and the verdict queue (5.8.10, 16.10) — the
// ledger read through this machine's trust log, never a file, read through
// `verdict queue` (verdict.cjs).
//
// - Who moved whom says whose answer stood, measured against Claude's lean
//   (5.1.1): `none`, the person's answer was Claude's lean from the start;
//   `claude-moved-person`, the person came round to it;
//   `person-moved-claude`, the person's answer stood over it — an amendment,
//   an overrule, a blind answer differing from the sealed one (16.10.10), a
//   call overruled when shown.
// - A departure is an answer that amends or overrules Claude's lean
//   (16.10.1): a decision the person made whose answer stood over the lean,
//   so where there was no lean there is no departure. Claude leaned on an
//   entry's chain where it, or an entry down its chain, is Claude's own
//   call — the person's "your call" and "don't care" among them, never one
//   carried over — or carries Claude's sealed answer (ledger-fold.cjs). An
//   entry Claude made never stands over its own lean. The person's answer
//   to Claude's lean is a raise's, which says who moved whom against the
//   lean it sealed (raise.cjs); the write verbs take no sealed answer on
//   the person's entry (5.3.10). The person's decision on a chain Claude
//   never leaned on — written, or replaced for any reason — holds no lean
//   to move, so moves no one: the person deciding unprompted, then changing
//   their mind, is no departure. The person's replacement of a decision,
//   for a changed mind or a mistake, stands over the lean where the entry
//   it replaces held it — its chain leaned and it did not stand over the
//   lean: Claude's own call, or the person's answer that was the lean or
//   came round to it: a later reversal, or a call overruled when shown —
//   and the engine says so where the writer leaves it out. Where that entry
//   stood over the lean, it comes back round to the lean or gives a third
//   answer still against it: only its writer can tell, so the writer says
//   which, and never that it was the lean from the start. For a new fact or
//   another topic's decision it is new information, never a departure. The
//   person keeping a decision as it stands, where Claude proposed to
//   replace it, stands over the proposal: a departure, though it is no
//   entry (ledger-events.cjs). The write verbs, and a raise's keep, hold
//   every line to this as it is written (ledger-write.cjs, raise.cjs), so
//   the ledger's line says it.
// - A reversal (16.12.1) is the person's replacement this rule holds
//   standing over a lean the entry it replaces held, wherever that entry
//   stands: the write logs it in the trust log, naming the entry it
//   reverses (ledger-write.cjs).
// - The queue: every departure this machine logged (16.13.1, 16.13.6) made
//   in a live place, current or replaced since — it happened, and its
//   verdict is owed — less those given a verdict, in the trust log or
//   waiting in any conversation for it (16.10.9), in the ledger's order.
//   The departures and the verdicts are the trust log's, read in one pass
//   (trust-evidence.cjs): a raise answered against the lean — a keep among
//   them, its raise event naming the keep — and a reversal. A departure
//   another machine logged is judged on the machine where it was made, so
//   the queue never asks it again here. An event naming an entry the ledger
//   lacks is skipped, and a ledger departure no event names — the person's
//   replacement of their own departure, still against the lean, which is no
//   new evidence — is no departure here.
//   Each shows Claude's lean beside it: the sealed answer of the nearest
//   entry down its chain that holds one, or the answer of the nearest that
//   held the lean, past the person's own earlier departures; beside a keep,
//   the proposal it seals, the keep's row carrying the answer it kept.
// ---------------------------------------------------------------------------

const { factsOf, standingOf, isLive } = require('./ledger-fold.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').IdFacts} IdFacts */
/** @typedef {import('./ledger-events.cjs').EntryKind} EntryKind */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./trust-evidence.cjs').Evidence} Evidence */

const OVER_THE_LEAN = 'person-moved-claude';
const BACK_TO_THE_LEAN = 'claude-moved-person';

/** Who moved whom on an entry never standing over the lean. */
const NOT_OVER = Object.freeze(['none', BACK_TO_THE_LEAN]);

/** Who moved whom on the person's replacement of their own departure: a return to the lean, or a third answer still against it. */
const AFTER_A_DEPARTURE = Object.freeze([BACK_TO_THE_LEAN, OVER_THE_LEAN]);

/** The rule on the person's decision on a chain Claude never leaned on, written or replaced. */
const NO_LEAN = Object.freeze({
  moves: Object.freeze(['none']),
  why: 'the person\'s decision holds no lean of Claude\'s to move, no entry down its chain being Claude\'s own or carrying its sealed answer; their answer to Claude\'s lean is recorded by raise answer',
});

/** The rule on the person keeping a decision Claude proposed to replace. */
const KEEPING = Object.freeze({
  moves: Object.freeze([OVER_THE_LEAN]),
  why: 'the person keeping an entry as it stands, where Claude proposed to replace it, stands over Claude\'s proposal',
});

/** The reasons a replacement disagrees with what it replaces, and what each of the others brings instead. */
const DISAGREEING = Object.freeze(['changed-mind', 'was-wrong']);
const NEW_INFORMATION = Object.freeze({ 'new-fact': 'a new fact', 'other-topic': 'another topic\'s decision' });

/**
 * Whether an entry on a chain Claude leaned on held its lean: Claude's own
 * call, which never stands over it, or the person's answer that was the
 * lean or came round to it.
 * @param {IdFacts} facts
 */
function heldTheLean({ who_moved_whom: moved }) {
  return moved !== OVER_THE_LEAN;
}

/**
 * The values who moved whom may take on a line, and why: on a keep, the
 * person standing over Claude's proposal; on an entry, by who made it, the
 * kind it is and, for the person's replacement of a decision, its reason
 * and the entry it replaces; null where the departure rule leaves it to the
 * writer.
 * @param {Record<string, unknown>} content the line's, its maker among it, and its event where it is a keep
 * @param {EntryKind|null} kind @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {{moves: readonly string[], why: string}|null}
 */
function ruleFor({ by, event }, kind, reason, replaced) {
  if (event === 'kept') return KEEPING;
  if (by === 'claude') return { moves: NOT_OVER, why: 'an entry Claude made never stands over its own lean' };
  if (kind !== 'decision') return null;
  if (replaced === null || !replaced.leaned) return NO_LEAN;
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
 * @param {Record<string, unknown>} content the line's, its maker among it, and its event where it is a keep
 * @param {EntryKind|null} kind @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {string|null}
 */
function derivedMove(content, kind, reason, replaced) {
  const rule = ruleFor(content, kind, reason, replaced);
  return rule !== null && rule.moves.length === 1 ? rule.moves[0] : null;
}

/**
 * Whether the entry reverses the one it replaces (16.12.1): the departure
 * rule allows it only to stand over a lean the replaced entry held.
 * @param {Record<string, unknown>} content the entry's, its maker among it
 * @param {EntryKind|null} kind @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 */
function reverses(content, kind, reason, replaced) {
  return derivedMove(content, kind, reason, replaced) === OVER_THE_LEAN;
}

/**
 * Why who moved whom cannot stand on an entry as written, or null where it
 * can: a value the departure rule does not allow.
 * @param {Record<string, unknown>} content the entry's, its maker and who moved whom among it
 * @param {EntryKind|null} kind @param {string|null} reason a replacement's @param {IdFacts|null} replaced the entry a replacement replaces
 * @returns {string|null}
 */
function movedRefusal(content, kind, reason, replaced) {
  const rule = ruleFor(content, kind, reason, replaced);
  return rule === null || rule.moves.includes(/** @type {string} */ (content.who_moved_whom)) ? null : `${rule.why}: ${rule.moves.join(' or ')}`;
}

/**
 * Whether a line is a departure (16.10.1): a decision whose answer stood
 * over Claude's lean — the person's, as a decision is the person's or
 * Claude's, and Claude's never stands over its own — or the person's keep
 * of a decision, standing over Claude's proposed replacement.
 * @param {Folded} folded @param {string} id
 */
function isDeparture(folded, id) {
  const { event, kind, who_moved_whom: moved } = factsOf(folded, id);
  return (kind === 'decision' || event === 'kept') && moved === OVER_THE_LEAN;
}

/**
 * The verdict queue: every departure `evidence` logged, made in a live
 * place, that it holds no verdict on, in the ledger's order.
 * @param {Folded} folded @param {Pick<Evidence, 'departures'|'judged'>} evidence
 * @returns {string[]}
 */
function queueOf(folded, evidence) {
  return [...folded.facts.keys()].filter((id) => evidence.departures.has(id) && isLive(folded, id) && !evidence.judged.has(id));
}

/**
 * Claude's lean beside a departure: the sealed answer of the nearest entry
 * down its chain that holds one — a keep's own, Claude's proposal — or the
 * answer of the nearest that held the lean, past the person's own earlier
 * departures; null where none did.
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
 * A departure as the queue shows it: its line — a keep's with the answer it
 * kept, the entry's text, as a decision's line holds its answer — where it
 * stands, and Claude's lean.
 * @param {Shower} shower @param {string} id
 */
function departureRow(shower, id) {
  const { event, entry } = factsOf(shower.folded, id);
  const kept = event === 'kept' ? { text: shower.show(/** @type {string} */ (entry)).text } : {};
  return { ...shower.show(id), ...kept, standing: standingOf(shower.folded, id), lean: leanOf(shower, id) };
}

/**
 * The verdict queue's answer: the departures waiting on a verdict.
 * @param {Shower} shower @param {string} root
 */
function answerQueue(shower, root) {
  return { departures: queueOf(shower.folded, evidenceOf(root)).map((id) => departureRow(shower, id)) };
}

module.exports = { OVER_THE_LEAN, BACK_TO_THE_LEAN, derivedMove, movedRefusal, reverses, isDeparture, departureRow, answerQueue };
