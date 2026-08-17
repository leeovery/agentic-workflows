'use strict';

// ---------------------------------------------------------------------------
// Domain ring: task gate sections — the implementation loop's state-derived
// gates, served by the `engine render` surfaces (render.cjs) at the exact
// prose point that displays them. The `engine task` verbs answer with their
// one-line JSON only; a gate's section is fetched by its own render call, so
// the section always sits in the tool result directly above its emission.
// Deterministic: same state, same string. Conversational content (reviewer
// findings, executor summaries, the blocked-task list) never renders here —
// it stays with the session.
//
//   render blocked-tasks → MENU: blocked tasks   (static — the blocked-task
//                          list is plan-format state the engine never reads;
//                          the session renders the list, this menu carries
//                          the decision)
//   render task-gate     → MENU: task gate       (task_gate_mode gated)
//                          DISPLAY: task gate auto-approved (task_gate_mode auto)
//   render fix-gate      → MENU: fix gate        (gated or threshold reached;
//                          the auto option renders only while the gate is gated)
//                          DISPLAY: fix gate auto-accepted (auto, below threshold)
//   render cycle-limit   → DISPLAY: cycle limit   (the over-limit callout)
//   render cycle-gate    → MENU: cycle gate      (static)
//
// The task headers the gates follow — the brief (`render task-brief`) and
// the result header (`render task-result`) — live in render.cjs: they mix
// payload content with the state read here. The headers name the in-flight
// task, so the gates never repeat the id.
//
// Every gate branch renders an artifact — a MENU where the loop stops, a
// continuation DISPLAY where it must not. An auto branch that rendered
// nothing would let the loop end a turn by silence, indistinguishable from
// a stall; the continuation line is emitted last in the turn, pointing at
// the action that follows in the same turn.
// ---------------------------------------------------------------------------

const { section, CONTINUE_INSTRUCTION, AUTO_GATE_INSTRUCTION, menu, cmdOption, promptOption } = require('./surfaces.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/** The blocked-tasks stop menu. Static by design. @returns {string} */
function blockedTasksMenu() {
  return section(
    'MENU: blocked tasks',
    MENU_INSTRUCTION,
    menu('How would you like to proceed?', [
      cmdOption('p', 'proceed', 'Continue with the first blocked task anyway (its blocker will not be completed)'),
      cmdOption('s', 'skip', 'Skip the first blocked task (the loop re-checks the rest)'),
      cmdOption('t', 'stop', 'Stop implementation entirely'),
    ]),
  );
}

/**
 * The task gate: menu when gated, continuation line when auto. The result
 * header names the in-flight task — the gate never repeats the id.
 * @param {string} gateMode  `task_gate_mode`
 * @returns {string}
 */
function taskGateSection(gateMode) {
  if (gateMode !== 'gated') {
    return section(
      'DISPLAY: task gate auto-approved',
      `after the result summary: ${AUTO_GATE_INSTRUCTION}`,
      'Task approved [auto]. Committing and moving to the next task.',
    );
  }
  return section(
    'MENU: task gate',
    MENU_INSTRUCTION,
    menu('Approve this task?', [
      cmdOption('y', 'yes', 'Commit and continue to next task'),
      cmdOption('a', 'auto', 'Approve this and all future tasks automatically'),
      cmdOption('t', 'technical', "Retell the result from the code's perspective"),
      cmdOption('s', 'show', 'Show the result as diagrams'),
      promptOption('Ask', "Ask questions about the implementation (doesn't approve or reject)"),
      promptOption('Comment', 'Request changes (triggers a fix round)'),
    ]),
  );
}

/**
 * The fix gate: menu when gated or threshold-forced, continuation line when
 * auto and below the threshold. The result header names the in-flight task
 * — the gate never repeats the id.
 * @param {string} gateMode  `fix_gate_mode`
 * @param {boolean} thresholdReached  `fix_attempts` at or past the threshold
 * @returns {string}
 */
function fixGateSection(gateMode, thresholdReached) {
  if (!thresholdReached && gateMode !== 'gated') {
    return section(
      'DISPLAY: fix gate auto-accepted',
      `after the findings summary: ${AUTO_GATE_INSTRUCTION}`,
      'Fix analysis accepted [auto]. Passing the findings to the executor.',
    );
  }
  const options = [
    cmdOption('y', 'yes', 'Pass to executor'),
    cmdOption('a', 'auto', 'Accept and auto-approve future fix analyses'),
    cmdOption('t', 'technical', "Retell the review from the code's perspective"),
    cmdOption('s', 'show', 'Show the findings as diagrams'),
    promptOption('Ask', "Ask questions about the review (doesn't accept or reject)"),
    promptOption('Comment', 'Give direction for the fix — or challenge a finding you think is wrong'),
  ];
  // An auto gate only reaches this menu via the threshold — offering auto
  // again would be a no-op option.
  if (gateMode !== 'gated') options.splice(1, 1);
  return section(
    'MENU: fix gate',
    MENU_INSTRUCTION,
    menu("Accept the reviewer's fix analysis?", options),
  );
}

/**
 * The cycle-limit callout emitted before the convergence diagnostic.
 * @param {number} session @param {number} limit
 * @returns {string}
 */
function cycleLimitDisplay(session, limit) {
  return section(
    'DISPLAY: cycle limit',
    CONTINUE_INSTRUCTION,
    `⚑ Analysis cycle ${session} this session — over the session limit of ${limit}.`,
  );
}

/** The analysis cycle-limit gate menu. Static by design. @returns {string} */
function cycleGateMenu() {
  return section(
    'MENU: cycle gate',
    MENU_INSTRUCTION,
    menu('Continue with analysis?', [
      cmdOption('p', 'proceed', 'Continue analysis'),
      cmdOption('s', 'skip', 'Skip analysis, proceed to completion'),
    ]),
  );
}

module.exports = { blockedTasksMenu, taskGateSection, fixGateSection, cycleLimitDisplay, cycleGateMenu };
