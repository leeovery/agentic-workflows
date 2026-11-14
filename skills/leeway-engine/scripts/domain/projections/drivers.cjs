'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the drivers as the person sees them (22.4.4, 22.4.8, 22.5.8),
// drawn from the drivers' check (drivers-verbs.cjs), every tool and driver
// named in the words its driver declares (drivers.cjs), so no screen here
// names a tool (7.1.10, 7.2.13).
//
// - The stop at ready to build, where a tool a driver needs is not fine: its
//   alert, "⚑ Ready to build stopped: the {kind} driver …", or "the drivers"
//   where both stop; then, for each driver that stops, what the project does
//   through it and the tools it needs at their floors, and how each stands —
//   here, not installed, older than its floor with where its update
//   instructions live, or failing with its error — never an install
//   command; then that nothing has been built, and that ready to build
//   waits until each is put right or the driver is changed from manage. The
//   yes refused for it says the same in one line.
// - The drivers menu, from manage's d/drivers: each kind's drivers
//   installed, the one in use marked; a numbered row for each other, its
//   next `drivers set`; and back to manage.
// ---------------------------------------------------------------------------

const { section, emitAs } = require('./surfaces.cjs');

/** @typedef {import('../drivers.cjs').ToolState} ToolState */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('../menus.cjs').MenuRow} MenuRow */

/**
 * A driver as the check reads it: its kind, name and title, and how each
 * tool it needs stands.
 * @typedef {{kind: 'task'|'landing', driver: string, title: string, tools: ToolState[]}} DriverCheck
 */

/**
 * The drivers menu as it is drawn: each kind's drivers installed, by name
 * and title, and the one in use.
 * @typedef {{kind: 'task'|'landing', using: string, installed: {name: string, title: string}[]}} KindView
 */

/** What the project does through each kind of driver, as a sentence says it. */
const DOES = Object.freeze({ task: 'tracks its tasks', landing: 'lands its work' });

/** What choosing a driver of each kind does, as its row says it. */
const CHOOSE = Object.freeze({ task: 'Track tasks through', landing: 'Land work through' });

/** What puts each state of a tool right, as the stop says it. */
const REMEDY = Object.freeze({ missing: 'installed', older: 'updated', failing: 'working' });

/** @param {ToolState} tool */
const notFine = (tool) => tool.state !== 'fine';

/** @param {string} text */
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Items in a sentence: `a`, `a and b`, `a, b and c`. @param {string[]} items */
const listed = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** How a tool stands, as a clause. @param {ToolState} tool */
function standing(tool) {
  if (tool.state === 'fine') return `${tool.label} is here`;
  if (tool.state === 'missing') return `${tool.label} isn't installed`;
  if (tool.state === 'older') return `${tool.label} is ${tool.found}, older than ${tool.floor} — its update instructions are at ${tool.update}`;
  return `${tool.label} is installed but fails — ${tool.error}`;
}

/** The alert's words, after its flag. @param {DriverCheck[]} stopping */
function stopped(stopping) {
  const failing = stopping.flatMap(({ tools }) => tools.filter(notFine));
  const one = stopping.length === 1;
  const [is, needs, its] = one ? ['is', 'needs', 'its'] : ['are', 'need', 'their'];
  const counted = (/** @type {string} */ single, /** @type {string} */ many) => (failing.length === 1 ? single : many);
  const states = new Set(failing.map(({ state }) => state));
  const only = (/** @type {ToolState['state']} */ state) => states.size === 1 && states.has(state);
  let problem = `${is} held up by ${counted('a tool', `${its} tools`)}`;
  if (only('missing')) problem = `${is} missing ${counted('a tool', 'tools')}`;
  else if (only('older')) problem = `${needs} ${counted('a newer tool', 'newer tools')}`;
  return `Ready to build stopped: ${one ? `the ${stopping[0].kind} driver` : 'the drivers'} ${problem}`;
}

/** What the project does through a driver, what it needs and how each stands. @param {string} project @param {DriverCheck} check */
function account(project, { kind, title, tools }) {
  const needs = listed(tools.map(({ label, floor }) => `${label} ${floor} or newer`));
  return `${project} ${DOES[kind]} through ${title}, which needs ${needs}. ${capital(tools.map(standing).join('; '))}.`;
}

/** That nothing was built, and what ready to build waits for. @param {DriverCheck[]} stopping */
function waiting(stopping) {
  const failing = stopping.flatMap(({ tools }) => tools.filter(notFine));
  const until = listed(failing.map((tool) => `${tool.label} is ${REMEDY[/** @type {keyof typeof REMEDY} */ (tool.state)]}`));
  const changed = stopping.length === 1 ? `the ${stopping[0].kind} driver is` : 'the drivers are';
  return `Nothing has been built. Ready to build waits until ${until}, or until ${changed} changed from manage on the start menu.`;
}

/** The stop's paragraphs, in order. @param {string} project @param {DriverCheck[]} stopping */
const paragraphs = (project, stopping) => [...stopping.map((check) => account(project, check)), waiting(stopping)];

/**
 * The stop at ready to build: its alert, then its account.
 * @param {string} project @param {DriverCheck[]} stopping each driver with a tool not fine
 * @returns {string}
 */
function driversStopScreen(project, stopping) {
  return [
    section('DISPLAY: drivers stop', emitAs('properties'), `⚑ ${stopped(stopping)}`),
    section('DISPLAY: drivers account', emitAs('markdown'), paragraphs(project, stopping).map((line) => `> ${line}`).join('\n>\n')),
  ].join('\n');
}

/**
 * The stop in one line, as the yes is refused for it.
 * @param {string} project @param {DriverCheck[]} stopping
 * @returns {string}
 */
function driversStopReason(project, stopping) {
  return `${stopped(stopping)} — ${paragraphs(project, stopping).join(' ')}`;
}

const engine = (/** @type {string[]} */ ...argv) => ({ kind: /** @type {const} */ ('engine'), argv });

/**
 * The drivers menu's screen: what it shows, its rows and its back.
 * @param {KindView[]} kinds
 * @returns {MenuScreen}
 */
function driversScreen(kinds) {
  const shows = kinds.flatMap(({ kind, using, installed }) => [
    `THE ${kind.toUpperCase()} DRIVER`,
    ...installed.map(({ name, title }) => `  · ${title}${name === using ? ' — in use' : ''}`),
  ]);
  const choices = kinds.flatMap(({ kind, using, installed }) => installed.filter(({ name }) => name !== using).map(({ name, title }) => ({ kind, name, title })));
  return {
    shows,
    question: 'Which driver would you like to use?',
    rows: choices.map(({ kind, name, title }, at) => /** @type {MenuRow} */ ({ key: at + 1, label: `${CHOOSE[kind]} ${title}`, next: engine('drivers', 'set', kind, name) })),
    back: { label: 'Back to manage', next: engine('render', 'manage') },
  };
}

module.exports = { driversStopScreen, driversStopReason, driversScreen };
