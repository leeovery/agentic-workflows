'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ask rule (16.1, 16.3–16.7) — whether a call Claude has a
// lean on goes to the person, computed over the person's own answers, never
// decided by Claude (16.1.1) nor by the separate call (16.19.2). Pure: the
// call's sort, where it is made, its label, the counts (trust-counts.cjs),
// the person's settings (trust-settings.cjs) and their care entries are its
// only inputs, so the same inputs always give the same decision (16.1.3).
// Claude's stated confidence, its why, is never read (16.1.4).
//
// It decides, in this order:
// - In discovery, ask: nothing is decided there alone (16.7.3).
// - With no label — the labeller's call failed, or no login serves it —
//   ask (16.19.8).
// - A question Claude could find the answer to (the label's second answer):
//   check, drawing nothing; raised again once sent to check, ask (16.3.1,
//   16.11.7).
// - Always ask, whatever the counts (16.5): a danger question, read from the
//   label's ninth answer whatever kind it composes (16.5.1); its kind under a
//   care entry in this project (16.5.2); replacing an entry the person
//   decided, read from the entry (16.5.7); and a question Claude marks as a
//   design problem (19.4.22) or testing against a live server (19.4.20), a
//   mark that can only make it ask.
// - A call Claude sorts as having one defensible answer, as the count of
//   such calls stands (16.4.10, 16.3.7): it proceeds until overrules lift
//   that count's bound past the threshold.
// - Else as its kind's count stands (16.4.1, 16.6.1): asking until its bound
//   falls below the threshold, then quiet, proceeding, until the bound rises
//   a quarter above it.
// The threshold a question takes is the person's (16.4.6), their raise of it
// mid-build once they pick one where the question blocks build work — the
// build's mark, never Claude's word (16.4.7) — and half of either where a
// later change would reach beyond the piece, the label's tenth answer
// (16.4.8). Where in the cone the work is enters nowhere (16.7.2).
//
// The reason is in the person's words, from numbers and the names of the
// kind and the project alone, never text from the trust log (16.9.2,
// 16.1.3); the check's alone is Claude's, saying what to do.
// ---------------------------------------------------------------------------

const { kindOf, hardToUndo, checkable, danger } = require('./labeller.cjs');
const { stateOf } = require('./trust-counts.cjs');
const { HARD_TO_UNDO, ASK_AGAIN } = require('./trust-settings.cjs');

/** @typedef {import('./labeller.cjs').Label} Label */
/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./trust-counts.cjs').Counts} Counts */
/** @typedef {import('./trust-counts.cjs').State} State */
/** @typedef {import('./trust-settings.cjs').Settings} Settings */
/** @typedef {import('./ledger-events.cjs').DecidedBy} DecidedBy */
/** What the rule answers: ask the person, Claude's call proceeding, or Claude sent to check. @typedef {'ask'|'proceed'|'check'} Ruling */
/** A mark that only makes a question ask: a design problem (19.4.22), or testing against a live server (19.4.20). @typedef {'design-problem'|'live-server'} Always */
/** A care entry (16.5.2): a kind that always asks in one project, known by the project's id. @typedef {{project: string, kind: Kind}} CareEntry */
/**
 * What the rule decides a call from beside its sort.
 * @typedef {object} Context
 * @property {Label|null} label the labeller's, null where it gave none
 * @property {{unit: string, phase: string, topic: string|null}} place where the call is made
 * @property {boolean} blocks_build made in the build, where a question asked parks
 * @property {DecidedBy|null} replaced_by who decided the entry the call would replace, null where it replaces none
 * @property {Always|null} always the mark it always asks by, null for none
 * @property {boolean} checked sent to check once already
 * @property {{id: string, name: string}} project the project the call is made in
 * @property {Counts} counts the counts on the project, for the session's model, as of now
 * @property {Settings} settings the person's
 * @property {CareEntry[]} care the person's care entries
 */
/** The threshold a question takes, and how the person is told it. @typedef {{limit: number, said: string}} Line */

/** Why each mark always asks. @type {Readonly<Record<Always, string>>} */
const ALWAYS = Object.freeze({
  'design-problem': 'The root cause is a design problem, so it always comes to you.',
  'live-server': 'It means testing against a live server, so it always comes to you.',
});

/** The marks, as `raise --always` takes them. */
const ALWAYS_MARKS = Object.freeze(/** @type {Always[]} */ (Object.keys(ALWAYS)));

const IN_DISCOVERY = 'Nothing is decided in discovery, so it comes to you.';
const UNLABELLED = 'I couldn\'t tell what kind of question this is, so it comes to you.';
const CHECK_IT = 'You can find this out: check it — read the code or the record, or run something — and raise it again only if checking can\'t settle it.';
const CHECKED = 'Checking couldn\'t settle it, so it comes to you.';
const DANGER = 'An answer here could lose data or weaken security, so it always comes to you.';
const YOURS = 'You decided this yourself, so changing it always comes to you.';

/** @param {string} reason @returns {{decision: Ruling, reason: string}} */
const asks = (reason) => ({ decision: 'ask', reason });

/** @param {string} reason @returns {{decision: Ruling, reason: string}} */
const proceeds = (reason) => ({ decision: 'proceed', reason });

/** A rate in percent, to `places`. @param {number} rate @param {number} places */
const shown = (rate, places) => Number((rate * 100).toFixed(places));

/** A line, as a percent. @param {number} rate */
const percent = (rate) => `${shown(rate, 2)}%`;

/**
 * A bound as a percent, to as few places as tell it from `line`'s — two at
 * most — so it never reads as the line itself.
 * @param {number} bound @param {number} line
 */
function against(bound, line) {
  const places = [0, 1].find((n) => shown(bound, n) !== shown(line, n)) ?? 2;
  return `${shown(bound, places)}%`;
}

/**
 * The threshold the question takes: the person's — raised mid-build where it
 * blocks build work and they picked a raise — halved where it would be hard
 * to undo.
 * @param {Context} context @param {boolean} hard
 * @returns {Line}
 */
function lineOf({ settings, blocks_build: blocks }, hard) {
  const raised = blocks && settings.build_threshold !== null;
  const base = raised ? /** @type {number} */ (settings.build_threshold) : settings.threshold;
  const limit = hard ? base * HARD_TO_UNDO : base;
  const where = raised ? ' mid-build' : '';
  return { limit, said: hard ? `the ${percent(limit)} for what's hard to undo${where}` : `your ${percent(limit)}${where}` };
}

/**
 * Why the question always asks, or null where nothing makes it.
 * @param {Context} context @param {Kind} kind
 * @returns {string|null}
 */
function alwaysAsks({ label, care, project, replaced_by: by, always }, kind) {
  if (danger(label)) return DANGER;
  if (care.some((entry) => entry.project === project.id && entry.kind === kind)) return `It's ${kind}, and you've asked that ${kind} always comes to you in ${project.name}.`;
  if (by === 'person') return YOURS;
  return always === null ? null : ALWAYS[always];
}

/**
 * As the count of Claude's one-answer calls stands at `line`.
 * @param {Context} context @param {Line} line
 */
function oneAnswer({ counts, project }, { limit, said }) {
  const { asks: asking, bound, losses } = stateOf(counts.one, limit);
  const lead = `It has one sensible answer, ${asking ? 'but' : 'and'} you`;
  if (asking) return asks(`${lead}'ve overruled my one-answer calls in ${project.name} more often than you allow: ${against(bound, limit)}, over ${said}.`);
  if (losses === 0) return proceeds(`${lead} haven't overruled my one-answer calls in ${project.name}.`);
  if (bound < limit) return proceeds(`${lead}'ve overruled my one-answer calls in ${project.name} less often than you allow: ${against(bound, limit)}, under ${said}.`);
  return proceeds(`${lead} haven't overruled my one-answer calls in ${project.name} often enough to bring them to you: ${against(bound, limit)}.`);
}

/**
 * As the count of `kind` stands at `line`.
 * @param {Context} context @param {Kind} kind @param {Line} line
 */
function byKind({ counts, project }, kind, { limit, said }) {
  const { asks: asking, bound, losses, clean } = stateOf(counts.kinds[kind], limit);
  const on = `It's ${kind}, and on ${kind} in ${project.name} my calls`;
  if (asking && losses + clean === 0) return asks(`It's ${kind}, and you haven't answered any ${kind} questions in ${project.name} yet, so it comes to you.`);
  if (asking) return asks(`${on} still miss more often than you allow: ${against(bound, limit)}, over ${said}.`);
  if (bound < limit) return proceeds(`${on} miss less often than you allow: ${against(bound, limit)}, under ${said}.`);
  const again = limit * ASK_AGAIN;
  return proceeds(`${on} went under ${said} and haven't risen over ${percent(again)} since: ${against(bound, again)}.`);
}

/**
 * Whether the call goes to the person, and why: in discovery, or with no
 * label, ask; a question Claude could find out, check, and ask once sent to
 * check; danger, a care entry, replacing the person's decision or a mark,
 * ask; else as the count of one-answer calls stands for a call sorted
 * `one`, and as its kind's count stands for any other.
 * @param {{sort: 'one'|'several'}} call @param {Context} context
 * @returns {{decision: Ruling, reason: string}}
 */
function rule({ sort }, context) {
  const { label, place, checked } = context;
  if (place.phase === 'discovery') return asks(IN_DISCOVERY);
  if (label === null) return asks(UNLABELLED);
  if (checkable(label)) return checked ? asks(CHECKED) : { decision: 'check', reason: CHECK_IT };
  const kind = /** @type {Kind} */ (kindOf(label));
  const always = alwaysAsks(context, kind);
  if (always !== null) return asks(always);
  const line = lineOf(context, /** @type {boolean} */ (hardToUndo(label)));
  return sort === 'one' ? oneAnswer(context, line) : byKind(context, kind, line);
}

module.exports = { ALWAYS_MARKS, rule };
