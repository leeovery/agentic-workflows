'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the care entries' screens (16.5.6) — the project's care
// entries, as the menus' frame draws them (menus.cjs), and the picks and
// lines around them, from what `render care`, `render care-kind` and
// `render care-drop` read (person-verbs.cjs).
//
// - The care entries: titled "Matrix · {Project} · Care entries"; what a
//   care entry does (16.5.2, 16.5.5); this project's entries, by its name
//   now; `n/new` to the kind pick while a kind is left, and `d/drop` — the
//   one entry dropped at once, or, with several, the pick of which — and
//   `b/back` to the matrix. The frame adds `h/help`. Above it, where one was
//   just added or dropped, the line that reports it.
// - The kind pick: which kind should always ask, each with what it covers,
//   the kinds with no entry here in the order 16.5.6 lists them, each
//   leading to `person keep --care`; the drop pick: which entry to drop, each
//   leading to `person drop --care`; each with `b/back` to the care entries.
// - The lines: a care entry added; one dropped, with where its kind's count
//   stands now at the person's threshold — still asking for now, or gone
//   quiet — as the ask rule says a bound (ask-rule.cjs).
// ---------------------------------------------------------------------------

const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { section, menu, cmdOption, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { CARE_KINDS } = require('../person.cjs');
const { percent, against } = require('../ask-rule.cjs');
const { ASK_AGAIN } = require('../trust-settings.cjs');

/** @typedef {import('../event-fields.cjs').Kind} Kind */
/** @typedef {import('../trust-counts.cjs').State} State */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** What each kind a care entry names covers, as the kind pick says it (16.5.6). @type {Readonly<Partial<Record<Kind, string>>>} */
const COVERS = Object.freeze({
  contract: 'what other code or saved data relies on',
  scope: 'whether something is in the work at all',
  behaviour: 'what a user sees it do',
  look: 'how it looks to a user',
  words: 'what a user reads or types',
  process: 'how the session runs, not the product',
  internals: 'what no user sees',
});

/** An engine command a row leads to. @param {...string} argv @returns {Next} */
const engine = (...argv) => ({ kind: 'engine', argv });

const CARE_ENTRIES = engine('render', 'care');
const BACK_TO_CARE = 'Back to the care entries';

/** A care entry as the screens name it. @param {string} project @param {string} kind */
const named = (project, kind) => `${project}: ${kind}`;

/**
 * The row that drops a care entry: the one there is, at once, or the pick
 * of which; none where none stands.
 * @param {string} project @param {Kind[]} kinds
 */
function dropRow(project, kinds) {
  if (kinds.length === 0) return [];
  if (kinds.length > 1) return [{ key: 'd', word: 'drop', label: 'Drop a care entry — you pick which', next: engine('render', 'care-drop') }];
  const [kind] = kinds;
  return [{ key: 'd', word: 'drop', label: `Drop "${named(project, kind)}" — ${kind} goes back to the counts`, next: engine('person', 'drop', '--care', kind) }];
}

/**
 * The care entries' screen (the header's): the project's name, the kinds
 * under its care entries in the order kept, and the line reporting one just
 * added or dropped, null for none.
 * @param {{project: string, kinds: Kind[], line: string|null}} view
 * @returns {MenuScreen}
 */
function careScreen({ project, kinds, line }) {
  const width = displayWidth();
  const left = CARE_KINDS.filter((kind) => !kinds.includes(kind));
  return {
    title: `Matrix · ${project} · Care entries`,
    shows: [
      ...(line === null ? [] : [...wrap(line, width), '']),
      ...wrap(`A kind under a care entry always asks you in ${project}, however well my calls have matched. Its answers still count while it stands.`, width),
      '',
      `YOURS IN ${project.toUpperCase()} (${kinds.length})`,
      ...(kinds.length === 0 ? ['  None yet: every kind follows the counts.'] : kinds.map((kind, i) => `  ${i === kinds.length - 1 ? '└─' : '├─'} ${named(project, kind)}`)),
    ],
    rows: [
      ...(left.length === 0 ? [] : [{ key: 'n', word: 'new', label: 'Add a care entry — you pick the kind', next: engine('render', 'care-kind') }]),
      ...dropRow(project, kinds),
    ],
    back: { label: 'Back to the matrix', next: engine('render', 'matrix') },
  };
}

/** The kind pick's question, the project named where it fits a question. @param {string} project */
function whichKind(project) {
  const asked = `Which kind should always ask you in ${project}?`;
  return asked.length <= 60 ? asked : 'Which kind should always ask you here?';
}

/**
 * The kind pick (the header's): `kinds`, those with no care entry here.
 * @param {string} project @param {Kind[]} kinds
 * @returns {string}
 */
function kindPick(project, kinds) {
  return section('MENU: care kind', MENU_INSTRUCTION, menu('', [
    ...kinds.map((kind, i) => cmdOption(String(i + 1), null, `${kind} — ${COVERS[kind]}`, { next: engine('person', 'keep', '--care', kind) })),
    cmdOption('b', 'back', BACK_TO_CARE, { next: CARE_ENTRIES }),
  ], { question: whichKind(project) }));
}

/**
 * The drop pick (the header's): `kinds`, those under a care entry here.
 * @param {string} project @param {Kind[]} kinds
 * @returns {string}
 */
function dropPick(project, kinds) {
  return section('MENU: care drop', MENU_INSTRUCTION, menu('', [
    ...kinds.map((kind, i) => cmdOption(String(i + 1), null, `${named(project, kind)} — ${kind} goes back to the counts`, { next: engine('person', 'drop', '--care', kind) })),
    cmdOption('b', 'back', BACK_TO_CARE, { next: CARE_ENTRIES }),
  ], { question: 'Which care entry should I drop?' }));
}

/** The line reporting a care entry added. @param {string} project @param {Kind} kind */
function addedLine(project, kind) {
  return `Care entry added: ${named(project, kind)} — ${kind} always asks you in ${project}.`;
}

/**
 * The line reporting a care entry dropped: its kind's count as it stands at
 * the person's `threshold` — asking, or quiet under it, or quiet and not yet
 * risen a quarter over it (16.6.1).
 * @param {string} project @param {Kind} kind @param {State} state @param {number} threshold
 */
function droppedLine(project, kind, { asks, bound }, threshold) {
  const again = threshold * ASK_AGAIN;
  const where = (() => {
    if (asks) return `${against(bound, threshold)}, over your ${percent(threshold)}, so it still asks for now`;
    if (bound < threshold) return `${against(bound, threshold)}, under your ${percent(threshold)}, so it goes quiet`;
    return `${against(bound, again)}, under the ${percent(again)} it asks again over, so it goes quiet`;
  })();
  return `Care entry dropped: ${named(project, kind)} — ${kind} follows the counts again: ${where}.`;
}

module.exports = { careScreen, kindPick, dropPick, addedLine, droppedLine };
