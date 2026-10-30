'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's side of the migration's directives (21.10). A
// directive is a migration of instructions the start session carries out,
// `NNN-{slug}.md` among the migrations, its check beside it,
// `NNN-{slug}.check.cjs`; both are the runner's contract (the header of
// leeway-migrate/scripts/migrate.cjs). The runner stops at a directive the
// migrations record does not hold, and so does boot (boot.cjs): no session
// works in the project until the directive is done.
//
// - `migrate check <id>` runs the directive's check: each piece of its work
//   done, or what it still lacks. It reads, and answers whether the
//   directive passes and how many of its pieces are done. A directive whose
//   own steps end in raises (079's points no source settles) exports them
//   beside its check, `raises()`; once it passes, the answer lists each
//   still to raise — its question open, no raise of it sealed in the calling
//   conversation (raise.cjs) — so a session compacted part-way reads them
//   back (21.6.10).
// - The directive's checklist (checklist.cjs) holds one item, its check,
//   the engine's: done while the check passes, never marked or skipped. Its
//   close records the directive in the migrations record — the one way a
//   directive is recorded — and the next run carries on past it.
// - Boot's stop answers the directive, its file, and its pieces done of all
//   of them, which `render directive-stop` draws (21.10.11). A session that
//   died part-way may leave what the check trips on (21.10.9): the stop then
//   answers without the counts, and `migrate check` names what failed.
// - Known edges: held commits and the trust log's silence key on the state
//   branch having no commit yet (state-worktree.cjs, trust-log.cjs), which
//   only the reshape's migration leaves; a directive met later, on a branch
//   with commits, would commit and log as any verb does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { directiveStop } = require('./projections/boot.cjs');
const { projectName } = require('./state-checks.cjs');
const { unraised } = require('./raise.cjs');

// Resolved against this file, so it works wherever the skill tree is installed.
const MIGRATE_SCRIPTS = path.resolve(__dirname, '..', '..', '..', 'leeway-migrate', 'scripts');
const MIGRATE_CJS = path.join(MIGRATE_SCRIPTS, 'migrate.cjs');
const MIGRATIONS = path.join(MIGRATE_SCRIPTS, 'migrations');

// The record of the migrations applied, state-relative, which the runner
// writes and a directive's close appends to.
const MIGRATIONS_RECORD = '.state/migrations';

// Where the runner journals what its runs owe the run that completes,
// state-relative: in the cache, which no state commit takes.
const MIGRATION_JOURNALS = '.cache/migrate';

const DIRECTIVE_ID = /^([0-9]+)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MIGRATE_USAGE = 'migrate check <id>';

/** A directive the migrations hold: its id, the number its record line is, and its two files. @typedef {{id: string, number: string, file: string, check: string}} Directive */

/** One piece of a directive's work, and what it still lacks. @typedef {{name: string, problems: string[]}} Piece */

/** What one of a directive's pieces is called, and many of them. @typedef {{one: string, many: string}} Counts */

/** A point a directive's own steps raise: the place it is raised at, the question it answers, and the question's text. @typedef {{place: string, answers: string, text: string}} Point */

/**
 * A directive's check as its module exports it: what its pieces are called,
 * what a piece done has, the check, and any points its own steps raise.
 * @typedef {{
 *   counts: Counts, done: string, check: (dirs: {projectDir: string, stateDir: string}) => unknown, raises?: (dirs: {projectDir: string, stateDir: string}) => unknown,
 * }} Check
 */

/**
 * A directive's check run: whether it passes, its pieces done of all of
 * them, what its pieces are called, each piece not done, and, once it
 * passes, each point its steps raise that is still to raise.
 * @typedef {{directive: string, passed: boolean, done: number, of: number, counts: Counts, unfinished: Piece[], raise?: Point[]}} Checked
 */

/**
 * Where a directive stands, for its stop: its pieces done of all of them,
 * what they are called, and what a piece done has.
 * @typedef {{done: number, of: number, counts: Counts, says: string}} Progress
 */

/**
 * The directive `id` names. Refuses an id of another shape, and one no
 * directive among the migrations has.
 * @param {string} id
 * @returns {Directive}
 */
function directiveOf(id) {
  const named = DIRECTIVE_ID.exec(id);
  if (named === null) throw new Error(`"${id}" is no directive's id — a directive's id is its file's name, NNN-{slug}`);
  const file = path.join(MIGRATIONS, `${id}.md`);
  if (!fs.existsSync(file)) throw new Error(`there is no directive ${id}`);
  return { id, number: named[1], file, check: path.join(MIGRATIONS, `${id}.check.cjs`) };
}

/** @param {unknown} piece @returns {piece is Piece} */
function isPiece(piece) {
  return isObject(piece) && typeof piece.name === 'string' && Array.isArray(piece.problems) && piece.problems.every((problem) => typeof problem === 'string');
}

/** @param {unknown} words @returns {words is string} */
const isWords = (words) => typeof words === 'string' && words.trim() !== '';

/** @param {unknown} point @returns {point is Point} */
const isPoint = (point) => isObject(point) && isWords(point.place) && isWords(point.answers) && typeof point.text === 'string';

/**
 * Whether a check module exports the check's shape: `counts`, `{ one, many }`,
 * `done`, and `check()`.
 * @param {Record<string, unknown>} checker @returns {checker is Check}
 */
function isCheck(checker) {
  const { counts, done, check } = checker;
  return typeof check === 'function' && isObject(counts) && isWords(counts.one) && isWords(counts.many) && isWords(done);
}

/**
 * The check of the directive `id`, loaded. Refuses a check that will not
 * load, and one that exports another shape.
 * @param {string} id @returns {Check}
 */
function loadCheck(id) {
  const { check } = directiveOf(id);
  /** @type {Record<string, unknown>} */
  let checker;
  try {
    checker = require(check);
  } catch (err) {
    throw new Error(`${id}'s check could not be loaded from ${check}: ${messageOf(err)}`);
  }
  if (!isCheck(checker)) {
    throw new Error(`${id}'s check exports no check() beside what it counts — it exports { counts: { one, many }, done, check({ projectDir, stateDir }) }`);
  }
  return checker;
}

/**
 * Run the check of the directive `id` against the project at `cwd`. Refuses
 * a check that will not load, exports another shape, fails, or answers
 * anything but its pieces.
 * @param {string} cwd @param {string} id
 * @returns {Checked}
 */
function checkDirective(cwd, id) {
  const { counts, check, raises } = loadCheck(id);
  const dirs = { projectDir: codeRoot(cwd), stateDir: stateRoot(cwd) };
  let pieces;
  try {
    pieces = check(dirs);
  } catch (err) {
    throw new Error(`${id}'s check failed: ${messageOf(err)}`);
  }
  if (!Array.isArray(pieces) || !pieces.every(isPiece)) throw new Error(`${id}'s check answered no list of { name, problems }`);
  const unfinished = pieces.filter((piece) => piece.problems.length > 0);
  const passed = unfinished.length === 0;
  const checked = { directive: id, passed, done: pieces.length - unfinished.length, of: pieces.length, counts: { one: counts.one, many: counts.many }, unfinished };
  return passed && typeof raises === 'function' ? { ...checked, raise: unraised(cwd, pointsOf(id, raises, dirs)) } : checked;
}

/**
 * The points a directive's own steps raise, as its check module answers
 * them. Refuses an answer that fails, and one that is no list of points.
 * @param {string} id @param {(dirs: {projectDir: string, stateDir: string}) => unknown} raises @param {{projectDir: string, stateDir: string}} dirs
 * @returns {Point[]}
 */
function pointsOf(id, raises, dirs) {
  let points;
  try {
    points = raises(dirs);
  } catch (err) {
    throw new Error(`${id}'s points to raise could not be read: ${messageOf(err)}`);
  }
  if (!Array.isArray(points) || !points.every(isPoint)) throw new Error(`${id}'s check answered its points to raise as no list of { place, answers, text }`);
  return points;
}

/**
 * Where the directive `id` stands, or null where its check cannot say — a
 * session that died part-way may leave what the check trips on, and
 * `migrate check` shows the session why.
 * @param {string} cwd @param {string} id
 * @returns {Progress|null}
 */
function progressOf(cwd, id) {
  try {
    const { done, of, counts } = checkDirective(cwd, id);
    return { done, of, counts, says: loadCheck(id).done };
  } catch {
    return null;
  }
}

/**
 * Record the directive in the migrations record, where it is not there yet.
 * @param {string} cwd @param {Directive} directive
 */
function recordDirective(cwd, { number }) {
  const record = statePath(cwd, MIGRATIONS_RECORD);
  const held = fs.existsSync(record) ? fs.readFileSync(record, 'utf8') : '';
  if (held.split('\n').includes(number)) return;
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.appendFileSync(record, `${held === '' || held.endsWith('\n') ? '' : '\n'}${number}\n`);
}

/**
 * Boot's stop at the directive `id`: the directive, its file, and its
 * pieces done of all of them, where its check can say.
 * @param {string} cwd @param {string} id
 * @returns {{id: string, file: string, done?: number, of?: number}}
 */
function directiveStopped(cwd, id) {
  const progress = progressOf(cwd, id);
  return { id, file: directiveOf(id).file, ...(progress === null ? {} : { done: progress.done, of: progress.of }) };
}

/**
 * `render directive-stop --directive <id>`: the screen of boot's stop at it.
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function directiveStopSurface(cwd, args) {
  const id = args.directive;
  if (id === undefined) throw new Error('render directive-stop: --directive <id> names the directive boot stopped at');
  directiveOf(id);
  return directiveStop({ project: projectName(cwd), step: id.replace(/^[0-9]+-/, '').replace(/-/g, ' '), progress: progressOf(cwd, id) });
}

/**
 * `migrate check <id>`: the directive's check run.
 * @param {string} cwd @param {string[]} argv
 * @returns {Checked}
 */
function runMigrateVerb(cwd, argv) {
  const [verb, id, ...rest] = argv;
  if (verb !== 'check' || id === undefined || rest.length > 0) throw new Error(`Usage: engine ${MIGRATE_USAGE}`);
  try {
    return checkDirective(cwd, id);
  } catch (err) {
    throw new Error(`migrate check: ${messageOf(err)}`);
  }
}

module.exports = { MIGRATE_CJS, MIGRATIONS_RECORD, MIGRATION_JOURNALS, MIGRATE_USAGE, directiveOf, isCheck, checkDirective, recordDirective, directiveStopped, directiveStopSurface, runMigrateVerb };
