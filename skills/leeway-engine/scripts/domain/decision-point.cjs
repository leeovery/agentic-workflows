'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the decision point (16.1, 16.2) — whether a call Claude has a
// lean on goes to the person. One function, reached by every raise
// (raise.cjs): Claude supplies the question and its lean, never the
// decision. It answers ask, proceed (the call lands as Claude's), check
// (Claude finds the answer out, nothing drawn) or ask blind, and the reason
// for it.
//
// What it decides from (E1), as the raise gives it: the call; its label;
// where it is made, and whether it blocks build work; who decided the entry
// it would replace; Claude's mark that it always asks; whether it was sent
// to check once already; the project; the model of the session making it;
// and the time.
//
// Until the ask rule is switched on (29.19.2), every call asks (29.5.2),
// with the rule's own reason. `ruled` is what it decides once switched: the
// ask rule (ask-rule.cjs) over the trust log's counts for the project and
// the model as of the time (trust-counts.cjs), the person's settings
// (trust-settings.cjs) and their care entries.
// ---------------------------------------------------------------------------

const { rule } = require('./ask-rule.cjs');
const { countsOf } = require('./trust-counts.cjs');
const { projectId } = require('./trust-log.cjs');
const { trustSettings } = require('./trust-settings.cjs');

/** @typedef {import('./ask-rule.cjs').Ruling | 'blind'} Decision */
/**
 * Where and when a call is decided, beside the call itself.
 * @typedef {Omit<import('./ask-rule.cjs').Context, 'project'|'counts'|'settings'|'care'> & {project: {root: string, name: string}, model: string|null, now: number}} At
 */

const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';

/**
 * Whether the call goes to the person, and why.
 * @param {import('./raise.cjs').Call} _call @param {At} _at
 * @returns {{decision: Decision, reason: string}}
 */
function decide(_call, _at) {
  return { decision: 'ask', reason: EVERY_CALL_ASKS };
}

/**
 * The ask rule's decision on the call: over the counts the trust log holds
 * on the project, for the session's model as of the time, the person's
 * settings, and their care entries, which the record of the person holds
 * (none yet).
 * @param {import('./raise.cjs').Call} call @param {At} at
 * @returns {{decision: Decision, reason: string}}
 */
function ruled(call, { project: { root, name }, model, now, ...at }) {
  return rule(call, { ...at, project: { id: projectId(root), name }, counts: countsOf(root, { model, now }), settings: trustSettings(), care: [] });
}

module.exports = { decide, ruled };
