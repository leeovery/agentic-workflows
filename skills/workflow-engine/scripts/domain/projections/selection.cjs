'use strict';

// Shared selection projection for the continue-* navigation skills — the
// pick-list DISPLAY and MENU sections every type's gateway appends to its
// index dump. One composition, five type configs: the clone-family factory
// for the selection step.

const { titlecase, titlecaseLabel } = require('../conventions.cjs');
const { section, dotFrame, cmdOption } = require('./surfaces.cjs');

/**
 * @typedef {object} SelectConfig
 * @property {string} plural    counted noun for the display header ("bugfix(es)")
 * @property {string} question  the menu's opening question
 * @property {string} view      the view-completed option label
 * @property {string} manage    the manage option label
 */

/** @type {Record<string, SelectConfig>} */
const SELECT_CONFIG = {
  feature: {
    plural: 'feature(s)',
    question: 'Which feature would you like to continue?',
    view: 'View completed & cancelled features',
    manage: "Manage a feature's lifecycle",
  },
  bugfix: {
    plural: 'bugfix(es)',
    question: 'Which bugfix would you like to continue?',
    view: 'View completed & cancelled bugfixes',
    manage: "Manage a bugfix's lifecycle",
  },
  'quick-fix': {
    plural: 'quick-fix(es)',
    question: 'Which quick-fix would you like to continue?',
    view: 'View completed & cancelled quick-fixes',
    manage: "Manage a quick-fix's lifecycle",
  },
  'cross-cutting': {
    plural: 'cross-cutting concern(s)',
    question: 'Which cross-cutting concern would you like to continue?',
    view: 'View completed & cancelled cross-cutting concerns',
    manage: "Manage a cross-cutting concern's lifecycle",
  },
  epic: {
    plural: 'epic(s)',
    question: 'Which epic would you like to continue?',
    view: 'View completed & cancelled epics',
    manage: "Manage an epic's lifecycle",
  },
};

/**
 * The selection step's deferred sections: the numbered pick-list display and
 * its menu. Epics sub-row on active phases; every other type on the
 * titlecased phase label. Empty units → empty string (the caller's flow
 * terminates on the zero case before selection).
 * @param {string} type
 * @param {{name: string, phase_label?: string, active_phases?: string[]}[]} units
 * @param {{completed: number, cancelled: number}} counts
 * @returns {string}
 */
function selectionSections(type, units, counts) {
  const cfg = SELECT_CONFIG[type];
  if (!cfg) throw new Error(`selectionSections: unknown type "${type}"`);
  if (!Array.isArray(units) || units.length === 0) return '';

  const disp = [`${units.length} ${cfg.plural} in progress:`, ''];
  units.forEach((u, i) => {
    disp.push(`  ${i + 1}. ${titlecase(u.name)}`);
    disp.push(`     └─ ${type === 'epic'
      ? ((u.active_phases || []).map(titlecase).join(', ') || '(no phases)')
      : titlecaseLabel(u.phase_label || '')}`);
    if (i < units.length - 1) disp.push('');
  });
  const closed = (counts.completed || 0) + (counts.cancelled || 0) > 0;
  if (closed) disp.push('', `${counts.completed} completed, ${counts.cancelled} cancelled.`);

  const menuLines = [cfg.question, ''];
  units.forEach((u, i) => {
    menuLines.push(cmdOption(String(i + 1), null, type === 'epic'
      ? `Continue "${titlecase(u.name)}"`
      : `Continue "${titlecase(u.name)}" — ${u.phase_label}`));
  });
  if (closed) menuLines.push(cmdOption(String(units.length + 1), null, cfg.view));
  menuLines.push(cmdOption('m', 'manage', cfg.manage), '', 'Select an option:');

  return section('DISPLAY: selection', 'emit verbatim as a code block only at the select step', disp.join('\n'))
    + '\n'
    + section('MENU: selection', "emit verbatim as markdown only at the select step, then STOP for the user's response", dotFrame(menuLines));
}

module.exports = { selectionSections, SELECT_CONFIG };
