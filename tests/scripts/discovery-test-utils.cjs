'use strict';

// The world every engine suite starts from: a git repository whose state
// worktree is in place at `.leeway/`, made by the machinery, and whose
// default branch holds one commit, the code tree's `.gitignore` naming it.
// Both first commits carry one fixed date, so a suite's own commits always
// come after them. One template is made per process and copied for each
// fixture, its state worktree relinked by the machinery's repair
// (`copyWorld`) — as is every richer world the harness makes once per
// process (`fixtureFrom`, engine-harness.cjs). A world of several
// repositories — a project and its remote, two machines — is made once in a
// folder and copied whole, every repository in the copy moved onto the
// copy's own paths (`copyFolder`).
//
// A path into the state is spelled in one place: `layout` names each place
// state-relative, and `statePath` finds the state as the engine does.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { beforeEach, afterEach } = require('node:test');

const { createState, repairStateWorktree } = require('../../skills/leeway-engine/scripts/domain/state-worktree.cjs');
const stateRoot = require('../../skills/leeway-engine/scripts/kernel/state-root.cjs');
const { WRITER_LOCK } = require('../../skills/leeway-engine/scripts/kernel/manifest-io.cjs');
const { LEDGER } = require('../../skills/leeway-engine/scripts/domain/ledger-events.cjs');
const { KNOWLEDGE_DIR } = require('../../skills/leeway-engine/scripts/kernel/knowledge/files.cjs');

const { STATE_DIR_NAME } = stateRoot;

// A test's git call answers in well under a second; one still running after
// this has hung, and fails rather than holding its suite.
const GIT_TIMEOUT_MS = 60000;

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  try {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ETIMEDOUT') throw err;
    throw new Error(`git ${args.join(' ')} in ${dir} ran past ${GIT_TIMEOUT_MS / 1000}s`);
  }
}

/**
 * The test identity, no signing, and no auto maintenance, on the repo at
 * `dir`. Git otherwise ends every commit and fetch by starting its
 * maintenance in the background, which outlives the call: a test pays for
 * the process, and a copy or removal of the repository meets its lock file
 * coming and going.
 * @param {string} dir
 */
function testIdentity(dir) {
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'maintenance.auto', 'false']);
}

/**
 * A bare repository at `dir`, a remote, the folder made where it is
 * missing. Auto maintenance is off here too: git starts it at the end of
 * every push the repository receives.
 * @param {string} dir @param {string[]} [flags] further `git init` flags
 * @returns {string} dir
 */
function bareRepo(dir, flags = []) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '--bare', ...flags]);
  git(dir, ['config', 'maintenance.auto', 'false']);
  return dir;
}

/** When the template's two commits were made. */
const TEMPLATE_DATE = '2026-01-01T00:00:00Z';

/**
 * Run `fn` in this process with `env` over its environment — `undefined`
 * taking a key away — and the environment put back after.
 * @template T @param {Record<string, string|undefined>} env @param {() => T} fn @returns {T}
 */
function withEnv(env, fn) {
  const was = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const put = (/** @type {Record<string, string|undefined>} */ values) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  put(env);
  try {
    return fn();
  } finally {
    put(was);
  }
}

/**
 * Run `fn` with git dating every commit at `date`.
 * @template T @param {string} date @param {() => T} fn @returns {T}
 */
function datedAt(date, fn) {
  return withEnv({ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, fn);
}

/** Every template this process made, removed as it exits. @type {string[]} */
const templates = [];
process.on('exit', () => templates.forEach(cleanupFixture));

/**
 * An empty temp folder for a world the process makes once, removed as the
 * process exits.
 * @param {string} prefix temp-directory prefix, a template's own, so a leftover template is told from a leftover copy
 * @returns {string} symbolic links resolved
 */
function templateFolder(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  templates.push(dir);
  return dir;
}

/** @type {string|null} */
let template = null;

/** The process's template world, made at its first fixture. @returns {string} */
function fixtureTemplate() {
  if (template !== null) return template;
  const dir = templateFolder('leeway-template-');
  git(dir, ['init', '-q', '--template=', '-b', 'main']);
  testIdentity(dir);
  fs.writeFileSync(path.join(dir, '.gitignore'), `${STATE_DIR_NAME}/\n`);
  datedAt(TEMPLATE_DATE, () => {
    git(dir, ['add', '.gitignore']);
    git(dir, ['commit', '-q', '-m', 'ignore the state']);
    createState(path.join(dir, STATE_DIR_NAME));
  });
  template = dir;
  return dir;
}

/**
 * A copy of the world at `from` at `dir`, the folder made where it is
 * missing, its state worktree relinked to the copy's own repository.
 * @param {string} from @param {string} dir
 * @returns {string} dir, symbolic links resolved — the path the engine names it by
 */
function copyWorld(from, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const at = fs.realpathSync(dir);
  fs.cpSync(from, at, { recursive: true });
  repairStateWorktree(path.join(at, STATE_DIR_NAME));
  return at;
}

/**
 * A copy of the folder world at `from` at `dir`, the folder made where it is
 * missing: each repository at its top moved onto the copy — the paths its
 * config names in the template (a remote beside it) named in the copy, and
 * its state worktree relinked.
 * @param {string} from @param {string} dir
 * @returns {string} dir, symbolic links resolved
 */
function copyFolder(from, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const at = fs.realpathSync(dir);
  fs.cpSync(from, at, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const repo = path.join(at, name);
    const config = path.join(repo, '.git', 'config');
    if (!fs.existsSync(config)) continue;
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').split(`${from}${path.sep}`).join(`${at}${path.sep}`));
    if (fs.existsSync(path.join(repo, STATE_DIR_NAME, '.git'))) repairStateWorktree(path.join(repo, STATE_DIR_NAME));
  }
  return at;
}

/**
 * A fresh world at `dir`, the folder made where it is missing.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved — the path the engine names it by
 */
function setupFixtureAt(dir) {
  return copyWorld(fixtureTemplate(), dir);
}

/**
 * A fresh world in a temp folder.
 * @param {string} [prefix] temp-directory prefix, so a leftover names its suite
 * @returns {string} symbolic links resolved — the path the engine names it by
 */
function setupFixture(prefix = 'discovery-test-') {
  return setupFixtureAt(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function cleanupFixture(dir) {
  // Retries absorb the macOS teardown race (ENOTEMPTY while a just-exited
  // child's writes settle).
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/**
 * An absolute path in the state of the repository `dir` is in, found as the
 * engine finds it — from a code worktree, the main checkout's — whether or
 * not the state worktree is there yet. Segments are state-relative, a
 * `layout` place among them; none names the state root.
 * @param {string} dir @param {...string} segments
 * @returns {string}
 */
function statePath(dir, ...segments) {
  return stateRoot.statePath(dir, ...segments);
}

/**
 * The state-relative path a path given in `dir` names, as the engine reads
 * it: `.` for the state root, null where it lies outside the state.
 * @param {string} dir @param {string} given
 * @returns {string|null}
 */
function stateRelative(dir, given) {
  return stateRoot.stateRelative(dir, given);
}

/**
 * Where each thing lives in the state, state-relative: the one place a
 * suite spells the layout on disk (4.11), so a change of layout changes
 * this and no suite.
 */
const layout = Object.freeze({
  projectManifest: 'manifest.json',
  ledger: LEDGER,
  lock: WRITER_LOCK,
  gitignore: '.gitignore',
  migrations: '.state/migrations',
  /** The project's own analysis files. @param {string} name */
  projectState: (name) => `.state/${name}`,
  /** An inbox capture. @param {string} kind @param {string} name */
  inbox: (kind, name) => `.inbox/${kind}/${name}`,
  /** A declined capture. @param {string} kind @param {string} name */
  archived: (kind, name) => `.inbox/.archived/${kind}/${name}`,
  /** The knowledge directory, or a file in it. @param {...string} segments */
  knowledge: (...segments) => [KNOWLEDGE_DIR, ...segments].join('/'),
  /** The machine-local cache, or a path in it. @param {...string} segments */
  cache: (...segments) => ['.cache', ...segments].join('/'),
  /** A unit's folder, or a path in it. @param {string} unit @param {...string} segments */
  unit: (unit, ...segments) => [unit, ...segments].join('/'),
  /** @param {string} unit */
  manifest: (unit) => `${unit}/manifest.json`,
  /** A topic's folder, or a path in it. @param {string} unit @param {string} topic @param {...string} segments */
  topic: (unit, topic, ...segments) => [unit, 'topics', topic, ...segments].join('/'),
  /** A unit's assets, a folder whose names are its own, or a path in it. @param {string} unit @param {...string} segments */
  assets: (unit, ...segments) => [unit, 'assets', ...segments].join('/'),
  /** A topic's document: a discussion's log, an investigation's file. @param {string} unit @param {'discussion'|'investigation'} phase @param {string} topic */
  doc: (unit, phase, topic) => (phase === 'discussion' ? `${unit}/topics/${topic}/log.md` : `${unit}/${phase}/${topic}.md`),
  /** A topic's mailbox, or a message waiting in it. @param {string} unit @param {string} topic @param {string} [name] */
  mailbox: (unit, topic, name) => [unit, 'topics', topic, 'mail', ...(name === undefined ? [] : [name])].join('/'),
  /** A topic's experiment record, or a path in it. @param {string} unit @param {string} topic @param {...string} segments */
  experiment: (unit, topic, ...segments) => [unit, 'topics', topic, 'experiments', ...segments].join('/'),
  /** @param {string} unit @param {string} topic */
  spec: (unit, topic) => `${unit}/specification/${topic}/specification.md`,
  /** @param {string} unit @param {string} topic */
  plan: (unit, topic) => `${unit}/planning/${topic}/planning.md`,
  /** A unit's discovery session log. @param {string} unit @param {string} number zero-padded */
  session: (unit, number) => `${unit}/discovery/session-${number}.md`,
  /** The product's conversation's session log. @param {string} number zero-padded */
  productSession: (number) => `.product/sessions/session-${number}.md`,
  /** A spike's folder, the product's or a unit's, or a path in it. @param {string} owner `.product`, or a unit @param {string} spike `NNN-{slug}` @param {...string} segments */
  spike: (owner, spike, ...segments) => [owner, 'spikes', spike, ...segments].join('/'),
  /** A topic's brief. @param {string} unit @param {string} topic */
  brief: (unit, topic) => `${unit}/topics/${topic}/brief.md`,
  /** A file the person shared. @param {string} unit @param {...string} segments */
  imports: (unit, ...segments) => [unit, 'imports', ...segments].join('/'),
  /** A unit's analysis file. @param {string} unit @param {string} name */
  unitState: (unit, name) => `${unit}/.state/${name}`,
});

/**
 * `content` written at the state-relative `rel`, its folders made.
 * @param {string} dir @param {string} rel @param {string} [content]
 * @returns {string} the file's absolute path
 */
function writeState(dir, rel, content) {
  return createFile(statePath(dir), rel, content);
}

/** The text of the state file at the state-relative `rel`. @param {string} dir @param {string} rel */
function readState(dir, rel) {
  return fs.readFileSync(statePath(dir, rel), 'utf8');
}

/** A unit's manifest as it stands on disk. @param {string} dir @param {string} unit */
function readManifest(dir, unit) {
  return JSON.parse(readState(dir, layout.manifest(unit)));
}

function createManifest(dir, name, data) {
  const manifest = {
    name,
    work_type: 'feature',
    status: 'in-progress',
    description: `Test: ${name}`,
    phases: {},
    ...data,
  };
  writeState(dir, layout.manifest(name), JSON.stringify(manifest, null, 2));
  return manifest;
}

/**
 * A temp folder for each test of the calling file, made before it and
 * removed after it.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite
 * @returns {() => string} the running test's folder, symbolic links resolved
 */
function useTempFolder(prefix) {
  /** @type {string} */
  let folder;
  beforeEach(() => {
    folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  });
  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return () => folder;
}

/** A file's text. @param {string} dir @param {string} relativePath */
function readFile(dir, relativePath) {
  return fs.readFileSync(path.join(dir, relativePath), 'utf8');
}

function createFile(dir, relativePath, content) {
  const full = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || '');
  return full;
}

module.exports = {
  STATE_DIR_NAME, TEMPLATE_DATE, withEnv, datedAt, GIT_TIMEOUT_MS, git, testIdentity, bareRepo, templateFolder, useTempFolder, copyWorld, copyFolder, setupFixture, setupFixtureAt, cleanupFixture,
  statePath, stateRelative, layout, writeState, readState, readManifest, createManifest, createFile, readFile,
};
