'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the reference cards, reached from the start menu's help
// (23.2.3) — `render help-topics`, "■ Help · Topics", drawn in the menus'
// frame (menus.cjs): "Which area?", a numbered row for each card in the
// order the content folder holds them, labelled with its title, its next
// the card (`render walkthrough-topic --name <slug>`, walkthrough.cjs);
// then h/help, b/back to the start menu's help, and Ask, leading into the
// conversation. Reached only from the start menu's help, it drops the
// position as the start menu does.
// ---------------------------------------------------------------------------

const { MENUS, drawMenu } = require('../menus.cjs');
const { cards } = require('./walkthrough.cjs');

/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */

/** The cards' screen. @returns {MenuScreen} */
function helpTopicsScreen() {
  return {
    title: 'Help · Topics',
    shows: [],
    question: 'Which area?',
    rows: cards().map(({ slug, title }, at) => ({ key: at + 1, label: title, next: { kind: 'engine', argv: ['render', 'walkthrough-topic', '--name', slug] } })),
    back: { label: 'Back to help', next: { kind: 'engine', argv: ['render', 'help', 'start-menu'] } },
    prompt: { label: 'Ask', description: 'Ask anything about how Ledger works', next: { kind: 'continue' } },
  };
}

/** `render help-topics`: the reference cards (the header's). @param {string} cwd @returns {string} */
const helpTopicsSurface = (cwd) => drawMenu(cwd, MENUS['help-topics'], {}, helpTopicsScreen());

module.exports = { helpTopicsSurface };
