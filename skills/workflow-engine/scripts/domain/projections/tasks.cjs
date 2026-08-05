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
//                       DISPLAY: task gate auto-approved (task_gate_mode auto)
//   fix-attempt       → DISPLAY: fix threshold (threshold reached)
//                       MENU: fix gate         (gated or threshold reached;
//                       the auto option renders only while the gate is gated)
//                       DISPLAY: fix gate auto-accepted (auto, below threshold)
//   analysis-cycle    → DISPLAY: cycle limit + MENU: cycle gate
//                       (over the session limit)
//
// Every gate branch renders an artifact — a MENU where the loop stops, a
// continuation DISPLAY where it must not. An auto branch that rendered
// nothing would let the loop end a turn by silence, indistinguishable from
// a stall; the continuation line is emitted last in the turn, pointing at
// the action that follows in the same turn.
// ---------------------------------------------------------------------------

const { SESSION_CYCLE_LIMIT } = require('../tasks.cjs');

/** @typedef {import('../tasks.cjs').StartResult} StartResult */
/** @typedef {import('../tasks.cjs').FixAttemptResult} FixAttemptResult */
/** @typedef {import('../tasks.cjs').AnalysisCycleResult} AnalysisCycleResult */

const { section, menu, cmdOption, promptOption } = require('./surfaces.cjs');

// The blocked-tasks stop menu. Static by design: the blocked-task list is
// plan-format state the engine never reads — the session renders the list,
// this menu carries the decision.
const BLOCKED_TASKS_MENU = section(
  'MENU: blocked tasks',
  "emit verbatim as markdown only at the task loop's blocked-tasks stop",
  menu('How would you like to proceed?', [
    cmdOption('p', 'proceed', 'Continue with the first blocked task anyway (its blocker will not be completed)'),
    cmdOption('s', 'skip', 'Skip the blocked tasks and conclude the loop'),
    cmdOption('t', 'stop', 'Stop implementation entirely'),
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
  if (result.gates.task_gate_mode !== 'gated') {
    return section(
      'DISPLAY: task gate auto-approved',
      'emit verbatim as a code block at the task gate, after the result summary — never before',
      `Task ${result.task} — approved [auto]. Committing and moving to the next task.`,
    );
  }
  return section(
    'MENU: task gate',
    'emit verbatim as markdown at the task gate — never before',
    menu(`Approve task ${result.task}?`, [
      cmdOption('y', 'yes', 'Commit and continue to next task'),
      cmdOption('a', 'auto', 'Approve this and all future tasks automatically'),
      cmdOption('t', 'technical', "Retell the result from the code's perspective"),
      promptOption('Ask', "Ask questions about the implementation (doesn't approve or reject)"),
      promptOption('Comment', 'Request changes (triggers a fix round)'),
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
      cmdOption('y', 'yes', 'Pass to executor'),
      cmdOption('a', 'auto', 'Accept and auto-approve future fix analyses'),
      cmdOption('s', 'skip', 'Override the reviewer and proceed as-is'),
      cmdOption('t', 'technical', "Retell the review from the code's perspective"),
      promptOption('Ask', "Ask questions about the review (doesn't accept or reject)"),
      promptOption('Comment', 'Accept with adjustments — pass your own direction alongside the review'),
    ];
    // An auto gate only reaches this menu via the threshold — offering auto
    // again would be a no-op option.
    if (result.fix_gate_mode !== 'gated') options.splice(1, 1);
    parts.push(section(
      'MENU: fix gate',
      'emit verbatim as markdown at the fix approval gate',
      menu(`Accept the reviewer's fix analysis for task ${internalId}?`, options),
    ));
  } else {
    parts.push(section(
      'DISPLAY: fix gate auto-accepted',
      'emit verbatim as a code block at the fix evaluation, after the findings summary — never before',
      `Fix analysis for task ${internalId} — accepted [auto]. Passing the findings to the executor.`,
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
        cmdOption('p', 'proceed', 'Continue analysis'),
        cmdOption('s', 'skip', 'Skip analysis, proceed to completion'),
      ]),
    ),
  ].join('\n');
}

module.exports = { initSections, startSections, fixAttemptSections, completeSections, analysisCycleSections };
