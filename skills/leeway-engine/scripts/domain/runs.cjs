'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the verification runs (4.11.15, 15.4) — each run of a
// scenario `verify` records (verify.cjs), `{unit}/build/runs/{scenario}/
// run-NNN.json`, a file only the engine writes (layout.cjs), numbered past
// the highest its scenario's folder holds:
//
//   verdict     the verdict the drive's script wrote — `pass`, `fail` or
//               `skipped`, the criterion's tests named and not run — never
//               Claude's (15.4.2)
//   unfixed     whether it ran on the unfixed code, the bug-proven run's
//               (15.5): false for a run of the change
//   command     a run on the unfixed code's alone: the reproducing test's
//               command, its exit the verdict — `pass` where it is 0, else
//               `fail` (bug-proven.cjs)
//   at          when it was recorded
//   checkout    the code root of the checkout it ran in
//   commits     each repository of that checkout, `{repo, commit}` — `.`
//               the project's own, a nested one by its folder — with the
//               HEAD it ran against, null before its first commit; every
//               repository clean, so the code it ran is those commits
//   task        the task in flight it ran for, `{phase}.{n}`, null where
//               none can be told; a run on the unfixed code is the
//               reproducing task's, `1.1`, in the build, and no task's in
//               the review phase
//   evidence    its text evidence, each `{name, text}` (15.4.4)
//   recordings  its recordings and images, each `{name, sha256}`, kept in
//               the unit's cache at the run's path there, under their hash
//               (`recordingPath`)
//
// A run never holds its own number: a second clone's merge renumbers this
// machine's runs past the remote's (state-merge-paths.cjs), so the number is
// a place and never a name — a recording is found by the hash in its run,
// and every run is read from its folder whatever its number. Runs are
// ordered by when they were recorded, a tie by their numbers.
//
// `runsOf` answers what a scenario's runs of the change prove (15.3.5,
// 15.4.3). Given a head — the code to judge against, the commit of each
// repository it names, as a run names its own — only the runs at that code
// or before it count, since builders side by side run one scenario at
// different code, in whichever repository the work is (12.7.10): a run
// counts where, in every repository both name, its commit is the head's or
// an ancestor of it there, a repository only one names deciding nothing
// (`behindHead`). Among those not skipped, the runs nearest the head decide
// — the fewest commits between them, summed over those repositories — the
// latest of them, a tie by number. Without a head every run counts and the
// latest not skipped decides, a standing tied to no code. The run that
// decides makes it proven where it passed, so a regression after a pass
// reads not proven; named, not run where every run counted was skipped; not
// proven otherwise, a scenario with none among them.
//
// The runs on the unfixed code are read in series (`latestSeries`): a series
// is consecutive runs at the same commits, in every repository, so a test
// run again with no new commit carries on the series it ran in, a pass
// among it standing, and a new commit begins another.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { tryGit } = require('../kernel/git.cjs');

/** @typedef {'pass'|'fail'|'skipped'} Verdict */
/** @typedef {{name: string, text: string}} Evidence */
/** @typedef {{name: string, sha256: string}} Recording */
/** @typedef {{repo: string, commit: string|null}} RepoCommit */
/**
 * @typedef {{verdict: Verdict, unfixed: boolean, command?: string, at: string, checkout: string, commits: RepoCommit[], task: string|null, evidence: Evidence[], recordings: Recording[]}} Run
 */
/** @typedef {'proven'|'not proven'|'named, not run'} Standing */
/** A run read from its scenario's folder: its file, state-relative, and its scenario. @typedef {Run & {file: string, scenario: string}} ReadRun */
/**
 * A series of runs on the unfixed code: its runs, in order; the scenario,
 * the command and the commits of its last; how many failed, and whether any
 * passed.
 * @typedef {{runs: ReadRun[], scenario: string, command: string, commits: RepoCommit[], failures: number, passed: boolean}} Series
 */

/** The verdicts a drive's script writes. @type {readonly Verdict[]} */
const VERDICTS = Object.freeze(['pass', 'fail', 'skipped']);

/** A scenario's id, `N.Sk`. */
const SCENARIO = /^[1-9][0-9]*\.S[1-9][0-9]*$/;

/** A run's file name, its number three digits or more. */
const RUN_FILE = /^run-([0-9]{3,})\.json$/;

/** A scenario's runs folder, state-relative. @param {string} unit @param {string} scenario */
const runsRel = (unit, scenario) => `${unit}/build/runs/${scenario}`;

/** A run file's number. @param {string} name */
const numberOf = (name) => Number(/** @type {RegExpExecArray} */ (RUN_FILE.exec(name))[1]);

/** The run files a scenario's folder holds, by name. @param {string} cwd @param {string} unit @param {string} scenario @returns {string[]} */
function runFiles(cwd, unit, scenario) {
  try {
    return fs.readdirSync(statePath(cwd, runsRel(unit, scenario))).filter((name) => RUN_FILE.test(name));
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * The run written as the scenario's next, past the highest number its folder
 * holds: its file, state-relative. The caller holds the writer lock.
 * @param {string} cwd @param {string} unit @param {string} scenario @param {Run} run
 * @returns {string}
 */
function recordRun(cwd, unit, scenario, run) {
  const highest = Math.max(0, ...runFiles(cwd, unit, scenario).map(numberOf));
  const rel = `${runsRel(unit, scenario)}/run-${String(highest + 1).padStart(3, '0')}.json`;
  fs.mkdirSync(path.dirname(statePath(cwd, rel)), { recursive: true });
  writeJsonAtomic(statePath(cwd, rel), run);
  return rel;
}

/**
 * Where a run's recording is kept in the unit's cache: the run's path there,
 * under the recording's hash, its own name kept.
 * @param {string} cwd @param {string} unit @param {string} scenario @param {Recording} recording
 */
function recordingPath(cwd, unit, scenario, { name, sha256 }) {
  return statePath(cwd, '.cache', runsRel(unit, scenario), sha256, name);
}

/**
 * Every run of a scenario, each with its file, state-relative, in the order
 * they were recorded, a tie by their numbers.
 * @param {string} cwd @param {string} unit @param {string} scenario
 * @returns {(Run & {file: string})[]}
 */
function readRuns(cwd, unit, scenario) {
  return runFiles(cwd, unit, scenario)
    .map((name) => ({ name, run: /** @type {Run} */ (JSON.parse(fs.readFileSync(statePath(cwd, `${runsRel(unit, scenario)}/${name}`), 'utf8'))) }))
    .sort((a, b) => (a.run.at < b.run.at ? -1 : a.run.at > b.run.at ? 1 : numberOf(a.name) - numberOf(b.name)))
    .map(({ name, run }) => ({ file: `${runsRel(unit, scenario)}/${name}`, ...run }));
}

/**
 * How far the code `commits` names lies behind the code `head` names, in the
 * project whose code root is `root`: the commits between them, summed over
 * the repositories both name — one only one of them names deciding nothing —
 * or null where, in one of those, its commit is neither the head's nor an
 * ancestor of it. A null commit, a repository before its first, is behind
 * only a null.
 * @param {string} root @param {RepoCommit[]} commits @param {RepoCommit[]} head @returns {number|null}
 */
function behindHead(root, commits, head) {
  let distance = 0;
  for (const { repo, commit } of head) {
    const ran = commits.find((named) => named.repo === repo);
    if (ran === undefined || ran.commit === commit) continue;
    if (ran.commit === null || commit === null) return null;
    const at = path.join(root, repo);
    if (tryGit(at, ['merge-base', '--is-ancestor', ran.commit, commit]) === null) return null;
    distance += Number(tryGit(at, ['rev-list', '--count', `${ran.commit}..${commit}`]));
  }
  return distance;
}

/**
 * What a scenario's runs of the change prove, the runs that count — at the
 * head or before it, where a head is given — and the run that decides, null
 * where none was run.
 * @param {string} cwd @param {string} unit @param {string} scenario @param {RepoCommit[]} [head]
 * @returns {{standing: Standing, runs: (Run & {file: string})[], decided: (Run & {file: string})|null}}
 */
function runsOf(cwd, unit, scenario, head) {
  const all = readRuns(cwd, unit, scenario).filter((run) => !run.unfixed);
  const root = head === undefined ? '' : codeRoot(cwd);
  const counted = all.flatMap((run) => {
    const distance = head === undefined ? 0 : behindHead(root, run.commits, head);
    return distance === null ? [] : [{ run, distance }];
  });
  const runs = counted.map(({ run }) => run);
  const ran = counted.filter(({ run }) => run.verdict !== 'skipped');
  if (ran.length === 0) return { standing: runs.length > 0 ? 'named, not run' : 'not proven', runs, decided: null };
  const nearest = ran.filter(({ distance }) => distance === Math.min(...ran.map((at) => at.distance)));
  const decided = nearest[nearest.length - 1].run;
  return { standing: decided.verdict === 'pass' ? 'proven' : 'not proven', runs, decided };
}

/**
 * The runs on the unfixed code of each of `scenarios`, each with its
 * scenario, in the order they were recorded — a tie by the scenarios'
 * order, then by number.
 * @param {string} cwd @param {string} unit @param {string[]} scenarios
 * @returns {ReadRun[]}
 */
function unfixedRuns(cwd, unit, scenarios) {
  return scenarios
    .flatMap((scenario) => readRuns(cwd, unit, scenario).filter((run) => run.unfixed).map((run) => ({ ...run, scenario })))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The code a run ran, as one key whatever order its repositories are named in. @param {RepoCommit[]} commits */
const codeKey = (commits) => commits.map(({ repo, commit }) => `${repo}\0${commit}`).sort().join('\n');

/**
 * The latest series among runs on the unfixed code, in the order they were
 * recorded (the header's): the runs that end them at the commits the last
 * ran at; null where there are none.
 * @param {ReadRun[]} runs @returns {Series|null}
 */
function latestSeries(runs) {
  const last = runs.at(-1);
  if (last === undefined) return null;
  const key = codeKey(last.commits);
  let from = runs.length - 1;
  while (from > 0 && codeKey(runs[from - 1].commits) === key) from -= 1;
  const series = runs.slice(from);
  return {
    runs: series,
    scenario: last.scenario,
    command: /** @type {string} */ (last.command),
    commits: last.commits,
    failures: series.filter(({ verdict }) => verdict === 'fail').length,
    passed: series.some(({ verdict }) => verdict === 'pass'),
  };
}

module.exports = { VERDICTS, SCENARIO, runsRel, recordRun, recordingPath, readRuns, behindHead, runsOf, unfixedRuns, latestSeries };
