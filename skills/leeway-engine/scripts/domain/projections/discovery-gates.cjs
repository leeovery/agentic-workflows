'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's two authority gates as the person sees them,
// drawn from Claude's staged payload (start-this-work.cjs, approve-map.cjs),
// each a screen the spec draws (8.8.2, 8.8.4):
// - start this work: the work's title and type, its description, and the
//   one-line reason for the type beneath; then the gate, whose yes creates
//   the unit and says what comes next — for an epic, shaping its topics and
//   approving the map; for the others, the phase it opens in. A unit moved
//   to a feature or a bugfix (workunit-move.cjs) is drawn the same, its yes
//   making the unit of the new type, and the quick-fix's branch its move
//   keeps unlanded named in one line beneath the reason;
// - approve the map: THE MAP, the topics numbered in their order, a re-shape
//   marking each topic that is new and each that moved (8.8.21); TO THE
//   ROADMAP, each park with the horizon the person gave it; then the gate,
//   whose yes puts the topics on the epic in that order and the parks on the
//   roadmap;
// - approve the map after the sweep before the spec: THE MAP, each topic
//   numbered in its order and ticked where decided; FOUND BY THE SWEEP, each
//   candidate with its reason beneath, a struck one marked; then the gate,
//   whose yes puts the candidates standing on the map, and its strike, with
//   the pick of the candidate to strike where more than one stands.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { counted } = require('./map.cjs');

/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * The work as start this work draws it: its name, type, description and
 * reason, and for a move, the type it moves from and the branch it leaves a
 * quick-fix's commits unlanded on, where it keeps one.
 * @typedef {{name: string, type: string, description: string, reason: string, moves?: {from: string, branches: string[]}}} StartView
 */

/**
 * The map as approve the map draws it: the epic, each topic by its title in
 * the order staged — marked new or moved on a re-shape — and each park by
 * its summary and the horizon the person gave it.
 * @typedef {{unit: string, topics: {title: string, mark: 'new'|'moved'|null}[], parks: {summary: string, horizon: string}[]}} MapView
 */

/**
 * The map after the sweep: the epic, each topic by its title in its order,
 * decided or not, and each of the sweep's candidates by its title with its
 * reason, struck or standing.
 * @typedef {{unit: string, topics: {title: string, decided: boolean}[], candidates: {title: string, reason: string, struck: boolean}[]}} SweptView
 */

/** What answering a row runs: an engine command, by its argv after `engine`. @param {string[]} argv @returns {{next: Next}} */
function runs(argv) {
  return { next: { kind: 'engine', argv } };
}

/** What a yes opens next, after the unit is created, by its type. */
const OPENS = Object.freeze({
  epic: 'We shape its topics next, and you approve the map.',
  feature: 'Its discussion opens next.',
  bugfix: 'Its investigation opens next.',
  'quick-fix': 'Its scoping opens next.',
});

/** A type with its article. @param {string} type */
const aType = (type) => `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`;

/** The line naming the branch a move leaves a quick-fix's commits unlanded on, or none. @param {string[]} branches */
function keptLine(branches) {
  if (branches.length === 0) return [];
  return wrapWithPrefix(`⚑ Its commits stay unlanded on ${branches.join(', ')}`, { width: TREE_WIDTH, hang: 2 });
}

/**
 * The work as start this work shows it: its title and type, its
 * description, the reason for the type, and a move's branches left
 * unlanded.
 * @param {StartView} view
 */
function startDisplay({ name, type, description, reason, moves }) {
  return [
    `${titlecase(name)} (${type})`,
    ...wrapWithPrefix(description, { width: TREE_WIDTH }),
    ...wrapWithPrefix(`↳ ${reason}`, { width: TREE_WIDTH, hang: 2 }),
    ...keptLine(moves?.branches ?? []),
  ].join('\n');
}

/**
 * Start this work (8.8.2): the work, then the authority gate whose yes
 * creates the unit — or for a move, makes it the new type.
 * @param {StartView} view
 * @returns {string}
 */
function startThisWorkScreen(view) {
  const { type, moves } = view;
  const yes = moves === undefined
    ? { lead: `Your yes creates the ${type}.`, label: `Start it — create the ${type}` }
    : { lead: `Your yes makes the ${moves.from} ${aType(type)}.`, label: `Move it — the ${moves.from} becomes ${aType(type)}` };
  return section('DISPLAY: start this work', CONTINUE_INSTRUCTION, startDisplay(view))
    + section('MENU: start this work', MENU_INSTRUCTION, menu(`${yes.lead} ${OPENS[/** @type {keyof typeof OPENS} */ (type)]}`, [
      cmdOption('y', 'yes', yes.label, runs(['start-this-work', 'yes'])),
      promptOption('Keep shaping', 'Tell me what I\'m missing'),
    ], { question: 'Start this work?' }));
}

/** THE MAP: each topic numbered in its order, a mark where a re-shape made it new or moved it. @param {MapView['topics']} topics */
function mapBlock(topics) {
  const tree = renderTree(topics.map(({ title, mark }, at) => ({ title: `${at + 1}. ${title}`, ...(mark === null ? {} : { tag: mark }) })), { width: TREE_WIDTH, wrapTitles: true });
  return `THE MAP (${counted(topics.length, 'topic')}, foundations first)\n${tree.replace(/\n+$/, '')}`;
}

/** TO THE ROADMAP: each park by its summary, its horizon beside it. @param {MapView['parks']} parks */
function parksBlock(parks) {
  const tree = renderTree(parks.map(({ summary, horizon }) => ({ title: summary, tag: horizon })), { width: TREE_WIDTH, wrapTitles: true });
  return `TO THE ROADMAP (${parks.length}, with the map)\n${tree.replace(/\n+$/, '')}`;
}

/**
 * Approve the map (8.8.4): the topics in their order and the parks, then the
 * authority gate whose yes lands them.
 * @param {MapView} view
 * @returns {string}
 */
function approveMapScreen({ unit, topics, parks }) {
  const parked = parks.length > 0;
  const display = [mapBlock(topics), ...(parked ? [parksBlock(parks)] : [])].join('\n\n');
  const lands = `Your yes puts the topics on ${titlecase(unit)} in this order${parked ? ' and the parks on the roadmap' : ''}.`;
  return section('DISPLAY: approve the map', CONTINUE_INSTRUCTION, display)
    + section('MENU: approve the map', MENU_INSTRUCTION, menu(lands, [
      cmdOption('y', 'yes', 'Approve it', runs(['approve-map', 'yes', unit])),
      promptOption('Keep shaping', `Tell me what to change — ${parked ? 'a topic, the order or a park' : 'a topic or the order'}`),
    ], { question: 'Approve the map?' }));
}

/** The numbers the gate says in words. */
const IN_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** THE MAP after the sweep: each topic numbered in its order, ticked where decided. @param {SweptView['topics']} topics */
function sweptMapBlock(topics) {
  const decided = topics.filter((topic) => topic.decided).length;
  const tree = renderTree(topics.map(({ title, decided: done }, at) => ({ title: `${done ? '✓' : '◐'} ${at + 1}. ${title}` })), { width: TREE_WIDTH, wrapTitles: true });
  const stands = decided === topics.length ? 'every one decided' : `${decided} decided`;
  return `THE MAP (${counted(topics.length, 'topic')}, ${stands})\n${tree.replace(/\n+$/, '')}`;
}

/** FOUND BY THE SWEEP: each candidate with its reason beneath, a struck one marked. @param {SweptView['candidates']} candidates */
function candidatesBlock(candidates) {
  const tree = renderTree(candidates.map(({ title, reason, struck }) => ({
    title: `${struck ? '⊘' : '○'} ${title}`,
    ...(struck ? { tag: 'struck' } : {}),
    body: [reason],
  })), { width: TREE_WIDTH });
  return `FOUND BY THE SWEEP (${counted(candidates.length, 'candidate')}, yours to take or strike)\n${tree.replace(/\n+$/, '')}`;
}

/** What the person's yes does with the candidates standing, said on the gate. @param {number} standing */
function sweptYes(standing) {
  if (standing === 0) return { lands: 'Your yes leaves the map as it is.', label: 'Approve it — no candidate becomes a topic' };
  if (standing === 1) {
    return { lands: 'Your yes puts the candidate on the map as a topic, and the specification waits until it is decided.', label: 'Approve it — the candidate becomes a topic' };
  }
  return {
    lands: `Your yes puts the ${IN_WORDS[standing] ?? standing} candidates on the map as topics, and the specification waits until they are decided.`,
    label: 'Approve it — the candidates become topics',
  };
}

/**
 * Approve the map after the sweep before the spec (8.8.4, 8.10.9): the map
 * as it stands, each topic ticked where decided, and the sweep's candidates
 * below it, each with its reason; then the authority gate, whose yes puts
 * the candidates standing on the map, and its strike — at once where one
 * candidate stands, through a pick where more do (P8). Nothing of the
 * messages the sweep sent or the calls it left to the builder (8.S50).
 * @param {SweptView} view
 * @returns {string}
 */
function sweptMapScreen({ unit, topics, candidates }) {
  const standing = candidates.flatMap(({ struck }, at) => (struck ? [] : [at + 1]));
  const { lands, label } = sweptYes(standing.length);
  const rows = [cmdOption('y', 'yes', label, runs(['approve-map', 'yes', unit]))];
  if (standing.length === 1) rows.push(cmdOption('s', 'strike', 'Strike the candidate — it doesn\'t become a topic', runs(['approve-map', 'strike', unit, String(standing[0])])));
  if (standing.length > 1) rows.push(cmdOption('s', 'strike', 'Strike a candidate — it doesn\'t become a topic', runs(['render', 'approve-map-strike', unit])));
  rows.push(promptOption('Keep shaping', 'Tell me what to change'));
  return section('DISPLAY: approve the map', CONTINUE_INSTRUCTION, `${sweptMapBlock(topics)}\n\n${candidatesBlock(candidates)}`)
    + section('MENU: approve the map', MENU_INSTRUCTION, menu(lands, rows, { question: 'Approve the map?' }));
}

/**
 * The pick of the sweep's candidate to strike: each standing candidate by
 * its number on the screen, and back to the screen as it was.
 * @param {{unit: string, candidates: {title: string, struck: boolean}[]}} view
 * @returns {string}
 */
function sweptStrikePick({ unit, candidates }) {
  const rows = candidates.flatMap(({ title, struck }, at) => (struck ? [] : [
    cmdOption(String(at + 1), null, { head: title }, runs(['approve-map', 'strike', unit, String(at + 1)])),
  ]));
  rows.push(cmdOption('b', 'back', 'Back to the map — nothing struck', runs(['render', 'approve-map', unit])));
  return section('MENU: approve the map strike', MENU_INSTRUCTION, menu('', rows, { question: 'Which candidate should not become a topic?' }));
}

module.exports = { startThisWorkScreen, approveMapScreen, sweptMapScreen, sweptStrikePick, aType };
