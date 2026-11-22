'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's side of the migration's directives (21.10). A
// directive is a migration of instructions the start session carries out,
// `NNN-{slug}.md` among the migrations, its check beside it,
// `NNN-{slug}.check.cjs`; both are the runner's contract (the header of
// ledger-migrate/scripts/migrate.cjs). The runner stops at a directive the
// migrations record does not hold, and so does boot (boot.cjs): no session
// works in the project until the directive is done.
//
// - `migrate check <id>` runs the directive's check: each piece of its work
//   done, or what it still lacks, and where the check names one, the step
//   the session takes on it next (079's). It reads, and answers whether the
//   directive passes and how many of its pieces are done, then re-stamps
//   the calling session's row at the migration's place where it carries the
//   migration on (presence.cjs). A directive whose own steps end in raises
//   (079's points no source settles) exports them beside its check,
//   `raises()`; once it passes, the answer lists each still to raise — its
//   question open, no raise of it sealed in the calling conversation
//   (raise.cjs) — so a session compacted part-way reads them back (21.6.10).
// - The runner asks a directive's pieces (`piecesOf`) as it meets it: a
//   directive whose check answers none leaves the session nothing to do,
//   and the runner records it by its ID, as it records any migration
//   (21.4.3).
// - The directive's checklist (checklist.cjs) holds one item, its check,
//   the engine's: done while the check passes, never marked or skipped. Its
//   close records the directive in the migrations record — the one way a
//   directive is recorded — and the next run carries on past it.
// - Boot's stop answers the directive, its file, and its pieces done of all
//   of them, where its check can say. Which screen it draws follows from
//   them: with none done, the migration at work, `render
//   directive-arrival` — what the step does, in its check's words (`does`),
//   and the person waiting it out; with some done, the migration part-way,
//   `render directive-carry-on` — what it finished, kept, and this session
//   carrying it on. A session that died part-way may leave what the check
//   trips on (21.10.9): the stop then answers without the counts, drawing
//   the migration at work, and `migrate check` names what failed.
// - `render migration-leaving <unit> --directive <id>` draws the mixed
//   unit's question (21.8.10) from what the directive's check answers
//   leaves a building unit (`leavingOf`, 080's): how many of its topics its
//   joined specs cover, and those that leave it, each by its title, grouped
//   by where it stands. Refused for a directive whose check answers no such
//   thing, and for a unit with no topic leaving it.
// - Boot's `taken` stop, where another live session carries the migration
//   on (P7), answers the step it carries on from — a directive, or the
//   checks before the reshape's move — and the whole seconds since it was
//   last active, which `render migration-taken-stop` draws: that step's own
//   screen, saying this session stops there.
// - `migrate checked` records the checks the chain before the reshape
//   handed back as made: the line the runner's stop before the move waits
//   on (old-layout.cjs, `CHECKS_DONE`), appended to the migrations record
//   where it is not there yet, as a directive's close records it — so a
//   session killed before it meets the stop again, and the next run marks
//   those checks made, for the review at the migration's end, and carries
//   on past it. It re-stamps the calling session's row at the migration's
//   place as `migrate check` does.
// - `migrate review` is what the migration review reads before the gate
//   whose yes makes the migration's commit (migration-commit.cjs): the
//   state's folder and the code side's, absolute, so the review reads them
//   from any checkout; and, while the reshape finishes, what its summary is
//   written from, since the state branch's first commit takes the whole
//   state (21.9.4) — the commits the yes still makes, the units moved, the
//   records carried — a topic's, and a unit's own — the code files the
//   commit takes, and each correction
//   the migration made, by its unit:
//   the move's, where the registry typed a unit otherwise than its
//   manifest, as the move journaled them (078, `move.json` among the
//   journals), then the cut and the merges', where a unit's manifest and
//   its tracker disagreed, as each unit's cut marked it (cut-migrating.cjs).
// - `migrate join <unit> --directive <id>` joins the pieces a building
//   unit's phases were composed in into the plan its cut takes, and with
//   `--phase <N> --dry-run` names the faults of that phase's piece alone,
//   writing nothing (cut-merges.cjs).
// - A directive that agents carry a piece of names, in its check, the
//   sections of it their briefs draw, `briefed` (`briefedSections`): each
//   from its heading to the next at its level or above — what an agent
//   does, never the session's own work (brief-records.cjs).
// - Known edges: held commits and the trust log's silence key on the state
//   branch having no commit yet (state-worktree.cjs, trust-log.cjs), which
//   only the reshape's migration leaves; a directive met later, on a branch
//   with commits, would commit and log as any verb does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { codeRoot } = require('../kernel/code-root.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { isObject, readWorkUnitManifest } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { directiveStop, directiveArrival, directiveCarryOn, migrationChecksStop, leavingQuestion } = require('./projections/boot.cjs');
const { topicTitle } = require('./derivations.cjs');
const { projectName } = require('./state-checks.cjs');
const { unraised } = require('./raise.cjs');
const { listWorkUnitManifests } = require('../kernel/manifest.cjs');
const { CARRIED } = require('../../../ledger-migrate/scripts/record-files.cjs');
const { MIGRATIONS_RECORD, MIGRATION_JOURNALS, finishing, codeFiles } = require('./migration-commit.cjs');
const { refreshMigrationQuietly } = require('./presence.cjs');
const { CHECKS_DONE } = require('../../../ledger-migrate/scripts/old-layout.cjs');
const { markPath } = require('./cut-migrating.cjs');
const { headingLevels, sectionEnd } = require('./spec-sections.cjs');

// Resolved against this file, so it works wherever the skill tree is installed.
const MIGRATE_SCRIPTS = path.resolve(__dirname, '..', '..', '..', 'ledger-migrate', 'scripts');
const MIGRATE_CJS = path.join(MIGRATE_SCRIPTS, 'migrate.cjs');
const MIGRATIONS = path.join(MIGRATE_SCRIPTS, 'migrations');

// The move's journal of the corrections it made (078), among the migration's journals.
const MOVE_JOURNAL = 'move.json';

const DIRECTIVE_ID = /^([0-9]+)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MIGRATE_USAGE = ['migrate check <id>', 'migrate checked', 'migrate review', 'migrate join <work-unit> --directive <id> [--phase <N> --dry-run]'].join('\n');

/** A directive the migrations hold: its id, the number its record line is, and its two files. @typedef {{id: string, number: string, file: string, check: string}} Directive */

/** One piece of a directive's work, what it still lacks, and, where its check names one, the step the session takes on it next. @typedef {{name: string, problems: string[], next?: string}} Piece */

/** What one of a directive's pieces is called, and many of them. @typedef {{one: string, many: string}} Counts */

/** A point a directive's own steps raise: the place it is raised at, the question it answers, the question's text, and any other questions that may be the same point, each with its place. @typedef {{place: string, answers: string, text: string, candidates?: {place: string, answers: string, text: string}[], settled_on?: {place: string, decisions: {id: string, text: string}[]}[]}} Point */

/**
 * A directive's check as its module exports it: what the step does, what
 * its pieces are called, what a piece done has, what becomes of one a
 * session left part-way, the check, and any points its own steps raise.
 * @typedef {{
 *   does: string, counts: Counts, done: string, partWay: string, check: (dirs: {projectDir: string, stateDir: string}) => unknown, raises?: (dirs: {projectDir: string, stateDir: string}) => unknown,
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
 * what they are called, what a piece done has, and what becomes of one left
 * part-way.
 * @typedef {{done: number, of: number, counts: Counts, says: string, partWay: string}} Progress
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
  return isObject(piece) && typeof piece.name === 'string' && Array.isArray(piece.problems) && piece.problems.every((problem) => typeof problem === 'string') && (piece.next === undefined || isWords(piece.next));
}

/** @param {unknown} words @returns {words is string} */
const isWords = (words) => typeof words === 'string' && words.trim() !== '';

/** @param {unknown} point @returns {point is Point} */
const isPoint = (point) => isObject(point) && isWords(point.place) && isWords(point.answers) && typeof point.text === 'string' && (point.candidates === undefined || (Array.isArray(point.candidates) && point.candidates.every((each) => isObject(each) && isWords(each.place) && isWords(each.answers) && typeof each.text === 'string')))
  && (point.settled_on === undefined || (Array.isArray(point.settled_on) && point.settled_on.every((each) => isObject(each) && isWords(each.place) && Array.isArray(each.decisions) && each.decisions.every((decision) => isObject(decision) && isWords(decision.id) && typeof decision.text === 'string'))));

/**
 * Whether a check module exports the check's shape: `does`, `counts`,
 * `{ one, many }`, `done`, `partWay`, and `check()`.
 * @param {Record<string, unknown>} checker @returns {checker is Check}
 */
function isCheck(checker) {
  const { does, counts, done, partWay, check } = checker;
  return typeof check === 'function' && isWords(does) && isObject(counts) && isWords(counts.one) && isWords(counts.many) && isWords(done) && isWords(partWay);
}

/**
 * The sections of a directive's text its check names `briefed`, in that
 * order, each its lines from its heading to the next heading at its level
 * or above, the blank lines before that left out. Refused for a check
 * naming none, and for a heading the text lacks.
 * @param {string} id @param {string} text @param {unknown} briefed @returns {string[][]}
 */
function briefedSections(id, text, briefed) {
  if (!Array.isArray(briefed) || briefed.length === 0 || !briefed.every((heading) => typeof heading === 'string')) {
    throw new Error(`${id}'s check names no section its agents' briefs draw — briefed, a list of its headings`);
  }
  const lines = text.trimEnd().split('\n');
  const levels = headingLevels(lines);
  return briefed.map((heading) => {
    const at = lines.findIndex((line, i) => levels[i] > 0 && line.slice(levels[i]).trim() === heading);
    if (at === -1) throw new Error(`${id} heads no section "${heading}", which its check names briefed`);
    const section = lines.slice(at, sectionEnd(levels, at, levels[at]));
    while (section.length > 1 && section[section.length - 1].trim() === '') section.pop();
    return section;
  });
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
    throw new Error(`${id}'s check exports no check() beside what it counts — it exports { does, counts: { one, many }, done, partWay, check({ projectDir, stateDir }) }`);
  }
  return checker;
}

/** What a check reads: the project's code root and its state, both absolute. @param {string} cwd */
function checkDirs(cwd) {
  return { projectDir: codeRoot(cwd), stateDir: stateRoot(cwd) };
}

/**
 * The pieces of the directive `id`'s work, as its check answers them over
 * the project at `cwd` — none where it leaves the session nothing to do,
 * which the runner records and runs past. Refuses a check that will not load,
 * exports another shape, fails, or answers anything but its pieces.
 * @param {string} cwd @param {string} id
 * @returns {Piece[]}
 */
function piecesOf(cwd, id) {
  const { check } = loadCheck(id);
  let pieces;
  try {
    pieces = check(checkDirs(cwd));
  } catch (err) {
    throw new Error(`${id}'s check failed: ${messageOf(err)}`);
  }
  if (!Array.isArray(pieces) || !pieces.every(isPiece)) throw new Error(`${id}'s check answered no list of { name, problems }`);
  return pieces;
}

/**
 * Run the check of the directive `id` against the project at `cwd`. Refuses
 * as `piecesOf` does.
 * @param {string} cwd @param {string} id
 * @returns {Checked}
 */
function checkDirective(cwd, id) {
  const { counts, raises } = loadCheck(id);
  const pieces = piecesOf(cwd, id);
  const unfinished = pieces.filter((piece) => piece.problems.length > 0);
  const passed = unfinished.length === 0;
  const checked = { directive: id, passed, done: pieces.length - unfinished.length, of: pieces.length, counts: { one: counts.one, many: counts.many }, unfinished };
  return passed && typeof raises === 'function' ? { ...checked, raise: unraised(cwd, pointsOf(id, raises, checkDirs(cwd))) } : checked;
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
    const { done: says, partWay } = loadCheck(id);
    return { done, of, counts, says, partWay };
  } catch {
    return null;
  }
}

/**
 * `line` appended to the migrations record, where it is not there yet.
 * @param {string} cwd @param {string} line
 */
function recordLine(cwd, line) {
  const record = statePath(cwd, MIGRATIONS_RECORD);
  const held = fs.existsSync(record) ? fs.readFileSync(record, 'utf8') : '';
  if (held.split('\n').includes(line)) return;
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.appendFileSync(record, `${held === '' || held.endsWith('\n') ? '' : '\n'}${line}\n`);
}

/**
 * Record the directive in the migrations record, where it is not there yet.
 * @param {string} cwd @param {Directive} directive
 */
function recordDirective(cwd, { number }) {
  recordLine(cwd, number);
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

/** The directive `id`'s step in words, from its slug. @param {string} id */
const stepOf = (id) => id.replace(/^[0-9]+-/, '').replace(/-/g, ' ');

/**
 * Where the directive `id` stands, as its screens say it: the project's
 * name, its step in words, and its progress. Refuses a directive the
 * migrations lack.
 * @param {string} cwd @param {string} id
 */
function standingOf(cwd, id) {
  directiveOf(id);
  return { project: projectName(cwd), step: stepOf(id), progress: progressOf(cwd, id) };
}

/**
 * `render directive-arrival --directive <id>`: the migration at work at it,
 * none of its pieces done yet (the header's).
 * @param {string} _cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function directiveArrivalSurface(_cwd, args) {
  if (args.directive === undefined) throw new Error('render directive-arrival: --directive <id> names the directive the migration reached');
  return directiveArrival({ step: stepOf(args.directive), does: loadCheck(args.directive).does });
}

/**
 * `render directive-carry-on --directive <id>`: the migration part-way
 * through it, this session carrying it on (the header's).
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function directiveCarryOnSurface(cwd, args) {
  if (args.directive === undefined) throw new Error('render directive-carry-on: --directive <id> names the directive the migration is part-way through');
  return directiveCarryOn({ ...standingOf(cwd, args.directive), does: loadCheck(args.directive).does });
}

/**
 * `render migration-taken-stop --at <step> --active <seconds>`: the screen
 * of boot's `taken` stop — the stop at the step another session carries the
 * migration on from, a directive's id or `checks`, naming the whole seconds
 * since it was last active.
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function takenStopSurface(cwd, args) {
  const { at, active } = args;
  if (at === undefined) throw new Error('render migration-taken-stop: --at <step> names the step another session carries the migration on from, a directive\'s id or checks');
  if (active === undefined || !/^(0|[1-9][0-9]*)$/.test(active)) {
    throw new Error(`render migration-taken-stop: --active takes the seconds since the session carrying the migration on was last active${active === undefined ? '' : `, got "${active}"`}`);
  }
  return at === 'checks' ? migrationChecksStop(Number(active)) : directiveStop({ ...standingOf(cwd, at), carrier: Number(active) });
}

/**
 * `render migration-leaving <unit> --directive <id>`: the mixed unit's
 * question (the header's).
 * @param {string} cwd @param {Record<string, string|undefined>} args
 * @returns {string}
 */
function leavingSurface(cwd, { dotpath: unit, directive }) {
  if (unit === undefined || directive === undefined) throw new Error('render migration-leaving: <unit> --directive <id> — the building unit, and the directive asking where its leaving topics go');
  const { leavingOf } = /** @type {Check & {leavingOf?: (at: {projectDir: string, stateDir: string, unit: string}) => unknown}} */ (loadCheck(directive));
  if (typeof leavingOf !== 'function') throw new Error(`render migration-leaving: ${directive}'s check answers no unit's leaving topics`);
  const mixed = /** @type {{covered: number, leaving: {topic: string, standing: string}[]}|null} */ (leavingOf({ ...checkDirs(cwd), unit }));
  if (mixed === null || mixed.leaving.length === 0) throw new Error(`render migration-leaving: no topic leaves ${unit} — the question is asked of a building unit with topics its specs do not cover`);
  const manifest = readWorkUnitManifest(stateRoot(cwd), unit);
  return leavingQuestion({ unit, covered: mixed.covered, leaving: mixed.leaving.map(({ topic, standing }) => ({ title: topicTitle(manifest, topic), standing })) });
}

/**
 * What the reshape's summary is written from while its commit is owed:
 * the commits the yes still makes, the units moved, the records carried,
 * the code files the commit takes, named from the project's
 * folder, and the corrections the migration made, each by its unit, in
 * the units' order.
 * @typedef {{commits: import('./migration-commit.cjs').CommitsOwed, units: number, records: number, files: string[], corrections: ({unit: string} & Record<string, unknown>)[]}} ReshapeReview
 */

/**
 * How many records the migration carried, each kept as carried
 * (ledger-carry.cjs): a topic's in its unit's folder, a unit's own beside it.
 * @param {string} cwd @returns {number}
 */
function recordsCarried(cwd) {
  const root = statePath(cwd, CARRIED);
  if (!fs.existsSync(root)) return 0;
  const kept = (/** @type {string[]} */ names) => names.filter((name) => name.endsWith('.json')).length;
  return fs.readdirSync(root, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? kept(fs.readdirSync(path.join(root, entry.name))) : kept([entry.name])), 0);
}

/** @typedef {{unit: string} & Record<string, unknown>} Correction */

/** Each correction the move journaled (078), by its unit. @param {string} cwd @returns {Correction[]} */
function moveCorrections(cwd) {
  const file = statePath(cwd, MIGRATION_JOURNALS, MOVE_JOURNAL);
  const journal = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return (Array.isArray(journal.corrections) ? journal.corrections : []).filter((correction) => isObject(correction) && typeof correction.unit === 'string');
}

/** Each correction the migration's cut recorded in its marks, by its unit. @param {string} cwd @returns {Correction[]} */
function cutCorrections(cwd) {
  const marks = path.dirname(markPath(cwd, '_'));
  const units = fs.existsSync(marks) ? fs.readdirSync(marks).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -'.json'.length)) : [];
  return units.flatMap((unit) => {
    const mark = JSON.parse(fs.readFileSync(markPath(cwd, unit), 'utf8'));
    return (Array.isArray(mark.corrections) ? mark.corrections : []).filter(isObject).map((correction) => ({ unit, ...correction }));
  });
}

/**
 * Each correction the migration made, in the units' order: within a unit,
 * the move's before the cut's.
 * @param {string} cwd @returns {Correction[]}
 */
const migrationCorrections = (cwd) => [...moveCorrections(cwd), ...cutCorrections(cwd)].sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));

/**
 * `migrate review`: the state's folder and the folder the code side's
 * commit lands in, both absolute — and, while the reshape finishes, what
 * its summary is written from (`ReshapeReview`).
 * @param {string} cwd
 * @returns {{state: string, code: string, reshape?: ReshapeReview}}
 */
function reviewMigration(cwd) {
  const finish = finishing(cwd);
  const state = stateRoot(cwd);
  if (finish === null) return { state, code: codeRoot(cwd) };
  const units = listWorkUnitManifests(cwd);
  return {
    state,
    code: finish.project,
    reshape: {
      commits: finish.commits,
      units: units.length,
      records: recordsCarried(cwd),
      files: codeFiles(finish),
      corrections: migrationCorrections(cwd),
    },
  };
}

/**
 * `migrate check <id>`: the directive's check run; `migrate checked`: the
 * chain's checks before the reshape recorded as made; `migrate review`:
 * what the migration review reads.
 * @param {string} cwd @param {string[]} argv
 * @returns {Checked|ReturnType<typeof reviewMigration>|{}}
 */
function runMigrateVerb(cwd, argv) {
  const [verb, id, ...rest] = argv;
  if (verb === 'review' && argv.length === 1) return reviewMigration(cwd);
  // Loaded at its call: the join reads the directive's check through this module.
  if (verb === 'join') return require('./cut-merges.cjs').joinPlan(cwd, argv.slice(1));
  if (verb === 'checked' && argv.length === 1) {
    recordLine(cwd, CHECKS_DONE);
    refreshMigrationQuietly(cwd);
    return {};
  }
  if (verb !== 'check' || id === undefined || rest.length > 0) throw new Error(`Usage: ${MIGRATE_USAGE.split('\n').map((form) => `engine ${form}`).join(' | ')}`);
  /** @type {Checked} */
  let checked;
  try {
    checked = checkDirective(cwd, id);
  } catch (err) {
    throw new Error(`migrate check: ${messageOf(err)}`);
  }
  refreshMigrationQuietly(cwd);
  return checked;
}

module.exports = { MIGRATE_CJS, MIGRATIONS_RECORD, MIGRATION_JOURNALS, MIGRATE_USAGE, directiveOf, isCheck, loadCheck, briefedSections, piecesOf, checkDirective, recordDirective, directiveStopped, directiveArrivalSurface, directiveCarryOnSurface, takenStopSurface, leavingSurface, runMigrateVerb };
