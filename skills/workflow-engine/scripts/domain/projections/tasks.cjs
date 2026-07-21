'use strict';

// ---------------------------------------------------------------------------
// Domain ring: task gate sections — the implementation loop's state-derived
// gates, rendered onto the `engine task` verb responses. Each verb's one-line
// JSON stays the machine-readable contract; these sections follow it on
// stdout, and the task loop emits them verbatim at the gate the marker names
// (the marker's own instruction says when — never before). Deterministic:
// same result, same string. Conversational content (reviewer findings,
// executor summaries, the blocked-task list) never renders here — it stays
// with the session.
//
//   init / complete   → MENU: blocked tasks   (always — either verb can be
//                       the session's latest when the loop stops on blocked
//                       tasks)
//   start             → MENU: task gate       (task_gate_mode gated)
//   fix-attempt       → DISPLAY: fix threshold (threshold reached)
//                       MENU: fix gate         (gated or threshold reached;
//                       the auto option renders only while the gate is gated)
//   analysis-cycle    → DISPLAY: cycle limit + MENU: cycle gate
//                       (over the session limit)
// ---------------------------------------------------------------------------

const { SESSION_CYCLE_LIMIT } = require('../tasks.cjs');

/** @typedef {import('../tasks.cjs').StartResult} StartResult */
/** @typedef {import('../tasks.cjs').FixAttemptResult} FixAttemptResult */
/** @typedef {import('../tasks.cjs').AnalysisCycleResult} AnalysisCycleResult */

const { section, menu } = require('./surfaces.cjs');

// The blocked-tasks stop menu. Static by design: the blocked-task list is
// plan-format state the engine never reads — the session renders the list,
// this menu carries the decision.
const BLOCKED_TASKS_MENU = section(
  'MENU: blocked tasks',
  "emit verbatim as markdown only at the task loop's blocked-tasks stop",
  menu('How would you like to proceed?', [
    '- **`p`/`proceed`** — Continue with the first blocked task anyway (its blocker will not be completed)',
    '- **`s`/`skip`** — Skip the blocked tasks and conclude the loop',
    '- **`t`/`stop`** — Stop implementation entirely',
  ]),
);

/** The render is result-independent — the trigger (blocked tasks) is plan-format state. @returns {string} */
function initSections() {
  return BLOCKED_TASKS_MENU;
}

/** The render is result-independent — the trigger (blocked tasks) is plan-format state. @returns {string} */
function completeSections() {
  return BLOCKED_TASKS_MENU;
}

/** @param {StartResult} result @returns {string} */
function startSections(result) {
  if (result.gates.task_gate_mode !== 'gated') return '';
  return section(
    'MENU: task gate',
    'emit verbatim as markdown at the task gate — never before',
    menu(`Approve task ${result.task}?`, [
      '- **`y`/`yes`** — Commit and continue to next task',
      '- **`a`/`auto`** — Approve this and all future tasks automatically',
      "- **Ask** — Ask questions about the implementation (doesn't approve or reject)",
      '- **Comment** — Request changes (triggers a fix round)',
    ]),
  );
}

/** @param {FixAttemptResult} result @param {string} internalId @returns {string} */
function fixAttemptSections(result, internalId) {
  const parts = [];
  if (result.threshold_reached) {
    parts.push(section(
      'DISPLAY: fix threshold',
      'emit verbatim as a code block',
      `⚑ Fix attempt ${result.attempts} for task ${internalId} — escalation threshold reached.`,
    ));
  }
  if (result.threshold_reached || result.fix_gate_mode === 'gated') {
    const options = [
      '- **`y`/`yes`** — Pass to executor',
      '- **`a`/`auto`** — Accept and auto-approve future fix analyses',
      '- **`s`/`skip`** — Override the reviewer and proceed as-is',
      "- **Ask** — Ask questions about the review (doesn't accept or reject)",
      '- **Comment** — Accept with adjustments — pass your own direction alongside the review',
    ];
    // An auto gate only reaches this menu via the threshold — offering auto
    // again would be a no-op option.
    if (result.fix_gate_mode !== 'gated') options.splice(1, 1);
    parts.push(section(
      'MENU: fix gate',
      'emit verbatim as markdown at the fix approval gate',
      menu(`Accept the reviewer's fix analysis for task ${internalId}?`, options),
    ));
  }
  return parts.join('\n');
}

/** @param {AnalysisCycleResult} result @returns {string} */
function analysisCycleSections(result) {
  if (!result.over_session_limit) return '';
  return [
    section(
      'DISPLAY: cycle limit',
      'emit verbatim as a code block',
      `⚑ Analysis cycle ${result.cycle_session} this session — over the session limit of ${SESSION_CYCLE_LIMIT}.`,
    ),
    section(
      'MENU: cycle gate',
      'emit verbatim as markdown at the cycle gate',
      menu('Continue with analysis?', [
        '- **`p`/`proceed`** — Continue analysis',
        '- **`s`/`skip`** — Skip analysis, proceed to completion',
      ]),
    ),
  ].join('\n');
}

module.exports = { initSections, startSections, fixAttemptSections, completeSections, analysisCycleSections };
