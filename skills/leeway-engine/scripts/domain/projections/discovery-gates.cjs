'use strict';

// ---------------------------------------------------------------------------
// Domain ring: discovery's two authority gates as the person sees them,
// drawn from Claude's staged payload (start-this-work.cjs, approve-map.cjs),
// each a screen the spec draws (8.8.2, 8.8.4):
// - start this work: the work's title and type, its description, and the
//   one-line reason for the type beneath; then the gate, whose yes creates
//   the unit and says what comes next — for an epic, shaping its topics and
//   approving the map; for the others, the phase it opens in;
// - approve the map: THE MAP, the topics numbered in their order, a re-shape
//   marking each topic that is new and each that moved (8.8.21); TO THE
//   ROADMAP, each park with the horizon the person gave it; then the gate,
//   whose yes puts the topics on the epic in that order and the parks on the
//   roadmap.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, titlecase } = require('../conventions.cjs');
const { counted } = require('./map.cjs');

/** @typedef {import('./surfaces.cjs').Next} Next */

/** @typedef {{name: string, type: string, description: string, reason: string}} StartView */

/**
 * The map as approve the map draws it: the epic, each topic by its title in
 * the order staged — marked new or moved on a re-shape — and each park by
 * its summary and the horizon the person gave it.
 * @typedef {{unit: string, topics: {title: string, mark: 'new'|'moved'|null}[], parks: {summary: string, horizon: string}[]}} MapView
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

/** The work as start this work shows it: its title and type, its description, and the reason for the type. @param {StartView} view */
function startDisplay({ name, type, description, reason }) {
  return [
    `${titlecase(name)} (${type})`,
    ...wrapWithPrefix(description, { width: TREE_WIDTH }),
    ...wrapWithPrefix(`↳ ${reason}`, { width: TREE_WIDTH, hang: 2 }),
  ].join('\n');
}

/**
 * Start this work (8.8.2): the work, then the authority gate whose yes
 * creates the unit.
 * @param {StartView} view
 * @returns {string}
 */
function startThisWorkScreen(view) {
  const { type } = view;
  return section('DISPLAY: start this work', CONTINUE_INSTRUCTION, startDisplay(view))
    + section('MENU: start this work', MENU_INSTRUCTION, menu(`Your yes creates the ${type}. ${OPENS[/** @type {keyof typeof OPENS} */ (type)]}`, [
      cmdOption('y', 'yes', `Start it — create the ${type}`, runs(['start-this-work', 'yes'])),
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

module.exports = { startThisWorkScreen, approveMapScreen };
