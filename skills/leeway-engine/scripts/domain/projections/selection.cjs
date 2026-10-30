'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the continue menus' not-found display — the terminal a view
// answers when the work unit the start menu selected is no longer in
// progress.
// ---------------------------------------------------------------------------

const { section, emitAs } = require('./surfaces.cjs');

/**
 * The view verb's not-found terminal display.
 * @param {string} noun  what the menu continues, singular — `epic`, `work unit`
 * @param {string} workUnit
 * @returns {string}
 */
function selectionNotFound(noun, workUnit) {
  return section(
    'DISPLAY: not found',
    emitAs('text', ', then STOP — terminal condition'),
    `No active ${noun} named "${workUnit}" found.\n\nRun /workflow-start to see available ${noun}s or begin a new one.`,
  );
}

module.exports = { selectionNotFound };
