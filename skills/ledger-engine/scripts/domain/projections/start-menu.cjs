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
//   type — features, bugfixes, quick-fixes, epics. Its next is Continue,
//   `handoff unit` (19.1.3).
// - Then s/start, into discovery, which takes a piece of work to the type
//   call and talk about the product into its conversation (18.2.7);
//   p/product, always, with its sessions' count and last date once it
//   has sessions holding talk, and the brownfield research while it is owed (18.2.13,
//   8.12.13); t/triage (18.2.9, projections/triage.cjs); r/roadmap, always;
//   e/verdicts, only while verdicts wait (18.2.11); v/view, once a unit
//   has closed (18.2.18), into the closed units; and m/manage (18.3.4),
//   each a menu of its own (projections/manage.cjs). The frame adds h/help.
//
// After a feature's, a bugfix's or an epic's finish, or its cancel from
// inside it, no menu is drawn: one line says, from the menu's own read,
// what waits on the person — each unit's count, the verdicts, the inbox
// where it holds anything — and that the menu is one `/ledger` away, a
// finish's opening on the work done, a cancel's after its own receipt
// (`endedReceipt`). A quick-fix's close says where a branch here stands
// behind what it landed, and how to bring it up, and where it put the
// conversation back at another place, the board's done line for the work,
// D38's (`closedReceipt`).
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { dayMonth } = require('../dates.cjs');
const { counted } = require('./map.cjs');
const { dataSection, section, timedInstruction, NOTE_SEPARATOR } = require('./surfaces.cjs');
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

/** The order units are listed in, by type, within those waiting and those not. */
const TYPE_ORDER = Object.freeze(['feature', 'bugfix', 'quick-fix', 'epic']);

/** A unit's row's note while mail waits for its topic. */
const MAIL_WAITING = 'mail waiting';

/** @param {string} skill @param {...string} args @returns {Next} */
const handoff = (skill, ...args) => ({ kind: 'handoff', skill, args });

/** A row drawing another screen. @param {string} surface @returns {Next} */
const drawing = (surface) => ({ kind: 'engine', argv: ['render', surface] });

/** Where a unit's type lists it (the header's). @param {string} type */
const typeRank = (type) => TYPE_ORDER.indexOf(type);

/** How much waits in a unit. @param {Waiting} waiting */
const waitingCount = ({ gates, questions, topics }) => gates + questions + topics;

/** The inbox's line (the header's). @param {StartMenuRead['inbox']} inbox */
function inboxLine({ ideas, bugs, quickfixes }) {
  const kinds = [counted(ideas, 'idea'), counted(bugs, 'bug'), counted(quickfixes, 'quick-fix', 'quick-fixes')].filter((words) => !words.startsWith('0 '));
  return `Inbox: ${kinds.length === 0 ? 'empty' : kinds.join(' · ')}`;
}

/**
 * What waits in a unit, counted: "1 question", "1 gate and 2 questions";
 * null where nothing does.
 * @param {Waiting} waiting @returns {string|null}
 */
function waitsCounted({ gates, questions, topics }) {
  const parts = [counted(gates, 'gate'), counted(questions, 'question'), counted(topics, 'topic')].filter((words) => !words.startsWith('0 '));
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/**
 * What waits in a unit, as its row counts it: "1 question waiting for you",
 * "1 gate and 2 questions waiting for you"; null where nothing does.
 * @param {Waiting} waiting @returns {string|null}
 */
function waitingWords(waiting) {
  const listed = waitsCounted(waiting);
  return listed === null ? null : `${listed} waiting for you`;
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
  return { key: 'p', word: 'product', label, next: handoff('ledger-discovery', 'none', 'none') };
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
      { key: 's', word: 'start', label: 'Start — say what\'s on your mind: something new, or the product', next: handoff('ledger-discovery', 'start', 'none') },
      productRow(read),
      { key: 't', word: 'triage', label: 'Triage the inbox', next: drawing('triage') },
      { key: 'r', word: 'roadmap', label: 'Open the product roadmap', next: handoff('ledger-roadmap') },
      ...verdictRows(read.verdicts),
      ...(read.closed ? [{ key: 'v', word: 'view', label: 'View completed & cancelled work units', next: drawing('closed') }] : []),
      { key: 'm', word: 'manage', label: 'Manage work units, the project\'s setup and drivers, and the matrix', next: drawing('manage') },
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

/**
 * The line a finish or a cancel says in the start menu's place (the
 * header's): `opening`, a finish's work done, then what waits on the person
 * by the menu's `read`.
 * @param {string|null} opening @param {StartMenuRead} read @returns {string}
 */
function endedReceipt(opening, read) {
  const waits = [
    ...listed(read.units).flatMap(({ name, waiting }) => {
      const words = waitsCounted(waiting);
      return words === null ? [] : [`${titlecase(name)} — ${words}`];
    }),
    ...(read.verdicts === 0 ? [] : [counted(read.verdicts, 'verdict')]),
  ];
  const inbox = read.inbox.ideas + read.inbox.bugs + read.inbox.quickfixes === 0 ? [] : [`${inboxLine(read.inbox)}.`];
  const waiting = waits.length === 0 ? 'Nothing waits on you.' : `Waiting on you: ${waits.join('; ')}.`;
  return section('DISPLAY: ended', timedInstruction('markdown', 'after the response'), [...(opening === null ? [] : [opening]), waiting, ...inbox, 'The menu is one `/ledger` away.'].join(' '));
}

/**
 * What a quick-fix's close says: the work's done line, `done`, where the
 * close put the conversation back at another place; and where its landing
 * left a branch here behind what it landed, its checkout in the way, for
 * each its repository where it is nested, what stopped it there, and the
 * host's branch a fast-forward to which brings it up. Nothing where it has
 * neither.
 * @param {string|null} done @param {{repo: string, into: string, branch: string, why: string}[]} behind @returns {string}
 */
function closedReceipt(done, behind) {
  const lines = [...(done === null ? [] : [done]), ...behind.map(({ repo, into, branch, why }) => {
    const where = repo === '.' ? '' : ` in ${repo}`;
    return `\`${into}\`${where} is behind what landed, not moved: ${why}. Once that is clear, \`git merge --ff-only ${branch}\` there brings it up.`;
  })];
  return lines.length === 0 ? '' : section('DISPLAY: ended', timedInstruction('markdown', 'after the response'), lines.join('\n'));
}

module.exports = { typeRank, listed, startMenuScreen, startMenuSurface, endedReceipt, closedReceipt };
