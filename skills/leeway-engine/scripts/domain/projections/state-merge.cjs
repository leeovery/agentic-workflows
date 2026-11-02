'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the screen of a state merge stopped by a field both machines
// changed to different values (4.7.6), in a manifest or the tracker's store,
// or by tasks both machines made under the same numbers (7.5.7), which the
// person acknowledges with the one row it offers, the tasks this machine
// made again after. Pure renderer over the stop the merge keeps. The conflicts are shown one
// at a time, the one the stop asks about (state-merge-rules.cjs, askedAt):
// each has its own question, and two numbered rows answer it as the spec
// draws them, where every conflict at once would need a key per side per
// field. The DATA section carries the
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
 * A field both sides changed to different values, in the manifest or the
 * tracker's store at `file`: on the branch, or between the working tree's
 * uncommitted copy and the branch's update.
 * @typedef {{
 *   file: string,
 *   uncommitted: boolean,
 *   field: string[],
 *   label: ConflictLabel,
 *   local: Side,
 *   remote: Side,
 *   pick: 'local'|'remote'|null,
 * }} FieldConflict
 */

/**
 * Engine names both sides made in the tracker's store at `file`, the remote's
 * standing: the names, this machine's tasks set aside for them, where this
 * machine's whole copy is kept, and whether the person has seen it.
 * @typedef {import('../state-merge-rules.cjs').Notice & {
 *   file: string,
 *   uncommitted: boolean,
 *   beside: string,
 *   pick: 'seen'|null,
 * }} NoticeConflict
 */

/** @typedef {FieldConflict|NoticeConflict} Conflict */

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

/** Names as a sentence lists them. @param {string[]} names */
function listed(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A set-aside task as the list names it. @param {{phase: number|null, title: string}} task */
function againLine({ phase, title }) {
  return `> - "${escapeMarkdown(title)}"${phase === null ? '' : `, in phase ${phase}`}`;
}

/**
 * The stop's screen for names both machines made: what was made twice,
 * which of this machine's tasks to make again, and where its whole copy is
 * kept; one row carries on.
 * @param {NoticeConflict} notice
 * @returns {string}
 */
function madeTwiceGate(notice) {
  const { madeTwice, again, beside, uncommitted } = notice;
  const one = madeTwice.length === 1;
  const where = uncommitted ? "in this machine's uncommitted copy and in the update from the remote" : 'on each machine since they last agreed';
  const account = [
    `> In the tracker's store, ${escapeMarkdown(listed(madeTwice))} ${one ? 'was' : 'were'} made ${where}. The remote's ${one ? 'keeps that number' : 'keep those numbers'}, and this machine's ${one ? 'is' : 'are'} set aside with all ${one ? 'it holds' : 'they hold'}.`,
    ...(again.length === 0 ? [] : ['>', `> Make ${again.length === 1 ? 'this task' : 'these tasks'} again after the merge; each takes the next free number:`, ...again.map(againLine)]),
    '>',
    `> This machine's whole copy of the tracker's store is kept beside the merged one, as \`${beside}\`.`,
  ];
  const title = one ? madeTwice[0] : `${madeTwice.length} phases and tasks`;
  return [
    dataSection([`choice: ${choiceId(notice)}`]),
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${escapeMarkdown(title)} made on both machines`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', [
      cmdOption('1', null, { head: 'Carry on', tail: again.length === 0 ? "this machine's copy stays beside the merged one" : 'and make them again after' }),
    ], { question: 'Carry on with the merge?' })),
  ].join('\n');
}

/**
 * The stop's screen for the conflict it asks about.
 * @param {{conflicts: Conflict[]}} stop
 * @returns {string}
 */
function stateMergeGate({ conflicts }) {
  const asked = conflicts[askedAt(conflicts)];
  if ('madeTwice' in asked) return madeTwiceGate(asked);
  const conflict = asked;
  const fields = conflicts.filter((c) => c.uncommitted === conflict.uncommitted && !('madeTwice' in c));
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
