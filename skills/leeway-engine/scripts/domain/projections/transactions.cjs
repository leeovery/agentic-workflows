'use strict';

// ---------------------------------------------------------------------------
// Domain ring: transaction receipts — the DISPLAY/MENU blocks the `render`
// receipt surfaces serve after a lifecycle verb runs. The verb's one-line
// JSON is the machine contract; the receipt is fetched by the calling flow
// at the call site and emitted verbatim. Warnings render as a state-class
// advisory above the confirmation (the `--warn` flag, set by the caller when
// the transaction's JSON carried `warnings`) — the failure detail itself
// stays in the JSON line, already on screen one tool result up. The map's
// `topic` verbs print their one line themselves, after their JSON.
// ---------------------------------------------------------------------------

const { titlecase, TREE_WIDTH } = require('../conventions.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { section, CONTINUE_INSTRUCTION, callout, menu, cmdOption, promptOption, bulletRow, indentedBody, emitAs, timedInstruction, MENU_INSTRUCTION } = require('./surfaces.cjs');

/**
 * The ⚑ advisory block: label line and reassurance tail. The instruction
 * names the confirmation only when the receipt renders one beneath it.
 * @param {string} label @param {string} tail @param {string} [instruction]
 * @returns {string}
 */
function warningBlock(label, tail, instruction = emitAs('text', ', above the confirmation')) {
  return section('DISPLAY: kb warning', instruction, callout([label, tail]));
}

/** @param {string} body */
function confirmation(body) {
  return section('DISPLAY: confirmation', timedInstruction('text', 'after the response'), body);
}

/** @param {(string | null)[]} parts */
function joined(parts) {
  return parts.filter(Boolean).join('\n');
}

/** @param {number} n @param {string} noun */
const counted = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * What a removal or a cancel says of the waiting mail it moved to the inbox
 * (8.8.16, 10.1.6): nothing where none waited.
 * @param {number} n
 * @returns {string[]}
 */
function inboxLine(n) {
  return n > 0 ? [`Its ${counted(n, 'waiting message')} went to the inbox as ${n === 1 ? 'an idea' : 'ideas'}.`] : [];
}

/**
 * Where a roadmap item a cancel put back now stands, other than back with
 * the work: another piece of work took it meanwhile, it was archived, or
 * the roadmap holds it under that name no more.
 * @typedef {{name: string, work_unit?: string, archived?: boolean}} Stayed
 */

/**
 * What a reactivate says of each roadmap item its cancel put back that it
 * left where it is (18.8.20).
 * @param {Stayed[]} stayed
 * @returns {string[]}
 */
function stayedLines(stayed) {
  return stayed.map(({ name, work_unit: unit, archived }) => {
    const item = `"${titlecase(name)}"`;
    if (unit !== undefined) return `${item} stays with "${titlecase(unit)}", which took it meanwhile.`;
    return archived ? `${item} stays archived.` : `${item} is no longer on the roadmap under that name.`;
  });
}

/**
 * workunit cancel / reactivate / pivot receipts, each confirming the unit
 * by name: the pivot saying it is an epic now, its discussion the first
 * topic on its map, and the reactivate each roadmap item its cancel put
 * back that it left where it is.
 * @param {'cancel'|'reactivate'|'pivot'} verb
 * @param {string} workUnit
 * @param {{warn?: boolean, inbox?: number, kept?: string[], stayed?: Stayed[]}} [opts]  `inbox`: cancel — how many waiting messages it moved to the inbox; `kept`: cancel — the words for each fix's work it kept set aside; `stayed`: reactivate — the items it left
 * @returns {string}
 */
function workunitReceipt(verb, workUnit, { warn = false, inbox = 0, kept = [], stayed = [] } = {}) {
  const name = titlecase(workUnit);
  if (verb === 'cancel') {
    return joined([
      warn ? warningBlock('Knowledge removal warning', 'The work unit is cancelled. The next start removes its chunks from the knowledge base.') : null,
      confirmation([[`"${name}" marked as cancelled.`, ...inboxLine(inbox)].join(' '), ...kept.flatMap((words) => wrapWithPrefix(`⚑ ${words}`, { width: TREE_WIDTH, hang: 2 }))].join('\n')),
    ]);
  }
  if (verb === 'reactivate') {
    return joined([
      warn ? warningBlock('Knowledge indexing warning', 'The work unit is reactivated. The next start retries the indexing.') : null,
      confirmation([`"${name}" reactivated.`, ...stayedLines(stayed)].join(' ')),
    ]);
  }
  return joined([
    warn ? warningBlock('Knowledge indexing warning', 'The pivot is complete. The next start retries the indexing.') : null,
    confirmation(`"${name}" is an epic now, its discussion the first topic on its map.`),
  ]);
}

/**
 * topic cancel / reactivate / postpone / restore receipts, each confirming
 * the unit by name: the postpone names the horizon it waits under, and the reactivate and the
 * pull forward's restore the statuses their items returned to (none for a
 * never-started topic), the reactivate each roadmap item its cancel put back
 * that it left where it is, and the cancel how many waiting messages it
 * moved to the inbox (10.1.6).
 * @param {'cancel'|'reactivate'|'postpone'|'restore'} verb
 * @param {string} name  the topic as screens title it
 * @param {{warn?: boolean, restored?: {phase: string, status: string}[], horizon?: string|null, inbox?: number, stayed?: Stayed[]}} [opts]
 * @returns {string}
 */
function topicReceipt(verb, name, { warn = false, restored = [], horizon = null, inbox = 0, stayed = [] } = {}) {
  if (verb === 'cancel') {
    return joined([
      warn ? warningBlock('Knowledge removal warning', 'The topic is cancelled. The next start removes its chunks from the knowledge base.') : null,
      confirmation([`Cancelled "${name}".`, ...inboxLine(inbox)].join(' ')),
    ]);
  }
  if (verb === 'postpone') {
    return joined([
      warn ? warningBlock('Knowledge removal warning', 'The topic is postponed. The next start removes its chunks from the knowledge base.') : null,
      confirmation(`Postponed "${name}"${horizon ? ` → ${horizon}` : ''}.`),
    ]);
  }
  const returned = restored.length > 0
    ? ` Restored ${restored.map((r) => `${r.phase} [${r.status}]`).join(' · ')}.`
    : '';
  return joined([
    warn ? warningBlock('Knowledge indexing warning', `The topic is ${verb === 'restore' ? 'pulled forward' : 'reactivated'}. The next start retries the indexing.`) : null,
    confirmation(verb === 'restore' ? `Pulled "${name}" forward.${returned}` : [`Reactivated "${name}".${returned}`, ...stayedLines(stayed)].join(' ')),
  ]);
}

/**
 * workunit absorb — the pre-confirm summary: what the absorb will move and
 * do, derived from the feature's manifest before anything runs.
 * `experiments` counts top-level records only — a split is worked inside its
 * parent, so a series E1, E1.1, E2 is two experiments.
 * @param {string} feature @param {string} epic @param {string} topic
 * @param {{discussion: string, brief?: boolean, mail?: number, experiments?: number, seeds?: number, assets?: number, spikes?: number}} facts
 * @returns {string}
 */
function absorbSummary(feature, epic, topic, facts) {
  const rows = [
    ['Feature:', titlecase(feature)],
    ['Target:', titlecase(epic)],
    ['Topic:', topic],
    ['Discussion:', `[${facts.discussion}]`],
  ];
  if (facts.mail) rows.push(['Mail:', `${facts.mail} message(s) waiting`]);
  if (facts.experiments) rows.push(['Experiments:', `${facts.experiments} experiment(s)`]);
  if (facts.seeds) rows.push(['Seed:', `${facts.seeds} file(s) (origin)`]);
  if (facts.assets) rows.push(['Assets:', `${facts.assets} file(s)`]);
  if (facts.spikes) rows.push(['Spikes:', `${facts.spikes} spike(s)`]);
  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = ['Absorb Summary', ''];
  for (const [label, value] of rows) lines.push(`  ${label.padEnd(width)}  ${value}`);
  lines.push('', '  Actions:', '  • Move discussion log to epic');
  if (facts.brief) lines.push('  • Move brief to epic');
  if (facts.mail) lines.push('  • Move waiting message(s) to epic');
  if (facts.experiments) lines.push('  • Move experiment series to epic');
  if (facts.seeds) lines.push('  • Move seed file(s) to epic');
  if (facts.assets) lines.push('  • Move asset(s) to epic');
  if (facts.spikes) lines.push('  • Move spike(s) to epic');
  lines.push('  • Register topic in epic manifest', '  • Remove feature work unit and directory');
  return section('DISPLAY: absorb summary', CONTINUE_INSTRUCTION, lines.join('\n'));
}

/** What the receipt's `moved` may name, each with its line. */
const ABSORB_MOVED = Object.freeze({ seeds: 'Seed', assets: 'Assets', spikes: 'Spikes' });

/**
 * workunit absorb — the post-absorption summary. `moved` names which of
 * `ABSORB_MOVED` moved anything; `experiments` is the moved series'
 * top-level record count — 0 when the feature had no series; `renamed` names
 * the files and spikes a collision renamed, whose links the transaction
 * rewrote in the documents it moved.
 * @param {string} epic @param {string} topic @param {string[]} moved
 * @param {{warn?: boolean, experiments?: number, renamed?: {from: string, to: string}[]}} [opts]
 * @returns {string}
 */
function absorbReceipt(epic, topic, moved, { warn = false, experiments = 0, renamed = [] } = {}) {
  // Heading and sentence at column 0; only the fact list is indented, and it
  // earns that by hanging off the sentence above it.
  const lines = [
    'Absorbed into Epic',
    '',
    `Topic "${titlecase(topic)}" added to ${titlecase(epic)}.`,
    '',
    '  • Discussion: moved',
  ];
  if (experiments > 0) lines.push(`  • Experiments: ${experiments} moved`);
  for (const [home, label] of Object.entries(ABSORB_MOVED)) if (moved.includes(home)) lines.push(`  • ${label}: moved`);
  for (const rename of renamed) {
    lines.push(...bulletRow(`Renamed: ${rename.from} → ${rename.to} (links rewritten)`));
  }
  lines.push('  • Feature: removed');
  return joined([
    warn ? warningBlock('Knowledge warning', 'The feature is absorbed. The next start brings the knowledge base up to date.') : null,
    confirmation(lines.join('\n')),
  ]);
}

/**
 * The import re-prompt — what a landing's `missing_imports` refusal asks for.
 * Every lander validates its whole batch before copying anything, so the
 * paths named here are the only ones the caller has to replace.
 * @param {string[]} missing the refused source paths
 * @returns {string}
 */
function importReprompt(missing) {
  const body = [
    ...indentedBody(['One or more paths could not be landed — nothing at the path, a folder rather than a file, or unreadable:'], { indent: '' }),
    '',
    ...missing.flatMap((p) => bulletRow(p)),
  ];
  return [
    section('DISPLAY: missing imports', CONTINUE_INSTRUCTION, body.join('\n')),
    section('MENU: import reprompt', MENU_INSTRUCTION,
      menu('', [
        cmdOption('s', 'skip', 'Land nothing for these paths'),
        promptOption('Provide file paths', 'one or more, space or newline separated'),
      ], { question: 'How would you like to proceed?' })),
  ].join('\n');
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
    MENU_INSTRUCTION,
    menu(`**${name}** converted from feature to epic.`, [
      cmdOption('c', 'continue', `Continue ${name} as epic`),
      cmdOption('b', 'back', 'Return to previous view'),
    ], { question: 'What next?' }),
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
    MENU_INSTRUCTION,
    menu(`**${titlecase(feature)}** absorbed into **${name}**.`, [
      cmdOption('c', 'continue', `Continue ${name} as epic`),
      cmdOption('b', 'back', 'Return to previous view'),
    ], { question: 'What next?' }),
  );
}

/** @typedef {import('../discovery-map.cjs').MapChange} MapChange */
/** @typedef {import('../discovery-map.cjs').SequenceResult} SequenceResult */

/** @type {Record<string, (change: any) => string>} */
const MAP_LINES = {
  /** @param {MapChange} c */
  add: (c) => `Added "${c.title}" to the map${c.re_added ? ' again' : ''}${c.from_roadmap ? `, taking "${titlecase(c.from_roadmap)}" off the roadmap` : ''}.`,
  /** @param {MapChange} c */
  'add-batch': (c) => {
    const added = c.added ?? [];
    return `Added ${counted(added.length, 'topic')} to the map: ${added.map(({ title }) => `"${title}"`).join(', ')}.`;
  },
  /** @param {MapChange} c */
  edit: (c) => `Updated "${c.title}"'s ${[c.summary === undefined ? null : 'summary', c.description === undefined ? null : 'description'].filter(Boolean).join(' and ')}.`,
  /** @param {MapChange} c */
  rename: (c) => `Renamed "${c.was}" to "${c.title}".`,
  /** @param {MapChange} c */
  remove: (c) => [
    `Removed "${c.title}" from the map.`,
    ...inboxLine(c.inbox?.length ?? 0),
    ...(c.roadmap_returned ?? []).map(({ name, horizon }) => backOnTheRoadmap(name, horizon, c.roadmap_horizon_gone ?? [])),
  ].join(' '),
  /** @param {SequenceResult} c */
  order: (c) => `Ordered the map: ${Object.entries(c.ordered).sort(([, a], [, b]) => a - b).map(([topic, n]) => `${n} "${c.titles[topic]}"`).join(', ')}.`,
  /** @param {MapChange} c */
  brief: (c) => `Rewrote "${c.title}"'s brief.`,
};

/**
 * Where a roadmap item a removal put back now waits: under its horizon, or —
 * that horizon removed meanwhile — on none, for the person to name one
 * (18.8.20).
 * @param {string} name @param {string|null} horizon @param {import('../roadmap.cjs').HorizonGone[]} gone
 * @returns {string}
 */
function backOnTheRoadmap(name, horizon, gone) {
  if (horizon !== null) return `"${titlecase(name)}" is back on the roadmap under ${horizon}.`;
  const left = gone.find((item) => item.name === name)?.horizon;
  return `"${titlecase(name)}" is back on the roadmap with no horizon${left ? ` — ${left} was removed` : ''}.`;
}

/**
 * A map verb's one-line report (8.8.7): what changed, by the titles screens
 * show — and for a removal, the waiting messages it sent to the inbox and
 * the roadmap items it put back (8.8.16, 18.8.20).
 * @param {MapChange|SequenceResult} change
 * @returns {string}
 */
function mapReceipt(change) {
  return confirmation(MAP_LINES[change.op](change));
}

/** The archived item's restore receipt. @param {string} title @returns {string} */
function inboxRestoreReceipt(title) {
  return confirmation(`Restored "${title}" to the inbox.`);
}

/** The archived item's delete receipt. @param {string} title @returns {string} */
function inboxDeleteReceipt(title) {
  return confirmation(`Deleted "${title}".`);
}

/** A capture's one line, naming the project where it is another's (18.6.1, 18.6.8). @param {string} kind @param {string} title @param {string|null} project */
function captureReceipt(kind, title, project) {
  return confirmation(`Logged ${kind}${project === null ? '' : ` in ${project}`}: "${title}"`);
}

module.exports = { workunitReceipt, topicReceipt, mapReceipt, absorbSummary, ABSORB_MOVED, absorbReceipt, importReprompt, pivotContinuationMenu, absorbContinuationMenu, inboxRestoreReceipt, inboxDeleteReceipt, captureReceipt };
