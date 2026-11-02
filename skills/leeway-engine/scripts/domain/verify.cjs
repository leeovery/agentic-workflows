'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's proof by running the product (15.2, 15.4, 15.6)
// — the `verify` verbs, which run the verify setup's parts, each a command
// in the product's code (environment.cjs), by `sh -c` in the code root of the
// calling checkout, as a project's command runs (kernel/shell-command.cjs),
// with no timeout of the engine's own and holding no lock while they run.
// Every part is handed `LEEWAY_RUN`, a fresh folder of its own outside the
// project, gone once the verb answers, which the parts write what they find
// into, and in a run of a scenario `LEEWAY_SCENARIO`. The health check
// answers only once the product does.
//
// A scenario's run calls launch, the health check, the drive and the
// evidence, then the cleanup whatever came before. The drive's script checks
// what happened and writes its verdict to `$LEEWAY_RUN/verdict` — `pass`,
// `fail`, or `skipped` where the criterion's tests were named and not run
// (15.3.5) — its exit code no verdict; the text evidence, a captured screen
// or a response, goes in `$LEEWAY_RUN/evidence/`, 64 KB a file at most, and
// recordings and images in `$LEEWAY_RUN/recordings/`, a file each. A run
// proves committed code: every repository of the checkout clean before the
// parts run, so the commits it names are the code it ran, and clean after
// them, so a setup that leaves files behind is caught where it is built.
//
// - `verify run <unit> <scenario>` runs a scenario of the unit's cut
//   (15.4.1) and records the run (runs.cjs): the verdict as written, never
//   Claude's (15.4.2); each text file whole; each recording copied into the
//   unit's cache under its hash, the hash in the run (15.4.4); the checkout
//   it ran in and each of its repositories' HEAD; and the task it ran for —
//   the task of the unit in flight in the calling conversation whose
//   worktree the run is in (conversation.cjs, `taskAt`; task-worktree.cjs),
//   else the one task of the unit in flight there, a builder's commands
//   carrying its conversation's id, and none where there is none, or
//   several. It is committed alone under the writer lock, pushed, and
//   answers what the scenario's runs now prove at the checkout's HEAD.
// - `verify setup <unit> --file <setup.json> --scenario <scenario>` records
//   the verify setup on the project manifest, `environment.verify` (15.2.11,
//   22.5.12): its place and the feature map's in the product's code, its five
//   parts and the mutation tool it names, where it names one — once all five
//   have run end to end from the calling checkout for one scenario of the
//   cut, the drive writing a verdict, whatever it says, and the evidence
//   reading as a run's does (15.2.7). The trial is no run: what it was run
//   for is kept beside the setup, `ran`. The verdict comes only from the
//   product's reviewed code (15.2.10, 15.4.2): the place is a folder below
//   the code root, and the drive's command is the path of an executable file
//   under it, then plain arguments, holding no shell operator or expansion;
//   the other parts are free. The setup file lies outside the checkout — the
//   state's cache, or anywhere else — since the trial refuses a checkout
//   holding a file not committed. Its answer draws nothing. A setup recorded
//   is replaced whole by the next.
// - `verify mutants <unit> <N>` runs the mutation tool the setup names over
//   the lines phase N changed (15.6.3): in each repository of the calling
//   checkout, the commits whose `Leeway-Task` trailer names a task of the
//   phase (commit-task.cjs), and the change from the parent of the earliest
//   to HEAD, confined to the files those commits touched — each file's lines
//   as they stand at HEAD, a submodule's pointer never one of them. The
//   lines go to the tool as `$LEEWAY_CHANGED`, a JSON file, `[{path, lines:
//   [[from, to], …]}]`, each path from the project's root; the tool writes
//   what survived to `$LEEWAY_RUN/survivors.json`, `[{path, line, mutant}]`,
//   whatever its exit code says — many exit failing where a mutant survives.
//   A survivor's path is read as the project's: posix-normalised, an
//   absolute one made relative to the project's root. The verb answers those
//   on a line the phase changed (15.6.6). It writes nothing of the state or
//   the code: what survived is left in the unit's cache, `.cache/{unit}/
//   build/mutants/phase-{N}/{head}.json`, keyed by the project's commit it
//   ran at, where the phase review's brief reads it for its HEAD
//   (`cachedSurvivors`, brief-records.cjs), so the tool runs once a review,
//   outside any lock, from the checkout holding the phase's commits.
//
// Each refuses, opening on its command and recording nothing: a unit the
// project lacks; no verify setup recorded, naming `verify setup`, for the
// run and the mutants; a scenario that is none of the cut's, or a phase
// beyond it; a setup file that does not hold one, a place under `.leeway/`
// (15.2.12), one the checkout lacks, a place that is the code root, a drive
// that is no script under the place; for a run or a setup, a repository of
// the checkout holding an uncommitted change before the parts run, or a file
// they left behind, naming each; a part that fails — the drive aside,
// whose verdict is the file — naming it, its exit code and its output's last
// lines, the cleanup's failure beside any other; and what the parts wrote
// that a run cannot hold: no verdict — a `verdict` that is not a file among
// them — with the drive's exit code and output, or another word; a symbolic
// link, a folder, a file that is not text or one over 64 KB among the
// evidence; a symbolic link or a folder among the recordings; for the
// mutants, a setup naming no tool, no commit of the phase in the checkout,
// no survivors written, or not of their shape, and a survivor naming none of
// the files the phase changed.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, tryGit, literally, parentOrEmptyTree, diffPatch, hasCommits } = require('../kernel/git.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath, STATE_DIR_NAME } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos, projectPath, repoName } = require('../kernel/repos.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { runShellCommand, tailText } = require('../kernel/shell-command.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { tasksInFlight, taskAt } = require('./conversation.cjs');
const { codeStatus } = require('./code.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { stepOfId } = require('./task-id.cjs');
const { isoNow } = require('./dates.cjs');
const { VERIFY_PARTS, SETUP_PLACES, setupFaults, verifySetup } = require('./environment.cjs');
const { VERDICTS, SCENARIO, recordRun, recordingPath, runsOf } = require('./runs.cjs');
const { folding } = require('./layout.cjs');
const { filled, refusing } = require('./staged-payload.cjs');

/** @typedef {import('./environment.cjs').VerifySetup} VerifySetup */
/** @typedef {import('./environment.cjs').SetupParts} SetupParts */
/** @typedef {import('./runs.cjs').Verdict} Verdict */
/** @typedef {import('./runs.cjs').Evidence} Evidence */
/** @typedef {import('./runs.cjs').Recording} Recording */
/** @typedef {import('./runs.cjs').RepoCommit} RepoCommit */
/** @typedef {import('../kernel/shell-command.cjs').CommandRun} CommandRun */
/** @typedef {(typeof VERIFY_PARTS)[number]} Part */
/** @typedef {{part: string, exit: number, tail: string[]}} PartFailure */
/** @typedef {{path: string, lines: Array<[number, number]>}} Changed */
/** @typedef {{path: string, line: number, mutant: string}} Survivor */
/** @typedef {{verdict: Verdict, evidence: Evidence[], recordings: (Recording & {file: string})[]}} RunWritten */

const VERIFY_USAGE = [
  'verify run <work-unit> <scenario>',
  'verify setup <work-unit> --file <setup.json> --scenario <scenario>',
  'verify mutants <work-unit> <N>',
].join('\n');

/** The parts a run calls before its cleanup. */
const RUN_PARTS = /** @type {readonly Part[]} */ (['launch', 'health', 'drive', 'evidence']);

/** The trailer a code commit names its task in (commit-task.cjs). */
const TASK_TRAILER = 'Leeway-Task';

/** The most a file of text evidence holds, since the state branch keeps it for good (15.4.4). */
const EVIDENCE_LIMIT = 64 * 1024;

/** A shell operator or expansion, which a drive's command never holds: it runs its script and nothing else. */
const SHELL_SYNTAX = /[;&|<>$`()\r\n]/;

/** The way on from a file a run would leave in the checkout. */
const LEFT_BEHIND = 'Ignore a file a run leaves behind, have the setup\'s cleanup remove it, or write it under $LEEWAY_RUN; '
  + 'commit one through the door (engine commit --paths … --task) only where it belongs to the product.';

/** The unit's manifest; refused where the project lacks it. @param {string} cwd @param {string} unit @returns {Record<string, any>} */
function unitManifest(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}"`);
  return manifest;
}

/** The project's verify setup; refused where none is recorded. @param {string} cwd @param {string} unit @returns {VerifySetup} */
function recordedSetup(cwd, unit) {
  const setup = verifySetup(cwd);
  if (setup === null) {
    throw new Error(`the project has no verify setup recorded — the first phase's tasks build it in the product's code, and engine verify setup ${unit} --file <setup.json> --scenario <scenario> records it once it has run end to end`);
  }
  return setup;
}

/** The phases of the unit's cut. @param {Record<string, any>} manifest @returns {{scenarios: string[]}[]} */
const cutPhases = (manifest) => manifest.cut?.phases ?? [];

/** Refuses a scenario that is none of the unit's cut. @param {Record<string, any>} manifest @param {string} unit @param {string} scenario */
function assertCutScenario(manifest, unit, scenario) {
  if (!SCENARIO.test(scenario) || !cutPhases(manifest).some((phase) => phase.scenarios.includes(scenario))) {
    throw new Error(`${scenario} is no scenario of ${unit}'s cut — engine manifest get ${unit} cut lists them`);
  }
}

/** The files the checkout at `root` holds not committed, tracked or untracked and not ignored, in every repository. @param {string} root */
const uncommitted = (root) => codeStatus(root).files.map((file) => file.path);

/**
 * Each repository of the checkout at `root` with its HEAD — null before its
 * first commit — refused where any holds an uncommitted change: a run proves
 * committed code.
 * @param {string} root @returns {RepoCommit[]}
 */
function cleanCommits(root) {
  const dirty = uncommitted(root);
  if (dirty.length > 0) throw new Error(`the checkout at ${root} holds changes not committed — ${dirty.join(', ')} — a run proves committed code. ${LEFT_BEHIND}`);
  return projectRepos(root).map((repo) => ({ repo: repoName(repo), commit: tryGit(repo.path, ['rev-parse', '-q', '--verify', 'HEAD'])?.trim() ?? null }));
}

/**
 * `fn` given a fresh folder of its own outside the project, removed once it
 * answers.
 * @template T @param {(folder: string) => T} fn @returns {T}
 */
function inRunFolder(fn) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-run-'));
  try {
    return fn(folder);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/** A failed part, as a refusal names it. @param {PartFailure} failure */
function failedPart({ part, exit, tail }) {
  return `the setup's ${part} failed with exit ${exit}. ${tailText(tail)}`;
}

/**
 * The setup's parts for a run, in order in `root`, until one fails — the
 * drive aside, whose verdict is the file it writes — then its cleanup,
 * whatever came before; refused naming each that failed. Answers how the
 * drive ran.
 * @param {string} root @param {SetupParts} setup @param {Record<string, string>} env
 * @returns {CommandRun}
 */
function runParts(root, setup, env) {
  /** @type {PartFailure[]} */
  const failures = [];
  /** @type {CommandRun} */
  let drive = { exit: 0, tail: [] };
  for (const part of RUN_PARTS) {
    const ran = runShellCommand(root, setup[part], env);
    if (part === 'drive') drive = ran;
    else if (ran.exit !== 0) {
      failures.push({ part, ...ran });
      break;
    }
  }
  const cleanup = runShellCommand(root, setup.cleanup, env);
  if (cleanup.exit !== 0) failures.push({ part: 'cleanup', ...cleanup });
  if (failures.length > 0) {
    throw new Error(`${failures.map(failedPart).join('\nThen ')}\nNothing was recorded — fix the setup where it breaks (15.2.8) and run it again.`);
  }
  return drive;
}

/** The entries a folder the parts wrote holds, by name; none where it is not there. @param {string} folder @returns {fs.Dirent[]} */
function written(folder) {
  try {
    return fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return [];
    throw err;
  }
}

/** Why an entry the parts wrote is no file, or null where it is one. @param {fs.Dirent} entry */
function notAFile(entry) {
  if (entry.isSymbolicLink()) return 'is a symbolic link';
  return entry.isFile() ? null : 'is not a file';
}

/** A file's bytes as text, or null where they are not UTF-8. @param {Buffer} bytes */
function asText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * The verdict the drive wrote, or null — a fault named, with how the drive
 * ran — where it wrote none it may.
 * @param {string} run @param {CommandRun} drive @param {string[]} faults @returns {Verdict|null}
 */
function verdictIn(run, drive, faults) {
  const file = path.join(run, 'verdict');
  const said = fs.existsSync(file) && fs.lstatSync(file).isFile() ? fs.readFileSync(file, 'utf8').trim() : null;
  const verdict = VERDICTS.find((word) => word === said);
  if (verdict !== undefined) return verdict;
  if (said !== null) faults.push(`the drive's verdict "${said}" is none of ${VERDICTS.join(', ')}`);
  else faults.push(`the drive wrote no verdict to $LEEWAY_RUN/verdict — it exited ${drive.exit}${drive.exit === 0 ? '' : `. ${tailText(drive.tail)}`}`);
  return null;
}

/** Why a file among the evidence cannot be kept with the run, or null where it can. @param {fs.Dirent} entry @param {string} file */
function evidenceFault(entry, file) {
  const fault = notAFile(entry);
  if (fault !== null) return fault;
  if (fs.statSync(file).size > EVIDENCE_LIMIT) return 'is over 64 KB — a large one goes in recordings/';
  return asText(fs.readFileSync(file)) === null ? 'is not a text file — a recording or an image goes in recordings/' : null;
}

/** The text evidence the parts wrote, each file that cannot be kept a fault named. @param {string} run @param {string[]} faults @returns {Evidence[]} */
function evidenceIn(run, faults) {
  return written(path.join(run, 'evidence')).flatMap((entry) => {
    const file = path.join(run, 'evidence', entry.name);
    const fault = evidenceFault(entry, file);
    if (fault === null) return [{ name: entry.name, text: fs.readFileSync(file, 'utf8') }];
    faults.push(`evidence/${entry.name} ${fault}`);
    return [];
  });
}

/** The recordings the parts wrote, each with its hash and the file it is in, any that is no file a fault named. @param {string} run @param {string[]} faults */
function recordingsIn(run, faults) {
  return written(path.join(run, 'recordings')).flatMap((entry) => {
    const file = path.join(run, 'recordings', entry.name);
    const fault = notAFile(entry);
    if (fault === null) return [{ name: entry.name, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), file }];
    faults.push(`recordings/${entry.name} ${fault}`);
    return [];
  });
}

/**
 * What the run's parts wrote: the verdict, the text evidence and the
 * recordings; refused naming every fault.
 * @param {string} run @param {CommandRun} drive @returns {RunWritten}
 */
function whatTheRunWrote(run, drive) {
  /** @type {string[]} */
  const faults = [];
  const [verdict, evidence, recordings] = [verdictIn(run, drive, faults), evidenceIn(run, faults), recordingsIn(run, faults)];
  if (verdict === null || faults.length > 0) throw new Error(`the run cannot be recorded — ${faults.join('; ')}. Nothing was recorded.`);
  return { verdict, evidence, recordings };
}

/**
 * A scenario run through the setup in `root`, what it wrote read; refused
 * where the parts left files in the checkout. `keep` is given what it wrote
 * while its folder stands.
 * @param {string} root @param {SetupParts} setup @param {string} scenario @param {(wrote: RunWritten) => void} [keep]
 * @returns {RunWritten}
 */
function runScenario(root, setup, scenario, keep = () => {}) {
  return inRunFolder((run) => {
    const drive = runParts(root, setup, { LEEWAY_RUN: run, LEEWAY_SCENARIO: scenario });
    const left = uncommitted(root);
    if (left.length > 0) throw new Error(`the setup's parts left ${left.join(', ')} in the checkout at ${root}, so nothing was recorded. ${LEFT_BEHIND}`);
    const wrote = whatTheRunWrote(run, drive);
    keep(wrote);
    return wrote;
  });
}

/**
 * The task a run in the calling conversation is for: the task of the unit
 * in flight there whose worktree the run is in, else the one task of the
 * unit in flight there, or null where there is none, or several.
 * @param {string} root the checkout the run is in @param {string} unit
 * @returns {string|null}
 */
function taskOfRun(root, unit) {
  const session = handedSession();
  if (session === null) return null;
  const here = taskAt(session, root);
  if (here !== null && here.unit === unit) return here.task;
  const inFlight = tasksInFlight(session).filter((task) => task.unit === unit);
  return inFlight.length === 1 ? inFlight[0].task : null;
}

/**
 * `verify run <unit> <scenario>`: the scenario run through the verify setup
 * from the calling checkout, and its run recorded and committed.
 * @param {string} cwd @param {string} unit @param {string} scenario
 * @returns {Record<string, unknown>}
 */
function verifyScenario(cwd, unit, scenario) {
  assertCutScenario(unitManifest(cwd, unit), unit, scenario);
  const setup = recordedSetup(cwd, unit);
  const root = codeRoot(cwd);
  const commits = cleanCommits(root);
  const { verdict, evidence, recordings } = runScenario(root, setup, scenario, (wrote) => {
    for (const recording of wrote.recordings) {
      const kept = recordingPath(cwd, unit, scenario, recording);
      fs.mkdirSync(path.dirname(kept), { recursive: true });
      fs.copyFileSync(recording.file, kept);
    }
  });
  /** @type {string[]} */
  const warnings = [];
  const { rel, outcome } = withStateLock(stateRoot(cwd), () => {
    const recorded = recordRun(cwd, unit, scenario, {
      verdict,
      unfixed: false,
      at: isoNow(),
      checkout: root,
      commits,
      task: taskOfRun(root, unit),
      evidence,
      recordings: recordings.map(({ name, sha256 }) => ({ name, sha256 })),
    });
    return { rel: recorded, outcome: commitStateTail(cwd, recorded, `verify(${unit}): ${scenario} ${verdict}`, warnings) };
  });
  const head = commits.find(({ repo }) => repo === '.')?.commit ?? undefined;
  /** @type {Record<string, unknown>} */
  const result = { unit, scenario, verdict, run: rel, standing: runsOf(cwd, unit, scenario, head).standing, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/** A setup file's parts; refused where it does not hold a setup. @param {string} cwd @param {string} file @returns {SetupParts} */
function setupIn(cwd, file) {
  let given;
  try {
    given = JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  } catch (err) {
    throw new Error(`the setup file ${file} cannot be read as JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
  const faults = setupFaults(given, false);
  if (faults.length > 0) throw new Error(`the setup file does not hold a verify setup — ${faults.join('; ')}`);
  return /** @type {SetupParts} */ (given);
}

/** Whether `inner` lies below the folder `outer`. @param {string} outer @param {string} inner */
function below(outer, inner) {
  const rel = path.relative(outer, inner);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Whether `file` is an executable file below the folder `place`, each read through any link. @param {string} place @param {string} file */
function executableBelow(place, file) {
  try {
    const real = fs.realpathSync(file);
    fs.accessSync(real, fs.constants.X_OK);
    return fs.statSync(real).isFile() && below(fs.realpathSync(place), real);
  } catch {
    return false;
  }
}

/**
 * Whether the drive runs a script of the product's: its command holding no
 * shell operator or expansion, its first word the path of an executable file
 * under the setup's place that the checkout at `root` holds.
 * @param {string} root @param {SetupParts} setup
 */
function driveIsPlaced(root, setup) {
  const [script] = setup.drive.trim().split(/\s+/);
  return !SHELL_SYNTAX.test(setup.drive) && executableBelow(path.resolve(root, setup.place), path.resolve(root, script));
}

/**
 * The setup's places held to the checkout at `root`: refused under the
 * state's folder, which no pull request carries (15.2.12), and where the
 * checkout lacks one; a place that is the code root; and a drive that is no
 * script under the place, since the verdict is the product's reviewed code's
 * (15.2.10).
 * @param {string} root @param {SetupParts} setup
 */
function checkPlaces(root, setup) {
  const fold = folding(root);
  for (const key of SETUP_PLACES) {
    const place = setup[key];
    if (fold(path.posix.normalize(place.split(path.sep).join('/')).split('/')[0]) === fold(STATE_DIR_NAME)) {
      throw new Error(`the ${key} ${place} is under ${STATE_DIR_NAME}/, the workflows' state — the verify setup lives in the product's code, riding the phase's pull requests (15.2.12)`);
    }
    if (!fs.existsSync(path.resolve(root, place))) throw new Error(`the ${key} ${place} is not in the checkout at ${root} — record the setup from the checkout it was built in`);
  }
  if (!below(root, path.resolve(root, setup.place))) {
    throw new Error(`the place ${setup.place} is the code root — the setup's place is a folder below it, holding the drive's script (15.2.10)`);
  }
  if (!driveIsPlaced(root, setup)) {
    throw new Error(`the drive "${setup.drive}" is no script under the place ${setup.place} — its command is the path of an executable file there, then plain arguments, `
      + `with no shell operator or expansion, since the verdict is the product's reviewed code's (15.2.10); wrap a tool in a script there, such as ${setup.place}/drive.sh running npm run drive`);
  }
}

/**
 * `verify setup <unit> --file <setup.json> --scenario <scenario>`: the setup
 * run end to end for the scenario from the calling checkout, then recorded on
 * the project manifest and committed.
 * @param {string} cwd @param {string} unit @param {string} file @param {string} scenario
 * @returns {Record<string, unknown>}
 */
function recordSetup(cwd, unit, file, scenario) {
  assertCutScenario(unitManifest(cwd, unit), unit, scenario);
  const setup = setupIn(cwd, file);
  const root = codeRoot(cwd);
  checkPlaces(root, setup);
  const commits = cleanCommits(root);
  const { verdict } = runScenario(root, setup, scenario);
  /** @type {VerifySetup} */
  const recorded = { ...setup, ran: { unit, scenario, verdict, commits, at: isoNow() } };
  /** @type {string[]} */
  const warnings = [];
  const outcome = withStateLock(stateRoot(cwd), () => {
    withProjectLock(cwd, () => {
      const project = readProjectManifest(cwd);
      writeProjectManifestAtomic(cwd, { ...project, environment: { ...(isObject(project.environment) ? project.environment : {}), verify: recorded } });
    });
    return commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `verify(${unit}): the verify setup recorded`, warnings);
  });
  /** @type {Record<string, unknown>} */
  const result = { unit, setup: recorded, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, '--state');
  return result;
}

/**
 * A repository's commits naming a task of the phase in their trailer, oldest
 * first, each with the paths it touched, a submodule's pointer left out.
 * @param {import('../kernel/repos.cjs').Repo} repo @param {string} unit @param {number} phase
 * @returns {{sha: string, paths: string[]}[]}
 */
function phaseCommits(repo, unit, phase) {
  if (!hasCommits(repo.path)) return [];
  const out = git(repo.path, ['log', '--reverse', '--relative', '--no-renames', '--no-show-signature', '--fixed-strings', `--grep=${TASK_TRAILER}: ${unit}-${phase}-`,
    `--format=%x1e%H%x09%(trailers:key=${TASK_TRAILER},valueonly,separator=%x09)`, '--name-only', '-z']);
  return out.split('\x1e').slice(1).flatMap((record) => {
    const end = record.search(/[\n\0]/);
    const [sha, ...tasks] = (end < 0 ? record : record.slice(0, end)).split('\t');
    const ours = tasks.some((id) => {
      const step = stepOfId(id.trim());
      return step !== null && step.prefix === unit && step.phase === phase;
    });
    const paths = end < 0 ? [] : record.slice(end).split('\0').map((name) => name.replace(/^\n+/, '')).filter((p) => p !== '' && !repo.submodules.includes(p));
    return ours && paths.length > 0 ? [{ sha, paths }] : [];
  });
}

/**
 * The lines a file holds at HEAD that changed since `base`, each run of them
 * `[from, to]`.
 * @param {string} cwd @param {string} base @param {string} file
 * @returns {Array<[number, number]>}
 */
function changedLines(cwd, base, file) {
  return diffPatch(cwd, ['-U0', '--no-renames', base, 'HEAD', '--', ...literally([file])]).split('\n').flatMap((line) => {
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk === null) return [];
    const [from, count] = [Number(hunk[1]), hunk[2] === undefined ? 1 : Number(hunk[2])];
    return count === 0 ? [] : [/** @type {[number, number]} */ ([from, from + count - 1])];
  });
}

/**
 * The lines phase `phase` changed, in every repository of the checkout at
 * `root`, each file named from the project's root.
 * @param {string} root @param {string} unit @param {number} phase
 * @returns {Changed[]}
 */
function phaseChanges(root, unit, phase) {
  return projectRepos(root).flatMap((repo) => {
    const commits = phaseCommits(repo, unit, phase);
    if (commits.length === 0) return [];
    const base = parentOrEmptyTree(repo.path, commits[0].sha);
    const files = [...new Set(commits.flatMap((commit) => commit.paths))].sort();
    return files.flatMap((file) => {
      const lines = changedLines(repo.path, base, file);
      return lines.length === 0 ? [] : [{ path: projectPath(repo.dir, file), lines }];
    });
  });
}

/** Whether a value reads as a survivor. @param {unknown} value @returns {value is Survivor} */
function isSurvivor(value) {
  return isObject(value) && filled(value.path) && Number.isInteger(value.line) && filled(value.mutant);
}

/**
 * The survivors the tool wrote, whatever its exit code; refused where it
 * wrote none — with how it ran — or not of their shape.
 * @param {string} run @param {CommandRun} tool @returns {Survivor[]}
 */
function survivorsIn(run, tool) {
  const file = path.join(run, 'survivors.json');
  if (!fs.existsSync(file)) {
    throw new Error(`the mutation tool wrote no $LEEWAY_RUN/survivors.json — it writes what survived there, [] where nothing did; it exited ${tool.exit}${tool.exit === 0 ? '' : `. ${tailText(tool.tail)}`}`);
  }
  let survivors;
  try {
    survivors = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    survivors = null;
  }
  if (!Array.isArray(survivors) || !survivors.every(isSurvivor)) throw new Error('the mutation tool\'s survivors.json is not a list of {path, line, mutant}');
  return survivors.map(({ path: at, line, mutant }) => ({ path: at, line, mutant }));
}

/** A survivor's path as the project's: posix-normalised, an absolute one made relative to the project's root. @param {string} root @param {string} given */
function projectPathOf(root, given) {
  const relative = path.isAbsolute(given) ? path.relative(root, given) : given;
  return path.posix.normalize(relative.split(path.sep).join('/'));
}

/**
 * The survivors on a line the phase changed, each path the project's;
 * refused naming every survivor on none of the files it changed.
 * @param {string} root @param {Changed[]} changed @param {Survivor[]} survivors
 * @returns {Survivor[]}
 */
function onChangedLines(root, changed, survivors) {
  const lines = new Map(changed.map((file) => [file.path, file.lines]));
  const read = survivors.map((survivor) => ({ ...survivor, path: projectPathOf(root, survivor.path), given: survivor.path }));
  const strays = read.filter((survivor) => !lines.has(survivor.path)).map(({ given }) => given);
  if (strays.length > 0) {
    throw new Error(`the mutation tool named ${strays.join(', ')}, none of the files the phase changed — a survivor's path is the project's, from its root, as $LEEWAY_CHANGED names each file`);
  }
  return read
    .filter(({ path: at, line }) => /** @type {Array<[number, number]>} */ (lines.get(at)).some(([from, to]) => line >= from && line <= to))
    .map(({ path: at, line, mutant }) => ({ path: at, line, mutant }));
}

/**
 * `verify mutants <unit> <N>`: the setup's mutation tool run over the lines
 * phase N changed, and what survived on them, left in the unit's cache for
 * the HEAD it ran at.
 * @param {string} cwd @param {string} unit @param {string} given
 * @returns {Record<string, unknown>}
 */
function verifyMutants(cwd, unit, given) {
  const manifest = unitManifest(cwd, unit);
  const phases = cutPhases(manifest).length;
  const phase = /^[1-9][0-9]*$/.test(given) ? Number(given) : 0;
  if (phase < 1 || phase > phases) throw new Error(`"${given}" is no phase of ${unit}'s cut — it has ${phases === 1 ? '1 phase' : `${phases} phases`}`);
  const { mutation } = recordedSetup(cwd, unit);
  if (mutation === undefined) throw new Error(NO_TOOL);
  const root = codeRoot(cwd);
  const changed = phaseChanges(root, unit, phase);
  if (changed.length === 0) throw new Error(`no commit of phase ${phase} of ${unit} changes a line in the checkout at ${root} — run it from the checkout holding the phase's work`);
  const ran = inRunFolder((run) => {
    const listing = path.join(run, 'changed.json');
    fs.writeFileSync(listing, `${JSON.stringify(changed, null, 2)}\n`);
    return survivorsIn(run, runShellCommand(root, mutation, { LEEWAY_RUN: run, LEEWAY_CHANGED: listing }));
  });
  const survivors = onChangedLines(root, changed, ran);
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const cached = statePath(cwd, mutantsRel(unit, phase, head));
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  writeJsonAtomic(cached, { head, survivors });
  return { unit, phase, survivors };
}

const NO_TOOL = 'the verify setup names no mutation tool — where the language has none, each reviewer breaks the riskiest line of a criterion\'s code in a scratch worktree (15.6.5)';

/** Where `verify mutants` leaves what survived for phase `phase` at the project's commit `head`, state-relative, in the unit's cache. @param {string} unit @param {number} phase @param {string} head */
const mutantsRel = (unit, phase, head) => `.cache/${unit}/build/mutants/phase-${phase}/${head}.json`;

/**
 * What survived the setup's mutation tool on phase `phase` of the unit at
 * the project's commit `head`, as `verify mutants` left it; null where the
 * setup names no tool. Refused where no setup is recorded, or nothing is
 * left for that head.
 * @param {string} cwd @param {string} unit @param {number} phase @param {string} head the commit, in full
 * @returns {Survivor[]|null}
 */
function cachedSurvivors(cwd, unit, phase, head) {
  if (recordedSetup(cwd, unit).mutation === undefined) return null;
  const file = statePath(cwd, mutantsRel(unit, phase, head));
  if (!fs.existsSync(file)) {
    throw new Error(`the mutation tool has not run over phase ${phase} of ${unit} at ${head} — engine verify mutants ${unit} ${phase}, run from the checkout at that HEAD, runs it`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).survivors;
}

/**
 * The `verify` verbs' answer, each refusal opening on its command.
 * @param {string} cwd @param {string[]} argv @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runVerifyVerb(cwd, argv, opts) {
  const [verb, ...rest] = argv;
  const named = Object.keys(opts).sort().join();
  const usage = () => new Error(`Usage: ${VERIFY_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
  if (verb === 'run' && rest.length === 2 && named === '') return refusing('verify run', () => verifyScenario(cwd, rest[0], rest[1]));
  if (verb === 'setup' && rest.length === 1 && named === 'file,scenario' && opts.file && opts.scenario) {
    return refusing('verify setup', () => recordSetup(cwd, rest[0], opts.file, opts.scenario));
  }
  if (verb === 'mutants' && rest.length === 2 && named === '') return refusing('verify mutants', () => verifyMutants(cwd, rest[0], rest[1]));
  throw usage();
}

module.exports = { VERIFY_USAGE, runVerifyVerb, cachedSurvivors };
