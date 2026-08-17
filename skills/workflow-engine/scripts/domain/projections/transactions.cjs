'use strict';

// ---------------------------------------------------------------------------
// Domain ring: transaction receipts — the DISPLAY/MENU blocks the `render`
// receipt surfaces serve after a lifecycle verb runs. The verb's one-line
// JSON is the machine contract; the receipt is fetched by the calling flow
// at the call site and emitted verbatim. Warnings render as a state-class
// advisory above the confirmation (the `--warn` flag, set by the caller when
// the transaction's JSON carried `warnings`) — the failure detail itself
// stays in the JSON line, already on screen one tool result up.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { section, CONTINUE_INSTRUCTION, callout, menu, cmdOption } = require('./surfaces.cjs');

/**
 * The ⚑ advisory block: label line and reassurance tail. The instruction
 * names the confirmation only when the receipt renders one beneath it.
 * @param {string} label @param {string} tail @param {string} [instruction]
 * @returns {string}
 */
function warningBlock(label, tail, instruction = 'emit verbatim as a code block, above the confirmation') {
  return section('DISPLAY: kb warning', instruction, callout([label, tail]));
}

/** @param {string} body */
function confirmation(body) {
  return section('DISPLAY: confirmation', 'emit verbatim as a code block after the response', body);
}

/** @param {(string | null)[]} parts */
function joined(parts) {
  return parts.filter(Boolean).join('\n');
}

/** @type {Record<string, string>} */
const TYPE_LABELS = {
  feature: 'Feature',
  bugfix: 'Bugfix',
  'quick-fix': 'Quick-Fix',
  'cross-cutting': 'Cross-Cutting',
  epic: 'Epic',
};

/**
 * workunit complete / cancel / reactivate / pivot receipts. `complete` in
 * pipeline context (the bridge) renders the full "{Type} Completed" banner
 * instead of the one-line confirmation. `pivot` is advisory-only — its
 * user-facing continuation is the pivot-continuation menu, owned by the
 * caller's menu step.
 * @param {'complete'|'cancel'|'reactivate'|'pivot'} verb
 * @param {string} workUnit @param {string|undefined} workType
 * @param {{pipeline?: boolean, skippedReview?: boolean, warn?: boolean}} [opts]
 * @returns {string}
 */
function workunitReceipt(verb, workUnit, workType, { pipeline = false, skippedReview = false, warn = false } = {}) {
  const name = titlecase(workUnit);
  if (verb === 'complete') {
    if (!pipeline) return confirmation(`"${name}" marked as completed.`);
    const typeLabel = TYPE_LABELS[workType || ''] || titlecase(String(workType || ''));
    const body = skippedReview
      ? `"${name}" completed — review skipped.`
      : workType === 'epic'
        ? `"${name}" has completed all topics through review.`
        : `"${name}" has completed all pipeline phases.`;
    return confirmation(`${typeLabel} Completed\n\n${body}`);
  }
  if (verb === 'cancel') {
    return joined([
      warn ? warningBlock('Knowledge removal warning',
        'The work unit is cancelled. The removal has been queued and will retry automatically on the next `knowledge remove` or `knowledge compact` call.') : null,
      confirmation(`"${name}" marked as cancelled.`),
    ]);
  }
  if (verb === 'reactivate') {
    return joined([
      warn ? warningBlock('Knowledge indexing warning', 'Indexing can be retried later.') : null,
      confirmation(`"${name}" reactivated.`),
    ]);
  }
  return warn
    ? warningBlock('Knowledge indexing warning', 'The pivot is complete. Indexing can be retried later.', CONTINUE_INSTRUCTION)
    : '';
}

/**
 * topic complete / cancel / reactivate receipts. `complete` carries no
 * confirmation line — the calling flow owns its own conclusion display; it
 * renders the indexing advisory alone, empty without `--warn`.
 * @param {'complete'|'cancel'|'reactivate'} verb
 * @param {string} topic @param {string} phase @param {string|undefined} status
 * @param {{warn?: boolean}} [opts]
 * @returns {string}
 */
function topicReceipt(verb, topic, phase, status, { warn = false } = {}) {
  const name = titlecase(topic);
  if (verb === 'complete') {
    return warn
      ? warningBlock('Knowledge indexing warning', 'The artifact is saved. Indexing can be retried later.', CONTINUE_INSTRUCTION)
      : '';
  }
  if (verb === 'cancel') {
    return joined([
      warn ? warningBlock('Knowledge removal warning', 'The topic is cancelled. You can run knowledge remove manually later.') : null,
      confirmation(`Cancelled "${name}" in ${phase}.`),
    ]);
  }
  return joined([
    warn ? warningBlock('Knowledge indexing warning', 'The artifact is saved. Indexing can be retried later.') : null,
    confirmation(`Reactivated "${name}" in ${phase}. Status restored to ${status}.`),
  ]);
}

/**
 * workunit absorb — the post-absorption summary.
 * @param {string} epic @param {string} topic @param {string[]} moved
 * @param {{warn?: boolean}} [opts]
 * @returns {string}
 */
function absorbReceipt(epic, topic, moved, { warn = false } = {}) {
  // Heading and sentence at column 0; only the fact list is indented, and it
  // earns that by hanging off the sentence above it.
  const lines = [
    'Absorbed into Epic',
    '',
    `Topic "${titlecase(topic)}" added to ${titlecase(epic)}.`,
    '',
    '  • Discussion: moved',
  ];
  if (moved.includes('research')) lines.push('  • Research: moved');
  if (moved.includes('seeds')) lines.push('  • Seed: moved');
  if (moved.includes('imports')) lines.push('  • Imports: moved');
  lines.push('  • Feature: removed');
  return joined([
    warn ? warningBlock('Knowledge sync warning', 'The feature is absorbed. Indexing can be retried later.') : null,
    confirmation(lines.join('\n')),
  ]);
}

/**
 * workunit promote — the promotion summary.
 * @param {string} workUnit @param {string} topic @param {string} ccWorkUnit
 * @param {{warn?: boolean}} [opts]
 * @returns {string}
 */
function promoteReceipt(workUnit, topic, ccWorkUnit, { warn = false } = {}) {
  // Same shape as its sibling above: column-0 sentence, bulleted facts.
  const lines = [
    'Promoted to Cross-Cutting',
    '',
    `"${titlecase(topic)}" has been promoted to its own cross-cutting work unit.`,
    '',
    `  • Work unit: ${ccWorkUnit}`,
    `  • Source: ${workUnit}`,
    '  • Discussion files: moved',
    '  • Specification: moved',
    '  • Epic status: promoted',
  ];
  return joined([
    warn ? warningBlock('Knowledge warning', 'The promotion is committed. The knowledge base will catch up on the next sync.') : null,
    confirmation(lines.join('\n')),
  ]);
}

/**
 * The pivot continuation menu — the manage flow's post-pivot decision.
 * @param {string} workUnit
 * @returns {string}
 */
function pivotContinuationMenu(workUnit) {
  const name = titlecase(workUnit);
  return section(
    'MENU: pivot continuation',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${name}** converted from feature to epic.`, [
      cmdOption('c', 'continue', `Continue ${name} as epic`),
      cmdOption('b', 'back', 'Return to previous view'),
    ]),
  );
}

/**
 * Session close (discovery and roadmap alike) — the indexing advisory; the
 * session is closed and committed either way. Empty without `--warn`.
 * @param {{warn?: boolean}} [opts]
 * @returns {string}
 */
function sessionReceipt({ warn = false } = {}) {
  return warn
    ? warningBlock('Knowledge indexing warning', 'The session is closed. Indexing can be retried later.', CONTINUE_INSTRUCTION)
    : '';
}

module.exports = { workunitReceipt, topicReceipt, absorbReceipt, promoteReceipt, pivotContinuationMenu, sessionReceipt };
