'use strict';

// ---------------------------------------------------------------------------
// The conformance table of a phase landed, then taking more (7.2.23), shared
// by the suites that run it, a way of landing each
// (test-engine-landing-conformance-again-*.cjs): phase 4 of tasks 4.1, of
// two commits, and 4.2, cut from it, opened and landed by one way (`WAYS`),
// the person's own commit made on main before 4.1 was cut, and on 4.1's
// branch below its first commit — neither any task's work (R32) — then
// each of the way's rows (`ROWS`) — a task of it changed after its
// landing, however its branch moved on, a later task built on that change,
// or the change carrying a later task's work; tasks numbered into it
// since; and a task changed after a later landing. Every row's whole
// answer is alike on each driver (`rowAgain`, against `answers`): each task
// waiting on the phase not landed; a later task built on a change not
// landed refused until it lands, naming the verb that lands it, nothing
// moved, and opening onto main once it has; `open` answering `already` for
// each task changed, moving nothing, and opening each numbered in since
// onto main or the one before it; `chain` the phase's stack; the close in
// step reading it chained; `phase`, or `finish`, landing what waits, oldest
// first — refused first, nothing moved, where it conflicts with later work
// or carries a later task's work not landed, the way on followed — main on
// the host then holding it, main here at the landing, every task of the
// phase landed; a second `phase` answering `already`; the close in auto
// reading the stack merged; the phase's branch, where the driver keeps
// one, at its landing throughout; and the review's change of the phases to
// 5 holding every file the tasks wrote, the person's own commits beside
// them on main's line, and their copies, in none of its parts. Main merged
// back into each landed task's branch by a merge commit leaves every task
// landed, open and phase answering already, the close done and the
// review's change whole (`mergedBack`); main fast-forwarded into the second
// task's branch past a later phase's landing and the person's own hotfix,
// open answering already between, then a commit on top landed again, draws
// every file in the review's change (`forwardedBack`). Every commit is made
// a second past the last (`spaceCommits`). Names no driver and no tool.
// ---------------------------------------------------------------------------

const path = require('path');

const harness = require('./engine-harness.cjs');
const { UNIT, openArgs, own, cutTask, commitFiles, useLandingWorld, phaseReviewed, finishReady, tasksLandedHere, heldOn, mergedInto, spaceCommits, stepped } = require('./landing-world.cjs');
const names = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const { parseShownTask } = require('../../skills/leeway-engine/scripts/domain/task-id.cjs');
const { changeOf } = require('../../skills/leeway-engine/scripts/domain/review-change.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { git, tip } = harness;

/** A task of the table: its number, type, title and branch. @typedef {{shown: string, type: string, title: string, branch: string}} PhaseTask */

/** @param {string} shown @param {string} title @returns {PhaseTask} */
const phaseTask = (shown, title) => ({ shown, type: 'feat', title, branch: names.taskBranch(parseShownTask(UNIT, shown), 'feat', title) });

const FIRST = phaseTask('4.1', 'Add tip');
const SECOND = phaseTask('4.2', 'Add note');
const THIRD = phaseTask('4.3', 'Add fee');
const FOURTH = phaseTask('4.4', 'Waive fee');
const LATER = phaseTask('5.1', 'Show tip');

/** The tasks phase 4 landed. */
const LANDED = [FIRST, SECOND];

/** The file the first task's last commit writes — so its head, a commit of its own, is no copy of the squash landing the task. */
const LAST_FILE = 'tip-two.txt';

/** The person's own commits beside the tasks, by their subjects: on main before the first task was cut, and on its branch below its first commit. */
const BESIDE = ['my own hotfix', 'my own start'];

/** What a table's suite reads a driver by (`againConformance`). @typedef {ReturnType<typeof againConformance>} Conformance */

/**
 * A landing refused first, nothing moved: its words, whether a refusal says
 * what it should, and the way on followed.
 * @typedef {{words: string, says: (refusal: string) => boolean, follow: (dir: string, conf: Conformance, refusal: string) => void}} RefusedFirst
 */

/**
 * A row of the table, made after phase 4 landed: its words; the tasks of
 * the phase it changes after their landing; the tasks it numbers into the
 * phase since, each with the branch it opens onto; a task of phase 5 built
 * on the change, if any; the verb that lands what waits; the files main
 * then holds; that landing's refusal first, if any; and the change made.
 * @typedef {{
 *   change: string, changed: PhaseTask[], fresh: [PhaseTask, string][], later?: PhaseTask,
 *   lands: 'phase'|'finish', holds: [string, string][], first?: RefusedFirst, make: (dir: string, conf: Conformance) => void,
 * }} Row
 */

/** A commit on top of a task's branch, writing `file`. @param {string} dir @param {PhaseTask} task @param {string} file */
const onTop = (dir, task, file) => commitFiles(dir, task.branch, task.branch, { [file]: 'more\n' });

/** The refusal of a task whose branch holds task `held`'s work, not landed. @param {PhaseTask} task @param {PhaseTask} held */
const holdsUnlanded = (task, held) => `land: task ${task.shown}'s branch ${task.branch} holds the work of task ${held.shown}, not landed — `
  + `land it first with \`land phase ${UNIT} ${parseShownTask(UNIT, held.shown).phase}\`, or cut the branch again from main without it, and land again`;

/**
 * The table's rows, by their names: the first task changed by its own
 * commit and the person's beside it, a later task built on that change
 * (R29, R31); the first changed by the person's own commit alone, a later
 * task built on it, which holds that commit as the first's work (R29,
 * R31); the first changed carrying a later task's work, opened and
 * not landed (R31); tasks numbered into the phase since it landed (R30);
 * both tasks changed, the second restacked onto the first's change, beside
 * a task numbered in; the second changed by the person's own commit alone
 * after the first was landed again; and the first's last commit made again
 * after later work rewrote a line of it.
 * @type {Record<string, Row>}
 */
const ROWS = {
  built: {
    change: 'a commit on top of its branch and the person\'s own beside it, a task of a later phase built on them',
    changed: [FIRST],
    fresh: [],
    later: LATER,
    lands: 'phase',
    holds: [['tip-more.txt', 'more\n'], ['aside.txt', 'aside\n']],
    make: (dir) => {
      onTop(dir, FIRST, 'tip-more.txt');
      commitFiles(dir, FIRST.branch, FIRST.branch, { 'aside.txt': 'aside\n' }, { message: 'work by hand' });
      cutTask(dir, LATER.shown, LATER.type, LATER.title, FIRST.branch, { 'show.txt': 'show\n' });
      mergedInto(dir, LATER.branch);
    },
  },
  aside: {
    change: 'the person\'s own commit alone on top of its branch, a task of a later phase built on it',
    changed: [FIRST],
    fresh: [],
    later: LATER,
    lands: 'phase',
    holds: [['aside.txt', 'aside\n']],
    make: (dir) => {
      commitFiles(dir, FIRST.branch, FIRST.branch, { 'aside.txt': 'aside\n' }, { message: 'work by hand' });
      cutTask(dir, LATER.shown, LATER.type, LATER.title, FIRST.branch, { 'show.txt': 'show\n' });
      mergedInto(dir, LATER.branch);
    },
  },
  carrying: {
    change: 'a commit on top of its branch, a later task\'s work, opened and not landed, merged into it',
    changed: [FIRST],
    fresh: [],
    lands: 'phase',
    holds: [['tip-more.txt', 'more\n'], ['show.txt', 'show\n']],
    first: {
      words: 'as it carries the later task\'s work, naming the land phase that lands it',
      says: (refusal) => refusal === holdsUnlanded(FIRST, LATER),
      follow: (dir, conf) => {
        phaseReviewed(dir, 5, 'step');
        conf.ok(dir, ['land', 'phase', UNIT, '5']);
      },
    },
    make: (dir, conf) => {
      onTop(dir, FIRST, 'tip-more.txt');
      conf.ok(dir, openArgs(cutTask(dir, LATER.shown, LATER.type, LATER.title, 'main', { 'show.txt': 'show\n' })));
      mergedInto(dir, FIRST.branch, LATER.branch);
    },
  },
  numbered: {
    change: 'tasks numbered into it since, one cut from main and one from it',
    changed: [],
    fresh: [[THIRD, 'main'], [FOURTH, THIRD.branch]],
    lands: 'phase',
    holds: [['fee.txt', 'fee\n'], ['waive.txt', 'waive\n']],
    make: (dir) => {
      cutTask(dir, THIRD.shown, THIRD.type, THIRD.title, 'main', { 'fee.txt': 'fee\n' });
      cutTask(dir, FOURTH.shown, FOURTH.type, FOURTH.title, THIRD.branch, { 'waive.txt': 'waive\n' });
    },
  },
  restacked: {
    change: 'a commit on top of the first\'s branch, the second\'s restacked onto it, then a commit on top of the second\'s, and a task numbered in since from main',
    changed: [FIRST, SECOND],
    fresh: [[THIRD, 'main']],
    lands: 'phase',
    holds: [['tip-more.txt', 'more\n'], ['note-more.txt', 'more\n'], ['fee.txt', 'fee\n']],
    make: (dir) => {
      onTop(dir, FIRST, 'tip-more.txt');
      commitFiles(dir, SECOND.branch, FIRST.branch, { 'note.txt': 'note\n' });
      onTop(dir, SECOND, 'note-more.txt');
      cutTask(dir, THIRD.shown, THIRD.type, THIRD.title, 'main', { 'fee.txt': 'fee\n' });
    },
  },
  after: {
    change: 'the second task changed by the person\'s own commit alone after the first was landed again',
    changed: [SECOND],
    fresh: [],
    lands: 'phase',
    holds: [['tip-more.txt', 'more\n'], ['note-more.txt', 'more\n']],
    make: (dir, conf) => {
      onTop(dir, FIRST, 'tip-more.txt');
      conf.ok(dir, ['land', 'phase', UNIT, '4']);
      commitFiles(dir, SECOND.branch, SECOND.branch, { 'note-more.txt': 'more\n' }, { message: 'work by hand' });
    },
  },
  reworked: {
    change: 'later work rewriting the line of its last commit, then that commit made again',
    changed: [FIRST],
    fresh: [],
    lands: 'finish',
    holds: [['tip-more.txt', 'more\n'], [LAST_FILE, 'two, reworked\n']],
    first: {
      words: `on its conflict with the later work at ${LAST_FILE}`,
      says: (refusal) => new RegExp(`conflicts with (origin/)?main at ${LAST_FILE}, so `).test(refusal),
      follow: (dir, conf, refusal) => {
        const [, from, into] = /merge (\S+) into (\S+), settling the conflict/.exec(refusal) ?? [];
        mergedInto(dir, into, from, 'theirs');
      },
    },
    make: (dir, conf) => {
      conf.ok(dir, openArgs(cutTask(dir, '5.1', 'feat', 'Rework tip', 'main', { [LAST_FILE]: 'two, reworked\n' })));
      conf.ok(dir, ['land', 'phase', UNIT, '5']);
      commitFiles(dir, FIRST.branch, `${FIRST.branch}^`, { [LAST_FILE]: 'two\n', 'tip-more.txt': 'more\n' });
    },
  },
};

/** A way phase 4 lands, by the suite's name for it: its words, the landing, and the rows run on it. @typedef {{title: string, land: (dir: string, conf: Conformance) => void, rows: (keyof typeof ROWS)[]}} Way */

/** The side's way of landing phase 4 by hand named `how`. @param {string} how @returns {Way['land']} */
const byHand = (how) => (dir, conf) => stepped(() => conf.side.phaseByHand[how](dir, 4));

/**
 * The ways phase 4 lands, by their suites' names: each reads its landing
 * its own way — the phase's branch on main, past later work, or named by
 * its squash, its tasks' content alone, their branches merged, their
 * commits copied, or their commits themselves, fast-forwarded — and runs
 * `built`, or on the person's own message and the fast-forward its twin of
 * the person's commit alone, `aside`, and the rows that read that way: on
 * the fast-forward, the person's own commit on a task's branch past its
 * commits on main, R32's question on main itself.
 * @type {Record<string, Way>}
 */
const WAYS = {
  engine: { title: 'the engine\'s squash', land: (dir, conf) => conf.ok(dir, ['land', 'phase', UNIT, '4']), rows: ['built', 'after'] },
  later: {
    title: 'the engine\'s squash, a later phase landing after it',
    land: (dir, conf) => {
      conf.ok(dir, ['land', 'phase', UNIT, '4']);
      conf.ok(dir, openArgs(cutTask(dir, '3.2', 'feat', 'Add tax', 'main', { 'tax.txt': 'tax\n' })));
      conf.ok(dir, ['land', 'phase', UNIT, '3']);
    },
    rows: ['built', 'numbered'],
  },
  squashed: { title: 'a squash by hand under the default message', land: byHand('a squash under the default message'), rows: ['built', 'reworked'] },
  own: { title: 'a squash by hand under the person\'s own message', land: byHand('a squash under the person\'s own message'), rows: ['aside', 'carrying'] },
  merged: { title: 'a merge commit by hand', land: byHand('a merge commit'), rows: ['built', 'reworked'] },
  rebased: { title: 'a rebase by hand', land: byHand('a rebase'), rows: ['built', 'restacked'] },
  forwarded: { title: 'a fast-forward by hand', land: byHand('a fast-forward'), rows: ['aside', 'after'] },
};

/**
 * What the table reads the driver `name` by, phase 4 landed by the way
 * `way` names: its side; the verbs under the side's environment, each
 * committing a second past the last; and a copy of the landing world at
 * each call, readied for the driver, the phase cut, opened and landed so —
 * built once per process, every commit a second past the last.
 * @param {string} name @param {keyof typeof WAYS} way
 */
function againConformance(name, way) {
  spaceCommits();
  /** @type {import('./landing-world.cjs').DriverSide} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const conf = {
    side,
    /** A verb that must go through. @param {string} dir @param {string[]} args */
    ok: (dir, args) => stepped(() => harness.ok(dir, args, as)),
    /** A verb that must refuse, its refusal. @param {string} dir @param {string[]} args */
    refuses: (dir, args) => stepped(() => harness.refuses(dir, args, as).error),
    project: () => '',
  };
  conf.project = useLandingWorld(`engine-landing-again-${name}-${way}-`, (dir) => {
    mergedInto(dir, 'main', commitFiles(dir, 'hotfix', 'main', { 'hotfix.txt': 'hotfix\n' }, { message: BESIDE[0] }));
    git(dir, ['branch', '-q', '-D', 'hotfix']);
    side.prepare(dir);
    commitFiles(dir, FIRST.branch, 'main', { 'start.txt': 'start\n' }, { message: BESIDE[1] });
    cutTask(dir, FIRST.shown, FIRST.type, FIRST.title, FIRST.branch, { 'tip.txt': 'tip\n' });
    commitFiles(dir, FIRST.branch, FIRST.branch, { [LAST_FILE]: 'two\n' });
    conf.ok(dir, openArgs(FIRST));
    conf.ok(dir, openArgs(cutTask(dir, SECOND.shown, SECOND.type, SECOND.title, FIRST.branch, { 'note.txt': 'note\n' })));
    WAYS[way].land(dir, conf);
  });
  return conf;
}

/** Every ref of a repository but the state branch's and the remotes' copies, as one text. @param {string} repo */
const refsIn = (repo) => git(repo, ['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter((line) => !/^refs\/(heads\/leeway-state|remotes\/) /.test(line)).join('\n');

/** The refs here and on the repository the driver lands in. @param {Conformance} conf @param {string} dir */
const refsOf = (conf, dir) => `${refsIn(dir)}\n${refsIn(conf.side.on(dir))}`;

/**
 * The review's change of the phases to 5 (review-change.cjs), against the
 * files the tasks wrote, `holds` among them: whether each of the person's
 * own commits beside the tasks, and each copy of it, on main's line here
 * lies in none of its parts; and those files no part holds.
 * @param {string} dir @param {Row['holds']} holds
 */
function reviewed(dir, holds) {
  const parts = changeOf(dir, UNIT, 5, null, projectRepos(dir)).holding.flatMap((change) => change.parts);
  const inParts = new Set(parts.flatMap(({ from, to }) => git(dir, ['rev-list', '--first-parent', `${from}..${to}`]).split('\n').filter(Boolean)));
  const onMain = git(dir, ['log', '--first-parent', '--format=%H %s', 'main']).split('\n').filter(Boolean).map((line) => [line.slice(0, 40), line.slice(41)]);
  const held = new Set(parts.flatMap(({ from, to }) => git(dir, ['diff', '--name-only', from, to]).split('\n').filter(Boolean)));
  const written = ['tip.txt', LAST_FILE, 'note.txt', ...holds.map(([file]) => file)];
  return { apart: BESIDE.map((subject) => onMain.filter(([, said]) => said === subject).every(([sha]) => !inParts.has(sha))), missing: written.filter((file) => !held.has(file)) };
}

/** Where phase 4's branch stands here, empty where the driver keeps none. @param {string} dir */
const phaseBranchAt = (dir) => git(dir, ['for-each-ref', '--format=%(objectname)', `refs/heads/${names.phaseBranch(UNIT, 4)}`]).trim();

/** Phase 4's close's stack-merged item, the unit building in `position`. @param {Conformance} conf @param {string} dir @param {'auto'|'step'} position */
function stackMerged(conf, dir, position) {
  phaseReviewed(dir, 4, position);
  return conf.ok(dir, ['checklist', 'show', 'phase-close', UNIT, '4']).items.find((/** @type {{key: string}} */ item) => item.key === 'stack-merged').state;
}

/** The tasks a row leaves waiting on phase 4, in their order. @param {Row} row */
const waiting = (row) => [...row.changed, ...row.fresh.map(([task]) => task)].sort((a, b) => a.shown.localeCompare(b.shown));

/** Every task of phase 4 once a row is made, by number. @param {Row} row */
const phaseTasks = (row) => [...new Set([...LANDED, ...waiting(row)])].map(({ shown }) => shown);

/** A refusal, and whether it moved anything. @param {Conformance} conf @param {string} dir @param {string[]} args */
function refusedHere(conf, dir, args) {
  const before = refsOf(conf, dir);
  const refusal = conf.refuses(dir, args);
  return { refusal, moved: refsOf(conf, dir) !== before };
}

/**
 * The verb that lands what waits — refused first where the row says so,
 * the way on then followed — and the tasks it merged, by phase for finish.
 * @param {Conformance} conf @param {string} dir @param {Row} row
 */
function landed(conf, dir, { lands, first }) {
  const args = lands === 'phase' ? ['land', 'phase', UNIT, '4'] : ['land', 'finish', UNIT];
  let refused = null;
  if (first !== undefined) {
    const { refusal, moved } = refusedHere(conf, dir, args);
    refused = { said: first.says(refusal), moved };
    first.follow(dir, conf, refusal);
  }
  const answer = own(conf.ok(dir, args));
  return { refused, merged: lands === 'phase' ? answer.merged : answer.phases.map((/** @type {{merged: string[]}} */ { merged }) => merged) };
}

/**
 * A row of the table run on a driver: the row made, then the whole answer
 * the verbs give (the header's) — the later task opened once the change
 * landed, main merged back into its branch first, as Claude merges it.
 * @param {Conformance} conf @param {Row} row
 */
function rowAgain(conf, row) {
  const dir = conf.project();
  const kept = phaseBranchAt(dir);
  row.make(dir, conf);
  const waits = waiting(row);
  const heldBack = row.later === undefined ? null : refusedHere(conf, dir, openArgs(row.later));
  const before = tasksLandedHere(dir, waits.map(({ shown }) => shown));
  const bases = row.fresh.map(([task]) => own(conf.ok(dir, openArgs(task))).base);
  const refs = refsOf(conf, dir);
  const already = row.changed.map((task) => {
    const opened = conf.ok(dir, openArgs(task));
    return [opened.already, opened.repos];
  });
  const { stack } = own(conf.ok(dir, ['land', 'chain', UNIT, waits[waits.length - 1].shown]));
  const moved = refsOf(conf, dir) !== refs;
  const step = stackMerged(conf, dir, 'step');
  if (row.lands === 'finish') finishReady(dir);
  const { refused, merged } = landed(conf, dir, row);
  const after = {
    landed: tasksLandedHere(dir, phaseTasks(row)),
    holds: row.holds.map(([file]) => heldOn(conf.side.on(dir), file)),
    here: tip(dir, 'main') === conf.side.defaultTip(dir),
    again: conf.ok(dir, ['land', 'phase', UNIT, '4']).already,
    auto: stackMerged(conf, dir, 'auto'),
    review: reviewed(dir, row.holds),
  };
  if (row.later !== undefined) mergedInto(dir, row.later.branch);
  const later = row.later === undefined ? null : own(conf.ok(dir, openArgs(row.later))).base;
  return { heldBack, before, bases, already, moved, stack, step, refused, merged, ...after, later, kept: phaseBranchAt(dir) === kept };
}

/** What `rowAgain` answers for a row, on every driver. @param {Row} row */
function answers(row) {
  const waits = waiting(row).map(({ shown }) => shown);
  const heldBack = row.later === undefined ? null : { refusal: holdsUnlanded(row.later, FIRST), moved: false };
  return {
    heldBack,
    before: waits.map(() => false),
    bases: row.fresh.map(([, base]) => base),
    already: row.changed.map(() => [true, []]),
    moved: false,
    stack: phaseTasks(row),
    step: 'done',
    refused: row.first === undefined ? null : { said: true, moved: false },
    merged: row.lands === 'phase' ? waits : [waits],
    landed: phaseTasks(row).map(() => true),
    holds: row.holds.map(([, text]) => text),
    here: true,
    again: true,
    auto: 'done',
    review: { apart: BESIDE.map(() => true), missing: [] },
    later: row.later === undefined ? null : 'main',
    kept: true,
  };
}

/** Main here pushed to the host the driver lands on, where that is another repository. @param {Conformance} conf @param {string} dir */
function onHost(conf, dir) {
  if (conf.side.on(dir) !== dir) git(dir, ['push', '-q', 'origin', 'main']);
}

/**
 * Main merged back into each landed task's branch by a merge commit, as
 * Claude merges it, nothing else changed (R25, R29): whether each task
 * reads landed; `land open` answering `already` for each, and whether it
 * moved anything; a second `land phase` merged already; the close in step
 * reading the stack merged; and the review's change (`reviewed`).
 * @param {Conformance} conf
 */
function mergedBack(conf) {
  const dir = conf.project();
  for (const { branch } of LANDED) mergedInto(dir, branch, 'main', 'ours', false);
  const refs = refsOf(conf, dir);
  const already = LANDED.map((task) => conf.ok(dir, openArgs(task)).already === true);
  return {
    landed: tasksLandedHere(dir, LANDED.map(({ shown }) => shown)),
    already,
    moved: refsOf(conf, dir) !== refs,
    again: conf.ok(dir, ['land', 'phase', UNIT, '4']).already === true,
    step: stackMerged(conf, dir, 'step'),
    review: reviewed(dir, []),
  };
}

/** What `mergedBack` answers, on every way and driver. */
const MERGED_BACK = { landed: [true, true], already: [true, true], moved: false, again: true, step: 'done', review: { apart: BESIDE.map(() => true), missing: [] } };

/**
 * A later phase landed past phase 4 and the person's own hotfix on main
 * past it, then main fast-forwarded into the second task's branch, as
 * Claude merges main back (R32, R25): `land open` of the second answering
 * `already`, and whether it moved anything; then a commit on top of it,
 * landed by `land phase`, the tasks it merged; every task landed; and the
 * review's change (`reviewed`) — the hotfix fast-forwarded past the second
 * task's commits read as its work, as decided.
 * @param {Conformance} conf
 */
function forwardedBack(conf) {
  const dir = conf.project();
  conf.ok(dir, openArgs(cutTask(dir, LATER.shown, LATER.type, LATER.title, 'main', { 'show.txt': 'show\n' })));
  phaseReviewed(dir, 5, 'step');
  conf.ok(dir, ['land', 'phase', UNIT, '5']);
  commitFiles(dir, 'main', 'main', { 'later.txt': 'later\n' }, { message: 'my later hotfix' });
  onHost(conf, dir);
  mergedInto(dir, SECOND.branch);
  const refs = refsOf(conf, dir);
  const opened = conf.ok(dir, openArgs(SECOND)).already === true;
  const moved = refsOf(conf, dir) !== refs;
  onTop(dir, SECOND, 'note-more.txt');
  phaseReviewed(dir, 4, 'step');
  const { merged } = own(conf.ok(dir, ['land', 'phase', UNIT, '4']));
  return { opened, moved, merged, landed: tasksLandedHere(dir, [...LANDED, LATER].map(({ shown }) => shown)), review: reviewed(dir, [['note-more.txt', 'more\n'], ['show.txt', 'show\n']]) };
}

/** What `forwardedBack` answers, on every driver. */
const FORWARDED_BACK = { opened: true, moved: false, merged: [SECOND.shown], landed: [true, true, true], review: { apart: BESIDE.map(() => true), missing: [] } };

/** A table suite's names: its describe's, for the driver `name` and the way `way`, and a row's. */
const AGAIN = {
  /** @param {string} name @param {keyof typeof WAYS} way */
  title: (name, way) => `the ${name} landing driver, phase 4 landed by ${WAYS[way].title}, then taking more (7.2.23)`,
  /** @param {Row} row */
  test: ({ change, fresh, later, lands, first }) => [
    `${change}:`,
    later === undefined ? '' : ' the later task refused until the change lands, naming land phase, nothing moved;',
    fresh.length === 0 ? ' land open answers already, moving nothing,' : ' land open opens each onto main or the one before it,',
    ` land chain answers the phase's stack, the close in step reads it chained, and land ${lands} lands what waits`,
    first === undefined ? '' : `, refused first ${first.words}, nothing moved, the way on followed`,
    ' — main on the host holding it, main here at the landing, every task of the phase landed, a second land phase merged already, the close in auto done, the review\'s change holding every file the tasks wrote and none of the person\'s own commits beside them',
    later === undefined ? '' : ', the later task then opening onto main',
    ', the phase\'s branch at its landing throughout',
  ].join(''),
  mergedBack: 'main merged back into each task\'s branch by a merge commit: each task landed, land open answering already for each, moving nothing, a second land phase merged already, the close in step done, the review\'s change holding every file the tasks wrote and none of the person\'s own commits beside them (R25, R29)',
  forwardedBack: 'a later phase landed and the person\'s own hotfix on main past it, then main fast-forwarded into the second task\'s branch: land open answering already for it, moving nothing; a commit on top of it then landed again by land phase, every task landed, the review\'s change holding every file the tasks wrote, the later phase\'s and the change\'s (R32, R25)',
};

module.exports = { WAYS, ROWS, AGAIN, againConformance, rowAgain, answers, mergedBack, MERGED_BACK, forwardedBack, FORWARDED_BACK };
