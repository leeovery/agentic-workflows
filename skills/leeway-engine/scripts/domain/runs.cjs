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
//   at          when it was recorded
//   checkout    the code root of the checkout it ran in
//   commits     each repository of that checkout, `{repo, commit}` — `.`
//               the project's own, a nested one by its folder — with the
//               HEAD it ran against, null before its first commit; every
//               repository clean, so the code it ran is those commits
//   task        the task in flight it ran for, `{phase}.{n}`, null where
//               none can be told
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
// 15.4.3). Given a head — the project's own repository's commit to judge
// against — only the runs whose project commit is the head or an ancestor of
// it count, since builders side by side run one scenario at different code;
// among those not skipped, the runs at the commit nearest the head decide,
// the latest of them, a tie by number. Without a head every run counts and
// the latest not skipped decides, a standing tied to no code. The run that
// decides makes it proven where it passed, so a regression after a pass
// reads not proven; named, not run where every run counted was skipped; not
// proven otherwise, a scenario with none among them.
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
 * @typedef {{verdict: Verdict, unfixed: boolean, at: string, checkout: string, commits: RepoCommit[], task: string|null, evidence: Evidence[], recordings: Recording[]}} Run
 */
/** @typedef {'proven'|'not proven'|'named, not run'} Standing */

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
 * How many commits a run's project commit lies behind `head` in the code at
 * `root`, or null where it is neither the head nor an ancestor of it.
 * @param {string} root @param {Run} run @param {string} head @returns {number|null}
 */
function behind(root, run, head) {
  const commit = run.commits.find(({ repo }) => repo === '.')?.commit ?? null;
  if (commit === null || tryGit(root, ['merge-base', '--is-ancestor', commit, head]) === null) return null;
  return Number(tryGit(root, ['rev-list', '--count', `${commit}..${head}`]));
}

/**
 * What a scenario's runs of the change prove, and the runs that count: at the
 * head or before it, where a head is given.
 * @param {string} cwd @param {string} unit @param {string} scenario @param {string} [head]
 * @returns {{standing: Standing, runs: (Run & {file: string})[]}}
 */
function runsOf(cwd, unit, scenario, head) {
  const all = readRuns(cwd, unit, scenario).filter((run) => !run.unfixed);
  const root = head === undefined ? '' : codeRoot(cwd);
  const counted = all.flatMap((run) => {
    const distance = head === undefined ? 0 : behind(root, run, head);
    return distance === null ? [] : [{ run, distance }];
  });
  const runs = counted.map(({ run }) => run);
  const ran = counted.filter(({ run }) => run.verdict !== 'skipped');
  if (ran.length === 0) return { standing: runs.length > 0 ? 'named, not run' : 'not proven', runs };
  const nearest = ran.filter(({ distance }) => distance === Math.min(...ran.map((at) => at.distance)));
  return { standing: nearest[nearest.length - 1].run.verdict === 'pass' ? 'proven' : 'not proven', runs };
}

module.exports = { VERDICTS, SCENARIO, runsRel, recordRun, recordingPath, readRuns, runsOf };
