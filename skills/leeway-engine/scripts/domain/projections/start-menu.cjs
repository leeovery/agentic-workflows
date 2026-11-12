'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the start menu (18.2.12) — `render start-menu`, drawn in the
// menus' frame (menus.cjs), which drops the conversation's position so the
// board shows All work (20.3.3); every other menu's back draws it again.
//
// - What it shows above its question: the inbox as one line, its count by
//   kind (18.2.8), "Inbox: empty" while nothing is in it (18.2.18).
// - A row per unit in progress, type first ("Continue epic: …"), its phase
//   and progress, and where something waits on the person in it, the count
//   (18.2.2, 18.2.3, 18.2.6), mail waiting for its topic beside it (10.4.3):
//   no topic on any row, the units with something waiting first, else by
//   type — features, bugfixes, quick-fixes, epics — a migrated unit of a
//   type the reshape retires with the features. Its next is Continue,
//   `handoff unit` (19.1.3).
// - Then p/product, always, with its sessions' count and last date once it
//   has sessions, and the brownfield research while it is owed (18.2.13,
//   8.12.13); s/start, into discovery, which finds the type (18.2.7);
//   t/triage (18.2.9, projections/triage.cjs); r/roadmap, always;
//   e/verdicts, only while verdicts wait (18.2.11); v/view, once a unit
//   has closed (18.2.18), into the closed units; and m/manage (18.3.4),
//   each a menu of its own (projections/manage.cjs). The frame adds h/help.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { dayMonth } = require('../dates.cjs');
const { counted } = require('./map.cjs');
const { dataSection, NOTE_SEPARATOR } = require('./surfaces.cjs');
const { MENUS, drawMenu } = require('../menus.cjs');
const { startMenuRead } = require('../start-menu.cjs');

/** @typedef {import('../start-menu.cjs').StartMenuRead} StartMenuRead */
/** @typedef {import('../start-menu.cjs').UnitRow} UnitRow */
/** @typedef {import('../start-menu.cjs').Waiting} Waiting */
/** @typedef {import('../menus.cjs').MenuRow} MenuRow */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */
/** @typedef {import('./surfaces.cjs').LabelParts} LabelParts */

/** The product row's note while the brownfield research is owed. */
const RESEARCH_OWED = 'research owed';

/** The order units are listed in, by type, within those waiting and those not; a type not here, with the features. */
const TYPE_ORDER = Object.freeze(['feature', 'bugfix', 'quick-fix', 'epic']);

/** A unit's row's note while mail waits for its topic. */
const MAIL_WAITING = 'mail waiting';

/** @param {string} skill @param {...string} args @returns {Next} */
const handoff = (skill, ...args) => ({ kind: 'handoff', skill, args });

/** A row drawing another screen. @param {string} surface @returns {Next} */
const drawing = (surface) => ({ kind: 'engine', argv: ['render', surface] });

/** Where a unit's type lists it (the header's). @param {string} type */
const typeRank = (type) => Math.max(0, TYPE_ORDER.indexOf(type));

/** How much waits in a unit. @param {Waiting} waiting */
const waitingCount = ({ gates, questions, topics }) => gates + questions + topics;

/** The inbox's line (the header's). @param {StartMenuRead['inbox']} inbox */
function inboxLine({ ideas, bugs, quickfixes }) {
  const kinds = [counted(ideas, 'idea'), counted(bugs, 'bug'), counted(quickfixes, 'quick-fix', 'quick-fixes')].filter((words) => !words.startsWith('0 '));
  return `Inbox: ${kinds.length === 0 ? 'empty' : kinds.join(' · ')}`;
}

/**
 * What waits in a unit, as its row counts it: "1 question waiting for you",
 * "1 gate and 2 questions waiting for you"; null where nothing does.
 * @param {Waiting} waiting @returns {string|null}
 */
function waitingWords({ gates, questions, topics }) {
  const parts = [counted(gates, 'gate'), counted(questions, 'question'), counted(topics, 'topic')].filter((words) => !words.startsWith('0 '));
  if (parts.length === 0) return null;
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  return `${listed} waiting for you`;
}

/** A unit's row's note: what waits counted, then mail waiting; none where neither. @param {Waiting} waiting @param {boolean} mail @returns {string|undefined} */
function noteOf(waiting, mail) {
  const notes = [waitingWords(waiting), mail ? MAIL_WAITING : null].filter((note) => note !== null);
  return notes.length === 0 ? undefined : notes.join(NOTE_SEPARATOR);
}

/**
 * The units in the order the menu lists them (the header's).
 * @param {UnitRow[]} units @returns {UnitRow[]}
 */
const listed = (units) => units
  .map((unit, at) => ({ unit, at }))
  .sort((a, b) => Number(waitingCount(b.unit.waiting) > 0) - Number(waitingCount(a.unit.waiting) > 0)
    || typeRank(a.unit.type) - typeRank(b.unit.type) || a.at - b.at)
  .map(({ unit }) => unit);

/** A unit's row: Continue, type first. @param {UnitRow} unit @param {number} at @returns {MenuRow} */
const unitRow = ({ name, type, progress, waiting, mail }, at) => ({
  key: at + 1,
  label: { head: `Continue ${type}: ${titlecase(name)}`, tail: progress, cue: noteOf(waiting, mail) },
  next: { kind: 'engine', argv: ['handoff', 'unit', name] },
});

/** The product's row, always there (the header's). @param {StartMenuRead} read @returns {MenuRow} */
function productRow({ product: { sessions, last }, researchOwed }) {
  const head = 'Talk about the product';
  const count = counted(sessions, 'session');
  const tail = sessions === 0 ? null : last === null ? count : `${count}, last on ${dayMonth(last)}`;
  /** @type {string|LabelParts} */
  let label = head;
  if (tail !== null) label = { head, tail, cue: researchOwed ? RESEARCH_OWED : undefined };
  else if (researchOwed) label = { head, tail: RESEARCH_OWED };
  return { key: 'p', word: 'product', label, next: handoff('leeway-discovery', 'none', 'none') };
}

/** The verdict row, while verdicts wait. @param {number} n @returns {MenuRow[]} */
function verdictRows(n) {
  if (n === 0) return [];
  const label = n === 1 ? 'Give the verdict waiting on a call you changed' : `Give the ${n} verdicts waiting on calls you changed`;
  return [{ key: 'e', word: 'verdicts', label, next: drawing('verdicts') }];
}

/**
 * The start menu's screen over its read (the header's).
 * @param {StartMenuRead} read @returns {MenuScreen}
 */
function startMenuScreen(read) {
  return {
    shows: [inboxLine(read.inbox)],
    rows: [
      ...listed(read.units).map(unitRow),
      productRow(read),
      { key: 's', word: 'start', label: 'Start something new — describe it, and we\'ll find what kind of work it is', next: handoff('leeway-discovery', 'start', 'none') },
      { key: 't', word: 'triage', label: 'Triage the inbox', next: drawing('triage') },
      { key: 'r', word: 'roadmap', label: 'Open the product roadmap', next: handoff('leeway-roadmap', 'open') },
      ...verdictRows(read.verdicts),
      ...(read.closed ? [{ key: 'v', word: 'view', label: 'View completed & cancelled work units', next: drawing('closed') }] : []),
      { key: 'm', word: 'manage', label: 'Manage work units', next: drawing('manage') },
    ],
  };
}

/**
 * `render start-menu`: the start menu drawn (the header's), any warning the
 * ledger's read gave said in a DATA section ahead of it.
 * @param {string} cwd @returns {string}
 */
function startMenuSurface(cwd) {
  const read = startMenuRead(cwd);
  const warned = read.warnings.length === 0 ? '' : dataSection(read.warnings.map((warning) => `warning: ${warning}`));
  return warned + drawMenu(cwd, MENUS['start-menu'], {}, startMenuScreen(read));
}

module.exports = { typeRank, startMenuScreen, startMenuSurface };
