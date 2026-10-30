'use strict';

// The migration's harness (tests/README.md §9), what the suites of its
// directives share: the engine copied, once per process, beside the real
// runner and the fixture directives in tests/fixtures/directives/, so it
// finds them as it finds the migrations installed (`directiveEngine`); and
// a project the migration is under way in, made once per process and
// copied (`midMigration`) — its `.workflows/` committed on its code branch
// as today's layout leaves it, and its state worktree at `.leeway/`,
// locked, on a `leeway-state` with no commit yet, holding what the move
// writes: the state's `.gitignore`, the project's manifest and id, the
// unit's manifest with its three topics, and the migrations record, which
// holds the fixture directives the boot suites never reach.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, initRepo, createFile, statePath, layout, treeSnapshot } = harness;
const { templateFolder, copyWorld, STATE_DIR_NAME } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_GITIGNORE, STATE_LOCK_REASON, BRANCH_REF } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const FIXTURES = path.join(__dirname, '../fixtures/directives');
const RUNNER = path.join(SCRIPTS, '../../leeway-migrate/scripts/migrate.cjs');

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });

// The unit's discussion as today's layout keeps it, each topic's map of
// subtopics among it: the topics' decided subtopics are what the fixture
// records directive's check holds the ledger to.
const OLD_UNIT = {
  name: UNIT,
  work_type: 'epic',
  status: 'in-progress',
  phases: {
    discussion: {
      items: {
        licensing: { status: 'completed', subtopics: { 'trial-length': { status: 'decided', parent: null }, 'seat-count': { status: 'decided', parent: null } } },
        search: { status: 'completed', subtopics: { ranking: { status: 'decided', parent: null }, 'typo-tolerance': { status: 'deferred', parent: null } } },
        onboarding: { status: 'in-progress', subtopics: { permissions: { status: 'decided', parent: null }, 'first-run': { status: 'exploring', parent: null } } },
      },
    },
  },
};

// Each topic's decided subtopics, as the fixture check names them.
const DECIDED = Object.freeze({ licensing: ['trial-length', 'seat-count'], search: ['ranking'], onboarding: ['permissions'] });

// The unit as the move writes it.
const MOVED_UNIT = {
  name: UNIT,
  work_type: 'epic',
  status: 'in-progress',
  phases: { discussion: { items: { licensing: { status: 'in-progress' }, search: { status: 'in-progress' }, onboarding: { status: 'in-progress' } } } },
};

// The fixture directives whose checks are broken, recorded so no run stops at them.
const RECORDED = ['090', '091', '092', '093'];

/** @type {(ReturnType<typeof harness.harness> & {path: string, migrations: string})|null} */
let engine = null;

/**
 * The engine copied into a skills folder beside the real runner and the
 * fixture directives as its migrations: its path, its migrations folder,
 * and the shapes bound to it. Made once per process and never written to.
 */
function directiveEngine() {
  if (engine !== null) return engine;
  const skills = templateFolder('directive-engine-');
  fs.cpSync(path.dirname(SCRIPTS), path.join(skills, 'leeway-engine'), { recursive: true });
  const migrations = path.join(skills, 'leeway-migrate/scripts/migrations');
  fs.cpSync(FIXTURES, migrations, { recursive: true });
  fs.copyFileSync(RUNNER, path.join(skills, 'leeway-migrate/scripts/migrate.cjs'));
  const at = path.join(skills, 'leeway-engine/scripts/engine.cjs');
  engine = { ...harness.harness(at), path: at, migrations };
  return engine;
}

/** @param {string} dir */
function buildMidMigration(dir) {
  initRepo(dir);
  createFile(dir, 'README.md', '# Fumi\n');
  createFile(dir, `.workflows/${UNIT}/manifest.json`, jsonText(OLD_UNIT));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), `/${STATE_DIR_NAME}/\n`);
  const root = path.join(dir, STATE_DIR_NAME);
  git(dir, ['worktree', 'add', '-q', '--detach', '--no-checkout', root]);
  git(root, ['symbolic-ref', 'HEAD', BRANCH_REF]);
  git(dir, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, root]);
  createFile(root, layout.gitignore, STATE_GITIGNORE);
  createFile(root, layout.projectManifest, jsonText({ project_id: newId() }));
  createFile(root, layout.manifest(UNIT), jsonText(MOVED_UNIT));
  createFile(root, layout.migrations, RECORDED.map((id) => `${id}\n`).join(''));
}

/** @type {string|null} */
let template = null;

/**
 * A project the migration is under way in, at `dir`.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved
 */
function midMigration(dir) {
  if (template === null) {
    template = templateFolder('mid-migration-template-');
    buildMidMigration(template);
  }
  return copyWorld(template, dir);
}

/** Whether the project's `leeway-state` has no commit yet. @param {string} dir */
function stateUnborn(dir) {
  return git(dir, ['for-each-ref', BRANCH_REF]).trim() === '';
}

/** The code branch's tip. @param {string} dir */
function codeHead(dir) {
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

/**
 * The fixture records directive's entry for a decided subtopic, written
 * through the directive engine: its response.
 * @param {string} dir @param {string} topic @param {string} subtopic
 */
function enter(dir, topic, subtopic) {
  return directiveEngine().ok(dir, ['ledger', 'find', `${UNIT}.discussion.${topic}`], {
    env: SESSION,
    stdin: JSON.stringify({ text: subtopic, how: 'read from the discussion\'s map', by: 'claude', who_moved_whom: 'none' }),
  });
}

/** Each of a topic's decided subtopics entered. @param {string} dir @param {keyof typeof DECIDED} topic */
function enterTopic(dir, topic) {
  for (const subtopic of DECIDED[topic]) enter(dir, topic, subtopic);
}

/**
 * A call to the directive engine that must refuse, leaving every file of
 * the state as it was and the state branch with no commit yet: its error.
 * @param {string} dir @param {string[]} args @param {import('./engine-harness.cjs').CallOptions} [opts]
 */
function refusedUntouched(dir, args, opts = { env: SESSION }) {
  const before = treeSnapshot(dir);
  const { error } = directiveEngine().refuses(dir, args, opts);
  assert.deepStrictEqual(treeSnapshot(dir), before, `engine ${args.join(' ')} wrote on refusing`);
  assert.ok(stateUnborn(dir), `engine ${args.join(' ')} committed on refusing`);
  return error;
}

/** The migrations record's lines. @param {string} dir */
function recorded(dir) {
  return fs.readFileSync(statePath(dir, layout.migrations), 'utf8').split('\n').filter(Boolean);
}

module.exports = {
  UNIT, SESSION, DECIDED, RECORDED, FIXTURES, directiveEngine, midMigration, stateUnborn, codeHead, enter, enterTopic, refusedUntouched, recorded,
};
