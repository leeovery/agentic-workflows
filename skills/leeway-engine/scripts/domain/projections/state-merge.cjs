'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the screen of a state merge stopped by a field both machines
// changed to different values (4.7.6), in a manifest or the tracker's store,
// or by tasks both machines made under the same numbers (7.5.7), which the
// person acknowledges with the one row it offers, making again after what
// this machine made. Pure renderer over the stop the merge keeps. The
// conflicts are shown one at a time, the one the stop asks about
// (state-merge-rules.cjs, askedAt): each has its own question, and two
// numbered rows answer it as the spec draws them, where every conflict at
// once would need a key per side per field. The DATA section carries the
// shown choice's identity, which the pick passes back, so a pick only ever
// answers the question its screen showed.
//
// The merge asks in two steps: the branch's fields, then, once those are
// picked, the fields this machine's uncommitted copies changed differently
// from the update. Each step is known whole when it is asked, so the title
// counts the step's fields, and the names made twice that follow them, and
// the account says which one this is.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, emitAs, MENU_INSTRUCTION, dataSection, clipped } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { askedAt, choiceId } = require('../state-merge-rules.cjs');
const { STATE_DIR_NAME } = require('../../kernel/state-root.cjs');

/** @typedef {import('../state-merge-rules.cjs').Side} Side */
/** @typedef {import('../state-merge-rules.cjs').ConflictLabel} ConflictLabel */
/** @typedef {import('../drivers.cjs').MadeAgain} MadeAgain */
/** @typedef {import('../drivers.cjs').MadeTwice['madeTwice'][number]} NameMadeTwice */

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

const KINDS = /** @type {const} */ (['unit', 'phase', 'task']);

/** Names made twice, counted by kind: `a phase and 2 tasks`. @param {NameMadeTwice[]} names */
function counted(names) {
  return listed(KINDS.flatMap((kind) => {
    const n = names.filter((name) => name.kind === kind).length;
    return n === 0 ? [] : [n === 1 ? `a ${kind}` : `${n} ${kind}s`];
  }));
}

/** A title as the list quotes it. @param {string} title */
const quoted = (title) => `"${escapeMarkdown(title)}"`;

/**
 * What to make again of one phase, as the list names it: a phase set aside
 * by its title, its tasks under it; a phase kept by its number and title.
 * @param {MadeAgain} made @returns {string[]}
 */
function againLines({ phase, kept, tasks }) {
  if (phase === null) return tasks.map((task) => `> - ${quoted(task)}`);
  const head = kept === null
    ? `> - the phase ${quoted(phase)}${tasks.length === 0 ? '' : `, with ${tasks.length === 1 ? 'its task' : 'its tasks'}:`}`
    : `> - in phase ${kept}, ${quoted(phase)}:`;
  return [head, ...tasks.map((task) => `>   - ${quoted(task)}`)];
}

/** How many phases and tasks the person makes again. @param {MadeAgain[]} again */
function toMake(again) {
  return again.reduce((n, { phase, kept, tasks }) => n + tasks.length + Number(phase !== null && kept === null), 0);
}

/**
 * The stop's screen for names both machines made: what was made twice,
 * what of this machine's to make again, and where its whole copy is kept;
 * one row carries on.
 * @param {NoticeConflict} notice
 * @returns {string}
 */
function madeTwiceGate(notice) {
  const { madeTwice, again, beside, uncommitted } = notice;
  const one = madeTwice.length === 1;
  const made = toMake(again);
  const where = uncommitted ? "in this machine's uncommitted copy and in the update from the remote" : 'on each machine since they last agreed';
  const said = madeTwice.map((name) => name.said);
  const account = [
    `> In the tracker's store, ${escapeMarkdown(listed(said))} ${one ? 'was' : 'were'} made ${where}. The remote's ${one ? 'keeps that number' : 'keep those numbers'}, and this machine's ${one ? 'is' : 'are'} set aside with all ${one ? 'it holds' : 'they hold'}.`,
    ...(made === 0 ? [] : ['>', made === 1 ? '> Make this again after the merge; it takes the next free number:' : '> Make these again after the merge; each takes the next free number:', ...again.flatMap(againLines)]),
    '>',
    `> This machine's whole copy of the tracker's store is kept beside the merged one, as \`${STATE_DIR_NAME}/${beside}\`.`,
  ];
  const title = one ? said[0] : counted(madeTwice);
  const tail = made === 0 ? "this machine's copy stays beside the merged one" : `and make ${made === 1 ? 'it' : 'them'} again after`;
  return [
    dataSection([`choice: ${choiceId(notice)}`]),
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${escapeMarkdown(title)} made on both machines`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', [
      cmdOption('1', null, { head: 'Carry on', tail }),
    ], { question: 'Carry on with the merge?' })),
  ].join('\n');
}

/**
 * Which of the step's fields this is, and that the names made twice follow
 * them, where they do; nothing where it is the one stop.
 * @param {number} at @param {number} count @param {boolean} then @returns {string}
 */
function whichField(at, count, then) {
  const follow = then ? '; the names made twice follow' : '';
  if (count === 1) return then ? `One field${follow}. ` : '';
  return `Field ${at + 1} of ${count}${follow}. `;
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
  const inStep = conflicts.filter((c) => c.uncommitted === conflict.uncommitted);
  const fields = inStep.filter((c) => !('madeTwice' in c));
  const then = inStep.length > fields.length;
  const step = STEPS[conflict.uncommitted ? 'uncommitted' : 'branch'];
  const which = whichField(fields.indexOf(conflict), fields.length, then);
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
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${step.title(fields.length)}${then ? ', and names made twice' : ''}`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', rows, { question: question(conflict.label) })),
  ].join('\n');
}

module.exports = { stateMergeGate };
