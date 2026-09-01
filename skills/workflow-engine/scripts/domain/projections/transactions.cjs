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
 * workunit absorb — the pre-confirm summary: what the absorb will move and
 * do, derived from the feature's manifest before anything runs.
 * `experiments` counts top-level records only — a split is worked inside its
 * parent, so a series E1, E1.1, E2 is two experiments.
 * @param {string} feature @param {string} epic @param {string} topic
 * @param {{discussion: string, research?: string, experiments?: number, seeds?: number, imports?: number}} facts
 * @returns {string}
 */
function absorbSummary(feature, epic, topic, facts) {
  const rows = [
    ['Feature:', titlecase(feature)],
    ['Target:', titlecase(epic)],
    ['Topic:', topic],
    ['Discussion:', `[${facts.discussion}]`],
  ];
  if (facts.research !== undefined) rows.push(['Research:', `[${facts.research}]`]);
  if (facts.experiments) rows.push(['Experiments:', `${facts.experiments} experiment(s)`]);
  if (facts.seeds) rows.push(['Seed:', `${facts.seeds} file(s) (origin)`]);
  if (facts.imports) rows.push(['Imports:', `${facts.imports} file(s)`]);
  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = ['Absorb Summary', ''];
  for (const [label, value] of rows) lines.push(`  ${label.padEnd(width)}  ${value}`);
  lines.push('', '  Actions:', '  • Move discussion file to epic');
  if (facts.research !== undefined) lines.push('  • Move research file to epic');
  if (facts.experiments) lines.push('  • Move experiment series to epic');
  if (facts.seeds) lines.push('  • Move seed file(s) to epic');
  if (facts.imports) lines.push('  • Move import file(s) to epic');
  lines.push('  • Register topic in epic manifest', '  • Remove feature work unit and directory');
  return section('DISPLAY: absorb summary', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/**
 * workunit absorb — the post-absorption summary. `experiments` is the moved
 * series' top-level record count — 0 when the feature had no series.
 * @param {string} epic @param {string} topic @param {string[]} moved
 * @param {{warn?: boolean, experiments?: number}} [opts]
 * @returns {string}
 */
function absorbReceipt(epic, topic, moved, { warn = false, experiments = 0 } = {}) {
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
  if (experiments > 0) lines.push(`  • Experiments: ${experiments} moved`);
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
 * The absorb continuation menu — the manage flow's post-absorption decision.
 * @param {string} feature @param {string} epic
 * @returns {string}
 */
function absorbContinuationMenu(feature, epic) {
  const name = titlecase(epic);
  return section(
    'MENU: absorb continuation',
    "emit verbatim as markdown, then STOP for the user's response",
    menu(`**${titlecase(feature)}** absorbed into **${name}**.`, [
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

module.exports = { workunitReceipt, topicReceipt, absorbSummary, absorbReceipt, promoteReceipt, pivotContinuationMenu, absorbContinuationMenu, sessionReceipt };
