'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start's boot gates — the static menus Step 0 puts to
// the user before any work is on the table. Pure renderers; neither reads
// state (the calling prose branches on the boot response and fetches the
// gate at its display point).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption } = require('./surfaces.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/**
 * The migration confirm gate — after the summary of what the migrations did.
 * @returns {string}
 */
function migrationGate() {
  const body = menu(
    '',
    [
      cmdOption('c', 'continue', 'Proceed'),
      promptOption('Ask', 'Ask questions about the changes'),
    ],
    { question: 'Ready to continue?' },
  );
  return section('MENU: migration gate', MENU_INSTRUCTION, body);
}

/**
 * The one-time tmux session-label opt-in.
 * @returns {string}
 */
function labelGate() {
  const body = menu(
    '',
    [
      cmdOption('y', 'yes', 'Turn session labels on'),
      cmdOption('n', 'no', 'Leave session names alone'),
    ],
    { question: 'Label your tmux session as you work?' },
  );
  return section('MENU: label gate', MENU_INSTRUCTION, body);
}

module.exports = { migrationGate, labelGate };
