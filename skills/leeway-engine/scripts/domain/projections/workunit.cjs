'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a single-topic unit's revisit list, which
// `render revisit-phases` serves.
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { menuFrame, cmdOption, section, MENU_INSTRUCTION } = require('./surfaces.cjs');

/**
 * The revisit-phase menu, served by `render revisit-phases` at the gate that
 * displays it — one numbered option per revisit candidate. Empty string when
 * there is nothing to revisit.
 * @param {string[]} phases  the revisit candidates, in phaseTargets order
 * @returns {string}
 */
function revisitPhasesSection(phases) {
  if (phases.length === 0) return '';
  return section(
    'MENU: revisit phases',
    MENU_INSTRUCTION,
    menuFrame([
      'Which phase would you like to revisit?',
      '',
      ...phases.map((phase, i) => cmdOption(String(i + 1), null, { head: titlecase(phase), tail: 'completed' })),
      cmdOption('b', 'back', 'Return to the previous menu'),
    ]),
  );
}

module.exports = { revisitPhasesSection };
