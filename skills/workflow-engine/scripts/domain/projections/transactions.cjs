'use strict';

// ---------------------------------------------------------------------------
// Domain ring: transaction confirmation sections — the DISPLAY/MENU blocks that follow a
// lifecycle verb's JSON response (the labelled-section pattern the task verbs
// established). The response line stays the machine contract; these sections
// are the user-facing confirmation the calling flow emits verbatim at its
// prescribed moment. Warnings render above confirmations, exactly as the
// prose templates they replace.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { section, callout, menu, cmdOption } = require('./surfaces.cjs');

/**
 * The ⚑ warning block: label line, one indented line per warning, and the
 * reassurance tail. Null when there are no warnings.
 * @param {string} label @param {string[] | undefined} warnings @param {string} tail
 * @returns {string | null}
 */
function warningBlock(label, warnings, tail) {
  if (!Array.isArray(warnings) || warnings.length === 0) return null;
  const lines = [label, ...warnings.flatMap((w) => String(w).split('\n')), tail];
  return section('DISPLAY: kb warning', 'emit verbatim as a code block, above the confirmation', callout(lines));
}

/** @param {string} body @param {string} [instruction] */
function confirmation(body, instruction = 'emit verbatim as a code block after the response') {
  return section('DISPLAY: confirmation', instruction, body);
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
 * workunit complete / cancel / reactivate. `complete` in pipeline context
 * (the bridge) renders the full "{Type} Completed" banner instead of the
 * one-line confirmation — one transaction, its own chrome.
 * @param {'complete'|'cancel'|'reactivate'} verb
 * @param {{work_unit: string, work_type?: string, warnings?: string[]}} result
 * @param {{pipeline?: boolean, skippedReview?: boolean}} [opts]
 * @returns {string}
 */
function workunitLifecycleSections(verb, result, { pipeline = false, skippedReview = false } = {}) {
  const name = titlecase(result.work_unit);
  if (verb === 'complete') {
    if (!pipeline) return confirmation(`"${name}" marked as completed.`);
    const typeLabel = TYPE_LABELS[result.work_type || ''] || titlecase(String(result.work_type || ''));
    const body = skippedReview
      ? `"${name}" completed — review skipped.`
      : result.work_type === 'epic'
        ? `"${name}" has completed all topics through review.`
        : `"${name}" has completed all pipeline phases.`;
    return confirmation(`${typeLabel} Completed\n\n${body}`);
  }
  if (verb === 'cancel') {
    return joined([
      warningBlock('Knowledge removal warning', result.warnings,
        'The work unit is cancelled. The removal has been queued and will retry automatically on the next `knowledge remove` or `knowledge compact` call.'),
      confirmation(`"${name}" marked as cancelled.`),
    ]);
  }
  return joined([
    warningBlock('Knowledge indexing warning', result.warnings, 'Indexing can be retried later.'),
    confirmation(`"${name}" reactivated.`),
  ]);
}

/**
 * topic cancel / reactivate.
 * @param {'cancel'|'reactivate'} verb
 * @param {{topic: string, phase: string, status?: string, warnings?: string[]}} result
 * @returns {string}
 */
function topicLifecycleSections(verb, result) {
  const name = titlecase(result.topic);
  if (verb === 'cancel') {
    return joined([
      warningBlock('Knowledge removal warning', result.warnings,
        'The topic is cancelled. You can run knowledge remove manually later.'),
      confirmation(`Cancelled "${name}" in ${result.phase}.`),
    ]);
  }
  return joined([
    warningBlock('Knowledge indexing warning', result.warnings, 'The artifact is saved. Indexing can be retried later.'),
    confirmation(`Reactivated "${name}" in ${result.phase}. Status restored to ${result.status}.`),
  ]);
}

/**
 * workunit absorb — the post-absorption summary.
 * @param {{feature: string, epic: string, topic: string, research?: unknown[], seeds?: unknown[], imports?: unknown[], warnings?: string[]}} result
 * @returns {string}
 */
function absorbSections(result) {
  const lines = [
    'Absorbed into Epic',
    '',
    `  Topic "${titlecase(result.topic)}" added to ${titlecase(result.epic)}.`,
    '',
    '  • Discussion: moved',
  ];
  if (Array.isArray(result.research) && result.research.length > 0) lines.push('  • Research: moved');
  if (Array.isArray(result.seeds) && result.seeds.length > 0) lines.push('  • Seed: moved');
  if (Array.isArray(result.imports) && result.imports.length > 0) lines.push('  • Imports: moved');
  lines.push('  • Feature: removed');
  return joined([
    warningBlock('Knowledge sync warning', result.warnings, 'The feature is absorbed. Indexing can be retried later.'),
    confirmation(lines.join('\n')),
  ]);
}

/**
 * workunit promote — the promotion summary.
 * @param {{work_unit: string, topic: string, cc_work_unit: string, warnings?: string[]}} result
 * @returns {string}
 */
function promoteSections(result) {
  const lines = [
    'Promoted to Cross-Cutting',
    '',
    `"${titlecase(result.topic)}" has been promoted to its own cross-cutting work unit.`,
    '',
    `  Work unit: ${result.cc_work_unit}`,
    `  Source: ${result.work_unit}`,
    '  Discussion files: moved',
    '  Specification: moved',
    '  Epic status: promoted',
  ];
  return joined([
    warningBlock('Knowledge warning', result.warnings,
      'The promotion is committed. The knowledge base will catch up on the next sync.'),
    confirmation(lines.join('\n')),
  ]);
}

/**
 * workunit pivot — the kb warning, plus the continuation menu only when the
 * caller asked for it (`--continuation-menu`, the manage flow's menu step).
 * The off-topic reroute paths pivot mid-session with no menu step — an
 * unconditional menu would derail them.
 * @param {{work_unit: string, warnings?: string[]}} result
 * @param {{continuationMenu?: boolean}} [opts]
 * @returns {string}
 */
function pivotSections(result, { continuationMenu = false } = {}) {
  const name = titlecase(result.work_unit);
  return joined([
    warningBlock('Knowledge indexing warning', result.warnings, 'The pivot is complete. Indexing can be retried later.'),
    continuationMenu
      ? section(
          'MENU: pivot continuation',
          "emit verbatim as markdown, then STOP for the user's response",
          menu(`**${name}** converted from feature to epic.`, [
            cmdOption('c', 'continue', `Continue ${name} as epic`),
            cmdOption('b', 'back', 'Return to previous view'),
          ]),
        )
      : null,
  ]);
}

module.exports = { workunitLifecycleSections, topicLifecycleSections, absorbSections, promoteSections, pivotSections };
