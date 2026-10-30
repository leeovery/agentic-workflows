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
//   directive passes and how many of its pieces are done.
// - The directive's checklist (checklist.cjs) holds one item, its check,
//   the engine's: done while the check passes, never marked or skipped. Its
//   close records the directive in the migrations record — the one way a
//   directive is recorded — and the next run carries on past it.
// - Boot's stop answers the directive, its file, and its pieces done of all
//   of them, which `render directive-stop` draws (21.10.11).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { directiveStop } = require('./projections/boot.cjs');

// Resolved against this file, so it works wherever the skill tree is installed.
const MIGRATE_SCRIPTS = path.resolve(__dirname, '..', '..', '..', 'leeway-migrate', 'scripts');
const MIGRATE_CJS = path.join(MIGRATE_SCRIPTS, 'migrate.cjs');
const MIGRATIONS = path.join(MIGRATE_SCRIPTS, 'migrations');

// The record of the migrations applied, state-relative, which the runner
// writes and a directive's close appends to.
const MIGRATIONS_RECORD = '.state/migrations';

const DIRECTIVE_ID = /^([0-9]+)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MIGRATE_USAGE = 'migrate check <id>';

/** A directive the migrations hold: its id, the number its record line is, and its two files. @typedef {{id: string, number: string, file: string, check: string}} Directive */

/** One piece of a directive's work, and what it still lacks. @typedef {{name: string, problems: string[]}} Piece */

/**
 * A directive's check run: whether it passes, its pieces done of all of
 * them, what one piece is called, and each piece not done.
 * @typedef {{directive: string, passed: boolean, done: number, of: number, counts: string, unfinished: Piece[]}} Checked
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

/**
 * Run the check of the directive `id` against the project at `cwd`. Refuses
 * a check that will not load, exports another shape, fails, or answers
 * anything but its pieces.
 * @param {string} cwd @param {string} id
 * @returns {Checked}
 */
function checkDirective(cwd, id) {
  const { check } = directiveOf(id);
  /** @type {{counts?: unknown, check?: unknown}} */
  let checker;
  try {
    checker = require(check);
  } catch (err) {
    throw new Error(`${id}'s check could not be loaded from ${check}: ${messageOf(err)}`);
  }
  const { counts } = checker;
  if (typeof checker.check !== 'function' || typeof counts !== 'string' || counts.trim() === '') {
    throw new Error(`${id}'s check exports no check() beside what it counts — it exports { counts, check({ projectDir, stateDir }) }`);
  }
  let pieces;
  try {
    pieces = checker.check({ projectDir: codeRoot(cwd), stateDir: stateRoot(cwd) });
  } catch (err) {
    throw new Error(`${id}'s check failed: ${messageOf(err)}`);
  }
  if (!Array.isArray(pieces) || !pieces.every(isPiece)) throw new Error(`${id}'s check answered no list of { name, problems }`);
  const unfinished = pieces.filter((piece) => piece.problems.length > 0);
  return { directive: id, passed: unfinished.length === 0, done: pieces.length - unfinished.length, of: pieces.length, counts, unfinished };
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
 * pieces done of all of them.
 * @param {string} cwd @param {string} id
 * @returns {{id: string, file: string, done: number, of: number}}
 */
function directiveStopped(cwd, id) {
  const { done, of } = checkDirective(cwd, id);
  return { id, file: directiveOf(id).file, done, of };
}

/**
 * `render directive-stop --directive <id>`: the screen of boot's stop at it.
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function directiveStopSurface(cwd, args) {
  const id = args.directive;
  if (id === undefined) throw new Error('render directive-stop: --directive <id> names the directive boot stopped at');
  const { done, of, counts } = checkDirective(cwd, id);
  return directiveStop({ step: id.replace(/^[0-9]+-/, '').replace(/-/g, ' '), done, of, counts });
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

module.exports = { MIGRATE_CJS, MIGRATIONS_RECORD, MIGRATE_USAGE, directiveOf, checkDirective, recordDirective, directiveStopped, directiveStopSurface, runMigrateVerb };
