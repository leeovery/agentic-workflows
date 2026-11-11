'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a single-topic unit's phase routes — the route a phase is
// entered by, which the bridge's continuation hands off, and the revisit
// list `render revisit-phases` serves. Per-type variation (the work_type
// route argument) comes from WORK_UNIT_TYPES (../workunit-detail.cjs).
// ---------------------------------------------------------------------------

const { titlecase } = require('../conventions.cjs');
const { menuFrame, cmdOption, section, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { typeConfig } = require('../workunit-detail.cjs');
const { phaseSkill, enteredAtUnit } = require('../handoff.cjs');

/**
 * The route a phase of a single-topic unit is entered by — `$0` = the type's
 * work_type value, `$1` = work_unit, `$2` = the item it names where it names
 * one and the phase is entered at a topic — into the skill the phase runs in
 * for the type.
 * @param {string} type  a WORK_UNIT_TYPES key
 * @param {string} phase @param {string} workUnit @param {string|null} [topic]
 * @returns {string}
 */
function phaseRoute(type, phase, workUnit, topic = null) {
  const { workType } = typeConfig(type);
  return [`/${phaseSkill(phase, workType)}`, workType, workUnit, ...(topic === null || enteredAtUnit(phase) ? [] : [topic])].join(' ');
}

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

module.exports = { phaseRoute, revisitPhasesSection };
