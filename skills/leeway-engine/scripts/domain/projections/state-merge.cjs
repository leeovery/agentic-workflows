'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the screen of a state merge stopped by a field both machines
// changed to different values (4.7.6), in a manifest or the tracker's store,
// or by a notice the person acknowledges with the one row it offers: tasks
// both machines made under the same numbers (7.5.7), making again after
// what this machine made; or a consolidation report of this machine's set
// aside, its notes having moved. Pure renderer over the stop the merge
// keeps. The conflicts are shown one at a time, the one the stop asks about
// (state-merge-rules.cjs, askedAt): each has its own question, and two
// numbered rows answer it as the spec draws them, where every conflict at
// once would need a key per side per field. The DATA section carries the
// shown choice's identity, which the pick passes back, so a pick only ever
// answers the question its screen showed; each row's `next` is that pick,
// `state-merge pick`, which `gate` hands back (gate.cjs).
//
// The merge asks in two steps: the branch's fields, then, once those are
// picked, the fields this machine's uncommitted copies changed differently
// from the update. Each step is known whole when it is asked, so the title
// counts the step's fields and names the notices that follow them, and the
// account says which one this is.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, emitAs, MENU_INSTRUCTION, dataSection, clipped } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { askedAt, isNotice, choiceId } = require('../state-merge-rules.cjs');
const { STATE_DIR_NAME } = require('../../kernel/state-root.cjs');
const { phaseName } = require('../task-id.cjs');

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
 * Where a notice is, where this machine's copy is kept, and whether the
 * person has seen it.
 * @typedef {{file: string, uncommitted: boolean, beside: string, pick: 'seen'|null}} Noticed
 */

/**
 * Engine names both sides made in the tracker's store at `file`, the remote's
 * standing: the names, and this machine's tasks set aside for them.
 * @typedef {import('../drivers.cjs').MadeTwice & Noticed} MadeTwiceConflict
 */

/**
 * The consolidation report at `file` this machine changed, set aside: its
 * phase, whether the remote's copy stays, and how this machine's notes moved.
 * @typedef {import('../state-merge-rules.cjs').SetAside & Noticed} SetAsideConflict
 */

/** @typedef {MadeTwiceConflict|SetAsideConflict} NoticeConflict */

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
 * @param {MadeTwiceConflict} notice
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
      cmdOption('1', null, { head: 'Carry on', tail }, picking('1', notice)),
    ], { question: 'Carry on with the merge?' })),
  ].join('\n');
}

/**
 * What answering a row leads to: the pick of the choice the screen shows.
 * @param {string} key @param {Conflict} asked
 * @returns {{next: import('./surfaces.cjs').Next}}
 */
function picking(key, asked) {
  return { next: { kind: 'engine', argv: ['state-merge', 'pick', key, choiceId(asked)] } };
}

/**
 * The stop's screen for a consolidation report of this machine's set aside:
 * how this machine's notes moved, why the report could not move with them,
 * and where each copy is; one row carries on.
 * @param {SetAsideConflict} notice
 * @returns {string}
 */
function setAsideGate(notice) {
  const { file, setAside, beside, uncommitted } = notice;
  const report = `the consolidation report of ${phaseName(file.slice(0, file.indexOf('/')), setAside.phase)}`;
  const copy = uncommitted ? 'uncommitted copy' : 'copy';
  const kept = uncommitted ? 'The merged report' : "The remote's report";
  const stays = setAside.stays ? `${kept} stays at \`${STATE_DIR_NAME}/${file}\`` : `No report stays at \`${STATE_DIR_NAME}/${file}\``;
  const account = [
    `> This machine's notes for later follow the remote's in the merge: ${setAside.renumbered.map(({ from, to }) => `note ${from} is now note ${to}`).join(', ')}. This machine's ${copy} of ${escapeMarkdown(report)} does not read as one, so the notes it takes cannot be renamed with them.`,
    '>',
    `> ${stays}, and this machine's ${copy} is kept beside it as \`${STATE_DIR_NAME}/${beside}\`. The notes it took wait for a consolidation again; the tasks it made stand.`,
  ];
  return [
    dataSection([`choice: ${choiceId(notice)}`]),
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${report} set aside`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', [
      cmdOption('1', null, { head: 'Carry on', tail: `this machine's ${copy} is kept beside` }, picking('1', notice)),
    ], { question: 'Carry on with the merge?' })),
  ].join('\n');
}

/**
 * The notices that follow a step's fields, named for its title and for the
 * line saying which field this is: none where none follows.
 * @param {NoticeConflict[]} notices @returns {{title: string, which: string}|null}
 */
function following(notices) {
  const reports = notices.filter((c) => 'setAside' in c).length;
  const kinds = [
    ...(notices.some((c) => 'madeTwice' in c) ? [{ title: 'names made twice', which: 'the names made twice', many: true }] : []),
    ...(reports === 0 ? [] : [reports === 1
      ? { title: 'a consolidation report set aside', which: 'the consolidation report set aside', many: false }
      : { title: `${reports} consolidation reports set aside`, which: `the ${reports} consolidation reports set aside`, many: true }]),
  ];
  if (kinds.length === 0) return null;
  const many = kinds.length > 1 || kinds[0].many;
  return { title: listed(kinds.map((kind) => kind.title)), which: `${listed(kinds.map((kind) => kind.which))} ${many ? 'follow' : 'follows'}` };
}

/**
 * Which of the step's fields this is, and the notices that follow them,
 * where any do; nothing where it is the one stop.
 * @param {number} at @param {number} count @param {string|null} then @returns {string}
 */
function whichField(at, count, then) {
  const follow = then === null ? '' : `; ${then}`;
  if (count === 1) return then === null ? '' : `One field${follow}. `;
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
  if ('setAside' in asked) return setAsideGate(asked);
  const conflict = asked;
  const inStep = conflicts.filter((c) => c.uncommitted === conflict.uncommitted);
  const fields = /** @type {FieldConflict[]} */ (inStep.filter((c) => !isNotice(c)));
  const then = following(/** @type {NoticeConflict[]} */ (inStep.filter(isNotice)));
  const step = STEPS[conflict.uncommitted ? 'uncommitted' : 'branch'];
  const which = whichField(fields.indexOf(conflict), fields.length, then?.which ?? null);
  const account = [
    `> ${which}In ${escapeMarkdown(conflict.label.owner)}, ${changed(conflict.label)} ${step.changed}:`,
    '>',
    ...step.sides.map(([, side, , who]) => `> - ${who}: ${escapeMarkdown(shown(conflict[side]))}`),
    '>',
    '> The engine takes a field from one side only where the other left it alone or set it the same, so it stops here for you to pick.',
  ];
  const rows = step.sides.map(([key, side, whose]) => cmdOption(key, null, { head: escapeMarkdown(clipped(shown(conflict[side]), ROW_VALUE_MAX)), tail: whose }, picking(key, conflict)));
  return [
    dataSection([`choice: ${choiceId(conflict)}`]),
    section('DISPLAY: state merge stop', emitAs('properties'), `⚑ The state merge stopped: ${step.title(fields.length)}${then === null ? '' : `, and ${then.title}`}`),
    section('DISPLAY: state merge account', emitAs('markdown'), account.join('\n')),
    section('MENU: state merge gate', MENU_INSTRUCTION, menu('', rows, { question: question(conflict.label) })),
  ].join('\n');
}

module.exports = { stateMergeGate };
