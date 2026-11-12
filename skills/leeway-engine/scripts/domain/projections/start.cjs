'use strict';

// ---------------------------------------------------------------------------
// Domain ring: leeway projections — a closed unit's actions. The start menu
// itself is start-menu.cjs's, triage and the archived items triage.cjs's.
//
// Deterministic: same unit, same string.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { menu, cmdOption, promptOption, section: labelled, MENU_INSTRUCTION } = require('./surfaces.cjs');

/**
 * The selected unit's action menu, served by `render completed-actions` once
 * the list's number resolves to a row: reactivate, back, ask.
 * @param {string} workUnit
 * @param {string} status  `completed` or `cancelled`
 * @returns {string}
 */
function completedActions(workUnit, status) {
  return labelled(
    'MENU: completed actions',
    MENU_INSTRUCTION,
    menu(`**${titlecase(workUnit)}** (${status})`, [
      cmdOption('r', 'reactivate', 'Set status back to in-progress'),
      cmdOption('b', 'back', 'Return to the list'),
      promptOption('Ask', 'Ask a question about this work unit'),
    ], { question: 'What would you like to do?' }),
  );
}

module.exports = { completedActions };
