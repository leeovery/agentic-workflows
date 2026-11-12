'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the decision point (16.1, 16.2) — whether a call Claude has a
// lean on goes to the person. One function, reached by every raise
// (raise.cjs): Claude supplies the question and its lean, never the
// decision. It answers ask, proceed (the call lands as Claude's), check
// (Claude finds the answer out, nothing drawn) or ask blind (Claude's
// answer held back until the person has given theirs, 16.17), and the
// reason for it.
//
// What it decides from (E1), as the raise gives it: the call; its label;
// where it is made, and whether it blocks build work; whose the entry it
// would replace is; Claude's mark that it always asks; whether it was sent
// to check once already; the project; the model of the session making it;
// the time; and the question's id, the same on every raise of it (E3), none
// for a replacement.
//
// Until the ask rule is switched on (29.19.2), every call asks (29.5.2),
// with the rule's own reason. `ruled` is what it decides once switched: the
// ask rule (ask-rule.cjs) over the trust log's counts for the project and
// the model as of the time (trust-counts.cjs), the person's settings
// (trust-settings.cjs) and their care entries, from the record of the
// person (person.cjs); and where the rule lets the call proceed — a quiet
// kind's, or a one-answer call's (16.3.7) — on a question, never a
// replacement, which sets out Claude's proposals beside the decision as it
// stands, so its rows tell where Claude leans, a blind question drawn at
// the share (16.17.3, 16.17.9): the question's id turned into a number,
// the first 32 bits of its SHA-1 as a fraction, as the measured replay
// drew (trust/replay_rule.py), drawing blind under the share — the wider
// share while the call's count holds few answers of the project's own at
// the session's model (trust-settings.cjs) — so the same question draws
// the same way however often it is raised, and no tally is kept
// (16.17.4). Claude never chooses which calls are drawn.
//
// Beside it, whether Claude offers to settle the rest of a topic once the
// person has answered a raise there (16.8.1): until the ask rule is switched
// on, no offer comes. Once switched, it is convergence.cjs's `offerDue`: the
// topic's run of agreements, where it has come to the offer.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { rule } = require('./ask-rule.cjs');
const { kindOf } = require('./labeller.cjs');
const { countsOf } = require('./trust-counts.cjs');
const { projectId } = require('./trust-log.cjs');
const { trustSettings, BLIND_SHARE, WIDE_BLIND_SHARE, WIDE_UNTIL } = require('./trust-settings.cjs');
const { careEntries } = require('./person.cjs');

/** @typedef {import('./ask-rule.cjs').Ruling | 'blind'} Decision */
/** @typedef {import('./trust-counts.cjs').Counts} Counts */
/**
 * Where and when a call is decided, beside the call itself, and the id its
 * blind draw hashes: the question's, the same on every raise of it; none
 * for a replacement, which is never drawn blind.
 * @typedef {Omit<import('./ask-rule.cjs').Context, 'project'|'counts'|'settings'|'care'> & {project: {root: string, name: string}, model: string|null, now: number, question: string|null}} At
 */

const EVERY_CALL_ASKS = 'Every call comes to you for now: I don\'t decide on my own yet.';
const BLIND = 'I\'m asking you this one cold, keeping my answer back until you\'ve given yours, to check my calls against yours.';
// The draw reads the first 32 bits of the id's SHA-1: 8 hex digits.
const DRAW_DIGITS = 8;
const DRAW_RANGE = 2 ** 32;

/**
 * Whether the call goes to the person, and why.
 * @param {import('./raise.cjs').Call} _call @param {At} _at
 * @returns {{decision: Decision, reason: string}}
 */
function decide(_call, _at) {
  return { decision: 'ask', reason: EVERY_CALL_ASKS };
}

/** The question's id as a number from 0 up to 1 (16.17.4). @param {string} question */
function drawOf(question) {
  return parseInt(crypto.createHash('sha1').update(question).digest('hex').slice(0, DRAW_DIGITS), 16) / DRAW_RANGE;
}

/**
 * The share of the call's kind's calls — of the one-answer calls, for a
 * call sorted `one` — drawn blind: the wide share while its count holds
 * fewer than WIDE_UNTIL answers of the project's own at the session's
 * model.
 * @param {{sort: 'one'|'several'}} call @param {import('./labeller.cjs').Label} label @param {Counts} counts
 */
function blindShare({ sort }, label, counts) {
  const count = sort === 'one' ? counts.one : counts.kinds[/** @type {import('./event-fields.cjs').Kind} */ (kindOf(label))];
  return count.own < WIDE_UNTIL ? WIDE_BLIND_SHARE : BLIND_SHARE;
}

/**
 * The ask rule's decision on the call: over the counts the trust log holds
 * on the project, for the session's model as of the time, the person's
 * settings, and their care entries, which the record of the person holds,
 * each project's by its id (person.cjs); where it lets a question's call
 * proceed, asked blind where the question's id draws so.
 * @param {import('./raise.cjs').Call} call @param {At} at
 * @returns {{decision: Decision, reason: string}}
 */
function ruled(call, { project: { root, name }, model, now, question, ...at }) {
  const counts = countsOf(root, { model, now });
  const ruling = rule(call, { ...at, project: { id: projectId(root), name }, counts, settings: trustSettings(), care: careEntries() });
  if (ruling.decision !== 'proceed' || question === null) return ruling;
  return drawOf(question) < blindShare(call, /** @type {import('./labeller.cjs').Label} */ (at.label), counts) ? { decision: 'blind', reason: BLIND } : ruling;
}

/**
 * The agreements in a row in the topic `topic` of `unit` where Claude offers
 * to settle the rest of it (16.8.1), else null.
 * @param {string} _cwd @param {string} _unit @param {string} _topic
 * @returns {number|null}
 */
function convergenceDue(_cwd, _unit, _topic) {
  return null;
}

module.exports = { decide, ruled, convergenceDue };
