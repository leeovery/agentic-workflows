'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the screen of a state merge stopped by a field both machines
// changed to different values (4.7.6). Pure renderer over the stop the merge
// keeps. The conflicts are shown one at a time, the one the stop asks about
// (state-merge-rules.cjs, askedAt): each has its own question, and two
// numbered rows answer it as the spec draws them, where every conflict at
// once would need a key per side per field. The DATA section carries the
// shown choice's identity, which the pick passes back, so a pick only ever
// answers the question its screen showed.
//
// The merge asks in two steps: the branch's fields, then, once those are
// picked, the fields this machine's uncommitted copies changed differently
// from the update. Each step is known whole when it is asked, so the title
// counts the step's fields and the account says which one this is.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, emitAs, MENU_INSTRUCTION, dataSection, clipped } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { askedAt, choiceId } = require('../state-merge-rules.cjs');

/** @typedef {import('../state-merge-rules.cjs').Side} Side */
/** @typedef {import('../state-merge-rules.cjs').ConflictLabel} ConflictLabel */

/**
 * A field both sides changed to different values, in the manifest at
 * `manifest`: on the branch, or between the working tree's uncommitted copy
 * and the branch's update.
 * @typedef {{
 *   manifest: string,
 *   uncommitted: boolean,
 *   field: string[],
 *   label: ConflictLabel,
 *   local: Side,
 *   remote: Side,
 *   pick: 'local'|'remote'|null,
 * }} Conflict
 */

/**
 * How a step's screen names its fields and its sides: each side's key, value
 * and row tail, and its line in the account.
 * @typedef {{
 *   title: (count: number) => string,
 *   changed: string,
 *   sides: readonly (readonly ['1'|'2', 'local'|'remote', string, string])[],
 * }} Step
 */

/** @type {Record<'branch'|'uncommitted', Step>} */
const STEPS = {
  branch: {
    title: (count) => `${count === 1 ? 'one field' : `${count} fields`} changed on both machines`,
    changed: 'changed on each machine since they last agreed',
    sides: [['1', 'local', "this machine's", 'this machine'], ['2', 'remote', "the remote's", 'the remote']],
  },
  uncommitted: {
    title: (count) => `this machine's uncommitted copy and the update changed ${count === 1 ? 'one field' : `${count} fields`} differently`,
    changed: "changed in this machine's uncommitted copy, and differently in the update from the remote",
    sides: [['1', 'local', "this machine's uncommitted copy", "this machine's uncommitted copy"], ['2', 'remote', "the remote's", 'the update from the remote']],
  },
};

// The menu's glyphed question is short and plain (surfaces.cjs: a label
// earns the glyph within 60 characters, with no markup in it).
const QUESTION_MAX = 60;
const ROW_VALUE_MAX = 40;

/** A side's value as one line of text. @param {Side} side @returns {string} */
function shown(side) {
  if (!side.set) return 'removed';
  const { value } = side;
  return typeof value === 'string' && value !== '' && !value.includes('\n') ? value : JSON.stringify(value);
}

/**
 * The questions the menu could ask, most specific first: the field by its
 * meaning and the entry by its name, or the manifest where no entry is
 * named; then the field alone.
 * @param {ConflictLabel} label @returns {string[]}
 */
function asks({ name, field, owner }) {
  if (name === null) return [`Which ${field} does ${owner} keep?`, `Which ${field} stays?`];
  if (field === null) return [`Which version of "${name}" stays?`, 'Which version stays?'];
  return [`Which ${field} does "${name}" keep?`, `Which ${field} stays?`];
}

/** The most specific question that fits the glyph. @param {ConflictLabel} label @returns {string} */
function question(label) {
  return /** @type {string} */ ([...asks(label), 'Which value stays?'].find((ask) => ask.length <= QUESTION_MAX && !/[\n*`]/.test(ask)));
}

/** What changed, named: the field of the entry, or the field by its path. @param {ConflictLabel} label */
function changed({ subject, field, path }) {
  const what = field === null ? null : `the ${escapeMarkdown(field)}`;
  if (subject === null) return `${what} (\`${path}\`)`;
  return what === null ? escapeMarkdown(subject) : `${what} of ${escapeMarkdown(subject)}`;
}

/**
 * The stop's screen for the conflict it asks about.
 * @param {{conflicts: Conflict[]}} stop
 * @returns {string}
 */
function stateMergeGate({ conflicts }) {
  const conflict = conflicts[askedAt(conflicts)];
  const fields = conflicts.filter((c) => c.uncommitted === conflict.uncommitted);
  const step = STEPS[conflict.uncommitted ? 'uncommitted' : 'branch'];
  const which = fields.length === 1 ? '' : `Field ${fields.indexOf(conflict) + 1} of ${fields.length}. `;
  const account = [
    `> ${which}In ${escapeMarkdown(conflict.label.owner)}, ${changed(conflict.label)} ${step.changed}:`,
    '>',
    ...step.sides.map(([, side, , who]) => `> - ${who}: ${escapeMarkdown(shown(conflict[side]))}`),
    '>',
    '> The engine takes a field from one side only where the other left it alone or set it the same, so it stops here for you to pick.',
  ];
  const rows = step.sides.map(([key, side, whose]) => cmdOption(key, null, { head: escapeMarkdown(clipped(shown(conflict[side]), ROW_VALUE_MAX)), tail: whose }));
  return [
    dataSection([`choice: ${choiceId(conflict)}`]),
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${step.title(fields.length)}`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', rows, { question: question(conflict.label) })),
  ].join('\n');
}

module.exports = { stateMergeGate };
