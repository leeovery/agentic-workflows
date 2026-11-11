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
// - Always ask, whatever the counts (16.5), where no label is needed to
//   tell: replacing an entry the person decided, or kept since (16.5.7); and
//   a question Claude marks as a design problem (19.4.22) or testing against
//   a live server (19.4.20), a mark that can only make it ask.
// - With no label — the labeller's call failed, or no login serves it —
//   ask (16.19.8).
// - Always ask where the label tells: a danger question, read from the
//   label's ninth answer whatever kind it composes (16.5.1); its kind under a
//   care entry in this project (16.5.2).
// - A question Claude could find the answer to (the label's second answer):
//   check, drawing nothing; raised again once sent to check, ask (16.3.1,
//   16.11.7). A check settles a fact, never the person's consent, so it
//   comes after every ask above.
// - A call Claude sorts as having one defensible answer, as the count of
//   such calls stands (16.4.10, 16.3.7): it proceeds until overrules lift
//   that count's bound past the threshold — a whole overrule counted at
//   least.
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
/** @typedef {import('./event-fields.cjs').Always} Always */
/** What the rule answers: ask the person, Claude's call proceeding, or Claude sent to check. @typedef {'ask'|'proceed'|'check'} Ruling */
/** A care entry (16.5.2): a kind that always asks in one project, known by the project's id. @typedef {{project: string, kind: Kind}} CareEntry */
/**
 * What the rule decides a call from beside its sort.
 * @typedef {object} Context
 * @property {Label|null} label the labeller's, null where it gave none
 * @property {{unit: string, phase: string, topic: string|null}} place where the call is made
 * @property {boolean} blocks_build made in the build for a task, which a question asked parks
 * @property {DecidedBy|null} replaced_by whose the entry the call would replace is — who decided it, or the person where they kept it since — null where it replaces none
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

const UNLABELLED = 'I couldn\'t tell what kind of question this is, so it comes to you.';
const CHECK_IT = 'You can find this out: check it — read the code or the record, or run something — and raise it again only if checking can\'t settle it.';
const CHECKED = 'Checking couldn\'t settle it, so it comes to you.';
const DANGER = 'An answer here could lose data or weaken security, so it always comes to you.';
const YOURS = 'You decided this yourself, so changing it always comes to you.';

/** @param {string} reason @returns {{decision: Ruling, reason: string}} */
const asks = (reason) => ({ decision: 'ask', reason });

/** @param {string} reason @returns {{decision: Ruling, reason: string}} */
const proceeds = (reason) => ({ decision: 'proceed', reason });

// The most places a percent is shown to: past them a bound and a line read
// alike only where the bound is the line, to the bisection's precision.
const MOST_PLACES = 10;

/** A rate in percent, to `places`. @param {number} rate @param {number} places */
const shown = (rate, places) => Number((rate * 100).toFixed(places));

/** A line, as a percent, to as many places as it holds. @param {number} rate */
const percent = (rate) => `${shown(rate, MOST_PLACES)}%`;

/**
 * A bound as a percent, to as few places as tell it from `line`'s, so it
 * never reads as the line itself.
 * @param {number} bound @param {number} line
 */
function against(bound, line) {
  let places = 0;
  while (places < MOST_PLACES && shown(bound, places) === shown(line, places)) places += 1;
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
 * Why the call asks before its label is read — replacing an entry of the
 * person's, under Claude's mark, or with no label — or null.
 * @param {Context} context
 * @returns {string|null}
 */
function asksUnread({ replaced_by: by, always, label }) {
  if (by === 'person') return YOURS;
  if (always !== null) return ALWAYS[always];
  return label === null ? UNLABELLED : null;
}

/**
 * Why the label makes the question always ask — danger, or a care entry on
 * its kind in this project — or null.
 * @param {Context} context @param {Kind} kind
 * @returns {string|null}
 */
function asksByLabel({ label, care, project }, kind) {
  if (danger(/** @type {Label} */ (label))) return DANGER;
  return care.some((entry) => entry.project === project.id && entry.kind === kind) ? `It's ${kind}, and you've asked that ${kind} always comes to you in ${project.name}.` : null;
}

/**
 * How a count gone quiet under `line` stands, not yet a quarter over it
 * (16.6.1): the bound against the line it would ask again over.
 * @param {number} bound @param {Line} line
 */
function quietSince(bound, { limit, said }) {
  const again = limit * ASK_AGAIN;
  return `went under ${said} and haven't risen over ${percent(again)} since: ${against(bound, again)}.`;
}

/**
 * As the count of Claude's one-answer calls stands at `line`: quiet over it
 * where the overrules weigh less than one whole overrule, or where they went
 * under it and have not risen a quarter over it since.
 * @param {Context} context @param {Line} line
 */
function oneAnswer({ counts, project }, { limit, said }) {
  const { asks: asking, bound, losses } = stateOf(counts.one, limit);
  const lead = `It has one sensible answer, ${asking ? 'but' : 'and'}`;
  const calls = `my one-answer calls in ${project.name}`;
  if (asking) return asks(`${lead} you've overruled ${calls} more often than you allow: ${against(bound, limit)}, over ${said}.`);
  if (losses === 0) return proceeds(`${lead} you haven't overruled ${calls}.`);
  if (bound < limit) return proceeds(`${lead} you've overruled ${calls} less often than you allow: ${against(bound, limit)}, under ${said}.`);
  if (losses < 1) return proceeds(`${lead} your overrules of ${calls} weigh less than one whole overrule here, so they don't come to you yet: ${against(bound, limit)}, over ${said}.`);
  return proceeds(`${lead} ${calls} ${quietSince(bound, { limit, said })}`);
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
  return proceeds(`${on} ${quietSince(bound, { limit, said })}`);
}

/**
 * Whether the call goes to the person, and why: replacing an entry of the
 * person's, under Claude's mark, or with no label, ask; danger
 * or a care entry, ask; a question Claude could find out, check, and ask
 * once sent to check; else as the count of one-answer calls stands for a
 * call sorted `one`, and as its kind's count stands for any other.
 * @param {{sort: 'one'|'several'}} call @param {Context} context
 * @returns {{decision: Ruling, reason: string}}
 */
function rule({ sort }, context) {
  const unread = asksUnread(context);
  if (unread !== null) return asks(unread);
  const label = /** @type {Label} */ (context.label);
  const kind = /** @type {Kind} */ (kindOf(label));
  const always = asksByLabel(context, kind);
  if (always !== null) return asks(always);
  if (checkable(label)) return context.checked ? asks(CHECKED) : { decision: 'check', reason: CHECK_IT };
  const line = lineOf(context, /** @type {boolean} */ (hardToUndo(label)));
  return sort === 'one' ? oneAnswer(context, line) : byKind(context, kind, line);
}

module.exports = { rule };
